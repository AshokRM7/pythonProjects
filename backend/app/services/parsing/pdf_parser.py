"""PDF bank statement parser built on pdfplumber.

Strategy (layered):
1. Extract tables with pdfplumber (lines strategy, then text strategy).
2. Independently parse raw text lines with a multi-line "anchor" parser that
   handles passbook-style layouts (narration wrapped across several lines,
   date mid-block, time/Chq trailer lines).
3. Keep whichever result recovered more transactions — some banks (e.g.
   e-passbooks) produce tables that pdfplumber can only partially reconstruct.

Debit/credit direction in the text parser is resolved by BALANCE DELTA
(prev_balance - amount == new_balance → debit) which is exact whenever a
running balance column exists; narration markers (UPI/DR, /CR/, "Dr") are the
fallback.
"""
from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

from app.services.parsing.normalizer import (
    RawTable, ParseResult, normalize_table, parse_amount, parse_date, NormalizedTxn,
)


def parse_pdf(path: str | Path) -> ParseResult:
    path = Path(path)
    tables: list[RawTable] = []
    text_lines: list[str] = []
    PROBE_PAGES = 3
    try:
        with pdfplumber.open(path) as pdf:
            n_pages = len(pdf.pages)
            # text extraction is cheap — always do every page
            for page in pdf.pages:
                txt = page.extract_text() or ""
                text_lines.extend(txt.splitlines())
            # table extraction is expensive: probe the first few pages, and only
            # run the remaining pages if the probe actually yields transactions
            # (large e-passbooks/statements often produce junk tables on every page).
            for page_no, page in enumerate(pdf.pages[:PROBE_PAGES], start=1):
                for t in _extract_page_tables(page):
                    tables.append(RawTable(rows=t, source=f"{path.name} p{page_no}"))
            probe_txns = 0
            if tables:
                probe_rows: list[list[str]] = []
                for t in tables:
                    probe_rows.extend(t.rows)
                probe_txns = len(normalize_table(
                    RawTable(rows=probe_rows, source=path.name)).transactions)
            if probe_txns >= 3 and n_pages > PROBE_PAGES:
                for page_no, page in enumerate(pdf.pages[PROBE_PAGES:], start=PROBE_PAGES + 1):
                    for t in _extract_page_tables(page):
                        tables.append(RawTable(rows=t, source=f"{path.name} p{page_no}"))
            elif probe_txns < 3:
                tables = tables if probe_txns > 0 else []
    except Exception as exc:  # encrypted / corrupt / image-only
        r = ParseResult(status="failed")
        r.notes.append(f"Could not open PDF {path.name}: {exc}")
        return r

    table_result: ParseResult | None = None
    if tables:
        # merge all page tables into one logical table so headers on page 1 apply to all pages
        combined: list[list[str]] = []
        for t in tables:
            combined.extend(t.rows)
        table_result = normalize_table(RawTable(rows=combined, source=path.name))

    text_result = _parse_text_lines(text_lines, path.name)

    n_table = len(table_result.transactions) if table_result else 0
    n_text = len(text_result.transactions)

    # Prefer the structured table result unless the text parser recovered
    # meaningfully more transactions (mangled/partial table reconstruction).
    if n_table and n_table >= 0.8 * n_text:
        return table_result
    if n_text:
        if n_table:
            text_result.notes.append(
                f"{path.name}: table extraction found only {n_table} rows; "
                f"used text-line parser ({n_text} transactions) instead.")
        return text_result
    if table_result and n_table:
        return table_result

    # Nothing readable as text — this is a scanned page or a statement whose
    # text was flattened into vector outlines. Fall back to OCR.
    from app.services.parsing.ocr import ocr_pdf, pdf_has_text_layer

    if not pdf_has_text_layer(path):
        ocr_result = ocr_pdf(path)
        if ocr_result.transactions:
            return ocr_result
        r = table_result or text_result
        r.status = "failed"
        r.notes = ocr_result.notes or r.notes
        return r

    r = table_result or text_result
    r.status = "failed"
    r.notes.append(
        f"{path.name}: no transactions found. The page text could not be matched to a "
        "statement layout — please upload the Excel/CSV export of the same period."
    )
    return r


