"""Normalizes raw tabular data from any bank statement layout into clean transactions.

Handles the messy realities of bank statements:
- Varied header names ("Txn Date", "Value Dt", "Narration", "Particulars", "Withdrawal Amt"...)
- Single amount column with a DR/CR indicator column
- Signed single amount columns
- Indian/international number formats: 1,23,456.78 / 1,234.56 / (500.00) / 500.00 Cr
- Many date formats (dd/mm/yyyy, dd-MMM-yy, yyyy-mm-dd, excel serial dates)
- Junk rows (headers repeated on each page, footers, totals, blank lines)
- Multi-line narrations wrapped across rows
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime

from dateutil import parser as dateparser


@dataclass
class RawTable:
    """A table of raw string cells extracted from a source document."""
    rows: list[list[str]]
    source: str = ""


@dataclass
class NormalizedTxn:
    txn_date: date
    description: str
    debit: float = 0.0
    credit: float = 0.0
    balance: float | None = None


@dataclass
class ParseResult:
    transactions: list[NormalizedTxn] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    status: str = "parsed"  # parsed | partial | failed


# ---------------------------------------------------------------- header mapping
DATE_HEADERS = [
    "txn date", "transaction date", "tran date", "date", "value date", "value dt",
    "post date", "posting date", "book date", "trans date", "txn dt",
]
DESC_HEADERS = [
    "narration", "description", "particulars", "transaction details", "details",
    "remarks", "transaction description", "narrative", "transaction remarks",
]
DEBIT_HEADERS = [
    "withdrawal amt", "withdrawal amount", "withdrawal", "debit", "debit amount",
    "dr amount", "dr amt", "withdrawals", "debits", "paid out", "dr",
    "withdrawal (dr)", "debit(dr)",
]
CREDIT_HEADERS = [
    "deposit amt", "deposit amount", "deposit", "credit", "credit amount",
    "cr amount", "cr amt", "deposits", "credits", "paid in", "cr",
    "deposit (cr)", "credit(cr)",
]
BALANCE_HEADERS = [
    "closing balance", "balance", "running balance", "available balance",
    "balance amt", "bal", "closing bal", "balance (inr)",
]
AMOUNT_HEADERS = ["amount", "transaction amount", "amount (inr)", "amt", "txn amount"]
DRCR_HEADERS = ["dr/cr", "dr / cr", "cr/dr", "type", "txn type", "debit/credit", "d/c"]
REF_HEADERS = ["chq no", "cheque no", "ref no", "chq./ref.no.", "ref/cheque no", "cheque number", "utr", "instrument no"]

_num_junk = re.compile(r"[₹$€£,\s]|INR|Rs\.?", re.IGNORECASE)


def _norm_header(h: str) -> str:
    return re.sub(r"[^a-z/ ().]", " ", (h or "").strip().lower()).strip()


def _match_header(header: str, candidates: list[str]) -> bool:
    h = _norm_header(header)
    if not h:
        return False
    if h in candidates:
        return True
    return any(c == h or (len(c) > 3 and c in h) for c in candidates)


def parse_amount(raw: str | float | int | None) -> float | None:
    """Parse a money string in Indian or international format. Returns None if not a number."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    if not s or s in {"-", "--", "NA", "N/A", "nil", "NIL"}:
        return None
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]
    suffix = s[-2:].lower() if len(s) >= 2 else ""
    drcr = None
    if suffix in {"dr", "cr"}:
        drcr = suffix
        s = s[:-2].strip()
    s = _num_junk.sub("", s)
    if s.endswith("-"):  # trailing minus
        negative = True
        s = s[:-1]
    if s.startswith("-"):
        negative = True
        s = s[1:]
    if not s or not re.fullmatch(r"\d*\.?\d+", s):
        return None
    val = float(s)
    if negative or drcr == "dr":
        val = -val
    return val


_EXCEL_EPOCH = datetime(1899, 12, 30)


