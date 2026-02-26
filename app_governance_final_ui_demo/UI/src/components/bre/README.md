# BRE (Business Rules Engine) Rule Certification UI

This directory contains the complete UI implementation for the BRE Rule Certification workflow.

## Overview

The BRE UI provides a comprehensive interface for managing the Business Rules Engine certification process, matching the patterns established by PCAT, IAM, and ARM implementations.

## Components

### 1. **BRETicketPanel.tsx**
Main component that orchestrates the entire BRE workflow.

**Features:**
- **Real-time Updates**: WebSocket integration for live progress tracking
- **Stage Management**: 6-stage certification workflow visualization
- **Action Buttons**:
  - `Run BRE Process`: Initiates stages 1-4 (Intake → Portal Check → Soft Review → Certification Request)
  - `Verify & Close`: Validates app owner response and closes the ticket (Stage 5-6)
  - `Reset`: Resets ticket to initial state
- **Auto-scrolling**: Automatically scrolls to action buttons when awaiting app owner verification
- **Error Handling**: Displays errors and status messages

**Props:**
```typescript
interface BRETicketPanelProps {
  ticket: any;           // Current ticket data
  onRefresh: () => void; // Callback to refresh parent ticket list
}
```

### 2. **BREMetricsCards.tsx**
Displays stage-specific information dynamically based on workflow progress.

**Stage-specific Information:**

#### Stage 2: BRE Portal Check
- Summary cards (AIT Number, Pending Rules, High/Critical Risk, Past Certifications)
- Pending rules table with:
  - Rule ID, Name, Type
  - Risk level with color coding
  - Changes from last ET (Engineering Time)
- Certification history timeline

#### Stage 3: Soft Review
- Total rules and high-risk rule counts
- Review summary with AI-generated analysis
- Changes analysis
- Recommendations list

#### Stage 5: Verify & Close (App Owner Response)
- Certification status (Approved, Approved with Conditions, Rejected)
- Certified by information
- Certification date and time
- List of certified rule IDs
- App owner comments
- Evidence screenshot path

**Props:**
```typescript
interface BREMetricsCardsProps {
  workflowState: BREWorkflowState | null; // Current workflow state from backend
  currentStage: number;                    // Current stage number (0-5)
}
```

### 3. **breApi.ts**
API wrapper for all BRE backend endpoints.

**Available Methods:**

```typescript
// Start BRE workflow (stages 1-4)
breApi.processDeliverable(deliverableId: string)

// Verify app owner response and close (stage 5-6)
breApi.verifyAndClose(deliverableId: string, autoCertify: boolean = false)

// Get current workflow status
breApi.getWorkflowStatus(deliverableId: string)

// Get live ticket state
breApi.getTicket(deliverableId: string)

// Get AIT rules and history
breApi.getAITRules(aitNumber: string)

// Reset ticket to initial state
breApi.resetTicket(deliverableId: string)

// List all BRE tickets
breApi.listTickets()

// Connect to WebSocket for real-time updates
breApi.connectWebSocket(deliverableId: string, onMessage: (data: any) => void)
```

### 4. **types.ts**
TypeScript type definitions for BRE domain models.

**Key Types:**
- `PendingRule`: Individual rule requiring certification
- `CertificationHistory`: Historical certification records
- `AITRules`: Rules and history for an AIT
- `AppOwnerResponse`: App owner's certification response
- `SoftReviewResult`: AI-generated soft review analysis
- `BREWorkflowState`: Complete workflow state
- `BREWebSocketMessage`: WebSocket message format

### 5. **index.ts**
Export barrel for easy imports.

## Integration with Home.tsx

The BRE components are integrated into the main application through `Home.tsx`:

### 1. Helper Function
```typescript
// Identify BRE tickets
const isBRETicket = (ticket: Ticket | null) => {
  if (!ticket) return false;
  return ticket.subcategory?.toUpperCase() === 'BRE' || 
         (ticket.category?.toUpperCase() === 'BRE') ||
         (ticket.category?.toUpperCase() === 'IAM' && 
          ticket.subcategory?.toUpperCase() === 'BRE');
};
```

### 2. Ticket Rendering
```typescript
{isPCATTicket(selectedTicket) ? (
  <PCATTicketPanel ticket={selectedTicket} onRefresh={() => fetchTickets()} />
) : isBRETicket(selectedTicket) ? (
  <BRETicketPanel ticket={selectedTicket} onRefresh={() => fetchTickets()} />
) : (
  // Regular IAM/ARM tickets
)}
```

### 3. Category Badges
BRE tickets display with green badges:
- Background: `bg-green-100`
- Text: `text-green-700`
- Border: `border-green-200`

### 4. Dashboard Widget
When only BRE tickets are filtered, a BRE-specific dashboard appears showing:
- Total BRE deliverables
- In-progress count
- Certified count
- Awaiting app owner response count

## Backend API Endpoints

The UI interacts with these backend endpoints:

### Primary Endpoints
- `POST /api/bre/process/{deliverable_id}` - Start async workflow
- `POST /api/bre/verify/{deliverable_id}` - Verify and close
- `GET /api/bre/status/{deliverable_id}` - Get workflow status
- `GET /api/bre/tickets/{deliverable_id}` - Get live ticket state
- `POST /api/bre/reset/{deliverable_id}` - Reset ticket
- `WS /api/bre/ws/{deliverable_id}` - WebSocket connection

### Additional Endpoints
- `GET /api/bre/ait/{ait_number}/rules` - Get AIT rules and history
- `GET /api/bre/tickets` - List all BRE tickets
- `GET /api/bre/workflows/active` - List active workflows
- `GET /api/bre/metrics` - Get BRE metrics

## WebSocket Message Types

The UI handles these WebSocket message types:

