# BRE Backend — UI Integration Guide

> **For the UI team.** Everything you need to connect to the BRE backend, trigger workflows, listen on WebSockets, and handle errors.

---

## Base URL

```
http://localhost:8000/api/bre
```

All REST calls go through this prefix.  
All WebSocket connections use `ws://` instead of `http://`.

---

## Quick Reference

| What you want to do                      | Method | Path                              |
|------------------------------------------|--------|-----------------------------------|
| List all BRE tickets (live state)        | GET    | `/tickets`                        |
| Get one BRE ticket (live state)          | GET    | `/tickets/{id}`                   |
| List deliverables (from data file)       | GET    | `/deliverables`                   |
| Get one deliverable (data file)          | GET    | `/deliverables/{id}`              |
| Get workflow run status                  | GET    | `/status/{id}`                    |
| Get AIT rules & cert history             | GET    | `/ait/{ait_number}/rules`         |
| Get process metrics                      | GET    | `/metrics`                        |
| **Start async workflow** → WS updates   | POST   | `/process/{id}`                   |
| **Trigger Evidence & Closure (Stage 5)** | POST   | `/verify/{id}`                    |
| **Reset ticket to initial state**        | POST   | `/reset/{id}`                     |
| Per-deliverable real-time updates        | WS     | `/ws/{id}`                        |
| Global real-time updates (all tickets)   | WS     | `ws://localhost:8000/ws`          |

---

## Async Workflow Endpoints

These two endpoints are the heart of the BRE flow.  
Both **return immediately** and do the real work in the background.  
Your UI should connect to a WebSocket before calling them to receive progress events.

---

### POST `/process/{deliverable_id}`

**Starts the full BRE certification workflow (Stages 1–4).**

```
POST http://localhost:8000/api/bre/process/BRE-001
```

No request body needed.

**Immediate response (HTTP 200):**

```json
{
  "status": "success",
  "message": "BRE processing started for BRE-001. Watch WebSocket for progress.",
  "deliverable_id": "BRE-001"
}
```

The workflow then runs asynchronously through these stages:

| Stage | Name                    | Description                                  |
|-------|-------------------------|----------------------------------------------|
| 0     | Deliverable Intake      | Reads and validates the deliverable          |
| 1     | BRE Portal Check        | Looks up AIT rules in the BRE portal         |
| 2     | Soft Review             | Analyses pending rules and risk levels       |
| 3     | Certification Submission| Sends cert request to the app owner          |
| 4     | Evidence & Closure      | Triggered by `/verify` — closes the ticket   |

Watch the WebSocket for stage-by-stage updates (see WebSocket section below).

**Errors:**

| HTTP | When                                              |
|------|---------------------------------------------------|
| 500  | Unexpected server error — `detail` field has info |

---

### POST `/verify/{deliverable_id}?auto_certify=false`

**Confirms app owner certification and triggers Stage 5 (Evidence & Closure).**  
Call this after the user has confirmed the app owner responded.

```
POST http://localhost:8000/api/bre/verify/BRE-001
```

Optional query param:

| Param         | Type    | Default | Description                                                      |
|---------------|---------|---------|------------------------------------------------------------------|
| `auto_certify`| boolean | `false` | `true` = use a simulated cert response; `false` = use real data |

**Immediate response (HTTP 200):**

```json
{
  "status": "success",
  "message": "Certification confirmed for BRE-001. Closing deliverable...",
  "auto_certify": false
}
```

Background task completes Stage 5 and broadcasts a final `bre_stage_update` on WebSocket.

**Errors:**

| HTTP | When                                              |
|------|---------------------------------------------------|
| 500  | Unexpected server error — `detail` field has info |

---

## WebSocket Connections

There are **two WebSocket channels**. You can use either or both.

---

### 1. Per-deliverable WebSocket

```
ws://localhost:8000/api/bre/ws/{deliverable_id}
```

**Connect before (or right after) calling `/process/{id}` or `/verify/{id}`.**

```typescript
const ws = new WebSocket('ws://localhost:8000/api/bre/ws/BRE-001');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg);
};
```

#### Messages you will receive

---

**`bre_connected`** — sent immediately on connect

```json
{
  "type": "bre_connected",
  "deliverable_id": "BRE-001",
  "ticket": { /* current ticket object with stages */ },
  "workflow_state": { /* optional, if workflow already started */ }
}
```

---

**`bre_stage_update`** — sent as each stage completes

```json
{
  "type": "bre_stage_update",
  "deliverable_id": "BRE-001",
  "stage_index": 2,
  "stage_name": "soft_review",
  "status": "completed",
  "message": "Soft review completed with 3 high-risk rules found",
  "ticket": { /* full updated ticket object */ }
}
```

`status` values: `"running"` → `"completed"` → `"error"`

`stage_name` values (in order):
- `"intake"`
- `"portal_check"`
- `"soft_review"`
- `"certification_submission"`
- `"evidence_closure"`

---

**`bre_reset`** — sent when ticket is reset via `/reset/{id}`

```json
{
  "type": "bre_reset",
  "deliverable_id": "BRE-001",
  "ticket": { /* fresh ticket object, stages back to initial state */ }
}
```

---

**`pong`** — reply to a ping keepalive

```json
{ "type": "pong" }
```

#### Sending messages to the server

Only one supported client message:

```
ping
```

Send the plain string `"ping"` to keep the connection alive. Server replies with `{ "type": "pong" }`.

---

### 2. Global WebSocket (all tickets)

```
ws://localhost:8000/ws
```

This is a shared channel that receives updates for **all ticket types** (BRE, ARM, PCAT, etc.).  
Useful if you have a dashboard that shows all ticket activity at once.

#### BRE-specific messages on the global channel

**`ticket_update`** — whenever any ticket's stage changes

