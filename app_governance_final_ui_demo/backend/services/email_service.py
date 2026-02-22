import smtplib
import os
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

def validate_emails(email_list):
    """Basic regex validation for email addresses."""
    regex = r'^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    valid_emails = []
    for email in email_list:
        e = email.strip().lower()
        if re.match(regex, e):
            valid_emails.append(e)
    return valid_emails

def send_email(to: list[str], subject: str, body: str) -> dict:
    """
    Sends an email using SMTP or simulates the process based on configuration.
    """
    sending_enabled = os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true"
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_username)
    
    valid_to = validate_emails(to)

    if not valid_to:
        return {"sent": False, "error": "No valid recipient email addresses found."}

    if not sending_enabled:
        print(f"DEBUG: Email sending is disabled. Simulating send to {valid_to}")
        return {
            "sent": False, 
            "mode": "simulated", 
            "recipients": valid_to,
            "timestamp": datetime.now().isoformat(),
            "message": "Email sending is simulated (EMAIL_SENDING_ENABLED=false)"
        }

    if not all([smtp_username, smtp_password]):
        return {"sent": False, "error": "SMTP credentials not configured in environment variables."}

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_from
        msg['To'] = ", ".join(valid_to)
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        
        server.sendmail(smtp_from, valid_to, msg.as_string())
        server.quit()

        return {
            "sent": True, 
            "mode": "smtp", 
            "recipients": valid_to,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"ERROR: Failed to send email: {e}")
        return {"sent": False, "error": str(e)}
