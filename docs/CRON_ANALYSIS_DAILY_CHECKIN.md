# Cron Jobs - Daily Attendance Finalizer

## Summary

- **Schedule**: Hourly (`0 * * * *`) - processes at 5 AM per company timezone
- **Purpose**: Auto-mark ABSENT + create Absence record for TL review
- **Database changes**: None (models exist)

---

## Flow

```
CRON (Hourly)
    │
    ▼
Is it 5 AM in company's timezone?
    │
    ├── NO → Skip
    │
    └── YES → Process yesterday
            │
            ▼
    ┌─────────────────────────────┐
    │ For each worker:            │
    │ - Skip if checked in        │
    │ - Skip if on leave          │
    │ - Skip if holiday           │
    │ - Skip if not work day      │
    │ - Skip if before baseline   │
    └─────────────────────────────┘
            │
            ▼
    Create DailyAttendance (ABSENT)
    Create Absence (PENDING_JUSTIFICATION)
            │
            ▼
    Worker submits reason
            │
            ▼
    TL approves/rejects
    ├── EXCUSED → DailyAttendance.status = EXCUSED
    └── UNEXCUSED → stays ABSENT
```

---

## Statuses

```
DailyAttendance.status:
├── GREEN   = Checked in (100 pts)
├── ABSENT  = No check-in (0 pts)
└── EXCUSED = Approved absence (not counted)

Absence.status:
├── PENDING_JUSTIFICATION = Awaiting worker reason
├── EXCUSED               = TL approved
└── UNEXCUSED             = TL rejected
```

---

## Files to Create

```
backend/src/
├── cron/
│   ├── index.ts                    # Cron scheduler
│   └── attendance-finalizer.ts     # Main logic
├── modules/
│   └── absences/
│       └── index.ts                # API endpoints
└── index.ts                        # Add initCronJobs()
```

---

## Implementation

### 1. Cron Scheduler (`src/cron/index.ts`)

```typescript
import cron from 'node-cron';
import { finalizeAttendance } from './attendance-finalizer.js';

export function initCronJobs() {
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running attendance finalizer...');
    try {
      const result = await finalizeAttendance();
      console.log('[CRON] Done:', result);
    } catch (error) {
      console.error('[CRON] Failed:', error);
    }
  });

  console.log('[CRON] Initialized - hourly schedule');
}
```

### 2. Attendance Finalizer (`src/cron/attendance-finalizer.ts`)

