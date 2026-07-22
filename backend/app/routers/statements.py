"""Statement upload, parsing and transaction endpoints."""
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import get_settings
from app.database import get_db
from app.services.categorization import categorize
from app.services.parsing.excel_parser import parse_excel
from app.services.parsing.pdf_parser import parse_pdf
from app.services import llm

router = APIRouter(prefix="/api", tags=["statements"])

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv"}


@router.post("/accounts/{account_id}/statements", response_model=schemas.StatementOut)
def upload_statement(account_id: int, file: UploadFile = File(...),
                     db: Session = Depends(get_db)):
    settings = get_settings()
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    suffix = Path(file.filename or "statement").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Allowed: PDF, XLSX, XLS, CSV.")

    dest = settings.upload_dir / f"{uuid.uuid4().hex}{suffix}"
    with dest.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)

    result = parse_pdf(dest) if suffix == ".pdf" else parse_excel(dest)

    stmt = models.Statement(
        account_id=account_id,
        filename=file.filename or dest.name,
        file_type=suffix.lstrip("."),
        parse_status=result.status,
        parse_notes="; ".join(result.notes)[:2000],
        txn_count=len(result.transactions),
    )
    if result.transactions:
        stmt.period_start = min(t.txn_date for t in result.transactions)
        stmt.period_end = max(t.txn_date for t in result.transactions)
    db.add(stmt)
    db.flush()

    for t in result.transactions:
        cat = categorize(t.description, t.debit, t.credit)
        db.add(models.Transaction(
            statement_id=stmt.id,
            txn_date=t.txn_date,
            description=t.description,
            debit=t.debit,
            credit=t.credit,
            balance=t.balance,
            category=cat.category,
            category_source="rule",
            counterparty=cat.counterparty,
            channel=cat.channel,
        ))
    db.commit()
    db.refresh(stmt)

    if result.status == "failed":
        # keep the record (with notes) so the user sees why, but signal the failure
        raise HTTPException(422, detail={
            "message": "Could not extract transactions from this file.",
            "notes": result.notes,
            "statement_id": stmt.id,
        })
    return stmt


@router.get("/accounts/{account_id}/statements", response_model=list[schemas.StatementOut])
def list_statements(account_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Account, account_id):
        raise HTTPException(404, "Account not found")
    return db.query(models.Statement).filter_by(account_id=account_id).all()


@router.delete("/statements/{statement_id}")
def delete_statement(statement_id: int, db: Session = Depends(get_db)):
    s = db.get(models.Statement, statement_id)
    if not s:
        raise HTTPException(404, "Statement not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.get("/statements/{statement_id}/transactions", response_model=list[schemas.TransactionOut])
def list_transactions(statement_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Statement, statement_id):
        raise HTTPException(404, "Statement not found")
    return (db.query(models.Transaction)
            .filter_by(statement_id=statement_id)
            .order_by(models.Transaction.txn_date)
            .all())


@router.post("/customers/{customer_id}/enrich")
def llm_enrich(customer_id: int, db: Session = Depends(get_db)):
    """Run LLM classification on transactions the rule engine left uncategorized."""
    settings = get_settings()
    if not settings.llm_available:
        return {"enriched": 0, "llm": False,
                "message": "No OPENAI_API_KEY configured — rules-only mode."}
    txns = (db.query(models.Transaction)
            .join(models.Statement)
            .join(models.Account)
            .filter(models.Account.customer_id == customer_id,
                    models.Transaction.category == "uncategorized")
            .limit(500).all())
    items = [{"id": t.id, "description": t.description[:200],
              "debit": t.debit, "credit": t.credit} for t in txns]
    mapping = llm.classify_transactions(items)
    count = 0
    for t in txns:
        if t.id in mapping:
            t.category = mapping[t.id]
            t.category_source = "llm"
            count += 1
    db.commit()
    return {"enriched": count, "llm": True, "candidates": len(items)}
