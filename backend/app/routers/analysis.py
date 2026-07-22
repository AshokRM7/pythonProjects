"""Analysis and CAM report endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import get_settings
from app.database import get_db
from app.services.analysis import Txn
from app.services.report import build_report

router = APIRouter(prefix="/api", tags=["analysis"])


def _load_txns(db: Session, customer_id: int) -> list[Txn]:
    rows = (db.query(models.Transaction, models.Account)
            .join(models.Statement, models.Transaction.statement_id == models.Statement.id)
            .join(models.Account, models.Statement.account_id == models.Account.id)
            .filter(models.Account.customer_id == customer_id)
            .order_by(models.Transaction.txn_date)
            .all())
    txns = []
    for t, acct in rows:
        label = f"{acct.bank_name or 'Bank'} ...{(acct.account_number or '')[-4:]}"
        txns.append(Txn(
            id=t.id, account_id=acct.id, account_label=label,
            txn_date=t.txn_date, description=t.description,
            debit=t.debit, credit=t.credit, balance=t.balance,
            category=t.category, channel=t.channel, counterparty=t.counterparty,
        ))
    return txns


@router.post("/customers/{customer_id}/analyze", response_model=schemas.AnalysisOut)
def analyze(customer_id: int, payload: schemas.AnalyzeRequest, db: Session = Depends(get_db)):
    customer = db.get(models.Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")

    txns = _load_txns(db, customer_id)
    if not txns:
        raise HTTPException(400, "No parsed transactions for this customer. Upload statements first.")

    accounts = [{
        "id": a.id, "bank_name": a.bank_name, "account_number": a.account_number,
        "account_type": a.account_type,
        "statements": len(a.statements),
    } for a in customer.accounts]

    declared_loans = [{
        "lender": l.lender, "loan_type": l.loan_type,
        "sanctioned_amount": l.sanctioned_amount, "outstanding_amount": l.outstanding_amount,
        "emi_amount": l.emi_amount, "remaining_tenure_months": l.remaining_tenure_months,
    } for l in customer.loans]

    customer_info = {
        "id": customer.id, "name": customer.name, "pan": customer.pan,
        "employment_type": customer.employment_type,
        "declared_monthly_income": customer.declared_monthly_income,
    }
    proposal = {
        "proposed_loan_amount": payload.proposed_loan_amount,
        "proposed_emi": payload.proposed_emi,
        "proposed_tenure_months": payload.proposed_tenure_months,
    }

    report, llm_used = build_report(
        customer_info, txns, declared_loans, accounts, proposal, use_llm=payload.use_llm)

    analysis = models.Analysis(
        customer_id=customer_id,
        proposed_loan_amount=payload.proposed_loan_amount,
        proposed_emi=payload.proposed_emi,
        proposed_tenure_months=payload.proposed_tenure_months,
        result=report,
        llm_used=llm_used,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/customers/{customer_id}/analyses", response_model=list[schemas.AnalysisSummaryOut])
def list_analyses(customer_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Analysis).filter_by(customer_id=customer_id)
            .order_by(models.Analysis.created_at.desc()).all())


@router.get("/analyses/{analysis_id}", response_model=schemas.AnalysisOut)
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    a = db.get(models.Analysis, analysis_id)
    if not a:
        raise HTTPException(404, "Analysis not found")
    return a


@router.get("/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "llm_configured": settings.llm_available,
        "llm_model": settings.openai_model if settings.llm_available else None,
    }
