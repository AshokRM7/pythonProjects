import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import asyncio
import json
from backend.core.orchestrator import IAMOrchestrator
from backend.agents.arm_admin_remediation import ARMAdminRemediationAgent

from backend.core.logger_utils import AgentLogger, AgentTimer
from backend.models.ticket_context import Ticket, TicketResponse, Stage
from datetime import datetime
import time
from backend.pcat.api import router as pcat_router, init_pcat_api
from backend.bre.api import router as bre_router, init_bre_api, load_bre_tickets_into_store

from contextlib import asynccontextmanager

from pydantic import BaseModel

class PriorityUpdate(BaseModel):
    priority: str

class EmailRequest(BaseModel):
    to: List[str]
    subject: str
    body: str


class AdminUpdateRequest(BaseModel):
    primary_admin_name: Optional[str] = None
    primary_nbkid: Optional[str] = None
    secondary_admin_name: Optional[str] = None
    secondary_nbkid: Optional[str] = None


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed mock IAM DB
    from backend.iam_system.seed import ensure_seeded
    ensure_seeded()
    
    await load_initial_tickets()
    
    # Initialize PCAT API
    init_pcat_api(current_tickets, manager.broadcast)

    # Initialize BRE API (inject shared store + broadcast)
    init_bre_api(current_tickets, manager.broadcast)
    # Load BRE tickets from ticket_data.json into shared store
    load_bre_tickets_into_store()

    # Seed PCAT Demo Ticket
    if os.getenv("ENABLE_PCAT", "true").lower() == "true":
        seed_pcat_demo_ticket()
    yield

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Ticket Portal API", version="1.0.0", lifespan=lifespan)

# Mount screenshots directory for evidence preview
screenshots_dir = Path(__file__).resolve().parent / "bre" / "data" / "evidence" / "screenshots"
screenshots_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/screenshots", StaticFiles(directory=str(screenshots_dir)), name="screenshots")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PCAT Implementation
app.include_router(pcat_router)

# BRE Rule Certification
app.include_router(bre_router)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

# Global state
current_tickets: Dict[str, Any] = {}
orchestrator: Optional[IAMOrchestrator] = None
arm_admin_agent = ARMAdminRemediationAgent()

def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        api_key = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("⚠️ WARNING: Neither OPEN_ROUTER_KEY_ORIGINAL nor OPENAI_API_KEY found in environment variables")
        # Config file is now at root level
        # import os removed
        from pathlib import Path
        root_dir = Path(__file__).parent.parent
        config_path = root_dir / "config" / "config.json"
        orchestrator = IAMOrchestrator(api_key, config_file=str(config_path))
    return orchestrator

def convert_ticket_to_frontend(ticket: Ticket) -> dict:
    """Convert Pydantic Ticket model to frontend dictionary format"""
    raw_status = ticket.status.lower() if ticket.status else "not-started"
    # Status Defense: If we have progressed stages but status is still 'open' or 'not-started',
    # it means an agent clobbered the status. Promote to 'in-progress'.
    status = raw_status
    if (ticket.currentStage > 0 or any(s.status == 'completed' for s in (ticket.stages or []) if s.id > 1)) and raw_status in ["open", "not-started", "not started"]:
        status = "in-progress"

    return {
        "id": ticket.ticket_id,
        "title": ticket.description[:50] + "..." if len(ticket.description) > 50 else ticket.description,
        "description": ticket.description,
        "customer": ticket.application_owner or "Unknown",
        "priority": ticket.risk_level.lower() if ticket.risk_level else "medium",
        "status": status,
        "owner": ticket.owner,
        "createdAt": ticket.created_on,
        "currentStage": ticket.currentStage,
        "category": ticket.category,
        "subcategory": ticket.subcategory,
        "slaDeadline": ticket.sla_deadline,
        "aitNumber": ticket.ait_number,
        "deliverableType": ticket.deliverableType,
        "applicationName": ticket.application_name,
        "lobOwner": ticket.lob_owner,
        "aitOwner": ticket.ait_owner,
        "armId": ticket.arm_id,
        "contacts": ticket.contacts,
        "stages": [s.model_dump() for s in ticket.stages] if ticket.stages else [],
        # New Optional Fields
        "employeeId": ticket.employee_id,
        "userEmail": ticket.user_email,
        "targetSystem": ticket.target_system,
        "requestedAction": ticket.requested_action,
        # PCAT Specific
        "final_csv_ready": ticket.final_csv_ready,
        "final_csv_path": ticket.final_csv_path,
        "pcat_summary": ticket.pcat_summary,
        "ticket_type": ticket.ticket_type,
    }



