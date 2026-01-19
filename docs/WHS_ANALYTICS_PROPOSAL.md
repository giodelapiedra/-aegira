# WHS Analytics Page Proposal

## Overview

Personalized analytics dashboard for WHS (Workplace Health and Safety) officers. Each WHS officer sees **only their assigned cases** for accurate workload tracking and performance metrics.

---

## How Data Gets Captured (Auto-Triggered Fields)

### Field Triggers

| Field | When Triggered | How | Code Location |
|-------|----------------|-----|---------------|
| `whsAssignedAt` | Supervisor assigns case to WHS | Auto-set to `NOW()` | When `whsAssignedTo` is set |
| `whsAssignedTo` | Supervisor assigns case to WHS | Set to WHS officer's userId | Manual action |
| `whsAssignedBy` | Supervisor assigns case to WHS | Set to supervisor's userId | Manual action |
| `resolvedAt` | Status → RESOLVED or CLOSED | Auto-set to `NOW()` | `incidents/index.ts:735-736` |

### Existing Code for resolvedAt (Already Implemented)

```typescript
// backend/src/modules/incidents/index.ts - Line 734-737
const updateData: any = { status: body.status };
if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
  updateData.resolvedAt = new Date();  // ← AUTO-TRIGGERED!
}
```

### Timeline Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INCIDENT LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Worker Reports    Supervisor Assigns    WHS Works      WHS Closes      │
│  Incident          to WHS Officer        on Case        the Case        │
│      │                   │                  │              │            │
│      ▼                   ▼                  ▼              ▼            │
│  ┌──────┐          ┌──────────┐        ┌────────┐    ┌────────┐        │
│  │CREATE│ ──────►  │ ASSIGN   │ ────►  │  WORK  │ ─► │ CLOSE  │        │
│  └──────┘          └──────────┘        └────────┘    └────────┘        │
│      │                   │                               │              │
│      ▼                   ▼                               ▼              │
│  createdAt          whsAssignedAt                   resolvedAt          │
│  = NOW()            = NOW()                         = NOW()             │
│                     whsAssignedTo = officer.id                          │
│                     whsAssignedBy = supervisor.id                       │
│                                                                         │
│                     ◄────── Resolution Time ──────►                     │
│                     (resolvedAt - whsAssignedAt)                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Resolution Time Calculation

```typescript
Resolution Time = resolvedAt - whsAssignedAt

// Example:
whsAssignedAt = Jan 10, 9:00 AM
resolvedAt    = Jan 15, 3:00 PM
Resolution Time = 5.25 days
```

**Important:** We use `whsAssignedAt` NOT `createdAt` because:
- `createdAt` = when incident was reported (before WHS involvement)
- `whsAssignedAt` = when WHS officer received the case (start of WHS work)

---

## Status Flow & Validation

### Current Status Flow

```
OPEN ──► IN_PROGRESS ──► RESOLVED ──► CLOSED
  │           │              │
  │           │              └── Can revert to IN_PROGRESS (if issue found)
  │           └── Can skip to RESOLVED/CLOSED directly
  └── Can skip to RESOLVED/CLOSED directly
```

### IMPORTANT: CLOSED = FINAL

Once a case is CLOSED, it should NOT be reopened.

**Current Status:** ⚠️ NO VALIDATION EXISTS - Need to add!

### Required Validation (To Be Added)

```typescript
// Add to incidents/index.ts BEFORE status update
if (existing.status === 'CLOSED') {
  return c.json({ error: 'Cannot reopen a closed incident' }, 400);
}

// Optional: Full status transition validation
const validTransitions: Record<string, string[]> = {
  'OPEN': ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  'IN_PROGRESS': ['OPEN', 'RESOLVED', 'CLOSED'],
  'RESOLVED': ['IN_PROGRESS', 'CLOSED'],
  'CLOSED': [], // ← FINAL - No transitions allowed
};

if (!validTransitions[existing.status]?.includes(body.status)) {
  return c.json({
    error: `Cannot change status from ${existing.status} to ${body.status}`
  }, 400);
}
```

---

## Data Scoping Rules

### Per-User Data Filtering

| Role | Data Scope | Filter |
|------|------------|--------|
| **WHS_CONTROL** | Own assigned cases only | `whsAssignedTo = currentUserId` |
| **SUPERVISOR** | All WHS-assigned cases | `whsAssignedTo IS NOT NULL` |
| **EXECUTIVE/ADMIN** | All WHS-assigned cases | `whsAssignedTo IS NOT NULL` |

