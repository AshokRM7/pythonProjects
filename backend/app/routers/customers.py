"""Customer, account and loan management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.post("", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    c = models.Customer(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.created_at.desc()).all()


def _get_customer(db: Session, customer_id: int) -> models.Customer:
    c = db.get(models.Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    return _get_customer(db, customer_id)


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    c = _get_customer(db, customer_id)
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    c = _get_customer(db, customer_id)
    db.delete(c)
    db.commit()
    return {"ok": True}


# ---------------- accounts ----------------
@router.post("/{customer_id}/accounts", response_model=schemas.AccountOut)
def create_account(customer_id: int, payload: schemas.AccountCreate, db: Session = Depends(get_db)):
    _get_customer(db, customer_id)
    a = models.Account(customer_id=customer_id, **payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("/{customer_id}/accounts", response_model=list[schemas.AccountOut])
def list_accounts(customer_id: int, db: Session = Depends(get_db)):
    _get_customer(db, customer_id)
    return db.query(models.Account).filter_by(customer_id=customer_id).all()


@router.delete("/{customer_id}/accounts/{account_id}")
def delete_account(customer_id: int, account_id: int, db: Session = Depends(get_db)):
    a = db.get(models.Account, account_id)
    if not a or a.customer_id != customer_id:
        raise HTTPException(404, "Account not found")
    db.delete(a)
    db.commit()
    return {"ok": True}


# ---------------- loans ----------------
@router.post("/{customer_id}/loans", response_model=schemas.LoanOut)
def create_loan(customer_id: int, payload: schemas.LoanCreate, db: Session = Depends(get_db)):
    _get_customer(db, customer_id)
    l = models.Loan(customer_id=customer_id, source="declared", **payload.model_dump())
    db.add(l)
    db.commit()
    db.refresh(l)
    return l


@router.get("/{customer_id}/loans", response_model=list[schemas.LoanOut])
def list_loans(customer_id: int, db: Session = Depends(get_db)):
    _get_customer(db, customer_id)
    return db.query(models.Loan).filter_by(customer_id=customer_id).all()


@router.delete("/{customer_id}/loans/{loan_id}")
def delete_loan(customer_id: int, loan_id: int, db: Session = Depends(get_db)):
    l = db.get(models.Loan, loan_id)
    if not l or l.customer_id != customer_id:
        raise HTTPException(404, "Loan not found")
    db.delete(l)
    db.commit()
    return {"ok": True}
