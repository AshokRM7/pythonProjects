"""Pydantic request/response schemas."""
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# ---------- Customer ----------
class CustomerCreate(BaseModel):
    name: str
    pan: str = ""
    phone: str = ""
    email: str = ""
    employment_type: str = "salaried"
    declared_monthly_income: float = 0.0
    notes: str = ""


class CustomerOut(CustomerCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------- Account ----------
class AccountCreate(BaseModel):
    bank_name: str = ""
    account_number: str = ""
    account_type: str = "savings"


class AccountOut(AccountCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int


# ---------- Statement ----------
class StatementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    filename: str
    file_type: str
    period_start: date | None
    period_end: date | None
    txn_count: int
    parse_status: str
    parse_notes: str
    uploaded_at: datetime


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    txn_date: date
    description: str
    debit: float
    credit: float
    balance: float | None
    category: str
    category_source: str
    channel: str


# ---------- Loan ----------
class LoanCreate(BaseModel):
    lender: str = ""
    loan_type: str = "personal"
    sanctioned_amount: float = 0.0
    outstanding_amount: float = 0.0
    emi_amount: float = 0.0
    remaining_tenure_months: int = 0


class LoanOut(LoanCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    source: str


# ---------- Analysis ----------
class AnalyzeRequest(BaseModel):
    proposed_loan_amount: float = 0.0
    proposed_emi: float = 0.0
    proposed_tenure_months: int = 0
    use_llm: bool = True  # honored only if a key is configured


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    created_at: datetime
    proposed_loan_amount: float
    proposed_emi: float
    proposed_tenure_months: int
    llm_used: bool
    result: dict


class AnalysisSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: int
    created_at: datetime
    llm_used: bool
