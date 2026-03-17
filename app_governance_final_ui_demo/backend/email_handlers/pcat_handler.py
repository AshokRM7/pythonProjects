import os
from . import EmailHandlerContext

async def handle_pcat_reply(ctx: EmailHandlerContext) -> None:
    """
    Handle email replies for PCAT deliverables.
    Stage 8 in the PCAT workflow.
    """
    ticket = ctx.ticket
    ticket_id = ctx.ticket_id
    decision = ctx.decision
    reason = ctx.reason
    sender = ctx.sender
    
    if decision == "APPROVED":
        print(f"INFO: PCAT Approval received for {ticket_id}")
        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["status"] = "completed"
        
        # Execute final portal uploads
        from backend.pcat.mock_portal_clients import upload_to_pcat_portal, upload_to_rise_portal
        csv_path = ticket.get("final_csv_path")
        
        ticket["currentStage"] = 8
        ticket["status"] = "Completed"
        ticket["inboxReplyReceived"] = True
        ticket["inboxReplyFrom"] = sender
        
        if csv_path and os.path.exists(csv_path):
            upload_to_pcat_portal(ticket_id, csv_path)
            upload_to_rise_portal(ticket_id, csv_path)
            msg = f"✅ Approved by App Owner ({sender}): {reason}. Evidence successfully uploaded to PCAT & RISE portals."
        else:
            msg = f"✅ Approved by App Owner ({sender}): {reason}. Uploaded to portals (simulated)."
            
        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["message"] = msg
            
        await ctx.broadcaster({
            "type": "pcat_stage_update",
            "ticket_id": ticket_id,
            "stage_id": 8,
            "status": "completed",
            "message": ticket["stages"][8]["message"] if len(ticket["stages"]) > 8 else msg,
            "ticket": ticket
        })
        ctx.save_tickets()
        ctx.stop_polling(ctx.ait_number)
        return
        
    elif decision == "REJECTED":
        print(f"INFO: PCAT Rejection received for {ticket_id}")
        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["status"] = "failed"
            ticket["stages"][8]["message"] = f"❌ Rejected by App Owner ({sender}): {reason}. Manual adjustment required."
            
        ticket["status"] = "Review Required"
        ticket["inboxReplyReceived"] = True
        ticket["inboxReplyFrom"] = sender
        
        await ctx.broadcaster({
            "type": "pcat_stage_update",
            "ticket_id": ticket_id,
            "stage_id": 8,
            "status": "failed",
            "message": ticket["stages"][8]["message"] if len(ticket["stages"]) > 8 else "Rejected",
            "ticket": ticket
        })
        ctx.save_tickets()
        ctx.stop_polling(ctx.ait_number)
        return
        
    elif decision in ("DELAY", "WILL_UPDATE_LATER", "OUT_OF_OFFICE"):
        ticket["needsResendEmail"] = True
        
        msg_prefix = "⏳ Delay requested by"
        if decision == "OUT_OF_OFFICE":
            print(f"INFO: PCAT OOO Reply received for {ticket_id}")
            msg_prefix = "🌴 OOO Reply received from"
            body_reason = "Out of Office (OOO) status"
        else:
            print(f"INFO: PCAT Delay/Will Update requested for {ticket_id}")
            body_reason = "request for a delay"

        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["message"] = f"{msg_prefix} ({sender}): {reason}. Still polling..."
        
        # Send follow-up email
        followup_body = (
            f"Dear App Owner,\n\n"
            f"Thank you for the update regarding {ticket_id}.\n\n"
            f"We have noted your {body_reason}. We currently await your final approval "
            f"to proceed with the PCAT evidence upload to the portals.\n\n"
            f"Please reply with 'Approved' or 'Good to close' as soon as possible to avoid further delays in the compliance process.\n\n"
            f"Regards,\n"
            f"App Governance Compliance Team"
        )
        from backend.services.email_service import send_email
        send_email([sender], f"Reminder: Approval Required for {ticket_id}", followup_body)

        await ctx.broadcaster({
            "type": "pcat_stage_update",
            "ticket_id": ticket_id,
            "stage_id": 8,
            "status": "in-progress",
            "message": ticket["stages"][8]["message"] if len(ticket["stages"]) > 8 else "Waiting",
            "ticket": ticket
        })
        ctx.save_tickets()
        return
    elif decision == "UPDATE_INFO":
        print(f"INFO: PCAT Update information received for {ticket_id}")
        msg = f"📩 Information update received from {sender}: {reason}. Manual review required."
        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["message"] = msg
            
        ticket["status"] = "Review Required"
        ticket["inboxReplyReceived"] = True
        ticket["inboxReplyFrom"] = sender
        
        await ctx.broadcaster({
            "type": "pcat_stage_update",
            "ticket_id": ticket_id,
            "stage_id": 8,
            "status": "in-progress",
            "message": msg,
            "ticket": ticket
        })
        ctx.save_tickets()
        ctx.stop_polling(ctx.ait_number)
        return

    elif decision == "UNCLEAR":
        print(f"INFO: PCAT Unclear reply received for {ticket_id}")
        if len(ticket["stages"]) > 8:
            ticket["stages"][8]["message"] = f"❓ Ambiguous reply from App Owner ({sender}). Requesting clarification..."
        
        await ctx.broadcaster({
            "type": "pcat_stage_update",
            "ticket_id": ticket_id,
            "stage_id": 8,
            "status": "in-progress",
            "message": ticket["stages"][8]["message"] if len(ticket["stages"]) > 8 else "Unclear",
            "ticket": ticket
        })
        ctx.save_tickets()
        return


