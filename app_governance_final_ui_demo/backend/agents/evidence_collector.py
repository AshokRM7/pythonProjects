# agents/evidence_collector.py
import smtplib
import json
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.models.ticket_context import TicketResponse

class EvidenceCollectorAgent:
    def __init__(self, llm=None, config_file=None):
        self.llm = llm
        # Load config.json
        self.config_file = config_file or os.path.join(
            os.path.dirname(__file__), "..", "..", "config", "config.json"
        )
        with open(self.config_file, "r") as f:
            config = json.load(f)
        self.smtp_config = config["smtp"]

    def prepare_email(self, ticket) -> MIMEMultipart:
        msg = MIMEMultipart()
        msg["From"] = self.smtp_config["user"]
        # Determine recipient: prefer contacts first, then application_owner, then default
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

    def send_email(self, msg: MIMEMultipart):
        try:
            with smtplib.SMTP(self.smtp_config["server"], self.smtp_config["port"]) as server:
                if self.smtp_config.get("use_tls", True):
                    server.starttls()
                server.login(self.smtp_config["user"], self.smtp_config["password"])
                server.send_message(msg)
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False

    def invoke(self, tickets: TicketResponse, send=False) -> dict:
        emails = []
        for t in tickets.tickets:
            msg = self.prepare_email(t)
            if send:
                status = self.send_email(msg)
                emails.append({"ticket_id": t.ticket_id, "status": "sent" if status else "failed"})
            else:
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
            t.currentStage = 6 # Move to Stage 7
            
        return {"emails": emails}

