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
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        
        if 'choices' not in data or not data['choices']:
            print(f"ERROR: LLM response missing 'choices': {json.dumps(data)}")
            return {
                "primary_admin_name": "",
                "primary_nbkid": "",
                "secondary_admin_name": "",
                "secondary_nbkid": ""
            }

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
    Analyze the following email response to determine the sender's semantic intent regarding a ticket review or closure request.
    
    Email Body (isolated human reply):
    \"\"\"{email_body}\"\"\"
    
    The goal is to understand the "heart" of the message. Quoted text and system boilerplate have been pre-stripped, but some may remain; ignore them and focus on the latest human input.
    
    Determine the user's intent. The input provided might be a "clean" snippet of the latest reply.
    Ignore any remaining system headers, original message artifacts, or signatures.
    
    JSON object required:
    {{
        "decision": "APPROVED" | "REJECTED" | "UPDATE_INFO" | "WILL_UPDATE_LATER" | "OUT_OF_OFFICE" | "UNCLEAR",
        "reason": "short explanation"
    }}

    Intent Categories:
    - APPROVED: The sender's core meaning is one of confirmation, validation, agreement, or giving permission to proceed. They are satisfied with the current state and want to move forward.
    - REJECTED: The sender's core meaning is one of disagreement, cancellation, or stopping the current process. They are not satisfied or believe the information is wrong.
    - UPDATE_INFO: The sender is providing specific data updates (like names or IDs) or asking to change information.
    - WILL_UPDATE_LATER: The sender is acknowledging the request but explicitly deferring action to the future.
    - OUT_OF_OFFICE: The message is an automated response or the sender is unavailable.
    - UNCLEAR: The message content is ambiguous, empty, or completely unrelated to the ticket.
    
    STRICT RULE: Prioritize semantic intent over literal matching. Analyze the tone and purpose of the latest human reply.
    
    IMPORTANT: If the message is JUST the original system notification without any human response added, classify as UNCLEAR. 
    However, if there is ANY human text, analyze its meaning and ignore the system part.

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
        response = requests.post(api_url, headers=headers, json=payload, timeout=45)
        response.raise_for_status()
        data = response.json()
        
        if 'choices' not in data or not data['choices']:
            print(f"ERROR: LLM closure check response missing 'choices': {json.dumps(data)}")
            return {"decision": "UNCLEAR", "reason": "Missing choices in API response"}

        content = data['choices'][0]['message']['content']
        result = json.loads(content)
        return {
            "decision": str(result.get("decision", "UNCLEAR")).upper(),
            "reason": str(result.get("reason", "No reason provided"))
        }
    except Exception as e:
        print(f"DEBUG: LLM closure check failed: {e}")
        return {"decision": "UNCLEAR", "reason": str(e)}
