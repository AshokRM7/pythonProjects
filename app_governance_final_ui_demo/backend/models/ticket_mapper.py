from typing import Any, Dict
from backend.models.ticket_context import Ticket, Stage

def convert_ticket_to_frontend(ticket: Ticket) -> dict:
    """Convert Pydantic Ticket model to frontend dictionary format"""
    raw_status = ticket.status.lower() if ticket.status else "not-started"
    # Status Defense: If we have progressed stages but status is still 'open' or 'not-started',
    # it means an agent clobbered the status. Promote to 'in-progress'.
    status = raw_status
    if (ticket.currentStage > 0 or any(s.status == 'completed' for s in (ticket.stages or []) if s.id > 1)) and raw_status in ["open", "not-started", "not started"]:
        status = "in-progress"

    return {
        "id": ticket.ticket_id,
        "title": ticket.description[:50] + "..." if len(ticket.description) > 50 else ticket.description,
        "description": ticket.description,
        "customer": ticket.application_owner or "Unknown",
        "priority": ticket.risk_level.lower() if ticket.risk_level else "medium",
        "status": status,
        "owner": ticket.owner,
        "createdAt": ticket.created_on,
        "currentStage": ticket.currentStage,
        "category": ticket.category,
        "subcategory": ticket.subcategory,
        "slaDeadline": ticket.sla_deadline,
        "aitNumber": ticket.ait_number,
        "deliverableType": ticket.deliverableType,
        "applicationName": ticket.application_name,
        "lobOwner": ticket.lob_owner,
        "aitOwner": ticket.ait_owner,
        "armId": ticket.arm_id,
        "contacts": ticket.contacts,
        "stages": [s.model_dump() for s in ticket.stages] if ticket.stages else [],
        # New Optional Fields
        "employeeId": ticket.employee_id,
        "userEmail": ticket.user_email,
        "target_system": ticket.target_system,
        "requested_action": ticket.requested_action,
        # PCAT Specific
        "pcat_csv_path": ticket.pcat_csv_path,
        "final_csv_ready": ticket.final_csv_ready,
        "final_csv_path": ticket.final_csv_path,
        "pcat_summary": ticket.pcat_summary,
        "ticket_type": ticket.ticket_type,
        "closure_approved": ticket.closure_approved,
        "waitingForClosureConfirmation": ticket.waitingForClosureConfirmation,
        "waitingForReview": ticket.waitingForReview,
        "waitingForAdminUpdate": ticket.waitingForAdminUpdate,
        "waitingForAppOwnerConfirmation": ticket.waitingForAppOwnerConfirmation,
        "lastProcessedEmailId": ticket.lastProcessedEmailId,
        "isPollingActive": ticket.isPollingActive,
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
        subcategory=data.get("subcategory"),
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
        stages=[Stage(**s) for s in data.get("stages", [])],
        employee_id=data.get("employeeId"),
        user_email=data.get("userEmail"),
        target_system=data.get("targetSystem"),
        requested_action=data.get("requestedAction"),
        final_csv_ready=data.get("final_csv_ready", False),
        final_csv_path=data.get("final_csv_path"),
        pcat_summary=data.get("pcat_summary"),
        ticket_type=data.get("ticket_type", "IAM"),
        closure_approved=data.get("closure_approved", False),
        waitingForClosureConfirmation=data.get("waitingForClosureConfirmation", False),
        waitingForReview=data.get("waitingForReview", False),
        waitingForAdminUpdate=data.get("waitingForAdminUpdate", False),
        waitingForAppOwnerConfirmation=data.get("waitingForAppOwnerConfirmation", False),
        lastProcessedEmailId=data.get("lastProcessedEmailId"),
        isPollingActive=data.get("isPollingActive", False)
    )
