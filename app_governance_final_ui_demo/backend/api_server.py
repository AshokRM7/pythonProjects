import os
import sys
import asyncio
import json
import time
import shutil
import traceback
import uvicorn
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable, Awaitable
from contextlib import asynccontextmanager

# Add the project root to sys.path to help IDEs and runtime resolve 'backend' package
root_path = str(Path(__file__).resolve().parent.parent)
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Internal imports
from backend.core.orchestrator import IAMOrchestrator
from backend.agents.arm_admin_remediation import ARMAdminRemediationAgent
from backend.services.inbox_reader import (
    read_inbox_for_ticket,
    parse_admin_names_from_body,
    is_closure_affirmation
)
from backend.services.email_service import send_email
from backend.iam_system.seed import ensure_seeded
from backend.core.logger_utils import AgentLogger, AgentTimer
from backend.models.ticket_context import Ticket, TicketResponse, Stage
from backend.pcat.api import router as pcat_router, init_pcat_api
from backend.bre.api import router as bre_router, init_bre_api, load_bre_tickets_into_store

# Email Handlers
from backend.email_handlers.pcat_handler import handle_pcat_reply
from backend.email_handlers.bre_handler import handle_bre_reply
from backend.email_handlers.arm_handler import handle_arm_reply
from backend.models.ticket_mapper import convert_ticket_to_frontend, convert_frontend_to_ticket

# Load environment variables
load_dotenv()


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

class SimulationRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    sender: Optional[str] = None

# Mock inbox for simulation mode
mock_inbox: Dict[str, List[Dict[str, Any]]] = {} # key: ticket_id/ait_number



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
active_polls: dict = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed mock IAM DB
    ensure_seeded()
    
    await load_initial_tickets()
    
    # Initialize PCAT API (inject active_polls + poll function to avoid circular imports)
    init_pcat_api(current_tickets, manager.broadcast, active_polls, poll_inbox_for_reply)

    # Initialize BRE API (inject shared store + broadcast + poll function)
    init_bre_api(current_tickets, manager.broadcast, poll_inbox_for_reply)
    # Load BRE tickets from ticket_data.json into shared store
    load_bre_tickets_into_store()

    # Seed PCAT Demo Ticket
    if os.getenv("ENABLE_PCAT", "true").lower() == "true":
        seed_pcat_demo_ticket()
    yield


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

def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        api_key = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("⚠️ WARNING: Neither OPEN_ROUTER_KEY_ORIGINAL nor OPENAI_API_KEY found in environment variables")
        # Config file is now at root level
        # import os removed
        root_dir = Path(__file__).parent.parent
        config_path = root_dir / "config" / "config.json"
        orchestrator = IAMOrchestrator(api_key, config_file=str(config_path))
    return orchestrator


def save_tickets_to_disk():
    """Save the memory current_tickets back to the JSON file for persistence"""
    try:
        data_file = Path(__file__).parent.parent / "data" / "ticket_data.json"
        
        # Convert frontend dicts back to Pydantic models/JSON for consistency
        ticket_list = []
        for t_id, t_data in current_tickets.items():
             # Use the raw dict but ensure nested models are serializable
             ticket_obj = convert_frontend_to_ticket(t_data)
             # Use model_dump to get a clean JSON-serializable dict
             ticket_list.append(ticket_obj.model_dump())
        
        with open(data_file, "w") as f:
            json.dump(ticket_list, f, indent=2)
        print(f"INFO: Successfully persisted {len(ticket_list)} tickets to disk.")
    except Exception as e:
        print(f"ERROR persisting tickets to disk: {e}")

