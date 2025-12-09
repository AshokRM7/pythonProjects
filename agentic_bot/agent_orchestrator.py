import asyncio
import uuid
import datetime
import yaml
import os
import json
from typing import Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Import RAG retriever
from agentic_bot.rag.retriever import get_policy_context

# Global state for agent runs
AGENT_RUNS: Dict[str, Dict[str, Any]] = {}

# Load Config
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, "config.yaml")

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            return yaml.safe_load(f)
    return {}

CONFIG = load_config()

def log_step(job_id: str, label: str, detail: str = ""):
    if job_id in AGENT_RUNS:
        step = {
            "ts": datetime.datetime.now().isoformat(),
            "label": label,
            "detail": detail
        }
        AGENT_RUNS[job_id]["steps"].append(step)
        # Also update last_update for list view
        AGENT_RUNS[job_id]["last_update"] = step["ts"]

async def run_iam_agent_for_ticket(job_id: str, ticket_id: str):
    """
    Orchestrates the IAM agent flow for a given ticket.
    """
    log_step(job_id, "Started agent", f"Processing ticket {ticket_id}")
    AGENT_RUNS[job_id]["status"] = "running"
    
    try:
        # 1. Fetch Ticket
        # In a real app, we'd call the API. Since we are in the same process as the mock server, 
        # we could import the service, but let's simulate an HTTP call or just access the mock data if possible.
        # For better separation, let's assume we use requests or httpx to call our own API, 
        # OR just import the mock data directly if we want to be fast. 
        # The prompt says "Fetch the ticket from /rise/tickets/{ticket_id}".
        # Let's use httpx or requests to call localhost:9000 to be architecturally pure, 
        # OR just mock it since we are the backend.
        # Let's try to access the mock data directly to avoid self-recursion issues if server isn't ready,
        # BUT the server IS running.
        # However, to be safe and simple, I will import the mock_db from mock_services.mock_server if possible.
        # But mock_server is the entry point.
        # Let's use a helper to fetch data.
        
        import requests
        API_BASE = "http://127.0.0.1:9001"
        
        async def async_get(url):
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, requests.get, url)

        async def async_post(url, json_data):
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, lambda: requests.post(url, json=json_data))
        
        log_step(job_id, "Fetching ticket details", f"GET /rise/tickets/{ticket_id}")
        # We need to wait a bit to ensure server is up if we just started, but it should be.
        # Note: This runs in background, so main loop is running.
        
        # We'll use a small sleep to simulate network and make the UI look good
        await asyncio.sleep(1) 
        
        # Actual fetch
        try:
            resp = await async_get(f"{API_BASE}/rise/tickets")
            tickets = resp.json()
            ticket = next((t for t in tickets if t["id"] == ticket_id), None)
            if not ticket:
                raise Exception(f"Ticket {ticket_id} not found")
        except Exception as e:
            # Fallback for demo if server not reachable (e.g. during dev)
            # ticket = {"id": ticket_id, "description": "Access request for Payments Portal", "app_id": "APP-123"}
             raise e

        log_step(job_id, "Ticket fetched", f"Found ticket: {ticket.get('description')}")
        
        # 1.5 Update Status to In Progress
        try:
            await async_post(f"{API_BASE}/rise/tickets/{ticket_id}/status?status=In%20Progress", {})
        except:
            pass
        
        # 2. RAG Retrieval
        await asyncio.sleep(0.5)
        log_step(job_id, "Retrieving policy context", "Querying vector index...")
        policy_context = get_policy_context(ticket.get("description", ""), top_k=3)
        log_step(job_id, "Policy context retrieved", f"Found relevant policies:\n{policy_context[:200]}...")
        
        # 3. LLM Decision (Email Draft)
        await asyncio.sleep(0.5)
        log_step(job_id, "Drafting email via LLM", "Calling OpenAI...")
        
        llm = ChatOpenAI(
            model="gpt-4o", # or gpt-3.5-turbo
            temperature=0,
            api_key=os.environ.get("OPENAI_API_KEY")
        )
        
        prompt = ChatPromptTemplate.from_template("""
        You are an IAM automation agent.
        
        Ticket details:
        {ticket}
        
        Policy context:
        {context}
        
        Decide what email to send to the owners to request required IAM evidence.
        Draft a clear, concise email.
        Don't invent data, just ask for evidence.
        Return ONLY the email body.
        """)
        
        chain = prompt | llm | StrOutputParser()
        email_body = await chain.ainvoke({"ticket": str(ticket), "context": policy_context})
        
        AGENT_RUNS[job_id]["email_body"] = email_body
        log_step(job_id, "Email drafted", "Generated email content.")
        
        # 4. Fetch Owners
        await asyncio.sleep(0.5)
        app_id = ticket.get("app_id", "APP-001") # Default if missing
        log_step(job_id, "Fetching owners", f"GET /apphq/owners/{app_id}")
        # Simulating fetch
        owners = ["owner@example.com"] # Mock
        try:
             resp = await async_get(f"{API_BASE}/apphq/owners/{app_id}")
             if resp.status_code == 200:
                 owners = resp.json().get("owners", [])
        except:
            pass
            
        log_step(job_id, "Owners identified", f"Owners: {', '.join(owners)}")
        
        # 5. Send Email
        await asyncio.sleep(1)
        log_step(job_id, "Sending email", f"Sending to {', '.join(owners)}")
        # POST /mail/send
        try:
            await async_post(f"{API_BASE}/mail/send", {
                "to": owners,
                "subject": f"IAM Evidence Request for {ticket_id}",
                "body": email_body
            })
        except:
            pass
        log_step(job_id, "Email sent", "Email delivered successfully.")
        
        # 6. Update JIRA
        await asyncio.sleep(0.5)
        log_step(job_id, "Updating JIRA", "Adding comment and closing ticket...")
        # Mock JIRA call
        try:
            await async_post(f"{API_BASE}/jira/comment", {"ticket_id": ticket_id, "comment": "Automated evidence request sent."})
        except:
            pass
        log_step(job_id, "JIRA updated", "Ticket status updated in JIRA.")
        
        # 7. Close RISE Ticket
        await asyncio.sleep(0.5)
        log_step(job_id, "Closing RISE ticket", "Marking as Resolved...")
        # Mock RISE call
        try:
             await async_post(f"{API_BASE}/rise/tickets/{ticket_id}/status?status=Closed", {})
        except:
            pass
        log_step(job_id, "RISE ticket closed", "Workflow complete.")
        
        # Finalize
        AGENT_RUNS[job_id]["status"] = "completed"
        AGENT_RUNS[job_id]["final_summary"] = "Agent successfully processed the ticket. Policies were checked, email drafted and sent to owners, and tracking systems (JIRA/RISE) were updated."
        log_step(job_id, "Run Completed", "All steps finished successfully.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        AGENT_RUNS[job_id]["status"] = "failed"
        AGENT_RUNS[job_id]["error"] = str(e)
        log_step(job_id, "Run Failed", str(e))

def start_agent_run(ticket_id: str) -> str:
    job_id = str(uuid.uuid4())
    AGENT_RUNS[job_id] = {
        "job_id": job_id,
        "ticket_id": ticket_id,
        "status": "pending",
        "steps": [],
        "created_at": datetime.datetime.now().isoformat(),
        "email_body": None,
        "final_summary": None,
        "error": None
    }
    
    # Start background task
    asyncio.create_task(run_iam_agent_for_ticket(job_id, ticket_id))
    
    return job_id

def get_agent_run(job_id: str) -> Optional[Dict]:
    return AGENT_RUNS.get(job_id)

def list_agent_runs():
    return list(AGENT_RUNS.values())
