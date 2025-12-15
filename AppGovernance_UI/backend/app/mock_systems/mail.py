from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from datetime import datetime

router = APIRouter(prefix="/mail", tags=["Mail"])

MAIL_LOG_FILE = "app/data/email_log.json"

class EmailRequest(BaseModel):
    to: str
    cc: str
    subject: str
    body: str

def load_logs():
    if not os.path.exists(MAIL_LOG_FILE):
        return []
    with open(MAIL_LOG_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_log(log_entry):
    logs = load_logs()
    logs.append(log_entry)
    with open(MAIL_LOG_FILE, "w") as f:
        json.dump(logs, f, indent=2)

@router.post("/send")
async def send_email(email: EmailRequest):
    # Mock sending email
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "to": email.to,
        "cc": email.cc,
        "subject": email.subject,
        "body": email.body,
        "status": "Sent"
    }
    save_log(log_entry)
    return {"status": "success", "message": "Email sent successfully"}

@router.get("/logs")
async def get_email_logs():
    return load_logs()
