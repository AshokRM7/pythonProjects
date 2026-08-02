"""Rule-based transaction categorization.

Deterministic first pass: regex rules tuned for Indian + international bank
narration styles. Anything left 'uncategorized' can optionally be resolved by
the LLM layer (services/llm.py) — rules stay the source of truth for
compliance-sensitive categories (bounce, EMI, cash) so results are auditable.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Categorized:
    category: str
    channel: str
    counterparty: str


# (category, compiled pattern) — first match wins. Order matters:
# bounce/penalty before generic loan; salary before generic transfer-in.
_RULES: list[tuple[str, re.Pattern]] = [
    ("penalty_charge", re.compile(
        r"(rtn|return|bounce|dishonou?r|penal)[\s\-/]*(chg|chgs|charge|charges|fee)|"
        r"(chq|cheque|ach|ecs|nach|emi|mandate)[\s\-/]*(rtn|return)?[\s\-/]*(chg|chgs|charge|charges)|"
        r"min(imum)?\s*bal(ance)?\s*(chg|charge|fee|penalty)|non[-\s]*maint(enance)?\s*(chg|charge)|"
        r"late\s*payment\s*(fee|chg|charge)|overdue\s*(chg|charge)", re.I)),
    ("cheque_bounce", re.compile(
        r"chq\s*(rtn|return|bounce|dishonou?r)|cheque\s*(rtn|return|bounce|dishonou?r)|"
        r"(rtn|return).*(chq|cheque)|inward\s*(chq|clg)\s*(rtn|return)|outward.*dishonou?r", re.I)),
    ("ecs_bounce", re.compile(
        r"(ach|ecs|nach|si|emi|mandate)[\s\-/]*(rtn|return|fail|bounce|dishonou?r|reject)|"
        r"(rtn|return|reject).*\b(ach|ecs|nach)\b|insufficient\s*funds|funds\s*insufficient", re.I)),
    ("emi", re.compile(
        r"\bemi\b|\bach[\s\-/]*d(ebit)?\b.*(fin|loan|bajaj|hdb|tvs|capital|credit)|"
        r"loan\s*(repay(ment)?|recovery|instal)|instal?lment|\bnach\b.*\b(dr|debit)\b|"
        r"auto[\s\-]*debit.{0,20}(loan|emi)|\becs\b.{0,15}(loan|emi)|"
        r"\bsi\b[\s\-/]*loan|loan\s*a/?c\s*(transfer|payment|tfr)|"
        r"(bajajfin|hdfcltd|hdbfin|tvscred|chola|lichfl|indiabulls|fullerton|iifl|"
        r"tatacapital|adityabirla|mahfin|muthoot|homecredit|creditsaison|dmifinance)", re.I)),
    ("loan_credit", re.compile(
        r"loan\s*(disb|disbursal|disbursement|credit|amount|rec\b|proceeds|sanction)|"
        r"disbursement|disbursal", re.I)),
    ("salary", re.compile(
        r"\bsalary\b|\bsal\b[\s\-/]|salar[iy]|\bpayroll\b|monthly\s*pay|\bwages\b|stipend|"
        r"neft.*sal(ary)?[\s\-/]|sal(ary)?\s*(credit|cr)\b", re.I)),
    ("cash_deposit", re.compile(
        r"cash\s*dep|by\s*cash|cdm\s*(dep|deposit|cash)?|cash\s*deposit|dep\s*by\s*cash|atm\s*dep", re.I)),
    ("cash_withdrawal", re.compile(
        r"\batm\b(?!.*dep)|cash\s*(wdl|withdrawal|wd)|self\s*(chq|cheque|withdrawal)|"
        r"\bcwd\b|atw[\s\-/]|nwd[\s\-/]|to\s*cash\b", re.I)),
    ("card_payment", re.compile(
        r"credit\s*card|\bcc\s*payment\b|card\s*payment|(visa|mastercard|rupay|amex)\s*(pmt|payment)|"
        r"\bpos\b[\s\-/]|point\s*of\s*sale", re.I)),
    ("investment", re.compile(
        r"\bsip\b|mutual\s*fund|\bmf\b[\s\-/]|zerodha|groww|upstox|kite|smallcase|\bnps\b|\bppf\b|"
        r"\betf\b|fd\s*(booking|creation)|fixed\s*deposit|\brd\b\s*instal", re.I)),
    ("insurance", re.compile(
        r"\blic\b|insurance|policy\s*premium|premium\s*(payment|pymt)|hdfc\s*life|icici\s*pru|"
        r"sbi\s*life|max\s*life|bajaj\s*allianz|star\s*health", re.I)),
    ("rent", re.compile(r"\brent\b|house\s*rent|rent\s*payment", re.I)),
    ("utility", re.compile(
        r"electricity|power\s*bill|water\s*bill|gas\s*bill|broadband|mobile\s*recharge|dth|"
        r"\bbescom\b|\bmseb\b|\btneb\b|postpaid|billdesk|bbps|airtel|\bjio\b|\bvi\b[\s\-/]|bsnl", re.I)),
    ("interest_credit", re.compile(r"\bint(erest)?\b.*(cr|credit|paid)|credit\s*interest|sb\s*int", re.I)),
    ("tax", re.compile(r"\bgst\b|income\s*tax|\btds\b|advance\s*tax|\btcs\b[\s\-/]|challan", re.I)),
    ("refund", re.compile(r"refund|reversal|\brev\b[\s\-/]|chargeback", re.I)),
    ("bank_charge", re.compile(
        r"\bsms\s*(chg|charge)|annual\s*(fee|chg)|debit\s*card\s*(fee|chg)|service\s*(chg|charge)|"
        r"processing\s*fee|\bamc\b[\s\-/]?|folio\s*chg|gst\s*on|bank\s*charges", re.I)),
    ("gambling", re.compile(
        r"dream11|rummy|poker|bet(way|365|fair)|1xbet|parimatch|my11circle|mpl\b|winzo|"
        r"lottery|casino|junglee|gamezy|fantasy\s*(sport|cricket)", re.I)),
    ("crypto", re.compile(r"binance|wazirx|coindcx|coinswitch|zebpay|crypto|bitcoin|\bbtc\b|\busdt\b", re.I)),
    ("upi_transfer", re.compile(r"\bupi\b|@ok(axis|hdfcbank|icici|sbi)|@ybl|@paytm|@apl|gpay|google\s*pay|phonepe|bhim", re.I)),
    ("transfer", re.compile(r"\bneft\b|\brtgs\b|\bimps\b|\bft\b[\s\-/]|fund\s*transfer|\btpt\b|\bmob\b[\s\-/]", re.I)),
]

_CHANNEL_RULES: list[tuple[str, re.Pattern]] = [
    ("upi", re.compile(r"\bupi\b|@|gpay|phonepe|bhim|paytm", re.I)),
    ("neft", re.compile(r"\bneft\b", re.I)),
    ("rtgs", re.compile(r"\brtgs\b", re.I)),
    ("imps", re.compile(r"\bimps\b", re.I)),
    ("ach", re.compile(r"\bach\b|\becs\b|\bnach\b|mandate", re.I)),
    ("cheque", re.compile(r"\bchq\b|cheque|clg\b|clearing", re.I)),
    ("atm", re.compile(r"\batm\b|\bcdm\b|\batw\b|\bnwd\b", re.I)),
    ("cash", re.compile(r"\bcash\b", re.I)),
    ("card", re.compile(r"\bpos\b|card|visa|mastercard|rupay", re.I)),
    ("netbanking", re.compile(r"\binb\b|netbank|internet\s*bank", re.I)),
]

_NBFC_STEMS = re.compile(
    r"bajajfin|bajaj\s*fin|hdfcltd|hdbfin|hdb\s*fin|tvscred|tvs\s*cred|chola|lichfl|"
    r"indiabulls|fullerton|iifl|tatacapital|tata\s*cap|adityabirla|aditya\s*birla|mahfin|"
    r"muthoot|homecredit|home\s*credit|creditsaison|dmifinance|dmi\s*fin|"
    r"fin(ance|serv|corp)\b|disb", re.I)

# channel/mode tokens that look like names in narration slots but aren't counterparties
_NOT_A_NAME = {"ifo", "ifi", "ifn", "p2a", "p2m", "mob", "inb", "coll", "pay", "upi", "int"}

_COUNTERPARTY_PATTERNS = [
    re.compile(r"upi[/\-](?:p2[am][/\-])?(?:\d+[/\-])?(?P<name>[a-z0-9 ._]{3,40}?)[/\-@]", re.I),
    re.compile(r"(?:neft|imps|rtgs)[/\-](?:[a-z0-9]+[/\-])?(?P<name>[a-z ._]{3,40}?)(?:[/\-]|$)", re.I),
    re.compile(r"(?:to|from|by)\s+transfer\s*[-/]?\s*(?P<name>[a-z ._]{3,40})", re.I),
]


def categorize(description: str, debit: float, credit: float) -> Categorized:
    desc = description or ""
    category = "uncategorized"
    for cat, pattern in _RULES:
        if pattern.search(desc):
            category = cat
            break

    # direction-sensitive fixes
    if category == "salary" and debit > 0:
        category = "transfer"
    if category == "emi" and credit > 0 and debit == 0:
        # an inward credit naming an NBFC/lender is loan money coming IN;
        # other emi-worded credits (e.g. "Loan Repaym" received) are ordinary inflows
        if _NBFC_STEMS.search(desc):
            category = "loan_credit"
        else:
            category = "transfer_in"
    if category == "cheque_bounce" and credit > 0:
        # inward cheque returned = credit reversed; keep as bounce (it is meaningful)
        pass
    if category in ("upi_transfer", "transfer") and credit > 0:
        category = "transfer_in"
    elif category in ("upi_transfer",):
        category = "transfer"

    channel = ""
    for ch, pattern in _CHANNEL_RULES:
        if pattern.search(desc):
            channel = ch
            break

    counterparty = ""
    for p in _COUNTERPARTY_PATTERNS:
        m = p.search(desc)
        if m:
            name = re.sub(r"\s+", " ", m.group("name")).strip()
            if name.lower() in _NOT_A_NAME:
                continue
            counterparty = name.title()[:100]
            break

    return Categorized(category=category, channel=channel, counterparty=counterparty)


DEBIT_CATEGORIES_OBLIGATION = {"emi"}
BOUNCE_CATEGORIES = {"cheque_bounce", "ecs_bounce"}
CASH_CATEGORIES = {"cash_deposit", "cash_withdrawal"}
RISK_CATEGORIES = {"gambling", "crypto"}
