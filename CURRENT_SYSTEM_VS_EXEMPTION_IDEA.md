# CURRENT SYSTEM vs. EXEMPTION IDEA

**Date:** January 5, 2026
**Purpose:** Ipakita ang difference ng EXISTING CODE vs. PROPOSED FEATURE

---

## QUICK SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  CURRENT EXCEPTION SYSTEM (Existing Code)                       │
│  ─────────────────────────────────────────────────────────────  │
│  • Worker requests leave WITH dates (startDate, endDate)       │
│  • TL approves/rejects                                          │
│  • TL can end early                                             │
│  • When approved → Attendance = EXCUSED                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  YOUR EXEMPTION IDEA (New Feature)                              │
│  ─────────────────────────────────────────────────────────────  │
│  • Triggered by CRITICAL check-in score                         │
│  • Worker requests exemption (reason only, NO dates)           │
│  • TL approves AND SETS the return date                        │
│  • Once approved → Same as leave (EXCUSED, no check-in)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## WHAT YOU ALREADY HAVE (Existing Code)

### Exception Model (schema.prisma)

```prisma
model Exception {
  id               String          @id @default(uuid())
  userId           String
  companyId        String
  type             ExceptionType   // SICK_LEAVE, PERSONAL_LEAVE, etc.
  reason           String
  startDate        DateTime        // Worker sets this
  endDate          DateTime        // Worker sets this
  status           ExceptionStatus // PENDING, APPROVED, REJECTED
  reviewedById     String?
  reviewNote       String?
  approvedBy       String?
  approvedAt       DateTime?
  rejectedBy       String?
  rejectedAt       DateTime?
  notes            String?
  attachments      String[]
  linkedIncidentId String?         // Link to incident if auto-created
  createdAt        DateTime
  updatedAt        DateTime
}

enum ExceptionType {
  SICK_LEAVE
  PERSONAL_LEAVE
  MEDICAL_APPOINTMENT
  FAMILY_EMERGENCY
  OTHER
}

enum ExceptionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Existing API Endpoints (backend/src/modules/exceptions/index.ts)

| Endpoint | Description | Status |
|----------|-------------|--------|
| `POST /exceptions` | Worker creates exception request | ✅ EXISTS |
| `GET /exceptions/pending` | Get pending requests for TL | ✅ EXISTS |
| `GET /exceptions/my` | Worker's own exceptions | ✅ EXISTS |
| `GET /exceptions/:id` | Get exception details | ✅ EXISTS |
| `PUT /exceptions/:id` | Update exception (dates, etc.) | ✅ EXISTS |
| `PATCH /exceptions/:id/approve` | TL approves | ✅ EXISTS |
| `PATCH /exceptions/:id/reject` | TL rejects | ✅ EXISTS |
| `PATCH /exceptions/:id/end-early` | TL ends leave early | ✅ EXISTS |
| `DELETE /exceptions/:id` | Cancel exception | ✅ EXISTS |

### Existing Features:

```
✅ Worker submits exception with dates
✅ TL sees pending requests
✅ TL approves/rejects
✅ TL can END EARLY (update endDate)
✅ TL can UPDATE dates
✅ Notifications sent to worker
✅ System logs created
✅ Attendance = EXCUSED when approved
✅ Linked to incidents (optional)
```

---

## CURRENT EXCEPTION FLOW (How It Works Now)

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT FLOW: Worker Sets Dates                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Worker decides to request leave                             │
│                                                                 │
│  2. Worker submits exception:                                   │
│     POST /exceptions                                            │
│     {                                                           │
│       type: "FAMILY_EMERGENCY",                                 │
│       reason: "Parent hospitalized",                            │
│       startDate: "2026-01-05",  ← WORKER sets                  │
│       endDate: "2026-01-07"     ← WORKER sets                  │
│     }                                                           │
│                                                                 │
│  3. TL sees pending request                                     │
│     - Sees dates worker requested                               │
│     - Sees reason                                               │
│                                                                 │
│  4. TL makes decision:                                          │
│     ├─→ APPROVE (accepts worker's dates)                       │
│     ├─→ REJECT                                                  │
│     └─→ Or UPDATE dates before approving                       │
│                                                                 │
│  5. If approved:                                                │
│     - Worker on leave from startDate to endDate                │
│     - Attendance = EXCUSED                                      │
│     - No check-in required during leave                         │
│                                                                 │
│  6. TL can END EARLY if needed:                                │
│     PATCH /exceptions/:id/end-early                            │
│     - Updates endDate to today/yesterday                        │
│     - Worker resumes check-in                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## YOUR EXEMPTION IDEA (New Feature)

### Key Differences:

| Aspect | Current Exception | Your Exemption Idea |
|--------|-------------------|---------------------|
| **Trigger** | Worker plans ahead | CRITICAL check-in score |
| **Who sets dates?** | Worker | **TL sets dates** |
| **Worker submits** | reason + dates | reason only (no dates) |
| **TL action** | Approve/Reject | Approve + **SET return date** |
| **Entry point** | Worker initiates anytime | After CRITICAL check-in |

### Exemption Flow (Your Idea):

```
┌─────────────────────────────────────────────────────────────────┐
│  NEW FLOW: TL Sets Dates (Triggered by CRITICAL)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Worker checks in                                            │
│     - Mood: 3, Stress: 8, Sleep: 4, Physical: 3                │
│     - Score calculated: 35 (CRITICAL)                          │
│                                                                 │
│  2. System prompts worker:                                      │
│     ┌─────────────────────────────────────────────┐            │
│     │ Your score is CRITICAL (35)                 │            │
│     │                                             │            │
│     │ Do you need an exemption?                   │            │
│     │                                             │            │
│     │ Reason: [Family emergency - parent sick]   │            │
│     │                                             │            │
│     │ [Submit Check-in Only] [Request Exemption] │            │
│     └─────────────────────────────────────────────┘            │
│                                                                 │
│  3. Worker clicks "Request Exemption"                          │
│     POST /exemptions (or /exceptions/from-checkin)             │
│     {                                                           │
│       type: "FAMILY_EMERGENCY",                                 │
│       reason: "Parent hospitalized",                            │
│       checkinId: "xxx"   ← Links to CRITICAL check-in          │
│       // NO startDate, endDate - TL will set                   │
│     }                                                           │
│                                                                 │
│  4. TL sees pending exemption request:                         │
│     ┌─────────────────────────────────────────────┐            │
│     │ PENDING EXEMPTION REQUEST                   │            │
│     │                                             │            │
│     │ Worker: Ricardo Gomez                       │            │
│     │ Check-in Score: 35 (CRITICAL)              │            │
│     │ Type: Family Emergency                      │            │
│     │ Reason: "Parent hospitalized"               │            │
│     │ Requested: 10 minutes ago                   │            │
│     │                                             │            │
│     │ [View Check-in Details]                     │            │
│     └─────────────────────────────────────────────┘            │
│                                                                 │
│  5. TL approves AND sets return date:                          │
│     ┌─────────────────────────────────────────────┐            │
│     │ APPROVE EXEMPTION                           │            │
│     │                                             │            │
│     │ Worker: Ricardo Gomez                       │            │
│     │ Reason: Family emergency                    │            │
│     │                                             │            │
│     │ Return to work: [Jan 8, 2026] ← TL SETS    │            │
│     │                                             │
│     │ Notes: "Take care, see you Monday"          │            │
│     │                                             │            │
│     │ [Cancel] [Approve Exemption]                │            │
│     └─────────────────────────────────────────────┘            │
│                                                                 │
│     PATCH /exemptions/:id/approve                              │
│     {                                                           │
│       endDate: "2026-01-07",  ← TL sets return date            │
│       notes: "Take care"                                        │
│     }                                                           │
│                                                                 │
│  6. System creates Exception record:                           │
│     - startDate: Today (auto)                                   │
│     - endDate: Jan 7 (TL set)                                  │
│     - status: APPROVED                                          │
│     - triggeredByCheckinId: "xxx" (new field)                  │
│                                                                 │
│  7. Jan 5-7: Worker on leave                                   │
│     - No check-in required                                      │
│     - Attendance = EXCUSED                                      │
│                                                                 │
│  8. Jan 8: Exemption ends                                      │
│     - Worker must check-in again                                │
│                                                                 │
│  9. TL can END EARLY anytime (existing feature!)               │
│     PATCH /exceptions/:id/end-early                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## SIDE-BY-SIDE: Current vs. Your Idea

