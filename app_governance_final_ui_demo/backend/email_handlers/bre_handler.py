import asyncio
from . import EmailHandlerContext

async def handle_bre_reply(ctx: EmailHandlerContext) -> None:
    """
    Handle email replies for BRE-NEW deliverables.
    Stage 6 in the BRE workflow.
    """
    ticket = ctx.ticket
    ticket_id = ctx.ticket_id
    decision = ctx.decision
    reason = ctx.reason
    sender = ctx.sender
    
    if decision == "APPROVED":
        print(f"INFO: BRE-NEW Approval received for {ticket_id}")
        # Mark Stage 6 as completed
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["status"] = "completed"
            ticket["stages"][6]["message"] = f"✅ Approved by App Owner ({sender}): {reason}. Proceeding to Archive & Close."
        
        ticket["currentStage"] = 7
        ticket["status"] = "Remediated"
        ticket["waitingForAppOwnerConfirmation"] = False
        ticket["bre_remediation_completed"] = True
        ticket["inboxReplyReceived"] = True
        ticket["inboxReplyFrom"] = sender
        
        await ctx.broadcaster({
            "type": "bre_stage_update",
            "deliverable_id": ticket_id,
            "stage_id": 6,
            "status": "completed",
            "message": ticket["stages"][6]["message"] if len(ticket["stages"]) > 6 else "Approved",
            "ticket": ticket
        })
        
        # Trigger final Archive & Close logic via orchestrator if available
        from backend.bre.api import orchestrator as bre_orch
        asyncio.create_task(bre_orch.finalize_remediation_async(ticket_id))
        
        ctx.save_tickets()
        ctx.stop_polling(ctx.ait_number)
        return
        
    elif decision == "REJECTED":
        print(f"INFO: BRE-NEW Rejection received for {ticket_id}")
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["status"] = "failed"
            ticket["stages"][6]["message"] = f"❌ Rejected by App Owner ({sender}): {reason}. Manual review required."
        
        ticket["status"] = "Review Required"
        ticket["waitingForAppOwnerConfirmation"] = False
        ticket["inboxReplyReceived"] = True
        ticket["inboxReplyFrom"] = sender
        
        await ctx.broadcaster({
            "type": "bre_stage_update",
            "deliverable_id": ticket_id,
            "stage_id": 6,
            "status": "failed",
            "message": ticket["stages"][6]["message"] if len(ticket["stages"]) > 6 else "Rejected",
            "ticket": ticket
        })
        ctx.save_tickets()
        ctx.stop_polling(ctx.ait_number)
        return
        
    elif decision in ("DELAY", "WILL_UPDATE_LATER", "OUT_OF_OFFICE"):
        ticket["needsResendEmail"] = True
        
        msg_prefix = "⏳ Delay requested by"
        if decision == "OUT_OF_OFFICE":
            print(f"INFO: BRE-NEW OOO Reply received for {ticket_id}")
            msg_prefix = "🌴 OOO Reply received from"
            body_reason = "Out of Office (OOO) status"
        else:
            print(f"INFO: BRE-NEW Delay/Will Update requested for {ticket_id}")
            body_reason = "request for a delay"

        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["message"] = f"{msg_prefix} ({sender}): {reason}. Still polling..."
        
        deadline = ticket.get("sla_deadline", "the upcoming deadline")
        followup_body = (
            f"Dear User,\n\n"
            f"Thank you for the update regarding {ticket_id}.\n\n"
            f"We have noted your {body_reason}. We will keep the ticket open and continue monitoring. "
            f"However, please ensure the approval is provided as soon as possible to maintain our compliance SLA (Deadline: {deadline}).\n\n"
            f"We look forward to your response.\n\n"
            f"Regards,\n"
            f"App Governance Compliance Team"
        )
        
        from backend.services.email_service import send_email
        send_email([sender], f"Acknowledgment: Delay requested for {ticket_id}", followup_body)

        await ctx.broadcaster({
            "type": "bre_stage_update",
            "deliverable_id": ticket_id,
            "stage_id": 6,
            "status": "in-progress",
            "message": ticket["stages"][6]["message"] if len(ticket["stages"]) > 6 else f"{msg_prefix} {sender}",
            "ticket": ticket
        })
        ctx.save_tickets()
        return
        
    elif decision == "UPDATE_INFO":
        print(f"INFO: BRE-NEW Update information received for {ticket_id}")
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["message"] = f"📩 Information update received from {sender}: {reason}. Manual review required."
        
        ticket["status"] = "Review Required"
        ticket["waitingForAppOwnerConfirmation"] = False
        ticket["inboxReplyReceived"] = True
        ticket["inboxReplyFrom"] = sender
        
        await ctx.broadcaster({
            "type": "bre_stage_update",
            "deliverable_id": ticket_id,
            "stage_id": 6,
            "status": "in-progress",
            "message": ticket["stages"][6]["message"] if len(ticket["stages"]) > 6 else "Update Received",
            "ticket": ticket
        })
        ctx.save_tickets()
        ctx.stop_polling(ctx.ait_number)
        return

    elif decision == "UNCLEAR":
        print(f"INFO: BRE-NEW Unclear reply received for {ticket_id}")
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["message"] = f"❓ Ambiguous reply from App Owner ({sender}). Requesting clarification..."
        
        await ctx.broadcaster({
            "type": "bre_stage_update",
            "deliverable_id": ticket_id,
            "stage_id": 6,
            "status": "in-progress",
            "message": ticket["stages"][6]["message"] if len(ticket["stages"]) > 6 else "Unclear",
            "ticket": ticket
        })
        ctx.save_tickets()
        return

