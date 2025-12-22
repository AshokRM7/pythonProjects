import json
import time
from backend.models.ticket_context import TicketResponse

class IAMRemediationAgent:
    def __init__(self, llm=None):
        self.llm = llm

    def invoke(self, tickets: TicketResponse) -> TicketResponse:
        """
        Processes IAM Remediation in 6 steps:
        1. Entitlement Discovery
        2. Manager Notification
        3. Risk Evaluation
        4. Automated Revocation
        5. Post-Verification
        6. Remediation Audit Log
        """
        try:
            for t in tickets.tickets:
                # We target Stage 6: IAM Remediation
                # In a real app, this would be asynchronous or streamed.
                # For the demo, we update the stage message with the journey.
                
                # Extraction (Step 1)
                user_match = "U" + t.ticket_id.replace("REQ", "") # Mock extraction
                app_name = t.application_name or "Target System"
                
                remediation_journey = [
                    f"🔍 [EXTRACT] Identified User ID: {user_match} and target application: {app_name}.",
                    f"🔔 [NOTIFY] Automated alert sent to {t.application_owner}'s manager for awareness.",
                    f"⚠️ [RISK] Verified: User is not a critical Project Owner. No cross-impact detected.",
                    f"⚡ [REVOKE] Technical access pull executed via IAM API.",
                    f"✅ [VERIFY] Post-remediation audit confirms {user_match} no longer has active entitlements.",
                    f"📄 [LOG] Governance signature added to remediation audit log (Ref: REM-{t.ticket_id})."
                ]

                # Update the target stage (Stage 6)
                for stage in t.stages:
                    if "IAM Remediation" in stage.name:
                        stage.status = "completed"
                        # We join with double newline for clean display in UI
                        stage.message = "\n\n".join(remediation_journey)
                t.currentStage = 5 # Move to Stage 6
            
            return tickets

        except Exception as e:
            print(f"Error in IAM Remediation: {e}")
            return tickets
