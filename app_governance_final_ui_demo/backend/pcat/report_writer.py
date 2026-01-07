import json
import os
from datetime import datetime
from .models import PCATReportSummary

class ReportWriter:
    @staticmethod
    def write_report(ticket_id: str, summary: PCATReportSummary) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = f"backend/data/pcat/runs/{ticket_id}/{timestamp}"
        os.makedirs(report_dir, exist_ok=True)
        
        report_path = f"{report_dir}/report.json"
        with open(report_path, 'w') as f:
            json.dump(summary.model_dump(), f, indent=2)
        
        # Also symlink or copy to "latest"
        latest_path = f"backend/data/pcat/runs/{ticket_id}/latest_report.json"
        with open(latest_path, 'w') as f:
            json.dump(summary.model_dump(), f, indent=2)
            
        return report_path
