"""Credit-assessment analysis engine.

Pure functions over normalized transactions — deterministic and auditable.
Covers: month-wise credit/debit analysis, inflow/outflow, average monthly
balance, major transactions, salary tracking, EMI detection, bounce detection,
penalty charges, unusual transactions, cash analysis, pattern analysis,
red flags, multi-account aggregation, obligations and repayment capacity.
"""
from __future__ import annotations

import re
import statistics
from collections import defaultdict
from datetime import date, timedelta
from dataclasses import dataclass

from app.services.categorization import BOUNCE_CATEGORIES, CASH_CATEGORIES, RISK_CATEGORIES


@dataclass
class Txn:
    """Lightweight transaction view used by the engine (detached from ORM)."""
    id: int
    account_id: int
    account_label: str
    txn_date: date
    description: str
    debit: float
    credit: float
    balance: float | None
    category: str
    channel: str
    counterparty: str

    @property
    def amount(self) -> float:
        return self.credit if self.credit > 0 else self.debit

    @property
    def month(self) -> str:
        return f"{self.txn_date.year:04d}-{self.txn_date.month:02d}"


def _r(x: float) -> float:
    return round(float(x), 2)


def txn_brief(t: Txn) -> dict:
    return {
        "id": t.id,
        "date": t.txn_date.isoformat(),
        "description": t.description[:160],
        "debit": _r(t.debit),
        "credit": _r(t.credit),
        "category": t.category,
        "account": t.account_label,
    }


# ------------------------------------------------------------------ monthly
def monthly_analysis(txns: list[Txn]) -> list[dict]:
    """Month-wise credits/debits, counts, net flow and month-end balance."""
    months: dict[str, dict] = {}
    for t in txns:
        m = months.setdefault(t.month, {
            "month": t.month, "total_credit": 0.0, "total_debit": 0.0,
            "credit_count": 0, "debit_count": 0, "net_flow": 0.0,
            "closing_balance": None, "avg_daily_balance": None,
            "min_balance": None, "max_balance": None,
        })
        m["total_credit"] += t.credit
        m["total_debit"] += t.debit
        if t.credit > 0:
            m["credit_count"] += 1
        if t.debit > 0:
            m["debit_count"] += 1

    balances = daily_balance_series(txns)
    by_month_bal: dict[str, list[float]] = defaultdict(list)
    for d, b in balances:
        by_month_bal[f"{d.year:04d}-{d.month:02d}"].append(b)
    for mkey, vals in by_month_bal.items():
        if mkey in months and vals:
            months[mkey]["avg_daily_balance"] = _r(statistics.mean(vals))
            months[mkey]["closing_balance"] = _r(vals[-1])
            months[mkey]["min_balance"] = _r(min(vals))
            months[mkey]["max_balance"] = _r(max(vals))

    out = []
    for mkey in sorted(months):
        m = months[mkey]
        m["total_credit"] = _r(m["total_credit"])
        m["total_debit"] = _r(m["total_debit"])
        m["net_flow"] = _r(m["total_credit"] - m["total_debit"])
        out.append(m)
    return out


