from typing import List, Tuple
from .models import PCATRow, Finding, AppliedFix
import copy

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
    def apply_fixes(rows: List[PCATRow], findings: List[Finding]) -> Tuple[List[PCATRow], List[AppliedFix]]:
        """
        Apply deterministic fixes to rows and return updated rows + list of what was changed.
        """
        updated_rows = copy.deepcopy(rows)
        applied_fixes = []
        
        row_map = {r.row_id: r for r in updated_rows}
        
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
        
        # Rule R5: provided_by missing for WAN/APP/DB
        if finding.rule_id == "R5" and row.provided_by == "AIT NOT SPECIFIED":
             return AppliedFix(
                row_id=row.row_id,
                field="provided_by",
                old_value=row.provided_by,
                new_value="IAM_TEAM",
                reason="R5 (Standardizing missing AIT provider)"
            )

        # Rule R3 / R6: permission_name vs capability mismatch
        if finding.rule_id in ["R3", "R6"]:
            # R3: name has 'read' but cap not 'Read Only'
            if "read" in row.permission_name.lower() and row.capability != "Read Only":
                return AppliedFix(
                    row_id=row.row_id,
                    field="capability",
                    old_value=row.capability,
                    new_value="Read Only",
                    reason=f"{finding.rule_id} (Syncing capability with permission name)"
                )

        # Rule R1: managed_by for WAN
        if finding.rule_id == "R1" and row.platform_category == "WAN":
            if row.managed_by not in ["AD", "Active Directory"]:
                return AppliedFix(
                    row_id=row.row_id,
                    field="managed_by",
                    old_value=row.managed_by,
                    new_value="Active Directory",
                    reason="R1 (WAN must be AD managed)"
                )

        # Rule R7: platform_type missing
        if finding.rule_id == "R7" and (not row.platform_type or row.platform_type == "Not Specified"):
            return AppliedFix(
                row_id=row.row_id,
                field="platform_type",
                old_value=row.platform_type,
                new_value="ON-PREM",
                reason="R7 (Defaulting unspecified platform type)"
            )

        # List Validator L1 - only fix if recommendation exists and is clear (mock logic)
        if finding.rule_id == "L1" and "Choose a value" not in finding.message:
             # Add generic list fix if we can infer (skipped for now as ambiguous per requirements)
             pass

        return None
