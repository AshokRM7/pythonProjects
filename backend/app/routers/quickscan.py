"""Quick Scan: stateless one-shot statement analysis.

Upload statement file(s) → immediate compact report (totals, monthly flows,
cash analysis, bounces, red flags, top transactions). Nothing is persisted —
no customer/account setup needed, and the LLM is not involved (fast + deterministic).
"""
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings
from app.services import analysis as A
from app.services.categorization import categorize
from app.services.parsing.excel_parser import parse_excel
from app.services.parsing.pdf_parser import parse_pdf

router = APIRouter(prefix="/api", tags=["quick-scan"])

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv"}


@router.post("/quick-scan")
def quick_scan(files: list[UploadFile] = File(...)):
    settings = get_settings()
    tmp_dir = settings.upload_dir / "quickscan"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    txns: list[A.Txn] = []
    file_reports: list[dict] = []
    next_id = 1

    for idx, file in enumerate(files):
        suffix = Path(file.filename or "statement").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            file_reports.append({
                "filename": file.filename, "status": "failed", "txn_count": 0,
                "notes": [f"Unsupported file type '{suffix}'. Allowed: PDF, XLSX, XLS, CSV."],
            })
            continue

        dest = tmp_dir / f"{uuid.uuid4().hex}{suffix}"
        try:
            with dest.open("wb") as fh:
                shutil.copyfileobj(file.file, fh)
            result = parse_pdf(dest) if suffix == ".pdf" else parse_excel(dest)
        finally:
            dest.unlink(missing_ok=True)  # stateless: never keep quick-scan files

        result.notes = [n.replace(dest.name, file.filename or dest.name) for n in result.notes]
        file_reports.append({
            "filename": file.filename, "status": result.status,
            "txn_count": len(result.transactions), "notes": result.notes,
        })
        for t in result.transactions:
            cat = categorize(t.description, t.debit, t.credit)
            txns.append(A.Txn(
                id=next_id, account_id=idx, account_label=Path(file.filename or "file").stem[:30],
                txn_date=t.txn_date, description=t.description,
                debit=t.debit, credit=t.credit, balance=t.balance,
                category=cat.category, channel=cat.channel, counterparty=cat.counterparty,
            ))
            next_id += 1

    if not txns:
        raise HTTPException(422, detail={
            "message": "No transactions could be extracted from the uploaded file(s).",
            "files": file_reports,
        })

    txns.sort(key=lambda t: (t.txn_date, t.id))
    monthly = A.monthly_analysis(txns)
    summary = A.flow_summary(txns)
    income = A.income_analysis(txns, settings.min_salary_occurrences)
    emi = A.emi_analysis(txns)
    bounce = A.bounce_analysis(txns)
    cash = A.cash_analysis(txns)
    flags = A.red_flags(txns, monthly, income, emi, bounce, cash, summary, settings)
    major = A.major_transactions(txns, top_n=5)

    balances = A.daily_balance_series(txns)
    series = [{"date": d.isoformat(), "balance": round(b, 2)} for d, b in balances]
    if len(series) > 300:
        step = len(series) // 300 + 1
        series = series[::step]

    return {
        "files": file_reports,
        "summary": summary,
        "monthly": monthly,
        "cash": cash,
        "bounce": {k: bounce[k] for k in ("bounce_count", "total_penalty_amount", "bounces_by_month")},
        "red_flags": flags,
        "major_transactions": major,
        "income_brief": {
            "estimated_monthly_income": income["estimated_monthly_income"],
            "income_regularity_pct": income["income_regularity_pct"],
        },
        "emi_brief": {
            "estimated_monthly_emi_outgo": emi["estimated_monthly_emi_outgo"],
            "detected_count": len(emi["detected_emis"]),
        },
        "balance_series": series,
    }
