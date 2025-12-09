from fastapi import FastAPI, HTTPException, BackgroundTasks
from dotenv import load_dotenv

load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from pathlib import Path
import json
import datetime
import uvicorn
import random

# Import Agent Orchestrator
from agentic_bot.agent_orchestrator import start_agent_run, get_agent_run, list_agent_runs
from agentic_bot.rag.ingest import build_index
# Try to build index on startup if not exists (optional, or just rely on manual run)
# build_index() 

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EMAIL_LOG = DATA_DIR / "email_log.json"

class Ticket(BaseModel):
    id: str
    application: str
    description: str
    category: str
    created_by: str
    created_at: str
    ait_number: str
    business_owner: Optional[str] = None
    support_owner: Optional[str] = None
    jira_id: str
    priority: str
    sla_days: int
    status: str
    evidence: List[str] = []

class JiraItem(BaseModel):
    id: str
    summary: str
    status: str
    comments: List[str] = []

class Email(BaseModel):
    to: List[str]
    subject: str
    body: str

# --- Agent Endpoints ---

class AgentRunRequest(BaseModel):
    ticket_id: str

@app.post("/agent/run/{ticket_id}")
async def run_agent(ticket_id: str):
    job_id = start_agent_run(ticket_id)
    return {"job_id": job_id, "ticket_id": ticket_id, "status": "pending"}

@app.get("/agent/status/{job_id}")
def get_agent_status(job_id: str):
    run = get_agent_run(job_id)
    if not run:
        raise HTTPException(status_code=404, detail="Job not found")
    return run

@app.get("/agent/runs")
def get_all_runs():
    return list_agent_runs()

TICKETS: Dict[str, Ticket] = {
    "IAM-001": Ticket(
        id="IAM-001",
        application="Payments Portal",
        description="Quarterly access review for Payments Portal – validate all active users in AD group APP_PAYMENTS_PROD and confirm deprovisioning of leavers.",
        category="IAM",
        created_by="GIS Team",
        created_at="2025-02-02T10:00:00Z",
        ait_number="APP-44567",
        business_owner=None,
        support_owner=None,
        jira_id="JIRA-1001",
        priority="High",
        sla_days=5,
        status="New",
        evidence=[]
    ),
    "IAM-002": Ticket(
        id="IAM-002",
        application="Risk Dashboard",
        description="Review privileged DB access for Risk Dashboard – confirm only approved IDs have DBA role and attach ARM ticket evidence.",
        category="IAM",
        created_by="GIS Team",
        created_at="2025-02-03T11:00:00Z",
        ait_number="APP-77889",
        business_owner=None,
        support_owner=None,
        jira_id="JIRA-1002",
        priority="Medium",
        sla_days=10,
        status="New",
        evidence=[]
    ),
}

JIRA_ITEMS: Dict[str, JiraItem] = {
    "JIRA-1001": JiraItem(id="JIRA-1001", summary="IAM review for Payments Portal", status="Open", comments=[]),
    "JIRA-1002": JiraItem(id="JIRA-1002", summary="Privileged DB access review for Risk Dashboard", status="Open", comments=[]),
}

def load_users():
    users_path = DATA_DIR / "users.json"
    with open(users_path, "r") as f:
        return json.load(f)

def append_email_log(email: Email):
    EMAIL_LOG.parent.mkdir(parents=True, exist_ok=True)
    if EMAIL_LOG.exists():
        with open(EMAIL_LOG, "r") as f:
            log = json.load(f)
    else:
        log = []
    log.append({
        "timestamp": datetime.utcnow().isoformat(),
        "to": email.to,
        "subject": email.subject,
        "body": email.body
    })
    with open(EMAIL_LOG, "w") as f:
        json.dump(log, f, indent=2)

from fastapi import Query

@app.get("/rise/tickets", response_model=List[Ticket])
def list_tickets(status: Optional[str] = Query(None)):
    tickets = list(TICKETS.values())
    if status:
        tickets = [t for t in tickets if t.status.lower() == status.lower()]
    return tickets

@app.get("/rise/tickets/{ticket_id}", response_model=Ticket)
def get_ticket(ticket_id: str):
    if ticket_id not in TICKETS:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return TICKETS[ticket_id]

@app.post("/rise/tickets/{ticket_id}/assign_owners", response_model=Ticket)
def assign_owners(ticket_id: str, business_owner: str, support_owner: str):
    if ticket_id not in TICKETS:
        raise HTTPException(status_code=404, detail="Ticket not found")
    t = TICKETS[ticket_id]
    t.business_owner = business_owner
    t.support_owner = support_owner
    TICKETS[ticket_id] = t
    return t

@app.post("/rise/tickets/{ticket_id}/status", response_model=Ticket)
def update_status(ticket_id: str, status: str):
    if ticket_id not in TICKETS:
        raise HTTPException(status_code=404, detail="Ticket not found")
    t = TICKETS[ticket_id]
    t.status = status
    TICKETS[ticket_id] = t
    return t

@app.post("/rise/tickets/{ticket_id}/evidence", response_model=Ticket)
def add_evidence(ticket_id: str, evidence: str):
    if ticket_id not in TICKETS:
        raise HTTPException(status_code=404, detail="Ticket not found")
    t = TICKETS[ticket_id]
    t.evidence.append(evidence)
    TICKETS[ticket_id] = t
    return t

@app.get("/jira/items/{jira_id}", response_model=JiraItem)
def get_jira_item(jira_id: str):
    if jira_id not in JIRA_ITEMS:
        raise HTTPException(status_code=404, detail="JIRA item not found")
    return JIRA_ITEMS[jira_id]

@app.post("/jira/items/{jira_id}/comment", response_model=JiraItem)
def add_comment(jira_id: str, comment: str):
    if jira_id not in JIRA_ITEMS:
        raise HTTPException(status_code=404, detail="JIRA item not found")
    j = JIRA_ITEMS[jira_id]
    j.comments.append(comment)
    JIRA_ITEMS[jira_id] = j
    return j

@app.post("/jira/items/{jira_id}/status", response_model=JiraItem)
def update_jira_status(jira_id: str, status: str):
    if jira_id not in JIRA_ITEMS:
        raise HTTPException(status_code=404, detail="JIRA item not found")
    j = JIRA_ITEMS[jira_id]
    j.status = status
    JIRA_ITEMS[jira_id] = j
    return j

@app.get("/apphq/owners/{ait_number}")
def get_owners(ait_number: str):
    users = load_users()
    if ait_number not in users:
        raise HTTPException(status_code=404, detail="AIT not found")
    return users[ait_number]

@app.post("/mail/send")
def send_email(email: Email):
    append_email_log(email)
    return {"status": "sent", "to": email.to}

@app.get("/mail/logs")
def get_email_logs():
    if EMAIL_LOG.exists():
        with open(EMAIL_LOG, "r") as f:
            return json.load(f)
    return []
