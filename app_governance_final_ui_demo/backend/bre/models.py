"""
Data models for BRE Rule Certification Process
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from enum import Enum


class DeliverableStatus(str, Enum):
    """Status of BRE deliverable"""
    OPEN = "open"
    IN_REVIEW = "in_review"
    PENDING_CERTIFICATION = "pending_certification"
    CERTIFIED = "certified"
    CLOSED = "closed"


class PriorityLevel(str, Enum):
    """Priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ViolationType(str, Enum):
    """Types of violations"""
    PERMISSION = "permission_violation"
    RULE = "rule_violation"
    COMPLIANCE = "compliance_violation"


class RiskLevel(str, Enum):
    """Risk assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class BREDeliverable(BaseModel):
    """Model for BRE deliverable from RISE portal"""
    deliverable_id: str
    application_id: str
    ait_number: str
    status: DeliverableStatus
    priority: PriorityLevel
    violation_type: ViolationType
    description: str
    created_date: datetime
    assigned_to: str
    rise_ticket_id: str


class PendingRule(BaseModel):
    """Model for pending rule requiring certification"""
    rule_id: str
    rule_name: str
    rule_type: Literal["permission", "business_rule", "compliance_rule"]
    description: str
    current_state: str
    last_modified: datetime
    changes_from_last_et: List[str]
    risk_level: RiskLevel


class CertificationHistory(BaseModel):
    """Historical certification record"""
    certification_date: datetime
    certified_by: str
    rules_certified: int
    status: Literal["approved", "approved_with_conditions", "rejected"]
    comments: str


class AITRules(BaseModel):
    """Rules associated with an AIT"""
    ait_number: str
    application_name: str
    pending_rules: List[PendingRule]
    certification_history: List[CertificationHistory]


class AppOwner(BaseModel):
    """Application owner information"""
    name: str
    email: str
    department: str
    phone: str


class SoftReviewResult(BaseModel):
    """Result of soft review analysis"""
    ait_number: str
    total_pending_rules: int
    high_risk_rules: int
    review_summary: str
    recommendations: List[str]
    changes_analysis: str
    requires_immediate_attention: bool


class CertificationSubmission(BaseModel):
    """Certification submission to app owner"""
    deliverable_id: str
    ait_number: str
    app_owner_email: str
    pending_rules: List[PendingRule]
    soft_review_results: SoftReviewResult
    submission_date: datetime
    submission_method: Literal["email", "portal", "api"]


class CertificationResponse(BaseModel):
    """Response from application owner"""
    deliverable_id: str
    ait_number: str
    certified_by: str
    certification_date: datetime
    rules_certified: List[str]
    status: Literal["approved", "approved_with_conditions", "rejected"]
    comments: str
    screenshot_path: Optional[str] = None


class EvidenceRecord(BaseModel):
    """Evidence record for closure"""
    deliverable_id: str
    rise_ticket_id: str
    screenshot_path: str
    certification_response: CertificationResponse
    closing_comments: str
    closure_date: datetime


class BREWorkflowState(BaseModel):
    """Complete state of BRE workflow"""
    deliverable: BREDeliverable
    ait_rules: Optional[AITRules] = None
    soft_review: Optional[SoftReviewResult] = None
    certification_submission: Optional[CertificationSubmission] = None
    certification_response: Optional[CertificationResponse] = None
    evidence_record: Optional[EvidenceRecord] = None
    current_step: Literal[
        "intake", 
        "portal_check", 
        "soft_review", 
        "certification_submission", 
        "evidence_closure",
        "completed"
    ] = "intake"
    workflow_log: List[dict] = Field(default_factory=list)


class BREProcessRequest(BaseModel):
    """Request to process a BRE deliverable"""
    deliverable_id: str


class BREProcessResponse(BaseModel):
    """Response from BRE process"""
    success: bool
    deliverable_id: str
    current_step: str
    message: str
    workflow_state: Optional[BREWorkflowState] = None
    error: Optional[str] = None


class DecisionModel(BaseModel):
    """Model for a single Certify/Remove decision"""
    permission_id: str
    permission_name: str
    action: Literal["certify", "remove", ""]
    comment: Optional[str] = ""


class BRESubmitRequest(BaseModel):
    """Request to submit remediation decisions"""
    deliverable_id: str
    decisions: List[DecisionModel]
