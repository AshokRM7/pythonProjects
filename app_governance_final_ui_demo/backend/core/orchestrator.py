from backend.agents.human_approval import HumanApprovalAgent
from backend.agents.ticket_fetcher import TicketFetcherAgent
from backend.agents.category_checker import CategoryCheckerAgent
from backend.agents.sla_prioritizer import SLAPrioritizerAgent
from backend.agents.apphq_portal import AppHQResolverAgent
from backend.agents.app_owner_check import AppOwnerCheckerAgent
from backend.agents.evidence_collector import EvidenceCollectorAgent
from backend.agents.closer import CloserAgent
from backend.agents.iam_remediation import IAMRemediationAgent
from backend.agents.logger import LoggerAgent

from backend.core.config import load_config
from backend.models.ticket_context import TicketResponse
from langchain_openai import ChatOpenAI

class IAMOrchestrator:
    def __init__(self, api_key, config_file=None):
        
        # ✅ Load config.json
        self.config = load_config(config_file)

        # ✅ Step 1: Initialize your LLM once
        # llm = ChatOpenAI(
        #     model= "gpt-3.5-turbo",
        #     temperature= 0,
        #     api_key= api_key,
        #     base_url="https://openrouter.ai/api/v1"
        # )

        llm = ChatOpenAI(
            model=self.config["llm"]["model"],
            temperature=self.config["llm"]["temperature"],
            api_key=api_key,
            base_url=self.config["llm"]["base_url"],
            max_tokens=500
        )

        # ✅ Pass LLM into agents
        self.fetcher = TicketFetcherAgent(llm=llm)
        self.categorizer = CategoryCheckerAgent(llm=llm)
        self.sla = SLAPrioritizerAgent(llm=llm)
        self.ownership = AppHQResolverAgent(llm=llm)
        self.app_space_checker = AppOwnerCheckerAgent(llm=llm)
        self.remediation = IAMRemediationAgent(llm=llm)
        self.evidence = EvidenceCollectorAgent(llm=llm)

        self.closer = CloserAgent(llm=llm)
        self.logger = LoggerAgent(llm=llm)
        #self.human_approval = HumanApprovalAgent(llm=llm)

    # def checkpoint(self, stage: str, tickets: TicketResponse):
    #     """Check config if HITL required for this stage."""
    #     if stage in self.config.get("human_review", []):
    #         return self.human_approval.invoke(tickets, stage)
    #     return None

    def run(self):
        # Step 1: Fetch tickets
        tickets = self.fetcher.invoke()

        # ✅ If no IAM tickets, skip rest of pipeline and log
        if not tickets.tickets:
            logs = self.logger.invoke(TicketResponse(tickets=[]),"No tickets found")
            return {"tickets": [], "emails": [], "logs": logs}

        # Step 2: Categortize tickets
        categorized = self.categorizer.invoke(tickets)

        # ✅ If no IAM tickets, skip rest of pipeline and log
        if not categorized.tickets:
            logs = self.logger.invoke(TicketResponse(tickets=[]),"No IAM category tickets found")
            return {"tickets": [], "emails": [], "logs": logs}
        
        # Step 3: Prioritize SLA
        prioritized = self.sla.invoke(categorized)

        #✅ Checkpoint for HITL after SLA prioritization
        # hitl = self.checkpoint("SLA", prioritized)
        # if hitl: return hitl

        # Step 4: Enrich with App HQ details
        enriched = self.ownership.invoke(prioritized)

        if not enriched.tickets:
            logs = self.logger.invoke(TicketResponse(tickets=[]),"No AIT owners details found")
            return {"tickets": [], "emails": [], "logs": logs}
        
         #✅ Checkpoint for HITL after Ownership enrichment
        # hitl = self.checkpoint("Ownership", enriched)
        # if hitl: return hitl

        # Step 5: Filter by App Owner space
        filtered = self.app_space_checker.invoke(enriched)

        if not filtered.tickets:
            logs = self.logger.invoke(TicketResponse(tickets=[]),"No App owners in our space")
            return {"tickets": [], "emails": [], "logs": logs}
        
        #✅ Checkpoint for HITL after App Owner space check
        # hitl = self.checkpoint("EvidenceCollector", filtered)
        # if hitl: return hitl

        #✅ Mock mode (just prepare emails)
        #✅ Real mode (send via SMTP) send=True
        
        # Step 6: IAM Remediation (New)
        remediated = self.remediation.invoke(filtered)
        
        # Step 7: Collect evidence emails
        emails = self.evidence.invoke(remediated, send=False)

        # Step 8: Close tickets
        closed = self.closer.invoke(remediated)

        # Step 9: Always log at the end
        logs = self.logger.invoke(closed)

        return {"tickets": closed, "emails": emails, "logs": logs}


