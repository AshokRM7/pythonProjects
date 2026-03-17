import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

OPENRouter_API_KEY = os.getenv("OPENAI_API_KEY")
OPENRouter_URL = "https://openrouter.ai/api/v1/chat/completions"

def extract_admin_details(email_body: str) -> dict:
    """
    Uses OpenRouter LLM to extract admin details from an email body.
    
    Returns a dict with:
        primary_admin_name
        primary_nbkid
        secondary_admin_name
        secondary_nbkid
    """
    
    api_key_env = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
    if not api_key_env:
        print("ERROR: API key not found in environment.")
        return {
            "primary_admin_name": "",
            "primary_nbkid": "",
            "secondary_admin_name": "",
            "secondary_nbkid": ""
        }
    
    # Strip whitespace/quotes if present due to .env formatting
    api_key = api_key_env.strip().strip('"').strip("'")

    if api_key.startswith("sk-or"):
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        model_name = "google/gemini-2.0-flash-lite-001"
    else:
        api_url = "https://api.openai.com/v1/chat/completions"
        model_name = "gpt-4o-mini"

    prompt = f"""
    Extract the following details from the email body provided below. 
    The NBKID must be exactly 7 alphanumeric characters. 
    
    Email Body:
    \"\"\"{email_body}\"\"\"
    
    Return the result as a JSON OBJECT with the following keys:
    - primary_admin_name
    - primary_nbkid
    - secondary_admin_name
    - secondary_nbkid

    CRITICAL INSTRUCTIONS:
    1. If a field is missing, return an empty string "". 
    2. DO NOT return null.
    3. IMPORTANT: DO NOT extract names from the signature line (e.g., "Best, Murali" or "Thanks, Murali").
    4. ONLY extract names if they are explicitly provided as the new or corrected admin names for the application.
    5. If the email contains a phrase like "Good to close" or "Verified", and NO admin names are explicitly listed for update, return empty strings for all fields.
    6. CRITICAL: If the email body appears to be an automated system notification (e.g., starts with "Dear User", contains "[ACTION REQUIRED]", or is signed by "App Governance Compliance Team"), and does NOT contain a clear reply from a human, IGNORE it and return empty strings.

    Example:
    {{
        "primary_admin_name": "Vel Murugan",
        "primary_nbkid": "NBK007Y",
        "secondary_admin_name": "John Smith",
        "secondary_nbkid": "NBK1234"
    }}
    """

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000"
    }

    payload = {
        "model": model_name,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        content = data['choices'][0]['message']['content']
        
        # Strip markdown formatting if present
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```json"):
                content = "\n".join(lines[1:-1])
            elif lines[0].startswith("```"):
                content = "\n".join(lines[1:-1])
        
        result = json.loads(content)
        
        if isinstance(result, list) and len(result) > 0:
            result = result[0]
        
        # Handle cases where the LLM still returns JSON null by converting None to ""
        def _safe_str(val):
            if val is None or val == "null" or val == "None":
                return ""
            return str(val).strip()
            
        return {
            "primary_admin_name": _safe_str(result.get("primary_admin_name")),
            "primary_nbkid": _safe_str(result.get("primary_nbkid")),
            "secondary_admin_name": _safe_str(result.get("secondary_admin_name")),
            "secondary_nbkid": _safe_str(result.get("secondary_nbkid"))
        }

    except Exception as e:
        print(f"ERROR: LLM extraction failed: {str(e)}")
        return {
            "primary_admin_name": "",
            "primary_nbkid": "",
            "secondary_admin_name": "",
            "secondary_nbkid": ""
        }

def check_closure_response(email_body: str) -> dict:
    """
    Uses LLM to determine the user's intent regarding ticket closure.
    Returns a dict with:
        decision: "APPROVED", "REJECTED", "UPDATE_INFO", or "UNCLEAR"
        reason: Short explanation
    """
    api_key_env = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
    if not api_key_env:
        return {"decision": "UNCLEAR", "reason": "No API key"}
    
    api_key = api_key_env.strip().strip('"').strip("'")
    if api_key.startswith("sk-or"):
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        model_name = "google/gemini-2.0-flash-lite-001"
    else:
        api_url = "https://api.openai.com/v1/chat/completions"
        model_name = "gpt-4o-mini"

    prompt = f"""
    Analyze the following email response regarding a ticket closure or admin details update.
    
    Email Body:
    \"\"\"{email_body}\"\"\"
    
    Determine the user's intent and return a JSON object:
    {{
        "decision": "APPROVED" | "REJECTED" | "UPDATE_INFO" | "DELAY" | "UNCLEAR",
        "reason": "short explanation"
    }}

    Rules for Decision:
    - APPROVED: The user explicitly says "close", "verified", "proceed", "looks good", "correct", or "approved".
    - REJECTED: The user says "don't close", "stop", "incorrect", "cancel", "not right", or "rejected".
    - UPDATE_INFO: The user provides new names, NBKIDs, or says "change details to...", "update to...".
    - DELAY: The user says "wait", "give me time", "will provide later", "yet to provide", "in a few hours", "tomorrow".
    - UNCLEAR: The response is empty, garbage, unrelated, or too ambiguous to act upon. 
    
    IMPORTANT: If the email body is clearly an outgoing system notification (e.g. "Dear User, we have identified a gap...", "Regards, App Governance Team"), and it does not contain a nested human reply, then classify it as UNCLEAR.

    Example:
    {{
        "decision": "APPROVED",
        "reason": "User confirmed verification and asked to proceed."
    }}
    """

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000"
    }

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=15)
        response.raise_for_status()
        data = response.json()
        content = data['choices'][0]['message']['content']
        result = json.loads(content)
        return {
            "decision": result.get("decision", "UNCLEAR").upper(),
            "reason": result.get("reason", "No reason provided")
        }
    except Exception as e:
        print(f"DEBUG: LLM closure check failed: {e}")
        return {"decision": "UNCLEAR", "reason": str(e)}
