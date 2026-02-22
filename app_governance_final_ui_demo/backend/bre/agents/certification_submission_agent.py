from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI


SYSTEM_PROMPT = """You are a Certification Submission Agent for the BRE Rule Certification Process.

Your task is to:
1) Get application owner contact information
2) Prepare a comprehensive certification package
3) Send the submission to the application owner
4) Log the submission for audit purposes

Always use the available tools to complete the workflow end-to-end.
Return a concise final response with:
- submission_id
- sent_to
- sent_at
- tracking flags
"""


class CertificationSubmissionAgent:
    """Agent to submit rules to app owner for certification (LangChain v1+)."""

    def __init__(self, llm: Optional[ChatOpenAI] = None, data_path: Optional[Path] = None):
        self.llm = llm
        # Allow injection for testing; default to your original relative layout
        self.data_path = data_path or (Path(__file__).resolve().parents[3] / "data")

        self.tools = self._create_tools()

        # In LangChain v1, create_agent returns a runnable agent (no AgentExecutor needed)
        self.agent = None
        if self.llm is not None:
            self.agent = create_agent(
                model=self.llm,
                tools=self.tools,
                system_prompt=SYSTEM_PROMPT,
            )

    def _create_tools(self):
        """Create tools for certification submission (LangChain v1 @tool)."""

        data_path = self.data_path  # capture for closures

        @tool("GetAppOwnerInfo")
        def get_app_owner_info(ait_number: str) -> str:
            """Get application owner contact information for the given AIT number from apphq_data.json. Returns JSON string."""
            try:
                # Primary source: apphq_data.json indexed by ait_number
                apphq_file = data_path / "apphq_data.json"
                with open(apphq_file, "r", encoding="utf-8") as f:
                    apphq_data = json.load(f)

                for entry in apphq_data:
                    if entry.get("ait_number") == ait_number:
                        # Determine email: prioritize contacts list first
                        contacts = entry.get("contacts", [])
                        email = ""
                        if contacts:
                            email = contacts[0]
                        if not email:
                            email = entry.get("application_owner", "")
                            
                        app_owner = {
                            "name": entry.get("application_owner", "").split("@")[0].replace(".", " ").title() if "@" in entry.get("application_owner", "") else entry.get("application_owner", ""),
                            "email": email,
                            "department": entry.get("lob_owner", entry.get("department", "N/A")),
                            "phone": entry.get("phone", "N/A"),
                            "ait_owner": entry.get("ait_owner", ""),
                            "application_name": entry.get("application_name", ""),
                            "contacts": contacts,
                        }
                        return json.dumps(app_owner, indent=2)

                # Fallback: bre_portal_data.json app_owners by application_id
                portal_file = data_path / "bre_portal_data.json"
                with open(portal_file, "r", encoding="utf-8") as f:
                    portal_data = json.load(f)

                app_owners = portal_data.get("app_owners", {})
                for app_id, owner in app_owners.items():
                    if owner:
                        return json.dumps(owner, indent=2)

                return f"Application owner not found for AIT: {ait_number}"
            except Exception as e:
                return f"Error retrieving app owner: {str(e)}"

        @tool("PrepareCertificationPackage")
        def prepare_certification_package(submission_data: str) -> str:
            """Prepare certification package for app owner. Input must be JSON string with required fields."""
            try:
                data = json.loads(submission_data)

                package = {
                    "to": data.get("app_owner_email"),
                    "subject": f"BRE Rule Certification Required - {data.get('ait_number')}",
                    "body": {
                        "greeting": f"Dear {data.get('app_owner_name', 'Application Owner')},",
                        "introduction": (
                            "App Governance has completed a soft review of pending BRE rules for your application."
                        ),
                        "ait_number": data.get("ait_number"),
                        "total_rules": len(data.get("pending_rules", [])),
                        "review_summary": data.get("soft_review_summary"),
                        "action_required": "Please review and certify the following rules:",
                        "rules_list": data.get("pending_rules", []),
                        "deadline": "Please complete certification within 5 business days",
                        "contact": "For questions, contact App Governance team",
                    },
                    "attachments": [
                        "soft_review_report.pdf",
                        "pending_rules_detail.xlsx",
                    ],
                    "prepared_at": datetime.now(timezone.utc).isoformat(),
                }

                return json.dumps(package, indent=2)
            except Exception as e:
                return f"Error preparing package: {str(e)}"

        @tool("SendSubmission")
        def send_submission(package_json: str) -> str:
            """Send certification submission to app owner. Input should be the prepared package JSON string."""
            try:
                package = json.loads(package_json)

                # Simulate sending email/notification
                now = datetime.now(timezone.utc)
                result = {
                    "status": "sent",
                    "sent_to": package.get("to"),
                    "sent_at": now.isoformat(),
                    "submission_id": f"SUB-{now.strftime('%Y%m%d%H%M%S')}",
                    "tracking": {
                        "email_sent": True,
                        "portal_notification": True,
                        "sms_alert": True,
                    },
                }

                return json.dumps(result, indent=2)
            except Exception as e:
                return f"Error sending submission: {str(e)}"

        @tool("LogSubmission")
        def log_submission(submission_result: str) -> str:
            """Log the submission for audit trail. Input should be the submission result JSON string."""
            try:
                result = json.loads(submission_result)

                log_entry = {
                    "action": "certification_submission",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "submission_id": result.get("submission_id"),
                    "recipient": result.get("sent_to"),
                    "status": result.get("status"),
                    "logged_by": "CertificationSubmissionAgent",
                }

                return json.dumps(
                    {"log_status": "success", "log_entry": log_entry},
                    indent=2,
                )
            except Exception as e:
                return f"Error logging submission: {str(e)}"

        return [
            get_app_owner_info,
            prepare_certification_package,
            send_submission,
            log_submission,
        ]

    def process(
        self,
        application_id: str,
        ait_number: str,
        pending_rules: List[Dict[str, Any]],
        soft_review: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Process certification submission."""

        # ---- Fallback without LLM (deterministic workflow) ----
        if self.agent is None:
            result: Dict[str, Any] = {
                "success": False,
                "application_id": application_id,
                "ait_number": ait_number,
            }

            # Look up owner by ait_number (primary key in apphq_data.json)
            owner_info = self.tools[0].invoke(ait_number)
            if isinstance(owner_info, str) and ("Error" in owner_info or "not found" in owner_info):
                result["error"] = owner_info
                return result

            owner = json.loads(owner_info)
            result["app_owner"] = owner

            submission_data = json.dumps(
                {
                    "app_owner_email": owner.get("email"),
                    "app_owner_name": owner.get("name"),
                    "ait_number": ait_number,
                    "pending_rules": pending_rules,
                    "soft_review_summary": soft_review,
                }
            )

            package = self.tools[1].invoke(submission_data)
            result["package"] = json.loads(package)

            send_result = self.tools[2].invoke(package)
            result["submission"] = json.loads(send_result)

            log_result = self.tools[3].invoke(send_result)
            result["log"] = json.loads(log_result)

            result["success"] = True
            return result

        # ---- LLM Agent path (tool-using agent) ----
        # Provide the agent ALL required inputs so it can call tools correctly.
        payload = {
            "application_id": application_id,
            "ait_number": ait_number,
            "pending_rules": pending_rules,
            "soft_review_summary": soft_review,
        }

        user_msg = (
            "Submit a certification request end-to-end using tools.\n\n"
            "Workflow:\n"
            "1) Call GetAppOwnerInfo(application_id)\n"
            "2) Call PrepareCertificationPackage(JSON with app owner + payload)\n"
            "3) Call SendSubmission(prepared package)\n"
            "4) Call LogSubmission(submission result)\n\n"
            f"Payload:\n{json.dumps(payload, indent=2)}"
        )

        state = self.agent.invoke(
            {
                "messages": [
                    {"role": "user", "content": user_msg},
                ]
            }
        )

        # create_agent typically returns a state containing "messages"
        final_text = ""
        try:
            messages = state.get("messages", [])
            if messages:
                last = messages[-1]
                final_text = getattr(last, "content", "") or (last.get("content") if isinstance(last, dict) else "")
        except Exception:
            final_text = str(state)

        return {"success": True, "result": final_text, "state": state}