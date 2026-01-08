from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
import os
import json
from .orchestrator import PCATOrchestrator
from .loader import PCATLoader
from .fix_engine import PCATFixEngine
from .csv_writer import PCATCSVWriter
from .mock_portal_clients import upload_to_pcat_portal, upload_to_rise_portal
from .models import PCATReportSummary, AppliedFix, Finding
from typing import Dict, Any, List
from pydantic import BaseModel

class ApplyFixesRequest(BaseModel):
    apply: bool = True
    upload_to_pcat: bool = True
    upload_to_rise: bool = True

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
                # This was the old Ticket Update, now Auto-Fix is 7, Upload is 8.
                # Validation pipeline ends at stage 6/7.
                # Stage 7 and 8 are triggered separately by apply endpoint.
                pass
            
            if status == "completed" and stage_idx == 6:
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

@router.get("/tickets/{ticket_id}/fixes/preview")
async def get_fix_preview(ticket_id: str):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    report_path = f"backend/data/pcat/runs/{ticket_id}/latest_report.json"
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Run validation first.")
    
    with open(report_path, 'r') as f:
        report_data = json.load(f)
        findings = [Finding(**f) for f in report_data.get("findings", [])]
    
    ticket = current_tickets_ref.get(ticket_id)
    if not ticket or not ticket.get("pcat_csv_path"):
        raise HTTPException(status_code=404, detail="CSV missing.")
    
    rows = PCATLoader.load_csv(ticket["pcat_csv_path"])
    preview = PCATFixEngine.preview_fixes(rows, findings)
    
    return {
        "ticket_id": ticket_id,
        "preview_count": len(preview),
        "fix_preview": preview,
        "blocked_items": []
    }

@router.post("/tickets/{ticket_id}/fixes/apply")
async def apply_fixes(ticket_id: str, req: ApplyFixesRequest):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    ticket = current_tickets_ref.get(ticket_id)
    if not ticket: raise HTTPException(status_code=404)
    
    report_path = f"backend/data/pcat/runs/{ticket_id}/latest_report.json"
    if not os.path.exists(report_path):
        raise HTTPException(status_code=400, detail="Validate first.")
    
    with open(report_path, 'r') as f:
        report_data = json.load(f)
        findings = [Finding(**f) for f in report_data.get("findings", [])]
        summary = PCATReportSummary(**report_data)
        
    rows = PCATLoader.load_csv(ticket["pcat_csv_path"])
    
    # Stage 7
    if broadcast_func:
        await broadcast_func({"type": "pcat_stage_update", "ticket_id": ticket_id, "stage_id": 7, "status": "in-progress", "message": "Applying fixes..."})
    
    updated_rows, applied_fixes = PCATFixEngine.apply_fixes(rows, findings)
    out_csv = f"backend/data/pcat/outputs/{ticket_id}_updated.csv"
    PCATCSVWriter.write_csv(out_csv, updated_rows)
    
    if broadcast_func:
        await broadcast_func({"type": "pcat_stage_update", "ticket_id": ticket_id, "stage_id": 7, "status": "completed", "message": f"Applied {len(applied_fixes)} fixes."})
    
    # Stage 8
    results = {}
    if req.upload_to_pcat:
        results["pcat_portal"] = upload_to_pcat_portal(ticket_id, out_csv)
    if req.upload_to_rise:
        results["rise_portal"] = upload_to_rise_portal(ticket_id, out_csv)
        
    if broadcast_func:
        await broadcast_func({
            "type": "pcat_stage_update", 
            "ticket_id": ticket_id, 
            "stage_id": 8, 
            "status": "completed", 
            "message": "Uploaded successfully.",
            "metrics": ticket.get("pcat_summary", {})
        })
    
    ticket["status"] = "Uploaded"
    ticket["currentStage"] = 8
    ticket["stages"][7]["status"] = "completed"
    ticket["stages"][8]["status"] = "completed"
    
    summary.applied_fixes = applied_fixes
    summary.upload_results = results
    summary.updated_csv_path = out_csv
    with open(report_path, 'w') as f:
        json.dump(summary.model_dump(), f, indent=2)
        
    return {"status": "ok", "applied_fixes": applied_fixes}

@router.get("/tickets/{ticket_id}/csv/updated/download")
async def download_updated_csv(ticket_id: str):
    path = f"backend/data/pcat/outputs/{ticket_id}_updated.csv"
    if not os.path.exists(path): raise HTTPException(status_code=404)
    return FileResponse(path, filename=f"{ticket_id}_fixed.csv")