```typescript
import { DateTime } from 'luxon';
import { prisma } from '../config/prisma.js';
import { getStartOfNextDay, getDateStringInTimezone } from '../utils/date-helpers.js';

export async function finalizeAttendance() {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, timezone: true }
  });

  let totalAbsent = 0;

  for (const company of companies) {
    const timezone = company.timezone || 'Asia/Manila';
    const now = DateTime.now().setZone(timezone);

    // Only process at 5 AM local time
    if (now.hour !== 5) continue;

    const yesterday = now.minus({ days: 1 });
    const yesterdayDate = yesterday.startOf('day').toJSDate();
    const yesterdayStr = yesterday.toFormat('yyyy-MM-dd');
    const dayName = yesterday.toFormat('ccc').toUpperCase();

    // Skip if holiday
    const holiday = await prisma.holiday.findFirst({
      where: { companyId: company.id, date: yesterdayDate }
    });
    if (holiday) continue;

    // Get workers with their first check-in
    const workers = await prisma.user.findMany({
      where: {
        companyId: company.id,
        role: { in: ['WORKER', 'MEMBER'] },
        teamId: { not: null },
        isActive: true
      },
      include: { team: { select: { id: true, workDays: true, shiftStart: true, isActive: true } } }
    });

    for (const worker of workers) {
      if (!worker.team?.isActive) continue;

      // Skip if not work day
      const workDays = worker.team.workDays?.split(',').map(d => d.trim().toUpperCase()) || [];
      if (!workDays.includes(dayName)) continue;

      // Skip if before baseline date (worker not yet required to check in)
      const firstCheckin = await prisma.checkin.findFirst({
        where: { userId: worker.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      });

      let baselineDate: Date;
      if (firstCheckin) {
        baselineDate = new Date(firstCheckin.createdAt);
      } else if (worker.teamJoinedAt) {
        baselineDate = getStartOfNextDay(new Date(worker.teamJoinedAt), timezone);
      } else {
        baselineDate = getStartOfNextDay(new Date(worker.createdAt), timezone);
      }

      const baselineStr = getDateStringInTimezone(baselineDate, timezone);
      if (yesterdayStr < baselineStr) continue;

      // Skip if already has attendance
      const existing = await prisma.dailyAttendance.findUnique({
        where: { userId_date: { userId: worker.id, date: yesterdayDate } }
      });
      if (existing) continue;

      // Skip if on leave
      const onLeave = await prisma.exception.findFirst({
        where: {
          userId: worker.id,
          status: 'APPROVED',
          startDate: { lte: yesterdayDate },
          endDate: { gte: yesterdayDate }
        }
      });
      if (onLeave) continue;

      // Skip if absence exists
      const existingAbsence = await prisma.absence.findUnique({
        where: { userId_absenceDate: { userId: worker.id, absenceDate: yesterdayDate } }
      });
      if (existingAbsence) continue;

      // Create records
      await prisma.$transaction([
        prisma.dailyAttendance.create({
          data: {
            userId: worker.id,
            companyId: worker.companyId,
            teamId: worker.teamId!,
            date: yesterdayDate,
            status: 'ABSENT',
            score: 0,
            isCounted: true,
            scheduledStart: worker.team.shiftStart || '08:00'
          }
        }),
        prisma.absence.create({
          data: {
            userId: worker.id,
            teamId: worker.teamId!,
            companyId: worker.companyId,
            absenceDate: yesterdayDate,
            status: 'PENDING_JUSTIFICATION'
          }
        })
      ]);

      totalAbsent++;
    }
  }

  return { markedAbsent: totalAbsent };
}
```

### 3. Absence Routes (`src/modules/absences/index.ts`)

```typescript
import { Hono } from 'hono';
import type { AppContext } from '../../types/context.js';
import { prisma } from '../../config/prisma.js';
import { isValidUUID, parsePagination } from '../../utils/validator.js';

const absenceRoutes = new Hono<AppContext>();

// Worker: Get my absences
absenceRoutes.get('/my', async (c) => {
  const userId = c.get('userId');
  const { page, limit, skip } = parsePagination(c);

  const [data, total] = await Promise.all([
    prisma.absence.findMany({
      where: { userId },
      orderBy: { absenceDate: 'desc' },
      skip,
      take: limit,
      include: { reviewer: { select: { id: true, firstName: true, lastName: true } } }
    }),
    prisma.absence.count({ where: { userId } })
  ]);

  return c.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// Worker: Submit reason
absenceRoutes.put('/:id/justify', async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  if (!isValidUUID(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const absence = await prisma.absence.findUnique({ where: { id } });
  if (!absence) return c.json({ error: 'Not found' }, 404);
  if (absence.userId !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (absence.status !== 'PENDING_JUSTIFICATION') return c.json({ error: 'Already reviewed' }, 400);

  const updated = await prisma.absence.update({
    where: { id },
    data: {
      reasonCategory: body.reasonCategory,
      explanation: body.explanation || null,
      justifiedAt: new Date()
    }
  });

  return c.json(updated);
});

// TL: Get pending reviews
absenceRoutes.get('/pending', async (c) => {
  const user = c.get('user');
  const { page, limit, skip } = parsePagination(c);

  const teams = await prisma.team.findMany({
    where: { leaderId: user.id },
    select: { id: true }
  });
  const teamIds = teams.map(t => t.id);

  if (teamIds.length === 0) {
    return c.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  const [data, total] = await Promise.all([
    prisma.absence.findMany({
      where: { teamId: { in: teamIds }, status: 'PENDING_JUSTIFICATION' },
      orderBy: { absenceDate: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } }
    }),
    prisma.absence.count({ where: { teamId: { in: teamIds }, status: 'PENDING_JUSTIFICATION' } })
  ]);

  return c.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// TL: Approve/reject
absenceRoutes.put('/:id/review', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const { decision, reviewNotes } = await c.req.json();

  if (!isValidUUID(id)) return c.json({ error: 'Invalid ID format' }, 400);
  if (!['EXCUSED', 'UNEXCUSED'].includes(decision)) {
    return c.json({ error: 'Decision must be EXCUSED or UNEXCUSED' }, 400);
  }

  const absence = await prisma.absence.findUnique({ where: { id }, include: { team: true } });
  if (!absence) return c.json({ error: 'Not found' }, 404);

  const isTeamLead = absence.team?.leaderId === user.id;
  const isSupervisor = ['SUPERVISOR', 'EXECUTIVE', 'ADMIN'].includes(user.role);
  if (!isTeamLead && !isSupervisor) return c.json({ error: 'Forbidden' }, 403);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.absence.update({
      where: { id },
      data: { status: decision, reviewedBy: user.id, reviewedAt: new Date(), reviewNotes }
    });

    if (decision === 'EXCUSED') {
      await tx.dailyAttendance.updateMany({
        where: { userId: absence.userId, date: absence.absenceDate },
        data: { status: 'EXCUSED', score: null, isCounted: false }
      });
    }

    return updated;
  });

  return c.json(result);
});

// Badge count
absenceRoutes.get('/count/pending', async (c) => {
  const user = c.get('user');

  if (['WORKER', 'MEMBER'].includes(user.role)) {
    const count = await prisma.absence.count({
      where: { userId: user.id, status: 'PENDING_JUSTIFICATION', justifiedAt: null }
    });
    return c.json({ pendingJustification: count, pendingReview: 0 });
  }

  const teams = await prisma.team.findMany({ where: { leaderId: user.id }, select: { id: true } });
  const teamIds = teams.map(t => t.id);

  const pendingReview = teamIds.length > 0
    ? await prisma.absence.count({ where: { teamId: { in: teamIds }, status: 'PENDING_JUSTIFICATION' } })
    : 0;

  return c.json({ pendingJustification: 0, pendingReview });
});

export { absenceRoutes };
```

