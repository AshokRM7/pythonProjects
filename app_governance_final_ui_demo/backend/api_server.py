from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import asyncio
import json
import os
from dotenv import load_dotenv
from backend.core.orchestrator import IAMOrchestrator
from backend.models.ticket_context import Ticket, TicketResponse, Stage
from datetime import datetime

load_dotenv()

from pydantic import BaseModel

class PriorityUpdate(BaseModel):
    priority: str

app = FastAPI(title="Ticket Portal API", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        api_key = os.getenv("OPEN_ROUTER_KEY_ORIGINAL")
        if not api_key:
            print("⚠️ WARNING: OPEN_ROUTER_KEY_ORIGINAL not found in environment variables")
        # Config file is now at root level
        # import os removed
        from pathlib import Path
        root_dir = Path(__file__).parent.parent
        config_path = root_dir / "config" / "config.json"
        orchestrator = IAMOrchestrator(api_key, config_file=str(config_path))
    return orchestrator

def convert_ticket_to_frontend(ticket: Ticket) -> dict:
    """Convert Pydantic Ticket model to frontend dictionary format"""
    return {
        "id": ticket.ticket_id,
        "title": ticket.description[:50] + "..." if len(ticket.description) > 50 else ticket.description,
        "description": ticket.description,
        "customer": ticket.application_owner or "Unknown",
        "priority": ticket.risk_level.lower() if ticket.risk_level else "medium",
        "status": ticket.status.lower() if ticket.status else "not-started",
        "owner": ticket.owner,
        "createdAt": ticket.created_on,
        "currentStage": ticket.currentStage,
        "category": ticket.category,
        "slaDeadline": ticket.sla_deadline,
        "aitNumber": ticket.ait_number,
        "deliverableType": ticket.deliverableType,
        "applicationName": ticket.application_name,
        "lobOwner": ticket.lob_owner,
        "aitOwner": ticket.ait_owner,
        "armId": ticket.arm_id,
        "contacts": ticket.contacts,
        "stages": [s.model_dump() for s in ticket.stages] if ticket.stages else [],
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
        stages=[Stage(**s) for s in data.get("stages", [])]
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
        
        await manager.broadcast({
            "type": "processing_start",
            "message": f"Processing ticket {ticket_id} with AI Agents..."
        })
        
        # Stage 1: Category Check
        if current_stage < 1:
            await update_stage_progress(ticket_id, 1, "in-progress", "Agent: Analyzing ticket category...")
            ticket_context.tickets = [ticket_obj]
            result = await asyncio.to_thread(orch.categorizer.invoke, ticket_context)
            if result.tickets:
                ticket_obj = result.tickets[0]
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            else:
                await update_stage_progress(ticket_id, 1, "error", "❌ Not an IAM ticket - processing stopped")
                return
            current_stage = 1
            
        # Stage 2: SLA Prioritization
        if current_stage < 2:
            await update_stage_progress(ticket_id, 2, "in-progress", "Agent: Calculating SLA & Risk...")
            ticket_context.tickets = [ticket_obj]
            result = await asyncio.to_thread(orch.sla.invoke, ticket_context)
            if result.tickets:
                ticket_obj = result.tickets[0]
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
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
            await update_stage_progress(ticket_id, 3, "in-progress", "Agent: Fetching ownership data...")
            ticket_context.tickets = [ticket_obj]
            result = await asyncio.to_thread(orch.ownership.invoke, ticket_context)
            if result.tickets:
                ticket_obj = result.tickets[0]
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            current_stage = 3
            
        # Stage 4: App Owner Check
        if current_stage < 4:
            await update_stage_progress(ticket_id, 4, "in-progress", "Agent: Verifying app owner space...")
            ticket_context.tickets = [ticket_obj]
            result = await asyncio.to_thread(orch.app_space_checker.invoke, ticket_context)
            if result.tickets:
                ticket_obj = result.tickets[0]
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            current_stage = 4
            
        # Stage 5: IAM Remediation
        if current_stage < 5:
            await update_stage_progress(ticket_id, 5, "in-progress", "Agent: Executing IAM Remediation Journey...")
            ticket_context.tickets = [ticket_obj]
            result = await asyncio.to_thread(orch.remediation.invoke, ticket_context)
            if result.tickets:
                ticket_obj = result.tickets[0]
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            current_stage = 5

        # Stage 6: Evidence Collection (Pause)
        if current_stage < 6:
            await update_stage_progress(ticket_id, 6, "in-progress", "Agent: Preparing evidence emails...")
            ticket_context.tickets = [ticket_obj]
            await asyncio.to_thread(orch.evidence.invoke, ticket_context)
            
            current_tickets[ticket_id]["waitingForReview"] = True
            await update_stage_progress(ticket_id, 6, "in-progress", "⏸️ Waiting for application team review...")
            
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            return
            
        # Stage 7: Ticket Closure (Pause)
        stage_7_status = current_tickets[ticket_id]["stages"][7]["status"]
        if current_stage < 7 or (current_stage == 7 and stage_7_status != "completed"):
            if not current_tickets[ticket_id].get("closure_approved", False):
                await update_stage_progress(ticket_id, 7, "in-progress", "Agent: Preparing for closure...")
                current_tickets[ticket_id]["waitingForClosureConfirmation"] = True
                await update_stage_progress(ticket_id, 7, "in-progress", "⏸️ Waiting for final closure confirmation...")
                
                await manager.broadcast({
                    "type": "ticket_update",
                    "ticket": current_tickets[ticket_id]
                })
                return
            
            await update_stage_progress(ticket_id, 7, "in-progress", "Agent: Closing ticket...")
            ticket_context.tickets = [ticket_obj]
            result = await asyncio.to_thread(orch.closer.invoke, ticket_context)
            if result.tickets:
                ticket_obj = result.tickets[0]
                current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            current_stage = 7
            
        # Stage 8: Logging
        if current_stage < 8:
            await update_stage_progress(ticket_id, 8, "in-progress", "Agent: Logging results...")
            ticket_context.tickets = [ticket_obj]
            # Logger return value is a dict, not TicketResponse
            await asyncio.to_thread(orch.logger.invoke, ticket_context)
            # ticket_obj is updated in place
            current_tickets[ticket_id] = convert_ticket_to_frontend(ticket_obj)
            current_stage = 8
            
        await manager.broadcast({
            "type": "processing_complete",
            "message": f"Ticket {ticket_id} processed successfully",
            "ticket": current_tickets[ticket_id]
        })


    except Exception as e:
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
        print(f"Error loading initial tickets: {e}")

@app.on_event("startup")
async def startup_event():
    await load_initial_tickets()

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
