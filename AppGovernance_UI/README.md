# IAM Agentic Demo

An all-in-one Monorepo demo showcasing an Autonomous AI Agent for Identity and Access Management (IAM) governance.

## Architecture

- **Frontend**: React + Vite (Port 5173)
- **Backend**: Python FastAPI (Port 9000)
- **AI/LLM**: LangChain + OpenAI (GPT-4)
- **RAG**: FAISS + OpenAI Embeddings
- **Mock Systems**: RISE (Ticketing), JIRA, AppHQ (Identity Source), Mail

## Prerequisites

- Node.js (v18+)
- Python (v3.10+)
- OpenAI API Key

## Quick Start

### 1. Setup Backend

Open a terminal in the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r app/requirements.txt
```

**Set your OpenAI API Key:**

```powershell
$env:OPENAI_API_KEY="sk-..."
```

**Run Backend:**

```powershell
python -m uvicorn app.main:app --reload --port 9000
```

### 2. Setup Frontend

Open a NEW terminal in the project root:

```powershell
npm install
npm run dev
```

### 3. Usage

1. Open http://localhost:5173
2. Click on a ticket (e.g., "Privileged Access Review").
3. Click **"Run AI Agent"**.
4. Watch the live execution log as the agent:
   - Fetches ticket details
   - Validates IAM category with LLM
   - Retrieves app owners from AppHQ
   - Drafts and sends emails
   - Updates JIRA and RISE systems

## Troubleshooting

- **Backend fails to start?** Check if port 9000 is free.
- **Frontend not connecting?** Ensure `VITE_API_BASE_URL` in `.env` matches the backend URL.
- **Agent error?** Ensure `OPENAI_API_KEY` is set correctly in the backend terminal.