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
    try:
        with pdfplumber.open(path) as pdf:
            for page_no, page in enumerate(pdf.pages, start=1):
                for t in _extract_page_tables(page):
                    tables.append(RawTable(rows=t, source=f"{path.name} p{page_no}"))
                txt = page.extract_text() or ""
                text_lines.extend(txt.splitlines())
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

    r = table_result or text_result
    r.status = "failed"
    r.notes.append(
        f"{path.name}: no transactions found. If this is a scanned/image PDF, "
        "please upload a digital (text) statement or an Excel/CSV export."
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
# anchor: a line that starts with a date and ends with 1-4 amounts
_ANCHOR_RE = re.compile(
    r"^(?P<date>\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4})\s*"
    r"(?P<body>.*?)\s*"
    r"(?P<nums>(?:[\d,]+\.\d{2}(?:\s*(?:Cr|Dr|CR|DR))?)(?:\s+[\d,]+\.\d{2}(?:\s*(?:Cr|Dr|CR|DR))?){0,3})\s*$"
)
_NUM_TOKEN_RE = re.compile(r"[\d,]+\.\d{2}(?:\s*(?:Cr|Dr|CR|DR))?")

_OPENING_RE = re.compile(r"^opening\s+balance\b.*?([\d,]+\.\d{2})\s*$", re.IGNORECASE)
# page furniture / metadata lines that must never join a narration
_META_RE = re.compile(
    r"^(statement\s+(for|of)|account\s*(no|number|statement)|customer\s+id|branch\s+(code|name)|"
    r"ifsc|micr|phone|address|name\b|page\s+\d+|date\s+particulars|txn\s+date|"
    r"opening\s+balance|closing\s+balance|total\b|grand\s+total|balance\s+(brought|carried)|"
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

        m = _ANCHOR_RE.match(line)
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
        if d is None:
            pending.append(line)
            continue

        nums = [parse_amount(tok) for tok in _NUM_TOKEN_RE.findall(m.group("nums"))]
        nums = [n for n in nums if n is not None]
        if not nums:
            pending.append(line)
            continue

        body = m.group("body").strip()
        desc = " ".join(pending + ([body] if body else [])).strip()[:800]
        pending.clear()

        balance: float | None = None
        debit = credit = 0.0

        if len(nums) >= 2:
            balance = abs(nums[-1])
            amount_tokens = nums[:-1]
            # pick the transaction amount: single token, or the non-zero one
            nonzero = [n for n in amount_tokens if abs(n) > 0.004]
            amt = nonzero[0] if nonzero else amount_tokens[0]
        else:
            amt = nums[0]

        is_debit = _resolve_direction(amt, desc, prev_balance, balance)
        if is_debit is None:
            # last resort keyword guess
            is_debit = not _CREDIT_HINTS.search(desc)
        elif balance is not None and prev_balance is not None:
            balance_direction_hits += 1

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
