"""Optional LLM enrichment layer (OpenAI).

Used ONLY where deterministic rules genuinely fall short:
1. classify_transactions  — resolves narrations the rule engine left 'uncategorized'
2. cam_narrative          — writes the analyst-style executive summary for the CAM

Everything degrades gracefully: if no OPENAI_API_KEY is set, or a call fails,
the application continues with rules-only results and a template narrative.
"""
from __future__ import annotations

import json
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = [
    "salary", "emi", "loan_credit", "cheque_bounce", "ecs_bounce", "penalty_charge",
    "cash_deposit", "cash_withdrawal", "card_payment", "investment", "insurance",
    "rent", "utility", "interest_credit", "tax", "refund", "bank_charge",
    "gambling", "crypto", "transfer", "transfer_in", "shopping", "food", "travel",
    "medical", "education", "business_income", "business_expense", "uncategorized",
]


def _client():
    settings = get_settings()
    if not settings.llm_available:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=settings.openai_api_key)
    except Exception as exc:
        logger.warning("OpenAI client init failed: %s", exc)
        return None


def classify_transactions(items: list[dict]) -> dict[int, str]:
    """items: [{id, description, debit, credit}] -> {id: category}.

    Batched; returns {} on any failure so callers can proceed rules-only.
    """
    settings = get_settings()
    client = _client()
    if client is None or "classification" not in settings.llm_features or not items:
        return {}

    out: dict[int, str] = {}
    BATCH = 60
    for i in range(0, len(items), BATCH):
        batch = items[i:i + BATCH]
        prompt = (
            "You are a bank-statement transaction classifier for credit underwriting.\n"
            f"Allowed categories: {', '.join(ALLOWED_CATEGORIES)}.\n"
            "For each transaction below, pick the single best category. "
            "A positive 'credit' means money in; positive 'debit' means money out.\n"
            "Return ONLY a JSON object mapping id (string) to category.\n\n"
            + json.dumps(batch, ensure_ascii=False)
        )
        try:
            resp = client.chat.completions.create(
                model=settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                response_format={"type": "json_object"},
                timeout=60,
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            for k, v in data.items():
                try:
                    tid = int(k)
                except ValueError:
                    continue
                if isinstance(v, str) and v in ALLOWED_CATEGORIES:
                    out[tid] = v
        except Exception as exc:
            logger.warning("LLM classification batch failed: %s", exc)
            break
    return out


def cam_narrative(report: dict) -> str | None:
    """Generate an executive summary paragraph set for the CAM report. None on failure."""
    settings = get_settings()
    client = _client()
    if client is None or "narrative" not in settings.llm_features:
        return None

    slim = {
        "customer": report.get("customer"),
        "summary": report.get("summary"),
        "income": {k: v for k, v in (report.get("income") or {}).items() if k != "salary_sources"},
        "salary_sources": [
            {k: v for k, v in s.items() if k != "transactions"}
            for s in (report.get("income") or {}).get("salary_sources", [])[:5]
        ],
        "emi": {k: v for k, v in (report.get("emi") or {}).items() if k != "detected_emis"},
        "detected_emis": [
            {k: v for k, v in e.items() if k != "transactions"}
            for e in (report.get("emi") or {}).get("detected_emis", [])[:8]
        ],
        "bounce": {k: v for k, v in (report.get("bounce") or {}).items()
                   if k in ("bounce_count", "total_penalty_amount", "bounces_by_month")},
        "cash": {k: v for k, v in (report.get("cash") or {}).items() if k != "by_month"},
        "patterns": {k: v for k, v in (report.get("patterns") or {}).items()
                     if k in ("inflow_trend", "inflow_volatility", "expense_to_income_ratio")},
        "red_flags": [{"severity": f["severity"], "code": f["code"], "message": f["message"]}
                      for f in report.get("red_flags", [])],
        "capacity": report.get("capacity"),
        "declared_loans": report.get("declared_loans"),
        "proposal": report.get("proposal"),
    }
    prompt = (
        "You are a senior credit analyst writing the 'Banking Analysis' section of a "
        "Credit Appraisal Memo (CAM). Using ONLY the JSON data below, write a crisp, "
        "professional narrative (180-300 words) covering: income quality and regularity, "
        "banking habits and average balances, existing obligations and FOIR, bounces and "
        "red flags, and a concluding view on repayment capacity for the proposed loan. "
        "Use ₹ for amounts. Do not invent numbers not present in the data. "
        "Do not give a final approve/reject decision — end with a recommendation on what "
        "the credit committee should weigh.\n\n" + json.dumps(slim, ensure_ascii=False, default=str)
    )
    try:
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            timeout=90,
        )
        text = (resp.choices[0].message.content or "").strip()
        return text or None
    except Exception as exc:
        logger.warning("LLM narrative failed: %s", exc)
        return None


def template_narrative(report: dict) -> str:
    """Deterministic fallback narrative when the LLM is unavailable."""
    s = report.get("summary", {})
    inc = report.get("income", {})
    cap = report.get("capacity", {})
    b = report.get("bounce", {})
    flags = report.get("red_flags", [])
    high = sum(1 for f in flags if f["severity"] == "high")
    lines = [
        f"Statements covering {s.get('months_covered', 0)} month(s) "
        f"({s.get('period_start', '?')} to {s.get('period_end', '?')}) show total inflow of "
        f"₹{s.get('total_inflow', 0):,.0f} against outflow of ₹{s.get('total_outflow', 0):,.0f}, "
        f"with an average balance of ₹{(s.get('average_balance') or 0):,.0f}.",
        f"Estimated monthly income is ₹{inc.get('estimated_monthly_income', 0):,.0f} with "
        f"{inc.get('income_regularity_pct', 0):.0f}% month-wise regularity.",
        f"Existing obligations are assessed at ₹{cap.get('existing_obligations_used', 0):,.0f}/month "
        f"(FOIR {cap.get('foir_existing_pct') or 0:.0f}%); headroom for additional EMI is "
        f"₹{cap.get('eligible_additional_emi', 0):,.0f} within the policy cap of "
        f"{cap.get('foir_policy_cap_pct', 0):.0f}%.",
        f"{b.get('bounce_count', 0)} bounce/return event(s) observed; "
        f"{len(flags)} red flag(s) raised ({high} high severity).",
        f"Capacity verdict: {cap.get('verdict', 'n/a')} — {cap.get('rationale', '')}",
    ]
    return " ".join(lines)