def convert_frontend_to_ticket(data: dict) -> Ticket:
    """Convert frontend dictionary to Pydantic Ticket model"""
    return Ticket(
        ticket_id=data["id"],
        description=data["description"],
        application_owner=data["customer"],
        risk_level=data["priority"].upper(),
        created_on=data["createdAt"],
        category=data.get("category"),
        subcategory=data.get("subcategory"),
        sla_deadline=data.get("slaDeadline"),
        ait_number=data.get("aitNumber"),
        deliverableType=data.get("deliverableType", "IAM Category"),
        application_name=data.get("applicationName"),
        lob_owner=data.get("lobOwner"),
        ait_owner=data.get("aitOwner"),
        arm_id=data.get("armId"),
        contacts=data.get("contacts", []),
        status=data.get("status", "Open"),
        owner=data.get("owner", "Unassigned"),
        currentStage=data.get("currentStage", 0),
        stages=[Stage(**s) for s in data.get("stages", [])],
        employee_id=data.get("employeeId"),
        user_email=data.get("userEmail"),
        target_system=data.get("targetSystem"),
        requested_action=data.get("requestedAction"),
        final_csv_ready=data.get("final_csv_ready", False),
        final_csv_path=data.get("final_csv_path"),
        pcat_summary=data.get("pcat_summary"),
        ticket_type=data.get("ticket_type", "IAM")
    )

async def update_stage_progress(ticket_id: str, stage_index: int, status: str, message: str):
    """Update ticket stage progress and broadcast to WebSocket clients"""
    if ticket_id in current_tickets:
        current_tickets[ticket_id]["currentStage"] = stage_index
        current_tickets[ticket_id]["stages"][stage_index]["status"] = status
        current_tickets[ticket_id]["stages"][stage_index]["message"] = message
        
        if status == "in-progress":
            current_tickets[ticket_id]["status"] = "in-progress"
        elif status == "completed" and stage_index == 7:
            current_tickets[ticket_id]["status"] = "completed"
        elif status == "completed" and stage_index < 7:
            # Maintain in-progress if we haven't reached the final stage
            current_tickets[ticket_id]["status"] = "in-progress"
        
        await manager.broadcast({
            "type": "ticket_update",
            "ticket": current_tickets[ticket_id]
        })

