
import json
import random
from datetime import datetime, timedelta

# Configuration
NUM_TICKETS = 100
# Use a fixed reference date or today? Using today ensures "Recent" is always relative to now.
TODAY = datetime.now()

# Load App Data from Source
try:
    with open("data/apphq_data.json", "r") as f:
        APP_DATA = json.load(f)
except Exception as e:
    print(f"Warning: Could not load apphq_data.json: {e}")
    APP_DATA = []

# Options
STATUSES = ["Open", "In Progress", "Closed", "Pending", "Waiting for Evidence", "Recent Issues"]
PRIORITIES = ["Low", "Medium", "High", "Critical"]
CATEGORIES = ["IAM", "APP", "DATA", "SECURITY"]

# Helper to get random app details
def get_random_app_details():
    if APP_DATA:
        app = random.choice(APP_DATA)
        return app["application_name"], app["application_owner"], app["contacts"]
    else:
        # Fallback
        return "Unknown App", "unknown@example.com", ["admin@example.com"]

def get_smart_date(status):
    """Returns a date string appropriate for the status."""
    if status == "Recent Issues":
        # Today or Yesterday
        days_ago = random.randint(0, 1)
    elif status == "Open":
        # Last 1 week
        days_ago = random.randint(0, 7)
    elif status == "In Progress":
        # Last 2 weeks
        days_ago = random.randint(1, 14)
    elif status == "Waiting for Evidence" or status == "Pending":
         # Last 2 weeks
        days_ago = random.randint(1, 14)
    elif status == "Closed":
        # Last 1 month
        days_ago = random.randint(1, 30)
    else:
        days_ago = random.randint(0, 30)
    
    date = TODAY - timedelta(days=days_ago)
    return date.strftime("%Y-%m-%d")

def generate_ticket(index):
    ticket_id = f"REQ{1000 + index}"
    
    # Weighted choice: 70% IAM, 10% others
    category = random.choices(CATEGORIES, weights=[0.7, 0.1, 0.1, 0.1], k=1)[0]
    status = random.choice(STATUSES)
    priority = random.choice(PRIORITIES)
    
    app_name, app_owner, contacts = get_random_app_details()
    
    created_date_str = get_smart_date(status)
    created_date = datetime.strptime(created_date_str, "%Y-%m-%d")
    sla_date = created_date + timedelta(days=random.randint(3, 14))

    return {
        "ticket_id": ticket_id,
        "jira_story": f"JIRA-{random.randint(10000, 99999)}",
        "ait_number": f"AIT-{random.randint(1000, 9999)}",
        "deliverableType": f"{category} Category",
        "category": category,
        "risk_level": priority,
        "sla_deadline": sla_date.strftime("%Y-%m-%d"),
        "created_on": created_date_str,
        "description": f"Automated ticket generation for {category} issue in {app_name}.",
        "arm_id": f"ARM-{random.randint(1000, 9999)}",
        "application_name": app_name,
        "application_owner": app_owner,
        "lob_owner": "IT LOB",
        "ait_owner": "Manager Name",
        "contacts": contacts,
        "status": status,
        "priority": priority,
        "owner": app_owner # Sync owner with application owner for now
    }

# Generate fresh list (Overwrite existing to ensure consistency)
combined = [generate_ticket(i) for i in range(NUM_TICKETS)]

with open("data/ticket_data.json", "w") as f:
    json.dump(combined, f, indent=2)

print(f"Generated {len(combined)} realistic tickets.")
