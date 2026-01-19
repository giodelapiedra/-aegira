# Unification TODO: Cases System Refactoring

> Goal: Unify Incident Reports and Exception Requests into a single "Cases" system where every leave request requires proper documentation (case details).

## Summary

Currently, the system has:
- **Worker side**: Separate pages for reporting incidents (`/report-incident`) and requesting leave (`/request-exception`)
- **Team Leader side**: Separate pages for managing incidents (`/team/incidents`) and approving leave (`/team/approvals`)

After unification:
- **Worker side**: Single page for submitting cases (incidents and/or leave requests with case details)
- **Team Leader side**: Single page for managing all cases with full case details

---

## Phase 1: Database Schema Changes

### 1.1 Update Exception Model to Include Case Details

The Exception model needs to have the same detailed fields as Incident:

```prisma
model Exception {
  id              String    @id @default(uuid())

  // Existing fields
  userId          String
  type            ExceptionType
  status          ExceptionStatus @default(PENDING)
  reason          String?    // Keep as optional, case detail replaces this
  startDate       DateTime
  endDate         DateTime?

  // NEW: Case detail fields (same as Incident)
  caseNumber      String?    @unique  // Auto-generated like INC-XXXX
  title           String?             // Brief summary
  description     String?             // Detailed description
  severity        Severity?           // LOW, MEDIUM, HIGH, CRITICAL
  incidentType    IncidentType?       // For leave: map to ILLNESS, INJURY, etc.
  location        String?

  // Link to existing incident (optional - for backwards compat)
  linkedIncidentId String?
  linkedIncident   Incident?  @relation(fields: [linkedIncidentId], references: [id])

  // ... rest of existing fields
}
```

### Files to Modify:
- [ ] `backend/prisma/schema.prisma` - Add case detail fields to Exception model

---

## Phase 2: Backend API Updates

### 2.1 Update Exception Endpoints

- [ ] `backend/src/modules/exceptions/index.ts`
  - Update `POST /` to accept case detail fields (title, description, severity, etc.)
  - Auto-generate caseNumber like "LV-XXXXX" or "EXC-XXXXX"
  - Make case details required for new submissions

### 2.2 Update Exception Service/Utils

- [ ] Create case number generator for exceptions (similar to incident case numbers)
- [ ] Update validation schemas to require case details

### 2.3 Consider: Unified Cases Endpoint (Optional)

Could create a new unified endpoint:
- [ ] `backend/src/modules/cases/index.ts` - Unified cases API that queries both Incident and Exception

---

## Phase 3: Frontend - Worker Pages

### 3.1 Enhance Report Incident Page

Update `/report-incident` to handle both incidents and leave requests:

**File:** `frontend/src/pages/worker/report-incident.page.tsx`

Changes needed:
- [ ] Add "Request Type" selector: "Report Incident" vs "Request Leave"
- [ ] When "Request Leave" is selected:
  - Show Leave Type dropdown (Sick Leave, Personal Leave, etc.)
  - Show Start Date and End Date (Return to Work Date) fields
  - Keep case detail fields (title, description, severity, etc.)
- [ ] Keep all existing incident fields for "Report Incident" mode
- [ ] Unified form submission that creates the appropriate record

### 3.2 Remove Request Exception Page

**Files to DELETE:**
- [ ] `frontend/src/pages/worker/request-exception.page.tsx`
- [ ] Update `frontend/src/app/router.tsx` - Remove `/request-exception` route
- [ ] Update `frontend/src/config/navigation.ts` - Remove "Request Exception" nav item

### 3.3 Update Worker Navigation

**File:** `frontend/src/config/navigation.ts`

- [ ] Remove "Request Exception" menu item
- [ ] Rename "Report Incident" to "Submit Case" or similar

---

## Phase 4: Frontend - Team Leader Pages

### 4.1 Create Unified Cases Page

**NEW File:** `frontend/src/pages/team-leader/team-cases.page.tsx`

This page should combine functionality from both:
- `team-incidents.page.tsx` - Incident management with approve/reject
- `approvals.page.tsx` - Exception approval with approve/reject/end early/cancel

Features:
- [ ] Single table showing all cases (incidents + exceptions)
- [ ] Columns: Case Number, Reporter, Type, Severity, Status, Leave Status, Date
- [ ] Filter by: Case Type (Incident/Leave), Status, Severity, Leave Status
- [ ] Search across all fields
- [ ] Row actions via three-dot menu:
  - View Details
  - Approve Leave (if pending)
  - Reject Leave (if pending)
  - End Early (if approved and active)
  - Cancel (if approved)
  - Update Incident Status (if incident)
- [ ] Detailed case modal showing full case information
- [ ] Stats cards showing counts

### 4.2 Remove Separate Pages

**Files to DELETE:**
- [ ] `frontend/src/pages/team-leader/approvals.page.tsx`
- [ ] Possibly consolidate with `team-incidents.page.tsx` or keep both but redirect

### 4.3 Update Routes and Navigation

**File:** `frontend/src/app/router.tsx`
- [ ] Remove `/team/approvals` route (or redirect to `/team/cases`)
- [ ] Add `/team/cases` route
- [ ] Consider keeping `/team/incidents` as alias/redirect

