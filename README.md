# CrediSight — Bank Statement Analyzer for Credit Assessment

CrediSight analyzes customer bank statements (PDF / Excel / CSV) and produces
credit-assessment insights and a CAM-ready (Credit Appraisal Memo) report:
month-wise credit/debit analysis, average balances, salary & income tracking,
EMI/obligation detection, bounce & penalty detection, cash-intensity analysis,
red-flag identification, FOIR-based repayment-capacity assessment, and an
analyst narrative (optionally drafted by an LLM).

| Layer    | Stack |
|----------|-------|
| Backend  | Python 3.12 · FastAPI · Uvicorn · SQLAlchemy (SQLite) · pdfplumber · pandas · OpenAI (optional) |
| Frontend | React 18 · Vite · Recharts |

## Features

- ⚡ **Quick Scan (homepage)** — drop a statement, get an instant snapshot (totals, cash flow, bounces, red flags) with printable + downloadable report; stateless, nothing stored
- ✅ Month-wise analysis of credits and debits
- ✅ Total inflow / outflow summary
- ✅ Average monthly balance calculation (daily EOD carry-forward)
- ✅ Identification of major transactions
- ✅ Regular income / salary credit tracking
- ✅ EMI / loan repayment identification (recurring-debit clustering)
- ✅ Bounce / return transaction identification (cheque + ECS/NACH)
- ✅ Cheque bounce and penalty charge detection
- ✅ Unusual / high-value transaction alerts (thresholds + 3σ outliers)
- ✅ Cash deposit & withdrawal analysis with cash-intensity ratios
- ✅ Credit & debit pattern analysis (categories, channels, trends, volatility)
- ✅ Red-flag identification (bounces, window-dressing, circular flows, gambling/crypto, …)
- ✅ Multiple account statement analysis (combined balance & flows)
- ✅ Existing loan obligation tracking (declared + auto-detected, reconciled)
- ✅ Customer repayment capacity analysis (FOIR vs policy cap, EMI headroom)
- ✅ Summary report generation for credit appraisal / CAM (printable, AI narrative)

## Quick start

Prerequisites: **Python 3.11+** and **Node 18+**.

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # then put your OpenAI key in .env (optional)
uvicorn app.main:app --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

### 3. Where to put your OpenAI API key

Edit **`backend/.env`** (create it from `backend/.env.example`):

```
OPENAI_API_KEY=sk-...your key here...
```

Restart the backend after editing. Without a key the app still works fully in
**rules-only mode** — the LLM only adds (a) classification of transactions the
rule engine couldn't categorize and (b) an AI-drafted CAM narrative.

> Note: if `OPENAI_API_KEY` exists as a system environment variable it is also
> picked up automatically.

### 4. Try it with sample data

```bash
cd backend
.venv\Scripts\python scripts\generate_samples.py
```

This creates three realistic statements in `backend/sample_data/`
(`hdfc_savings.xlsx`, `sbi_current.csv`, `icici_savings.pdf`) that you can
upload through the UI. `scripts/e2e_test.py` runs the whole pipeline
programmatically as a smoke test.

## Documentation

- **[USER_GUIDE.md](USER_GUIDE.md)** — step-by-step usage guide (baby steps)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — design, data flow, and how each analysis works

## Project layout

```
FinanceApplication/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app
│   │   ├── config.py          # settings (.env)
│   │   ├── database.py        # SQLAlchemy engine/session
│   │   ├── models.py          # Customer/Account/Statement/Transaction/Loan/Analysis
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── routers/           # customers, statements, analysis endpoints
│   │   └── services/
│   │       ├── parsing/       # pdf_parser, excel_parser, normalizer
│   │       ├── categorization.py  # rule engine
│   │       ├── analysis.py    # all analysis computations
│   │       ├── llm.py         # optional OpenAI enrichment
│   │       └── report.py      # CAM report assembly + score
│   ├── scripts/               # sample-data generator + e2e test
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/             # Customers, CustomerDetail, Report
        ├── api.js             # fetch wrapper
        └── styles.css         # design system
```

## Disclaimer

The banking-behaviour score and all outputs are heuristic screening aids for a
human credit analyst — not a credit bureau score and not an automated lending
decision. Review AI-drafted narratives before use.
