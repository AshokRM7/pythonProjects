"""
FastAPI endpoints for BRE Rule Certification Process
Includes WebSocket broadcasting (mirrors PCAT/IAM pattern)
"""
import asyncio
import json
from pathlib import Path
from typing import Any, Callable, Awaitable, Dict, List, Optional

import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from langchain_openai import ChatOpenAI
from backend.bre.models import (
    BREProcessRequest,
    BREProcessResponse,
    BREWorkflowState,
)
from backend.bre.orchestrator import BREOrchestrator, BRE_STAGES

# Create router
router = APIRouter(prefix="/api/bre", tags=["BRE Rule Certification"])

# Build LLM from env (same key used by the rest of the app)
def _build_llm() -> ChatOpenAI:
    api_key = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("⚠️ BRE: No OPENAI_API_KEY / OPEN_ROUTER_KEY_ORIGINAL found; LLM disabled")
        return None  # type: ignore
    return ChatOpenAI(
        model="gpt-4omini",
        api_key=api_key,
        temperature=0,
    )

# Initialize orchestrator with real LLM
orchestrator = BREOrchestrator(llm=_build_llm())

# Shared references injected from api_server.py (like PCAT pattern)
_current_tickets: Optional[Dict[str, Any]] = None
_broadcast: Optional[Callable[[dict], Awaitable[None]]] = None
_poll_fn: Optional[Callable[[str, str], Awaitable[None]]] = None

# Per-deliverable WebSocket connections
_bre_ws_connections: Dict[str, List[WebSocket]] = {}


def init_bre_api(
    current_tickets: Dict[str, Any],
    broadcast: Callable[[dict], Awaitable[None]],
    poll_fn: Optional[Callable[[str, str], Awaitable[None]]] = None,
):
    """Inject shared ticket store, broadcast function, and poll function."""
    global _current_tickets, _broadcast, _poll_fn
    _current_tickets = current_tickets
    _broadcast = broadcast
    _poll_fn = poll_fn
    orchestrator.set_broadcast(broadcast, current_tickets)
    if poll_fn:
        orchestrator.set_poll_fn(poll_fn)


def _seed_bre_ticket(ticket_id: str, ticket_data: dict):
    """Ensure a BRE ticket is present in the shared ticket store with stage scaffold."""
    if _current_tickets is None or ticket_id in _current_tickets:
        return
    is_bre_new = ticket_data.get("deliverableType") == "BRE-NEW"
    # Stage 6 is for BRE-NEW only. Legacy BRE tickets keep stages 0-5.
    max_stages = 7 if is_bre_new else 6
    stages = [dict(s) for s in BRE_STAGES[:max_stages]]  # fresh copy correctly sized
    _current_tickets[ticket_id] = {
        **ticket_data,
        "id": ticket_id,
        "ticket_type": "BRE",
        "category": "IAM",
        "subcategory": "BRE",
        "currentStage": 0,
        "status": ticket_data.get("status", "Open"),
        "stages": stages,
    }


def load_bre_tickets_into_store():
    """
    Load all BRE tickets from ticket_data.json into the shared ticket store.
    Called during api_server lifespan startup.
    """
    if _current_tickets is None:
        return
    data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            tickets = json.load(f)
        count = 0
        for t in tickets:
            is_bre = t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")
            if is_bre:
                tid = t["ticket_id"]
                if tid not in _current_tickets:
                    _seed_bre_ticket(tid, t)
                    count += 1
        if count:
            print(f"Loaded {count} BRE ticket(s) into shared store")
    except Exception as e:
        print(f"Warning: Could not load BRE tickets: {e}")


