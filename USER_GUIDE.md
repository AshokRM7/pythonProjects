# CrediSight — User Guide (Step by Step)

This guide walks you through everything from first-time setup to generating a
printable Credit Appraisal (CAM) report. No prior knowledge assumed.

---

## Part 1 — One-time setup

### Step 1.1 · Check prerequisites

Open a terminal (PowerShell on Windows) and check:

```bash
python --version
```

```bash
node --version
```

You need **Python 3.11 or newer** and **Node.js 18 or newer**. If missing,
install from https://www.python.org/downloads/ and https://nodejs.org/.

### Step 1.2 · Set up the backend

```bash
cd C:\MyFolders\Projects\FinanceApplication\backend
```

Create the virtual environment (one time only):

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

(macOS/Linux: `source .venv/bin/activate`)

Install the dependencies (one time only):

```bash
pip install -r requirements.txt
```

### Step 1.3 · Add your OpenAI API key (optional but recommended)

1. In the `backend` folder, copy `.env.example` to a new file named `.env`:

   ```bash
   copy .env.example .env
   ```

2. Open `backend/.env` in any text editor and paste your key:

   ```
   OPENAI_API_KEY=sk-...your key here...
   ```

3. Save the file. That's it — the app auto-detects the key on startup.

**What the key enables:** AI classification of transactions the rule engine
couldn't identify, and an AI-drafted analyst narrative in the CAM report.
**Without a key** the app still works completely — it just uses rules-only
classification and a template narrative. The sidebar in the app shows
`AI enrichment: ON` or `rules-only` so you always know which mode you're in.

### Step 1.4 · Set up the frontend

Open a **second** terminal:

```bash
cd C:\MyFolders\Projects\FinanceApplication\frontend
```

```bash
npm install
```

Setup is now complete — you never need to repeat Part 1 again.

---

## Part 2 — Starting the application (every time)

### Step 2.1 · Start the backend (terminal 1)

```bash
cd C:\MyFolders\Projects\FinanceApplication\backend
```

```bash
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Leave this terminal running. You should see `Uvicorn running on http://127.0.0.1:8000`.

### Step 2.2 · Start the frontend (terminal 2)

```bash
cd C:\MyFolders\Projects\FinanceApplication\frontend
```

```bash
npm run dev
```

### Step 2.3 · Open the app

Go to **http://localhost:5173** in your browser. You should see the CrediSight
dashboard with a dark sidebar. Check the bottom of the sidebar:

- `AI enrichment: ON · gpt-4o-mini` → your OpenAI key is active
- `rules-only` → no key configured (still fully functional)
- `⚠ Backend not reachable` → the backend from Step 2.1 isn't running

---

## Part 2.5 — Quick Scan (instant one-off analysis)

The **homepage** (⚡ Quick scan in the sidebar) gives you an instant report
without creating a customer:

1. Open http://localhost:5173 — you land on the Quick Scan page.
2. Drag & drop one or more statement files (PDF / XLSX / XLS / CSV) onto the
   drop zone, or click it to browse. Remove a file with the ✕ on its chip.
3. Click **⚡ Run quick scan**. In a few seconds the report appears below:
   total credits & debits, net cash flow, average balance, monthly charts,
   balance trend, red flags, bounce record, cash analysis, and top transactions.
4. Export it:
   - **🖨 Print / save PDF** — print-optimized layout, choose "Save as PDF".
   - **⬇ Download report** — saves a self-contained HTML file you can email,
     archive, or open offline (no internet needed to view it).

Quick Scan is **stateless**: uploaded files are analyzed in memory and deleted
immediately; nothing appears in the customer database. Use it for fast
screening — for FOIR/repayment capacity, salary sources and the AI-drafted CAM
narrative, use the full workflow below.

---

## Part 3 — Analyzing a customer (the main workflow)

### Step 3.1 · Create the customer

1. Click **+ New customer** (top right).
2. Fill in the name (required) and, ideally, PAN, employment type, and
   **declared monthly income** — the income figure is compared against what the
   statements actually show.
3. Click **Create customer**, then click the customer's name to open their page.

### Step 3.2 · Add the customer's bank account(s)

1. In **Bank accounts & statements**, click **+ Add account**.
2. Enter bank name (e.g. "HDFC Bank"), account number, and type
   (savings / current / OD).
3. Click **Add account**.
4. **Repeat for every bank account the customer has** — multi-account analysis
   is automatic: balances and flows are combined across all accounts.

### Step 3.3 · Upload bank statements

1. Next to each account, click **⬆ Upload statements**.
2. Select one or more files. Supported formats:
   - **PDF** — digital (text-based) bank statement PDFs
   - **XLSX / XLS** — Excel exports from netbanking
   - **CSV** — CSV exports from netbanking
3. Wait a few seconds. A green note shows how many transactions were parsed and
   the statement period. Each file appears in the table with a status:
   - 🟢 **parsed** — everything extracted cleanly
   - 🟡 **partial** — extracted with warnings (read the note under the status)
   - 🔴 **failed** — nothing could be extracted (see Troubleshooting below)

> **Tip:** upload 6–12 months of statements for meaningful salary-regularity
> and EMI-recurrence detection. You can upload several files per account
> (e.g. one per quarter).

### Step 3.4 · Record existing (declared) loans

1. In **Existing loan obligations**, click **+ Add loan**.
2. Enter lender, type, **EMI per month**, outstanding amount, and remaining tenure.
3. Repeat for each loan the customer declared.

