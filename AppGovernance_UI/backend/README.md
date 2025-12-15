# IAM Demo Backend

# checking commit
FastAPI backend for the IAM Agentic Demo.

## Features
- **Mock Systems**: Simulates enterprise APIs for RISE, JIRA, AppHQ, and Email.
- **RAG Engine**: Vector search for IAM policies using FAISS.
- **Agent Orchestrator**: Manages long-running AI workflows.

## Setup

1. Create Virtual Environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .\.venv\Scripts\Activate
   ```

2. Install Dependencies:
   ```bash
   pip install -r app/requirements.txt
   ```

3. Configure:
   - Ensure `OPENAI_API_KEY` is set in environment or `.env` file.

## Running

```bash
python -m uvicorn app.main:app --reload --port 9000
```

## API Documentation

Once running, visit: http://127.0.0.1:9000/docs
