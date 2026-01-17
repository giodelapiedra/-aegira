# Supervisor Approval Feature for Incidents

## Overview
Add a second-tier approval process where Supervisor must approve incident-related exceptions after Team Leader approval.

## Current Flow
```
Worker Reports Incident
    ↓
Exception Created (PENDING)
    ↓
Team Leader Reviews
    ↓
APPROVED / REJECTED (Final)
```

## New Proposed Flow
```
Worker Reports Incident
    ↓
Exception Created (PENDING)
    ↓
Team Leader Reviews
    ↓
TL Approves → Status: TL_APPROVED (pending supervisor)
    or
TL Rejects → Status: REJECTED (Final)
    ↓
Supervisor Reviews (only TL_APPROVED items)
    ↓
Supervisor Approves → Status: APPROVED (Final)
    or
Supervisor Rejects → Status: REJECTED (Final)
```

---

## Database Changes

### Option A: Add fields to Exception model (Recommended)
Add supervisor approval tracking to existing Exception model:

```prisma
model Exception {
  // ... existing fields ...

  // Team Leader approval (existing, rename for clarity)
  reviewedById     String?    // TL who reviewed
  reviewNote       String?    // TL review note
  approvedBy       String?    // TL who approved
  approvedAt       DateTime?  // When TL approved
  rejectedBy       String?    // TL who rejected
  rejectedAt       DateTime?  // When TL rejected

  // NEW: Supervisor approval fields
  supervisorReviewedById  String?
  supervisorReviewNote    String?
  supervisorApprovedAt    DateTime?
  supervisorRejectedAt    DateTime?

  // Relations
  supervisorReviewedBy    User?    @relation("ExceptionSupervisorReviewer", fields: [supervisorReviewedById], references: [id])
}
```

### Option B: Update ExceptionStatus enum
```prisma
enum ExceptionStatus {
  PENDING           // Waiting for TL review
  TL_APPROVED       // TL approved, waiting for Supervisor
  APPROVED          // Final: Supervisor approved
  REJECTED          // Final: TL or Supervisor rejected
}
```

---

## Backend Changes

### 1. Schema Updates (prisma/schema.prisma)
- Add `supervisorReviewedById`, `supervisorReviewNote`, `supervisorApprovedAt`, `supervisorRejectedAt` to Exception
- Add new relation for supervisorReviewedBy
- Update ExceptionStatus enum with TL_APPROVED

### 2. Exception Module Updates (src/modules/exceptions/index.ts)
- Modify TL approve endpoint: Set status to TL_APPROVED instead of APPROVED
- Create new supervisor approval endpoints:
  - `GET /exceptions/supervisor-pending` - List exceptions pending supervisor review
  - `PATCH /exceptions/:id/supervisor-approve` - Supervisor approves
  - `PATCH /exceptions/:id/supervisor-reject` - Supervisor rejects
- Only SUPERVISOR role can access these endpoints

### 3. Incident Module Updates (src/modules/incidents/index.ts)
- Include supervisorReviewedBy info in incident detail response
- Add supervisor approval info to incident listing

### 4. Notification Updates
- When TL approves: Notify relevant Supervisor(s)
- When Supervisor approves/rejects: Notify Worker and TL

---

## Frontend Changes

### 1. New Page: Supervisor Incidents Review
**Path:** `frontend/src/pages/supervisor/incidents-review.page.tsx`

**Features:**
- Table listing incidents pending supervisor approval
- Filter by: Team, Date range, Severity
- Columns: Case #, Worker Name, Team, Incident Type, Severity, TL Approved By, Date, Actions
- Actions: View Details, Approve, Reject

### 2. Update Incident Detail Page
**Path:** `frontend/src/pages/incidents/incident-detail.page.tsx`

**Add:**
- Display "Team Leader Approved By: [Name] on [Date]"
- Display "Supervisor Approved By: [Name] on [Date]" (when available)
- Show approval timeline in activity section

### 3. New Service Methods
**Path:** `frontend/src/services/exception.service.ts`

```typescript
// New methods
getSupervisorPendingExceptions(params)
supervisorApproveException(id, note?)
supervisorRejectException(id, note?)
```

### 4. Navigation Update
- Add "Incident Approvals" link for Supervisor role

---

## Implementation Tasks

### Phase 1: Backend
- [ ] 1.1 Update Prisma schema with new fields
- [ ] 1.2 Run database migration
- [ ] 1.3 Update TL approval flow to set TL_APPROVED status
- [ ] 1.4 Create supervisor approval endpoints
- [ ] 1.5 Add supervisor pending list endpoint
- [ ] 1.6 Update notification logic

### Phase 2: Frontend
- [ ] 2.1 Create supervisor incidents review page
- [ ] 2.2 Add service methods for supervisor approval
- [ ] 2.3 Update incident detail page with supervisor info
- [ ] 2.4 Add navigation for supervisor role
- [ ] 2.5 Update types/interfaces

### Phase 3: Testing
- [ ] 3.1 Test full approval workflow
- [ ] 3.2 Test rejection at each level
- [ ] 3.3 Test notifications
- [ ] 3.4 Test role-based access

---

## UI Reference (Similar to user's image)

### Supervisor Incidents Review Table
| Case # | Worker | Team | Type | Severity | TL Approved By | Date | Status | Actions |
|--------|--------|------|------|----------|----------------|------|--------|---------|
| INC-2024-0001 | Juan Santos | Team A | Injury | HIGH | Maria Cruz | Jan 15 | Pending | [Approve] [Reject] [View] |
| INC-2024-0002 | Pedro Garcia | Team B | Illness | MEDIUM | Jose Reyes | Jan 14 | Pending | [Approve] [Reject] [View] |

### Status Badges
- **Pending** (Yellow) - TL approved, waiting supervisor
- **Approved** (Green) - Supervisor approved, final
- **Rejected** (Red) - Rejected at any level

---

## Questions to Confirm

1. **Which Supervisor should review?**
   - Any supervisor in the company?
   - Specific supervisor assigned to the team?

2. **Can Executive also approve?**
   - Should EXECUTIVE role also have supervisor-level approval?

3. **Notification recipients:**
   - Notify all supervisors or just assigned one?

4. **Historical data:**
   - Existing APPROVED exceptions - treat as fully approved?