```json
{
  "type": "ticket_update",
  "ticket": {
    "id": "BRE-001",
    "category": "BRE",
    "ticket_type": "BRE",
    "status": "In Progress",
    "currentStage": 2,
    "stages": [ /* array of stage objects */ ]
  }
}
```

**`ticket_reset`** — when a ticket is reset

```json
{
  "type": "ticket_reset",
  "ticket": { /* full reset ticket object */ }
}
```

---

## Reset Endpoint

### POST `/reset/{deliverable_id}`

Resets a BRE ticket back to its **initial state** (Stage 0, status = Open).  
Useful for demo reruns.

```
POST http://localhost:8000/api/bre/reset/BRE-001
```

**What it does:**
1. Clears the workflow state from memory
2. Reloads the original ticket data from `ticket_data.json`
3. Resets all stages to initial
4. Broadcasts `ticket_reset` on the global `/ws`
5. Broadcasts `bre_reset` on the per-deliverable `/api/bre/ws/{id}`

**Response (HTTP 200):**

```json
{
  "success": true,
  "message": "BRE ticket BRE-001 reset to initial state",
  "deliverable_id": "BRE-001",
  "ticket": { /* fresh ticket object */ }
}
```

**Errors:**

| HTTP | When                                       |
|------|--------------------------------------------|
| 404  | Ticket ID not found in `ticket_data.json`  |
| 500  | Unexpected server error                    |

---

## Other Fetch Endpoints

### GET `/tickets`

Returns all BRE tickets from the **live in-memory store** (includes real-time stage progress).

```json
{
  "success": true,
  "count": 3,
  "tickets": [
    {
      "id": "BRE-001",
      "ticket_id": "BRE-001",
      "category": "BRE",
      "ticket_type": "BRE",
      "status": "Open",
      "currentStage": 0,
      "stages": [ /* stage objects */ ]
    }
  ]
}
```

---

### GET `/tickets/{deliverable_id}`

Same as above but for one ticket. Returns `404` if not found.

```json
{
  "success": true,
  "ticket": { /* ticket object */ }
}
```

---

### GET `/deliverables`

Returns BRE records straight from `ticket_data.json` (no stage progress, raw data).

```json
{
  "success": true,
  "count": 3,
  "deliverables": [ /* raw ticket data objects */ ]
}
```

---

### GET `/status/{deliverable_id}`

Returns the current workflow run state (what step the background task is on).

```json
{
  "current_step": "soft_review",
  "deliverable_id": "BRE-001",
  "workflow_log": [
    { "step": "intake", "status": "completed", "timestamp": "..." },
    { "step": "portal_check", "status": "completed", "timestamp": "..." }
  ]
}
```

Returns `404` if no workflow has been started yet.

---

### GET `/metrics`

Summary counts across all BRE workflows.

```json
{
  "success": true,
  "metrics": {
    "total_workflows": 5,
    "completed": 3,
    "in_progress": 2,
    "completion_rate": "60.0%"
  },
  "active_workflows": [ /* list */ ]
}
```

---

## Ticket Object Shape

Every `ticket` field in WebSocket messages and REST responses has this shape:

```json
{
  "id": "BRE-001",
  "ticket_id": "BRE-001",
  "category": "BRE",
  "ticket_type": "BRE",
  "status": "Open | In Progress | Closed",
  "currentStage": 0,
  "stages": [
    {
      "label": "Deliverable Intake",
      "status": "pending | running | completed | error",
      "message": "...",
      "timestamp": "..."
    },
    { "label": "BRE Portal Check", "status": "pending", ... },
    { "label": "Soft Review", "status": "pending", ... },
    { "label": "Certification Submission", "status": "pending", ... },
    { "label": "Evidence & Closure", "status": "pending", ... }
  ]
}
```

`currentStage` is the **0-based index** of the stage currently running or last completed.

---

## Error Responses

All REST errors follow FastAPI's standard shape:

```json
{
  "detail": "Human-readable error message here"
}
```

Common HTTP codes:

| Code | Meaning                                                   |
|------|-----------------------------------------------------------|
| 404  | Deliverable / ticket / workflow not found                 |
| 500  | Server error — check `detail` for what went wrong         |

WebSocket errors are not sent as error frames — if the workflow hits an error the stage's `status` will be `"error"` in the `bre_stage_update` message.

---

## Typical UI Flow

```
1. User opens a BRE ticket panel
   → GET /api/bre/tickets/{id}          fetch current state

2. Connect WebSocket
   → ws://localhost:8000/api/bre/ws/{id}
   → receive bre_connected (snapshot of current state)

3. User clicks "Start Processing"
   → POST /api/bre/process/{id}
   → backend starts stages in background
   → WebSocket streams bre_stage_update for each stage

4. After Stage 3 completes (cert sent to app owner)
   → Show "Confirm Certification" button to user

5. User confirms cert received
   → POST /api/bre/verify/{id}
   → WebSocket sends bre_stage_update for Stage 4 (Evidence & Closure)
   → Last update has status = "completed", ticket.status = "Closed"

6. Demo reset
   → POST /api/bre/reset/{id}
   → WebSocket sends bre_reset → UI resets to Stage 0
```

---

## Notes

- The server runs on **port 8000** by default. If that changes, update `BASE_URL` in `breApi.ts`.
- The frontend already has a thin client in `UI/src/components/bre/breApi.ts` — use that rather than writing raw `fetch` calls.
- `/process` and `/verify` both return **instantly** (HTTP 200). Do **not** poll them — use WebSocket for actual progress.
- If you reload the page mid-workflow, reconnect the WebSocket and call `GET /tickets/{id}` — the backend keeps state in memory, so you'll get the latest stage snapshot in the `bre_connected` message.
