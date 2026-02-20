"""
BRE Portal Check Agent - Step 2
Logs into BRE Portal, searches using AIT number, checks pending rules and history
"""
import json
from typing import Dict, Any, Optional
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from pathlib import Path


SYSTEM_PROMPT = """You are a BRE Portal Check Agent for the BRE Rule Certification Process.

Your task is to:
1. Login to BRE Portal
2. Search for rules using the AIT number
3. Identify pending rules that need certification
4. Review the certification history

Always use the available tools to complete the workflow end-to-end.
Return a concise final response with:
- login_status
- pending rules summary (rule_id, rule_name, risk_level, changes_count)
- certification history summary
"""


class BREPortalAgent:
    """Agent to check BRE Portal for rules and certification history"""

    def __init__(self, llm: Optional[ChatOpenAI] = None):
        self.llm = llm
        self.data_path = Path(__file__).resolve().parents[3] / "data"
        self.tools = self._create_tools()

        self.agent = None
        if self.llm is not None:
            self.agent = create_agent(
                model=self.llm,
                tools=self.tools,
                system_prompt=SYSTEM_PROMPT,
            )

    def _create_tools(self):
        """Create tools for BRE portal interaction"""

        data_path = self.data_path  # capture for closures

        @tool("LoginToBREPortal")
        def login_to_portal(dummy: str = "") -> str:
            """Login to BRE Portal. No input required."""
            return "Successfully logged in to BRE Portal"

        @tool("SearchAITRules")
        def search_ait_rules(ait_number: str) -> str:
            """Search for rules using AIT number in BRE Portal. Input should be the AIT number string."""
            try:
                portal_file = data_path / "bre_portal_data.json"
                with open(portal_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                ait_rules = data.get("ait_rules", {}).get(ait_number)
                if ait_rules:
                    return json.dumps(ait_rules, indent=2, default=str)

                return f"No rules found for AIT number: {ait_number}"
            except Exception as e:
                return f"Error searching BRE Portal: {str(e)}"

        @tool("GetPendingRules")
        def get_pending_rules(ait_data: str) -> str:
            """Extract and summarize pending rules from AIT data. Input should be the complete AIT data JSON string."""
            try:
                ait_info = json.loads(ait_data)
                pending_rules = ait_info.get("pending_rules", [])

                if not pending_rules:
                    return "No pending rules found"

                summary = {
                    "total_pending": len(pending_rules),
                    "rules": [
                        {
                            "rule_id": rule["rule_id"],
                            "rule_name": rule["rule_name"],
                            "risk_level": rule["risk_level"],
                            "changes_count": len(rule["changes_from_last_et"]),
                        }
                        for rule in pending_rules
                    ],
                }

                return json.dumps(summary, indent=2)
            except Exception as e:
                return f"Error extracting pending rules: {str(e)}"

        @tool("GetCertificationHistory")
        def get_certification_history(ait_data: str) -> str:
            """Extract certification history from AIT data. Input should be the complete AIT data JSON string."""
            try:
                ait_info = json.loads(ait_data)
                history = ait_info.get("certification_history", [])

                if not history:
                    return "No certification history found"

                return json.dumps(
                    {"total_certifications": len(history), "history": history},
                    indent=2,
                    default=str,
                )
            except Exception as e:
                return f"Error extracting certification history: {str(e)}"

        return [login_to_portal, search_ait_rules, get_pending_rules, get_certification_history]

    def process(self, ait_number: str) -> Dict[str, Any]:
        """Process the BRE portal check"""

        # ---- Fallback without LLM (deterministic workflow) ----
        if self.agent is None:
            result: Dict[str, Any] = {
                "success": False,
                "ait_number": ait_number,
            }

            # Login
            login_result = self.tools[0].invoke("")
            result["login_status"] = login_result

            # Search AIT
            ait_data = self.tools[1].invoke(ait_number)
            if "Error" in ait_data or "No rules found" in ait_data:
                result["error"] = ait_data
                return result

            result["ait_data"] = json.loads(ait_data)

            # Get pending rules
            pending = self.tools[2].invoke(ait_data)
            result["pending_rules"] = json.loads(pending)

            # Get certification history
            history = self.tools[3].invoke(ait_data)
            result["certification_history"] = json.loads(history)

            result["success"] = True
            return result

        # ---- LLM Agent path (tool-using agent) ----
        user_msg = (
            "Check BRE Portal for the following AIT number using all available tools.\n\n"
            "Workflow:\n"
            "1) Call LoginToBREPortal\n"
            "2) Call SearchAITRules(ait_number)\n"
            "3) Call GetPendingRules(ait_data)\n"
            "4) Call GetCertificationHistory(ait_data)\n\n"
            f"AIT Number: {ait_number}"
        )

        state = self.agent.invoke(
            {
                "messages": [
                    {"role": "user", "content": user_msg},
                ]
            }
        )

        final_text = ""
        try:
            messages = state.get("messages", [])
            if messages:
                last = messages[-1]
                final_text = getattr(last, "content", "") or (
                    last.get("content") if isinstance(last, dict) else ""
                )
        except Exception:
            final_text = str(state)

        return {"success": True, "result": final_text, "state": state}