### Base Query Pattern

```typescript
// For WHS Officer - sees only their cases
const getWhereClause = (user: User) => {
  const baseWhere = { companyId: user.companyId };

  if (user.role === 'WHS_CONTROL') {
    return { ...baseWhere, whsAssignedTo: user.id };
  }

  // Supervisor/Executive/Admin - sees all WHS cases
  return { ...baseWhere, whsAssignedTo: { not: null } };
};
```

---

## Database Schema (Existing - No Changes Needed)

### Incident Model Fields Used

```prisma
model Incident {
  // ... other fields ...

  // Status tracking
  status       IncidentStatus   @default(OPEN)  // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  resolvedAt   DateTime?                         // Auto-set when RESOLVED/CLOSED

  // WHS Assignment
  whsAssignedTo   String?   // WHS officer user ID
  whsAssignedAt   DateTime? // When assigned to WHS (auto-set)
  whsAssignedBy   String?   // Supervisor who assigned
  whsAssignedNote String?   // Optional note

  // Indexes (already exist)
  @@index([whsAssignedTo])
  @@index([companyId, whsAssignedTo])
  @@index([status])
  @@index([severity])
}
```

### Indexes (Already Exist - No Changes Needed)

```prisma
@@index([whsAssignedTo])              // ✅ For WHS officer queries
@@index([companyId, whsAssignedTo])   // ✅ Composite index
@@index([status])                     // ✅ For status filtering
@@index([severity])                   // ✅ For severity filtering
@@index([createdAt])                  // ✅ For date queries
```

---

## 1. Summary Metrics (Top Cards)

Quick-glance KPIs for each WHS officer's assigned cases:

| Metric | Description | Query |
|--------|-------------|-------|
| **My Total Cases** | All cases assigned to me | `COUNT WHERE whsAssignedTo = userId` |
| **Active Cases** | OPEN + IN_PROGRESS | `COUNT WHERE status IN ('OPEN', 'IN_PROGRESS')` |
| **Avg Resolution Time** | Days from assignment to closed | `AVG(resolvedAt - whsAssignedAt)` |
| **Critical/High Cases** | HIGH + CRITICAL severity | `COUNT WHERE severity IN ('HIGH', 'CRITICAL')` |
| **Pending RTW** | Resolved but no certificate | `COUNT WHERE status IN ('RESOLVED','CLOSED') AND rtwCertificateUrl IS NULL` |

### Backend Implementation

```typescript
// GET /whs/analytics/summary
whsRoutes.get('/analytics/summary', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;
  const role = user.role;

  // WHS officer sees own cases, Supervisor sees all
  const baseWhere = role === 'WHS_CONTROL'
    ? { companyId, whsAssignedTo: userId }
    : { companyId, whsAssignedTo: { not: null } };

  const [total, active, critical, pendingRTW, resolvedCases] = await Promise.all([
    // Total assigned cases
    prisma.incident.count({ where: baseWhere }),

    // Active cases (OPEN + IN_PROGRESS)
    prisma.incident.count({
      where: { ...baseWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } }
    }),

    // Critical/High severity cases
    prisma.incident.count({
      where: { ...baseWhere, severity: { in: ['HIGH', 'CRITICAL'] } }
    }),

    // Pending RTW (resolved/closed but no certificate)
    prisma.incident.count({
      where: {
        ...baseWhere,
        status: { in: ['RESOLVED', 'CLOSED'] },
        rtwCertificateUrl: null
      }
    }),

    // Get resolved cases for avg calculation
    prisma.incident.findMany({
      where: {
        ...baseWhere,
        resolvedAt: { not: null },
        whsAssignedAt: { not: null }
      },
      select: { whsAssignedAt: true, resolvedAt: true }
    }),
  ]);

  // Calculate average resolution time
  let avgResolutionDays = null;
  if (resolvedCases.length > 0) {
    const totalDays = resolvedCases.reduce((sum, inc) => {
      const diffMs = new Date(inc.resolvedAt!).getTime() - new Date(inc.whsAssignedAt!).getTime();
      const days = diffMs / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    avgResolutionDays = Math.round((totalDays / resolvedCases.length) * 10) / 10; // 1 decimal
  }

  return c.json({
    total,
    active,
    resolved: total - active,
    critical,
    pendingRTW,
    avgResolutionDays,
  });
});
```

---