def daily_balance_series(txns: list[Txn]) -> list[tuple[date, float]]:
    """End-of-day balances carried forward across days with no transactions.

    Uses the statement's running balance column when present; otherwise
    reconstructs from flows (relative balance starting at 0).
    For multiple accounts, sums the per-account series day by day.
    """
    by_acct: dict[int, list[Txn]] = defaultdict(list)
    for t in txns:
        by_acct[t.account_id].append(t)

    all_series: list[dict[date, float]] = []
    global_start, global_end = None, None
    for acct_txns in by_acct.values():
        acct_txns.sort(key=lambda t: (t.txn_date, t.id))
        has_balance = sum(1 for t in acct_txns if t.balance is not None) >= max(1, len(acct_txns) // 2)
        eod: dict[date, float] = {}
        running = 0.0
        for t in acct_txns:
            if has_balance and t.balance is not None:
                running = t.balance
            else:
                running += t.credit - t.debit
            eod[t.txn_date] = running
        if not eod:
            continue
        start, end = min(eod), max(eod)
        series: dict[date, float] = {}
        cur = start
        last = eod[start]
        while cur <= end:
            if cur in eod:
                last = eod[cur]
            series[cur] = last
            cur += timedelta(days=1)
        all_series.append(series)
        global_start = start if global_start is None else min(global_start, start)
        global_end = end if global_end is None else max(global_end, end)

    if not all_series or global_start is None:
        return []
    combined: list[tuple[date, float]] = []
    cur = global_start
    lasts = [None] * len(all_series)
    while cur <= global_end:
        total = 0.0
        for i, s in enumerate(all_series):
            if cur in s:
                lasts[i] = s[cur]
            if lasts[i] is not None:
                total += lasts[i]
        combined.append((cur, total))
        cur += timedelta(days=1)
    return combined


# ------------------------------------------------------------------ summary
def flow_summary(txns: list[Txn]) -> dict:
    total_credit = sum(t.credit for t in txns)
    total_debit = sum(t.debit for t in txns)
    balances = daily_balance_series(txns)
    months = {t.month for t in txns}
    n_months = max(1, len(months))
    return {
        "total_inflow": _r(total_credit),
        "total_outflow": _r(total_debit),
        "net_flow": _r(total_credit - total_debit),
        "txn_count": len(txns),
        "months_covered": len(months),
        "period_start": min(t.txn_date for t in txns).isoformat() if txns else None,
        "period_end": max(t.txn_date for t in txns).isoformat() if txns else None,
        "avg_monthly_inflow": _r(total_credit / n_months),
        "avg_monthly_outflow": _r(total_debit / n_months),
        "average_balance": _r(statistics.mean(b for _, b in balances)) if balances else None,
        "min_balance": _r(min(b for _, b in balances)) if balances else None,
        "max_balance": _r(max(b for _, b in balances)) if balances else None,
        "negative_balance_days": sum(1 for _, b in balances if b < 0),
    }


# ------------------------------------------------------------------ major txns
def major_transactions(txns: list[Txn], top_n: int = 10) -> dict:
    credits = sorted((t for t in txns if t.credit > 0), key=lambda t: -t.credit)[:top_n]
    debits = sorted((t for t in txns if t.debit > 0), key=lambda t: -t.debit)[:top_n]
    return {
        "top_credits": [txn_brief(t) for t in credits],
        "top_debits": [txn_brief(t) for t in debits],
    }


# ------------------------------------------------------------------ salary / income
def _recurring_groups(candidates: list[Txn], amount_tolerance: float = 0.25) -> list[list[Txn]]:
    """Group transactions by counterparty/description similarity + amount proximity."""
    groups: list[list[Txn]] = []
    for t in candidates:
        placed = False
        for g in groups:
            ref = g[0]
            same_src = (t.counterparty and t.counterparty == ref.counterparty) or \
                       _desc_signature(t.description) == _desc_signature(ref.description)
            ref_amt = statistics.mean(x.amount for x in g)
            close_amt = ref_amt > 0 and abs(t.amount - ref_amt) / ref_amt <= amount_tolerance
            if same_src and close_amt:
                g.append(t)
                placed = True
                break
        if not placed:
            groups.append([t])
    return groups


_sig_re = re.compile(r"[\d/\-:]+")
_month_re = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b")


def _desc_signature(desc: str) -> str:
    """Stable signature of a narration with reference numbers, dates and
    month names stripped (so 'SALARY FEB' and 'SALARY MAR' group together)."""
    s = _sig_re.sub("", (desc or "").lower())
    s = _month_re.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:60]


def _is_monthly_cadence(dates: list[date]) -> bool:
    if len(dates) < 2:
        return False
    ds = sorted(dates)
    gaps = [(ds[i + 1] - ds[i]).days for i in range(len(ds) - 1)]
    monthly = [g for g in gaps if 24 <= g <= 38]
    return len(monthly) >= max(1, int(len(gaps) * 0.6))