The engine *also* auto-detects EMIs from the statements. The final analysis
shows both figures and conservatively uses the **higher** of
(detected vs declared) as the obligation.

### Step 3.5 · (Optional) AI-classify unknown transactions

Click **✨ AI-classify unknown transactions**. Anything the rule engine left
as "uncategorized" is sent (in batches) to your OpenAI model and re-labeled.
Do this once after all uploads, before analyzing. Skip if you have no API key.

### Step 3.6 · Run the analysis

1. In **Run credit analysis**, optionally enter the **proposed loan**:
   amount, EMI, and tenure. If you enter the proposed EMI you'll get
   "FOIR with proposed EMI" — the key sanction metric.
2. Click **⚡ Analyze & generate CAM report**.
3. In a few seconds you land on the full report.

---

## Part 4 — Reading the report

| Section | What it tells you |
|---|---|
| **Banking behaviour score** | 0–100 heuristic screening score with a transparent breakdown (income regularity, bounce record, balance health, obligation headroom, conduct). Not a bureau score. |
| **Capacity verdict** | comfortable / acceptable / stretched / insufficient data — with the FOIR rationale. |
| **Summary tiles** | Total inflow, outflow, average balance (daily EOD basis), net flow, negative-balance days. |
| **Month-wise credits & debits** | Chart + table of monthly totals, counts, net flow, average daily balance, closing balance. |
| **Daily balance trend** | Combined end-of-day balance across all accounts. |
| **Income & salary tracking** | Detected salary sources, average amount, typical credit day, regularity %. Recurring non-salary credits (for self-employed) are detected too. |
| **EMI / loan obligations** | Auto-detected EMIs (lender hint, amount, recurrence) vs declared loans. |
| **Bounces & penalties** | Cheque returns, ECS/NACH failures, and the penalty charges the bank levied. |
| **Cash analysis** | Cash deposits/withdrawals, month-wise chart, and cash as a % of inflow (income-verifiability signal). |
| **Red flags** | Bounces, negative balances, cash intensity, irregular income, gambling/crypto, circular flows, end-period balance spikes (window dressing), outflow > inflow. Severity-ranked with evidence transactions. |
| **Repayment capacity (FOIR)** | Income vs obligations, FOIR existing and with the proposed EMI, and the eligible additional EMI headroom under the policy cap. |
| **Pattern analysis** | Spend by category and channel, inflow trend (growing/stable/declining), volatility, expense-to-income ratio. |
| **Major & unusual transactions** | Top credits/debits and alerts: high-value (≥ ₹1,00,000 default), 3σ statistical outliers, large round-figure cash. |
| **Analyst narrative** | The CAM "Banking Analysis" section — AI-drafted from the computed metrics (or a template if no key). Always review before use. |

### Printing / exporting the CAM report

Click **🖨 Print / save PDF** (top right of the report) and choose
"Save as PDF" in the print dialog. The layout is print-optimized.

### Re-running and history

Every run is saved. On the customer page, **Past analyses** lists previous
reports — useful to compare before/after adding more statements.

---

## Part 5 — Tuning the analysis policy

Edit `backend/.env` and restart the backend:

| Setting | Default | Meaning |
|---|---|---|
| `HIGH_VALUE_TXN_THRESHOLD` | `100000` | Amount at/above which a transaction is flagged high-value |
| `CASH_INTENSITY_WARN_RATIO` | `0.40` | Warn when cash deposits exceed this fraction of inflow |
| `FOIR_MAX` | `0.55` | Policy cap for Fixed-Obligation-to-Income Ratio |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for classification & narrative |
| `LLM_ENABLED_FEATURES` | `classification,narrative` | Remove one to disable it |

---

## Part 6 — Troubleshooting

**"Could not extract transactions from this file" on a PDF**
The PDF is probably a *scanned image*, password-protected, or has a very exotic
layout. Fixes: ask for the netbanking **Excel/CSV export** of the same period
(always parses best), or remove the PDF password first.

**A statement parsed but debit/credit look swapped**
Text-fallback PDF parsing infers direction from keywords when the PDF has no
usable table. The parse note on the statement row tells you when this fallback
was used. Prefer Excel/CSV for such banks.

**"Backend not reachable on :8000"** in the sidebar
Start the backend (Step 2.1). If the port is taken, run uvicorn with another
port and update the `proxy` target in `frontend/vite.config.js`.

**Analysis says "No parsed transactions"**
All uploads failed or you haven't uploaded any statement yet — check the
status pills in the accounts section.

**AI features not activating**
The key must be in `backend/.env` (or a system env var) **before** the backend
starts. Restart the backend after editing `.env`, then refresh the browser and
check the sidebar badge.

**Fresh start / demo reset**
Stop the backend and delete `backend/credisight.db` (and `backend/uploads/`).
All customers and analyses are removed. Restart the backend.

---

## Part 7 — Trying it with the built-in sample data

Generate three realistic sample statements (a salaried HDFC XLSX, a business
SBI CSV, a salaried ICICI PDF — with salaries, EMIs, a cheque bounce, an ECS
bounce, cash deposits, and a crypto purchase baked in):

```bash
cd C:\MyFolders\Projects\FinanceApplication\backend
```

```bash
.venv\Scripts\python scripts\generate_samples.py
```

Then follow Part 3 using the files from `backend/sample_data/`.

To validate the entire pipeline without the UI:

```bash
.venv\Scripts\python scripts\e2e_test.py
```

You should see `E2E TEST PASSED` with a summary of every analysis module.