## 2. Breakdown Analytics (Pie/Donut Charts)

All breakdowns filtered to **assigned cases only**.

### 2.1 By Incident Type
```
INJURY          ████████░░  45%
ILLNESS         ████░░░░░░  20%
MENTAL_HEALTH   ███░░░░░░░  15%
MEDICAL_EMERGENCY ██░░░░░░░  10%
HEALTH_SAFETY   █░░░░░░░░░   5%
OTHER           █░░░░░░░░░   5%
```

### 2.2 By Severity Level
- Donut chart: LOW/MEDIUM/HIGH/CRITICAL
- Color-coded: Blue/Yellow/Orange/Red

### 2.3 By Current Status
- OPEN, IN_PROGRESS, RESOLVED, CLOSED
- Shows backlog vs completed ratio

### Backend Implementation

```typescript
// GET /whs/analytics/breakdown
whsRoutes.get('/analytics/breakdown', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const baseWhere = user.role === 'WHS_CONTROL'
    ? { companyId: user.companyId, whsAssignedTo: user.id }
    : { companyId: user.companyId, whsAssignedTo: { not: null } };

  const [byType, bySeverity, byStatus] = await Promise.all([
    prisma.incident.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: { type: true },
    }),
    prisma.incident.groupBy({
      by: ['severity'],
      where: baseWhere,
      _count: { severity: true },
    }),
    prisma.incident.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true },
    }),
  ]);

  return c.json({ byType, bySeverity, byStatus });
});
```

---

## 3. Overdue Cases Table

Cases exceeding SLA target resolution time (still OPEN or IN_PROGRESS).

### SLA Targets

| Severity | Target Days | Description |
|----------|-------------|-------------|
| CRITICAL | 1 day | Must resolve within 24 hours |
| HIGH | 3 days | Must resolve within 3 days |
| MEDIUM | 7 days | Must resolve within 1 week |
| LOW | 14 days | Must resolve within 2 weeks |

### Table Columns
- Case #
- Worker Name
- Type
- Severity
- Days Since Assigned
- Status

### Backend Implementation

```typescript
// GET /whs/analytics/overdue-cases
whsRoutes.get('/analytics/overdue-cases', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const userId = user.id;
  const companyId = user.companyId;

  const whereUser = user.role === 'WHS_CONTROL'
    ? userId
    : null; // null means all WHS officers

  const overdue = await prisma.$queryRaw`
    SELECT
      i.id,
      i."caseNumber",
      i.type,
      i.severity,
      i.status,
      i.title,
      i."whsAssignedAt",
      EXTRACT(DAY FROM NOW() - i."whsAssignedAt") as days_open,
      u."firstName" as reporter_first_name,
      u."lastName" as reporter_last_name,
      t.name as team_name
    FROM incidents i
    LEFT JOIN users u ON i."reportedBy" = u.id
    LEFT JOIN teams t ON i."teamId" = t.id
    WHERE i."companyId" = ${companyId}
      AND (${whereUser}::text IS NULL OR i."whsAssignedTo" = ${whereUser})
      AND i."whsAssignedTo" IS NOT NULL
      AND i.status IN ('OPEN', 'IN_PROGRESS')
      AND (
        (i.severity = 'CRITICAL' AND i."whsAssignedAt" < NOW() - INTERVAL '1 day') OR
        (i.severity = 'HIGH' AND i."whsAssignedAt" < NOW() - INTERVAL '3 days') OR
        (i.severity = 'MEDIUM' AND i."whsAssignedAt" < NOW() - INTERVAL '7 days') OR
        (i.severity = 'LOW' AND i."whsAssignedAt" < NOW() - INTERVAL '14 days')
      )
    ORDER BY
      CASE i.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      i."whsAssignedAt" ASC
  `;

  return c.json({ data: overdue });
});
```

---

## 4. Pending RTW Cases

Workers awaiting Return to Work clearance.

### Table Columns
- Worker Name
- Incident Type
- Days Since Resolved
- Team
- Case #

### Backend Implementation

