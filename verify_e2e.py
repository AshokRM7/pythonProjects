import requests
import time
import sys

BASE_URL = "http://127.0.0.1:9001"
TICKET_ID = "IAM-001"

def check_server():
    try:
        requests.get(f"{BASE_URL}/rise/tickets")
        print("Server is up.")
        return True
    except:
        print("Server not reachable.")
        return False

def reset_ticket():
    # Reset ticket status to New for testing
    requests.post(f"{BASE_URL}/rise/tickets/{TICKET_ID}/status", params={"status": "New"})
    print(f"Reset {TICKET_ID} to New.")

def run_agent():
    print(f"Starting agent run for {TICKET_ID}...")
    resp = requests.post(f"{BASE_URL}/agent/run/{TICKET_ID}")
    if resp.status_code != 200:
        print(f"Failed to start agent: {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    job_id = data["job_id"]
    print(f"Job started: {job_id}")
    return job_id

def poll_status(job_id):
    while True:
        resp = requests.get(f"{BASE_URL}/agent/status/{job_id}")
        data = resp.json()
        status = data["status"]
        print(f"Agent Status: {status}")
        
        if status in ["completed", "failed"]:
            if status == "failed":
                print(f"Error: {data.get('error')}")
            return status
        
        time.sleep(1)

def verify_ticket_status():
    resp = requests.get(f"{BASE_URL}/rise/tickets/{TICKET_ID}")
    ticket = resp.json()
    print(f"Final Ticket Status: {ticket['status']}")
    return ticket['status']

if __name__ == "__main__":
    if not check_server():
        sys.exit(1)
        
    reset_ticket()
    job_id = run_agent()
    final_agent_status = poll_status(job_id)
    
    if final_agent_status == "completed":
        ticket_status = verify_ticket_status()
        if ticket_status == "Closed":
            print("SUCCESS: Agent completed and ticket is Closed.")
        else:
            print(f"FAILURE: Ticket status is {ticket_status}, expected Closed.")
    else:
        print("FAILURE: Agent run failed.")
