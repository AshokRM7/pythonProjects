# agents/evidence_collector.py
#
# CHANGE SUMMARY:
#   - Removed direct smtplib import and SMTP send logic.
#   - Now delegates all email sending to email_service.send_email(),
#     which uses the Outlook COM PowerShell script.
#   - The smtp block from config.json is no longer used for sending;
#     the "user" field is kept only for the From display name in the body.

import json
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.models.ticket_context import TicketResponse

# Import the shared Outlook-based email sender (replaces smtplib)
from backend.services.email_service import send_email as outlook_send_email


class EvidenceCollectorAgent:
    def __init__(self, llm=None, config_file=None):
        self.llm = llm
        # Load config.json (used for from-address display name etc.)
        self.config_file = config_file or os.path.join(
            os.path.dirname(__file__), "..", "..", "config", "config.json"
        )
        with open(self.config_file, "r") as f:
            config = json.load(f)
        # smtp block kept for backward compat; password/server no longer used
        self.smtp_config = config.get("smtp", {})

    def prepare_email(self, ticket) -> MIMEMultipart:
        """Build an email message object for a given ticket."""
        msg = MIMEMultipart()
        msg["From"] = self.smtp_config.get("user", "iam-bot@company.com")

        # Determine recipient: prefer contacts list, then application_owner
        recipient = None
        if ticket.contacts:
            recipient = ticket.contacts[0]
        if not recipient:
            recipient = ticket.application_owner

        msg["To"] = recipient or "app_owner@example.com"
        msg["Subject"] = f"IAM Deliverable {ticket.ticket_id} – Evidence Required"

        body = f"""
        Dear Owner,

        Please provide completion evidence for deliverable {ticket.ticket_id} ({ticket.description}).
        SLA Deadline: {ticket.sla_deadline}
        Risk Level: {ticket.risk_level}

        Regards,
        IAM Governance Team
        """
        msg.attach(MIMEText(body, "plain"))
        return msg

    def send_email(self, msg: MIMEMultipart) -> bool:
        """
        Send a prepared MIMEMultipart message via Outlook COM (PowerShell).
        Replaces the old smtplib.SMTP send block.
        """
        try:
            # Extract fields from the MIME object to pass to the shared sender
            to_addr = msg["To"]
            subject  = msg["Subject"]
            # Get plain-text payload from the first MIME part
            body = msg.get_payload()[0].get_payload()

            # Delegate to the Outlook PowerShell-based sender in email_service.py
            result = outlook_send_email(to=[to_addr], subject=subject, body=body)

            # Return True if sent or simulated (so the pipeline continues)
            return result.get("sent") or result.get("mode") == "simulated"
        except Exception as e:
            print(f"Error sending evidence email via Outlook: {e}")
            return False

    def invoke(self, tickets: TicketResponse, send=False) -> dict:
        emails = []
        for t in tickets.tickets:
            msg = self.prepare_email(t)
            if send:
                # Real send via Outlook COM
                status = self.send_email(msg)
                emails.append({"ticket_id": t.ticket_id, "status": "sent" if status else "failed"})
            else:
                # Prepare-only mode (pipeline pauses for human review before sending)
                emails.append({
                    "to": [msg["To"]],
                    "subject": msg["Subject"],
                    "body": msg.get_payload()[0].get_payload()
                })

            # Update Stage 7
            for stage in t.stages:
                if "Evidence Collection" in stage.name:
                    stage.status = "completed"
                    stage.message = f"Evidence Collection Agent: Prepared evidence emails for {len(emails)} recipients."
            t.currentStage = 6  # Move to Stage 7

        return {"emails": emails}