def parse_date(raw) -> date | None:
    """Parse a date in many formats; day-first by default (Indian statements)."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if isinstance(raw, (int, float)) and 20000 < float(raw) < 60000:
        try:
            from datetime import timedelta
            return (_EXCEL_EPOCH + timedelta(days=float(raw))).date()
        except Exception:
            return None
    s = str(raw).strip()
    if not s or len(s) < 5 or len(s) > 30:
        return None
    if not re.search(r"\d", s):
        return None
    # reject strings that are clearly not dates (amounts, long text)
    if re.fullmatch(r"[\d,]+\.?\d*", s) and "." in s:
        return None
    for dayfirst in (True, False):
        try:
            dt = dateparser.parse(s, dayfirst=dayfirst, fuzzy=False)
            if dt and 1990 <= dt.year <= 2100:
                return dt.date()
        except (ValueError, OverflowError):
            continue
    return None


@dataclass
class ColumnMap:
    date_idx: int = -1
    desc_idx: int = -1
    debit_idx: int = -1
    credit_idx: int = -1
    balance_idx: int = -1
    amount_idx: int = -1
    drcr_idx: int = -1

    @property
    def valid(self) -> bool:
        has_amounts = (self.debit_idx >= 0 or self.credit_idx >= 0 or self.amount_idx >= 0)
        return self.date_idx >= 0 and has_amounts


def detect_columns(row: list[str]) -> ColumnMap | None:
    """Try to interpret a row as a header row and map columns."""
    cm = ColumnMap()
    matched = 0
    for idx, cell in enumerate(row):
        cell = str(cell or "")
        if cm.date_idx < 0 and _match_header(cell, DATE_HEADERS):
            cm.date_idx = idx; matched += 1
        elif cm.desc_idx < 0 and _match_header(cell, DESC_HEADERS):
            cm.desc_idx = idx; matched += 1
        elif cm.drcr_idx < 0 and _match_header(cell, DRCR_HEADERS):
            cm.drcr_idx = idx; matched += 1
        elif cm.debit_idx < 0 and _match_header(cell, DEBIT_HEADERS):
            cm.debit_idx = idx; matched += 1
        elif cm.credit_idx < 0 and _match_header(cell, CREDIT_HEADERS):
            cm.credit_idx = idx; matched += 1
        elif cm.balance_idx < 0 and _match_header(cell, BALANCE_HEADERS):
            cm.balance_idx = idx; matched += 1
        elif cm.amount_idx < 0 and _match_header(cell, AMOUNT_HEADERS):
            cm.amount_idx = idx; matched += 1
    if cm.valid and matched >= 3:
        return cm
    return None


def _is_summary_row(desc: str) -> bool:
    d = desc.strip().lower()
    return bool(re.match(
        r"^(opening balance|closing balance|total|grand total|balance carried|balance brought|"
        r"statement summary|page total|carried forward|brought forward|b/f|c/f)\b", d))


def normalize_table(table: RawTable) -> ParseResult:
    """Convert a raw table into normalized transactions using header detection."""
    result = ParseResult()
    rows = [[("" if c is None else str(c).strip()) for c in r] for r in table.rows]
    cm: ColumnMap | None = None
    header_row_idx = -1

    for i, row in enumerate(rows[:30]):
        cand = detect_columns(row)
        if cand:
            cm = cand
            header_row_idx = i
            break

    if cm is None:
        cm = _infer_columns_positionally(rows)
        if cm is None:
            result.status = "failed"
            result.notes.append(f"Could not detect statement columns in {table.source or 'table'}.")
            return result
        result.notes.append("Headers not found; columns inferred from data shape.")
        header_row_idx = -1

    last_txn: NormalizedTxn | None = None
    for row in rows[header_row_idx + 1:]:
        if not any(c for c in row):
            continue
        # skip repeated header rows (page breaks)
        if detect_columns(row):
            continue
        get = lambda idx: row[idx] if 0 <= idx < len(row) else ""
        d = parse_date(get(cm.date_idx))
        desc = get(cm.desc_idx) if cm.desc_idx >= 0 else " ".join(c for c in row if c)

        if d is None:
            # continuation line of a wrapped narration
            if last_txn is not None and desc and not _looks_numeric_row(row):
                last_txn.description = (last_txn.description + " " + desc).strip()[:800]
            continue
        if _is_summary_row(desc):
            continue

        debit = credit = 0.0
        balance = None
        if cm.amount_idx >= 0 and cm.debit_idx < 0 and cm.credit_idx < 0:
            amt = parse_amount(get(cm.amount_idx))
            if amt is None:
                continue
            drcr = get(cm.drcr_idx).strip().lower() if cm.drcr_idx >= 0 else ""
            is_debit = drcr.startswith(("dr", "d", "w")) if drcr else amt < 0
            if is_debit:
                debit = abs(amt)
            else:
                credit = abs(amt)
        else:
            dv = parse_amount(get(cm.debit_idx)) if cm.debit_idx >= 0 else None
            cv = parse_amount(get(cm.credit_idx)) if cm.credit_idx >= 0 else None
            debit = abs(dv) if dv else 0.0
            credit = abs(cv) if cv else 0.0
            if debit == 0.0 and credit == 0.0:
                continue
        if cm.balance_idx >= 0:
            balance = parse_amount(get(cm.balance_idx))

        last_txn = NormalizedTxn(txn_date=d, description=desc[:800], debit=debit, credit=credit, balance=balance)
        result.transactions.append(last_txn)

    if not result.transactions:
        result.status = "failed"
        result.notes.append(f"No transactions recognized in {table.source or 'table'}.")
    return result


def _looks_numeric_row(row: list[str]) -> bool:
    nums = sum(1 for c in row if c and parse_amount(c) is not None)
    return nums >= 2


def _infer_columns_positionally(rows: list[list[str]]) -> ColumnMap | None:
    """Fallback when no header row exists: find the date column and amount columns by content."""
    if not rows:
        return None
    width = max(len(r) for r in rows)
    date_scores = [0] * width
    num_scores = [0] * width
    text_scores = [0] * width
    sample = [r for r in rows if any(c for c in r)][:60]
    for r in sample:
        for i in range(width):
            c = r[i] if i < len(r) else ""
            if not c:
                continue
            if parse_date(c):
                date_scores[i] += 1
            elif parse_amount(c) is not None:
                num_scores[i] += 1
            elif len(c) > 6:
                text_scores[i] += 1
    if not sample:
        return None
    threshold = max(2, len(sample) // 3)
    cm = ColumnMap()
    cm.date_idx = max(range(width), key=lambda i: date_scores[i])
    if date_scores[cm.date_idx] < threshold:
        return None
    cm.desc_idx = max(range(width), key=lambda i: text_scores[i])
    num_cols = [i for i in range(width) if num_scores[i] >= threshold and i not in (cm.date_idx, cm.desc_idx)]
    if len(num_cols) >= 3:
        cm.debit_idx, cm.credit_idx, cm.balance_idx = num_cols[0], num_cols[1], num_cols[-1]
    elif len(num_cols) == 2:
        cm.amount_idx, cm.balance_idx = num_cols[0], num_cols[1]
    elif len(num_cols) == 1:
        cm.amount_idx = num_cols[0]
    else:
        return None
    return cm


def merge_results(results: list[ParseResult]) -> ParseResult:
    merged = ParseResult()
    for r in results:
        merged.transactions.extend(r.transactions)
        merged.notes.extend(r.notes)
    ok = sum(1 for r in results if r.status == "parsed")
    if not merged.transactions:
        merged.status = "failed"
    elif ok < len(results):
        merged.status = "partial"
    merged.transactions.sort(key=lambda t: t.txn_date)
    return merged