async def update_stage_progress(ticket_id: str, stage_index: int, status: str, message: str):
    """Update ticket stage progress and broadcast to WebSocket clients"""
    if ticket_id in current_tickets:
        current_tickets[ticket_id]["currentStage"] = stage_index
        current_tickets[ticket_id]["stages"][stage_index]["status"] = status
        current_tickets[ticket_id]["stages"][stage_index]["message"] = message
        # Update main ticket status based on stage progress
        current_status = current_tickets[ticket_id].get("status", "").lower()
        
        if status == "in-progress":
            # Only promote to generic 'in-progress' if it's not already something more specific
            if current_status not in ["waiting for app owner", "waiting for review", "review rejected"]:
                current_tickets[ticket_id]["status"] = "in-progress"
        elif status == "completed" and stage_index == 7:
            current_tickets[ticket_id]["status"] = "completed"
        elif status == "completed" and stage_index < 7:
            # Maintain the specific waiting status if it was set
            if current_status not in ["waiting for app owner", "waiting for review"]:
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
        stage_5_status = current_tickets[ticket_id]["stages"][5]["status"]
        if current_stage < 5 or (current_stage == 5 and stage_5_status != "completed"):
            is_arm_no_admin = (
                "ARM FORM" in str(ticket_data.get("subcategory", "")).upper() or
                "ARM FORM" in str(ticket_data.get("deliverableType", "")).upper()
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
        stage_6_status = current_tickets[ticket_id]["stages"][6]["status"]
        if current_stage < 6 or (current_stage == 6 and stage_6_status != "completed"):
            # Check if we should auto-send or wait for review
            # For now, we always pause for review as per requirement
            if not current_tickets[ticket_id].get("waitingForReview", False):
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
            else:
                # Already waiting for review/email sending
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
        stage_8_status = current_tickets[ticket_id]["stages"][8]["status"]
        if current_stage < 8 or (current_stage == 8 and stage_8_status != "completed"):
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
        else:
            # Ensure pcat_csv_path is always set (may be lost during save/load)
            if not current_tickets[ticket_id].get("pcat_csv_path"):
                current_tickets[ticket_id]["pcat_csv_path"] = "backend/data/pcat/pcat_ticket_PCAT-7001.csv"

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
        # import shutil moved to top
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
        
        # Persist change
        save_tickets_to_disk()
        
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
async def simulate_admin_response(ait_number: str, req: Optional[SimulationRequest] = None):
    """Simulates multi-stage App Owner responses for demo purposes."""
    try:
        # ─── PCAT Simulation Logic ───
        # If a custom body/subject is provided, we treat it as a mock email for ANY ticket
        if req and (req.body or req.subject):
            mock_email = {
                "Id": f"mock-{int(time.time()*1000)}",
                "Subject": req.subject or f"Re: Simulation {ait_number}",
                "Body": req.body or "",
                "SenderEmail": req.sender or "velmuruganpandian@outlook.com",
                "ReceivedTime": datetime.now().isoformat()
            }
            if ait_number not in mock_inbox: mock_inbox[ait_number] = []
            mock_inbox[ait_number].append(mock_email)
            print(f"DEBUG: Mock email added to inbox for {ait_number}: {req.body[:50]}...")
            return JSONResponse(content={"status": "success", "message": "Mock email added to simulation inbox."})

        # ─── Legacy ARM Simulation Logic ───
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

# ─── Outlook Inbox Polling ────────────────────────────────────────────────────

# Tracks which (ticket_id, ait_number) pairs currently have a live poll running.
# key: ait_number  value: ticket_id

async def poll_inbox_for_reply(ticket_id: str, ait_number: str, max_wait_mins: int = 30):
    """
    Background coroutine: polls the Outlook Inbox every 30 seconds looking for
    an email whose subject contains both the ticket_id and/or ait_number.
    When a matching reply is found, admin names are parsed from the body,
    pushed into the ARM Admin database, and broadcast to the UI via WebSocket.
    """
    sending_enabled = os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true"
    # Even if sending is disabled, we allow polling the MOCK inbox for simulation
    
    poll_interval: int = 5 if not sending_enabled else 30   # Faster polling in simulation mode
    max_polls: int = (max_wait_mins * 60) // poll_interval
    attempts: int = 0

    print(f"INFO: Starting Outlook inbox poll for ticket={ticket_id}, ait={ait_number} (max {max_wait_mins} min)")

    SYSTEM_SUBJECTS = [
        "Action Required",
        "Clarification Required",
        "Acknowledgment: Delay",
        "Follow-up",
        "Evidence Required"
    ]

    # --- Persist Polling State ---
    if ticket_id in current_tickets:
        current_tickets[ticket_id]["isPollingActive"] = True
        save_tickets_to_disk()
        await manager.broadcast({
            "type": "ticket_update",
            "ticket": current_tickets[ticket_id]
        })

    try:
        while attempts < max_polls and ait_number in active_polls:
            try:
                await asyncio.sleep(poll_interval)
                attempts += 1

                # ─── Mock Inbox Logic (For simulation) ───
                mock_emails: List[Dict[str, Any]] = []
                if not sending_enabled:
                    mock_emails = mock_inbox.get(ticket_id, []) + mock_inbox.get(ait_number, [])
                    # Clear mock inbox after reading? No, let the seen_ids logic handle it
                
                real_emails_id: List[Dict[str, Any]] = read_inbox_for_ticket(ticket_id, max_emails=50) if sending_enabled else []
                real_emails_ait: List[Dict[str, Any]] = read_inbox_for_ticket(ait_number, max_emails=50) if sending_enabled else []
                
                # Combine, avoiding duplicates by Id
                seen_ids = set()
                emails = []
                for e in mock_emails + real_emails_id + real_emails_ait:
                    e_id = e.get("Id")
                    if not e_id or e_id in seen_ids:
                        continue
                    seen_ids.add(e_id)
                    
                    subj = str(e.get("Subject", "") or "").strip().lower()
                    subj_full = str(e.get("Subject", "") or "")
                    body_temp = str(e.get("Body", "") or "")
                    
                    # ── CRITICAL: Skip automated system emails BUT allow user REPLIES ──
                    system_subjects = ["action required", "clarification required", "acknowledgment", "[arm governance]", "access required"]
                    is_system_subj = any(s in subj for s in system_subjects)
                    
                    # If it's a system subject and NOT a reply (doesn't start with RE:), skip it.
                    if is_system_subj and not subj.startswith("re:"):
                        print(f"DEBUG: Skipping outgoing system notification: '{subj_full}'")
                        continue
                    
                    # Also skip if we are the sender (based on signatures)
                    signatures = ["App Governance Compliance Team", "App Governance & IAM Team", "IAM Governance Team"]
                    is_our_email = any(sig in body_temp for sig in signatures)
                    if is_our_email and not subj.startswith("re:"):
                        print(f"DEBUG: Skipping outgoing email found by signature: '{subj_full}'")
                        continue
                    
                    emails.append(e)

                if not emails:
                    if attempts % 10 == 0: 
                        print(f"INFO: No new actionable reply for {ticket_id}, attempt {attempts}/{max_polls}")
                    continue

                # Sort combined results by ReceivedTime descending
                emails.sort(key=lambda x: x.get("ReceivedTime", ""), reverse=True)

                # Get the latest state from the global dictionary
                ticket = current_tickets.get(ticket_id)
                if not ticket:
                    print(f"WARN: Ticket {ticket_id} disappeared during polling. Stopping poll.")
                    active_polls.pop(ait_number, None)
                    return

                last_processed_id = ticket.get("lastProcessedEmailId")

                # Find the latest email that hasn't been processed yet
                new_email = None
                for e in emails:
                    e_id = e.get("Id")
                    if last_processed_id and e_id == last_processed_id:
                        break 
                    new_email = e
                    break 

                if not new_email:
                    continue

                e_id = new_email.get("Id")
                body = new_email.get("Body", "") or ""
                sender = (new_email.get("SenderEmail") or "unknown").lower().strip()
                temp_subj = new_email.get("Subject") or "No Subject"
                temp_subj_lower = temp_subj.lower()
                
                print(f"DEBUG: Processing potential reply for {ticket_id}: Subj='{temp_subj}' From='{sender}' Id='{e_id}'")
                
                # --- Final safety check on system emails reached here ---
                signatures = ["App Governance Compliance Team", "App Governance & IAM Team", "IAM Governance Team"]
                if any(sig in body for sig in signatures) and not temp_subj_lower.startswith("re:"):
                    print(f"DEBUG: Re-filtering outgoing email at processing stage: '{temp_subj}'")
                    ticket["lastProcessedEmailId"] = e_id
                    save_tickets_to_disk()
                    continue
                
                # --- Sender Validation (Safe) ---
                raw_contacts = ticket.get("contacts", []) or []
                contacts = [str(c).lower().strip() for c in raw_contacts if c]
                
                u_email_raw = ticket.get("userEmail") or ticket.get("user_email") or ""
                u_email = str(u_email_raw).lower().strip()
                
                from backend.services.inbox_reader import get_closure_decision
                from backend.services.email_service import send_email

                decision_data = get_closure_decision(body)
                decision = decision_data.get("decision", "UNCLEAR")
                reason = decision_data.get("reason", "")
                print(f"DEBUG: LLM Decision for {ticket_id}: {decision} (Reason: {reason})")
                
                # Parse admin names
                from backend.services.inbox_reader import parse_admin_names_from_body
                parsed_names = parse_admin_names_from_body(body)
                
                is_pcat = ticket.get("ticket_type") == "PCAT"
                is_bre_new = ticket.get("deliverableType") == "BRE-NEW"
                
                # --- Shared Context for Handlers ---
                from backend.email_handlers import EmailHandlerContext
                
                def stop_polling(ait: str):
                    active_polls.pop(ait, None)
                    
                async def trigger_processing(tid: str):
                    asyncio.create_task(process_individual_ticket(tid))
                
                ctx = EmailHandlerContext(
                    ticket_id=ticket_id,
                    ait_number=ait_number,
                    ticket=ticket,
                    decision=decision,
                    reason=reason,
                    sender=sender,
                    e_id=e_id,
                    parsed_names=parsed_names,
                    broadcaster=manager.broadcast,
                    save_tickets=save_tickets_to_disk,
                    update_stage=update_stage_progress,
                    stop_polling=stop_polling,
                    trigger_processing=trigger_processing,
                    arm_admin_agent=arm_admin_agent
                )
                
                # --- Route to Deliverable-Specific Handlers ---
                if is_pcat:
                    await handle_pcat_reply(ctx)
                elif is_bre_new:
                    await handle_bre_reply(ctx)
                else:
                    await handle_arm_reply(ctx)

                # ── Update tracking to prevent infinite loops ──
                current_tickets[ticket_id]["lastProcessedEmailId"] = e_id
                save_tickets_to_disk()
                print(f"DEBUG: Processed email {e_id} for ticket {ticket_id}. Moving forward.")

            except Exception as e:
                print(f"ERROR: Exception within polling loop for {ticket_id}: {e}")
                traceback.print_exc()
                await asyncio.sleep(5) # Avoid tight error loop

    except Exception as e:
        print(f"ERROR: Outer inbox polling crashed for {ticket_id}: {e}")
    finally:
        # Finished or Timeout or Error - ensure state is reset
        if ticket_id in current_tickets:
            current_tickets[ticket_id]["isPollingActive"] = False
            save_tickets_to_disk()
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
        active_polls.pop(ait_number, None)


class InboxPollRequest(BaseModel):
    ticket_id: str


@app.post("/api/admin-details/{ait_number}/start-inbox-poll")
async def start_inbox_poll(ait_number: str, req: InboxPollRequest):
    """Start a background Outlook inbox poll for the given AIT / ticket."""
    if ait_number in active_polls:
        return JSONResponse(content={"status": "already_polling", "message": f"Already polling inbox for {ait_number}"})

    active_polls[ait_number] = req.ticket_id
    asyncio.create_task(poll_inbox_for_reply(req.ticket_id, ait_number))
    return JSONResponse(content={
        "status": "polling_started",
        "ait_number": ait_number,
        "ticket_id": req.ticket_id,
        "message": f"Outlook inbox polling started for {ait_number}. Will check every 30s for up to 30 minutes."
    })


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
            "ARM FORM" in str(ticket.get("subcategory", "")).upper() or 
            "ARM FORM" in str(ticket.get("deliverableType", "")).upper()
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
            ticket["contacts"] = []
        elif ait_number == "AIT-5002":
            ticket["contacts"] = []
        elif ait_number == "AIT-5003":
            ticket["contacts"] = []
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

        # Persist change
        save_tickets_to_disk()
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Closure confirmed for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/tickets/{ticket_id}/email-preview")
async def get_email_preview(ticket_id: str):
    """Generate email preview with the correct To address and body."""
    try:
        if ticket_id not in current_tickets:
             return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
             
        ticket = current_tickets[ticket_id]
        
        is_arm_no_admin = (
            "ARM FORM" in str(ticket.get("subcategory", "")).upper() or
            "ARM FORM" in str(ticket.get("deliverableType", "")).upper()
        )
        is_bre = ticket.get("ticket_type") == "BRE"
        
        ait_number = ticket.get("aitNumber") or ticket.get("ait_number", "")
        app_name = ticket.get("applicationName") or ticket.get("application_name", "N/A")
        title = ticket.get("title", "Deliverable Review")
        
        to_email = ""
        
        if is_arm_no_admin and ait_number:
            from backend.agents.arm_admin_remediation import ARMAdminRemediationAgent
            agent = ARMAdminRemediationAgent()
            # Find the app owner email from admin_details for the AIT
            admin_list = agent.load_admin_details()
            for entry in admin_list:
                if entry.get("ait_number") == ait_number and "app_owner_email" in entry:
                    to_email = entry["app_owner_email"]
                    break
        
        # Fallback for to_email
        if not to_email:
            if ticket.get("contacts"):
                to_email = ", ".join(ticket.get("contacts"))
            elif ticket.get("application_owner"):
                # Warning: owner might be just a name like 'Abid Shaikh'
                # But we put it here as a last resort
                to_email = "support@example.com"
            else:
                to_email = "support@example.com"
                
        # Build subject
        subject = f"Evidence Required: {title} - {ticket_id}"
        
        if is_bre:
            lob_owner = ticket.get("lobOwner") or ticket.get("lob_owner", "N/A")
            desc = ticket.get("description", "Review required")
            body = f"Dear Application Owner,\n\nWe are processing ticket {ticket_id} regarding {title}.\n\nApplication Details:\n- Application Name: {app_name}\n- AIT Number: {ait_number}\n- LOB Owner: {lob_owner}\n\nBRE Violation Details:\n- The Business Rule Engine (BRE) has detected policy violations in your application.\n- Specifically: {desc}\n\nWe require evidence of the following actions:\n1. BRE Rule Certification\n2. Remediation Verification\n3. Policy Compliance Proof\n\nPlease provide the requested evidence within 48 hours.\n\nBest regards,\nGovernance Team"
        elif is_arm_no_admin:
            # Format specifically for ARM FORM deliverables
            body = (
                f"Dear Application Owner,\n\n"
                f"We are processing ticket {ticket_id} regarding {title}.\n\n"
                f"Application Details:\n"
                f"- Application Name: {app_name}\n"
                f"- AIT Number: {ait_number}\n\n"
                f"Following the IAM policies, application needs Primary Admin and Secondary Admin. Since no admins were assigned, we have raised ARM tickets for the same.\n"
                f"Please review the updated admin names for your application and reply to this email with \"APPROVE\" or \"REJECT\" with any comments.\n\n"
                f"Regards,\n"
                f"Governance Team"
            )
        else:
            body = f"Dear Application Owner,\n\nWe are processing ticket {ticket_id} regarding {title}.\n\nApplication Details:\n- Application Name: {app_name}\n- AIT Number: {ait_number}\n\nPlease provide the requested evidence for this ticket.\n\nRegards,\nGovernance Team"

        return JSONResponse(content={
            "email": {
                "to": to_email,
                "cc": "",
                "subject": subject,
                "body": body
            }
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
        
        ticket = current_tickets[ticket_id]
        print(f"DEBUG: Processing /send-email for ticket {ticket_id}")
        print(f"DEBUG: To: {email_req.to}")
        print(f"DEBUG: Subject: {email_req.subject}")
        print(f"DEBUG: Body length: {len(email_req.body)}")
        result = send_email(email_req.to, email_req.subject, email_req.body)

        status = "completed" if (result.get("sent") or result.get("mode") == "simulated") else "failed"
        
        timestamp = result.get("timestamp", datetime.now().isoformat())
        recipients = ", ".join(result.get("recipients", email_req.to))
        mode = result.get("mode", "smtp")
        
        is_arm_or_bre = (
            "ARM FORM" in str(ticket.get("subcategory", "")).upper() or 
            "ARM FORM" in str(ticket.get("deliverableType", "")).upper() or
            ticket.get("ticket_type") == "BRE"
        )

        email_sent_successfully = (result.get("sent") or result.get("mode") == "simulated")
        status = "completed" if email_sent_successfully else "failed"
        
        timestamp = result.get("timestamp", datetime.now().isoformat())
        recipients = ", ".join(result.get("recipients", email_req.to))
        mode = result.get("mode", "smtp")
        
        if email_sent_successfully:
            if is_arm_or_bre:
                # PAUSE: For ARM/BRE, we don't complete Stage 6 yet, we wait for a reply
                status = "in-progress"
                msg = f"✅ Review email sent successfully ({mode}). Awaiting App Owner response to finalize..."
                current_tickets[ticket_id]["waitingForAppOwnerConfirmation"] = True
                current_tickets[ticket_id]["status"] = "Waiting for App Owner"
                current_tickets[ticket_id].pop("needsResendEmail", None)
            else:
                msg = f"✅ Email sent successfully ({mode})\nRecipients: {recipients}"
                msg += f"\nTimestamp: {timestamp}"
        else:
            msg = f"❌ Email failed: {result.get('error', 'Unknown error')}"

        # Update stage 6: Evidence Collection (index 6)
        await update_stage_progress(ticket_id, 6, status, msg)
        
        # If successfully sent (regardless of whether stage is 'completed' or 'in-progress'),
        # initialize polling and handle progression.
        if email_sent_successfully:
            current_tickets[ticket_id]["waitingForReview"] = False
            
            # ── Fix: Initialize lastProcessedEmailId to prevent immediate loops ──
            ait_number = ticket.get("aitNumber") or ticket.get("ait_number", "")
            
            inbox_emails = read_inbox_for_ticket(ticket_id, max_emails=5) + read_inbox_for_ticket(ait_number, max_emails=5)
            if inbox_emails:
                inbox_emails.sort(key=lambda x: x.get("ReceivedTime", ""), reverse=True)
                latest_id = inbox_emails[0].get("Id")
                current_tickets[ticket_id]["lastProcessedEmailId"] = latest_id
                print(f"DEBUG: Pre-initialized lastProcessedEmailId to {latest_id} for {ticket_id}")

            # Persist state
            save_tickets_to_disk()

            # Trigger next stage ONLY if it's NOT a ticket waiting for confirmation
            if not current_tickets[ticket_id].get("waitingForAppOwnerConfirmation"):
                asyncio.create_task(process_individual_ticket(ticket_id))

            # ── Auto-start Outlook inbox polling ──
            # Only when real emails are sent (EMAIL_SENDING_ENABLED=true).
            sending_enabled = os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true"
            if is_arm_or_bre and ait_number and sending_enabled and ait_number not in active_polls:
                active_polls[ait_number] = ticket_id
                asyncio.create_task(poll_inbox_for_reply(ticket_id, ait_number))
                print(f"INFO: Auto-started Outlook inbox poll for ticket {ticket_id} / {ait_number}")

        return JSONResponse(content={
            "status": "success" if status in ("completed", "in-progress") else "error",
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
    print("="*60)
    print("Starting Ticket Portal API with REAL AGENTS")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
