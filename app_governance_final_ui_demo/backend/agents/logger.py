# agents/logger.py
from backend.models.ticket_context import TicketResponse
from datetime import datetime
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage
import json

# ✅ Tool function: generate logs
def generate_logs(tickets: TicketResponse, message: str = None) -> dict:
    """Generate logs for tickets or custom messages."""
    logs = []
    if message:
        logs.append(f"[{datetime.utcnow().isoformat()}] {message}")
    elif not tickets.tickets:
        logs.append(f"[{datetime.utcnow().isoformat()}] No tickets found for processing.")
    else:
        for t in tickets.tickets:
            logs.append(
                f"[{datetime.utcnow().isoformat()}] Processed ticket {t.ticket_id} "
                f"with risk {t.risk_level or 'Unknown'}"
            )
    return {"logs": logs}

class LoggerAgent:
    def __init__(self, llm=None):
        self.llm = llm

        # ✅ Register tool
        tools = [
            Tool(
                name="GenerateLogs",
                func=lambda params: generate_logs(
                    params.get("tickets"),
                    params.get("message")
                ),
                description="Generates logs for tickets or custom failure messages."
            )
        ]

        # ✅ Create agent with LLM + tool
        self.agent = create_agent(
            model=self.llm,
            tools=tools,
            context_schema=TicketResponse,
            system_prompt="Generate logs for the tickets."
        )

    def invoke(self, tickets: TicketResponse, message: str = None) -> dict:
        """Generate logs using deterministic logic."""
        try:
            # Direct python logic - no LLM needed for basic logging
            res = generate_logs(tickets, message)
            for t in tickets.tickets:
                # Update Stage 9
                for stage in t.stages:
                    if "Logging" in stage.name:
                        stage.status = "completed"
                        stage.message = "✅ Process lifecycle logged to governance audit trail."
                t.currentStage = 8 # Move to Stage 9
                t.status = "Closed" # Final terminal status
            return res

        except Exception as e:
            print(f"Error generating logs: {e}")
            return {"logs": []}
