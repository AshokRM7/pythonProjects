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
    subcategory: Optional[str] = None  # For hierarchical categories (e.g., PCAT under IAM)
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
    # New Optional Fields
    employee_id: Optional[str] = None
    user_email: Optional[str] = None
    target_system: Optional[str] = None
    requested_action: Optional[str] = None
    # PCAT Fields
    ticket_type: Optional[str] = "IAM" # Default to IAM
    pcat_csv_path: Optional[str] = None
    pcat_summary: Optional[dict] = None
    final_csv_ready: Optional[bool] = False
    final_csv_path: Optional[str] = None
    closure_approved: Optional[bool] = False
    waitingForClosureConfirmation: Optional[bool] = False

class TicketResponse(BaseModel):
    tickets: List[Ticket]
