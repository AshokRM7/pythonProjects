from . import EmailHandlerContext
from backend.services.email_service import send_email
from backend.models.ticket_context import TicketResponse
from backend.models.ticket_mapper import convert_frontend_to_ticket, convert_ticket_to_frontend

async def handle_arm_reply(ctx: EmailHandlerContext) -> None:
    """
    Handle email replies for ARM FORM NO ADMIN deliverables.
    Handles two distinct phases: Phase 1 (Stage 6 Review) and Phase 2 (Stage 7 Closure).
    Also handles delay requests and explicit admin updates.
    """
    ticket = ctx.ticket
    ticket_id = ctx.ticket_id
    decision = ctx.decision
    reason = ctx.reason
    sender = ctx.sender
    parsed_names = ctx.parsed_names
    
    is_waiting_for_review_reply = ticket.get("waitingForAppOwnerConfirmation", False)
    print(f"DEBUG: handle_arm_reply status: {ticket.get('status')}, waitingForAppOwnerConfirmation: {is_waiting_for_review_reply}, decision: {decision}")
    is_waiting_for_closure = ticket.get("waitingForClosureConfirmation", False)
    
    p_name = parsed_names.get("primary_admin_name", "").strip()
    s_name = parsed_names.get("secondary_admin_name", "").strip()
    is_admin_update = bool(p_name or s_name)

    # ─── THE NEW CONSOLIDATED APPROVAL/REJECTION LOGIC (Direct Closure & Reset) ───
    if (is_waiting_for_review_reply or is_waiting_for_closure) and decision in ("APPROVED", "REJECTED"):
        if decision == "APPROVED":
            print(f"INFO: ARM Approval received for {ticket_id}")
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
            ticket.pop("waitingForReview", None)
            ticket.pop("waitingForClosureConfirmation", None)
            ticket["isPollingActive"] = False
            
            ctx.stop_polling(ctx.ait_number)
            await ctx.broadcaster({"type": "ticket_update", "ticket": ticket})
            ctx.save_tickets()

        else: # REJECTED
            print(f"INFO: ARM Rejection received for {ticket_id}")
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
            ticket.pop("waitingForReview", None)
            ticket.pop("waitingForClosureConfirmation", None)
            ticket["isPollingActive"] = False
            
            ctx.stop_polling(ctx.ait_number)
            await ctx.broadcaster({"type": "ticket_update", "ticket": ticket})
            ctx.save_tickets()
        return

    # CASE 2: User Requested Delay or OOO
    if decision in ("DELAY", "WILL_UPDATE_LATER", "OUT_OF_OFFICE"):
        ticket["needsResendEmail"] = True
        
        msg_prefix = "⏳ Delay requested by"
        if decision == "OUT_OF_OFFICE":
            print(f"INFO: OOO Reply received for {ticket_id}")
            msg_prefix = "🌴 OOO Reply received from"
            body_reason = "Out of Office (OOO) status"
        else:
            print(f"INFO: User requested DELAY / WILL_UPDATE_LATER for {ticket_id}")
            body_reason = "request for a delay"
        
        deadline = ticket.get("sla_deadline", "the upcoming deadline")
        followup_body = (
            f"Dear User,\n\n"
            f"Thank you for the update regarding {ticket_id} ({ctx.ait_number}).\n\n"
            f"We have noted your {body_reason}. We will keep the ticket open and continue monitoring. "
            f"However, please ensure the required details are provided as soon as possible to maintain our compliance SLA (Deadline: {deadline}).\n\n"
            f"We look forward to your response.\n\n"
            f"Regards,\n"
            f"App Governance Compliance Team"
        )
        
        send_email([sender], f"Acknowledgment: Delay requested for {ticket_id}", followup_body)
        
        # Optional: update stage message but don't change stage status so it stays at in-progress
        if is_waiting_for_review_reply:
            await ctx.update_stage(ticket_id, 6, "in-progress", f"{msg_prefix} {sender}: {reason}. Waiting for App Owner...")
        elif is_waiting_for_closure:
            await ctx.update_stage(ticket_id, 7, "in-progress", f"{msg_prefix} {sender}: {reason}. Waiting for App Owner...")

        ctx.save_tickets() 
        
        await ctx.broadcaster({
            "type": "ticket_update",
            "ticket": ticket,
            "message": f"{msg_prefix} {sender}. Follow-up acknowledgment sent."
        })
        return

    # CASE 3: Admin Updates or explicit UPDATE_INFO
    if is_admin_update or decision == "UPDATE_INFO":
        print(f"DEBUG: handle_arm_reply matched CASE 3 (Admin Update). is_admin_update: {is_admin_update}, decision: {decision}")
        print(f"INFO: Update info received for {ticket_id}")
        
        p_id = parsed_names.get("primary_nbkid")
        s_id = parsed_names.get("secondary_nbkid")
        ctx.arm_admin_agent.update_admin_names(ctx.ait_number, p_name, p_id, s_name, s_id)

        ticket_obj = convert_frontend_to_ticket(ticket)
        ticket_context = TicketResponse(tickets=[ticket_obj])
        agent_result = ctx.arm_admin_agent.invoke(ticket_context)
        
        if agent_result.tickets:
            updated_ticket_obj = agent_result.tickets[0]
            updated_ticket = convert_ticket_to_frontend(updated_ticket_obj)
            updated_ticket["inboxReplyReceived"] = True
            updated_ticket["inboxReplyFrom"] = sender
            updated_ticket["inboxAdminData"] = parsed_names
            
            # Overwrite the global ticket reference implicitly by updating dictionary contents 
            # (assuming caller passed dict by reference)
            ticket.update(updated_ticket)
            
            rem_stage = next((s for s in updated_ticket_obj.stages if "IAM Remediation" in s.name), None)
            agent_feedback = rem_stage.message if rem_stage else "Processing your update..."
            is_done = (rem_stage.status == "completed") if rem_stage else False

            msg = f"📩 Update received from {sender}: {reason}. {agent_feedback}"
            
            if not is_done:
                # Trigger a re-run of the pipeline so it can see the new admin names
                await ctx.trigger_processing(ticket_id)
            else:
                ticket["waitingForAdminUpdate"] = False
                ticket.pop("needsResendEmail", None)  # Clear delay/waiting flag
                await ctx.update_stage(ticket_id, 5, "completed", msg)
                # Advance to next stage (Review)
                await ctx.trigger_processing(ticket_id)

            await ctx.broadcaster({
                "type": "ticket_update",
                "ticket": ticket,
                "message": msg
            })
            ctx.save_tickets()
            ctx.stop_polling(ctx.ait_number)
        return

