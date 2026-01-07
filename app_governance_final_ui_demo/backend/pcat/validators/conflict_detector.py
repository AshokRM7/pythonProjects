import json
import re
from typing import List
from ..models import PCATRow, Finding

class ConflictDetector:
    def __init__(self, conflicts_config_path: str):
        with open(conflicts_config_path, 'r') as f:
            self.conflicts = json.load(f)

    def validate(self, rows: List[PCATRow]) -> List[Finding]:
        findings = []
        for row in rows:
            for conflict in self.conflicts:
                condition = conflict['condition']
                
                triggered = True
                for field, target_val in condition.items():
                    current_val = getattr(row, field, None)
                    
                    if field.endswith('_regex'):
                        actual_field = field.replace('_regex', '')
                        current_val = getattr(row, actual_field, '')
                        if not re.search(target_val, current_val, re.I):
                            triggered = False
                            break
                    else:
                        if current_val != target_val:
                            triggered = False
                            break
                
                if triggered:
                    findings.append(Finding(
                        row_id=row.row_id,
                        column="MULTIPLE",
                        value="CONFLICT",
                        severity=conflict['severity'],
                        rule_id=conflict['conflict_id'],
                        message=conflict['description']
                    ))
        return findings