```typescript
// GET /whs/analytics/rtw-pending
whsRoutes.get('/analytics/rtw-pending', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const baseWhere = user.role === 'WHS_CONTROL'
    ? { companyId: user.companyId, whsAssignedTo: user.id }
    : { companyId: user.companyId, whsAssignedTo: { not: null } };

  const pendingRTW = await prisma.incident.findMany({
    where: {
      ...baseWhere,
      status: { in: ['RESOLVED', 'CLOSED'] },
      rtwCertificateUrl: null,
    },
    select: {
      id: true,
      caseNumber: true,
      type: true,
      resolvedAt: true,
      reporter: {
        select: { firstName: true, lastName: true }
      },
      team: {
        select: { name: true }
      },
    },
    orderBy: { resolvedAt: 'asc' }, // Oldest first (longest waiting)
  });

  // Calculate days since resolved
  const data = pendingRTW.map(inc => ({
    ...inc,
    daysSinceResolved: inc.resolvedAt
      ? Math.floor((Date.now() - new Date(inc.resolvedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null
  }));

  return c.json({ data });
});
```

---

## 5. Incident Trends (Phase 2)

### Cases Over Time Chart
- **X-axis:** Date (daily/weekly/monthly toggle)
- **Y-axis:** Incident count assigned to me
- **Lines:** Total, by severity

### Backend Implementation

```typescript
// GET /whs/analytics/trends?period=daily|weekly|monthly&days=30
whsRoutes.get('/analytics/trends', requireWHSControl(), async (c) => {
  const user = c.get('user');
  const { period = 'daily', days = '30' } = c.req.query();

  const userId = user.role === 'WHS_CONTROL' ? user.id : null;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const dateTrunc = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day';

  const trends = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC(${dateTrunc}, "whsAssignedAt") as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical,
      COUNT(*) FILTER (WHERE severity = 'HIGH') as high,
      COUNT(*) FILTER (WHERE severity = 'MEDIUM') as medium,
      COUNT(*) FILTER (WHERE severity = 'LOW') as low
    FROM incidents
    WHERE "companyId" = ${user.companyId}
      AND (${userId}::text IS NULL OR "whsAssignedTo" = ${userId})
      AND "whsAssignedTo" IS NOT NULL
      AND "whsAssignedAt" >= ${startDate}
    GROUP BY DATE_TRUNC(${dateTrunc}, "whsAssignedAt")
    ORDER BY date
  `;

  return c.json({ data: trends });
});
```

---

## 6. Supervisor View: All WHS Officers (Phase 3)

**Only for SUPERVISOR/EXECUTIVE/ADMIN roles.**

### Officer Performance Table

| Officer | Active | Resolved | Total | Avg Days | Resolution Rate |
|---------|--------|----------|-------|----------|-----------------|
| Juan | 5 | 18 | 23 | 4.2 | 78% |
| Maria | 8 | 12 | 20 | 6.1 | 60% |
| Pedro | 3 | 25 | 28 | 3.5 | 89% |

### Backend Implementation

```typescript
// GET /whs/analytics/officer-performance (Supervisor only)
whsRoutes.get('/analytics/officer-performance', requireSupervisorAccess(), async (c) => {
  const user = c.get('user');
  const companyId = user.companyId;

  // Get all WHS officers
  const officers = await prisma.user.findMany({
    where: { companyId, role: 'WHS_CONTROL', isActive: true },
    select: { id: true, firstName: true, lastName: true, avatar: true }
  });

  // Get performance stats for each officer
  const performance = await Promise.all(
    officers.map(async (officer) => {
      const [stats, resolvedCases] = await Promise.all([
        // Status counts
        prisma.incident.groupBy({
          by: ['status'],
          where: { companyId, whsAssignedTo: officer.id },
          _count: { status: true }
        }),
        // For avg resolution time
        prisma.incident.findMany({
          where: {
            companyId,
            whsAssignedTo: officer.id,
            resolvedAt: { not: null },
            whsAssignedAt: { not: null }
          },
          select: { whsAssignedAt: true, resolvedAt: true }
        })
      ]);

      // Calculate metrics
      let active = 0, resolved = 0;
      stats.forEach(s => {
        if (['OPEN', 'IN_PROGRESS'].includes(s.status)) active += s._count.status;
        if (['RESOLVED', 'CLOSED'].includes(s.status)) resolved += s._count.status;
      });

      let avgDays = null;
      if (resolvedCases.length > 0) {
        const totalDays = resolvedCases.reduce((sum, inc) => {
          const diffMs = new Date(inc.resolvedAt!).getTime() - new Date(inc.whsAssignedAt!).getTime();
          return sum + diffMs / (1000 * 60 * 60 * 24);
        }, 0);
        avgDays = Math.round((totalDays / resolvedCases.length) * 10) / 10;
      }

      const total = active + resolved;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      return {
        officer,
        active,
        resolved,
        total,
        avgDays,
        resolutionRate,
      };
    })
  );

  return c.json({ data: performance });
});
```

---

## UI/UX Layout

### WHS Officer View
```
┌─────────────────────────────────────────────────────────────┐
│  My WHS Analytics                                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │  Total  │ │ Active  │ │Resolved │ │Critical │ │Pend RTW ││
│  │   28    │ │    5    │ │   23    │ │    2    │ │    3    ││
│  │         │ │         │ │Avg: 4.2d│ │         │ │         ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
├─────────────────────────────────────────────────────────────┤
│  Date Range: [Last 30 Days ▼]  Type: [All ▼]                │
├──────────────────────────────┬──────────────────────────────┤
│  By Type (Donut)             │  By Severity (Donut)         │
│  ┌────────────────────┐      │  ┌────────────────────┐      │
│  │    [CHART]         │      │  │    [CHART]         │      │
│  └────────────────────┘      │  └────────────────────┘      │
├──────────────────────────────┴──────────────────────────────┤
│  Overdue Cases (3)                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Case#    Worker    Type     Severity  Days   Status  │   │
│  │ INC-001  Juan      INJURY   HIGH      5      OPEN    │   │
│  │ INC-003  Maria     ILLNESS  MEDIUM    10     IN_PROG │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Pending RTW Clearance (3)                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Worker    Type      Days Since Resolved   Team       │   │
│  │ Pedro     INJURY    8                     Team A     │   │
│  │ Ana       ILLNESS   5                     Team B     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1 (MVP) - WHS Officer Personal Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Summary Cards (5 KPIs) | To Do | Endpoint: `/whs/analytics/summary` |
| Breakdown Charts | To Do | Endpoint: `/whs/analytics/breakdown` |
| Overdue Cases Table | To Do | Endpoint: `/whs/analytics/overdue-cases` |
| Pending RTW Table | To Do | Endpoint: `/whs/analytics/rtw-pending` |
| CLOSED = Final validation | To Do | Add to status update endpoint |