def income_analysis(txns: list[Txn], min_occurrences: int = 2) -> dict:
    """Detect salary and other regular income credits."""
    explicit_salary = [t for t in txns if t.category == "salary" and t.credit > 0]
    months = {t.month for t in txns}

    salary_sources: list[dict] = []
    used_ids: set[int] = set()

    for group in _recurring_groups(sorted(explicit_salary, key=lambda t: t.txn_date)):
        if len(group) >= 1:
            salary_sources.append(_income_source(group, "salary_keyword"))
            used_ids.update(t.id for t in group)

    # recurring large credits without salary keywords (self-employed / contractors)
    other_credits = [
        t for t in txns
        if t.credit > 0 and t.id not in used_ids
        and t.category in ("transfer_in", "uncategorized", "transfer")
        and t.credit >= 5000
    ]
    for group in _recurring_groups(sorted(other_credits, key=lambda t: t.txn_date)):
        if len(group) >= max(min_occurrences, 2) and _is_monthly_cadence([t.txn_date for t in group]):
            salary_sources.append(_income_source(group, "recurring_credit"))
            used_ids.update(t.id for t in group)

    salary_sources.sort(key=lambda s: -s["avg_amount"])
    n_months = max(1, len(months))
    monthly_income_est = sum(s["avg_amount"] for s in salary_sources if s["detection"] == "salary_keyword")
    if monthly_income_est == 0 and salary_sources:
        monthly_income_est = salary_sources[0]["avg_amount"]

    total_income_credits = sum(s["total_amount"] for s in salary_sources)
    salary_months = set()
    for s in salary_sources:
        salary_months.update(s["months"])

    return {
        "salary_sources": salary_sources,
        "estimated_monthly_income": _r(monthly_income_est),
        "income_credit_months": sorted(salary_months),
        "months_with_income": len(salary_months),
        "months_covered": n_months,
        "income_regularity_pct": _r(100.0 * len(salary_months) / n_months),
        "total_identified_income": _r(total_income_credits),
    }


def _income_source(group: list[Txn], detection: str) -> dict:
    amounts = [t.credit for t in group]
    dates = [t.txn_date for t in group]
    dom = [d.day for d in dates]
    return {
        "source": group[0].counterparty or _desc_signature(group[0].description) or "unknown",
        "detection": detection,
        "occurrences": len(group),
        "avg_amount": _r(statistics.mean(amounts)),
        "total_amount": _r(sum(amounts)),
        "typical_day_of_month": int(statistics.median(dom)),
        "months": sorted({f"{d.year:04d}-{d.month:02d}" for d in dates}),
        "transactions": [txn_brief(t) for t in group],
    }


# ------------------------------------------------------------------ EMI / obligations
def emi_analysis(txns: list[Txn]) -> dict:
    """Detect recurring EMI/loan repayment debits and estimate monthly obligation."""
    emi_txns = sorted((t for t in txns if t.category == "emi" and t.debit > 0), key=lambda t: t.txn_date)
    detected: list[dict] = []
    for group in _recurring_groups(emi_txns, amount_tolerance=0.10):
        amounts = [t.debit for t in group]
        dates = [t.txn_date for t in group]
        recurring = len(group) >= 2 and _is_monthly_cadence(dates)
        detected.append({
            "lender_hint": group[0].counterparty or _desc_signature(group[0].description)[:50] or "unknown",
            "emi_amount": _r(statistics.median(amounts)),
            "occurrences": len(group),
            "recurring": recurring,
            "first_seen": min(dates).isoformat(),
            "last_seen": max(dates).isoformat(),
            "months": sorted({f"{d.year:04d}-{d.month:02d}" for d in dates}),
            "transactions": [txn_brief(t) for t in group],
        })
    detected.sort(key=lambda d: -d["emi_amount"])
    monthly_emi = sum(d["emi_amount"] for d in detected if d["recurring"] or d["occurrences"] >= 2)
    if monthly_emi == 0 and detected:
        monthly_emi = sum(d["emi_amount"] for d in detected)
    return {
        "detected_emis": detected,
        "estimated_monthly_emi_outgo": _r(monthly_emi),
        "total_emi_debits": _r(sum(t.debit for t in emi_txns)),
        "emi_txn_count": len(emi_txns),
    }


# ------------------------------------------------------------------ bounces
def bounce_analysis(txns: list[Txn]) -> dict:
    bounces = [t for t in txns if t.category in BOUNCE_CATEGORIES]
    penalties = [t for t in txns if t.category == "penalty_charge"]
    by_month: dict[str, int] = defaultdict(int)
    for t in bounces:
        by_month[t.month] += 1
    return {
        "bounce_count": len(bounces),
        "cheque_bounces": [txn_brief(t) for t in bounces if t.category == "cheque_bounce"],
        "ecs_nach_bounces": [txn_brief(t) for t in bounces if t.category == "ecs_bounce"],
        "penalty_charges": [txn_brief(t) for t in penalties],
        "total_penalty_amount": _r(sum(t.debit for t in penalties)),
        "bounces_by_month": dict(sorted(by_month.items())),
    }


