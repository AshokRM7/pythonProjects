/**
 * TypeScript types for BRE Rule Certification Process
 */

export interface PendingRule {
  rule_id: string;
  rule_name: string;
  rule_type: 'permission' | 'business_rule' | 'compliance_rule';
  description: string;
  current_state: string;
  last_modified: string;
  changes_from_last_et: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface CertificationHistory {
  certification_date: string;
  certified_by: string;
  rules_certified: number;
  status: 'approved' | 'approved_with_conditions' | 'rejected';
  comments: string;
}

export interface AITRules {
  ait_number: string;
  application_name: string;
  pending_rules: PendingRule[];
  certification_history: CertificationHistory[];
}

export interface AppOwnerResponse {
  deliverable_id: string;
  ait_number: string;
  certified_by: string;
  certification_date: string;
  rules_certified: string[];
  status: 'approved' | 'approved_with_conditions' | 'rejected';
  comments: string;
  screenshot_path: string | null;
}

export interface CertificationSubmission {
  deliverable_id: string;
  ait_number: string;
  app_owner_email: string;
  submission_date: string;
  submission_method: 'email' | 'portal' | 'api';
  pending_rules: PendingRule[];
  soft_review_results?: SoftReviewResult;
}

export interface CertificationResponse {
  deliverable_id: string;
  ait_number: string;
  certified_by: string;
  certification_date: string;
  rules_certified: string[];
  status: 'approved' | 'approved_with_conditions' | 'rejected';
  comments: string;
  screenshot_path: string | null;
}

export interface SoftReviewResult {
  ait_number: string;
  total_pending_rules: number;
  high_risk_rules: number;
  review_summary: string;
  recommendations: string[];
  changes_analysis: string;
}

export interface BREWorkflowState {
  deliverable_id: string;
  current_step: string;
  started_at: string;
  completed_at?: string;
  deliverable_info?: any;
  ait_rules?: AITRules;
  soft_review?: SoftReviewResult;
  certification_submission?: CertificationSubmission;
  certification_response?: CertificationResponse;
  app_owner_response?: AppOwnerResponse;
  workflow_log: Array<{
    timestamp: string;
    step: string;
    message: string;
    data?: any;
  }>;
}

export interface BREProcessResponse {
  success: boolean;
  deliverable_id: string;
  current_step: string;
  message: string;
  workflow_state?: BREWorkflowState;
  error?: string;
}

export interface BREWebSocketMessage {
  type: 'bre_stage_update' | 'bre_connected' | 'bre_reset' | 'bre_complete';
  deliverable_id?: string;
  stage_id?: number;
  status?: string;
  message?: string;
  ticket?: any;
  workflow_state?: BREWorkflowState;
  data?: any;
}
