from backend.models.ticket_context import TicketResponse, Ticket
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage

def filter_iam_tickets(tickets) -> TicketResponse:        
    """Tool function to filter IAM tickets and mark deliverableType."""
    import json
    # Handle string input (from LLM)
    if isinstance(tickets, str):
        try:
            # Attempt to clean string if it's wrapped in code blocks
            clean_str = tickets.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_str)
            tickets = TicketResponse(**data)
        except Exception as e:
            # If parsing fails, verify if it is empty or invalid
            print(f"DEBUG: Failed to parse tickets string: {e} | Content: {tickets[:100]}...")
            return TicketResponse(tickets=[]).json()
    
    # Handle dict input
    elif isinstance(tickets, dict):
        tickets = TicketResponse(**tickets)
    
    # If it is not TicketResponse by now, return empty
    if not hasattr(tickets, 'tickets'):
        print(f"DEBUG: Input is not TicketResponse: {type(tickets)}")
        return TicketResponse(tickets=[]).json()

    iam_tickets = []
    for t in tickets.tickets:
        if t.category.upper() == "IAM":
            t.deliverableType = "IAM Category"
            iam_tickets.append(t)
    
    # Return JSON string so LangChain stores it as valid JSON in ToolMessage
    return TicketResponse(tickets=iam_tickets).json()

class CategoryCheckerAgent:
    def __init__(self, llm):
        # Register the IAM filter tool
        tools = [
            Tool(
                name="FilterIAMTickets",
                func=filter_iam_tickets,
                description="Filters tickets and returns only IAM category tickets"
            )
        ]

        # Create the agent with LLM + tool
        self.agent = create_agent(
            model=llm,
            tools=tools,
            context_schema= TicketResponse,
            system_prompt="You MUST use the 'FilterIAMTickets' tool to filter the tickets to only those with 'IAM' category. Do not reply with text, just call the tool."
        )

    def invoke(self, tickets: TicketResponse) -> TicketResponse:
        """Filter tickets using deterministic logic for reliability."""
        print(f"DEBUG_AGENT: CategoryChecker invoked with {len(tickets.tickets)} tickets")
        # Direct call to tool function logic
        try:
            # Re-use the filtering logic (extracted from tool) or call tool directly
            # Since tool logic is simple, implement here:
            iam_tickets = []
            for t in tickets.tickets:
                if t.category and t.category.upper() == "IAM":
                    t.deliverableType = "IAM Category"
                    # Update Stage 2
                    for stage in t.stages:
                        if "Category Check" in stage.name:
                            stage.status = "completed"
                            stage.message = f"✅ Validated IAM: {t.category}"
                    t.currentStage = 1 # Finished Stage 2 (index 1)
                    iam_tickets.append(t)
            
            print(f"DEBUG_AGENT: Filtered down to {len(iam_tickets)} IAM tickets")
            return TicketResponse(tickets=iam_tickets)

            
        except Exception as e:
            print(f"DEBUG_AGENT: Error in category check: {e}")
            return TicketResponse(tickets=[])