# ------------------------------------------------------------------ cash
def cash_analysis(txns: list[Txn]) -> dict:
    deposits = [t for t in txns if t.category == "cash_deposit"]
    withdrawals = [t for t in txns if t.category == "cash_withdrawal"]
    total_inflow = sum(t.credit for t in txns) or 1.0
    total_outflow = sum(t.debit for t in txns) or 1.0
    dep_total = sum(t.credit for t in deposits)
    wdl_total = sum(t.debit for t in withdrawals)
    by_month: dict[str, dict] = defaultdict(lambda: {"deposits": 0.0, "withdrawals": 0.0})
    for t in deposits:
        by_month[t.month]["deposits"] += t.credit
    for t in withdrawals:
        by_month[t.month]["withdrawals"] += t.debit
    return {
        "cash_deposit_total": _r(dep_total),
        "cash_deposit_count": len(deposits),
        "cash_withdrawal_total": _r(wdl_total),
        "cash_withdrawal_count": len(withdrawals),
        "cash_deposit_pct_of_inflow": _r(100.0 * dep_total / total_inflow),
        "cash_withdrawal_pct_of_outflow": _r(100.0 * wdl_total / total_outflow),
        "by_month": {k: {kk: _r(vv) for kk, vv in v.items()} for k, v in sorted(by_month.items())},
        "large_cash_transactions": [
            txn_brief(t) for t in (deposits + withdrawals) if t.amount >= 50000
        ],
    }


# ------------------------------------------------------------------ unusual / high value
def unusual_transactions(txns: list[Txn], high_value_threshold: float) -> dict:
    """Flag statistically unusual and absolutely high-value transactions."""
    alerts: list[dict] = []
    debits = [t.debit for t in txns if t.debit > 0]
    credits = [t.credit for t in txns if t.credit > 0]

    def zflag(t: Txn, pool: list[float], amt: float, kind: str):
        if len(pool) >= 8:
            mean = statistics.mean(pool)
            std = statistics.pstdev(pool)
            if std > 0 and (amt - mean) / std >= 3 and amt >= 10000:
                alerts.append({**txn_brief(t), "reason": f"statistical outlier ({kind}, >3σ above typical)"})
                return True
        return False

    for t in txns:
        flagged = False
        if t.amount >= high_value_threshold:
            alerts.append({**txn_brief(t), "reason": f"high value (≥ {high_value_threshold:,.0f})"})
            flagged = True
        if not flagged and t.debit > 0:
            flagged = zflag(t, debits, t.debit, "debit")
        if not flagged and t.credit > 0:
            zflag(t, credits, t.credit, "credit")
    # round-figure large cash
    for t in txns:
        if t.category in CASH_CATEGORIES and t.amount >= 20000 and t.amount % 10000 == 0:
            alerts.append({**txn_brief(t), "reason": "large round-figure cash transaction"})
    # dedupe by (id, reason)
    seen = set()
    unique = []
    for a in alerts:
        key = (a["id"], a["reason"])
        if key not in seen:
            seen.add(key)
            unique.append(a)
    unique.sort(key=lambda a: max(a["debit"], a["credit"]), reverse=True)
    return {"alerts": unique[:50], "alert_count": len(unique)}