### Phase 2 - Trends & Analysis

| Feature | Status | Notes |
|---------|--------|-------|
| Cases Over Time Chart | To Do | Endpoint: `/whs/analytics/trends` |
| Resolution Rate Trend | To Do | Part of trends endpoint |
| Team Distribution | To Do | New endpoint needed |

### Phase 3 - Supervisor Features

| Feature | Status | Notes |
|---------|--------|-------|
| Officer Performance Table | To Do | Endpoint: `/whs/analytics/officer-performance` |
| Unassigned Cases Queue | To Do | New endpoint needed |
| Comparative Analytics | To Do | New endpoint needed |

---

## Required Backend Endpoints

```typescript
// WHS Officer endpoints (filtered by whsAssignedTo = userId)
GET /whs/analytics/summary           // Summary cards
GET /whs/analytics/breakdown         // Pie charts data
GET /whs/analytics/overdue-cases     // Overdue table
GET /whs/analytics/rtw-pending       // RTW pending table
GET /whs/analytics/trends            // Line chart data (Phase 2)

// Supervisor-only endpoints (all WHS cases)
GET /whs/analytics/officer-performance  // All officers stats (Phase 3)
GET /whs/analytics/unassigned-cases     // Pending assignment (Phase 3)
```

---

## Summary

| What | Status | Notes |
|------|--------|-------|
| Schema fields | ✅ Exist | `whsAssignedTo`, `whsAssignedAt`, `resolvedAt` |
| Auto-trigger resolvedAt | ✅ Exist | Code at `incidents/index.ts:735-736` |
| Database indexes | ✅ Exist | All needed indexes in place |
| CLOSED = Final validation | ❌ Missing | Need to add to status update |
| Analytics endpoints | ❌ Missing | Need to implement |
| Frontend page | ❌ Missing | Need to create |

### Data Flow Recap

```
1. Supervisor assigns case to WHS
   → whsAssignedTo = officer.id (manual)
   → whsAssignedAt = NOW() (should be auto)
   → whsAssignedBy = supervisor.id (manual)

2. WHS Officer closes case (status → CLOSED)
   → resolvedAt = NOW() (auto-triggered by existing code)

3. Analytics calculates:
   → Resolution Time = resolvedAt - whsAssignedAt
   → Filtered by whsAssignedTo = currentUser.id
```

Each WHS officer sees **personalized analytics** based on cases assigned to them only.
