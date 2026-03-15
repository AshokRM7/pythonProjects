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
    print(f"DEBUG: Using API Key (masked): {api_key[:10]}...{api_key[-5:]}")

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
    
    Return the result as a JSON OBJECT with the following keys. Do NOT return a list.
    - primary_admin_name
    - primary_nbkid
    - secondary_admin_name
    - secondary_nbkid

    CRITICAL INSTRUCTION: If any field is missing or cannot be found, return an empty string "". 
    DO NOT return null.

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
        if response.status_code != 200:
            print(f"DEBUG: API Error: {response.status_code} - {response.text}")
        response.raise_for_status()
        
        data = response.json()
        content = data['choices'][0]['message']['content']
        print(f"DEBUG: LLM Response Content: {content}")
        
        # Strip markdown formatting if present
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```json"):
                content = "\n".join(lines[1:-1])
            elif lines[0].startswith("```"):
                content = "\n".join(lines[1:-1])
        
        result = json.loads(content)
        
        if isinstance(result, list) and len(result) > 0:
            print("DEBUG: Result is a list, taking first element.")
            result = result[0]
        
        if not isinstance(result, dict):
            print(f"ERROR: LLM returned non-dict result: {type(result)}")
            return {
                "primary_admin_name": "",
                "primary_nbkid": "",
                "secondary_admin_name": "",
                "secondary_nbkid": ""
            }
        
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

def check_closure_affirmation(email_body: str) -> bool:
    """
    Uses LLM to determine if the email body contains an affirmation 
    to close the ticket or that the changes are verified/approved.
    """
    api_key_env = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
    if not api_key_env:
        return False
    
    api_key = api_key_env.strip().strip('"').strip("'")
    if api_key.startswith("sk-or"):
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        model_name = "google/gemini-2.0-flash-lite-001"
    else:
        api_url = "https://api.openai.com/v1/chat/completions"
        model_name = "gpt-4o-mini"

    prompt = f"""
    Analyze the following email body and determine if the sender is confirming that they are satisfied with the changes and that the ticket can be CLOSED. 
    
    Email Body:
    \"\"\"{email_body}\"\"\"
    
    Consider affirmations like:
    - "Verified the changes, please proceed with the ticket closure."
    - "Good with changes, proceed with the closure."
    - "Verified and good to close this ticket."
    - "Confirmed, everything looks correct."
    - "Approved."
    
    Return the result as a JSON OBJECT with a single key 'is_affirmation' which is a BOOLEAN.
    
    Example:
    {{
        "is_affirmation": true
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
        return bool(result.get("is_affirmation", False))
    except Exception as e:
        print(f"DEBUG: LLM closure check failed: {e}")
        return False
