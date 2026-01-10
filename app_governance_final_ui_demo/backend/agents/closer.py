    # agents/closer.py
from backend.models.ticket_context import TicketResponse, Ticket
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage

# ✅ Tool function: close tickets by appending evidence message
def close_tickets(tickets) -> TicketResponse:
    """Mark tickets as closed by appending evidence message to description."""
    import json
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

    updated = []
    if hasattr(tickets, 'tickets'):
        for t in tickets.tickets:
            t.description = (t.description or "") + " | Evidence attached, ticket closed."
            updated.append(t)
    return TicketResponse(tickets=updated).json()

class CloserAgent:
    def __init__(self, llm=None):
        self.llm = llm

        # ✅ Register tool
        tools = [
            Tool(
                name="CloseTickets",
                func=lambda params: close_tickets(params.get("tickets")),
                description="Closes tickets by appending evidence message to description."
            )
        ]

        # ✅ Create agent with LLM + tool
        self.agent = create_agent(
            model=self.llm,
            tools=tools,
            context_schema=TicketResponse,
            system_prompt="Close the tickets by appending evidence."
        )

    def invoke(self, tickets: TicketResponse) -> TicketResponse:
        """Close tickets using deterministic logic."""
        try:
            # Direct python logic
            updated = []
            for t in tickets.tickets:
                t.description = (t.description or "") + " | Evidence attached, ticket closed."
                t.status = "Closed"
                # Update Stage 8
                for stage in t.stages:
                    if "Ticket Closure" in stage.name:
                        stage.status = "completed"
                        stage.message = "Ticket Closure Agent: Successfully marked ticket as closed in Governance Portal."
                t.currentStage = 7 # Move to Stage 8
                updated.append(t)
            return TicketResponse(tickets=updated)


        except Exception as e:
            print(f"Error closing tickets: {e}")
            return TicketResponse(tickets=[])
