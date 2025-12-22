from pydantic import BaseModel
from typing import List, Optional

class Stage(BaseModel):
    id: int
    name: str
    status: str = "pending"
    message: str = ""

class Ticket(BaseModel):
    ticket_id: str
    ait_number: str
    deliverableType: str
    category: str
    risk_level: str
    sla_deadline: str
    created_on: str
    description: str
    arm_id: str
    application_name: str
    application_owner: str
    lob_owner: str
    ait_owner: str
    contacts: List[str]
    status: str = "Open"
    owner: str = "Unassigned"
    currentStage: int = 0
    stages: List[Stage] = []

class TicketResponse(BaseModel):
    tickets: List[Ticket]