@router.post("/process", response_model=BREProcessResponse)
async def process_bre_deliverable(request: BREProcessRequest) -> BREProcessResponse:
    """
    Process a BRE deliverable through the complete certification workflow
    
    Steps:
    1. Deliverable Intake
    2. BRE Portal Check
    3. Soft Review
    4. Certification Submission
    5. Evidence & Closure (when certification received)
    
    Args:
        request: Contains deliverable_id to process
    
    Returns:
        BREProcessResponse with workflow status and results
    """
    try:
        result = orchestrator.process_deliverable(
            request.deliverable_id,
            auto_complete=True  # For demo, auto-complete the certification
        )
        
        workflow_state = None
        if result.get("workflow_state"):
            workflow_state = BREWorkflowState(**result["workflow_state"])
        
        return BREProcessResponse(
            success=result["success"],
            deliverable_id=request.deliverable_id,
            current_step=result.get("current_step", "unknown"),
            message=result.get("message", ""),
            workflow_state=workflow_state,
            error=result.get("error")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{deliverable_id}")
async def get_workflow_status(deliverable_id: str) -> Dict[str, Any]:
    """
    Get current status of a BRE workflow
    
    Args:
        deliverable_id: ID of the deliverable
    
    Returns:
        Current workflow status and state
    """
    status = orchestrator.get_workflow_status(deliverable_id)
    
    if not status:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow not found for deliverable: {deliverable_id}"
        )
    
    return status


@router.get("/workflows/active")
async def list_active_workflows() -> List[Dict[str, Any]]:
    """
    List all active BRE workflows
    
    Returns:
        List of active workflows with basic info
    """
    return orchestrator.list_active_workflows()


