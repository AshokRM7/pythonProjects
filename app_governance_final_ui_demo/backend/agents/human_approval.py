# agents/human_approval.py
from backend.models.ticket_context import TicketResponse
from langchain.agents import create_agent

def require_human_approval(tickets: TicketResponse, stage: str) -> dict:
    """Flag tickets for human review before proceeding."""
    return {
        "stage": stage,
        "tickets": tickets.dict(),
        "status": "pending_human_review"
    }

from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage
import json

# ...

class HumanApprovalAgent:
    def __init__(self, llm=None):
        self.llm = llm
        tools = [
            Tool(
                name="RequireHumanApproval",
                func=lambda params: require_human_approval(
                    params.get("tickets"), params.get("stage")
                ),
                description="Flags tickets for human review at a given stage."
            )
        ]
        self.agent = create_agent(model=self.llm, tools=tools, context_schema=TicketResponse, system_prompt="Check if human approval is required.")

    def invoke(self, tickets: TicketResponse, stage: str) -> dict:
        result = self.agent.invoke({"messages": [{"role": "user", "content": "Check approval"}], "tickets": tickets, "stage": stage})
        
        if isinstance(result, dict) and "messages" in result:
            for msg in reversed(result["messages"]):
                if isinstance(msg, ToolMessage) and msg.name == "RequireHumanApproval":
                    try:
                        return json.loads(msg.content)
                    except Exception as e:
                        print(f"Error parsing approval: {e}")
        return {}
