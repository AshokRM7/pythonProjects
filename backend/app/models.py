"""Database models: Customer, Account, Statement, Transaction, Loan, Analysis."""
from datetime import datetime, date

from sqlalchemy import (
    String, Float, Integer, Date, DateTime, ForeignKey, Text, Boolean, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    pan: Mapped[str] = mapped_column(String(20), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    employment_type: Mapped[str] = mapped_column(String(50), default="salaried")  # salaried | self_employed | business
    declared_monthly_income: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts: Mapped[list["Account"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    loans: Mapped[list["Loan"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="customer", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    bank_name: Mapped[str] = mapped_column(String(120), default="")
    account_number: Mapped[str] = mapped_column(String(50), default="")
    account_type: Mapped[str] = mapped_column(String(30), default="savings")

    customer: Mapped["Customer"] = relationship(back_populates="accounts")
    statements: Mapped[list["Statement"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class Statement(Base):
    __tablename__ = "statements"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    filename: Mapped[str] = mapped_column(String(300))
    file_type: Mapped[str] = mapped_column(String(10))  # pdf | xlsx | csv
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    txn_count: Mapped[int] = mapped_column(Integer, default=0)
    parse_status: Mapped[str] = mapped_column(String(20), default="parsed")  # parsed | failed | partial
    parse_notes: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    account: Mapped["Account"] = relationship(back_populates="statements")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="statement", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    statement_id: Mapped[int] = mapped_column(ForeignKey("statements.id"), index=True)
    txn_date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    debit: Mapped[float] = mapped_column(Float, default=0.0)
    credit: Mapped[float] = mapped_column(Float, default=0.0)
    balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    category: Mapped[str] = mapped_column(String(60), default="uncategorized", index=True)
    category_source: Mapped[str] = mapped_column(String(10), default="rule")  # rule | llm | manual
    counterparty: Mapped[str] = mapped_column(String(200), default="")
    channel: Mapped[str] = mapped_column(String(30), default="")  # upi|neft|imps|ach|cheque|cash|atm|card|other

    statement: Mapped["Statement"] = relationship(back_populates="transactions")


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    lender: Mapped[str] = mapped_column(String(200), default="")
    loan_type: Mapped[str] = mapped_column(String(50), default="personal")
    sanctioned_amount: Mapped[float] = mapped_column(Float, default=0.0)
    outstanding_amount: Mapped[float] = mapped_column(Float, default=0.0)
    emi_amount: Mapped[float] = mapped_column(Float, default=0.0)
    remaining_tenure_months: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(20), default="declared")  # declared | detected

    customer: Mapped["Customer"] = relationship(back_populates="loans")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    proposed_loan_amount: Mapped[float] = mapped_column(Float, default=0.0)
    proposed_emi: Mapped[float] = mapped_column(Float, default=0.0)
    proposed_tenure_months: Mapped[int] = mapped_column(Integer, default=0)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    llm_used: Mapped[bool] = mapped_column(Boolean, default=False)

    customer: Mapped["Customer"] = relationship(back_populates="analyses")
