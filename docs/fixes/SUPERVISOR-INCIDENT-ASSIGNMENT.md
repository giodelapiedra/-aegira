# Supervisor Incident Assignment to WHS

## Summary
Supervisor sees TL-approved incidents in a table and assigns them to specific WHS officers.

---

## Current Flow
```
Worker Reports → Exception PENDING → TL Approves → APPROVED (done)
```

## New Flow
```
Worker Reports → Exception PENDING → TL Approves → APPROVED
                                                      ↓
                              Supervisor sees in "Pending Assignment" list
                                                      ↓
                              Supervisor assigns to WHS Officer
                                                      ↓
                              WHS Officer handles case
```

---

## Database Changes (Minimal)

### Add to Incident model in schema.prisma:

```prisma
model Incident {
  // ... existing fields ...

  // Supervisor Assignment to WHS (NEW - 4 fields only)
  whsAssignedTo       String?      // WHS officer user ID
  whsAssignedAt       DateTime?    // When assigned
  whsAssignedBy       String?      // Supervisor who assigned
  whsAssignedNote     String?      // Optional note

  // Relations
  whsOfficer          User?        @relation("WHSHandler", fields: [whsAssignedTo], references: [id])
  whsAssigner         User?        @relation("WHSAssigner", fields: [whsAssignedBy], references: [id])

  // Index for supervisor query
  @@index([whsAssignedTo])
}
```

### Update User model (add relations):

```prisma
model User {
  // ... existing relations ...
  whsAssignedIncidents   Incident[]   @relation("WHSHandler")
  whsAssignedByIncidents Incident[]   @relation("WHSAssigner")
}
```

---

## Backend Changes

### 1. New Endpoint: GET /incidents/supervisor-pending

**Purpose:** Get TL-approved incidents not yet assigned to WHS

**Query (Optimized):**
```typescript
// Only get incidents where:
// 1. Exception is APPROVED (TL approved)
// 2. whsAssignedTo is null (not yet assigned)

const incidents = await prisma.incident.findMany({
  where: {
    companyId,
    exception: {
      status: 'APPROVED',  // TL approved
    },
    whsAssignedTo: null,   // Not yet assigned to WHS
  },
  select: {
    id: true,
    caseNumber: true,
    type: true,
    severity: true,
    createdAt: true,
    reporter: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        team: { select: { name: true } },
      },
    },
    exception: {
      select: {
        status: true,
        approvedAt: true,
        reviewedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    },
  },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
});
```

**Why this is efficient:**
- Uses index on `companyId`, `whsAssignedTo`
- Uses `select` instead of `include` (only needed fields)
- Pagination with `take/skip`
- No nested N+1 queries

### 2. New Endpoint: GET /incidents/supervisor-assigned

**Purpose:** Get incidents already assigned to WHS (for "Assigned" tab)

```typescript
const incidents = await prisma.incident.findMany({
  where: {
    companyId,
    whsAssignedTo: { not: null },  // Assigned to someone
  },
  select: {
    // ... same fields as above
    whsOfficer: {
      select: { id: true, firstName: true, lastName: true },
    },
    whsAssignedAt: true,
  },
  orderBy: { whsAssignedAt: 'desc' },
});
```

### 3. New Endpoint: PATCH /incidents/:id/assign-whs

**Purpose:** Supervisor assigns incident to WHS officer

```typescript
// Only SUPERVISOR, EXECUTIVE, ADMIN can access
incidentsRoutes.patch('/:id/assign-whs', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const supervisorId = c.get('userId');
  const { whsOfficerId, note } = await c.req.json();

  // Verify WHS officer exists and has WHS_CONTROL role
  const whsOfficer = await prisma.user.findFirst({
    where: {
      id: whsOfficerId,
      companyId,
      role: 'WHS_CONTROL',
      isActive: true,
    },
  });

  if (!whsOfficer) {
    return c.json({ error: 'Invalid WHS officer' }, 400);
  }

  // Update incident
  const incident = await prisma.incident.update({
    where: { id },
    data: {
      whsAssignedTo: whsOfficerId,
      whsAssignedAt: new Date(),
      whsAssignedBy: supervisorId,
      whsAssignedNote: note || null,
      status: 'IN_PROGRESS',  // Auto-update status
    },
  });

  // Create activity
  await prisma.incidentActivity.create({
    data: {
      incidentId: id,
      userId: supervisorId,
      type: 'ASSIGNED',
      newValue: `${whsOfficer.firstName} ${whsOfficer.lastName} (WHS)`,
      comment: note || 'Assigned to WHS officer',
    },
  });

  // Notify WHS officer
  await prisma.notification.create({
    data: {
      userId: whsOfficerId,
      companyId,
      title: 'New Incident Assigned',
      message: `You have been assigned to handle incident ${incident.caseNumber}`,
      type: 'INCIDENT_ASSIGNED',
      data: { incidentId: id },
    },
  });

  return c.json(incident);
});
```

