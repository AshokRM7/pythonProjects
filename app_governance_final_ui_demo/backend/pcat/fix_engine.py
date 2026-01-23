from typing import List, Tuple
from .models import PCATRow, Finding, AppliedFix
import copy
import re

class PCATFixEngine:
    @staticmethod
    def preview_fixes(rows: List[PCATRow], findings: List[Finding]) -> List[AppliedFix]:
        """
        Generate a list of AppliedFix objects without modifying original data.
        """
        fix_preview = []
        for row in rows:
            row_findings = [f for f in findings if f.row_id == row.row_id]
            for finding in row_findings:
                fix = PCATFixEngine._get_fix_for_finding(row, finding)
                if fix:
                    fix_preview.append(fix)
        return fix_preview

    @staticmethod
    def apply_fixes(rows: List[PCATRow], findings: List[Finding], manual_fixes: List[AppliedFix] = None) -> Tuple[List[PCATRow], List[AppliedFix]]:
        """
        Apply deterministic fixes to rows and return updated rows + list of what was changed.
        If manual_fixes is provided, it applies only those (user-accepted ones).
        """
        updated_rows = copy.deepcopy(rows)
        applied_fixes = []
        
        row_map = {r.row_id: r for r in updated_rows}
        
        if manual_fixes is not None:
            for fix in manual_fixes:
                if fix.user_decision == "REJECTED":
                    continue
                row = row_map.get(fix.row_id)
                if row:
                    setattr(row, fix.field, fix.new_value)
                    applied_fixes.append(fix)
            return updated_rows, applied_fixes

        for finding in findings:
            row = row_map.get(finding.row_id)
            if not row:
                continue
            
            fix = PCATFixEngine._get_fix_for_finding(row, finding)
            if fix:
                # Apply the change
                setattr(row, fix.field, fix.new_value)
                applied_fixes.append(fix)
                
        return updated_rows, applied_fixes

    @staticmethod
    def _get_fix_for_finding(row: PCATRow, finding: Finding) -> AppliedFix:
        """
        Deterministic fix logic based on rule_id and finding context.
        """
        reason = finding.rule_id
        fix_id_prefix = f"row_{row.row_id}_{finding.rule_id}"
        
        # Rule R5: provided_by missing for WAN/APP/DB
        if finding.rule_id == "R5" and row.provided_by == "AIT NOT SPECIFIED":
             return AppliedFix(
                fix_id=f"{fix_id_prefix}_provided_by",
                row_id=row.row_id,
                field="provided_by",
                old_value=row.provided_by,
                new_value="IAM_TEAM",
                reason="R5 (Standardizing missing AIT provider)",
                permission_name=row.permission_name
            )

        # Rule R3 / R6: permission_name vs capability mismatch
        if finding.rule_id in ["R3", "R6"]:
            # R3: name has 'read' but cap not 'Read Only'
            if finding.rule_id == "R3" and "read" in row.permission_name.lower() and row.capability != "Read Only":
                return AppliedFix(
                    fix_id=f"{fix_id_prefix}_capability",
                    row_id=row.row_id,
                    field="capability",
                    old_value=row.capability,
                    new_value="Read Only",
                    reason=f"{finding.rule_id} (Syncing capability with permission name)",
                    permission_name=row.permission_name
                )
            
            # R6: name has 'delete/modify/write' but cap not 'Modify/Admin'
            if finding.rule_id == "R6" and re.search(r"delete|modify|write", row.permission_name, re.I) and row.capability not in ["Modify", "Admin"]:
                return AppliedFix(
                    fix_id=f"{fix_id_prefix}_capability",
                    row_id=row.row_id,
                    field="capability",
                    old_value=row.capability,
                    new_value="Modify",
                    reason=f"{finding.rule_id} (Syncing capability with permission name)",
                    permission_name=row.permission_name
                )

        # Rule R1: managed_by for WAN
        if finding.rule_id == "R1" and row.platform_category == "WAN":
            if row.managed_by not in ["AD", "Active Directory"]:
                return AppliedFix(
                    fix_id=f"{fix_id_prefix}_managed_by",
                    row_id=row.row_id,
                    field="managed_by",
                    old_value=row.managed_by,
                    new_value="Active Directory",
                    reason="R1 (WAN must be AD managed)",
                    permission_name=row.permission_name
                )

        # Rule R7: platform_type missing
        if finding.rule_id == "R7" and (not row.platform_type or row.platform_type == "Not Specified"):
            return AppliedFix(
                fix_id=f"{fix_id_prefix}_platform_type",
                row_id=row.row_id,
                field="platform_type",
                old_value=row.platform_type,
                new_value="ON-PREM",
                reason="R7 (Defaulting unspecified platform type)",
                permission_name=row.permission_name
            )

        # List Validator L1 - only fix if recommendation exists and is clear (mock logic)
        if finding.rule_id == "L1" and "Choose a value" not in finding.message:
             # Add generic list fix if we can infer (skipped for now as ambiguous per requirements)
             pass

        # Rule R9: Quarantine
        if finding.rule_id == "R9" and row.account_type == "Quarantined":
            return AppliedFix(
                fix_id=f"{fix_id_prefix}_account_type",
                row_id=row.row_id,
                field="account_type",
                old_value=row.account_type,
                new_value="Human",
                reason="R9 (Removing quarantine status for access)",
                permission_name=row.permission_name
            )

        return None
