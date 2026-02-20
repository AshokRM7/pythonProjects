"""
Soft Review Agent - Step 3
Performs soft review of pending rules, focusing on changes from last ET
No final certification is done by App Governance
"""
import json
from typing import Dict, Any, List, Optional
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI


SYSTEM_PROMPT = """You are a Soft Review Agent for the BRE Rule Certification Process.

Your task is to:
1. Analyze changes in each pending rule from the last ET
2. Assess the overall risk level
3. Generate a comprehensive review summary
4. Create recommendations for the certification process

IMPORTANT: You perform SOFT REVIEW only. No final certification decisions are made.

Always use the available tools to complete the workflow end-to-end.
Return a concise final response with:
- rule analyses (one per rule)
- overall risk assessment
- review summary
- recommendations
"""


class SoftReviewAgent:
    """Agent to perform soft review of pending rules"""

    def __init__(self, llm: Optional[ChatOpenAI] = None):
        self.llm = llm
        self.tools = self._create_tools()

        self.agent = None
        if self.llm is not None:
            self.agent = create_agent(
                model=self.llm,
                tools=self.tools,
                system_prompt=SYSTEM_PROMPT,
            )
    
    def _create_tools(self):
        """Create tools for soft review analysis"""
        
        @tool("AnalyzeRuleChanges")
        def analyze_rule_changes(rule_json: str) -> str:
            """Analyze changes in a rule from last ET. Input should be a single rule JSON string."""
            try:
                rule = json.loads(rule_json)
                changes = rule.get("changes_from_last_et", [])
                risk_level = rule.get("risk_level", "unknown")
                
                analysis = {
                    "rule_id": rule.get("rule_id"),
                    "rule_name": rule.get("rule_name"),
                    "risk_level": risk_level,
                    "changes_count": len(changes),
                    "changes": changes,
                    "requires_attention": risk_level in ["high", "critical"],
                    "analysis": []
                }
                
                # Analyze each change
                for change in changes:
                    change_lower = change.lower()
                    if any(keyword in change_lower for keyword in ["added", "elevated", "admin", "sensitive"]):
                        analysis["analysis"].append(f"⚠️ ATTENTION: {change}")
                    elif any(keyword in change_lower for keyword in ["removed", "revoked", "reduced"]):
                        analysis["analysis"].append(f"✓ IMPROVEMENT: {change}")
                    else:
                        analysis["analysis"].append(f"ℹ️ UPDATE: {change}")
                
                return json.dumps(analysis, indent=2)
            except Exception as e:
                return f"Error analyzing rule changes: {str(e)}"
        
        @tool("AssessRiskLevel")
        def assess_risk_level(rules_list: str) -> str:
            """Assess overall risk level of all pending rules. Input should be a JSON array of rules."""
            try:
                rules = json.loads(rules_list)
                
                risk_counts = {
                    "critical": 0,
                    "high": 0,
                    "medium": 0,
                    "low": 0
                }
                
                for rule in rules:
                    risk = rule.get("risk_level", "low")
                    risk_counts[risk] = risk_counts.get(risk, 0) + 1
                
                overall_risk = "low"
                if risk_counts["critical"] > 0:
                    overall_risk = "critical"
                elif risk_counts["high"] > 0:
                    overall_risk = "high"
                elif risk_counts["medium"] > 0:
                    overall_risk = "medium"
                
                return json.dumps({
                    "overall_risk": overall_risk,
                    "risk_breakdown": risk_counts,
                    "total_rules": len(rules),
                    "recommendation": "Immediate review required" if overall_risk in ["critical", "high"] else "Standard review process"
                }, indent=2)
            except Exception as e:
                return f"Error assessing risk: {str(e)}"
        
        @tool("GenerateReviewSummary")
        def generate_review_summary(analysis_data: str) -> str:
            """Generate comprehensive review summary. Input should be the risk assessment JSON."""
            try:
                data = json.loads(analysis_data)
                
                summary = {
                    "review_date": "2026-02-19",
                    "reviewer": "App Governance Team",
                    "total_rules_reviewed": data.get("total_rules", 0),
                    "high_risk_count": data.get("risk_breakdown", {}).get("high", 0) + data.get("risk_breakdown", {}).get("critical", 0),
                    "overall_assessment": data.get("overall_risk", "unknown"),
                    "key_findings": [],
                    "recommendations": [],
                    "ready_for_app_owner": True
                }
                
                # Generate key findings
                if data.get("overall_risk") in ["critical", "high"]:
                    summary["key_findings"].append("High-risk changes detected requiring immediate attention")
                    summary["recommendations"].append("Schedule urgent review session with Application Owner")
                else:
                    summary["key_findings"].append("Changes are within acceptable risk parameters")
                    summary["recommendations"].append("Proceed with standard certification process")
                
                return json.dumps(summary, indent=2)
            except Exception as e:
                return f"Error generating summary: {str(e)}"
        
        @tool("CreateRecommendations")
        def create_recommendations(review_summary: str) -> str:
            """Create actionable recommendations based on review. Input should be the review summary JSON."""
            try:
                summary = json.loads(review_summary)
                
                recommendations = {
                    "immediate_actions": [],
                    "certification_guidance": [],
                    "follow_up_items": []
                }
                
                risk = summary.get("overall_assessment", "low")
                
                if risk in ["critical", "high"]:
                    recommendations["immediate_actions"].append("Flag for expedited review")
                    recommendations["immediate_actions"].append("Notify security team")
                    recommendations["certification_guidance"].append("Request detailed justification from app owner")
                    recommendations["follow_up_items"].append("Schedule post-certification audit")
                else:
                    recommendations["immediate_actions"].append("Proceed with standard workflow")
                    recommendations["certification_guidance"].append("Standard certification requirements apply")
                    recommendations["follow_up_items"].append("Regular quarterly review")
                
                return json.dumps(recommendations, indent=2)
            except Exception as e:
                return f"Error creating recommendations: {str(e)}"
        
        return [analyze_rule_changes, assess_risk_level, generate_review_summary, create_recommendations]
    
    def process(self, pending_rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process soft review of pending rules"""

        # ---- Fallback without LLM (deterministic workflow) ----
        if self.agent is None:
            result: Dict[str, Any] = {
                "success": True,
                "rule_analyses": [],
                "risk_assessment": None,
                "review_summary": None,
                "recommendations": None,
            }

            # Analyze each rule
            for rule in pending_rules:
                analysis = self.tools[0].invoke(json.dumps(rule))
                result["rule_analyses"].append(json.loads(analysis))

            # Assess overall risk
            risk_assessment = self.tools[1].invoke(json.dumps(pending_rules))
            result["risk_assessment"] = json.loads(risk_assessment)

            # Generate summary
            review_summary = self.tools[2].invoke(risk_assessment)
            result["review_summary"] = json.loads(review_summary)

            # Create recommendations
            recs = self.tools[3].invoke(review_summary)
            result["recommendations"] = json.loads(recs)

            return result

        # ---- LLM Agent path (tool-using agent) ----
        user_msg = (
            "Perform a soft review of pending BRE rules using all available tools.\n\n"
            "Workflow:\n"
            "1) Call AnalyzeRuleChanges for each rule\n"
            "2) Call AssessRiskLevel(all_rules_json)\n"
            "3) Call GenerateReviewSummary(risk_assessment)\n"
            "4) Call CreateRecommendations(review_summary)\n\n"
            f"Pending Rules ({len(pending_rules)} total):\n{json.dumps(pending_rules)}"
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