async def process_individual_ticket(ticket_id: str):
    """Process a single ticket through the real agent pipeline"""
    try:
        if ticket_id not in current_tickets:
            return
        
        orch = get_orchestrator()
        ticket_data = current_tickets[ticket_id]
        current_stage = ticket_data["currentStage"]
        
        # Convert to Pydantic model for agents
        ticket_obj = convert_frontend_to_ticket(ticket_data)
        ticket_context = TicketResponse(tickets=[ticket_obj])
        
        AgentLogger.log_pipeline_start(ticket_id)
        
        await manager.broadcast({
            "type": "processing_start",
            "message": f"Processing ticket {ticket_id} with AI Agents..."
        })
        
        # Stage 1: Category Check
        if current_stage < 1:
            with AgentTimer("CategoryCheckerAgent", ticket_id, "Analyzing ticket category"):
                await update_stage_progress(ticket_id, 1, "in-progress", "Agent: Analyzing ticket category...")
                ticket_context.tickets = [ticket_obj]
                result = await asyncio.to_thread(orch.categorizer.invoke, ticket_context)
                if result.tickets:
                    ticket_obj = result.tickets[0]
                    current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                    AgentLogger.log_agent_success("CategoryCheckerAgent", 0, f"Validated IAM category: {ticket_obj.category}")
                else:
                    await update_stage_progress(ticket_id, 1, "error", "Category Check Agent: Not an IAM ticket - processing stopped.")
                    AgentLogger.log_agent_error("CategoryCheckerAgent", "Not an IAM ticket")
                    return
            current_stage = 1
            
        # Stage 2: SLA Prioritization
        if current_stage < 2:
            with AgentTimer("SLAPrioritizerAgent", ticket_id, "Calculating SLA & Risk"):
                await update_stage_progress(ticket_id, 2, "in-progress", "SLA Prioritization Agent: Calculating SLA & Risk...")
                ticket_context.tickets = [ticket_obj]
                result = await asyncio.to_thread(orch.sla.invoke, ticket_context)
                if result.tickets:
                    ticket_obj = result.tickets[0]
                    current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                    AgentLogger.log_agent_success("SLAPrioritizerAgent", 0, f"Priority set to {ticket_obj.risk_level}")
            current_stage = 2
            
            # Checkpoint: Priority Confirmation
            current_tickets[ticket_id]["waitingForPriorityConfirmation"] = True
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            return
            
        # Stage 3: Ownership Enrichment
        if current_stage < 3:
            with AgentTimer("AppHQResolverAgent", ticket_id, "Fetching ownership data"):
                await update_stage_progress(ticket_id, 3, "in-progress", "Ownership Enrichment Agent: Fetching ownership data...")
                ticket_context.tickets = [ticket_obj]
                result = await asyncio.to_thread(orch.ownership.invoke, ticket_context)
                if result.tickets:
                    ticket_obj = result.tickets[0]
                    current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                    AgentLogger.log_agent_success("AppHQResolverAgent", 0, f"Fetched owner: {ticket_obj.application_owner}")
            current_stage = 3
            
        # Stage 4: App Owner Check
        if current_stage < 4:
            with AgentTimer("AppOwnerCheckerAgent", ticket_id, "Verifying app owner space"):
                await update_stage_progress(ticket_id, 4, "in-progress", "App Owner Check Agent: Verifying app owner space...")
                ticket_context.tickets = [ticket_obj]
                result = await asyncio.to_thread(orch.app_space_checker.invoke, ticket_context)
                if result.tickets:
                    ticket_obj = result.tickets[0]
                    current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                    AgentLogger.log_agent_success("AppOwnerCheckerAgent", 0, "App owner space verified")
            current_stage = 4
            
        # Stage 5: IAM Remediation (routes based on subcategory)
        if current_stage < 5:
            is_arm_no_admin = (
                ticket_data.get("subcategory", "") == "ARM FORMS NO ADMIN" or
                ticket_data.get("deliverableType", "") == "ARM FORMS NO ADMIN"
            )
            
            if is_arm_no_admin:
                # ARM FORMS NO ADMIN: Use ARM Admin Remediation Agent
                with AgentTimer("ARMAdminRemediationAgent", ticket_id, "Checking ARM Admin Details"):
                    await update_stage_progress(ticket_id, 5, "in-progress", "ARM Admin Remediation Agent: Checking admin details...")
                    ticket_context.tickets = [ticket_obj]
                    result = await asyncio.to_thread(arm_admin_agent.invoke, ticket_context)
                    if result.tickets:
                        ticket_obj = result.tickets[0]
                        current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                        
                        # Check if waiting for admin input or policy violation
                        rem_stage = next((s for s in ticket_obj.stages if "IAM Remediation" in s.name), None)
                        is_waiting = any(x in (rem_stage.message or "") for x in ["WAITING_FOR_ADMIN_INPUT", "POLICY VIOLATION", "ALERT"])
                        
                        if rem_stage and rem_stage.status == "in-progress" and is_waiting:
                            current_tickets[ticket_id]["waitingForAdminUpdate"] = True
                            AgentLogger.log_agent_success("ARMAdminRemediationAgent", 0, "Policy violation or missing details, waiting for user input")
                            await manager.broadcast({
                                "type": "ticket_update",
                                "ticket": current_tickets[ticket_id]
                            })
                            return
                        
                        AgentLogger.log_agent_success("ARMAdminRemediationAgent", 0, "ARM Admin check completed")
                current_stage = 5
            else:
                # Standard IAM Remediation
                with AgentTimer("IAMRemediationAgent", ticket_id, "Executing IAM Remediation"):
                    await update_stage_progress(ticket_id, 5, "in-progress", "IAM Remediation Agent: Executing remediation journey...")
                    ticket_context.tickets = [ticket_obj]
                    result = await asyncio.to_thread(orch.remediation.invoke, ticket_context)
                    if result.tickets:
                        ticket_obj = result.tickets[0]
                        current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                        AgentLogger.log_agent_success("IAMRemediationAgent", 0, "Remediation journey completed")
                current_stage = 5

        # Stage 6: Evidence Collection (Pause)
        if current_stage < 6:
            with AgentTimer("EvidenceCollectorAgent", ticket_id, "Preparing evidence emails"):
                await update_stage_progress(ticket_id, 6, "in-progress", "Evidence Collection Agent: Preparing evidence emails...")
                ticket_context.tickets = [ticket_obj]
                await asyncio.to_thread(orch.evidence.invoke, ticket_context)
                
                current_tickets[ticket_id]["waitingForReview"] = True
                await update_stage_progress(ticket_id, 6, "in-progress", "Evidence Collection Agent: Waiting for application team review...")
                AgentLogger.log_agent_success("EvidenceCollectorAgent", 0, "Evidence collected, waiting for review")
            
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            return
            
        # Stage 7: Ticket Closure (Pause)
        stage_7_status = current_tickets[ticket_id]["stages"][7]["status"]
        if current_stage < 7 or (current_stage == 7 and stage_7_status != "completed"):
            if not current_tickets[ticket_id].get("closure_approved", False):
                await update_stage_progress(ticket_id, 7, "in-progress", "Ticket Closure Agent: Preparing for closure...")
                current_tickets[ticket_id]["waitingForClosureConfirmation"] = True
                await update_stage_progress(ticket_id, 7, "in-progress", "Ticket Closure Agent: Waiting for final closure confirmation...")
                
                await manager.broadcast({
                    "type": "ticket_update",
                    "ticket": current_tickets[ticket_id]
                })
                return
            
            with AgentTimer("CloserAgent", ticket_id, "Closing ticket"):
                await update_stage_progress(ticket_id, 7, "in-progress", "Ticket Closure Agent: Closing ticket...")
                ticket_context.tickets = [ticket_obj]
                result = await asyncio.to_thread(orch.closer.invoke, ticket_context)
                if result.tickets:
                    ticket_obj = result.tickets[0]
                    current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                    AgentLogger.log_agent_success("CloserAgent", 0, "Ticket closed successfully")
            current_stage = 7
            
        # Stage 8: Logging
        if current_stage < 8:
            with AgentTimer("LoggerAgent", ticket_id, "Logging results"):
                await update_stage_progress(ticket_id, 8, "in-progress", "Logging Agent: Logging results to audit trail...")
                ticket_context.tickets = [ticket_obj]
                # Logger return value is a dict, not TicketResponse
                await asyncio.to_thread(orch.logger.invoke, ticket_context)
                # ticket_obj is updated in place
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
                AgentLogger.log_agent_success("LoggerAgent", 0, "Execution results logged to audit trail")
            current_stage = 8
            
        AgentLogger.log_pipeline_end(ticket_id)
        
        await manager.broadcast({
            "type": "processing_complete",
            "message": f"Ticket {ticket_id} processed successfully",
            "ticket": current_tickets[ticket_id]
        })


    except Exception as e:
        AgentLogger.log_agent_error("Pipeline", str(e))
        AgentLogger.log_pipeline_end(ticket_id, status="Error")
        print(f"Error processing ticket {ticket_id}: {e}")
        await manager.broadcast({
            "type": "error",
            "message": f"Error processing ticket: {str(e)}"
        })