# ------------------------------------------------------------------ patterns
def pattern_analysis(txns: list[Txn]) -> dict:
    by_category: dict[str, dict] = defaultdict(lambda: {"count": 0, "debit": 0.0, "credit": 0.0})
    by_channel: dict[str, dict] = defaultdict(lambda: {"count": 0, "debit": 0.0, "credit": 0.0})
    weekday_spend = [0.0] * 7
    for t in txns:
        c = by_category[t.category]
        c["count"] += 1
        c["debit"] += t.debit
        c["credit"] += t.credit
        ch = by_channel[t.channel or "other"]
        ch["count"] += 1
        ch["debit"] += t.debit
        ch["credit"] += t.credit
        if t.debit > 0:
            weekday_spend[t.txn_date.weekday()] += t.debit

    months = sorted({t.month for t in txns})
    inflow_by_month = defaultdict(float)
    outflow_by_month = defaultdict(float)
    for t in txns:
        inflow_by_month[t.month] += t.credit
        outflow_by_month[t.month] += t.debit
    inflows = [inflow_by_month[m] for m in months]
    trend = "stable"
    volatility = 0.0
    if len(inflows) >= 3:
        first_half = statistics.mean(inflows[: len(inflows) // 2])
        second_half = statistics.mean(inflows[len(inflows) // 2:])
        if first_half > 0:
            change = (second_half - first_half) / first_half
            trend = "growing" if change > 0.15 else ("declining" if change < -0.15 else "stable")
        m = statistics.mean(inflows)
        if m > 0:
            volatility = statistics.pstdev(inflows) / m

    return {
        "by_category": {
            k: {"count": v["count"], "debit": _r(v["debit"]), "credit": _r(v["credit"])}
            for k, v in sorted(by_category.items(), key=lambda kv: -(kv[1]["debit"] + kv[1]["credit"]))
        },
        "by_channel": {
            k: {"count": v["count"], "debit": _r(v["debit"]), "credit": _r(v["credit"])}
            for k, v in sorted(by_channel.items(), key=lambda kv: -kv[1]["count"])
        },
        "weekday_spend": [_r(x) for x in weekday_spend],
        "inflow_trend": trend,
        "inflow_volatility": _r(volatility),
        "expense_to_income_ratio": _r(
            sum(outflow_by_month.values()) / sum(inflow_by_month.values())
        ) if sum(inflow_by_month.values()) > 0 else None,
    }


# ------------------------------------------------------------------ red flags
def red_flags(txns: list[Txn], monthly: list[dict], income: dict, emi: dict,
              bounce: dict, cash: dict, summary: dict, settings) -> list[dict]:
    flags: list[dict] = []

    def add(severity: str, code: str, message: str, evidence=None):
        flags.append({"severity": severity, "code": code, "message": message,
                      "evidence": evidence or []})

    if bounce["bounce_count"] > 0:
        sev = "high" if bounce["bounce_count"] >= 3 else "medium"
        add(sev, "BOUNCES",
            f"{bounce['bounce_count']} bounce/return transaction(s) found "
            f"(₹{bounce['total_penalty_amount']:,.0f} in penalty charges).",
            (bounce["cheque_bounces"] + bounce["ecs_nach_bounces"])[:5])

    if summary.get("negative_balance_days", 0) > 0:
        add("high", "NEGATIVE_BALANCE",
            f"Balance was negative/overdrawn on {summary['negative_balance_days']} day(s).")

    cash_pct = cash["cash_deposit_pct_of_inflow"]
    if cash_pct >= settings.cash_intensity_warn_ratio * 100:
        add("medium", "CASH_INTENSITY",
            f"Cash deposits form {cash_pct:.0f}% of total inflow — income may be hard to verify.",
            cash["large_cash_transactions"][:5])

    if income["income_regularity_pct"] < 60 and income["salary_sources"]:
        add("medium", "IRREGULAR_INCOME",
            f"Income credits found in only {income['months_with_income']} of "
            f"{income['months_covered']} months ({income['income_regularity_pct']:.0f}% regularity).")
    if not income["salary_sources"]:
        add("medium", "NO_REGULAR_INCOME",
            "No regular salary/income credit pattern could be identified in the statements.")

    risk_txns = [t for t in txns if t.category in RISK_CATEGORIES]
    if risk_txns:
        total_risk = sum(t.amount for t in risk_txns)
        add("high", "SPECULATIVE_ACTIVITY",
            f"{len(risk_txns)} gambling/crypto transaction(s) totalling ₹{total_risk:,.0f}.",
            [txn_brief(t) for t in risk_txns[:5]])

    # circular transactions: credit followed within 3 days by similar-size debit (±5%)
    circular = _circular_pairs(txns)
    if len(circular) >= 3:
        add("medium", "CIRCULAR_FLOWS",
            f"{len(circular)} instance(s) of credits quickly reversed by similar debits "
            "(possible balance window-dressing).", circular[:5])

    # balance spike near statement end
    balances = daily_balance_series(txns)
    if len(balances) >= 30:
        last_week = [b for _, b in balances[-7:]]
        earlier = [b for _, b in balances[:-7]]
        if earlier and statistics.mean(earlier) > 0 and statistics.mean(last_week) > 3 * statistics.mean(earlier):
            add("medium", "END_PERIOD_SPIKE",
                "Average balance in the final week is >3x the earlier average — "
                "possible window-dressing before submission.")

    # heavy month-end depletion: closing balance < 5% of inflow in most months
    depleted = [m for m in monthly if m["total_credit"] > 0 and m.get("closing_balance") is not None
                and m["closing_balance"] < 0.05 * m["total_credit"]]
    if len(depleted) >= max(2, len(monthly) // 2):
        add("low", "FULL_DEPLETION",
            f"In {len(depleted)} month(s) the closing balance was under 5% of that month's inflow — "
            "little savings buffer.")

    inflow = summary["total_inflow"] or 1.0
    outflow = summary["total_outflow"]
    if outflow > inflow * 1.1:
        add("medium", "OUTFLOW_EXCEEDS_INFLOW",
            f"Total outflow (₹{outflow:,.0f}) exceeds inflow (₹{inflow:,.0f}) by more than 10%.")

    order = {"high": 0, "medium": 1, "low": 2}
    flags.sort(key=lambda f: order.get(f["severity"], 3))
    return flags


def _circular_pairs(txns: list[Txn]) -> list[dict]:
    pairs = []
    credits = [t for t in txns if t.credit >= 10000]
    debits = sorted((t for t in txns if t.debit >= 10000), key=lambda t: t.txn_date)
    used = set()
    for c in credits:
        for d in debits:
            if d.id in used:
                continue
            gap = (d.txn_date - c.txn_date).days
            if 0 <= gap <= 3 and abs(d.debit - c.credit) / c.credit <= 0.05:
                pairs.append({
                    "credit": txn_brief(c), "debit": txn_brief(d), "days_apart": gap,
                })
                used.add(d.id)
                break
    return pairs


# ------------------------------------------------------------------ capacity
def repayment_capacity(income: dict, emi: dict, declared_loans: list[dict],
                       summary: dict, proposed_emi: float, settings) -> dict:
    monthly_income = income["estimated_monthly_income"]
    declared_emi = sum(l.get("emi_amount", 0.0) for l in declared_loans)
    detected_emi = emi["estimated_monthly_emi_outgo"]
    # avoid double counting: obligation = max(detected, declared) as a conservative floor,
    # both are reported separately for the analyst.
    existing_obligations = max(detected_emi, declared_emi)

    avg_monthly_surplus = summary["avg_monthly_inflow"] - summary["avg_monthly_outflow"]

    foir_existing = (existing_obligations / monthly_income) if monthly_income > 0 else None
    foir_with_proposed = ((existing_obligations + proposed_emi) / monthly_income) if monthly_income > 0 else None
    max_total_emi = monthly_income * settings.foir_max if monthly_income > 0 else 0.0
    eligible_additional_emi = max(0.0, max_total_emi - existing_obligations)

    if monthly_income <= 0:
        verdict, rationale = "insufficient_data", "No reliable income stream detected from the statements."
    elif foir_with_proposed is not None and proposed_emi > 0:
        if foir_with_proposed <= settings.foir_max * 0.8:
            verdict = "comfortable"
        elif foir_with_proposed <= settings.foir_max:
            verdict = "acceptable"
        else:
            verdict = "stretched"
        rationale = (f"FOIR with proposed EMI is {foir_with_proposed * 100:.0f}% "
                     f"against a policy cap of {settings.foir_max * 100:.0f}%.")
    else:
        verdict = "assessed_without_proposal"
        rationale = (f"Existing FOIR is {(foir_existing or 0) * 100:.0f}%; "
                     f"headroom of ₹{eligible_additional_emi:,.0f}/month within policy cap.")

    return {
        "estimated_monthly_income": _r(monthly_income),
        "detected_monthly_emi": _r(detected_emi),
        "declared_monthly_emi": _r(declared_emi),
        "existing_obligations_used": _r(existing_obligations),
        "avg_monthly_surplus": _r(avg_monthly_surplus),
        "foir_existing_pct": _r(foir_existing * 100) if foir_existing is not None else None,
        "foir_with_proposed_pct": _r(foir_with_proposed * 100) if foir_with_proposed is not None else None,
        "foir_policy_cap_pct": _r(settings.foir_max * 100),
        "eligible_additional_emi": _r(eligible_additional_emi),
        "proposed_emi": _r(proposed_emi),
        "verdict": verdict,
        "rationale": rationale,
    }
