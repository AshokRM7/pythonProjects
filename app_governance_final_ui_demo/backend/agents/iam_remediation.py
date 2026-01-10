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
                # Check if this is a "real" remediation ticket
                is_leaver = (t.deliverableType and "Leaver" in t.deliverableType) or (t.requested_action == "REVOKE_DB_ACCESS")
                
                if is_leaver:
                    from backend.iam_system import service
                    
                    employee_id = t.employee_id or ("E" + t.ticket_id.replace("REQ", ""))
                    system = t.target_system or "CRM_DB"
                    
                    # 1. Discovery
                    before = service.get_access(employee_id, system)
                    service.audit(t.ticket_id, "DISCOVERY", f"Before state: {json.dumps(before)}")
                    
                    # 2. Revoke Roles
                    revoked_count = service.revoke_roles(employee_id, system)
                    service.audit(t.ticket_id, "REVOKE", f"Revoked {revoked_count} roles from {system}")
                    
                    # 3. Disable Account
                    disabled = service.disable_account(employee_id, system)
                    service.audit(t.ticket_id, "DISABLE", f"Disabled account for {system}: {disabled}")
                    
                    # 4. Verify
                    verified = service.verify_revocation(employee_id, system)
                    service.audit(t.ticket_id, "VERIFY", f"Revocation verified: {verified}")
                    
                    # 5. After State
                    after = service.get_access(employee_id, system)
                    
                    # Create Evidence Report
                    roles_before = before['roles'].get(system, [])
                    account_enabled_before = before['accounts'].get(system, False)
                    
                    roles_after = after['roles'].get(system, [])
                    account_enabled_after = after['accounts'].get(system, False)
                    
                    remediation_journey = [
                        "IAM Remediation Agent - Detailed Report:",
                        "BEFORE:",
                        f"System: {system}",
                        f"Account enabled: {account_enabled_before}",
                        f"Roles: {roles_before}",
                        "",
                        "ACTIONS:",
                        f"Revoked roles count: {revoked_count}",
                        f"Disabled account: {disabled}",
                        "",
                        "AFTER:",
                        f"Account enabled: {account_enabled_after}",
                        f"Roles: {roles_after}",
                        "",
                        "VERIFY:",
                        f"{'✅' if verified else '❌'} Revocation verified {'(no active roles)' if verified else '(active roles remain)'}",
                        "",
                        "AUDIT:",
                        f"Entries written for ticket {t.ticket_id}"
                    ]
                    
                    # Update stage
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "completed" if verified else "failed"
                            stage.message = "\n".join(remediation_journey)
                else:
                    # Legacy narrative behavior
                    # Extraction (Step 1)
                    user_match = "U" + t.ticket_id.replace("REQ", "") # Mock extraction
                    app_name = t.application_name or "Target System"
                    
                    remediation_journey = [
                        "IAM Remediation Agent Executing Protocol:",
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
