"""Parse any statement file and validate the result.

Usage: python scripts/test_parse.py <file>

Prints transaction count, period, direction stats, and verifies debit/credit
correctness against the running balance column where present.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.parsing.pdf_parser import parse_pdf  # noqa: E402
from app.services.parsing.excel_parser import parse_excel  # noqa: E402

path = Path(sys.argv[1])
result = parse_pdf(path) if path.suffix.lower() == ".pdf" else parse_excel(path)

print(f"status: {result.status}")
for n in result.notes:
    print(f"note:   {n}")
txns = result.transactions
print(f"transactions: {len(txns)}")
if not txns:
    sys.exit(1)

print(f"period: {min(t.txn_date for t in txns)} .. {max(t.txn_date for t in txns)}")
debits = sum(1 for t in txns if t.debit > 0)
credits = sum(1 for t in txns if t.credit > 0)
print(f"debits: {debits} (total {sum(t.debit for t in txns):,.2f})  "
      f"credits: {credits} (total {sum(t.credit for t in txns):,.2f})")

# balance-continuity validation
with_bal = [t for t in txns if t.balance is not None]
ok = bad = 0
prev = None
for t in txns:
    if t.balance is None:
        continue
    if prev is not None:
        expected = prev - t.debit + t.credit
        if abs(expected - t.balance) <= 0.02:
            ok += 1
        else:
            bad += 1
            if bad <= 5:
                print(f"  MISMATCH {t.txn_date} {t.description[:60]!r} "
                      f"dr={t.debit} cr={t.credit} prev={prev} bal={t.balance}")
    prev = t.balance
print(f"balance continuity: {ok} ok / {bad} mismatched (of {len(with_bal)} rows with balance)")

print("\nfirst 5:")
for t in txns[:5]:
    print(f"  {t.txn_date} dr={t.debit:>10,.2f} cr={t.credit:>10,.2f} bal={t.balance} {t.description[:70]!r}")
print("last 3:")
for t in txns[-3:]:
    print(f"  {t.txn_date} dr={t.debit:>10,.2f} cr={t.credit:>10,.2f} bal={t.balance} {t.description[:70]!r}")