### Worker Experience:

```
CURRENT EXCEPTION:
──────────────────────────────────────────────────────────────────
Worker: "I need leave next week"
Worker: Opens exception form
Worker: Fills in reason + startDate + endDate
Worker: Submits
TL: Approves or Rejects
──────────────────────────────────────────────────────────────────

YOUR EXEMPTION IDEA:
──────────────────────────────────────────────────────────────────
Worker: Checks in → Score is CRITICAL
System: "Need exemption?"
Worker: "Yes, family emergency" (no dates)
TL: Sees request + SETS return date + Approves
──────────────────────────────────────────────────────────────────
```

### TL Experience:

```
CURRENT EXCEPTION:
──────────────────────────────────────────────────────────────────
TL sees: "Ricardo wants leave Jan 5-7 for family emergency"
TL decides: Approve (accept dates) or Reject
──────────────────────────────────────────────────────────────────

YOUR EXEMPTION IDEA:
──────────────────────────────────────────────────────────────────
TL sees: "Ricardo checked in CRITICAL, needs exemption"
TL sees: Check-in score: 35, Reason: family emergency
TL decides: When should Ricardo return? → Sets Jan 8
TL approves with return date
──────────────────────────────────────────────────────────────────
```

---

## WHAT NEEDS TO BE BUILT (Small Changes)