async def load_initial_tickets():
    """Load tickets using the TicketFetcherAgent"""
    try:
        print("Fetching initial tickets...")
        orch = get_orchestrator()
        
        # Stage 1: Fetch tickets (non-blocking)
        tickets_response = await asyncio.to_thread(orch.fetcher.invoke)
        
        if tickets_response.tickets:
            for ticket in tickets_response.tickets:
                frontend_ticket = convert_ticket_to_frontend(ticket)
                # Mark first stage as completed
                frontend_ticket["stages"][0]["status"] = "completed"
                frontend_ticket["stages"][0]["message"] = "Ticket fetched successfully"
                current_tickets[frontend_ticket["id"]] = frontend_ticket
            print(f"Loaded {len(current_tickets)} tickets")
        else:
            print("No tickets found")
            
    except Exception as e:
        AgentLogger.log_agent_error("TicketFetcher", str(e))
        print(f"Error loading initial tickets: {e}")


def seed_pcat_demo_ticket():
    pcat_stages = [
        {"id": 0, "name": "PCAT Intake Agent", "status": "pending", "message": ""},
        {"id": 1, "name": "Schema & Required Fields Agent", "status": "pending", "message": ""},
        {"id": 2, "name": "Validation Lists Check Agent", "status": "pending", "message": ""},
        {"id": 3, "name": "Rules Engine Agent", "status": "pending", "message": ""},
        {"id": 4, "name": "Conflict Detection Agent", "status": "pending", "message": ""},
        {"id": 5, "name": "Recommendations Agent", "status": "pending", "message": ""},
        {"id": 6, "name": "Evidence Pack Generation Agent", "status": "pending", "message": ""},
        {"id": 7, "name": "Auto-Fix & Rebuild CSV Agent", "status": "pending", "message": ""},
        {"id": 8, "name": "Upload to PCAT & RISE Agent", "status": "pending", "message": ""},
    ]

    pcat_configs = [
        {
            "id": "PCAT-7001",
            "title": "Quarterly Metadata Validation - ERP & CRM",
            "subcategory": "PCAT",
            "ait": "AIT-7001"
        },
        {
            "id": "EQ-7002",
            "title": "EQ Validation - Financial Systems",
            "subcategory": "EQ",
            "ait": "AIT-7002"
        },
        {
            "id": "PCAT-QUARANTINE-7003",
            "title": "Quarantine Review - Access Control",
            "subcategory": "PCAT-QUARANTINE",
            "ait": "AIT-7003"
        },
        {
            "id": "PCAT-DUPLICATE-7004",
            "title": "Duplicate Account Cleanup - Global Directory",
            "subcategory": "PCAT-DUPLICATE",
            "ait": "AIT-7004"
        }
    ]

    for config in pcat_configs:
        ticket_id = config["id"]
        if ticket_id not in current_tickets:
            current_tickets[ticket_id] = {
                "id": ticket_id,
                "title": config["title"],
                "description": f"Validation for {config['subcategory']} structures.",
                "customer": "compliance.owner@company.com",
                "priority": "high",
                "status": "Open",
                "owner": "Compliance Team",
                "createdAt": datetime.now().strftime("%Y-%m-%d"),
                "currentStage": 0,
                "category": "IAM",
                "subcategory": config["subcategory"],
                "ticket_type": "PCAT",
                "aitNumber": config["ait"],
                "deliverableType": f"{config['subcategory']} Validation",
                "applicationName": "Compliance Systems",
                "pcat_csv_path": "backend/data/pcat/pcat_ticket_PCAT-7001.csv",
                "stages": [s.copy() for s in pcat_stages],
                "final_csv_ready": False,
                "final_csv_path": None
            }
            print(f"Seeded PCAT-type Ticket: {ticket_id}")