def _extract_page_tables(page) -> list[list[list[str]]]:
    settings_attempts = [
        {"vertical_strategy": "lines", "horizontal_strategy": "lines"},
        {"vertical_strategy": "text", "horizontal_strategy": "text",
         "text_x_tolerance": 2, "intersection_tolerance": 5},
    ]
    for settings in settings_attempts:
        try:
            tables = page.extract_tables(table_settings=settings)
        except Exception:
            continue
        cleaned = []
        for t in tables or []:
            rows = [[(c or "").replace("\n", " ").strip() for c in row] for row in t]
            rows = [r for r in rows if any(r)]
            if len(rows) >= 2 and max(len(r) for r in rows) >= 3:
                cleaned.append(rows)
        if cleaned:
            return cleaned
    return []


# ─────────────────────────── text-line parser ───────────────────────────
# anchor: a line that STARTS with a date (numeric or month-name form) and
# contains at least one money amount somewhere after it.
_DATE_START_RE = re.compile(
    r"^(?P<date>"
    r"\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3,9})[-/. ]\d{2,4}"   # 21-01-2026 / 21 Jan 2026
    r"|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}"                     # Apr 02 2025 / April 2, 2025
    r"|\d{4}-\d{2}-\d{2}"                                     # 2026-01-21
    r")\b"
)
# money token: 1,234.56 with optional INR/Rs prefix and Cr/Dr suffix
_NUM_TOKEN_RE = re.compile(r"(?:(?:INR|Rs\.?)\s*)?[\d,]+\.\d{2}(?:\s*(?:Cr|Dr|CR|DR)\b)?")

_OPENING_RE = re.compile(
    r"^opening\s+balance\b.*?((?:INR|Rs\.?)?\s*[\d,]+\.\d{2}(?:\s*(?:Cr|Dr|CR|DR))?)\s*$",
    re.IGNORECASE)
# page furniture / metadata lines that must never join a narration
_META_RE = re.compile(
    r"^(statement\s+(for|of)|account\s*(no|number|statement|activity|summary|details|holder)|"
    r"customer\s+id|customer.s\s+address|branch\s+(code|name)|"
    r"ifsc|micr|phone|address|name\b|page\s+\d+|date\s+particulars|txn\s+date|"
    r"date\s+transaction\s+details|for\s+period|account\s+currency|"
    r"opening\s+balance|closing\s+balance|ending\s+balance|total\b|grand\s+total|"
    r"balance\s+(brought|carried)|"
    r"b/f\b|c/f\b|this\s+is\s+a\s+(system|computer)|end\s+of\s+statement)", re.IGNORECASE)
# trailer lines that belong to the PREVIOUS transaction (ref/time stamps)
_TRAIL_RE = re.compile(r"^(chq[\s.:]|cheque\s*(no)?[\s.:]|ref[\s.:]|\d{2}:\d{2}(:\d{2})?$|utr[\s.:])", re.IGNORECASE)

_CR_MARK = re.compile(r"(^|[/\s])(upi/cr|neft.?cr|imps.?cr|rtgs.?cr|/cr/|\bcr\b)([/\s]|$)", re.IGNORECASE)
_DR_MARK = re.compile(r"(^|[/\s])(upi/dr|neft.?dr|imps.?dr|rtgs.?dr|/dr/|\bdr\b)([/\s]|$)", re.IGNORECASE)
_CREDIT_HINTS = re.compile(
    r"salary|credit|deposit|refund|interest|cashback|received|reversal|\brev\b", re.IGNORECASE)


