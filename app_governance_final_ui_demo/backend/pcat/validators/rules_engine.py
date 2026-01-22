import json
import re
from typing import List
from ..models import PCATRow, Finding

class RulesEngine:
    def __init__(self, rules_config_path: str):
        with open(rules_config_path, 'r') as f:
            self.rules = json.load(f)

    def validate(self, rows: List[PCATRow]) -> List[Finding]:
        findings = []
        for row in rows:
            for rule in self.rules:
                if self._evaluate_predicate(row, rule['predicate']):
                    # Check if rule logic is "if predicate then ERROR" or "if predicate is NOT met then ERROR"
                    # For demo, the predicate defines the ERROR condition except for some
                    
                    # Custom logic for demo rules as described in requirements
                    rule_id = rule['rule_id']
                    
                    triggered = False
                    if rule_id == "R1": # If WAN then managed_by must contain AD
                        if row.platform_category == "WAN" and not any(x in row.managed_by for x in ["AD", "Active Directory"]):
                            triggered = True
                    elif rule_id == "R2": # admin perms can't be Shared account
                        if "admin" in row.capability.lower() and row.account_type == "Human Temporary or Shared":
                            triggered = True
                    elif rule_id == "R3": # read in name but capability not Read Only
                        if "read" in row.permission_name.lower() and row.capability != "Read Only":
                            triggered = True
                    elif rule_id == "R4": # High class + Business function
                        if row.data_classification in ["Confidential-NPI", "Confidential-NPI-Agent", "Confidential-NTPI"] and row.function == "Business":
                            triggered = True
                    elif rule_id == "R5": # provided_by missing for WAN/APP/DB
                        if row.platform_category in ["WAN", "APPLICATION", "DATABASE"] and row.provided_by == "AIT NOT SPECIFIED":
                            triggered = True
                    elif rule_id == "R6": # delete/modify/write in name but capability not Modify/Admin
                        if re.search(r"delete|modify|write", row.permission_name, re.I) and row.capability not in ["Modify", "Admin"]:
                            triggered = True
                    elif rule_id == "R7": # platform_type missing
                        if not row.platform_type or row.platform_type == "Not Specified":
                            triggered = True
                    elif rule_id == "R8": # desc and additional empty
                        if not row.permission_description and not row.additional_info:
                            triggered = True
                    elif rule_id == "R9": # Quarantine
                        if row.account_type == "Quarantined":
                            triggered = True
                        
                    if triggered:
                        findings.append(Finding(
                            row_id=row.row_id,
                            column="MULTIPLE" if rule_id in ["R1", "R2", "R4", "R8"] else "capability", # approximation
                            value="N/A",
                            severity=rule['severity'],
                            rule_id=rule_id,
                            message=rule['description']
                        ))
        return findings

    def _evaluate_predicate(self, row: PCATRow, predicate: dict) -> bool:
        # Simplified for demo: predicates are handled in the hardcoded logic above for accuracy to requirements
        return True # The actual logic is moved to evaluate rule_id specifically
