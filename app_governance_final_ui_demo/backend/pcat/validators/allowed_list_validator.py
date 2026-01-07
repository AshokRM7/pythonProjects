import json
import os
from typing import List
from ..models import PCATRow, Finding

class AllowedListValidator:
    def __init__(self, reference_data_path: str):
        with open(reference_data_path, 'r') as f:
            self.allowed_lists = json.load(f)

    def validate(self, rows: List[PCATRow]) -> List[Finding]:
        findings = []
        for row in rows:
            for field, allowed_values in self.allowed_lists.items():
                val = getattr(row, field, None)
                if val and val not in allowed_values:
                    # Case insensitive check fallback
                    if val.upper() not in [v.upper() for v in allowed_values]:
                        findings.append(Finding(
                            row_id=row.row_id,
                            column=field,
                            value=val,
                            severity="WARNING",
                            rule_id="L1",
                            message=f"Value '{val}' is not in the allowed list for {field}."
                        ))
        return findings
