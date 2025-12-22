# agents/sla_prioritizer.py
from backend.models.ticket_context import TicketResponse, Ticket
from datetime import datetime
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage

# ✅ Tool function: calculate SLA risk levels
def prioritize_tickets_by_sla(tickets) -> TicketResponse:
    """Assign risk levels to tickets based on SLA deadlines."""
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
            try:
                due = datetime.fromisoformat(t.sla_deadline)
                days_left = (due - datetime.utcnow()).days
                if days_left <= 2:
                    t.risk_level = "High"
                elif days_left <= 5:
                    t.risk_level = "Medium"
                else:
                    t.risk_level = "Low"
            except Exception:
                t.risk_level = "Unknown"
            updated.append(t)
    return TicketResponse(tickets=updated).json()

class SLAPrioritizerAgent:
    def __init__(self, llm=None):
        self.llm = llm

        # ✅ Register tool
        tools = [
            Tool(
                name="PrioritizeTicketsBySLA",
                func=lambda params: prioritize_tickets_by_sla(params.get("tickets")),
                description="Assigns risk levels (High/Medium/Low) to tickets based on SLA deadlines."
            )
        ]

        # ✅ Create agent with LLM + tool
        self.agent = create_agent(
            model=self.llm,
            tools=tools,
            context_schema=TicketResponse,
            system_prompt="Prioritize tickets based on SLA."
        )

    def invoke(self, tickets: TicketResponse) -> TicketResponse:
        """Assign risk levels using deterministic logic."""
        try:
            # Direct python logic
            updated = []
            for t in tickets.tickets:
                try:
                    due = datetime.fromisoformat(t.sla_deadline)
                    days_left = (due - datetime.utcnow()).days
                    if days_left <= 2:
                        t.risk_level = "High"
                    elif days_left <= 5:
                        t.risk_level = "Medium"
                    else:
                        t.risk_level = "Low"
                except Exception:
                    t.risk_level = "Unknown"
                
                # Update Stage 3
                for stage in t.stages:
                    if "SLA Prioritization" in stage.name:
                        stage.status = "completed"
                        stage.message = f"✅ Risk: {t.risk_level} | Deadline: {t.sla_deadline}"
                t.currentStage = 2 # Move to Stage 3
                
                updated.append(t)
            return TicketResponse(tickets=updated)


        except Exception as e:
            print(f"Error prioritizing tickets: {e}")
            return TicketResponse(tickets=[])