### 4. New Endpoint: GET /users/whs-officers

**Purpose:** Get list of WHS officers for dropdown

```typescript
const whsOfficers = await prisma.user.findMany({
  where: {
    companyId,
    role: 'WHS_CONTROL',
    isActive: true,
  },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    avatar: true,
  },
  orderBy: { firstName: 'asc' },
});
```

---

## Frontend Changes

### 1. New Page: supervisor/incidents-assignment.page.tsx

**Location:** `frontend/src/pages/supervisor/incidents-assignment.page.tsx`

**Features:**
- Table with columns: Case #, Worker, Team, Type, Severity, TL Approved By, Date, Assigned To, Action
- Tabs: Pending | Assigned | All
- Inline dropdown to select WHS officer
- Click row to view details (modal or navigate)

**Component Structure:**
```tsx
export function IncidentsAssignmentPage() {
  const [tab, setTab] = useState<'pending' | 'assigned' | 'all'>('pending');
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);

  // Fetch pending incidents
  const { data: pendingData } = useQuery({
    queryKey: ['incidents', 'supervisor-pending'],
    queryFn: () => incidentService.getSupervisorPending(),
    enabled: tab === 'pending',
  });

  // Fetch WHS officers for dropdown
  const { data: whsOfficers } = useQuery({
    queryKey: ['users', 'whs-officers'],
    queryFn: () => userService.getWHSOfficers(),
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: ({ incidentId, whsOfficerId }) =>
      incidentService.assignToWHS(incidentId, whsOfficerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  return (
    <div>
      {/* Tabs */}
      {/* Table */}
      {/* Each row has dropdown to assign */}
    </div>
  );
}
```

### 2. Update incident.service.ts

Add methods:
```typescript
// Get incidents pending supervisor assignment
async getSupervisorPending(params?) {
  const response = await api.get('/incidents/supervisor-pending', { params });
  return response.data;
}

// Get incidents assigned to WHS
async getSupervisorAssigned(params?) {
  const response = await api.get('/incidents/supervisor-assigned', { params });
  return response.data;
}

// Assign to WHS
async assignToWHS(incidentId: string, whsOfficerId: string, note?: string) {
  const response = await api.patch(`/incidents/${incidentId}/assign-whs`, {
    whsOfficerId,
    note,
  });
  return response.data;
}
```

### 3. Update user.service.ts

Add method:
```typescript
async getWHSOfficers() {
  const response = await api.get('/users/whs-officers');
  return response.data;
}
```

### 4. Update incident-detail.page.tsx

Add section to show WHS assignment info:
```tsx
{incident.whsOfficer && (
  <div>
    <h4>WHS Assignment</h4>
    <p>Assigned to: {incident.whsOfficer.firstName} {incident.whsOfficer.lastName}</p>
    <p>Assigned by: {incident.whsAssigner?.firstName} on {formatDate(incident.whsAssignedAt)}</p>
  </div>
)}
```

### 5. Add Navigation

In `navigation.ts`, add for SUPERVISOR role:
```typescript
{
  label: 'Incident Assignment',
  path: '/supervisor/incidents-assignment',
  icon: ClipboardList,
}
```

### 6. Add Route

In `router.tsx`:
```typescript
{
  path: 'incidents-assignment',
  element: <IncidentsAssignmentPage />,
}
```

---

## Query Performance Checklist

