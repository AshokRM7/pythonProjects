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

class PCATReportSummary(BaseModel):
    ticket_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    total_rows: int
    error_count: int
    warning_count: int
    findings: List[Finding]
    top_findings: List[Finding] = []
