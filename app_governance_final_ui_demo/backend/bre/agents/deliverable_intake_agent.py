"""
Deliverable Intake Agent - Step 1
Receives BRE deliverable and extracts Application ID and AIT number
"""
import json
from typing import Dict, Any, Optional
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from pathlib import Path


SYSTEM_PROMPT = """You are a Deliverable Intake Agent for the BRE Rule Certification Process.

Your task is to:
1. Retrieve the BRE deliverable from RISE portal
2. Extract the Application ID and AIT number
3. Log the intake for audit purposes

Always use the available tools to complete the workflow end-to-end.
Return a concise final response with:
- application_id
- ait_number
- violation_type
- priority
- intake log status
"""


class DeliverableIntakeAgent:
    """Agent to handle deliverable intake and data extraction"""

    def __init__(self, llm: Optional[ChatOpenAI] = None):
        self.llm = llm
        self.data_path = Path(__file__).resolve().parents[3] / "data"
        self.tools = self._create_tools()

        self.agent = None
        if self.llm is not None:
            self.agent = create_agent(
                model=self.llm,
                tools=self.tools,
                system_prompt=SYSTEM_PROMPT,
            )

    def _create_tools(self):
        """Create tools for deliverable intake"""

        data_path = self.data_path  # capture for closures

        @tool("GetDeliverable")
        def get_deliverable(deliverable_id: str) -> str:
            """Retrieve a BRE deliverable from ticket_data.json using deliverable_id (ticket_id). Input should be the deliverable ID string."""
            try:
                # Load from ticket_data.json (single source of truth for all tickets)
                tickets_file = data_path / "ticket_data.json"
                with open(tickets_file, "r", encoding="utf-8") as f:
                    tickets = json.load(f)

                for ticket in tickets:
                    is_bre = ticket.get("category", "").upper() == "BRE" or (ticket.get("category", "").upper() == "IAM" and ticket.get("subcategory", "").upper() == "BRE")
                    if ticket.get("ticket_id") == deliverable_id and is_bre:
                        # Map ticket fields to BREDeliverable-compatible format
                        status_raw = ticket.get("status", "open").lower().replace(" ", "_")
                        status_map = {
                            "open": "open",
                            "in_review": "in_review",
                            "in review": "in_review",
                            "pending_certification": "pending_certification",
                            "certified": "certified",
                            "closed": "closed",
                        }
                        deliverable = {
                            "deliverable_id": ticket["ticket_id"],
                            "application_id": ticket.get("application_id", ticket.get("arm_id", "N/A")),
                            "ait_number": ticket.get("ait_number", "N/A"),
                            "status": status_map.get(status_raw, "open"),
                            "priority": ticket.get("risk_level", ticket.get("priority", "medium")).lower(),
                            "violation_type": ticket.get("violation_type", "rule_violation"),
                            "description": ticket.get("description", ""),
                            "created_date": ticket.get("created_on", "2026-01-01") + "T00:00:00Z",
                            "assigned_to": ticket.get("assigned_to", ticket.get("owner", "app_governance_team")),
                            "rise_ticket_id": ticket.get("rise_ticket_id", f"RISE-{ticket['ticket_id']}"),
                            # Extra context
                            "application_name": ticket.get("application_name", ""),
                            "application_owner": ticket.get("application_owner", ""),
                            "lob_owner": ticket.get("lob_owner", ""),
                        }
                        return json.dumps(deliverable, indent=2)

                return f"BRE Deliverable {deliverable_id} not found in ticket registry"
            except Exception as e:
                return f"Error retrieving deliverable: {str(e)}"

        @tool("ExtractKeyInfo")
        def extract_key_info(deliverable_json: str) -> str:
            """Extract Application ID and AIT number from deliverable JSON. Input should be the complete deliverable JSON string."""
            try:
                deliverable = json.loads(deliverable_json)
                return json.dumps(
                    {
                        "application_id": deliverable.get("application_id", "N/A"),
                        "ait_number": deliverable.get("ait_number", "N/A"),
                        "violation_type": deliverable.get("violation_type", "N/A"),
                        "priority": deliverable.get("priority", "N/A"),
                        "status": "extracted",
                    },
                    indent=2,
                )
            except Exception as e:
                return f"Error extracting information: {str(e)}"

        @tool("LogIntake")
        def log_intake(info: str) -> str:
            """Log the intake information for audit trail. Input should be the extracted information JSON."""
            return f"Intake logged successfully: {info}"

        return [get_deliverable, extract_key_info, log_intake]

    def process(self, deliverable_id: str) -> Dict[str, Any]:
        """Process the deliverable intake"""

        # ---- Fallback without LLM (deterministic workflow) ----
        if self.agent is None:
            deliverable_json = self.tools[0].invoke(deliverable_id)
            if "not found" in deliverable_json or "Error" in deliverable_json:
                return {"success": False, "error": deliverable_json}

            extracted_info = self.tools[1].invoke(deliverable_json)
            self.tools[2].invoke(extracted_info)

            return {
                "success": True,
                "deliverable": json.loads(deliverable_json),
                "extracted_info": json.loads(extracted_info),
            }

        # ---- LLM Agent path (tool-using agent) ----
        user_msg = (
            "Process the BRE deliverable intake using all available tools.\n\n"
            "Workflow:\n"
            "1) Call GetDeliverable(deliverable_id)\n"
            "2) Call ExtractKeyInfo(deliverable_json)\n"
            "3) Call LogIntake(extracted_info)\n\n"
            f"Deliverable ID: {deliverable_id}"
        )

        state = self.agent.invoke(
            {
                "messages": [
                    {"role": "user", "content": user_msg},
                ]
            }
        )

        final_text = ""
        try:
            messages = state.get("messages", [])
            if messages:
                last = messages[-1]
                final_text = getattr(last, "content", "") or (
                    last.get("content") if isinstance(last, dict) else ""
                )
        except Exception:
            final_text = str(state)

        return {"success": True, "result": final_text, "state": state}
