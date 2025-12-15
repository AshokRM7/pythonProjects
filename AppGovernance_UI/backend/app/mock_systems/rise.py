from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import json
import os

router = APIRouter(prefix="/rise", tags=["RISE"])

TICKETS_FILE = "app/data/tickets.json"

# In-memory cache for speed, can be refreshed from file if needed
def load_tickets():
    if not os.path.exists(TICKETS_FILE):
        return []
    with open(TICKETS_FILE, "r") as f:
        return json.load(f)

# Note: In a real app with multiple workers, in-memory sync issues would occur.
# For this single-process demo, a global variable is acceptable if we want persistence 
# during the session, but we should write back to file for restart persistence.
tickets_cache = load_tickets()

def save_tickets():
    with open(TICKETS_FILE, "w") as f:
        json.dump(tickets_cache, f, indent=2)

class TicketStatusUpdate(BaseModel):
    status: str

class TicketEvidence(BaseModel):
    evidence: str

@router.get("/tickets")
async def get_tickets(status: Optional[str] = None):
    # Reload to ensure fresh state if modified elsewhere
    # tickets_cache = load_tickets() 
    if status:
        return [t for t in tickets_cache if t["status"] == status]
    return tickets_cache

@router.get("/tickets/{id}")
async def get_ticket(id: str):
    ticket = next((t for t in tickets_cache if t["id"] == id), None)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@router.post("/tickets/{id}/status")
async def update_ticket_status(id: str, payload: TicketStatusUpdate):
    ticket = next((t for t in tickets_cache if t["id"] == id), None)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket["status"] = payload.status
    save_tickets()
    return {"status": "success", "ticket": ticket}

@router.post("/tickets/{id}/evidence")
async def add_evidence(id: str, payload: TicketEvidence):
    ticket = next((t for t in tickets_cache if t["id"] == id), None)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if "evidence" not in ticket:
        ticket["evidence"] = []
    
    ticket["evidence"].append(payload.evidence)
    save_tickets()
    return {"status": "success", "message": "Evidence added"}