```typescript
type MessageType = 
  | 'bre_stage_update'  // Stage completed or progressed
  | 'bre_connected'     // Initial connection established
  | 'bre_reset'         // Ticket reset to initial state
  | 'bre_complete'      // Entire workflow completed
```

### Example WebSocket Message
```json
{
  "type": "bre_stage_update",
  "deliverable_id": "BRE-2026-001",
  "stage_id": 2,
  "status": "completed",
  "message": "BRE Portal Check completed successfully",
  "workflow_state": { /* Full workflow state */ }
}
```

## Workflow States

### Ticket States (currentStage)
- `0`: Initial/Not Started
- `1`: Deliverable Intake (running)
- `2`: BRE Portal Check (running/completed)
- `3`: Soft Review (running/completed)
- `4`: Certification Request Sent (awaiting app owner)
- `5`: Verifying Response & Closing (running)
- `6`: Completed/Closed

### Stage Status Values
- `pending`: Not yet started
- `in-progress` / `running`: Currently executing
- `completed`: Successfully finished
- `awaiting_confirmation`: Waiting for app owner response
- `error`: Failed with error

## Data Flow

### Process Flow (Stages 1-4)
1. User clicks "Run BRE Process"
2. Frontend calls `breApi.processDeliverable()`
3. Backend starts async processing
4. WebSocket sends updates for each stage:
   - Stage 1: Deliverable intake
   - Stage 2: BRE portal check → `BREMetricsCards` displays rules & history
   - Stage 3: Soft review → `BREMetricsCards` displays review analysis
   - Stage 4: Certification request sent → UI waits for app owner

### Verify Flow (Stages 5-6)
1. App owner provides certification response (external)
2. User clicks "Verify & Close Ticket"
3. Frontend calls `breApi.verifyAndClose()`
4. Backend:
   - Loads app owner response from `app_owner_responses.json`
   - Collects evidence
   - Closes deliverable
5. WebSocket updates with final state
6. `BREMetricsCards` displays app owner response details

## Styling Conventions

### Colors
- **Primary BRE Color**: Green (`#10B981`)
  - Backgrounds: `bg-green-50`, `bg-green-100`
  - Text: `text-green-600`, `text-green-700`
  - Borders: `border-green-200`, `border-green-300`

### Risk Level Colors
- **Critical**: Red (`bg-red-100 text-red-600`)
- **High**: Orange (`bg-orange-100 text-orange-600`)
- **Medium**: Yellow (`bg-yellow-100 text-yellow-600`)
- **Low**: Green (`bg-green-100 text-green-600`)

### Status Colors
- **Approved**: Green
- **Approved with Conditions**: Yellow
- **Rejected**: Red

### Stage Status Indicators
- **Completed**: Green checkmark, solid background
- **In Progress**: Blue spinner, pulsing animation
- **Pending**: Gray, inactive
- **Awaiting**: Yellow/Orange, pulsing ring
- **Error**: Red, error icon

## Development Guidelines

### Adding New Features

1. **Backend First**: Ensure backend endpoint exists and returns correct data
2. **Update Types**: Add new types to `types.ts`
3. **API Wrapper**: Add method to `breApi.ts`
4. **Component Logic**: Implement in `BRETicketPanel` or `BREMetricsCards`
5. **Test WebSocket**: Verify real-time updates work correctly

### Testing Checklist

- [ ] BRE tickets identified correctly (`isBRETicket`)
- [ ] Category badges display green for BRE
- [ ] Dashboard widget appears when filtering BRE tickets
- [ ] "Run BRE Process" button starts workflow
- [ ] WebSocket connects and receives updates
- [ ] Stage information updates dynamically
- [ ] "Verify & Close" button appears at stage 4
- [ ] App owner response displays correctly
- [ ] Reset functionality works
- [ ] Error messages display properly
- [ ] Auto-scroll to action buttons works

### Common Issues

**Issue**: WebSocket not connecting
- **Solution**: Check backend is running and WebSocket endpoint is accessible
- **Debug**: Open browser console and check for WebSocket errors

**Issue**: Stage information not displaying
- **Solution**: Verify `workflow_state` is being populated by backend
- **Debug**: Check Network tab for `/api/bre/status/{id}` response

**Issue**: Verify button not appearing
- **Solution**: Check `currentStage` and `stages[4].status` in ticket data
- **Debug**: Log `ticket` object in `BRETicketPanel` to inspect state

## File Structure

```
components/bre/
├── index.ts                    # Export barrel
├── types.ts                    # TypeScript type definitions
├── breApi.ts                   # API wrapper
├── BRETicketPanel.tsx          # Main workflow panel
├── BREMetricsCards.tsx         # Stage-specific info cards
└── README.md                   # This file
```

## Dependencies

- **React**: Core framework
- **lucide-react**: Icons
- **TailwindCSS**: Styling
- **WebSocket API**: Real-time updates

## Future Enhancements

Potential improvements:
1. **Bulk Operations**: Certify multiple deliverables at once
2. **Advanced Filtering**: Filter by AIT, risk level, certification status
3. **Export Reports**: Download certification reports as PDF
4. **Notifications**: Email/Slack notifications for certification requests
5. **Audit Trail**: Detailed timeline of all workflow actions
6. **Rule Comparison**: Compare current rules with previous versions
7. **Custom Workflows**: Configure custom certification workflows per AIT

## Support

For issues or questions:
1. Check backend logs: `backend/bre/orchestrator.py`
2. Review workflow state: `backend/bre/data/workflow_states.json`
3. Check app owner responses: `backend/bre/data/app_owner_responses.json`
4. Verify BRE portal data: `data/bre_portal_data.json`

---

**Last Updated**: February 25, 2026
**Version**: 1.0.0
**Author**: AI Development Team