### 1. Database Change (Optional)

```prisma
// Add to Exception model to track exemption source
model Exception {
  // ... existing fields ...

  // NEW: Track if triggered by CRITICAL check-in
  triggeredByCheckinId  String?  @unique
  triggeredByCheckin    Checkin? @relation(fields: [triggeredByCheckinId], references: [id])
}
```

### 2. New API Endpoint (Exemption Request)

```typescript
// POST /exemptions (or /exceptions/from-checkin)
// Worker requests exemption WITHOUT dates

Request:
{
  type: "FAMILY_EMERGENCY",
  reason: "Parent hospitalized",
  checkinId: "xxx"  // Required - must be CRITICAL check-in
}

Response:
{
  id: "exception-123",
  type: "FAMILY_EMERGENCY",
  reason: "Parent hospitalized",
  status: "PENDING",
  startDate: null,      // Not set yet
  endDate: null,        // TL will set
  triggeredByCheckinId: "xxx"
}
```

### 3. Modified Approve Endpoint (TL Sets Dates)

```typescript
// PATCH /exemptions/:id/approve
// TL approves AND sets return date

Request:
{
  endDate: "2026-01-07",  // REQUIRED for exemptions
  notes: "Take care, see you Monday"
}

Logic:
- startDate = today (auto)
- endDate = from TL input
- status = APPROVED
- Create attendance EXCUSED records
- Notify worker
```

### 4. Frontend Changes

```
Worker Check-in Page:
- After CRITICAL score → Show "Request Exemption" option
- Exemption form: reason only (no dates)

TL Approvals Page:
- Show pending exemptions with check-in details
- Approve modal: TL inputs return date
- Can still use "End Early" button
```

---

## UI MOCKUPS

### Worker: After CRITICAL Check-in

```
┌─────────────────────────────────────────────────────────────────┐
│  CHECK-IN RESULT                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your readiness score: 35                                       │
│  Status: 🔴 CRITICAL                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚠️ Your score is critical today.                           ││
│  │                                                             ││
│  │ If you need time off, you can request an exemption.        ││
│  │ Your Team Leader will review and set your return date.     ││
│  │                                                             ││
│  │ [Request Exemption]                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Done - Continue to Dashboard]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Worker: Exemption Request Form

```
┌─────────────────────────────────────────────────────────────────┐
│  REQUEST EXEMPTION                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your check-in score: 35 (CRITICAL)                            │
│                                                                 │
│  Type: [Dropdown]                                               │
│    ○ Sick Leave                                                │
│    ○ Personal Leave                                             │
│    ○ Medical Appointment                                        │
│    ● Family Emergency                                           │
│    ○ Other                                                      │
│                                                                 │
│  Reason:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ My parent was hospitalized this morning. I need to         ││
│  │ take care of them.                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Note: Your Team Leader will set your return date when         │
│  approving this request.                                        │
│                                                                 │
│  [Cancel] [Submit Request]                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TL: Pending Exemption Request

