# BRE Rule Certification Process

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Components](#components)
- [Workflow Stages](#workflow-stages)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [Configuration](#configuration)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

The **BRE (Business Rule Engine) Rule Certification Process** is an automated workflow system designed to manage the certification of business rules for enterprise applications. The system uses AI-powered agents built with LangChain to streamline the entire process from deliverable intake through evidence collection and closure.

### Key Features

- **🤖 Fully Automated Workflow**: End-to-end automation using LangChain AI agents
- **🔄 Real-time Updates**: WebSocket-based live progress tracking
- **📊 Risk Assessment**: Intelligent analysis of rule changes and risk levels
- **👥 Multi-stakeholder**: Coordinates between App Governance, BRE Portal, and App Owners
- **📝 Audit Trail**: Complete tracking of all decisions and actions
- **🔍 Change Analysis**: Detailed analysis of rule modifications from last ET (Enterprise Tool)

### Business Context

When applications modify their business rules in the BRE Portal, those changes must be reviewed and certified before deployment. This process ensures:
- Compliance with security policies
- Proper authorization for rule changes
- Documentation of rule modifications
- Risk assessment and mitigation

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BRE Orchestrator                          │
│                    (Workflow Coordinator)                        │
└───────┬─────────────────────────────────────────────────────────┘
        │
        ├──► Stage 1: Deliverable Intake Agent
        │    └─ Extracts Application ID, AIT number, priority
        │
        ├──► Stage 2: BRE Portal Check Agent
        │    └─ Retrieves pending rules and certification history
        │
        ├──► Stage 3: Soft Review Agent
        │    └─ Analyzes rule changes and assesses risk
        │
        ├──► Stage 4: Certification Submission Agent
        │    └─ Sends certification request to App Owner
        │
        └──► Stage 5: Evidence & Closure Agent
             └─ Captures certification evidence and closes deliverable
```

### Technology Stack

- **Framework**: FastAPI (REST API + WebSocket)
- **AI/ML**: LangChain + OpenAI GPT-4o-mini
- **Data Validation**: Pydantic V2
- **State Management**: JSON-based persistent storage
- **Integration**: RISE Portal, BRE Portal, AppHQ Portal

---

## Components

### 1. Orchestrator (`orchestrator.py`)

The central coordinator that manages the complete workflow lifecycle.

**Key Responsibilities:**
- Workflow state management
- Agent coordination and sequencing
- Error handling and recovery
- WebSocket broadcasting for real-time updates
- Persistent state storage

**Main Methods:**
```python
async def process_deliverable(deliverable_id: str, ticket_data: dict) -> dict
async def get_workflow_state(deliverable_id: str) -> BREWorkflowState
async def mark_as_closed(deliverable_id: str) -> dict
```

### 2. Agents

#### Deliverable Intake Agent (`agents/deliverable_intake_agent.py`)
**Purpose**: Initial processing of BRE deliverables from RISE portal

**Tools:**
- `GetDeliverable`: Retrieves deliverable from ticket_data.json
- `ExtractApplicationInfo`: Extracts Application ID and AIT number
- `LogIntake`: Creates audit log entry

**Output:**
```python
{
    "application_id": "APP-XYZ123",
    "ait_number": "AIT-42",
    "violation_type": "rule_violation",
    "priority": "high",
    "intake_log_status": "logged"
}
```

#### BRE Portal Check Agent (`agents/bre_portal_agent.py`)
**Purpose**: Retrieves pending rules and certification history from BRE Portal

**Tools:**
- `SearchPendingRules`: Queries BRE Portal for pending rule certifications
- `GetCertificationHistory`: Retrieves historical certification records
- `CheckRuleStatus`: Validates current rule status

**Output:**
```python
{
    "ait_number": "AIT-42",
    "pending_rules": [
        {
            "rule_id": "R-1001",
            "rule_name": "Admin Access Rule",
            "rule_type": "permission",
            "risk_level": "high",
            "changes_from_last_et": [
                "Added elevated permissions for admin group",
                "Modified approval workflow"
            ]
        }
    ],
    "certification_history": [...]
}
```

#### Soft Review Agent (`agents/soft_review_agent.py`)
**Purpose**: Performs intelligent analysis of rule changes without making final certification decisions

**Tools:**
- `AnalyzeRuleChanges`: Deep analysis of each rule's modifications
- `AssessOverallRisk`: Calculates aggregate risk level
- `GenerateReviewSummary`: Creates comprehensive review report
- `CreateRecommendations`: Suggests actions for certification

**Key Features:**
- Change classification (ATTENTION, IMPROVEMENT, UPDATE)
- Risk-based prioritization
- Pattern detection (elevated permissions, admin access, etc.)
- Best practice recommendations

**Output:**
```python
{
    "total_pending_rules": 3,
    "high_risk_rules": 1,
    "review_summary": "Detailed analysis...",
    "recommendations": [
        "Rule R-1001 requires immediate app owner review due to elevated permissions",
        "Consider additional approval layer for admin access rules"
    ],
    "rule_analyses": [...]
}
```

#### Certification Submission Agent (`agents/certification_submission_agent.py`)
**Purpose**: Sends certification requests to application owners and tracks responses

**Tools:**
- `GetAppOwnerInfo`: Retrieves app owner contact information
- `SendCertificationRequest`: Generates and simulates certification request
- `CheckCertificationResponse`: Polls for app owner response
- `LogSubmission`: Records submission details

**Certification Request Format:**
```
Subject: BRE Rule Certification Required - AIT-42

Dear [App Owner],

Your application has [X] pending rules requiring certification:
[Rule details with change descriptions]

Please review and certify these changes by [date].

Risk Assessment: [Summary]
Recommendations: [List]
```

#### Evidence & Closure Agent (`agents/evidence_closure_agent.py`)
**Purpose**: Final stage - captures evidence and closes deliverable

**Tools:**
- `CaptureEvidenceScreenshot`: Simulates evidence capture from BRE Portal
- `UpdateDeliverableStatus`: Updates RISE ticket status
- `GenerateClosureSummary`: Creates final closure report
- `ArchiveWorkflow`: Archives workflow state for audit

**Output:**
```python
{
    "closure_status": "closed",
    "evidence_captured": true,
    "evidence_type": "screenshot",
    "closure_summary": "All rules certified successfully",
    "archived": true
}
```

### 3. API Layer (`api.py`)

FastAPI router providing REST and WebSocket endpoints.

**Features:**
- RESTful process initiation
- WebSocket connections for real-time updates
- Ticket store integration
- Shared state management

### 4. Data Models (`models.py`)

Pydantic models ensuring type safety and validation.

**Key Models:**
- `BREDeliverable`: Core deliverable information
- `PendingRule`: Rule requiring certification
- `CertificationHistory`: Historical records
- `BREWorkflowState`: Complete workflow state
- `AppOwner`: Application owner details

---

## Workflow Stages

### Stage 0: BRE Ticket Intake
**Status**: Initialization
- Loads deliverable into system
- Validates ticket data
- Initializes workflow state

### Stage 1: Deliverable Intake Agent
**Duration**: ~5-10 seconds
- Retrieves deliverable from RISE portal
- Extracts Application ID and AIT number
- Logs intake for audit trail

**Success Criteria:**
- Application ID extracted successfully
- AIT number identified
- Intake logged

### Stage 2: BRE Portal Check Agent
**Duration**: ~8-12 seconds
- Searches BRE Portal for pending rules
- Retrieves certification history
- Maps rules to AIT number

**Success Criteria:**
- All pending rules retrieved
- Certification history loaded
- Rule changes identified

### Stage 3: Soft Review Agent
**Duration**: ~10-15 seconds
- Analyzes each rule's changes from last ET
- Assesses risk levels
- Generates review summary
- Creates recommendations

**Success Criteria:**
- All rules analyzed
- Risk assessment completed
- Recommendations generated

### Stage 4: Certification Submission Agent
**Duration**: ~5-8 seconds
- Retrieves app owner information
- Generates certification request
- Sends request to app owner
- Logs submission

**Success Criteria:**
- App owner identified
- Request sent successfully
- Submission logged

### Stage 5: Evidence & Closure Agent
**Duration**: ~5-8 seconds
- Captures evidence from BRE Portal
- Updates deliverable status in RISE
- Generates closure summary
- Archives workflow state

**Success Criteria:**
- Evidence captured
- Deliverable closed in RISE
- Workflow archived

---

## Installation & Setup

### Prerequisites

```bash
# Python 3.9+
python --version

# Required packages
pip install fastapi uvicorn websockets langchain langchain-openai pydantic
```

### Environment Configuration

Create or update `.env` file:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-...
# OR
OPEN_ROUTER_KEY_ORIGINAL=sk-...

# Optional: Model Configuration
BRE_MODEL=gpt-4o-mini
BRE_TEMPERATURE=0
```

### Directory Structure Setup

```bash
backend/bre/
├── __init__.py
├── api.py                  # FastAPI endpoints
├── models.py              # Pydantic models
├── orchestrator.py        # Workflow coordinator
├── README.md              # This file
├── agents/
│   ├── __init__.py
│   ├── deliverable_intake_agent.py
│   ├── bre_portal_agent.py
│   ├── soft_review_agent.py
│   ├── certification_submission_agent.py
│   └── evidence_closure_agent.py
└── data/
    ├── app_owner_responses.json    # Simulated app owner responses
    ├── workflow_states.json        # Persistent workflow states
    └── evidence/                   # Evidence artifacts
```

### Data Files

#### 1. Ticket Data (`data/ticket_data.json`)
BRE tickets should be included in the main ticket data file:

```json
[
  {
    "ticket_id": "BRE-9001",
    "category": "BRE",
    "application_id": "APP-XYZ123",
    "ait_number": "AIT-42",
    "status": "Open",
    "priority": "high",
    "violation_type": "rule_violation",
    "description": "Rule certification required for APP-XYZ123",
    "created_on": "2026-02-15",
    "assigned_to": "governance_team"
  }
]
```

#### 2. BRE Portal Data (`data/bre_portal_data.json`)
Contains pending rules and certification history:

```json
{
  "AIT-42": {
    "application_name": "Enterprise Portal",
    "pending_rules": [
      {
        "rule_id": "R-1001",
        "rule_name": "Admin Access Rule",
        "rule_type": "permission",
        "description": "Controls admin-level access permissions",
        "current_state": "pending_certification",
        "last_modified": "2026-02-10T10:00:00Z",
        "changes_from_last_et": [
          "Added elevated permissions for admin group",
          "Modified approval workflow for sensitive data access"
        ],
        "risk_level": "high"
      }
    ],
    "certification_history": [
      {
        "certification_date": "2025-12-15T14:30:00Z",
        "certified_by": "john.doe@company.com",
        "rules_certified": 2,
        "status": "approved",
        "comments": "Approved with standard controls"
      }
    ]
  }
}
```

#### 3. App Owner Data (`data/apphq_data.json`)
Application owner contact information:

```json
{
  "APP-XYZ123": {
    "app_owner": {
      "name": "John Doe",
      "email": "john.doe@company.com",
      "department": "IT Operations",
      "phone": "+1-555-0100"
    }
  }
}
```

---

## Usage

### Starting the Server

```bash
# From project root
uvicorn backend.demo_api_server:app --host 127.0.0.1 --port 8000 --reload
```

### Processing a Deliverable

#### Option 1: REST API

```python
import requests

# Process a BRE deliverable
response = requests.post(
    "http://localhost:8000/api/bre/process",
    json={
        "deliverable_id": "BRE-9001",
        "ticket_data": {
            "ticket_id": "BRE-9001",
            "application_id": "APP-XYZ123",
            "ait_number": "AIT-42",
            "status": "Open"
        }
    }
)

result = response.json()
print(f"Status: {result['status']}")
print(f"Final Status: {result['workflow_state']['final_status']}")
```

#### Option 2: WebSocket (Real-time Updates)

```python
import asyncio
import websockets
import json

async def watch_workflow():
    uri = "ws://localhost:8000/api/bre/ws/BRE-9001"
    async with websockets.connect(uri) as websocket:
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            print(f"Stage {data['currentStage']}: {data['status']}")
            
            if data.get('status') == 'completed':
                break

asyncio.run(watch_workflow())
```

#### Option 3: Python Test Script

```bash
# Process single deliverable
python test_bre_workflow.py

# Process multiple deliverables
python test_bre_workflow.py --mode multiple

# Run all tests
python test_bre_workflow.py --mode all
```

### Checking Workflow State

```python
# Get current workflow state
response = requests.get(
    "http://localhost:8000/api/bre/state/BRE-9001"
)

state = response.json()
print(f"Current Stage: {state['current_stage']}")
print(f"Status: {state['status']}")
print(f"Started: {state['started_at']}")
```

### Manually Closing a Deliverable

```python
# Mark deliverable as closed
response = requests.post(
    "http://localhost:8000/api/bre/close/BRE-9001"
)

result = response.json()
print(f"Closure Status: {result['status']}")
```

---

## API Endpoints

### POST `/api/bre/process`

Process a BRE deliverable through the complete workflow.

**Request Body:**
```json
{
  "deliverable_id": "BRE-9001",
  "ticket_data": {
    "ticket_id": "BRE-9001",
    "application_id": "APP-XYZ123",
    "ait_number": "AIT-42",
    "status": "Open"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "deliverable_id": "BRE-9001",
  "workflow_state": {
    "deliverable_id": "BRE-9001",
    "current_stage": 5,
    "status": "completed",
    "started_at": "2026-02-20T10:00:00Z",
    "completed_at": "2026-02-20T10:01:30Z",
    "final_status": "certified",
    "stage_results": {
      "intake": {...},
      "portal_check": {...},
      "soft_review": {...},
      "certification": {...},
      "closure": {...}
    }
  },
  "message": "Workflow completed successfully"
}
```

### GET `/api/bre/state/{deliverable_id}`

Retrieve current workflow state for a deliverable.

**Response:**
```json
{
  "deliverable_id": "BRE-9001",
  "current_stage": 3,
  "status": "in_progress",
  "started_at": "2026-02-20T10:00:00Z",
  "stage_results": {...}
}
```

### POST `/api/bre/close/{deliverable_id}`

Manually mark a deliverable as closed.

**Response:**
```json
{
  "status": "success",
  "deliverable_id": "BRE-9001",
  "message": "Deliverable marked as closed"
}
```

### WebSocket `/api/bre/ws/{deliverable_id}`

Real-time workflow updates for a specific deliverable.

**Message Format:**
```json
{
  "type": "bre_update",
  "ticket_id": "BRE-9001",
  "currentStage": 3,
  "status": "completed",
  "stages": [
    {
      "id": 3,
      "name": "Soft Review Agent",
      "status": "completed",
      "message": "Analyzed 3 rules, 1 high-risk rule identified"
    }
  ],
  "timestamp": "2026-02-20T10:00:45Z"
}
```

---

## Data Models

### BREDeliverable

```python
class BREDeliverable(BaseModel):
    deliverable_id: str
    application_id: str
    ait_number: str
    status: DeliverableStatus  # open, in_review, pending_certification, certified, closed
    priority: PriorityLevel     # low, medium, high, critical
    violation_type: ViolationType  # permission_violation, rule_violation, compliance_violation
    description: str
    created_date: datetime
    assigned_to: str
    rise_ticket_id: str
```

### PendingRule

```python
class PendingRule(BaseModel):
    rule_id: str
    rule_name: str
    rule_type: Literal["permission", "business_rule", "compliance_rule"]
    description: str
    current_state: str
    last_modified: datetime
    changes_from_last_et: List[str]
    risk_level: RiskLevel  # low, medium, high, critical
```

### BREWorkflowState

```python
class BREWorkflowState(BaseModel):
    deliverable_id: str
    current_stage: int
    status: WorkflowStatus  # pending, in_progress, completed, failed
    started_at: datetime
    completed_at: Optional[datetime]
    final_status: Optional[str]
    error_message: Optional[str]
    stage_results: Dict[str, Any]
```

### CertificationHistory

```python
class CertificationHistory(BaseModel):
    certification_date: datetime
    certified_by: str
    rules_certified: int
    status: Literal["approved", "approved_with_conditions", "rejected"]
    comments: str
```

---

## Configuration

### LLM Configuration

The orchestrator and agents use OpenAI's GPT-4o-mini by default:

```python
# In api.py
def _build_llm() -> ChatOpenAI:
    api_key = os.getenv("OPEN_ROUTER_KEY_ORIGINAL") or os.getenv("OPENAI_API_KEY")
    return ChatOpenAI(
        model="gpt-4omini",
        api_key=api_key,
        temperature=0,  # Deterministic responses
    )
```

### Customizing Agent Behavior

Each agent can be customized by modifying its system prompt:

```python
# Example: agents/soft_review_agent.py
SYSTEM_PROMPT = """You are a Soft Review Agent...

Your task is to:
1. Analyze changes in each pending rule
2. Assess overall risk level
3. Generate review summary
4. Create recommendations

[Customize behavior here]
"""
```

### WebSocket Broadcasting

Configure broadcast behavior in orchestrator:

```python
# Disable broadcasting for specific stages
async def _broadcast_update(self, stage_id: int, ...):
    if stage_id in [0, 5]:  # Skip broadcasting for stages 0 and 5
        return
    # ... broadcast logic
```

---

## Development Guide

### Adding a New Agent

1. **Create Agent File**

```bash
touch backend/bre/agents/new_agent.py
```

2. **Define Agent Class**

```python
from langchain.agents import create_agent
from langchain.tools import tool

SYSTEM_PROMPT = """Your agent's purpose and instructions..."""

class NewAgent:
    def __init__(self, llm=None):
        self.llm = llm
        self.tools = self._create_tools()
        self.agent = create_agent(
            model=self.llm,
            tools=self.tools,
            system_prompt=SYSTEM_PROMPT
        ) if self.llm else None

    def _create_tools(self):
        @tool("ToolName")
        def tool_function(input: str) -> str:
            """Tool description"""
            # Implementation
            pass
        
        return [tool_function]

    async def process(self, context: dict) -> dict:
        if self.agent is None:
            # Fallback logic without LLM
            pass
        
        # Invoke agent
        result = await self.agent.ainvoke({"messages": [...]})
        return {"status": "success", ...}
```

3. **Update Orchestrator**

```python
# In orchestrator.py
from backend.bre.agents.new_agent import NewAgent

class BREOrchestrator:
    def __init__(self, llm=None):
        # ... existing agents
        self.new_agent = NewAgent(llm)
```

4. **Add to Workflow Stages**

```python
BRE_STAGES = [
    # ... existing stages
    {"id": 6, "name": "New Agent", "status": "pending", "message": ""},
]
```

5. **Update Process Flow**

```python
async def process_deliverable(self, deliverable_id: str, ...):
    # ... existing stages
    
    # Stage 6: New Agent
    result_6 = await self.new_agent.process(context)
    state.stage_results["new_stage"] = result_6
```

### Testing Your Agent

```python
# Create test file: test_new_agent.py
import asyncio
from backend.bre.agents.new_agent import NewAgent

async def test_agent():
    agent = NewAgent()
    result = await agent.process({
        "deliverable_id": "BRE-TEST-001",
        # ... test context
    })
    print(result)

asyncio.run(test_agent())
```

### Error Handling Best Practices

```python
async def process(self, context: dict) -> dict:
    try:
        # Agent logic
        result = await self.agent.ainvoke(...)
        
        return {
            "status": "success",
            "data": result
        }
    
    except Exception as e:
        print(f"Error in {self.__class__.__name__}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "fallback_data": self._fallback_logic(context)
        }
```

### Logging and Debugging

```python
# Enable detailed logging
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# In agents
logger = logging.getLogger(__name__)
logger.debug(f"Processing deliverable: {deliverable_id}")
```

---

## Troubleshooting

### Common Issues

#### 1. "No OPENAI_API_KEY found" Error

**Problem**: LLM initialization fails due to missing API key

**Solution**:
```bash
# Set environment variable
export OPENAI_API_KEY=sk-your-key-here
# OR
export OPEN_ROUTER_KEY_ORIGINAL=sk-your-key-here

# Verify
echo $OPENAI_API_KEY
```

#### 2. Workflow Stuck in "pending" Status

**Problem**: Workflow not progressing past initial stage

**Diagnostic Steps**:
```python
# Check workflow state
import requests
response = requests.get("http://localhost:8000/api/bre/state/BRE-9001")
print(response.json())

# Check server logs
# Look for error messages or exceptions
```

**Common Causes**:
- Missing ticket data in `ticket_data.json`
- Invalid deliverable ID
- Database connection issues

#### 3. Agent Returns Empty Results

**Problem**: Agent completes but returns no meaningful data

**Solution**:
```python
# Verify data files exist
import os
from pathlib import Path

data_path = Path("data")
print(f"BRE Portal Data exists: {(data_path / 'bre_portal_data.json').exists()}")
print(f"AppHQ Data exists: {(data_path / 'apphq_data.json').exists()}")
```

#### 4. WebSocket Connection Fails

**Problem**: Cannot establish WebSocket connection

**Diagnostic**:
```python
# Test WebSocket connectivity
import asyncio
import websockets

async def test_ws():
    try:
        async with websockets.connect("ws://localhost:8000/api/bre/ws/BRE-9001") as ws:
            print("Connected successfully")
    except Exception as e:
        print(f"Connection failed: {e}")

asyncio.run(test_ws())
```

**Common Fixes**:
- Ensure server is running
- Check firewall settings
- Verify deliverable ID exists

#### 5. Rate Limiting Errors (429)

**Problem**: Too many API requests to OpenAI

**Solution**:
```python
# Add retry logic with exponential backoff
from tenacity import retry, wait_exponential, stop_after_attempt

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(5)
)
async def call_llm(self, messages):
    return await self.llm.ainvoke(messages)
```

### Debug Mode

Enable verbose output for debugging:

```python
# In orchestrator.py
DEBUG_MODE = True

async def _broadcast_update(self, stage_id: int, ...):
    if DEBUG_MODE:
        print(f"Broadcasting stage {stage_id}: {status}")
    # ... rest of method
```

### Workflow Recovery

If a workflow fails mid-process:

```python
# Reset workflow state
import json
from pathlib import Path

state_file = Path("backend/bre/data/workflow_states.json")
with open(state_file, 'r') as f:
    states = json.load(f)

# Remove failed deliverable
if "BRE-9001" in states:
    del states["BRE-9001"]
    
with open(state_file, 'w') as f:
    json.dump(states, f, indent=2)

# Restart processing
```

### Performance Optimization

```python
# Parallel agent execution for independent tasks
import asyncio

async def optimize_workflow(self):
    # Run independent agents in parallel
    portal_task = self.portal_agent.process(context)
    owner_task = self.get_app_owner_info(app_id)
    
    portal_result, owner_result = await asyncio.gather(
        portal_task,
        owner_task
    )
```

---

## Additional Resources

### Related Documentation

- [BRE_GUIDE.md](../../BRE_GUIDE.md) - Quick start guide
- [ARM Module](../arm/README.md) - ARM report workflow
- [PCAT Module](../pcat/README.md) - PCAT ticket workflow
- [IAM System](../iam_system/) - IAM remediation system

### External Links

- [LangChain Documentation](https://python.langchain.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic V2 Documentation](https://docs.pydantic.dev/latest/)

### Support

For issues or questions:
1. Check this README and troubleshooting section
2. Review server logs: `uvicorn.log`
3. Check workflow states: `backend/bre/data/workflow_states.json`
4. Review agent outputs in stage results

---

