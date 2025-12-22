import json
import os
from backend.models.ticket_context import TicketResponse
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage

# ✅ Tool function: enrich tickets with AppHQ ownership details
def enrich_tickets_with_apphq(data_file: str, tickets) -> TicketResponse:
    """Lookup AIT numbers in AppHQ data and enrich tickets with ownership details."""
    # Handle string input (from LLM)
    if isinstance(tickets, str):
        try:
            clean_str = tickets.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_str)
            tickets = TicketResponse(**data)
        except Exception as e:
            print(f"DEBUG: Failed to parse tickets string: {e}")
            return TicketResponse(tickets=[]).json()
    elif isinstance(tickets, dict):
        tickets = TicketResponse(**tickets)

    with open(data_file, "r") as f:
        sample_data = json.load(f)

    enriched_tickets = []
    if hasattr(tickets, 'tickets'):
        for t in tickets.tickets:
            if t.ait_number:
                # find matching record
                details = next((rec for rec in sample_data if rec["ait_number"] == t.ait_number), None)
                if details:
                    # enrich ticket fields
                    t.application_name = details.get("application_name")
                    t.application_owner = details.get("application_owner")
                    t.lob_owner = details.get("lob_owner")
                    t.ait_owner = details.get("ait_owner")
                    t.contacts = details.get("contacts", [])
                    enriched_tickets.append(t)

    return TicketResponse(tickets=enriched_tickets).json()

class AppHQResolverAgent:
    def __init__(self, llm=None, data_file=None):
        self.llm = llm
        from pathlib import Path
        self.data_file = data_file or str(
            Path(__file__).parent.parent.parent / "data" / "apphq_data.json"
        )

        # ✅ Register tool
        tools = [
            Tool(
                name="EnrichTicketsWithAppHQ",
                func=lambda params: enrich_tickets_with_apphq(
                    self.data_file, params.get("tickets")
                ),
                description="Enriches tickets with AppHQ ownership details using AIT number lookup."
            )
        ]

        # ✅ Create agent with LLM + tool
        self.agent = create_agent(
            model=self.llm,
            tools=tools,
            context_schema=TicketResponse,
            system_prompt="Enrich tickets with AppHQ ownership details."
        )

    def invoke(self, tickets: TicketResponse) -> TicketResponse:
        """Enrich tickets using deterministic logic."""
        try:
            # Direct python logic
            with open(self.data_file, "r") as f:
                sample_data = json.load(f)

            enriched_tickets = []
            for t in tickets.tickets:
                # find matching record
                details = None
                if t.ait_number:
                    details = next((rec for rec in sample_data if rec["ait_number"] == t.ait_number), None)
                
                if details:
                    # enrich ticket fields
                    t.application_name = details.get("application_name")
                    t.application_owner = details.get("application_owner")
                    t.lob_owner = details.get("lob_owner")
                    t.ait_owner = details.get("ait_owner")
                    t.contacts = details.get("contacts", [])
                    
                    # ✅ Update Stage 4 Status (Success)
                    for stage in t.stages:
                        if "Ownership Enrichment" in stage.name:
                            stage.status = "completed"
                            stage.message = f"Enriched: {t.application_name} (Owner: {t.application_owner})"
                else:
                    # ✅ Update Stage 4 Status (Fallback)
                    for stage in t.stages:
                        if "Ownership Enrichment" in stage.name:
                            stage.status = "completed"
                            stage.message = f"Enriched: Using default ticket details (No AIT match)"
                
                t.currentStage = 3 # Move to Stage 4
                enriched_tickets.append(t)
            
            return TicketResponse(tickets=enriched_tickets)


        except Exception as e:
            print(f"Error enriching tickets: {e}")
            return TicketResponse(tickets=[])