```
┌─────────────────────────────────────────────────────────────────┐
│  PENDING EXEMPTIONS                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔴 Ricardo Gomez                         Requested 10m ago ││
│  │                                                             ││
│  │ Type: Family Emergency                                      ││
│  │ Reason: "My parent was hospitalized this morning"          ││
│  │                                                             ││
│  │ Check-in Details:                                           ││
│  │ ├─ Score: 35 (CRITICAL)                                    ││
│  │ ├─ Mood: 3/10                                              ││
│  │ ├─ Stress: 8/10                                            ││
│  │ ├─ Sleep: 4/10                                             ││
│  │ └─ Physical: 3/10                                          ││
│  │                                                             ││
│  │ [Approve] [Reject]                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TL: Approve Exemption Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  APPROVE EXEMPTION                                         [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Worker: Ricardo Gomez                                          │
│  Type: Family Emergency                                         │
│  Reason: "My parent was hospitalized"                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Exemption starts: January 5, 2026 (Today)                     │
│                                                                 │
│  Return to work date:                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [January 8, 2026]  📅                    ← TL SETS THIS    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Quick options:                                                 │
│  [Tomorrow] [In 3 days] [In 1 week]                            │
│                                                                 │
│  Notes (optional):                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Take care of your parent. See you Monday.                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Summary:                                                       │
│  • Ricardo will be on leave: Jan 5-7 (3 days)                  │
│  • Expected return: Jan 8, 2026                                 │
│  • Attendance will be marked as EXCUSED                        │
│                                                                 │
│  [Cancel] [Approve Exemption]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TL: Active Exemptions (Can End Early)

```
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVE EXEMPTIONS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Ricardo Gomez                                               ││
│  │                                                             ││
│  │ Type: Family Emergency                                      ││
│  │ Period: Jan 5-7, 2026                                       ││
│  │ Returns: Jan 8, 2026                                        ││
│  │ Status: 🟢 ACTIVE                                           ││
│  │                                                             ││
│  │ Days remaining: 2                                           ││
│  │                                                             ││
│  │ [View Details] [End Early]  ← EXISTING FEATURE!            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## TABS STRUCTURE (TL Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  TEAM MANAGEMENT                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Check-ins] [Leave Requests] [Exemptions] [Incidents]         │
│              ↑                 ↑                                │
│              │                 │                                │
│              │                 └─ NEW TAB: From CRITICAL scores │
│              │                                                  │
│              └─ Existing: Worker-initiated with dates           │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  LEAVE REQUESTS (Existing)                                      │
│  • Worker sets dates                                            │
│  • Planned absences                                             │
│  • TL approves/rejects                                          │
│                                                                 │
│  EXEMPTIONS (New)                                               │
│  • Triggered by CRITICAL check-in                               │
│  • Worker provides reason only                                  │
│  • TL sets return date                                          │
│  • Same result: Leave with EXCUSED attendance                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION SUMMARY

### Already Built (No Changes Needed):

```
✅ Exception model
✅ Exception status (PENDING, APPROVED, REJECTED)
✅ Approve/Reject endpoints
✅ End Early endpoint
✅ Update dates
✅ Notifications
✅ System logs
✅ Attendance = EXCUSED
```

### To Build (Small Additions):

```
Backend:
□ Add triggeredByCheckinId field to Exception model
□ New endpoint: POST /exemptions (reason only, no dates)
□ Modify approve logic for exemptions (TL sets dates)

Frontend:
□ Worker: "Request Exemption" after CRITICAL check-in
□ Worker: Exemption form (reason only)
□ TL: Exemptions tab (or combined with Leave Requests)
□ TL: Approve modal with date picker
```

### Implementation Phases:

**Phase 1: Backend**
- [ ] Add `triggeredByCheckinId` to Exception model
- [ ] Create `POST /exemptions` endpoint
- [ ] Create `PATCH /exemptions/:id/approve` with date setting
- [ ] Add validation (must be CRITICAL check-in)

**Phase 2: Worker Frontend**
- [ ] Show "Request Exemption" after CRITICAL check-in
- [ ] Exemption request form (reason only)
- [ ] Pending exemption status view

**Phase 3: TL Frontend**
- [ ] Pending exemptions list with check-in details
- [ ] Approve modal with return date picker
- [ ] Active exemptions view with "End Early" button
- [ ] Optional: Separate Exemptions tab

---

## SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  CURRENT: Worker sets dates → TL approves/rejects              │
│                                                                 │
│  YOUR IDEA: CRITICAL check-in → Worker requests (no dates) →  │
│             TL approves AND sets return date                    │
│                                                                 │
│  RESULT: Same - Worker on leave, Attendance = EXCUSED          │
│                                                                 │
│  BENEFIT:                                                       │
│  • TL has control over leave duration                          │
│  • Linked to CRITICAL check-in (auditable)                     │
│  • Worker doesn't need to guess dates                           │
│  • TL can still end early (existing feature)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document updated: January 5, 2026*
*For Aegira Personnel Readiness Management System*