| Query | Optimization | Index Needed |
|-------|-------------|--------------|
| Get pending incidents | `select` specific fields, pagination | `@@index([companyId, whsAssignedTo])` |
| Get assigned incidents | `select` specific fields, pagination | `@@index([whsAssignedTo])` |
| Get WHS officers | Filter by role + company | Existing `@@index([companyId])` |
| Assign to WHS | Single update | Primary key |

---

## Files to Create/Modify

### Backend (4 files)
1. `prisma/schema.prisma` - Add 4 fields + 2 relations + 1 index
2. `src/modules/incidents/index.ts` - Add 3 endpoints
3. `src/modules/companies/index.ts` - Add WHS officers endpoint (or users module)

### Frontend (5 files)
1. `src/pages/supervisor/incidents-assignment.page.tsx` - NEW
2. `src/services/incident.service.ts` - Add 3 methods
3. `src/services/user.service.ts` - Add 1 method
4. `src/pages/incidents/incident-detail.page.tsx` - Add WHS info section
5. `src/config/navigation.ts` - Add nav item
6. `src/app/router.tsx` - Add route

---

## Implementation Order

1. **Schema** - Add fields, run migration
2. **Backend endpoints** - 3 new endpoints
3. **Frontend service** - Add API methods
4. **Frontend page** - Create table page
5. **Integration** - Wire up, test
6. **Polish** - Add to navigation, update detail page

---

## What We're NOT Doing (Avoiding Over-Engineering)

- ❌ No new database tables (just 4 fields on existing Incident)
- ❌ No complex status enum changes
- ❌ No multi-level approval queue
- ❌ No websocket real-time updates
- ❌ No email notifications (just in-app)
- ❌ No bulk operations (keep simple)
- ❌ No drag-and-drop board view (table only)

---

## Estimated Changes

| Area | Lines of Code |
|------|---------------|
| Schema | ~15 lines |
| Backend endpoints | ~150 lines |
| Frontend service | ~30 lines |
| Frontend page | ~300 lines |
| Other updates | ~50 lines |
| **Total** | **~550 lines** |

---

## MISSING ITEMS (Double-Check)

### 1. Frontend Types Update
**File:** `frontend/src/types/user.ts`

Add to `Incident` interface:
```typescript
// WHS Assignment fields
whsAssignedTo?: string;
whsAssignedAt?: string;
whsAssignedBy?: string;
whsAssignedNote?: string;
whsOfficer?: {
  id: string;
  firstName: string;
  lastName: string;
};
whsAssigner?: {
  id: string;
  firstName: string;
  lastName: string;
};
```

### 2. Notification to Supervisor when TL Approves
**File:** `backend/src/modules/exceptions/index.ts`

In the `PATCH /exceptions/:id/approve` endpoint, add notification to Supervisors:
```typescript
// After TL approves exception linked to incident, notify supervisors
if (existing.linkedIncidentId) {
  // Get all active supervisors in the company
  const supervisors = await prisma.user.findMany({
    where: {
      companyId,
      role: 'SUPERVISOR',
      isActive: true,
    },
    select: { id: true },
  });

  // Create notifications for each supervisor
  await prisma.notification.createMany({
    data: supervisors.map(sup => ({
      userId: sup.id,
      companyId,
      title: 'Incident Pending WHS Assignment',
      message: `Incident ${incident.caseNumber} approved by TL. Please assign to WHS officer.`,
      type: 'INCIDENT_PENDING_ASSIGNMENT',
      data: { incidentId: existing.linkedIncidentId },
    })),
  });
}
```

### 3. WHS Officer's Assigned Incidents Page
**File:** `frontend/src/pages/whs/my-incidents.page.tsx` (NEW)

WHS officer needs to see incidents assigned to them:
```typescript
// Query: Get incidents where whsAssignedTo = currentUserId
const { data } = useQuery({
  queryKey: ['incidents', 'my-whs-assignments'],
  queryFn: () => incidentService.getMyWHSAssignments(),
});
```