### 4. Register Routes (`src/routes.ts`)

```typescript
import { absenceRoutes } from './modules/absences/index.js';

// Add to authenticated routes
api.route('/absences', absenceRoutes);
```

### 5. Initialize Cron (`src/index.ts`)

```typescript
import { initCronJobs } from './cron/index.js';

// After server starts
initCronJobs();
```

### 6. Test Endpoint (`src/cron/index.ts` - add to scheduler)

```typescript
import { Hono } from 'hono';
import type { AppContext } from '../types/context.js';
import { finalizeAttendance } from './attendance-finalizer.js';

const cronRoutes = new Hono<AppContext>();

// Manual trigger for testing (admin only)
cronRoutes.post('/test-attendance-finalizer', async (c) => {
  const user = c.get('user');
  if (user.role !== 'ADMIN') {
    return c.json({ error: 'Admin only' }, 403);
  }

  const result = await finalizeAttendance();
  return c.json(result);
});

export { cronRoutes };
```

Then register in `src/routes.ts`:
```typescript
import { cronRoutes } from './cron/index.js';
api.route('/cron', cronRoutes);
```

---

## API Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/absences/my` | Worker | My absences |
| PUT | `/absences/:id/justify` | Worker | Submit reason |
| GET | `/absences/pending` | TL | Pending reviews |
| PUT | `/absences/:id/review` | TL | Approve/reject |
| GET | `/absences/count/pending` | All | Badge counts |
| POST | `/cron/test-attendance-finalizer` | Admin | Manual cron test |

---

## Dependencies

```bash
npm install node-cron luxon
npm install -D @types/node-cron @types/luxon
```

---

## Checklist

- [ ] Install dependencies (`node-cron`, `luxon`)
- [ ] Create `src/cron/index.ts` (scheduler + test routes)
- [ ] Create `src/cron/attendance-finalizer.ts`
- [ ] Create `src/modules/absences/index.ts`
- [ ] Register `/absences` routes in `src/routes.ts`
- [ ] Register `/cron` routes in `src/routes.ts`
- [ ] Add `initCronJobs()` to `src/index.ts`
- [ ] Test with `POST /cron/test-attendance-finalizer`
