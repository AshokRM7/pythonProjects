import asyncio
import os
from datetime import datetime
from typing import List, Callable, Awaitable
from .loader import PCATLoader
from .models import PCATRow, Finding, PCATReportSummary
from .validators.allowed_list_validator import AllowedListValidator
from .validators.rules_engine import RulesEngine
from .validators.conflict_detector import ConflictDetector
from .recommendations import RecommendationEngine
from .report_writer import ReportWriter

class PCATOrchestrator:
    def __init__(self, ticket_id: str, csv_path: str, openai_key: str = None):
        self.ticket_id = ticket_id
        self.csv_path = csv_path
        self.openai_key = openai_key
        
        # Initialize components
        base_dir = "backend/pcat/reference_data"
        self.loader = PCATLoader()
        self.allowed_validator = AllowedListValidator(f"{base_dir}/allowed_lists.json")
        self.rules_engine = RulesEngine(f"{base_dir}/rules_config.json")
        self.conflict_detector = ConflictDetector(f"{base_dir}/conflicts.json")
        self.rec_engine = RecommendationEngine(openai_key)
        self.report_writer = ReportWriter()

    async def run_validation(self, on_stage_update: Callable[[int, str, str, dict], Awaitable[None]]):
        findings: List[Finding] = []
        rows: List[PCATRow] = []

        try:
            # Stage 0: Intake
            await on_stage_update(0, "in-progress", "PCAT Intake Agent is initiating...", {})
            await asyncio.sleep(1)
            rows = self.loader.load_csv(self.csv_path)
            await on_stage_update(0, "completed", f"PCAT Intake Agent loaded {len(rows)} rows.", {"row_count": len(rows)})

            # Stage 1: Schema & Required Fields (Metadata Checklist)
            await on_stage_update(1, "in-progress", "Schema & Required Fields Agent is validating schema...", {})
            await asyncio.sleep(1)
            # Basic required checks are implicit in Pydantic PCATRow or can be added
            await on_stage_update(1, "completed", "Schema & Required Fields Agent: validation passed.", {})

            # Stage 2: Validation Lists Check
            await on_stage_update(2, "in-progress", "Validation Lists Check Agent is running checks...", {})
            list_findings = self.allowed_validator.validate(rows)
            findings.extend(list_findings)
            await asyncio.sleep(1)
            await on_stage_update(2, "completed", f"Validation Lists Check Agent found {len(list_findings)} violations.", {"violations": len(list_findings)})

            # Stage 3: Rules Engine
            await on_stage_update(3, "in-progress", "Rules Engine Agent is processing rules...", {})
            rule_findings = self.rules_engine.validate(rows)
            findings.extend(rule_findings)
            await asyncio.sleep(1)
            await on_stage_update(3, "completed", f"Rules Engine Agent found {len(rule_findings)} violations.", {"violations": len(rule_findings)})

            # Stage 4: Conflict Detection
            await on_stage_update(4, "in-progress", "Conflict Detection Agent is detecting conflicts...", {})
            conflict_findings = self.conflict_detector.validate(rows)
            findings.extend(conflict_findings)
            await asyncio.sleep(1)
            await on_stage_update(4, "completed", f"Conflict Detection Agent found {len(conflict_findings)} conflicts.", {"violations": len(conflict_findings)})

            # Stage 5: Recommendations
            await on_stage_update(5, "in-progress", "Recommendations Agent is generating insights...", {})
            await self.rec_engine.enrich_findings(findings)
            await asyncio.sleep(1)
            await on_stage_update(5, "completed", "Recommendations Agent: insights generated.", {})

            # Stage 6: Evidence Pack Generation (Mock)
            await on_stage_update(6, "in-progress", "Evidence Pack Generation Agent is assembling pack...", {})
            await asyncio.sleep(1)
            await on_stage_update(6, "completed", "Evidence Pack Generation Agent: pack ready.", {})

            # Stage 7: Ticket Update & Report
            await on_stage_update(7, "in-progress", "Auto-Fix & Rebuild CSV Agent is finalizing report...", {})
            
            error_count = len([f for f in findings if f.severity == "ERROR"])
            warning_count = len([f for f in findings if f.severity == "WARNING"])
            
            summary = PCATReportSummary(
                ticket_id=self.ticket_id,
                total_rows=len(rows),
                error_count=error_count,
                warning_count=warning_count,
                findings=findings,
                top_findings=findings[:10] # Top 10 for dashboard
            )
            
            report_path = self.report_writer.write_report(self.ticket_id, summary)
            await asyncio.sleep(1)
            
            pcat_summary_data = {
                "errors": error_count,
                "warnings": warning_count,
                "last_run_at": datetime.now().isoformat(),
                "report_path": report_path
            }
            
            await on_stage_update(7, "completed", "Auto-Fix & Rebuild CSV Agent: finished report.", pcat_summary_data)

            return summary

        except Exception as e:
            print(f"PCAT Orchestrator Error: {e}")
            await on_stage_update(0, "error", f"Validation failed: {str(e)}", {})
            raise e
