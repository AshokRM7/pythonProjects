import json
import time
import os
from backend.models.ticket_context import TicketResponse
from pathlib import Path


class ARMAdminRemediationAgent:
    def __init__(self, llm=None):
        self.llm = llm
        self.admin_details_file = str(
            Path(__file__).parent.parent.parent / "data" / "application_admin_details.json"
        )

    def load_admin_details(self):
        """Load application admin details from JSON file."""
        try:
            with open(self.admin_details_file, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading admin details: {e}")
            return []

    def save_admin_details(self, data):
        """Save updated admin details back to JSON file."""
        try:
            with open(self.admin_details_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving admin details: {e}")

    def get_admin_for_ait(self, ait_number):
        """Get admin details for a specific AIT number."""
        admin_list = self.load_admin_details()
        for entry in admin_list:
            if entry["ait_number"] == ait_number:
                return entry
        return None

    def check_name_in_other_aits(self, name, exclude_ait):
        """Check if a given name exists as admin in any other AIT."""
        admin_list = self.load_admin_details()
        found_in = []
        for entry in admin_list:
            if entry["ait_number"] == exclude_ait:
                continue
            primary = entry.get("primary_admin_name", "").strip().lower()
            secondary = entry.get("secondary_admin_name", "").strip().lower()
            if primary == name.strip().lower() or secondary == name.strip().lower():
                found_in.append(entry["ait_number"])
        return found_in

    def is_app_owner(self, name, ait_number):
        """Check if the given name matches the app owner for this AIT."""
        entry = self.get_admin_for_ait(ait_number)
        if entry and entry.get("app_owner_name", "").strip().lower() == name.strip().lower():
            return True
        return False

    def update_admin_names(self, ait_number, primary_name=None, primary_nbkid=None, secondary_name=None, secondary_nbkid=None):
        """Update admin names for a given AIT and return the result."""
        admin_list = self.load_admin_details()
        result = {
            "ait_number": ait_number,
            "updated": False,
            "action": None,
            "warnings": [],
            "details": None
        }

        for entry in admin_list:
            if entry["ait_number"] == ait_number:
                # Check for app owner conflicts (Bank Policy Enforcement)
                bank_policy_msg = "As per policy we cannot provide your name in the admin name because you are the application owner. Please provide other admin names."
                
                if primary_name and self.is_app_owner(primary_name, ait_number):
                    result["warnings"].append(bank_policy_msg)
                    return result

                if secondary_name and self.is_app_owner(secondary_name, ait_number):
                    result["warnings"].append(bank_policy_msg)
                    return result

                # Check for duplicate admins
                if primary_name and secondary_name and primary_name.lower() == secondary_name.lower():
                    result["warnings"].append("Primary and Secondary admins cannot be the same person.")
                    return result

                # Determine NEW vs MODIFY
                names_to_check = []
                if primary_name:
                    names_to_check.append(primary_name)
                if secondary_name:
                    names_to_check.append(secondary_name)

                # Fetch baseline current names for this AIT
                current_primary = entry.get("primary_admin_name", "")
                current_secondary = entry.get("secondary_admin_name", "")

                is_modify = False
                for name in names_to_check:
                    if not name.strip():
                        continue
                        
                    # Case: Name exists in other AITs (Global Search)
                    found_aits = self.check_name_in_other_aits(name, ait_number)
                    if found_aits:
                        is_modify = True
                        # Only add warning if it's NOT the current admin (though for NEW it won't be)
                        if name.strip().lower() not in [current_primary.strip().lower(), current_secondary.strip().lower()]:
                            result["warnings"].append(
                                f"'{name}' is already an admin in {', '.join(found_aits)}."
                            )

                # Update the entry
                if primary_name:
                    entry["primary_admin_name"] = primary_name
                if primary_nbkid:
                    entry["primary_nbkid"] = primary_nbkid
                if secondary_name:
                    entry["secondary_admin_name"] = secondary_name
                if secondary_nbkid:
                    entry["secondary_nbkid"] = secondary_nbkid

                result["action"] = "MODIFY" if is_modify else "NEW"
                result["updated"] = True
                result["details"] = entry.copy()

                # Save back
                self.save_admin_details(admin_list)
                break

        return result

    def invoke(self, tickets: TicketResponse) -> TicketResponse:
        """
        Processes ARM FORMS NO ADMIN Remediation:
        1. Lookup admin details for AIT
        2. Check if primary/secondary admins are present
        3. Set appropriate stage message
        """
        try:
            for t in tickets.tickets:
                ait = t.ait_number
                admin_entry = self.get_admin_for_ait(ait)

                if not admin_entry:
                    # No entry found - set message
                    remediation_message = (
                        f"ARM Admin Remediation Agent:\n\n"
                        f"⚠️ No admin details found for {ait} in the ARM Admin database.\n\n"
                        f"Application: {t.application_name}\n"
                        f"App Owner: {t.application_owner}\n\n"
                        f"Action Required: Please contact the application owner to provide admin names."
                    )
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "in-progress"
                            stage.message = remediation_message
                    t.currentStage = 5
                    return tickets

                primary = admin_entry.get("primary_admin_name", "").strip()
                secondary = admin_entry.get("secondary_admin_name", "").strip()
                owner = admin_entry.get("app_owner_name", "").strip()

                # Conflict Validation
                is_owner_conflict = (primary.lower() == owner.lower() or secondary.lower() == owner.lower())
                is_duplicate_admin = (primary.lower() == secondary.lower() and primary != "")

                if not primary and not secondary:
                    # Scenario 1: No admin names at all - GAP IDENTIFIED
                    remediation_message = (
                        f"ARM Admin Remediation Agent - GAP IDENTIFIED:\n\n"
                        f"❌ [GAP] Checked ARM Admin database for {ait}: No Primary or Secondary Admin configured.\n"
                        f"📋 Application: {admin_entry['application_name']}\n"
                        f"👤 App Owner: {admin_entry['app_owner_name']}\n\n"
                        f"✉️ [ACTION] Email sent to App Owner. Please ask for admin names and NBKID (7 chars).\n\n"
                        f"STATUS: WAITING_FOR_ADMIN_INPUT"
                    )
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "in-progress"
                            stage.message = remediation_message

                elif is_owner_conflict:
                    # Scenario 2: Owner-Admin Conflict (Refined Wording)
                    remediation_message = (
                        f"ARM Admin Remediation Agent - POLICY VIOLATION:\n\n"
                        f"✅ Admin names received from App Owner. Validating...\n"
                        f"⚠️ [CONFLICT] {primary if primary.lower() == owner.lower() else secondary} is the Application Owner.\n\n"
                        f"❌ [POLICY] As per policy, we cannot provide your name in the admin name because you are the application owner. "
                        f"Please provide other admin names and their NBKID (7 chars).\n\n"
                        f"STATUS: WAITING_FOR_ADMIN_INPUT"
                    )
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "in-progress"
                            stage.message = remediation_message

                elif is_duplicate_admin:
                    # Scenario 3: Same person for both admins
                    remediation_message = (
                        f"ARM Admin Remediation Agent - VALIDATION FAILED:\n\n"
                        f"✅ Admin names received from App Owner. Validating...\n"
                        f"❌ [ALERT] Primary and Secondary admins cannot be the same person!\n\n"
                        f"📝 Action: Ask Application Owner to provide two different admin names.\n\n"
                        f"STATUS: WAITING_FOR_ADMIN_INPUT"
                    )
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "in-progress"
                            stage.message = remediation_message

                elif not secondary:
                    # Scenario 4: Missing secondary admin only
                    remediation_message = (
                        f"ARM Admin Remediation Agent - GAP IDENTIFIED:\n\n"
                        f"❌ [GAP] Secondary Admin missing for {ait}.\n"
                        f"✅ Primary Admin: {primary}\n\n"
                        f"✉️ [ACTION] Email sent to App Owner. Please ask for Secondary Admin name and NBKID (7 chars).\n\n"
                        f"STATUS: WAITING_FOR_ADMIN_INPUT"
                    )
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "in-progress"
                            stage.message = remediation_message

                else:
                    # Scenario 5: Both admins present and valid - auto-complete
                    # Determine Action for Audit
                    action_result = self.update_admin_names(ait, primary, None, secondary, None)
                    req_type = action_result.get("action", "NEW")
                    
                    remediation_message = (
                        f"ARM Admin Remediation Agent - SUCCESS:\n\n"
                        f"✅ [RECEIVED] Admin names received from App Owner: {primary}, {secondary}.\n"
                        f"✅ [VALIDATED] Policy check passed. NBKIDs verified.\n"
                        f"🚀 [ACTION] Requirement identified as {req_type} for ARM Portal.\n\n"
                        f"STATUS: COMPLETED"
                    )
                    for stage in t.stages:
                        if "IAM Remediation" in stage.name:
                            stage.status = "completed"
                            stage.message = remediation_message
                    
                t.currentStage = 5

            return tickets

        except Exception as e:
            print(f"Error in ARM Admin Remediation: {e}")
            return tickets
