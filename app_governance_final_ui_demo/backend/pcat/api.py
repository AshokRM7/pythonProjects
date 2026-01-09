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
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

class Decision(BaseModel):
    fix_id: str
    decision: str # ACCEPTED, REJECTED

class ApplyFixesRequest(BaseModel):
    apply: bool = True
    upload_to_pcat: bool = True
    upload_to_rise: bool = True
    fixes: Optional[List[Decision]] = None

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
            
            if status == "completed" and stage_idx == 6:
                ticket["status"] = "PCAT Validation Completed"
                ticket["pcat_summary"] = metrics
                
                # ENHANCEMENT 1: Pause at Stage 7 for confirmation
                ticket["currentStage"] = 7
                ticket["stages"][7]["status"] = "awaiting_confirmation"
                ticket["stages"][7]["message"] = "Awaiting user confirmation to apply fixes"
                
                # Pre-generate fixes for pending list
                rows = PCATLoader.load_csv(csv_path)
                report_path = f"backend/data/pcat/runs/{ticket_id}/latest_report.json"
                if os.path.exists(report_path):
                    with open(report_path, 'r') as f:
                        report_data = json.load(f)
                        findings = [Finding(**f) for f in report_data.get("findings", [])]
                        ticket["pending_fixes"] = [f.model_dump() for f in PCATFixEngine.preview_fixes(rows, findings)]
                
                if broadcast_func:
                    await broadcast_func({
                        "type": "pcat.awaiting_confirmation",
                        "ticket_id": ticket_id,
                        "message": "Review and confirm fixes to continue",
                        "ticket": ticket
                    })
            
            if broadcast_func:
                await broadcast_func({
                    "type": "pcat_stage_update",
                    "ticket_id": ticket_id,
                    "stage_id": stage_idx,
                    "status": status,
                    "message": message,
                    "metrics": metrics,
                    "ticket": ticket
                })

    await orchestrator.run_validation(stage_update_callback)

@router.post("/tickets/{ticket_id}/fixes/decisions")
async def save_fix_decisions(ticket_id: str, decisions: List[Decision]):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    ticket = current_tickets_ref.get(ticket_id)
    if not ticket: raise HTTPException(status_code=404)
    
    pending = ticket.get("pending_fixes", [])
    decision_map = {d.fix_id: d.decision for d in decisions}
    
    for fix in pending:
        if fix["fix_id"] in decision_map:
            fix["user_decision"] = decision_map[fix["fix_id"]]
            
    ticket["pending_fixes"] = pending
    return {"status": "ok", "message": f"Updated {len(decisions)} decisions"}

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
        await broadcast_func({"type": "pcat_stage_update", "ticket_id": ticket_id, "stage_id": 7, "status": "in-progress", "message": "Applying accepted fixes and rebuilding CSV...", "ticket": ticket})
    
    manual_fixes = []
    if req.fixes:
        decision_map = {d.fix_id: d.decision for d in req.fixes}
        for f_data in ticket.get("pending_fixes", []):
            f_obj = AppliedFix(**f_data)
            if f_obj.fix_id in decision_map:
                f_obj.user_decision = decision_map[f_obj.fix_id]
            manual_fixes.append(f_obj)
    else:
        manual_fixes = [AppliedFix(**f) for f in ticket.get("pending_fixes", [])]

    updated_rows, applied_fixes = PCATFixEngine.apply_fixes(rows, findings, manual_fixes=manual_fixes)
    out_csv = f"backend/data/pcat/pcat_ticket_{ticket_id}_final.csv"
    PCATCSVWriter.write_csv(out_csv, updated_rows)
    
    if broadcast_func:
        await broadcast_func({"type": "pcat_stage_update", "ticket_id": ticket_id, "stage_id": 7, "status": "completed", "message": f"Applied {len(applied_fixes)} fixes. CSV rebuilt.", "ticket": ticket})
    
    # Stage 8
    results = {}
    if req.upload_to_pcat:
        if broadcast_func:
            await broadcast_func({"type": "pcat_stage_update", "ticket_id": ticket_id, "stage_id": 8, "status": "in-progress", "message": "Uploading to PCAT...", "ticket": ticket})
        results["pcat_portal"] = upload_to_pcat_portal(ticket_id, out_csv)
    
    if req.upload_to_rise:
        if broadcast_func:
            await broadcast_func({"type": "pcat_stage_update", "ticket_id": ticket_id, "stage_id": 8, "status": "in-progress", "message": "Uploading to RISE...", "ticket": ticket})
        results["rise_portal"] = upload_to_rise_portal(ticket_id, out_csv)

    # NEW: Store final CSV metadata for frontend BEFORE final broadcast
    ticket["final_csv_path"] = out_csv
    ticket["final_csv_ready"] = True
    ticket["status"] = "PCAT Validation Completed"
    ticket["currentStage"] = 8
    ticket["stages"][7]["status"] = "completed"
    ticket["stages"][8]["status"] = "completed"

    if broadcast_func:
        await broadcast_func({
            "type": "pcat_stage_update", 
            "ticket_id": ticket_id, 
            "stage_id": 8, 
            "status": "completed", 
            "message": "Upload completed.",
            "metrics": ticket.get("pcat_summary", {}),
            "ticket": ticket
        })
    
    summary.applied_fixes = applied_fixes
    summary.upload_results = results
    summary.updated_csv_path = out_csv
    with open(report_path, 'w') as f:
        json.dump(summary.model_dump(), f, indent=2)
        
    return {
        "status": "ok", 
        "applied_fixes": applied_fixes,
        "ticket_id": ticket_id,
        "final_csv_ready": True,
        "final_csv_download_url": f"/api/pcat/tickets/{ticket_id}/csv/final/download",
        "final_csv_filename": f"{ticket_id}_updated.csv"
    }

@router.get("/tickets/{ticket_id}/csv/final/download")
async def download_final_csv(ticket_id: str):
    if not is_pcat_enabled():
        return JSONResponse(status_code=403, content={"error": "PCAT is disabled"})
    
    ticket = current_tickets_ref.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    path = ticket.get("final_csv_path")
    ready = ticket.get("final_csv_ready", False)
    
    if not ready or not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Final CSV not ready or missing. Apply fixes first.")
        
    return FileResponse(path, filename=f"{ticket_id}_updated.csv")
