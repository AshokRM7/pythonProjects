from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
import os
import json
from .orchestrator import PCATOrchestrator
from typing import Dict, Any

router = APIRouter(prefix="/api/pcat", tags=["pcat"])

# This will be injected from api_server.py
current_tickets_ref: Dict[str, Any] = {}
broadcast_func = None

def init_pcat_api(tickets: dict, broadcast: Any):
    global current_tickets_ref, broadcast_func
    current_tickets_ref = tickets
    broadcast_func = broadcast

def is_pcat_enabled():
    return os.getenv("ENABLE_PCAT", "true").lower() == "true"

@router.get("/health")
async def health():
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    return {"status": "ok", "message": "PCAT Engine Active"}

@router.get("/template/download")
async def download_template():
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    path = "backend/data/pcat/metadata_validation_template_mock.xlsx"
    if not os.path.exists(path):
        # Fallback to creating it if missing (though should be there)
        from create_pcat_template import create_mock_xlsx
        create_mock_xlsx()
    return FileResponse(path, filename="PCAT_Metadata_Validation_Template.xlsx")

@router.get("/tickets")
async def get_pcat_tickets():
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    pcat_tickets = [t for t in current_tickets_ref.values() if t.get("ticket_type") == "PCAT" or t.get("category") == "PCAT"]
    return {"tickets": pcat_tickets, "count": len(pcat_tickets)}

@router.get("/tickets/{ticket_id}/csv/download")
async def download_csv(ticket_id: str):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    ticket = current_tickets_ref.get(ticket_id)
    if not ticket or not ticket.get("pcat_csv_path"):
        raise HTTPException(status_code=404, detail="Ticket or CSV path not found")
    
    return FileResponse(ticket["pcat_csv_path"], filename=f"{ticket_id}_metadata.csv")

@router.post("/tickets/{ticket_id}/validate")
async def validate_ticket(ticket_id: str, background_tasks: BackgroundTasks):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    ticket = current_tickets_ref.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    csv_path = ticket.get("pcat_csv_path")
    if not csv_path or not os.path.exists(csv_path):
        raise HTTPException(status_code=400, detail="PCAT CSV file missing for this ticket")

    # Start validation in background
    background_tasks.add_task(run_pcat_pipeline, ticket_id, csv_path)
    
    return {"status": "success", "message": "PCAT Validation started"}

@router.get("/tickets/{ticket_id}/report/latest")
async def get_latest_report(ticket_id: str):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    report_path = f"backend/data/pcat/runs/{ticket_id}/latest_report.json"
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="No report found for this ticket")
    
    with open(report_path, 'r') as f:
        return json.load(f)

@router.get("/tickets/{ticket_id}/report/latest/download")
async def download_latest_report(ticket_id: str):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    report_path = f"backend/data/pcat/runs/{ticket_id}/latest_report.json"
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="No report found for this ticket")
    
    return FileResponse(report_path, filename=f"PCAT_Report_{ticket_id}.json")

async def run_pcat_pipeline(ticket_id: str, csv_path: str):
    openai_key = os.getenv("OPENAI_API_KEY")
    orchestrator = PCATOrchestrator(ticket_id, csv_path, openai_key)
    
    async def stage_update_callback(stage_idx: int, status: str, message: str, metrics: dict):
        if ticket_id in current_tickets_ref:
            ticket = current_tickets_ref[ticket_id]
            ticket["currentStage"] = stage_idx
            ticket["stages"][stage_idx]["status"] = status
            ticket["stages"][stage_idx]["message"] = message
            
            if status == "completed" and stage_idx == 7:
                ticket["status"] = "PCAT Validation Completed"
                ticket["pcat_summary"] = metrics
            
            if broadcast_func:
                await broadcast_func({
                    "type": "pcat_stage_update",
                    "ticket_id": ticket_id,
                    "stage_id": stage_idx,
                    "status": status,
                    "message": message,
                    "metrics": metrics,
                    "ticket": ticket # Send full ticket for UI ease
                })

    await orchestrator.run_validation(stage_update_callback)
