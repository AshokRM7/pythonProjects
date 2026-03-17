"""
email_service.py
-----------------
Sends email via Microsoft Outlook (COM automation) by invoking a PowerShell
script.  The Gmail/SMTP dependency has been fully removed.

How it works:
  1. Python calls subprocess.run() to execute Send-OutlookEmail.ps1
  2. The PowerShell script uses the Outlook COM object to send the message
     through the locally installed and authenticated Outlook client.
  3. The script prints a JSON result that Python parses and returns.

Prerequisites:
  - Microsoft Outlook must be installed, configured, and running on the machine.
  - PowerShell execution policy must allow script execution.
    To enable (run once as admin):
       Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
"""

import os
import re
import json
import subprocess
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Path to the PowerShell send script (relative to this file) ──────────────
# Resolves to: <project_root>/scripts/outlook/Send-OutlookEmail.ps1
_SCRIPT_DIR = Path(__file__).resolve().parents[2] / "scripts" / "outlook"
SEND_SCRIPT = str(_SCRIPT_DIR / "Send-OutlookEmail.ps1")


def validate_emails(email_list):
    """Basic regex validation for email addresses."""
    regex = r'^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
    valid_emails = []
    for email in email_list:
        e = email.strip().lower()
        if re.match(regex, e):
            valid_emails.append(e)
    return valid_emails


def send_email(to: list[str], subject: str, body: str) -> dict:
    """
    Send an email via Microsoft Outlook using a PowerShell COM automation script.

    Args:
        to      : List of recipient email addresses.
        subject : Email subject line.
        body    : Plain-text email body.

    Returns:
        dict with keys: sent (bool), mode, recipients, timestamp, error (on failure)
    """

    # ── Check whether real sending is enabled in .env ────────────────────────
    sending_enabled = os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true"

    # ── Validate recipients ───────────────────────────────────────────────────
    valid_to = validate_emails(to)

    if not valid_to:
        print(f"WARN: No valid recipient email addresses found in {to}. Check if addresses are SMTP format.")
        return {"sent": False, "error": "No valid recipient email addresses found."}

    # ── Simulate mode (EMAIL_SENDING_ENABLED=false) ───────────────────────────
    if not sending_enabled:
        print(f"DEBUG: Email sending disabled. Simulating send to {valid_to}")
        return {
            "sent": False,
            "mode": "simulated",
            "recipients": valid_to,
            "timestamp": datetime.now().isoformat(),
            "message": "Email sending is simulated (EMAIL_SENDING_ENABLED=false)"
        }

    # ── Verify the PowerShell script exists ───────────────────────────────────
    if not os.path.isfile(SEND_SCRIPT):
        return {
            "sent": False,
            "error": f"PowerShell send script not found: {SEND_SCRIPT}"
        }

    # ── Build the PowerShell command ──────────────────────────────────────────
    # Join multiple recipients with a comma so the PS script can split them.
    to_str = ",".join(valid_to)

    cmd = [
        "powershell.exe",
        "-NonInteractive",          # do not show any interactive prompts
        "-ExecutionPolicy", "Bypass",  # allow the script to run without policy changes
        "-File", SEND_SCRIPT,
        "-To", to_str,
        "-Subject", subject,
        "-Body", body,
    ]

    try:
        print(f"INFO: Invoking Outlook send script for: {valid_to}")
        result = subprocess.run(
            cmd,
            capture_output=True,    # capture stdout + stderr
            text=True,
            timeout=60              # wait up to 60 seconds for Outlook to send
        )

        # ── Parse JSON output from the PowerShell script ──────────────────────
        stdout = result.stdout.strip()
        try:
            ps_result = json.loads(stdout)
        except json.JSONDecodeError:
            # If the script didn't return clean JSON, treat as error
            ps_result = {"sent": False, "error": stdout or result.stderr.strip()}

        if ps_result.get("sent"):
            print(f"INFO: Outlook email sent successfully to {valid_to}")
            return {
                "sent": True,
                "mode": "outlook_com",
                "recipients": valid_to,
                "timestamp": datetime.now().isoformat()
            }
        else:
            err = ps_result.get("error", "Unknown PowerShell error")
            print(f"ERROR: Outlook send failed: {err}")
            return {"sent": False, "error": err}

    except subprocess.TimeoutExpired:
        return {"sent": False, "error": "PowerShell script timed out after 60 s"}
    except Exception as e:
        print(f"ERROR: Failed to invoke PowerShell script: {e}")
        return {"sent": False, "error": str(e)}
