"""
inbox_reader.py
---------------
Reads the Outlook Inbox using Read-OutlookEmails.ps1 (COM automation) and
extracts the admin name payload from a reply email.

How it works:
  1. Python calls subprocess.run() to execute Read-OutlookEmails.ps1
  2. The script filters emails by subject keyword (ticket / AIT number)
  3. Python parses the JSON output and extracts admin name fields from the body

Prerequisites (same as email_service.py):
  - Microsoft Outlook must be installed, signed-in, and running.
  - PowerShell execution policy must allow scripts:
      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
"""

import os
import re
import json
import subprocess
from pathlib import Path
from backend.services.llm_parser import extract_admin_details, check_closure_response

def strip_original_thread(body: str) -> str:
    """
    Remove quoted messages, 'From:', and line separators to isolate the latest reply.
    """
    if not body:
        return ""
    
    # Common separators with regex for case-insensitivity and flexibility
    patterns = [
        r"-+\s*Original Message\s*-+",
        r"_{10,}",
        r"^From:",
        r"^Sent:",
        r"Sent from my (iPhone|Android)",
        r"Get Outlook for (iOS|Android)"
    ]
    
    lines = body.splitlines()
    clean_lines = []
    
    for line in lines:
        is_sep = False
        for p in patterns:
            if re.search(p, line, re.IGNORECASE):
                is_sep = True
                break
        if is_sep:
            break
        clean_lines.append(line)
    
    return "\n".join(clean_lines).strip()

# ─── Path to the PowerShell read script ───────────────────────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parents[2] / "scripts" / "outlook"
READ_SCRIPT = str(_SCRIPT_DIR / "Read-OutlookEmails.ps1")

# ─── Regex patterns for structured reply parsing ───────────────────────────────
# We expect the App Owner to reply using the template we embed in the outgoing email:
#
#   Primary Admin Name: John Doe
#   Primary Admin NBKID: NBK1234
#   Secondary Admin Name: Jane Smith
#   Secondary Admin NBKID: NBK5678
#
_PATTERNS = {
    "primary_admin_name":   re.compile(r"Primary Admin Name\s*[:\-]\s*(.+)", re.IGNORECASE),
    "primary_nbkid":        re.compile(r"Primary Admin NBKID\s*[:\-]\s*(\S+)", re.IGNORECASE),
    "secondary_admin_name": re.compile(r"Secondary Admin Name\s*[:\-]\s*(.+)", re.IGNORECASE),
    "secondary_nbkid":      re.compile(r"Secondary Admin NBKID\s*[:\-]\s*(\S+)", re.IGNORECASE),
}


def parse_admin_names_from_body(body: str) -> dict:
    """
    Parse admin name fields from an email body using LLM.
    Supports varied formats as it uses a generative model for extraction.

    Returns a dict with keys: primary_admin_name, primary_nbkid,
    secondary_admin_name, secondary_nbkid. Missing fields are empty strings.
    """
    # 1. Try regex first (very fast, handles exact template match)
    result = {
        "primary_admin_name":   "",
        "primary_nbkid":        "",
        "secondary_admin_name": "",
        "secondary_nbkid":      "",
    }

    found_all = True
    for field, pattern in _PATTERNS.items():
        match = pattern.search(body)
        if match:
            val = match.group(1).strip()
            # Ignore the default template placeholders
            if val in ("[Full Name]", "[7-char NBKID]"):
                found_all = False
            else:
                result[field] = val
        else:
            found_all = False

    # 2. If regex didn't find everything, or if we want high confidence, use LLM
    if not found_all:
        print("DEBUG: Regex parsing incomplete or failed. Falling back to LLM extraction.")
        llm_result = extract_admin_details(body)
        # Update missing fields from LLM results
        for key in result:
            if not result[key] and llm_result.get(key):
                result[key] = llm_result[key]

    return result


def get_closure_decision(body: str) -> dict:
    """
    Check if the email body contains an affirmation or rejection for ticket closure.
    Performs purely contextual/semantic analysis via LLM on the isolated human reply.
    
    Returns a dict with 'decision' (APPROVED, REJECTED, UPDATE_INFO, UNCLEAR) and 'reason'.
    """
    # LLM-only contextual analysis as requested
    clean_body = strip_original_thread(body)
    print(f"DEBUG: Calling LLM for comprehensive intent analysis. Clean Body: {clean_body[:300]}...")
    res = check_closure_response(clean_body)
    print(f"DEBUG: LLM Response for intent: {res}")
    return res

def is_closure_affirmation(body: str) -> bool:
    """Legacy wrapper for boolean checks"""
    decision = get_closure_decision(body)
    return decision["decision"] == "APPROVED"


def read_inbox_for_ticket(subject_filter: str, max_emails: int = 50) -> list:
    """
    Call Read-OutlookEmails.ps1 and return emails whose subject contains
    `subject_filter` (case-insensitive match done by the PS1 script).

    Args:
        subject_filter: Keyword to filter by (e.g. ticket ID "REQ-5001" or AIT "AIT-5001").
        max_emails:     Maximum number of recent inbox items to scan.

    Returns:
        List of email dicts (Subject, Body, SenderEmail, ReceivedTime, …).
        Returns an empty list on any error so callers can handle gracefully.
    """
    sending_enabled = os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true"
    if not sending_enabled:
        # Simulated mode — no Outlook needed, polling is a no-op.
        print(f"DEBUG: Inbox polling skipped (EMAIL_SENDING_ENABLED=false) for filter='{subject_filter}'")
        return []

    if not os.path.isfile(READ_SCRIPT):
        print(f"ERROR: PowerShell read script not found: {READ_SCRIPT}")
        return []

    cmd = [
        "powershell.exe",
        "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-File", READ_SCRIPT,
        "-MaxEmails", str(max_emails),
        "-SubjectFilter", subject_filter,
    ]

    try:
        print(f"INFO: Polling Outlook inbox with SubjectFilter='{subject_filter}'")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
        )

        stdout = proc.stdout.strip()
        if not stdout:
            print(f"WARN: Read-OutlookEmails.ps1 returned empty output (stderr: {proc.stderr.strip()[:200]})")
            return []

        envelope = json.loads(stdout)

        if not envelope.get("success"):
            print(f"ERROR: PS1 script error: {envelope.get('error')}")
            return []

        emails = envelope.get("emails", [])
        print(f"INFO: Found {len(emails)} matching email(s) for filter='{subject_filter}'")
        return emails

    except subprocess.TimeoutExpired:
        print("ERROR: Read-OutlookEmails.ps1 timed out after 60 s")
        return []
    except json.JSONDecodeError as exc:
        print(f"ERROR: Could not parse PS1 JSON output: {exc}")
        return []
    except Exception as exc:
        print(f"ERROR: Failed to invoke inbox read script: {exc}")
        return []