@app.get("/api/pcat/demo/reset")
async def reset_pcat_demo():
    """Reset PCAT-7001 ticket to initial state for demo"""
    seed_pcat_demo_ticket()
    ticket_id = "PCAT-7001"
    if ticket_id in current_tickets:
        ticket = current_tickets[ticket_id]
        ticket["status"] = "Open"
        ticket["currentStage"] = 0
        for stage in ticket["stages"]:
            stage["status"] = "pending"
            stage["message"] = ""
        ticket["pcat_summary"] = None
        ticket["final_csv_ready"] = False
        ticket["final_csv_path"] = None
        
        # Optionally clean up reports
        import shutil
        report_dir = f"backend/data/pcat/runs/{ticket_id}"
        if os.path.exists(report_dir):
            shutil.rmtree(report_dir)
            os.makedirs(report_dir, exist_ok=True)
            
        await manager.broadcast({
            "type": "ticket_update",
            "ticket": ticket
        })
    return {"status": "success", "message": "PCAT Demo Reset"}

@app.get("/")
async def root():
    return {"status": "ok", "message": "Ticket Portal API (Real Agents)"}

@app.get("/api/tickets")
async def get_tickets():
    return JSONResponse(content={
        "tickets": list(current_tickets.values()),
        "count": len(current_tickets)
    })

@app.get("/api/tickets/iam")
async def get_iam_tickets():
    """Get only IAM category tickets"""
    iam_tickets = [t for t in current_tickets.values() if t.get("category", "").upper() == "IAM"]
    return JSONResponse(content={
        "tickets": iam_tickets,
        "count": len(iam_tickets)
    })

@app.get("/api/iam/access/{employee_id}")
async def get_iam_access(employee_id: str):
    """Get mock IAM access for a user"""
    from backend.iam_system import service
    return service.get_access(employee_id)

@app.get("/api/iam/audit/{ticket_id}")
async def get_iam_audit(ticket_id: str):
    """Get mock IAM audit logs for a ticket"""
    from backend.iam_system import service
    logs = service.get_audit_logs(ticket_id)
    return {"ticket_id": ticket_id, "logs": logs}

@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    if ticket_id in current_tickets:
        return JSONResponse(content=current_tickets[ticket_id])
    return JSONResponse(status_code=404, content={"error": "Ticket not found"})

