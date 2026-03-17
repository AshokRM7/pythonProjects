"""
BRE Rule Certification Process Orchestrator
Coordinates the complete workflow across all agents
"""
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Callable, Awaitable
from pathlib import Path

from backend.bre.models import (
    BREWorkflowState,
    BREDeliverable,
    DeliverableStatus
)
from backend.bre.agents.deliverable_intake_agent import DeliverableIntakeAgent
from backend.bre.agents.bre_portal_agent import BREPortalAgent
from backend.bre.agents.soft_review_agent import SoftReviewAgent
from backend.bre.agents.certification_submission_agent import CertificationSubmissionAgent
from backend.bre.agents.evidence_closure_agent import EvidenceClosureAgent
from backend.agents.bre_remediation_agent import BRERemediationAgent
from backend.agents.logger import LoggerAgent

BroadcastFn = Optional[Callable[[dict], Awaitable[None]]]

# BRE workflow stage definitions (mirrors IAM stages structure)
BRE_STAGES = [
    {"id": 0, "name": "BRE Ticket Intake",            "status": "pending", "message": ""},
    {"id": 1, "name": "Deliverable Intake Agent",     "status": "pending", "message": ""},
    {"id": 2, "name": "BRE Portal Check Agent",       "status": "pending", "message": ""},
    {"id": 3, "name": "Soft Review Agent",            "status": "pending", "message": ""},
    {"id": 4, "name": "Certification Submission Agent","status": "pending","message": ""},
    {"id": 5, "name": "Evidence & Closure Agent",     "status": "pending", "message": ""},
    {"id": 6, "name": "BRE Remediation Agent",        "status": "pending", "message": ""},
    {"id": 7, "name": "Archive & Close Agent",        "status": "pending", "message": ""},
]


