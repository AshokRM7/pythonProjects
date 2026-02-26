import json
import os
from backend.models.ticket_context import TicketResponse, Ticket
from backend.bre.orchestrator import BRE_STAGES
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage

# ✅ Tool function for fetching all tickets
def fetch_all_tickets(data_file: str) -> TicketResponse:
    """Fetch all tickets from JSON file and initialize stages."""
    with open(data_file, "r") as f:
        sample_data = json.load(f)

    # Base stages definition
    base_stages = [
        {"id": 1, "name": "Ticket Fetcher Agent", "status": "completed", "message": "Ticket fetched successfully"},
        {"id": 2, "name": "Category Check Agent", "status": "pending", "message": ""},
        {"id": 3, "name": "SLA Prioritization Agent", "status": "pending", "message": ""},
        {"id": 4, "name": "Ownership Enrichment Agent", "status": "pending", "message": ""},
        {"id": 5, "name": "App Owner Check Agent", "status": "pending", "message": ""},
        {"id": 6, "name": "IAM Remediation Agent", "status": "pending", "message": ""},
        {"id": 7, "name": "Evidence Collection Agent", "status": "pending", "message": ""},
        {"id": 8, "name": "Ticket Closure Agent", "status": "pending", "message": ""},
        {"id": 9, "name": "Logging Agent", "status": "pending", "message": ""},
    ]

    tickets = [Ticket(**{**t, "stages": base_stages, "currentStage": 0}) for t in sample_data if t.get("ticket_type") != "BRE"]
    tickets.extend(Ticket(**{**t, "stages": BRE_STAGES, "currentStage": 0}) for t in sample_data if t.get("ticket_type") == "BRE")
    return TicketResponse(tickets=tickets)


class TicketFetcherAgent:
    def __init__(self, llm=None, data_file=None):
        self.llm = llm
        from pathlib import Path
        self.data_file = data_file or str(
            Path(__file__).parent.parent.parent / "data" / "ticket_data.json"
        )

        # ✅ Register tool
        tools = [
            Tool(
                name="FetchAllTickets",
                func=lambda _: fetch_all_tickets(self.data_file),
                description="Fetches all tickets from JSON file"
            )
        ]

        # ✅ Create agent with LLM + tool
        self.agent = create_agent(
            model=self.llm,
            tools=tools,
            context_schema=TicketResponse,
            system_prompt="Fetch all tickets using the provided tool."
        )

    def invoke(self) -> TicketResponse:
        """Fetch tickets directly without LLM overhead for reliability."""
        try:
            return fetch_all_tickets(self.data_file)
        except Exception as e:
            print(f"Error fetching tickets: {e}")
            return TicketResponse(tickets=[])
