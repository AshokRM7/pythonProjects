"""End-to-end smoke test using FastAPI TestClient (no server needed).

Flow: create customer -> accounts -> upload XLSX/CSV/PDF statements ->
declare a loan -> run analysis -> print key results.

Run:  python scripts/e2e_test.py
"""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# use a throwaway database so test runs never touch the real credisight.db
_tmp_db = Path(tempfile.gettempdir()) / "credisight_e2e_test.db"
_tmp_db.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db}"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parent.parent / "sample_data"


def check(resp, ctx):
    if resp.status_code >= 300:
        print(f"FAIL [{ctx}] {resp.status_code}: {resp.text[:500]}")
        sys.exit(1)
    return resp.json()


def main():
    h = check(client.get("/api/health"), "health")
    print("health:", h)

    cust = check(client.post("/api/customers", json={
        "name": "Arjun Mehta", "pan": "ABCDE1234F", "employment_type": "salaried",
        "declared_monthly_income": 85000,
    }), "create customer")
    cid = cust["id"]

    acc1 = check(client.post(f"/api/customers/{cid}/accounts", json={
        "bank_name": "HDFC Bank", "account_number": "50100234567890", "account_type": "savings",
    }), "account 1")
    acc2 = check(client.post(f"/api/customers/{cid}/accounts", json={
        "bank_name": "SBI", "account_number": "00000034567812345", "account_type": "current",
    }), "account 2")
    acc3 = check(client.post(f"/api/customers/{cid}/accounts", json={
        "bank_name": "ICICI Bank", "account_number": "001601534987", "account_type": "savings",
    }), "account 3")

    uploads = [
        (acc1["id"], "hdfc_savings.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        (acc2["id"], "sbi_current.csv", "text/csv"),
        (acc3["id"], "icici_savings.pdf", "application/pdf"),
    ]
    for acc_id, fname, mime in uploads:
        p = SAMPLES / fname
        with p.open("rb") as fh:
            r = client.post(f"/api/accounts/{acc_id}/statements",
                            files={"file": (fname, fh, mime)})
        stmt = check(r, f"upload {fname}")
        print(f"uploaded {fname}: status={stmt['parse_status']} txns={stmt['txn_count']} "
              f"period={stmt['period_start']}..{stmt['period_end']} notes={stmt['parse_notes'][:120]}")
        assert stmt["txn_count"] > 0, f"no transactions parsed from {fname}"

    check(client.post(f"/api/customers/{cid}/loans", json={
        "lender": "HDFC Ltd", "loan_type": "home", "sanctioned_amount": 2500000,
        "outstanding_amount": 1800000, "emi_amount": 18200, "remaining_tenure_months": 140,
    }), "loan")

    analysis = check(client.post(f"/api/customers/{cid}/analyze", json={
        "proposed_loan_amount": 500000, "proposed_emi": 12500,
        "proposed_tenure_months": 48, "use_llm": True,
    }), "analyze")
    r = analysis["result"]

    print("\n===== ANALYSIS RESULT =====")
    s = r["summary"]
    print(f"period: {s['period_start']} .. {s['period_end']}  months={s['months_covered']} txns={s['txn_count']}")
    print(f"inflow={s['total_inflow']:,.0f} outflow={s['total_outflow']:,.0f} avg_bal={s['average_balance']:,.0f}")
    print(f"months: {len(r['monthly'])} rows; first: {r['monthly'][0]}")
    inc = r["income"]
    print(f"income: est_monthly={inc['estimated_monthly_income']:,.0f} "
          f"regularity={inc['income_regularity_pct']}% sources={len(inc['salary_sources'])}")
    emi = r["emi"]
    print(f"emi: monthly_outgo={emi['estimated_monthly_emi_outgo']:,.0f} detected={len(emi['detected_emis'])}")
    for e in emi["detected_emis"][:5]:
        print(f"   - {e['lender_hint'][:40]}: {e['emi_amount']:,.0f} x{e['occurrences']} recurring={e['recurring']}")
    b = r["bounce"]
    print(f"bounces: {b['bounce_count']} penalties={b['total_penalty_amount']}")
    c = r["cash"]
    print(f"cash: dep={c['cash_deposit_total']:,.0f} ({c['cash_deposit_pct_of_inflow']}%) "
          f"wdl={c['cash_withdrawal_total']:,.0f}")
    print(f"unusual alerts: {r['unusual']['alert_count']}")
    print("red flags:")
    for f in r["red_flags"]:
        print(f"   [{f['severity']}] {f['code']}: {f['message']}")
    cap = r["capacity"]
    print(f"capacity: income={cap['estimated_monthly_income']:,.0f} obligations={cap['existing_obligations_used']:,.0f} "
          f"FOIR={cap['foir_existing_pct']}% -> with proposed={cap['foir_with_proposed_pct']}% verdict={cap['verdict']}")
    print(f"score: {r['score']['total']} ({r['score']['band']}) {r['score']['breakdown']}")
    print(f"narrative ({r['narrative_source']}): {r['narrative'][:400]}")
    print("\nE2E TEST PASSED")


if __name__ == "__main__":
    main()
