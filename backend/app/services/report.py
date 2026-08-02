"""CAM (Credit Appraisal Memo) report assembly.

Pulls every analysis module together into one JSON document the frontend
renders and the analyst can print/export.
"""
from __future__ import annotations

from datetime import datetime

from app.config import get_settings
from app.services import analysis as A
from app.services import llm


def build_report(customer: dict, txns: list[A.Txn], declared_loans: list[dict],
                 accounts: list[dict], proposal: dict, use_llm: bool = True) -> tuple[dict, bool]:
    """Returns (report, llm_used)."""
    settings = get_settings()

    monthly = A.monthly_analysis(txns)
    summary = A.flow_summary(txns) if txns else _empty_summary()
    income = A.income_analysis(txns, settings.min_salary_occurrences)
    emi = A.emi_analysis(txns)
    bounce = A.bounce_analysis(txns)
    cash = A.cash_analysis(txns)
    patterns = A.pattern_analysis(txns)
    major = A.major_transactions(txns)
    unusual = A.unusual_transactions(txns, settings.high_value_txn_threshold)
    disbursements = A.loan_disbursements(txns)
    flags = A.red_flags(txns, monthly, income, emi, bounce, cash, summary, settings)
    capacity = A.repayment_capacity(
        income, emi, declared_loans, summary, proposal.get("proposed_emi", 0.0), settings)

    balances = A.daily_balance_series(txns)
    balance_series = [{"date": d.isoformat(), "balance": round(b, 2)} for d, b in balances]
    # thin the series for the chart if very long
    if len(balance_series) > 400:
        step = len(balance_series) // 400 + 1
        balance_series = balance_series[::step]

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "customer": customer,
        "accounts": accounts,
        "proposal": proposal,
        "declared_loans": declared_loans,
        "summary": summary,
        "monthly": monthly,
        "income": income,
        "emi": emi,
        "bounce": bounce,
        "loan_disbursements": disbursements,
        "cash": cash,
        "patterns": patterns,
        "major_transactions": major,
        "unusual": unusual,
        "red_flags": flags,
        "capacity": capacity,
        "balance_series": balance_series,
        "score": _composite_score(summary, income, bounce, cash, capacity, flags),
    }

    llm_used = False
    narrative = None
    if use_llm and settings.llm_available:
        narrative = llm.cam_narrative(report)
        llm_used = narrative is not None
    if narrative is None:
        narrative = llm.template_narrative(report)
    report["narrative"] = narrative
    report["narrative_source"] = "llm" if llm_used else "template"
    return report, llm_used


def _empty_summary() -> dict:
    return {
        "total_inflow": 0, "total_outflow": 0, "net_flow": 0, "txn_count": 0,
        "months_covered": 0, "period_start": None, "period_end": None,
        "avg_monthly_inflow": 0, "avg_monthly_outflow": 0, "average_balance": None,
        "min_balance": None, "max_balance": None, "negative_balance_days": 0,
    }


def _composite_score(summary, income, bounce, cash, capacity, flags) -> dict:
    """Banking-behaviour score out of 100 with a transparent breakdown.

    This is a heuristic screening aid for the analyst, not a bureau score.
    """
    parts = {}

    # income regularity (25)
    reg = income.get("income_regularity_pct", 0) or 0
    parts["income_regularity"] = round(min(25.0, 25.0 * reg / 100.0), 1)

    # bounce record (25)
    b = bounce.get("bounce_count", 0)
    parts["bounce_record"] = round(max(0.0, 25.0 - 8.0 * b), 1)

    # balance health (20)
    avg_bal = summary.get("average_balance") or 0
    inflow = summary.get("avg_monthly_inflow") or 0
    ratio = (avg_bal / inflow) if inflow > 0 else 0
    neg_days = summary.get("negative_balance_days", 0)
    bal_score = min(20.0, 20.0 * ratio / 0.5)  # avg balance ≥ half a month's inflow = full marks
    bal_score = max(0.0, bal_score - 2.0 * neg_days)
    parts["balance_health"] = round(bal_score, 1)

    # obligation headroom (20)
    foir = capacity.get("foir_existing_pct")
    cap_pct = capacity.get("foir_policy_cap_pct", 55) or 55
    if foir is None:
        parts["obligation_headroom"] = 8.0  # unknown income — partial credit
    else:
        parts["obligation_headroom"] = round(max(0.0, 20.0 * (1 - min(1.0, foir / cap_pct))), 1)

    # conduct / flags (10)
    high = sum(1 for f in flags if f["severity"] == "high")
    med = sum(1 for f in flags if f["severity"] == "medium")
    parts["conduct"] = round(max(0.0, 10.0 - 4.0 * high - 1.5 * med), 1)

    total = round(sum(parts.values()), 1)
    band = ("strong" if total >= 75 else
            "moderate" if total >= 55 else
            "weak" if total >= 35 else "poor")
    return {"total": total, "band": band, "breakdown": parts,
            "disclaimer": "Heuristic banking-behaviour score for screening; not a credit bureau score."}
