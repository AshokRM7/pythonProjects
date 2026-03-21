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
    body = ctx.body
    is_waiting_for_closure = ticket.get("waitingForClosureConfirmation", False)
    is_waiting_for_review_reply = ticket.get("waitingForAppOwnerConfirmation", False)
    is_waiting_for_decisions = ticket.get("waitingForBreOwnerDecisions", False)

    # ─── THE NEW CONSOLIDATED APPROVAL/REJECTION LOGIC (Direct Closure & Reset) ───
    # Reject/Cancel logic applies globally to any waiting state
    if decision == "REJECTED" or decision == "CANCELED":
        print(f"INFO: BRE Rejection/Cancellation received for {ticket_id}")
        # Reset to Start: Mark current stage as error and reset status to 'not-started'
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["status"] = "error"
            ticket["stages"][6]["message"] = f"❌ Rejected by App Owner ({sender}): {reason}. Resetting process."
        
        ticket["status"] = "not started"
        ticket["currentStage"] = 0
        
        # Reset all stages from index 1 (id 2) onwards to pending
        for i, s in enumerate(ticket["stages"]):
            if i > 0:
                s["status"] = "pending"
                s["message"] = ""
        
        ticket.pop("needsResendEmail", None)
        ticket.pop("waitingForAppOwnerConfirmation", None)
        ticket.pop("waitingForBreOwnerDecisions", None)
        ticket.pop("waitingForReview", None)
        ticket.pop("waitingForClosureConfirmation", None)
        ticket["isPollingActive"] = False
        
        ctx.stop_polling(ctx.ait_number)
        await ctx.broadcaster({"type": "ticket_update", "ticket": ticket})
        ctx.save_tickets()
        return

    # ─── CASE: Granular Decisions Parsing (Asking for Certify/Remove) ───
    if is_waiting_for_decisions:
        print(f"INFO: Parsing granular BRE decisions for {ticket_id}")
        
        # In a real scenario, use LLM to extract granular decisions.
        # For this implementation, we'll mark it as 'ALL_CERTIFIED' if the overall decision is positive
        # as a baseline, but indicate in the UI that decisions were received.
        
        ticket["bre_owner_decisions"] = "ALL_CERTIFIED" if decision == "APPROVED" else "MIXED_DECISIONS"
        ticket["waitingForBreOwnerDecisions"] = False
        ticket["status"] = "Decisions Received"
        
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["status"] = "in-progress"
            ticket["stages"][6]["message"] = f"✅ Decisions received from {sender}. Review them in the wizard to complete remediation."

        await ctx.broadcaster({"type": "ticket_update", "ticket": ticket})
        ctx.save_tickets()
        return

    # ─── CASE: Final Approval (Direct Closure) ───
    if (is_waiting_for_review_reply or is_waiting_for_closure) and decision == "APPROVED":
        print(f"INFO: BRE Final Approval received for {ticket_id}")
        # Direct Closure: Mark Evidence (6), Closure (7), and Logging (8) as completed
        if len(ticket["stages"]) > 6:
            ticket["stages"][6]["status"] = "completed"
            ticket["stages"][6]["message"] = f"✅ Approved by App Owner ({sender}): {reason}. Direct closure triggered."
        if len(ticket["stages"]) > 7:
            ticket["stages"][7]["status"] = "completed"
            ticket["stages"][7]["message"] = "✅ Auto-closed based on App Owner approval."
        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["status"] = "completed"
            ticket["stages"][8]["message"] = "✅ Execution results logged."
            
        ticket["currentStage"] = 7
        ticket["status"] = "completed"
        ticket.pop("needsResendEmail", None)
        ticket.pop("waitingForAppOwnerConfirmation", None)
        ticket.pop("waitingForBreOwnerDecisions", None)
        ticket.pop("waitingForReview", None)
        ticket.pop("waitingForClosureConfirmation", None)
        ticket["isPollingActive"] = False
        
        ctx.stop_polling(ctx.ait_number)
        await ctx.broadcaster({"type": "ticket_update", "ticket": ticket})
        ctx.save_tickets()
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
        ticket.pop("needsResendEmail", None)
        
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