**File:** `frontend/src/config/navigation.ts`
- [ ] Replace "Team Incidents" and "Approvals" with single "Cases" menu item

---

## Phase 5: Create Exception Detail Page

### 5.1 New Exception Detail Page

**NEW File:** `frontend/src/pages/exceptions/exception-detail.page.tsx`

Similar to `frontend/src/pages/incidents/incident-detail.page.tsx`:
- [ ] Full case details display
- [ ] Timeline/activity log
- [ ] Approval actions (approve, reject, end early, cancel)
- [ ] Edit capability for TL
- [ ] Print view

### 5.2 Update Routes

**File:** `frontend/src/app/router.tsx`
- [ ] Add `/exceptions/:id` route

---

## Phase 6: Service Layer Updates

### 6.1 Update Exception Service

**File:** `frontend/src/services/exception.service.ts`

- [ ] Add new fields to `CreateExceptionData` interface (title, description, severity, etc.)
- [ ] Update `getById` to return full case details
- [ ] Consider: Add unified cases service

### 6.2 Consider: Unified Cases Service (Optional)

**NEW File:** `frontend/src/services/cases.service.ts`
- [ ] `getAll()` - Returns combined incidents + exceptions
- [ ] `getStats()` - Combined stats

---

## Phase 7: Type Updates

### 7.1 Update Exception Types

**File:** `frontend/src/types/user.ts` (or appropriate types file)

- [ ] Add case detail fields to Exception interface:
  ```typescript
  interface Exception {
    // ... existing fields
    caseNumber?: string;
    title?: string;
    description?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    incidentType?: IncidentType;
    location?: string;
  }
  ```

---

## Phase 8: Cleanup

### 8.1 Files to Delete

Frontend:
- [ ] `frontend/src/pages/worker/request-exception.page.tsx`
- [ ] `frontend/src/pages/team-leader/approvals.page.tsx` (after migration)

### 8.2 Files That Reference Removed Pages (MUST UPDATE)

These files have direct references to `/request-exception` or `/team/approvals`:

**Router:**
- [ ] `frontend/src/app/router.tsx`
  - Line 38: Remove `RequestExceptionPage` lazy import
  - Line 182: Remove `path: 'request-exception'` route

**Navigation:**
- [ ] `frontend/src/config/navigation.ts`
  - Line 92-94: Remove request-exception nav item (worker)
  - Line 234: Remove /team/approvals nav item (TL)
  - Line 561-563: Remove request-exception from mobile/other nav

**Header Titles:**
- [ ] `frontend/src/components/layout/Header.tsx`
  - Line 19: Remove `/request-exception` page title config
  - Line 24: Remove `/team/approvals` page title config

**Auth Redirect:**
- [ ] `frontend/src/hooks/useAuth.ts`
  - Line 33: Change redirect from `/team/approvals` to new unified page

**Notification Links:**
- [ ] `frontend/src/services/notification.service.ts`
  - Line 60: Change `/request-exception` link to new page
  - Line 62: Change `/team/approvals` link to new page

**Documentation Reference:**
- [ ] `frontend/src/components/worker/StatusConfig.ts`
  - Line 7: Update comment reference to request-exception.page.tsx

### 8.3 Exception Service Usage (Keep - Still Needed)

These files use `exceptionService` and should continue working:
- `frontend/src/pages/team-leader/approvals.page.tsx` (will be removed)
- `frontend/src/services/exception.service.ts` (KEEP - core service)
- `frontend/src/pages/incidents/incident-detail.page.tsx` (KEEP - uses for linked exceptions)
- `frontend/src/pages/worker/request-exception.page.tsx` (will be removed)

### 8.4 Unused Imports/Code to Clean

After migration, check for:
- [ ] Unused services
- [ ] Unused types
- [ ] Dead routes in router
- [ ] Dead navigation items

---

## Implementation Order

1. **Phase 1**: Database schema update (add case detail fields to Exception)
2. **Phase 2**: Backend API updates
3. **Phase 3.1**: Enhance report-incident page to handle leave requests
4. **Phase 6.1**: Update exception service with new fields
5. **Phase 7**: Update types
6. **Phase 5**: Create exception detail page
7. **Phase 4**: Create unified cases page for TL
8. **Phase 3.2-3.3**: Remove old worker pages and update nav
9. **Phase 4.2-4.3**: Remove old TL pages and update nav
10. **Phase 8**: Final cleanup

---

## UI/UX Notes

### Worker Report Page
- Keep the clean card-based type selection UI
- Add toggle or tab at top: "Report Incident" | "Request Leave"
- When "Request Leave" selected:
  - Show leave type options (Sick Leave, Personal Leave, etc.)
  - Show date range picker
  - Still require: Title, Description, Severity (documentation)

### Team Leader Cases Page
- Use clean table layout (like current approvals page)
- Filter dropdown pill for status filtering
- Three-dot menu for row actions
- Color-coded rows for pending leave requests
- Badge indicators for leave status

---

## Migration Considerations

- Existing exceptions without case details should still work (fields are optional)
- New submissions should require case details
- Consider migration script to populate caseNumber for existing exceptions