def _parse_text_lines(lines: list[str], source: str) -> ParseResult:
    result = ParseResult()
    pending: list[str] = []          # narration fragments waiting for their anchor line
    prev_balance: float | None = None
    last: NormalizedTxn | None = None
    balance_direction_hits = 0

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        m_open = _OPENING_RE.match(line)
        if m_open:
            prev_balance = parse_amount(m_open.group(1))
            pending.clear()
            continue

        if _META_RE.match(line):
            pending.clear()
            continue

        m = _DATE_START_RE.match(line)
        if m is None:
            if _TRAIL_RE.match(line):
                # ref/time trailer — attach to the transaction it belongs to
                if last is not None and line.lower().startswith(("chq", "cheque", "ref", "utr")):
                    last.description = (last.description + " " + line).strip()[:800]
                continue
            if len(line) > 2:
                pending.append(line)
                if len(pending) > 8:
                    pending.pop(0)
            continue

        d = parse_date(m.group("date"))
        rest = line[m.end():]
        tokens = _NUM_TOKEN_RE.findall(rest)
        nums = [parse_amount(tok) for tok in tokens]
        nums = [n for n in nums if n is not None]
        if d is None or not nums:
            pending.append(line)
            continue

        # body = the rest of the line minus money tokens and column-placeholder dashes
        body = _NUM_TOKEN_RE.sub(" ", rest)
        body = re.sub(r"\s-(?=\s|$)", " ", body)
        body = re.sub(r"\s+", " ", body).strip(" -")
        desc = " ".join(pending + ([body] if body else [])).strip()[:800]
        pending.clear()

        balance: float | None = None
        debit = credit = 0.0
        is_debit: bool | None = None

        if len(nums) >= 2:
            balance = nums[-1]  # keep the sign: 'DR' balances (overdrawn/CC accounts) are negative
            amount_tokens = [abs(n) for n in nums[:-1]]
            amt = None
            # balance arithmetic picks BOTH the right amount token and the direction
            if prev_balance is not None:
                for cand in amount_tokens:
                    if abs((prev_balance - cand) - balance) <= 0.02:
                        amt, is_debit = cand, True
                        break
                    if abs((prev_balance + cand) - balance) <= 0.02:
                        amt, is_debit = cand, False
                        break
            if amt is None:
                nonzero = [n for n in amount_tokens if n > 0.004]
                amt = nonzero[0] if nonzero else amount_tokens[0]
        else:
            amt = nums[0]

        if is_debit is None:
            is_debit = _resolve_direction(amt, desc, prev_balance, balance)
        else:
            balance_direction_hits += 1
        if is_debit is None:
            # last resort keyword guess
            is_debit = not _CREDIT_HINTS.search(desc)

        if is_debit:
            debit = abs(amt)
        else:
            credit = abs(amt)

        if balance is not None:
            prev_balance = balance

        last = NormalizedTxn(txn_date=d, description=desc, debit=debit, credit=credit, balance=balance)
        result.transactions.append(last)

    if result.transactions:
        n = len(result.transactions)
        if balance_direction_hits >= n * 0.6:
            result.notes.append(
                f"{source}: parsed {n} transactions from text; debit/credit verified via running balance.")
        else:
            result.notes.append(
                f"{source}: parsed {n} transactions via text-line fallback; "
                "verify debit/credit direction on the review screen.")
    return result


def _resolve_direction(amt: float, desc: str, prev_balance: float | None,
                       balance: float | None) -> bool | None:
    """True=debit, False=credit, None=unknown."""
    # 1) explicit Dr suffix parsed as negative by parse_amount
    if amt < 0:
        return True
    # 2) balance arithmetic — exact when a running balance exists
    if prev_balance is not None and balance is not None:
        a = abs(amt)
        if abs((prev_balance - a) - balance) <= 0.02:
            return True
        if abs((prev_balance + a) - balance) <= 0.02:
            return False
    # 3) DR/CR markers embedded in the narration (UPI/DR/..., NEFT-CR-...)
    dr = bool(_DR_MARK.search(desc))
    cr = bool(_CR_MARK.search(desc))
    if dr and not cr:
        return True
    if cr and not dr:
        return False
    return None
