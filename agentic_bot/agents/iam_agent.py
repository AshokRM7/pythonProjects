
from typing import List, Dict, Any
import os
import requests
from pathlib import Path
import yaml

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage


CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config.yaml"

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

class IamAgent:
    def __init__(self):
        cfg = load_config()
        self.base_url = cfg["mock_server"]["base_url"]
        llm_cfg = cfg["llm"]

        api_key = os.getenv(llm_cfg["openai_api_key_env"])

        self.llm = ChatOpenAI(
            model=llm_cfg["openai_model"],
            api_key=api_key,
            temperature=0.2,
        )


    def fetch_new_tickets(self) -> List[Dict[str, Any]]:
        resp = requests.get(f"{self.base_url}/rise/tickets", params={"status": "New"})
        resp.raise_for_status()
        return resp.json()

    def get_owners(self, ait_number: str) -> Dict[str, Any]:
        resp = requests.get(f"{self.base_url}/apphq/owners/{ait_number}")
        resp.raise_for_status()
        return resp.json()

    def draft_email(self, ticket: Dict[str, Any], owners: Dict[str, Any]) -> str:
        prompt = f"""You are an IAM governance analyst.

Ticket:
- ID: {ticket['id']}
- Application: {ticket['application']}
- Description: {ticket['description']}
- Priority: {ticket['priority']}
- SLA days: {ticket['sla_days']}

Owners:
- Business Owner: {owners.get('business_owner')}
- Support Owner: {owners.get('support_owner')}

Write a short, professional email asking them to provide the necessary IAM evidence
(access review results, leaver confirmation, ARM tickets, etc.). Do NOT invent data.
"""
        # res = self.llm([HumanMessage(content=prompt)])
        # return res.content
        response = self.llm.invoke([HumanMessage(content=prompt)])
        return response.content



    def send_email(self, to_addrs: List[str], subject: str, body: str):
        payload = {"to": to_addrs, "subject": subject, "body": body}
        resp = requests.post(f"{self.base_url}/mail/send", json=payload)
        resp.raise_for_status()
        return resp.json()

    def add_jira_comment_and_close(self, jira_id: str, comment: str):
        requests.post(f"{self.base_url}/jira/items/{jira_id}/comment", params={"comment": comment})
        requests.post(f"{self.base_url}/jira/items/{jira_id}/status", params={"status": "Closed"})

    def close_ticket(self, ticket_id: str, evidence_note: str):
        requests.post(f"{self.base_url}/rise/tickets/{ticket_id}/evidence", params={"evidence": evidence_note})
        requests.post(f"{self.base_url}/rise/tickets/{ticket_id}/status", params={"status": "Closed"})

    def run_once(self):
        tickets = self.fetch_new_tickets()
        if not tickets:
            print("No NEW tickets to process.")
            return

        for t in tickets:
            print(f"Processing ticket {t['id']} for application {t['application']}")
            owners = self.get_owners(t["ait_number"])
            print("Owners:", owners)
            email_body = self.draft_email(t, owners)
            subject = f"IAM Action Required – {t['application']} ({t['id']})"
            to_list = [owners.get("business_owner"), owners.get("support_owner")]
            to_list = [x for x in to_list if x]
            print("Sending email to:", to_list)
            self.send_email(to_list, subject, email_body)
            jira_comment = f"IAM bot contacted owners {to_list} for evidence. Awaiting response."
            self.add_jira_comment_and_close(t["jira_id"], jira_comment)
            evidence_note = "Initial outreach sent to owners for IAM evidence."
            self.close_ticket(t["id"], evidence_note)
            print(f"Ticket {t['id']} moved to Closed with initial outreach logged.")