@app.post("/api/tickets/{ticket_id}/process")
async def process_single_ticket(ticket_id: str):
    asyncio.create_task(process_individual_ticket(ticket_id))
    return JSONResponse(content={"status": "success", "message": "Processing started"})

@app.post("/api/tickets/{ticket_id}/confirm-priority")
async def confirm_priority(ticket_id: str, update: PriorityUpdate = None):
    """Confirm priority/risk and continue processing"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Idempotency check: If already confirmed (stage > 2 or waiting flag cleared), return success
        if not ticket.get("waitingForPriorityConfirmation", False):
            # Check if we already moved past this validation
            if ticket.get("currentStage", 0) >= 2:
                 return JSONResponse(content={"status": "success", "message": "Priority already confirmed"})
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for priority confirmation"})
        
        # Update priority if provided
        if update and update.priority:
            current_tickets[ticket_id]["priority"] = update.priority.lower()
            current_tickets[ticket_id]["risk_level"] = update.priority.upper()
            ticket["priority"] = update.priority.lower()
            ticket["risk_level"] = update.priority.upper()

        # Mark confirmation as completed
        current_tickets[ticket_id]["waitingForPriorityConfirmation"] = False
        
        confirmed_risk = ticket.get('risk_level', 'MEDIUM')
        await update_stage_progress(ticket_id, 2, "completed", f"✅ Risk Confirmed: {confirmed_risk}")
        
        # Continue processing from stage 3
        asyncio.create_task(process_individual_ticket(ticket_id))
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Priority confirmed for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ─── ARM Admin Details Endpoints ───

@app.get("/api/admin-details/{ait_number}")
async def get_admin_details(ait_number: str):
    """Get admin details for a given AIT number."""
    entry = arm_admin_agent.get_admin_for_ait(ait_number)
    if not entry:
        return JSONResponse(status_code=404, content={"error": f"No admin details found for {ait_number}"})
    return JSONResponse(content=entry)


@app.post("/api/admin-details/{ait_number}/update")
async def update_admin_details(ait_number: str, req: AdminUpdateRequest):
    """Update admin names for an AIT. Returns action type (NEW/MODIFY) and any warnings."""
    result = arm_admin_agent.update_admin_names(
        ait_number,
        primary_name=req.primary_admin_name or None,
        primary_nbkid=req.primary_nbkid or None,
        secondary_name=req.secondary_admin_name or None,
        secondary_nbkid=req.secondary_nbkid or None
    )
    return JSONResponse(content=result)


# Globally track simulation stages for the demo
simulation_stages = {} # ait -> attempt_count

@app.post("/api/admin-details/{ait_number}/simulate-response")
async def simulate_admin_response(ait_number: str):
    """Simulates multi-stage App Owner responses for demo purposes."""
    try:
        attempt = simulation_stages.get(ait_number, 0)
        
        # Scenario Configuration
        if ait_number == "AIT-5001":
            if attempt == 0:
                # Scenario 1: Policy Violation (Owner as Admin)
                data = {
                    "primary_admin_name": "Abid Shaikh", # Application Owner
                    "primary_nbkid": "NBK1010",
                    "secondary_admin_name": "John Michael",
                    "secondary_nbkid": "NBK2020"
                }
                simulation_stages[ait_number] = 1
                msg = "⚠️ [POLICY] App Owner provided their own name as admin."
            else:
                # Stage 2: Success (NEW names)
                data = {
                    "primary_admin_name": "Saravanan", 
                    "primary_nbkid": "ID88888",
                    "secondary_admin_name": "Rajesh Kumar",
                    "secondary_nbkid": "ID77777"
                }
                simulation_stages[ait_number] = 0 # Reset for next demo loop
                msg = "✅ [SUCCESS] App Owner provided valid new admin names."
        
        elif ait_number == "AIT-5002":
            # Scenario 2: Pure NEW (Directly providing names never seen before)
            data = {
                "primary_admin_name": "Ganesh Murthy",
                "primary_nbkid": "ID99001",
                "secondary_admin_name": "Vikram Singh",
                "secondary_nbkid": "ID99002"
            }
            msg = "✅ [NEW] App Owner provided new admin names for this asset."
            
        elif ait_number == "AIT-5003":
            # Scenario 3: Intelligent MODIFY (Providing a name that exists in another AIT)
            # 'Ganesh Murthy' exists in AIT-5002.
            data = {
                "primary_admin_name": "Ganesh Murthy", # Already exists in AIT-5002
                "primary_nbkid": "ID99001",
                "secondary_admin_name": "Suresh Raina",
                "secondary_nbkid": "ID00202"
            }
            msg = "✅ [MODIFY] App Owner provided names. Validation detected existing roles in AIT-5002."
        
        else:
            data = {
                "primary_admin_name": "Magesh",
                "primary_nbkid": "ID00101",
                "secondary_admin_name": "Suresh",
                "secondary_nbkid": "ID00202"
            }
            msg = "✅ [SUCCESS] Mock response received."

        result = arm_admin_agent.update_admin_names(
            ait_number,
            primary_name=data["primary_admin_name"],
            primary_nbkid=data["primary_nbkid"],
            secondary_name=data["secondary_admin_name"],
            secondary_nbkid=data["secondary_nbkid"]
        )
        
        # Add the custom message to the result for the frontend toast
        if result and isinstance(result, dict):
            result["simulation_message"] = msg
            # Also update the locally cached ticket state if needed
            print(f"DEBUG: Simulation successful for {ait_number}: {msg}")
            return JSONResponse(content=result)
        else:
            print(f"ERROR: Simulation failed - result not a dict for {ait_number}")
            return JSONResponse(status_code=500, content={"error": "Invalid result from agent"})
    except Exception as e:
        print(f"CRITICAL ERROR in simulation: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/confirm-admin-update")
async def confirm_admin_update(ticket_id: str):
    """Confirm admin update and continue the pipeline past Stage 5."""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})

        ticket = current_tickets[ticket_id]

        if not ticket.get("waitingForAdminUpdate", False):
            if ticket.get("currentStage", 0) >= 5:
                return JSONResponse(content={"status": "success", "message": "Admin update already confirmed"})
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for admin update"})

        # Clear the waiting flag
        current_tickets[ticket_id]["waitingForAdminUpdate"] = False

        # Re-invoke the agent with the updated data to get the SUCCESS message and NEW/MODIFY determination
        ticket_obj = convert_frontend_to_ticket(ticket)
        ticket_context = TicketResponse(tickets=[ticket_obj])
        result = arm_admin_agent.invoke(ticket_context)
        
        if result.tickets:
            ticket_obj = result.tickets[0]
            current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            
            # Fetch the final message from the agent
            rem_stage = next((s for s in ticket_obj.stages if "IAM Remediation" in s.name), None)
            if rem_stage:
                await update_stage_progress(ticket_id, 5, rem_stage.status, rem_stage.message)

        # Continue processing from stage 6
        asyncio.create_task(process_individual_ticket(ticket_id))

        return JSONResponse(content={
            "status": "success",
            "message": f"Admin update confirmed for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/reset-admin")
async def reset_admin_ticket(ticket_id: str):
    """Reset ARM Admin ticket and data to baseline state"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Safety Check: Only allow reset for ARM tickets
        is_arm_admin = (
            ticket.get("subcategory") == "ARM FORMS NO ADMIN" or 
            ticket.get("deliverableType") == "ARM FORMS NO ADMIN"
        )
        if not is_arm_admin:
            return JSONResponse(status_code=400, content={"error": "Reset only supported for ARM Admin tickets"})

        ait_number = ticket.get("aitNumber") or ticket.get("ait_number")
        
        # Reset simulation stage for this AIT
        if ait_number in simulation_stages:
            simulation_stages[ait_number] = 0
        
        # 1. Reset admin data in internal database
        if ait_number:
            admin_list = arm_admin_agent.load_admin_details()
            updated = False
            for entry in admin_list:
                if entry["ait_number"] == ait_number:
                    if ait_number == "AIT-5001":
                        entry["primary_admin_name"] = ""
                        entry["primary_nbkid"] = ""
                        entry["secondary_admin_name"] = ""
                        entry["secondary_nbkid"] = ""
                        updated = True
                    elif ait_number == "AIT-5002":
                        entry["primary_admin_name"] = ""
                        entry["primary_nbkid"] = ""
                        entry["secondary_admin_name"] = ""
                        entry["secondary_nbkid"] = ""
                        updated = True
                    elif ait_number == "AIT-5003":
                        entry["primary_admin_name"] = ""
                        entry["primary_nbkid"] = ""
                        entry["secondary_admin_name"] = ""
                        entry["secondary_nbkid"] = ""
                        updated = True
            
            if updated:
                arm_admin_agent.save_admin_details(admin_list)

        # 2. Reset ticket state
        ticket["status"] = "Open"
        ticket["currentStage"] = 0
        ticket["waitingForAdminUpdate"] = False
        ticket["waitingForReview"] = False
        ticket["waitingForPriorityConfirmation"] = False
        ticket["waitingForClosureConfirmation"] = False
        # Restore basic contacts if it's an ARM ticket
        if ait_number == "AIT-5001":
            ticket["contacts"] = ["abidshaikh@example.com"]
        elif ait_number == "AIT-5002":
            ticket["contacts"] = ["johnwreck@example.com"]
        elif ait_number == "AIT-5003":
            ticket["contacts"] = ["johnmichael@example.com"]
        else:
            ticket["contacts"] = []
        
        for idx, stage in enumerate(ticket["stages"]):
            if idx == 0:
                stage["status"] = "completed"
                stage["message"] = "Ticket fetched successfully"
            else:
                stage["status"] = "pending"
                stage["message"] = ""
            
        await manager.broadcast({
            "type": "ticket_update",
            "ticket": ticket
        })
        
        return JSONResponse(content={"status": "success", "message": f"Ticket {ticket_id} and admin data reset to baseline"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/confirm-closure")
async def confirm_closure(ticket_id: str):
    """Confirm closure and complete processing"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Idempotency check
        if not ticket.get("waitingForClosureConfirmation", False):
            if ticket.get("closure_approved", False) or ticket.get("currentStage", 0) >= 6:
                return JSONResponse(content={"status": "success", "message": "Closure already confirmed"})
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for closure confirmation"})
        
        # Mark confirmation as completed and approve closure
        current_tickets[ticket_id]["waitingForClosureConfirmation"] = False
        current_tickets[ticket_id]["closure_approved"] = True
        await update_stage_progress(ticket_id, 7, "in-progress", "✅ Closure Confirmed - Finalizing...")
        
        # Continue processing (will now enter the closure block)
        asyncio.create_task(process_individual_ticket(ticket_id))

        
        return JSONResponse(content={
            "status": "success",
            "message": f"Closure confirmed for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/approve-review")
async def approve_review(ticket_id: str):
    """Approve email review and continue"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Idempotency check
        if not ticket.get("waitingForReview", False):
            if ticket.get("currentStage", 0) > 6:
                 return JSONResponse(content={"status": "success", "message": "Review already approved"})

            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for review"})
        
        # Mark review as completed
        current_tickets[ticket_id]["waitingForReview"] = False
        await update_stage_progress(ticket_id, 6, "completed", "✅ Review approved - Evidence verified")
        
        # Continue processing from Stage 7
        asyncio.create_task(process_individual_ticket(ticket_id))

        
        return JSONResponse(content={
            "status": "success",
            "message": f"Review approved for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/send-email")
async def send_ticket_email(ticket_id: str, email_req: EmailRequest):
    """Send real or simulated email and update ticket stage"""
    try:
        if ticket_id not in current_tickets:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")

        from backend.services.email_service import send_email
        result = send_email(email_req.to, email_req.subject, email_req.body)

        status = "completed" if (result.get("sent") or result.get("mode") == "simulated") else "failed"
        
        timestamp = result.get("timestamp", datetime.now().isoformat())
        recipients = ", ".join(result.get("recipients", email_req.to))
        mode = result.get("mode", "smtp")
        
        if status == "completed":
            msg = f"✅ Email sent successfully ({mode})\nRecipients: {recipients}"
            msg += f"\nTimestamp: {timestamp}"
        else:
            msg = f"❌ Email failed: {result.get('error', 'Unknown error')}"

        # Update stage 6: Evidence Collection (index 6)
        await update_stage_progress(ticket_id, 6, status, msg)
        
        # If successful, also handle the "approve-review" logic to move pipeline forward
        if status == "completed":
            current_tickets[ticket_id]["waitingForReview"] = False
            # The update_stage_progress already broadcasts the update
            # We trigger the next stage
            asyncio.create_task(process_individual_ticket(ticket_id))

        return JSONResponse(content={
            "status": "success" if status == "completed" else "error",
            "sent": result.get("sent", False),
            "mode": mode,
            "message": msg,
            "ticket": current_tickets[ticket_id]
        })

    except Exception as e:
        print(f"Error in send-email: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "initial_state",
            "tickets": list(current_tickets.values())
        })
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    print("="*60)
    print("Starting Ticket Portal API with REAL AGENTS")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
