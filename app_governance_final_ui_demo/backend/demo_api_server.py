from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import asyncio
import json
from datetime import datetime
from pydantic import BaseModel
from backend.core.logger_utils import AgentLogger, AgentTimer

class PriorityUpdate(BaseModel):
    priority: str

app = FastAPI(title="Ticket Portal API - Demo Mode", version="1.0.0")

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

# Global state for tickets
current_tickets: Dict[str, Any] = {}

# Load tickets from JSON file (same as real mode)
def load_tickets_from_json():
    """Load tickets from ticket_data.json and apphq_data.json"""
    try:
        # Load ticket data from new data directory
        import os
        from pathlib import Path
        root_dir = Path(__file__).parent.parent
        
        print(f"DEBUG: Root dir calculated as: {root_dir}")
        print(f"DEBUG: Looking for data at: {root_dir / 'data' / 'ticket_data.json'}")
        
        with open(root_dir / "data" / "ticket_data.json", "r") as f:
            tickets = json.load(f)
            print(f"DEBUG: Loaded {len(tickets)} tickets from JSON")
        
        # Load AppHQ data
        with open(root_dir / "data" / "apphq_data.json", "r") as f:
            apphq_data = json.load(f)
            print(f"DEBUG: Loaded {len(apphq_data)} AppHQ records from JSON")
        
        # Convert to frontend format
        frontend_tickets = []
        for ticket in tickets:
            # Find matching AppHQ data by ait_number
            apphq_info = next((app for app in apphq_data if app.get("ait_number") == ticket.get("ait_number")), {})
            
            # Convert to frontend format
            frontend_ticket = {
                "id": ticket.get("ticket_id", "UNKNOWN"),
                "title": f"{ticket.get('deliverableType', 'IAM')} - {ticket.get('description', '')[:50]}...",
                "description": ticket.get("description", ""),
                "customer": apphq_info.get("lob_owner", "Unknown"),
                "priority": ticket.get("risk_level", "medium").lower(),
                "createdAt": ticket.get("created_on", "2025-11-10"),
                "category": ticket.get("category", "IAM"),
                "slaDeadline": ticket.get("sla_deadline", "2025-12-01"),
                "aitNumber": ticket.get("ait_number", ""),
                "applicationName": apphq_info.get("application_name", "Unknown Application"),
                "armId": ticket.get("arm_id", ""),
                "lobOwner": apphq_info.get("lob_owner", ""),
                "aitOwner": apphq_info.get("ait_owner", ""),
                "contacts": apphq_info.get("contacts", [])
            }
            frontend_tickets.append(frontend_ticket)
        
        print(f"DEBUG: Converted {len(frontend_tickets)} tickets for frontend")
        return frontend_tickets
    except Exception as e:
        print(f"Error loading tickets from JSON: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to empty list
        return []

# Load tickets at startup
MOCK_TICKETS = load_tickets_from_json()


def create_ticket_with_stages(mock_ticket):
    """Create a ticket object with stage information"""
    return {
        **mock_ticket,
        "currentStage": 0,
        "status": "not-started",
        "stages": [
            {"id": 1, "name": "Ticket Fetcher Agent", "status": "completed", "message": "Ticket fetched successfully"},
            {"id": 2, "name": "Category Check Agent", "status": "pending", "message": ""},
            {"id": 3, "name": "SLA Prioritization Agent", "status": "pending", "message": ""},
            {"id": 4, "name": "Ownership Enrichment Agent", "status": "pending", "message": ""},
            {"id": 5, "name": "App Owner Check Agent", "status": "pending", "message": ""},
            {"id": 6, "name": "IAM Remediation Agent", "status": "pending", "message": ""},
            {"id": 7, "name": "Evidence Collection Agent", "status": "pending", "message": ""},
            {"id": 8, "name": "Ticket Closure Agent", "status": "pending", "message": ""},
            {"id": 9, "name": "Logging Agent", "status": "pending", "message": ""},


        ]
    }

async def update_stage_progress(ticket_id: str, stage_index: int, status: str, message: str):
    """Update ticket stage progress and broadcast to WebSocket clients"""
    if ticket_id in current_tickets:
        current_tickets[ticket_id]["currentStage"] = stage_index
        current_tickets[ticket_id]["stages"][stage_index]["status"] = status
        current_tickets[ticket_id]["stages"][stage_index]["message"] = message
        
        if status == "in-progress":
            current_tickets[ticket_id]["status"] = "in-progress"
        elif status == "completed" and stage_index == 8:

            current_tickets[ticket_id]["status"] = "completed"
        
        await manager.broadcast({
            "type": "ticket_update",
            "ticket": current_tickets[ticket_id]
        })

async def process_individual_ticket(ticket_id: str):
    """Process a single ticket through the agent pipeline"""
    try:
        if ticket_id not in current_tickets:
            await manager.broadcast({
                "type": "error",
                "message": f"Ticket {ticket_id} not found"
            })
            return
        
        ticket = current_tickets[ticket_id]
        current_stage = ticket["currentStage"]
        
        # Start from current stage
        AgentLogger.log_pipeline_start(ticket_id)
        
        await manager.broadcast({
            "type": "processing_start",
            "message": f"Processing ticket {ticket_id} (Demo Mode)..."
        })
        
        # Stage 1: Category Check - Validate if IAM
        if current_stage < 1:
            with AgentTimer("CategoryCheckerAgent", ticket_id, "Checking if ticket is IAM category"):
                await update_stage_progress(ticket_id, 1, "in-progress", "Category Check Agent: Analyzing ticket category...")
                await asyncio.sleep(1)
                
                # Check if ticket is IAM
                if ticket['category'].upper() == 'IAM':
                    await update_stage_progress(ticket_id, 1, "completed", f"Category Check Agent: Confirmed {ticket['category']} category.")
                    AgentLogger.log_agent_success("CategoryCheckerAgent", 0, f"Validated IAM category: {ticket['category']}")
                    current_stage = 1
                else:
                    # Not IAM - stop processing
                    await update_stage_progress(ticket_id, 1, "error", "Category Check Agent: Not an IAM ticket - processing stopped.")
                    AgentLogger.log_agent_error("CategoryCheckerAgent", f"Not an IAM ticket: {ticket['category']}")
                    current_tickets[ticket_id]["status"] = "completed"
                    await manager.broadcast({
                        "type": "processing_complete",
                        "message": f"Ticket {ticket_id} is not IAM - processing stopped",
                        "ticket": current_tickets[ticket_id]
                    })
                    return  # Stop here
        
        # Stage 2: SLA Prioritization (if not done)
        if current_stage < 2:
            with AgentTimer("SLAPrioritizerAgent", ticket_id, "Calculating SLA priority"):
                await update_stage_progress(ticket_id, 2, "in-progress", "SLA Prioritization Agent: Calculating SLA & Risk...")
                await asyncio.sleep(1)
                await update_stage_progress(ticket_id, 2, "completed", f"✅ Risk: {ticket.get('priority', 'medium').upper()} | SLA: {ticket.get('slaDeadline', 'N/A')}")
                AgentLogger.log_agent_success("SLAPrioritizerAgent", 0, f"Priority set to {ticket.get('priority', 'medium').upper()}")
            current_stage = 2
            
            # NEW CHECKPOINT: Pause for Priority Confirmation
            current_tickets[ticket_id]["waitingForPriorityConfirmation"] = True
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            return # Stop processing until confirmed

        # Stage 3: Ownership Enrichment (if not done)
        if current_stage < 3:
            with AgentTimer("AppHQResolverAgent", ticket_id, "Enriching ownership data"):
                await update_stage_progress(ticket_id, 3, "in-progress", "Ownership Enrichment Agent: Fetching ownership data...")
                await asyncio.sleep(1)
                await update_stage_progress(ticket_id, 3, "completed", f"✅ Owner: {ticket['lobOwner']}")
                AgentLogger.log_agent_success("AppHQResolverAgent", 0, f"Enriched owner: {ticket['lobOwner']}")
            current_stage = 3

        # Stage 4: App Owner Check (if not done)
        if current_stage < 4:
            with AgentTimer("AppOwnerCheckerAgent", ticket_id, "Checking app owner space"):
                await update_stage_progress(ticket_id, 4, "in-progress", "App Owner Check Agent: Verifying app owner space...")
                await asyncio.sleep(1)
                await update_stage_progress(ticket_id, 4, "completed", "✅ App owner verified")
                AgentLogger.log_agent_success("AppOwnerCheckerAgent", 0, "App owner space verified")
            current_stage = 4
        
        # Stage 5: IAM Remediation (NEW)
        if current_stage < 5:
            with AgentTimer("IAMRemediationAgent", ticket_id, "Initiating IAM Remediation"):
                await update_stage_progress(ticket_id, 5, "in-progress", "IAM Remediation Agent: Executing remediation journey...")
                await asyncio.sleep(1)
                
                remediation_journey = [
                    f"🔍 [EXTRACT] Identified User ID: U{ticket_id.replace('REQ', '')}",
                    f"🔔 [NOTIFY] Manager alerted for awareness",
                    f"⚠️ [RISK] Verified: No cross-impact detected",
                    f"⚡ [REVOKE] Technical access pull executed",
                    f"✅ [VERIFY] Post-remediation audit confirms success",
                    f"📄 [LOG] Governance signature added"
                ]
                await update_stage_progress(ticket_id, 5, "completed", "\n\n".join(remediation_journey))
                AgentLogger.log_agent_success("IAMRemediationAgent", 0, "Remediation journey completed")
            current_stage = 5
        
        # Stage 6: Evidence Collection (PAUSE FOR HUMAN REVIEW)
        if current_stage < 6:
            with AgentTimer("EvidenceCollectorAgent", ticket_id, "Preparing evidence emails"):
                await update_stage_progress(ticket_id, 6, "in-progress", "Evidence Collection Agent: Preparing evidence emails...")
                await asyncio.sleep(1)
                # Mark as waiting for review
                current_tickets[ticket_id]["waitingForReview"] = True
                await update_stage_progress(ticket_id, 6, "in-progress", "Evidence Collection Agent: Waiting for application team review...")
                AgentLogger.log_agent_success("EvidenceCollectorAgent", 0, "Evidence prepared, waiting for review")

            
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            
            # STOP HERE - wait for human approval
            return
        
        # Stage 6: Ticket Closure (only after review approved)
        if current_stage < 6:
            await update_stage_progress(ticket_id, 6, "in-progress", "Preparing for closure...")
            await asyncio.sleep(1)
            
            # NEW CHECKPOINT: Pause for Closure Confirmation
            current_tickets[ticket_id]["waitingForClosureConfirmation"] = True
            await update_stage_progress(ticket_id, 6, "in-progress", "Ticket Closure Agent: Waiting for final closure confirmation...")
            
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            return # Stop processing until confirmed

        # Stage 8: Final Closure
        if current_stage < 8:
            with AgentTimer("CloserAgent", ticket_id, "Closing ticket"):
                await update_stage_progress(ticket_id, 7, "in-progress", "Ticket Closure Agent: Closing ticket...")
                await asyncio.sleep(1)
                await update_stage_progress(ticket_id, 7, "completed", "✅ Ticket closed successfully")
                AgentLogger.log_agent_success("CloserAgent", 0, "Ticket closed successfully")
            current_stage = 8
        
        # Stage 9: Logging (Index 8)
        if current_stage < 9:
            with AgentTimer("LoggerAgent", ticket_id, "Logging results"):
                await update_stage_progress(ticket_id, 8, "in-progress", "Logging Agent: Logging results to audit trail...")
                await asyncio.sleep(1)
                await update_stage_progress(ticket_id, 8, "completed", "✅ Logged successfully")
                AgentLogger.log_agent_success("LoggerAgent", 0, "Log entry created")
            current_tickets[ticket_id]["status"] = "completed"

        
        AgentLogger.log_pipeline_end(ticket_id)
        
        await manager.broadcast({
            "type": "processing_complete",
            "message": f"Ticket {ticket_id} processed successfully",
            "ticket": current_tickets[ticket_id]
        })
        
    except Exception as e:
        AgentLogger.log_agent_error("Pipeline", str(e))
        AgentLogger.log_pipeline_end(ticket_id, status="Error")
        error_message = f"Error processing ticket {ticket_id}: {str(e)}"
        await manager.broadcast({
            "type": "error",
            "message": error_message
        })

async def load_initial_tickets():
    """Load tickets on startup"""
    for mock_ticket in MOCK_TICKETS:
        ticket = create_ticket_with_stages(mock_ticket)
        # Mark first stage as completed (tickets are already fetched)
        ticket["stages"][0]["status"] = "completed"
        ticket["stages"][0]["message"] = "Ticket fetched successfully"
        ticket["currentStage"] = 0
        current_tickets[ticket["id"]] = ticket

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Ticket Portal API is running in Demo Mode"}

@app.get("/api/tickets")
async def get_tickets():
    """Get all tickets"""
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

@app.post("/api/tickets/{ticket_id}/process")
async def process_single_ticket(ticket_id: str):
    """Process a single ticket through the agent pipeline"""
    try:
        asyncio.create_task(process_individual_ticket(ticket_id))
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Processing ticket {ticket_id} (Demo Mode)"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/confirm-priority")
async def confirm_priority(ticket_id: str, update: PriorityUpdate = None):
    """Confirm priority/risk and continue processing"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Check if waiting for priority confirmation
        if not ticket.get("waitingForPriorityConfirmation", False):
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for priority confirmation"})
        
        # Update priority if provided
        if update and update.priority:
            # Update both priority (lowercase) and risk_level (Capitalized) for consistency
            current_tickets[ticket_id]["priority"] = update.priority.lower()
            current_tickets[ticket_id]["risk_level"] = update.priority.capitalize() 
            ticket["priority"] = update.priority.lower()
            ticket["risk_level"] = update.priority.capitalize()

        # Mark confirmation as completed
        current_tickets[ticket_id]["waitingForPriorityConfirmation"] = False
        
        confirmed_risk = ticket.get('risk_level', 'Medium')
        await update_stage_progress(ticket_id, 2, "completed", f"Risk Confirmed: {confirmed_risk}")
        
        # Continue processing from stage 3
        asyncio.create_task(process_individual_ticket(ticket_id))
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Priority confirmed for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/approve-review")
async def approve_review(ticket_id: str):
    """Approve the review and continue processing"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Check if waiting for review
        if not ticket.get("waitingForReview", False):
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for review"})
        
        # Mark review as completed
        current_tickets[ticket_id]["waitingForReview"] = False
        await update_stage_progress(ticket_id, 6, "completed", "✅ Review approved - Evidence collected")
        current_tickets[ticket_id]["currentStage"] = 6
        
        # Continue processing from stage 7
        asyncio.create_task(process_individual_ticket(ticket_id))

        
        return JSONResponse(content={
            "status": "success",
            "message": f"Review approved for ticket {ticket_id}"
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
        
        # Check if waiting for closure confirmation
        if not ticket.get("waitingForClosureConfirmation", False):
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for closure confirmation"})
        
        # Mark confirmation as completed
        current_tickets[ticket_id]["waitingForClosureConfirmation"] = False
        await update_stage_progress(ticket_id, 7, "completed", "Closure Confirmed - Proceeding")
        current_tickets[ticket_id]["currentStage"] = 7
        
        # Continue processing from stage 8
        asyncio.create_task(process_individual_ticket(ticket_id))

        
        return JSONResponse(content={
            "status": "success",
            "message": f"Closure confirmed for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Get specific ticket by ID"""
    if ticket_id in current_tickets:
        return JSONResponse(content=current_tickets[ticket_id])
    else:
        return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})

@app.on_event("startup")
async def startup_event():
    """Load tickets on startup"""
    await load_initial_tickets()
    print("✅ Initial tickets loaded")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        # Send current tickets on connection
        await websocket.send_json({
            "type": "initial_state",
            "tickets": list(current_tickets.values())
        })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("Starting Ticket Portal API in DEMO MODE")
    print("=" * 60)
    print("Backend: http://localhost:8000")
    print("Frontend: http://localhost:5173")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