**Backend endpoint:** `GET /incidents/my-whs-assignments`
```typescript
incidentsRoutes.get('/my-whs-assignments', async (c) => {
  const userId = c.get('userId');
  const companyId = c.get('companyId');

  const incidents = await prisma.incident.findMany({
    where: {
      companyId,
      whsAssignedTo: userId,
    },
    select: { /* fields */ },
    orderBy: { whsAssignedAt: 'desc' },
  });

  return c.json(incidents);
});
```

### 4. Update Navigation for WHS Role
**File:** `frontend/src/config/navigation.ts`

Add to `whsControlSections`:
```typescript
{
  id: 'my-incidents',
  label: 'My Assigned Incidents',
  href: '/whs/my-incidents',
  icon: AlertTriangle,
},
```

### 5. Update Router for WHS Page
**File:** `frontend/src/app/router.tsx`

Add route:
```typescript
{
  path: 'whs/my-incidents',
  element: (
    <RoleGuard allowedRoles={['WHS_CONTROL']}>
      <LazyPage><WHSMyIncidentsPage /></LazyPage>
    </RoleGuard>
  ),
},
```

### 6. User Service Method
**File:** `frontend/src/services/user.service.ts`

Add method:
```typescript
async getWHSOfficers(): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'avatar'>[]> {
  const response = await api.get('/users/whs-officers');
  return response.data;
}
```

### 7. Backend: Users Module Endpoint
**File:** `backend/src/modules/companies/index.ts` (or users module)

Add endpoint:
```typescript
// GET /users/whs-officers - Get list of WHS officers for assignment dropdown
companiesRoutes.get('/users/whs-officers', async (c) => {
  const companyId = c.get('companyId');

  const officers = await prisma.user.findMany({
    where: {
      companyId,
      role: 'WHS_CONTROL',
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
    },
    orderBy: { firstName: 'asc' },
  });

  return c.json(officers);
});
```

---

## Updated Files Summary

### Backend (5 files)
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 4 fields + 2 relations + 1 index |
| `src/modules/incidents/index.ts` | Add 4 endpoints (supervisor-pending, supervisor-assigned, assign-whs, my-whs-assignments) |
| `src/modules/exceptions/index.ts` | Add supervisor notification on TL approve |
| `src/modules/companies/index.ts` | Add GET /users/whs-officers endpoint |
| Run `npx prisma db push` | Apply schema changes |

### Frontend (8 files)
| File | Changes |
|------|---------|
| `src/types/user.ts` | Add WHS fields to Incident interface |
| `src/services/incident.service.ts` | Add 4 methods |
| `src/services/user.service.ts` | Add getWHSOfficers method |
| `src/pages/supervisor/incidents-assignment.page.tsx` | NEW - Main table page |
| `src/pages/whs/my-incidents.page.tsx` | NEW - WHS assigned incidents |
| `src/pages/incidents/incident-detail.page.tsx` | Add WHS assignment info section |
| `src/config/navigation.ts` | Add nav items for Supervisor + WHS |
| `src/app/router.tsx` | Add 2 routes |

---

## Implementation Checklist

### Phase 1: Database
- [x] Add fields to Incident model in schema.prisma
- [x] Add User relations for WHS
- [x] Add index for whsAssignedTo
- [ ] Run migration (`npx prisma db push`)

### Phase 2: Backend Endpoints
- [x] GET /supervisor/incidents/pending
- [x] GET /supervisor/incidents/assigned
- [x] PATCH /supervisor/incidents/:id/assign-whs
- [x] GET /whs/my-incidents
- [x] GET /supervisor/whs-officers
- [x] Update TL approve to notify Supervisor

### Phase 3: Frontend Types & Services
- [x] Update Incident type
- [x] Add supervisor service
- [x] Add WHS service method

### Phase 4: Frontend Pages
- [x] Create supervisor incidents-assignment page
- [x] Create WHS my-incidents page
- [x] Update incident-detail page

### Phase 5: Navigation & Routing
- [x] Add Supervisor nav item
- [x] Add WHS nav item
- [x] Add routes in router.tsx

### Phase 6: Testing
- [ ] Test TL approve → Supervisor notification
- [ ] Test Supervisor assign to WHS
- [ ] Test WHS sees assigned incidents
- [ ] Test incident detail shows WHS info
