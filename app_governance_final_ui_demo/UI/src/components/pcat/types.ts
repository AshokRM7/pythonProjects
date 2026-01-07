export interface PCATFinding {
    row_id: number;
    column: string;
    value: any;
    severity: 'ERROR' | 'WARNING';
    rule_id: string;
    message: string;
    recommendation?: string;
}

export interface PCATReport {
    ticket_id: string;
    timestamp: string;
    total_rows: number;
    error_count: number;
    warning_count: number;
    findings: PCATFinding[];
    top_findings: PCATFinding[];
}

export interface PCATSummary {
    errors: number;
    warnings: number;
    last_run_at: string;
    report_path?: string;
}
