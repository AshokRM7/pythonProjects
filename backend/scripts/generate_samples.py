"""Generates realistic sample bank statements for demo/testing.

Creates in sample_data/:
  1. hdfc_savings.xlsx   - 6 months, salaried profile, separate Debit/Credit columns
  2. sbi_current.csv     - 6 months, single Amount column with Dr/Cr indicator
  3. icici_savings.pdf   - 3 months, table-based PDF statement

Run:  python scripts/generate_samples.py
"""
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "sample_data"
OUT.mkdir(exist_ok=True)

random.seed(42)


def month_iter(start: date, months: int):
    y, m = start.year, start.month
    for _ in range(months):
        yield y, m
        m += 1
        if m > 12:
            m = 1
            y += 1


def build_salaried_txns(start: date, months: int):
    """Salary account: salary, rent, EMIs, UPI spends, a bounce, cash, investments."""
    txns = []  # (date, narration, debit, credit)
    for y, m in month_iter(start, months):
        def d(day):
            return date(y, m, min(day, 28))
        # salary
        txns.append((d(1), "NEFT CR-AXIS BANK-TECHNOVA SOLUTIONS PVT LTD-SALARY JUL", 0, 85000 + random.randint(-2000, 2000)))
        # rent
        txns.append((d(3), "UPI/P2A/1234567/RAMESH KUMAR/HOUSE RENT", 22000, 0))
        # EMIs
        txns.append((d(5), "ACH D- BAJAJFIN LOAN EMI 40912345", 8450, 0))
        txns.append((d(7), "NACH DR HDFC LTD HOME LOAN EMI 776541", 18200, 0))
        # SIP
        txns.append((d(10), "ACH D- INDIAN CLEARING CORP-SIP GROWW MF", 5000, 0))
        # utilities
        txns.append((d(12), "BILLDESK-BESCOM ELECTRICITY BILL", random.randint(900, 2100), 0))
        txns.append((d(13), "UPI/P2M/AIRTEL POSTPAID RECHARGE", 599, 0))
        # groceries / food UPI
        for _ in range(random.randint(8, 14)):
            day = random.randint(2, 27)
            txns.append((d(day), random.choice([
                "UPI/P2M/4297/SWIGGY/BANGALORE", "UPI/P2M/8821/ZOMATO LTD",
                "UPI/P2M/5511/BIGBASKET/GROCERY", "UPI/P2M/9932/RELIANCE SMART",
                "POS 416021XXXXXX SHOPPERS STOP", "UPI/P2M/1782/AMAZON PAY INDIA",
            ]), random.randint(150, 3500), 0))
        # ATM withdrawal
        txns.append((d(random.randint(14, 20)), "ATM-CASH WDL/BLR MG ROAD/416021XX9012", 10000, 0))
        # credit card payment
        txns.append((d(16), "IB FUNDS TRANSFER CREDIT CARD PAYMENT HDFC 4432XXXXXXXX1223", random.randint(9000, 24000), 0))
        # interest quarterly
        if m % 3 == 0:
            txns.append((d(25), "CREDIT INTEREST SB INT", 0, random.randint(150, 420)))
    # one ECS bounce + penalty in month 3
    y3, m3 = list(month_iter(start, months))[2]
    txns.append((date(y3, m3, 5), "ACH RTN CHG-BAJAJFIN EMI RETURN-INSUFFICIENT FUNDS", 0, 0))
    txns = [t for t in txns if not (t[2] == 0 and t[3] == 0)]
    txns.append((date(y3, m3, 5), "ACH D- BAJAJFIN LOAN EMI 40912345 RETURN INSUFFICIENT FUNDS", 8450, 0))
    txns.append((date(y3, m3, 5), "ECS RTN CHGS 590 INCL GST", 590, 0))
    txns.append((date(y3, m3, 6), "NEFT CR REVERSAL BAJAJFIN EMI RTN", 0, 8450))
    # a high-value credit (bonus) month 4 (or last month for short periods)
    y4, m4 = list(month_iter(start, months))[min(3, months - 1)]
    txns.append((date(y4, m4, 15), "NEFT CR-TECHNOVA SOLUTIONS-ANNUAL PERFORMANCE BONUS", 0, 150000))
    txns.sort(key=lambda t: t[0])
    return txns


