from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class PCATRow(BaseModel):
    row_id: int
    application_name: str
    permission_name: str
    permission_description: Optional[str] = ""
    platform_category: str
    platform_type: str
    capability: str
    function: str
    data_classification: str
    account_type: str
    managed_by: str
    provided_by: str
    additional_info: Optional[str] = ""

class Finding(BaseModel):
    row_id: int
    column: str
    value: Any
    severity: str # ERROR, WARNING
    rule_id: str
    message: str
    recommendation: Optional[str] = None

class AppliedFix(BaseModel):
    fix_id: str
    row_id: int
    field: str
    old_value: Any
    new_value: Any
    reason: str # rule_id or recommendation context
    permission_name: Optional[str] = None
    user_decision: Optional[str] = "ACCEPTED" # ACCEPTED, REJECTED

class PCATReportSummary(BaseModel):
    ticket_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    total_rows: int
    error_count: int
    warning_count: int
    findings: List[Finding]
    top_findings: List[Finding] = []
    
    # New Fields for Advanced Workflow
    fix_preview: List[AppliedFix] = []
    applied_fixes: List[AppliedFix] = []
    upload_results: Dict[str, Any] = {}
    updated_csv_path: Optional[str] = None
