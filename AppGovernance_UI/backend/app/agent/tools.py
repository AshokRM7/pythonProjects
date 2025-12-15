from app.mock_systems.rise import get_ticket, update_ticket_status, add_evidence, TicketEvidence, TicketStatusUpdate
from app.mock_systems.apphq import get_owners
from app.mock_systems.jira import add_comment, update_status, JiraComment, JiraStatus
from app.mock_systems.mail import send_email, EmailRequest
from app.rag.retriever import retrieve
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import yaml
import json

def load_config():
    with open("app/config.yaml", "r") as f:
        return yaml.safe_load(f)

config = load_config()
llm = ChatOpenAI(model=config['llm']['model_name'], temperature=config['llm']['temperature'])

async def fetch_ticket(ticket_id: str):
    return await get_ticket(ticket_id)

async def validate_iam_category(ticket):
    # Simple rule-based validation enhanced with LLM if needed
    # For now, just checking the category field and description
    prompt = ChatPromptTemplate.from_template("""
    Verify if the following ticket is related to Identity and Access Management (IAM).
    
    Title: {title}
    Category: {category}
    Description: {description}
    
    Return JSON: {{"is_iam": true/false, "reason": "why"}}
    """)
    chain = prompt | llm
    response = await chain.ainvoke({
        "title": ticket['title'], 
        "category": ticket['category'], 
        "description": ticket['description']
    })
    
    # Parse LLM response (Assuming it returns string representation of JSON)
    try:
        content = response.content.replace('```json', '').replace('```', '')
        return json.loads(content)
    except:
        # Fallback
        return {"is_iam": True, "reason": "Assumed IAM based on context"}

async def fetch_owners_tool(app_id: str):
    return await get_owners(app_id)

async def retrieve_policy_context(description: str):
    chunks = retrieve(description)
    return "\n\n".join(chunks)

async def draft_email(ticket, owners, policy_context):
    prompt = ChatPromptTemplate.from_template("""
    Draft an email to the application owner regarding an IAM Deliverable.
    
    Ticket: {ticket_title} ({ticket_id})
    Application ID: {app_id}
    Owner: {app_owner}
    Policy Context: {policy_context}
    
    The email should be professional, indicate the SLA deadline ({sla}), and request evidence.
    
    Return just the email body text.
    """)
    chain = prompt | llm
    response = await chain.ainvoke({
        "ticket_title": ticket['title'],
        "ticket_id": ticket['id'],
        "app_id": ticket['appId'],
        "app_owner": owners['appOwner'],
        "policy_context": policy_context,
        "sla": ticket['slaDeadline']
    })
    return response.content

async def send_email_tool(to, cc, subject, body):
    req = EmailRequest(to=to, cc=cc, subject=subject, body=body)
    return await send_email(req)

async def update_jira_tool(jira_id, comment, status):
    await add_comment(jira_id, JiraComment(comment=comment))
    await update_status(jira_id, JiraStatus(status=status))

async def close_rise_ticket(ticket_id, evidence_text):
    await add_evidence(ticket_id, TicketEvidence(evidence=evidence_text))
    await update_ticket_status(ticket_id, TicketStatusUpdate(status="Closed"))
