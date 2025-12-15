from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/jira", tags=["JIRA"])

# In-memory store for JIRA items to simulate state changes during runtime
# In a real persistence scenario, we would save this to a file or DB.
# For this demo, we can initialize it with some defaults if needed, 
# or just dynamically create as we go.
jira_store = {
    "JIRA-IAM-1234": {"id": "JIRA-IAM-1234", "status": "Open", "comments": []},
    "JIRA-IAM-1235": {"id": "JIRA-IAM-1235", "status": "Open", "comments": []},
    "JIRA-IAM-1236": {"id": "JIRA-IAM-1236", "status": "In Progress", "comments": []}
}

class JiraComment(BaseModel):
    comment: str

class JiraStatus(BaseModel):
    status: str

@router.get("/items/{jira_id}")
async def get_jira_item(jira_id: str):
    if jira_id not in jira_store:
        # Create if not exists for demo fluidity
        jira_store[jira_id] = {"id": jira_id, "status": "Open", "comments": []}
    return jira_store[jira_id]

@router.post("/items/{jira_id}/comment")
async def add_comment(jira_id: str, payload: JiraComment):
    if jira_id not in jira_store:
         jira_store[jira_id] = {"id": jira_id, "status": "Open", "comments": []}
    
    jira_store[jira_id]["comments"].append(payload.comment)
    return {"status": "success", "message": "Comment added"}

@router.post("/items/{jira_id}/status")
async def update_status(jira_id: str, payload: JiraStatus):
    if jira_id not in jira_store:
         jira_store[jira_id] = {"id": jira_id, "status": "Open", "comments": []}
    
    jira_store[jira_id]["status"] = payload.status
    return {"status": "success", "message": f"Status updated to {payload.status}"}
