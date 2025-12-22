import sys
import os

# Add project root to path
sys.path.append("c:/Users/Vel Murugan S/Python/app_governance_final_ui_demo")

from backend.agents.app_owner_check import AppOwnerCheckerAgent
from backend.models.ticket_context import TicketResponse, Ticket

# Mock data sample from ticket_data.json
mock_ticket = Ticket(
    ticket_id="REQ1000",
    description="Test Ticket",
    application_owner="Mike Adams", # Name from data
    risk_level="Medium",
    created_on="2025-12-19",
    category="IAM",
    status="Open",
    owner="Mike Adams"
)

agent = AppOwnerCheckerAgent()
response = agent.invoke(TicketResponse(tickets=[mock_ticket]))

print(f"Input Owner: {mock_ticket.application_owner}")
print(f"Output Tickets Count: {len(response.tickets)}")
if not response.tickets:
    print("FAILED: Ticket was rejected")
else:
    print("SUCCESS: Ticket was accepted")