def build_business_txns(start: date, months: int):
    """Current account: customer receipts, supplier payments, cash deposits, cheque bounce."""
    txns = []
    for y, m in month_iter(start, months):
        def d(day):
            return date(y, m, min(day, 28))
        for _ in range(random.randint(6, 10)):
            txns.append((d(random.randint(1, 27)),
                         random.choice([
                             "NEFT CR-KOTAK BANK-SRI VENKATESHWARA TRADERS-INV PAYMENT",
                             "IMPS CR 4432/METRO WHOLESALE/PAYMENT",
                             "UPI/P2A/COLL/GANESH STORES/GOODS",
                         ]), 0, random.randint(8000, 60000)))
        # cash deposits (business takings)
        for _ in range(random.randint(3, 5)):
            txns.append((d(random.randint(2, 26)), "CASH DEP-CDM BRANCH KORAMANGALA", 0, random.choice([20000, 30000, 50000])))
        # supplier payments
        for _ in range(random.randint(5, 8)):
            txns.append((d(random.randint(2, 27)),
                         random.choice([
                             "RTGS DR-SUPPLIER-NATIONAL DISTRIBUTORS LTD",
                             "NEFT DR-MAHALAKSHMI AGENCIES-PURCHASE",
                             "CHQ PAID 002341 SUNRISE PACKAGING",
                         ]), random.randint(15000, 80000), 0))
        # business loan EMI
        txns.append((d(10), "NACH DR TATA CAPITAL BUSINESS LOAN EMI", 21500, 0))
        # shop rent
        txns.append((d(4), "CHQ PAID 002355 SHOP RENT LANDLORD", 35000, 0))
        # GST
        txns.append((d(20), "INB GST PAYMENT CBEC CHALLAN", random.randint(8000, 22000), 0))
    # cheque bounce in month 2
    y2, m2 = list(month_iter(start, months))[1]
    txns.append((date(y2, m2, 18), "INWARD CHQ RETURN-002348-INSUFFICIENT FUNDS", 45000, 0))
    txns.append((date(y2, m2, 18), "CHQ RTN CHGS 295 INCL GST", 295, 0))
    # crypto dabble
    y5, m5 = list(month_iter(start, months))[min(4, months - 1)]
    txns.append((date(y5, m5, 8), "UPI/P2M/WAZIRX CRYPTO PURCHASE", 25000, 0))
    txns.sort(key=lambda t: t[0])
    return txns


def with_balance(txns, opening: float):
    rows = []
    bal = opening
    for dt, narr, dr, cr in txns:
        bal = bal - dr + cr
        rows.append((dt, narr, dr, cr, round(bal, 2)))
    return rows


def make_xlsx():
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Statement"
    ws.append(["HDFC BANK LTD"])
    ws.append(["Statement of Account - Savings A/c 50100234567890"])
    ws.append(["Customer: ARJUN MEHTA    Period: 01/01/2026 to 30/06/2026"])
    ws.append([])
    ws.append(["Txn Date", "Narration", "Chq./Ref.No.", "Withdrawal Amt", "Deposit Amt", "Closing Balance"])
    rows = with_balance(build_salaried_txns(date(2026, 1, 1), 6), 64000)
    for dt, narr, dr, cr, bal in rows:
        ws.append([dt.strftime("%d/%m/%Y"), narr, "",
                   f"{dr:,.2f}" if dr else "", f"{cr:,.2f}" if cr else "", f"{bal:,.2f}"])
    wb.save(OUT / "hdfc_savings.xlsx")
    print("wrote", OUT / "hdfc_savings.xlsx", len(rows), "txns")


def make_csv():
    rows = with_balance(build_business_txns(date(2026, 1, 1), 6), 145000)
    lines = [
        "STATE BANK OF INDIA",
        "Current Account Statement - A/c 00000034567812345",
        "MEHTA TRADING CO,,,,,",
        "",
        "Date,Description,Ref No,Amount,Dr/Cr,Balance",
    ]
    for dt, narr, dr, cr, bal in rows:
        amt = dr if dr else cr
        drcr = "DR" if dr else "CR"
        narr_csv = narr.replace(",", " ")
        lines.append(f"{dt.strftime('%d-%b-%Y')},{narr_csv},,\"{amt:,.2f}\",{drcr},\"{bal:,.2f}\"")
    (OUT / "sbi_current.csv").write_text("\n".join(lines), encoding="utf-8")
    print("wrote", OUT / "sbi_current.csv", len(rows), "txns")


def make_pdf():
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    txns = build_salaried_txns(date(2026, 4, 1), 3)
    rows = with_balance(txns, 78000)
    doc = SimpleDocTemplate(str(OUT / "icici_savings.pdf"), pagesize=A4,
                            leftMargin=12 * mm, rightMargin=12 * mm)
    styles = getSampleStyleSheet()
    small = styles["BodyText"]
    small.fontSize = 7
    elements = [
        Paragraph("ICICI BANK - Statement of Account", styles["Title"]),
        Paragraph("Savings A/c 001601534987 | ARJUN MEHTA | Period 01/04/2026 - 30/06/2026", styles["Normal"]),
        Spacer(1, 6),
    ]
    data = [["Date", "Particulars", "Debit", "Credit", "Balance"]]
    for dt, narr, dr, cr, bal in rows:
        data.append([dt.strftime("%d-%m-%Y"), Paragraph(narr, small),
                     f"{dr:,.2f}" if dr else "", f"{cr:,.2f}" if cr else "", f"{bal:,.2f}"])
    table = Table(data, colWidths=[22 * mm, 88 * mm, 24 * mm, 24 * mm, 26 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f26522")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
    ]))
    elements.append(table)
    doc.build(elements)
    print("wrote", OUT / "icici_savings.pdf", len(rows), "txns")


if __name__ == "__main__":
    make_xlsx()
    make_csv()
    make_pdf()
    print("done.")
