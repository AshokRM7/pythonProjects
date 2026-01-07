import os
from typing import List
from langchain_openai import ChatOpenAI
from .models import Finding

class RecommendationEngine:
    def __init__(self, api_key: str = None):
        self.llm = None
        if api_key:
            self.llm = ChatOpenAI(
                model="gpt-3.5-turbo",
                temperature=0,
                api_key=api_key,
                max_tokens=100
            )

    async def enrich_findings(self, findings: List[Finding]):
        for finding in findings:
            # Deterministic recommendation
            recommendation = self._get_deterministic_rec(finding)
            finding.recommendation = recommendation

            # OpenAI enhancement if available
            if self.llm:
                try:
                    prompt = f"Rule: {finding.rule_id}\nIssue: {finding.message}\nField: {finding.column}\nValue: {finding.value}\nProvide a 1-line business-friendly fix recommendation."
                    response = await self.llm.ainvoke(prompt)
                    finding.recommendation = response.content.strip()
                except Exception as e:
                    print(f"OpenAI Recommendation Error: {e}")

    def _get_deterministic_rec(self, finding: Finding) -> str:
        recs = {
            "R1": "Update 'managed_by' to 'Active Directory' for WAN assets.",
            "R2": "Change 'account_type' to 'Human' or 'Service Account' for administrative capabilities.",
            "R3": "Update 'capability' to 'Read Only' to match permission name.",
            "R4": "Consider re-classifying data or changing function to 'IT/Security'.",
            "R5": "Provide a valid AIT owner/system in 'provided_by'.",
            "R6": "Update 'capability' to 'Modify' or 'Admin' for write/delete perms.",
            "R7": "Specify a valid platform type (CLOUD/ON-PREM/SAAS).",
            "R8": "Fill in 'permission_description' or 'additional_info'.",
            "L1": "Choose a value from the approved dropdown list.",
            "C1": "Resolve conflict between 'Read Only' capability and active permission name.",
            "C2": "Security risk: Admin access on Proprietary data via Shared account is prohibited."
        }
        return recs.get(finding.rule_id, "Please review and correct the metadata based on policy.")