@router.get("/deliverables")
async def list_deliverables() -> Dict[str, Any]:
    """
    List all BRE deliverables — loaded from ticket_data.json (category=BRE).
    App owner details come from apphq_data.json.
    """
    try:
        data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
        with open(data_path, "r", encoding="utf-8") as f:
            tickets = json.load(f)

        deliverables = [
            t for t in tickets
            if t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")
        ]
        return {
            "success": True,
            "deliverables": deliverables,
            "count": len(deliverables),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deliverables/{deliverable_id}")
async def get_deliverable(deliverable_id: str) -> Dict[str, Any]:
    """Get a single BRE deliverable by ticket_id."""
    try:
        data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
        with open(data_path, "r", encoding="utf-8") as f:
            tickets = json.load(f)

        for t in tickets:
            is_match = t.get("ticket_id") == deliverable_id
            is_bre = t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")
            if is_match and is_bre:
                return {"success": True, "deliverable": t}

        raise HTTPException(status_code=404, detail=f"BRE deliverable not found: {deliverable_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ait/{ait_number}/rules")
async def get_ait_rules(ait_number: str) -> Dict[str, Any]:
    """
    Get rules and certification history for an AIT
    
    Args:
        ait_number: AIT number to lookup
    
    Returns:
        AIT rules and certification history
    """
    try:
        data_path = Path(__file__).parent.parent.parent / "data" / "bre_portal_data.json"
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        ait_rules = data.get("ait_rules", {}).get(ait_number)
        
        if not ait_rules:
            raise HTTPException(
                status_code=404,
                detail=f"No rules found for AIT: {ait_number}"
            )
        
        return {
            "success": True,
            "ait_rules": ait_rules
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process/{deliverable_id}")
async def process_bre_deliverable_async(deliverable_id: str) -> Dict[str, Any]:
    """
    Start async BRE workflow for a deliverable with WebSocket step-by-step broadcasts.
    Progress events are emitted on:
      - Main WebSocket /ws  (type: bre_stage_update)
      - Per-deliverable  /api/bre/ws/{deliverable_id}
    """
    # Ensure ticket is in shared store with stage scaffold
    if _current_tickets is not None and deliverable_id not in _current_tickets:
        data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
        try:
            with open(data_path, "r", encoding="utf-8") as f:
                tickets = json.load(f)
            for t in tickets:
                is_bre = t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")
                if t.get("ticket_id") == deliverable_id and is_bre:
                    _seed_bre_ticket(deliverable_id, t)
                    break
        except Exception:
            pass

    asyncio.create_task(orchestrator.process_deliverable_async(deliverable_id))
    return {
        "status": "success",
        "message": f"BRE processing started for {deliverable_id}. Watch WebSocket for progress.",
        "deliverable_id": deliverable_id,
    }


@router.post("/verify/{deliverable_id}")
async def verify_deliverable(deliverable_id: str, auto_certify: bool = False) -> Dict[str, Any]:
    """
    Confirm app owner certification and trigger Evidence & Closure (Stage 5) step.
    Call this after the app owner has provided certification.
    
    Args:
        deliverable_id: ID of the deliverable to certify and close
        auto_certify: If True, generates a simulated certification response.
                     If False (default), loads actual app owner response from data file.
    """
    asyncio.create_task(orchestrator.verify_and_close_async(deliverable_id, auto_certify))
    return {
        "status": "success",
        "message": f"Certification confirmed for {deliverable_id}. Closing deliverable...",
        "auto_certify": auto_certify
    }


@router.post("/test/run-demo")
async def run_demo_workflow() -> Dict[str, Any]:
    """
    Run a complete synchronous demo workflow for testing (first available BRE deliverable).
    """
    try:
        data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
        with open(data_path, "r", encoding="utf-8") as f:
            tickets = json.load(f)

        bre_tickets = [t for t in tickets if t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")]
        if not bre_tickets:
            raise HTTPException(status_code=404, detail="No BRE deliverables found in ticket_data.json")

        deliverable_id = bre_tickets[0]["ticket_id"]
        result = orchestrator.process_deliverable(deliverable_id, auto_complete=True)

        return {
            "success": True,
            "message": "Demo workflow completed",
            "deliverable_processed": deliverable_id,
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_bre_metrics() -> Dict[str, Any]:
    """
    Get BRE process metrics and statistics
    
    Returns:
        Metrics about BRE workflows
    """
    workflows = orchestrator.list_active_workflows()
    all_workflows = list(orchestrator.workflow_states.values())
    
    completed = sum(1 for w in all_workflows if w.current_step == "completed")
    in_progress = len(workflows)
    
    return {
        "success": True,
        "metrics": {
            "total_workflows": len(all_workflows),
            "completed": completed,
            "in_progress": in_progress,
            "completion_rate": f"{(completed / len(all_workflows) * 100):.1f}%" if all_workflows else "0%"
        },
        "active_workflows": workflows
    }


@router.delete("/workflow/{deliverable_id}")
async def delete_workflow(deliverable_id: str) -> Dict[str, Any]:
    """
    Delete a workflow (for testing/cleanup)
    """
    if deliverable_id in orchestrator.workflow_states:
        del orchestrator.workflow_states[deliverable_id]
        orchestrator._save_states()
        return {"success": True, "message": f"Workflow {deliverable_id} deleted"}

    raise HTTPException(status_code=404, detail=f"Workflow not found: {deliverable_id}")


@router.post("/reset/{deliverable_id}")
async def reset_bre_ticket(deliverable_id: str) -> Dict[str, Any]:
    """
    Reset a BRE ticket to initial state for demo purposes.
    
    This will:
    - Clear workflow state
    - Reload ticket from ticket_data.json
    - Reset all stages to initial state
    - Broadcast update to connected WebSocket clients
    
    Args:
        deliverable_id: ID of the BRE ticket to reset
    
    Returns:
        Success message with reset ticket data
    """
    try:
        # Remove workflow state if exists
        if deliverable_id in orchestrator.workflow_states:
            del orchestrator.workflow_states[deliverable_id]
            orchestrator._save_states()
        
        # Reload ticket from original data file
        data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
        with open(data_path, "r", encoding="utf-8") as f:
            tickets = json.load(f)
        
        # Find the BRE ticket
        original_ticket = None
        for t in tickets:
            is_bre = t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")
            if t.get("ticket_id") == deliverable_id and is_bre:
                original_ticket = t
                break
        
        if not original_ticket:
            raise HTTPException(
                status_code=404, 
                detail=f"BRE ticket not found in ticket_data.json: {deliverable_id}"
            )
        
        # Reset ticket in shared store with fresh stage scaffold
        if _current_tickets is not None:
            stages = [dict(s) for s in BRE_STAGES]  # Fresh copy of stages
            _current_tickets[deliverable_id] = {
                **original_ticket,
                "id": deliverable_id,
                "ticket_type": "BRE",
                "category": "IAM",
                "subcategory": "BRE",
                "currentStage": 0,
                "status": "Open",
                "stages": stages,
            }
            
            # Broadcast update to WebSocket clients
            if _broadcast:
                await _broadcast({
                    "type": "ticket_reset",
                    "ticket": _current_tickets[deliverable_id],
                })
            
            # Also broadcast to deliverable-specific WebSocket connections
            if deliverable_id in _bre_ws_connections:
                reset_payload = {
                    "type": "bre_reset",
                    "deliverable_id": deliverable_id,
                    "ticket": _current_tickets[deliverable_id],
                }
                for ws in _bre_ws_connections[deliverable_id]:
                    try:
                        await ws.send_json(reset_payload)
                    except Exception:
                        pass
        
        return {
            "success": True,
            "message": f"BRE ticket {deliverable_id} reset to initial state",
            "deliverable_id": deliverable_id,
            "ticket": _current_tickets.get(deliverable_id) if _current_tickets else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets")
async def get_bre_tickets() -> Dict[str, Any]:
    """
    List BRE tickets from the shared in-memory ticket store (with live stage status).
    """
    if _current_tickets is not None:
        bre = [t for t in _current_tickets.values() if t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")]
        return {"success": True, "tickets": bre, "count": len(bre)}
    return {"success": True, "tickets": [], "count": 0}


@router.get("/tickets/{deliverable_id}")
async def get_bre_ticket(deliverable_id: str) -> Dict[str, Any]:
    """Get live BRE ticket state (including stage progress)."""
    if _current_tickets and deliverable_id in _current_tickets:
        t = _current_tickets[deliverable_id]
        is_bre = t.get("category", "").upper() == "BRE" or (t.get("category", "").upper() == "IAM" and t.get("subcategory", "").upper() == "BRE")
        if is_bre:
            return {"success": True, "ticket": t}
    raise HTTPException(status_code=404, detail=f"BRE ticket not found: {deliverable_id}")


@router.websocket("/ws/{deliverable_id}")
async def bre_websocket_endpoint(websocket: WebSocket, deliverable_id: str):
    """
    Per-deliverable WebSocket connection for BRE workflow progress.
    Clients connect to /api/bre/ws/{deliverable_id} to receive granular step updates.
    """
    await websocket.accept()
    if deliverable_id not in _bre_ws_connections:
        _bre_ws_connections[deliverable_id] = []
    _bre_ws_connections[deliverable_id].append(websocket)

    # Send current state immediately upon connect
    initial_payload: Dict[str, Any] = {"type": "bre_connected", "deliverable_id": deliverable_id}
    if _current_tickets and deliverable_id in _current_tickets:
        initial_payload["ticket"] = _current_tickets[deliverable_id]
    if deliverable_id in orchestrator.workflow_states:
        initial_payload["workflow_state"] = orchestrator.workflow_states[deliverable_id].model_dump(mode="json")
    await websocket.send_json(initial_payload)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        if deliverable_id in _bre_ws_connections:
            _bre_ws_connections[deliverable_id] = [
                ws for ws in _bre_ws_connections[deliverable_id] if ws != websocket
            ]


# ──────────────────────────────────────────────────────────────────────────────
# BRE Remediation Agent Endpoints (BRE-NEW deliverable only)
# These endpoints are ISOLATED from existing BRE-2026-* / IAM / PCAT flows.
# ──────────────────────────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel, Field as _Field
from typing import List as _List, Optional as _Optional

# Lazy-load the remediation agent (no LLM required)
_remediation_agent = None

def _get_remediation_agent():
    global _remediation_agent
    if _remediation_agent is None:
        from backend.agents.bre_remediation_agent import BRERemediationAgent
        _remediation_agent = BRERemediationAgent()
    return _remediation_agent


class BREDecision(_BaseModel):
    permission_id: str = _Field(alias="permissionId")
    permission_name: str = _Field(alias="permissionName")
    action: str  # "certify" or "remove"
    comment: _Optional[str] = ""

    class Config:
        populate_by_name = True


class BRESubmitRequest(_BaseModel):
    decisions: _List[BREDecision]
    submitted_by: _Optional[str] = "support_team"


@router.get("/dashboard/rules")
async def get_bre_business_rules() -> Dict[str, Any]:
    """
    Return all 5 BRE business rules for the Remediation Dashboard.
    Used by the BRE-NEW deliverable flow ONLY.
    """
    agent = orchestrator.remediation_agent
    rules = agent.get_business_rules()
    return {"success": True, "rules": rules, "count": len(rules)}


@router.get("/remediation/{deliverable_id}/permissions")
async def get_remediation_permissions(deliverable_id: str) -> Dict[str, Any]:
    """
    Get invalid permissions for a BRE-NEW ticket's AIT number.
    Reads from bre_portal_data.json → ait_rules[ait_number].invalid_permissions.
    """
    try:
        # Resolve AIT number from the shared ticket store
        ait_number = None
        if _current_tickets and deliverable_id in _current_tickets:
            ait_number = _current_tickets[deliverable_id].get("ait_number") or _current_tickets[deliverable_id].get("aitNumber")

        if not ait_number:
            # Fall back to ticket_data.json
            data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
            with open(data_path, "r", encoding="utf-8") as f:
                tickets = json.load(f)
            for t in tickets:
                if t.get("ticket_id") == deliverable_id:
                    ait_number = t.get("ait_number")
                    break

        if not ait_number:
            raise HTTPException(status_code=404, detail=f"AIT number not found for {deliverable_id}")

        agent = orchestrator.remediation_agent
        result = agent.get_invalid_permissions(ait_number)
        return {"success": True, **result}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remediation/{deliverable_id}/simulate-owner-response")
async def simulate_bre_owner_response(deliverable_id: str) -> Dict[str, Any]:
    """
    Simulate the App Owner's Certify/Remove decisions for demo purposes.
    Returns a pre-filled list of decisions that can be shown in the popup.
    Mirrors the simulate-response pattern used by the ARM Admin flow.
    BRE-NEW ONLY — does not affect existing BRE or IAM tickets.
    """
    try:
        ait_number = None
        if _current_tickets and deliverable_id in _current_tickets:
            ait_number = _current_tickets[deliverable_id].get("ait_number") or _current_tickets[deliverable_id].get("aitNumber")

        if not ait_number:
            data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
            with open(data_path, "r", encoding="utf-8") as f:
                tickets = json.load(f)
            for t in tickets:
                if t.get("ticket_id") == deliverable_id:
                    ait_number = t.get("ait_number")
                    break

        if not ait_number:
            raise HTTPException(status_code=404, detail=f"AIT number not found for {deliverable_id}")

        agent = orchestrator.remediation_agent
        decisions = agent.simulate_owner_response(ait_number)

        if _broadcast:
            await _broadcast({
                "type": "bre_owner_response_simulated",
                "deliverable_id": deliverable_id,
                "message": f"App Owner response simulated for {deliverable_id}",
                "decisions": decisions,
            })

        return {
            "success": True,
            "deliverable_id": deliverable_id,
            "ait_number": ait_number,
            "decisions": decisions,
            "message": "App Owner response simulated. Review and click Submit to proceed.",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remediation/{deliverable_id}/submit")
async def submit_bre_remediation(deliverable_id: str, req: BRESubmitRequest) -> Dict[str, Any]:
    """
    Submit support team's Certify/Remove decisions for a BRE-NEW ticket.
    Triggers:
      1. Screenshot capture (Pillow PNG)
      2. Email to App Owner with screenshot attachment
      3. JIRA ticket update with screenshot
      4. RISA portal notification
      5. Stage 6 marked completed via WebSocket broadcast

    BRE-NEW ONLY — does not affect existing BRE-2026-* / IAM / PCAT deliverables.
    """
    try:
        # Resolve AIT number and Application ID
        ait_number = None
        application_id = None

        if _current_tickets and deliverable_id in _current_tickets:
            t = _current_tickets[deliverable_id]
            ait_number = t.get("ait_number") or t.get("aitNumber")
            application_id = t.get("application_id") or t.get("applicationId")

        if not ait_number or not application_id:
            data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
            with open(data_path, "r", encoding="utf-8") as f:
                tickets = json.load(f)
            for t in tickets:
                if t.get("ticket_id") == deliverable_id:
                    ait_number = ait_number or t.get("ait_number")
                    application_id = application_id or t.get("application_id")
                    break

        if not ait_number:
            raise HTTPException(status_code=404, detail=f"AIT number not found for {deliverable_id}")

        # Broadcast: stage 6 in-progress
        if _broadcast:
            await _broadcast({
                "type": "bre_remediation_submitting",
                "deliverable_id": deliverable_id,
                "message": "Support team submitted decisions. Processing screenshot and notifications...",
            })

        decisions_list = [d.model_dump() for d in req.decisions]
        agent = orchestrator.remediation_agent
        result = await asyncio.to_thread(
            agent.submit_remediation_decision,
            deliverable_id,
            ait_number,
            application_id or "",
            decisions_list,
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("message", "Submission failed"))

        # Update shared ticket store: mark remediation complete and advance to Stage 7
        if _current_tickets and deliverable_id in _current_tickets:
            ticket = _current_tickets[deliverable_id]
            ticket["bre_remediation_completed"] = True
            ticket["bre_remediation_result"] = {
                "certified_count": result["certified_count"],
                "removed_count": result["removed_count"],
                "screenshot": result["screenshot"].get("filename"),
                "timestamp": result["timestamp"],
            }
            
            # Advance to Stage 7 (Archive & Close)
            ticket["currentStage"] = 7
            if len(ticket["stages"]) > 7:
                # Stage 6 was remediation
                ticket["stages"][6]["status"] = "completed"
                ticket["stages"][7]["status"] = "in-progress"
                ticket["status"] = "Remediated"

        # Broadcast completion and stage advance
        if _broadcast:
            await _broadcast({
                "type": "bre_remediation_completed",
                "deliverable_id": deliverable_id,
                "message": result["message"],
                "result": {
                    "certified_count": result["certified_count"],
                    "removed_count": result["removed_count"],
                    "screenshot": result["screenshot"].get("filename"),
                },
                "ticket": _current_tickets.get(deliverable_id) if _current_tickets else {},
            })

        # --- BRE-NEW Email Parity: Pause and Poll ---
        if _current_tickets and deliverable_id in _current_tickets:
            ticket = _current_tickets[deliverable_id]
            if ticket.get("deliverableType") == "BRE-NEW":
                ticket["waitingForAppOwnerConfirmation"] = True
                ticket["status"] = "Waiting for App Owner"
                
                # Update Stage 6 message to reflect waiting state
                if len(ticket["stages"]) > 6:
                    ticket["stages"][6]["status"] = "in-progress"
                    ticket["stages"][6]["message"] = "📧 Consolidated email sent with screenshot. Waiting for App Owner approval (APPROVE/REJECT)..."
                
                # Trigger inbox polling via orchestrator
                if _poll_fn:
                    asyncio.create_task(_poll_fn(deliverable_id, ait_number))
                    print(f"INFO: Started inbox poll for BRE-NEW ticket {deliverable_id}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/remediation/{deliverable_id}/capture-preview")
async def capture_bre_remediation_preview(deliverable_id: str, req: BRESubmitRequest) -> Dict[str, Any]:
    """
    Generate a remediation screenshot preview without final submission.
    """
    try:
        ait_number = None
        if _current_tickets and deliverable_id in _current_tickets:
            t = _current_tickets[deliverable_id]
            ait_number = t.get("ait_number") or t.get("aitNumber")

        if not ait_number:
            data_path = Path(__file__).resolve().parents[2] / "data" / "ticket_data.json"
            with open(data_path, "r", encoding="utf-8") as f:
                tickets = json.load(f)
            for t in tickets:
                if t.get("ticket_id") == deliverable_id:
                    ait_number = t.get("ait_number")
                    break

        if not ait_number:
            raise HTTPException(status_code=404, detail=f"AIT number not found for {deliverable_id}")

        decisions_list = [d.model_dump() for d in req.decisions]
        
        # Generate filename but don't perform submission actions
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_filename = f"preview_{deliverable_id}_{timestamp}.png"
        
        project_root = Path(__file__).resolve().parents[2]
        screenshots_dir = project_root / "backend" / "bre" / "data" / "evidence" / "screenshots"
        screenshots_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = str(screenshots_dir / screenshot_filename)

        # Use the remediation_agent from the global orchestrator instance
        result = await asyncio.to_thread(
            orchestrator.remediation_agent._capture_screenshot,
            deliverable_id,
            decisions_list,
            screenshot_path
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Preview generation failed"))

        return {
            "success": True,
            "deliverable_id": deliverable_id,
            "preview_url": f"/api/screenshots/{screenshot_filename}",
            "filename": screenshot_filename,
            "timestamp": timestamp
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
