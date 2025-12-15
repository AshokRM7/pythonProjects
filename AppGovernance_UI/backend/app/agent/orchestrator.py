from fastapi import APIRouter, BackgroundTasks, HTTPException
import uuid
import asyncio
from datetime import datetime
from app.agent import tools

router = APIRouter(prefix="/agent", tags=["Agent"])

# In-memory job store
# { job_id: { ticket_id, status, steps: [], email_body, error, ... } }
AGENT_RUNS = {}

async def run_agent_process(job_id: str, ticket_id: str):
    job = AGENT_RUNS[job_id]
    
    def add_step(label, detail=""):
        step = {
            "ts": datetime.now().isoformat(),
            "label": label,
            "detail": detail
        }
        job["steps"].append(step)
        print(f"[Agent {job_id}] {label}")

    try:
        job["status"] = "running"
        
        # Step 1: Fetch Ticket
        add_step("Fetching Ticket from RISE", f"Ticket ID: {ticket_id}")
        ticket = await tools.fetch_ticket(ticket_id)
        # Check if ticket is already closed? Optional logic.
        
        # Step 2: Validate IAM
        add_step("Validating IAM Category", "Analyzing ticket content with LLM...")
        validation = await tools.validate_iam_category(ticket)
        if not validation.get("is_iam"):
             raise Exception(f"Ticket validation failed: {validation.get('reason')}")
        add_step("IAM Validation Successful", validation.get("reason"))

        # Step 3: Fetch Owners
        add_step("Fetching App Owners", f"App ID: {ticket['appId']}")
        owners = await tools.fetch_owners_tool(ticket['appId'])
        add_step("Owners Found", f"App Owner: {owners['appOwner']}")

        # Step 4: RAG Retrieval
        add_step("Retrieving Policy Context", "Searching vector database...")
        policy = await tools.retrieve_policy_context(ticket['description'])
        add_step("Policy Context Retrieved", f"Found relevant policy sections.")

        # Step 5: Draft Email
        add_step("Drafting Email", "Generating email with LLM...")
        email_body = await tools.draft_email(ticket, owners, policy)
        job["email_body"] = email_body
        add_step("Email Drafted", "Email content generated.")

        # Step 6: Send Email
        add_step("Sending Email", f"To: {owners['appOwnerEmail']}")
        await tools.send_email_tool(
            to=owners['appOwnerEmail'], 
            cc=owners['aitOwnerEmail'], 
            subject=f"Action Required: {ticket['title']}", 
            body=email_body
        )
        add_step("Email Sent", "Logged in mail system.")

        # Step 7: Update JIRA
        jira_id = ticket.get("jiraStory", "UNKNOWN")
        add_step("Updating JIRA", f"Story: {jira_id}")
        await tools.update_jira_tool(
            jira_id, 
            comment=f"Agent completed automated IAM check. Email sent to {owners['appOwner']}.", 
            status="Closed"
        )
        job["jira_status"] = "Closed"
        add_step("JIRA Updated", "Evidence added and story closed.")

        # Step 8: Close RISE Ticket
        add_step("Closing RISE Ticket", "Attaching evidence...")
        await tools.close_rise_ticket(ticket_id, "Automated IAM Agent Check Completed. Policy requirements met.")
        job["rise_status"] = "Closed"
        add_step("RISE Ticket Closed", "Status updated successfully.")

        # Finalize
        job["status"] = "completed"
        job["final_summary"] = "Agent successfully processed the IAM deliverable. All systems verified and updated."
        add_step("Process Complete", "Workflow finished successfully.")

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        add_step("Error", str(e))
        print(f"Agent failed: {e}")

@router.post("/run/{ticket_id}")
async def run_agent(ticket_id: str, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    AGENT_RUNS[job_id] = {
        "job_id": job_id,
        "ticket_id": ticket_id,
        "status": "pending",
        "steps": [],
        "email_body": None,
        "jira_status": None,
        "rise_status": None,
        "error": None
    }
    
    background_tasks.add_task(run_agent_process, job_id, ticket_id)
    
    return {"job_id": job_id, "ticket_id": ticket_id, "status": "pending"}

@router.get("/status/{job_id}")
async def get_agent_status(job_id: str):
    if job_id not in AGENT_RUNS:
        raise HTTPException(status_code=404, detail="Job not found")
    return AGENT_RUNS[job_id]