class BREOrchestrator:
    """
    Orchestrates the complete BRE Rule Certification Process
    
    Workflow Steps:
    1. Deliverable Intake - Receive and extract key information
    2. BRE Portal Check - Search for rules and history
    3. Soft Review - Analyze rules without final certification
    4. Certification Submission - Send to app owner for certification
    5. Evidence & Closure - Capture evidence and close deliverable
    """
    
    def __init__(self, llm=None):
        """Initialize orchestrator with optional LLM"""
        self.llm = llm
        
        # Initialize all agents
        self.intake_agent = DeliverableIntakeAgent(llm)
        self.portal_agent = BREPortalAgent(llm)
        self.review_agent = SoftReviewAgent(llm)
        self.submission_agent = CertificationSubmissionAgent(llm)
        self.closure_agent = EvidenceClosureAgent(llm)
        self.remediation_agent = BRERemediationAgent()
        self.logger_agent = LoggerAgent(llm)
        
        # Workflow state storage
        self.workflow_states: Dict[str, BREWorkflowState] = {}
        self.state_file = Path(__file__).parent / "data" / "workflow_states.json"
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        
        # App owner responses file
        self.app_owner_responses_file = Path(__file__).parent / "data" / "app_owner_responses.json"
        
        # WebSocket broadcast callback (injected from api_server.py)
        self._broadcast: BroadcastFn = None

        # Inbox poll callback (injected from api_server.py)
        self._poll_fn: Optional[Callable[[str, str], Awaitable[None]]] = None

        # Shared ticket store reference (injected from api_server.py)
        self._current_tickets: Optional[Dict[str, Any]] = None

        # Load existing states
        self._load_states()

    def set_broadcast(self, broadcast_fn: BroadcastFn, current_tickets: Dict[str, Any]):
        """Inject WebSocket broadcast callback and shared ticket store"""
        self._broadcast = broadcast_fn
        self._current_tickets = current_tickets

    def set_poll_fn(self, poll_fn: Callable[[str, str], Awaitable[None]]):
        """Inject shared inbox polling function"""
        self._poll_fn = poll_fn
    
    def _load_states(self):
        """Load workflow states from file"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    for del_id, state_dict in data.items():
                        self.workflow_states[del_id] = BREWorkflowState(**state_dict)
            except Exception as e:
                print(f"Error loading workflow states: {e}")
    
    def _save_states(self):
        """Save workflow states to file"""
        try:
            data = {
                del_id: state.model_dump(mode='json')
                for del_id, state in self.workflow_states.items()
            }
            with open(self.state_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving workflow states: {e}")
    
    def _load_app_owner_response(self, deliverable_id: str) -> Optional[Dict[str, Any]]:
        """Load app owner response from file for a specific deliverable"""
        if not self.app_owner_responses_file.exists():
            print(f"App owner responses file not found: {self.app_owner_responses_file}")
            return None
        
        try:
            with open(self.app_owner_responses_file, 'r') as f:
                data = json.load(f)
                responses = data.get("responses", {})
                response = responses.get(deliverable_id)
                
                if response:
                    print(f"✓ Loaded app owner response for {deliverable_id}")
                    return response
                else:
                    print(f"⚠ No app owner response found for {deliverable_id}")
                    return None
        except Exception as e:
            print(f"Error loading app owner response: {e}")
            return None
    
    def _log_workflow_step(self, state: BREWorkflowState, step: str, message: str, data: Any = None):
        """Log a workflow step"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "step": step,
            "message": message,
            "data": data
        }
        state.workflow_log.append(log_entry)
    
    def process_deliverable(self, deliverable_id: str, auto_complete: bool = False) -> Dict[str, Any]:
        """
        Process a BRE deliverable through the complete workflow
        
        Args:
            deliverable_id: ID of the deliverable to process
            auto_complete: If True, simulates completion of all steps automatically
        
        Returns:
            Dict with processing results
        """
        try:
            # Step 1: Deliverable Intake
            intake_result = self._step_1_intake(deliverable_id)
            if not intake_result["success"]:
                return intake_result
            
            state = self.workflow_states[deliverable_id]
            
            # Step 2: BRE Portal Check
            portal_result = self._step_2_portal_check(state)
            if not portal_result["success"]:
                return portal_result
            
            # Step 3: Soft Review
            review_result = self._step_3_soft_review(state)
            if not review_result["success"]:
                return review_result
            
            # Step 4: Certification Submission
            submission_result = self._step_4_submission(state)
            if not submission_result["success"]:
                return submission_result
            
            # Step 5: Evidence & Closure (if auto_complete or certification received)
            if auto_complete:
                closure_result = self._step_5_closure(state, auto_complete_certification=True)
                if closure_result["success"]:
                    state.current_step = "completed"
                    self._save_states()
            
            return {
                "success": True,
                "deliverable_id": deliverable_id,
                "current_step": state.current_step,
                "message": "BRE workflow processing completed successfully",
                "workflow_state": state.model_dump(mode='json')
            }
            
        except Exception as e:
            return {
                "success": False,
                "deliverable_id": deliverable_id,
                "error": str(e),
                "message": f"Error processing BRE deliverable: {str(e)}"
            }
    
    def _step_1_intake(self, deliverable_id: str) -> Dict[str, Any]:
        """Step 1: Deliverable Intake"""
        try:
            print(f"\n{'='*60}")
            print(f"STEP 1: DELIVERABLE INTAKE - {deliverable_id}")
            print(f"{'='*60}")
            
            result = self.intake_agent.process(deliverable_id)
            
            if not result["success"]:
                return result
            
            # Create workflow state
            deliverable_data = result["deliverable"]
            deliverable = BREDeliverable(**deliverable_data)
            
            state = BREWorkflowState(
                deliverable=deliverable,
                current_step="intake"
            )
            
            self._log_workflow_step(
                state,
                "intake",
                "Deliverable received and key information extracted",
                result["extracted_info"]
            )
            
            state.current_step = "portal_check"
            self.workflow_states[deliverable_id] = state
            self._save_states()
            
            print(f"✓ Application ID: {deliverable.application_id}")
            print(f"✓ AIT Number: {deliverable.ait_number}")
            print(f"✓ Status: {deliverable.status}")
            
            return {
                "success": True,
                "deliverable_id": deliverable_id,
                "message": "Intake completed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Intake failed: {str(e)}"
            }
    
    def _step_2_portal_check(self, state: BREWorkflowState) -> Dict[str, Any]:
        """Step 2: BRE Portal Check"""
        try:
            print(f"\n{'='*60}")
            print(f"STEP 2: BRE PORTAL CHECK - {state.deliverable.ait_number}")
            print(f"{'='*60}")
            
            result = self.portal_agent.process(state.deliverable.ait_number)
            
            if not result["success"]:
                return result
            
            # Store AIT rules in state
            from backend.bre.models import AITRules, PendingRule, CertificationHistory
            
            ait_data = result["ait_data"]
            pending_rules = [PendingRule(**rule) for rule in ait_data["pending_rules"]]
            cert_history = [CertificationHistory(**hist) for hist in ait_data["certification_history"]]
            
            state.ait_rules = AITRules(
                ait_number=ait_data["ait_number"],
                application_name=ait_data["application_name"],
                pending_rules=pending_rules,
                certification_history=cert_history
            )
            
            self._log_workflow_step(
                state,
                "portal_check",
                "BRE Portal checked successfully",
                result["pending_rules"]
            )
            
            state.current_step = "soft_review"
            self._save_states()
            
            print(f"✓ Application: {state.ait_rules.application_name}")
            print(f"✓ Pending Rules: {len(state.ait_rules.pending_rules)}")
            print(f"✓ Previous Certifications: {len(state.ait_rules.certification_history)}")
            
            return {
                "success": True,
                "message": "Portal check completed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Portal check failed: {str(e)}"
            }
    
    def _step_3_soft_review(self, state: BREWorkflowState) -> Dict[str, Any]:
        """Step 3: Soft Review"""
        try:
            print(f"\n{'='*60}")
            print(f"STEP 3: SOFT REVIEW")
            print(f"{'='*60}")
            
            if not state.ait_rules or not state.ait_rules.pending_rules:
                return {
                    "success": False,
                    "error": "No pending rules to review"
                }
            
            pending_rules = [rule.model_dump(mode='json') for rule in state.ait_rules.pending_rules]
            result = self.review_agent.process(pending_rules)
            
            if not result["success"]:
                return result
            
            # Store soft review results
            from backend.bre.models import SoftReviewResult
            
            risk_assessment = result.get("risk_assessment", {})
            review_summary = result.get("review_summary", {})
            
            state.soft_review = SoftReviewResult(
                ait_number=state.deliverable.ait_number,
                total_pending_rules=risk_assessment.get("total_rules", 0),
                high_risk_rules=risk_assessment.get("risk_breakdown", {}).get("high", 0) + 
                                risk_assessment.get("risk_breakdown", {}).get("critical", 0),
                review_summary=review_summary.get("overall_assessment", "completed"),
                recommendations=result.get("recommendations", {}).get("certification_guidance", []),
                changes_analysis=f"Reviewed {len(pending_rules)} rules with focus on ET changes",
                requires_immediate_attention=risk_assessment.get("overall_risk") in ["critical", "high"]
            )
            
            self._log_workflow_step(
                state,
                "soft_review",
                "Soft review completed by App Governance",
                result
            )
            
            state.current_step = "certification_submission"
            self._save_states()
            
            print(f"✓ Rules Reviewed: {state.soft_review.total_pending_rules}")
            print(f"✓ High Risk Rules: {state.soft_review.high_risk_rules}")
            print(f"✓ Overall Assessment: {state.soft_review.review_summary}")
            print(f"✓ Immediate Attention Required: {state.soft_review.requires_immediate_attention}")
            
            return {
                "success": True,
                "message": "Soft review completed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Soft review failed: {str(e)}"
            }
    
    def _step_4_submission(self, state: BREWorkflowState) -> Dict[str, Any]:
        """Step 4: Certification Submission"""
        try:
            print(f"\n{'='*60}")
            print(f"STEP 4: CERTIFICATION SUBMISSION")
            print(f"{'='*60}")
            
            if not state.soft_review or not state.ait_rules:
                return {
                    "success": False,
                    "error": "Soft review not completed"
                }
            
            pending_rules = [rule.model_dump(mode='json') for rule in state.ait_rules.pending_rules]
            soft_review = state.soft_review.model_dump(mode='json')
            
            result = self.submission_agent.process(
                state.deliverable.application_id,
                state.deliverable.ait_number,
                pending_rules,
                soft_review
            )
            
            if not result["success"]:
                return result
            
            # Store submission details
            from backend.bre.models import CertificationSubmission
            
            submission_data = result.get("submission", {})
            
            state.certification_submission = CertificationSubmission(
                deliverable_id=state.deliverable.deliverable_id,
                ait_number=state.deliverable.ait_number,
                app_owner_email=result["app_owner"]["email"],
                pending_rules=state.ait_rules.pending_rules,
                soft_review_results=state.soft_review,
                submission_date=datetime.now(),
                submission_method="email"
            )
            
            self._log_workflow_step(
                state,
                "certification_submission",
                "Certification request sent to Application Owner",
                result
            )
            
            state.deliverable.status = DeliverableStatus.PENDING_CERTIFICATION
            state.current_step = "evidence_closure"
            self._save_states()
            
            print(f"✓ Submitted to: {result['app_owner']['name']} ({result['app_owner']['email']})")
            print(f"✓ Submission ID: {submission_data.get('submission_id')}")
            print(f"✓ Status: Awaiting certification from app owner")
            
            return {
                "success": True,
                "message": "Certification submission completed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Certification submission failed: {str(e)}"
            }
    
    def _step_5_closure(self, state: BREWorkflowState, auto_complete_certification: bool = False) -> Dict[str, Any]:
        """Step 5: Evidence & Closure"""
        try:
            print(f"\n{'='*60}")
            print(f"STEP 5: EVIDENCE & CLOSURE")
            print(f"{'='*60}")
            
            # Simulate or use actual certification response
            if auto_complete_certification:
                from backend.bre.models import CertificationResponse
                
                # Simulate app owner certification
                state.certification_response = CertificationResponse(
                    deliverable_id=state.deliverable.deliverable_id,
                    ait_number=state.deliverable.ait_number,
                    certified_by=state.certification_submission.app_owner_email,
                    certification_date=datetime.now(),
                    rules_certified=[rule.rule_id for rule in state.ait_rules.pending_rules],
                    status="approved",
                    comments="All rules reviewed and approved. Changes are appropriate and justified.",
                    screenshot_path=None
                )
            
            else:
                # Wait for actual certification response from app owner
                print("⏳ Loading certification response from app owner...")
                response_data = self._load_app_owner_response(state.deliverable.deliverable_id)
                
                if response_data:
                    from backend.bre.models import CertificationResponse
                    
                    # Convert ISO string to datetime if needed
                    cert_date = response_data.get("certification_date")
                    if isinstance(cert_date, str):
                        cert_date = datetime.fromisoformat(cert_date.replace('Z', '+00:00'))
                    
                    state.certification_response = CertificationResponse(
                        deliverable_id=response_data["deliverable_id"],
                        ait_number=response_data["ait_number"],
                        certified_by=response_data["certified_by"],
                        certification_date=cert_date,
                        rules_certified=response_data["rules_certified"],
                        status=response_data["status"],
                        comments=response_data["comments"],
                        screenshot_path=response_data.get("screenshot_path")
                    )
                    print(f"✓ Loaded response from {response_data['certified_by']}")
                    print(f"✓ Status: {response_data['status']}")
                    print(f"✓ Rules certified: {len(response_data['rules_certified'])}")

            
            if not state.certification_response:
                return {
                    "success": False,
                    "error": "Certification response not received from app owner"
                }
            
            cert_response = state.certification_response.model_dump(mode='json')
            
            result = self.closure_agent.process(
                state.deliverable.deliverable_id,
                state.deliverable.rise_ticket_id,
                cert_response
            )
            
            if not result["success"]:
                return result
            
            # Store evidence record
            from backend.bre.models import EvidenceRecord
            
            state.evidence_record = EvidenceRecord(
                deliverable_id=state.deliverable.deliverable_id,
                rise_ticket_id=state.deliverable.rise_ticket_id,
                screenshot_path=result["screenshot"]["path"],
                certification_response=state.certification_response,
                closing_comments=json.dumps(result["closing_comments"]),
                closure_date=datetime.now()
            )
            
            self._log_workflow_step(
                state,
                "evidence_closure",
                "Evidence captured and deliverable closed",
                result
            )
            
            state.deliverable.status = DeliverableStatus.CLOSED
            state.current_step = "completed"
            self._save_states()
            
            print(f"✓ Screenshot captured: {result['screenshot']['filename']}")
            print(f"✓ Attached to RISE: {result['attachment']['attachment_id']}")
            print(f"✓ Deliverable closed: {result['closure']['deliverable_id']}")
            print(f"✓ Audit record: {result['audit']['audit_id']}")
            
            return {
                "success": True,
                "message": "Evidence captured and deliverable closed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Evidence & closure failed: {str(e)}"
            }
    
    def get_workflow_status(self, deliverable_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a workflow"""
        state = self.workflow_states.get(deliverable_id)
        if not state:
            return None
        
        return {
            "deliverable_id": deliverable_id,
            "current_step": state.current_step,
            "status": state.deliverable.status,
            "workflow_log": state.workflow_log,
            "complete_state": state.model_dump(mode='json')
        }
    
    def list_active_workflows(self) -> list:
        """List all active workflows"""
        return [
            {
                "deliverable_id": del_id,
                "ait_number": state.deliverable.ait_number,
                "current_step": state.current_step,
                "status": state.deliverable.status,
                "priority": state.deliverable.priority
            }
            for del_id, state in self.workflow_states.items()
            if state.current_step != "completed"
        ]

    # ------------------------------------------------------------------
    # Async pipeline with WebSocket broadcast (mirrors IAM pipeline)
    # ------------------------------------------------------------------

    async def _broadcast_stage(self, ticket_id: str, stage_idx: int, status: str, message: str):
        """Update ticket stage in shared store and broadcast via WebSocket"""
        if self._current_tickets and ticket_id in self._current_tickets:
            ticket = self._current_tickets[ticket_id]
            ticket["currentStage"] = stage_idx
            if stage_idx < len(ticket.get("stages", [])):
                ticket["stages"][stage_idx]["status"] = status
                ticket["stages"][stage_idx]["message"] = message
            if status == "in-progress":
                ticket["status"] = "in-progress"
            
            # Determine if this is the final stage for this ticket
            is_bre_new = ticket.get("deliverableType") == "BRE-NEW"
            # For BRE-NEW, terminal stage is 7 (Archive & Close)
            # For legacy, terminal stage is 5 (Evidence & Closure)
            final_stage_idx = 7 if is_bre_new else 5
            
            if status == "completed" and stage_idx == final_stage_idx:
                ticket["status"] = "completed"

        if self._broadcast:
            payload: Dict[str, Any] = {
                "type": "bre_stage_update",
                "deliverable_id": ticket_id,
                "stage": {"index": stage_idx, "status": status, "message": message},
            }
            if self._current_tickets and ticket_id in self._current_tickets:
                payload["ticket"] = self._current_tickets[ticket_id]
            await self._broadcast(payload)

    async def process_deliverable_async(self, deliverable_id: str) -> Dict[str, Any]:
        """
        Async processing of a BRE deliverable with step-by-step WebSocket broadcasts.
        Each step corresponds to a BRE_STAGE entry.
        """
        try:
            # Stage 0 – Ticket intake confirmation
            await self._broadcast_stage(deliverable_id, 0, "in-progress", "BRE Ticket Intake: Loading deliverable from ticket registry...")
            await asyncio.sleep(0.1)

            # Stage 1 – Deliverable Intake Agent
            await self._broadcast_stage(deliverable_id, 1, "in-progress", "Deliverable Intake Agent: Extracting Application ID and AIT number...")
            await asyncio.sleep(2)  # Simulate processing time
            intake_result = await asyncio.to_thread(self._step_1_intake, deliverable_id)
            if not intake_result["success"]:
                await self._broadcast_stage(deliverable_id, 1, "error", f"Intake failed: {intake_result.get('error', 'Unknown error')}")
                return intake_result
            await self._broadcast_stage(deliverable_id, 0, "completed", "✅ BRE Ticket loaded successfully")
            await self._broadcast_stage(deliverable_id, 1, "completed", "✅ Deliverable intake complete")

            state = self.workflow_states[deliverable_id]

            # Stage 2 – BRE Portal Check
            await self._broadcast_stage(deliverable_id, 2, "in-progress", f"BRE Portal Check Agent: Searching rules for {state.deliverable.ait_number}...")
            await asyncio.sleep(2)  # Simulate processing time
            portal_result = await asyncio.to_thread(self._step_2_portal_check, state)
            if not portal_result["success"]:
                await self._broadcast_stage(deliverable_id, 2, "error", f"Portal check failed: {portal_result.get('error', 'Unknown error')}")
                return portal_result
            rule_count = len(state.ait_rules.pending_rules) if state.ait_rules else 0
            await self._broadcast_stage(deliverable_id, 2, "completed", f"✅ Found {rule_count} pending rule(s) in BRE Portal")

            # Stage 3 – Soft Review
            await self._broadcast_stage(deliverable_id, 3, "in-progress", "Soft Review Agent: Analyzing rules without final certification...")
            await asyncio.sleep(2)  # Simulate processing time
            review_result = await asyncio.to_thread(self._step_3_soft_review, state)
            if not review_result["success"]:
                await self._broadcast_stage(deliverable_id, 3, "error", f"Soft review failed: {review_result.get('error', 'Unknown error')}")
                return review_result
            high_risk = state.soft_review.high_risk_rules if state.soft_review else 0
            await self._broadcast_stage(deliverable_id, 3, "completed", f"✅ Soft review complete — {high_risk} high-risk rule(s) identified")

            # Stage 4 – Certification Submission (pause for app owner)
            await self._broadcast_stage(deliverable_id, 4, "in-progress", "Certification Submission Agent: Sending certification request to App Owner...")
            await asyncio.sleep(2)  # Simulate processing time
            submission_result = await asyncio.to_thread(self._step_4_submission, state)
            if not submission_result["success"]:
                await self._broadcast_stage(deliverable_id, 4, "error", f"Submission failed: {submission_result.get('error', 'Unknown error')}")
                return submission_result
            app_owner_email = state.certification_submission.app_owner_email if state.certification_submission else "app owner"
            await self._broadcast_stage(deliverable_id, 4, "completed", f"✅ Certification request sent to {app_owner_email}")

            # Mark ticket as waiting for certification
            if self._current_tickets and deliverable_id in self._current_tickets:
                self._current_tickets[deliverable_id]["waitingForCertification"] = True
            if self._broadcast:
                await self._broadcast({
                    "type": "bre_waiting_certification",
                    "deliverable_id": deliverable_id,
                    "message": f"Waiting for app owner certification from {app_owner_email}",
                    "ticket": self._current_tickets.get(deliverable_id) if self._current_tickets else {},
                })
            return {
                "success": True,
                "deliverable_id": deliverable_id,
                "current_step": "evidence_closure",
                "message": "Awaiting app owner certification. Call /api/bre/certify/{deliverable_id} to complete.",
                "workflow_state": state.model_dump(mode="json"),
            }

        except Exception as e:
            if self._broadcast:
                await self._broadcast({
                    "type": "bre_error",
                    "deliverable_id": deliverable_id,
                    "message": f"Error processing BRE deliverable: {str(e)}",
                })
            return {
                "success": False,
                "deliverable_id": deliverable_id,
                "error": str(e),
                "message": f"Error in async BRE pipeline: {str(e)}",
            }

    async def verify_and_close_async(self, deliverable_id: str, auto_certify: bool = False) -> Dict[str, Any]:
        """
        Stage 5: Evidence & Closure after app owner certification confirmed
        
        Args:
            deliverable_id: ID of the deliverable to close
            auto_certify: If True, generates a simulated certification response.
                         If False, loads actual app owner response from data file.
        """
        if deliverable_id not in self.workflow_states:
            return {"success": False, "error": f"No active workflow for {deliverable_id}"}

        state = self.workflow_states[deliverable_id]

        # Stage 5 – Evidence & Closure
        await self._broadcast_stage(deliverable_id, 5, "in-progress", "Evidence & Closure Agent: Capturing certification evidence and closing deliverable...")
        if self._current_tickets and deliverable_id in self._current_tickets:
            # Logic to fetch certification response from external system or use stored response in state
            self._current_tickets[deliverable_id]["waitingForCertification"] = True

        # Broadcast certification message before closure
        if auto_certify:
            if self._broadcast:
                await self._broadcast({
                    "type": "bre_auto_certification",
                    "deliverable_id": state.deliverable.deliverable_id,
                    "message": "Auto-completing certification for testing purposes"
                })
            self._current_tickets[deliverable_id]["waitingForCertification"] = False
        else:
            # Check if certification response will be loaded
            response_data = self._load_app_owner_response(deliverable_id)
            if response_data and self._broadcast:
                await asyncio.sleep(3)  # Simulate delay in receiving response
                await self._broadcast({
                    "type": "bre_certification_received",
                    "deliverable_id": state.deliverable.deliverable_id,
                    "message": f"Certification response received from {response_data['certified_by']}",
                    "certification_response": response_data
                })
                self._current_tickets[deliverable_id]["waitingForCertification"] = False
            else:
                await self._broadcast_stage(deliverable_id, 5, "pending", "Waiting for certification response from app owner...")

        await asyncio.sleep(2)  # Simulate processing time for closure
        closure_result = await asyncio.to_thread(self._step_5_closure, state, auto_certify)
        if not closure_result["success"]:
            if closure_result.get("error") == "Certification response not received from app owner":
                await self._broadcast_stage(deliverable_id, 5, "pending", "Waiting for certification response from app owner...")
            await self._broadcast_stage(deliverable_id, 5, "error", f"Closure failed: {closure_result.get('error', 'Unknown error')}")
            return closure_result

        if self._current_tickets and deliverable_id in self._current_tickets:
            is_bre_new = self._current_tickets[deliverable_id].get("deliverableType") == "BRE-NEW"
            if is_bre_new:
                # Transition to Stage 6: BRE Remediation Agent
                self._current_tickets[deliverable_id]["status"] = "in-progress"
                self._current_tickets[deliverable_id]["currentStage"] = 6
                # Force Stage 6 to in-progress
                if 6 < len(self._current_tickets[deliverable_id]["stages"]):
                    self._current_tickets[deliverable_id]["stages"][6]["status"] = "in-progress"
                    self._current_tickets[deliverable_id]["stages"][6]["message"] = "BRE Remediation Agent: Identifying and fixing policy violations..."
                
                await self._broadcast_stage(deliverable_id, 5, "completed", "✅ Evidence captured, moving to Remediation Protocol")
                state.current_step = "remediation"
            else:
                self._current_tickets[deliverable_id]["status"] = "completed"
                self._current_tickets[deliverable_id]["currentStage"] = 5
                state.current_step = "completed"
                await self._broadcast_stage(deliverable_id, 5, "completed", "✅ Evidence captured, deliverable closed successfully")
        
        self._save_states()

        if self._broadcast:
            await self._broadcast({
                "type": "bre_completed",
                "deliverable_id": deliverable_id,
                "message": f"BRE deliverable {deliverable_id} fully processed and closed",
                "ticket": self._current_tickets.get(deliverable_id) if self._current_tickets else {},
            })

        return {
            "message": "BRE workflow completed",
            "workflow_state": state.model_dump(mode="json"),
        }

    async def finalize_remediation_async(self, deliverable_id: str) -> Dict[str, Any]:
        """
        Stage 7: Archive & Close Agent
        Performs final logging and closure after remediation
        """
        if deliverable_id not in self.workflow_states:
            return {"success": False, "error": f"No active workflow for {deliverable_id}"}

        state = self.workflow_states[deliverable_id]
        
        await self._broadcast_stage(deliverable_id, 7, "in-progress", "Archive & Close Agent: Finalizing remediation audit trail and closing ticket...")
        await asyncio.sleep(2)

        # Reuse LoggerAgent patterns for final closure
        from backend.models.ticket_context import TicketResponse, Ticket
        ticket = self._current_tickets.get(deliverable_id) if self._current_tickets else None
        
        if ticket:
            ticket["status"] = "Closed"
            ticket["currentStage"] = 7
            
            # Map BRE ticket to LoggerAgent expected format
            tr = TicketResponse(tickets=[Ticket(**ticket)])
            # Simulate logger behavior
            if hasattr(self, 'logger_agent'):
                self.logger_agent.invoke(tr)
            
            # Ensure final stage is marked completed
            if 7 < len(ticket["stages"]):
                ticket["stages"][7]["status"] = "completed"
                ticket["stages"][7]["message"] = "✅ Remediation audit trail archived. Ticket closed successfully."
            
            await self._broadcast_stage(deliverable_id, 7, "completed", ticket["stages"][7].get("message", "Remediation finalized"))
            
            self._save_states()
            
            if self._broadcast:
                await self._broadcast({
                    "type": "bre_completed",
                    "deliverable_id": deliverable_id,
                    "message": f"BRE-NEW remediation finalized and closed",
                    "ticket": ticket,
                })

        state.current_step = "completed"
        self._save_states()
        
        return {
            "success": True,
            "deliverable_id": deliverable_id,
            "current_step": "completed",
            "message": "BRE-NEW remediation finalized"
        }
