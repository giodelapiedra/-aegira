# Absence Justification System

## Overview

Kapag ang worker ay hindi nag-check-in at walang exemption o holiday, automatic na magkakaroon ng absence record. Required sa worker na mag-submit ng justification bago siya makapag-check-in ulit.

---

## System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  WORKER OPENS APP / CHECKS IN               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SYSTEM CHECKS FOR MISSING DAYS                 │
│                     (On-demand, no cron)                    │
│                                                             │
│   For each day since last recorded activity:                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Has check-in?        YES → Skip                     │   │
│   │ Has exemption?       YES → Skip                     │   │
│   │ Has holiday?         YES → Skip                     │   │
│   │ Is rest day?         YES → Skip                     │   │
│   │ Has absence record?  YES → Skip                     │   │
│   │ NONE?                → Auto-create Absence Record   │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 HAS PENDING JUSTIFICATIONS?                 │
└─────────────────────────────────────────────────────────────┘
                      │                │
                     YES               NO
                      │                │
                      ▼                ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   SHOW BLOCKING POPUP    │   │   PROCEED NORMALLY       │
│                          │   │   (Can check-in)         │
│   Worker MUST justify    │   └──────────────────────────┘
│   before proceeding      │
└──────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 WORKER SUBMITS JUSTIFICATION                │
├─────────────────────────────────────────────────────────────┤
│   Required:                                                 │
│   • Reason Category (dropdown)                              │
│   • Explanation (text)                                      │
│                                                             │
│   Optional:                                                 │
│   • "Same reason for all" checkbox (multiple days)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TEAM LEADER REVIEWS                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   2 Actions Available:                                      │
│   ┌─────────────────────┐   ┌─────────────────────┐         │
│   │      EXCUSE         │   │     UNEXCUSED       │         │
│   │   (Valid reason)    │   │  (Invalid reason)   │         │
│   │    No penalty       │   │     0 points        │         │
│   └─────────────────────┘   └─────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Status Flow

```
PENDING_JUSTIFICATION ──(worker submits)──> Team Leader reviews
       │                                            │
       │                               ┌────────────┴────────────┐
       │                               │                         │
       ▼                               ▼                         ▼
  justifiedAt = NULL              EXCUSED                   UNEXCUSED
  (not yet justified)          (No penalty)                (0 points)
       │
       ▼
  justifiedAt = DateTime
  (justified, waiting for TL)
```

### How to Differentiate States

| Status | justifiedAt | Meaning |
|--------|-------------|---------|
| PENDING_JUSTIFICATION | NULL | Worker not yet justified |
| PENDING_JUSTIFICATION | has value | Worker justified, waiting for TL |
| EXCUSED | has value | TL approved |
| UNEXCUSED | has value | TL rejected |

---

## Database Schema

### Prisma Model

```prisma
model Absence {
  id              String         @id @default(uuid())

  // Worker info
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  absenceDate     DateTime       @db.Date

  // Team info (for TL filtering)
  teamId          String
  team            Team           @relation(fields: [teamId], references: [id], onDelete: Cascade)

  // Justification (filled by worker)
  reasonCategory  AbsenceReason?
  explanation     String?
  justifiedAt     DateTime?      // NULL = not yet justified, has value = justified

  // Review (by team leader)
  status          AbsenceStatus  @default(PENDING_JUSTIFICATION)
  reviewedBy      String?
  reviewer        User?          @relation("AbsenceReviewer", fields: [reviewedBy], references: [id])
  reviewedAt      DateTime?
  reviewNotes     String?

  // Multi-tenancy
  companyId       String
  company         Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Timestamps
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([userId, absenceDate])
  @@index([userId, status])
  @@index([teamId, status])    // For TL queries
  @@index([companyId])
  @@index([absenceDate])
}

enum AbsenceReason {
  SICK
  EMERGENCY
  PERSONAL
  FORGOT_CHECKIN
  TECHNICAL_ISSUE
  OTHER
}

enum AbsenceStatus {
  PENDING_JUSTIFICATION  // Worker hasn't explained yet
  EXCUSED                // TL approved - no penalty
  UNEXCUSED              // TL rejected - 0 points
}
```

---

## Grade Impact

| Status | Points | Counted? | Effect |
|--------|--------|----------|--------|
| `PENDING_JUSTIFICATION` | 0 | Yes | Temporary, waiting for worker |
| `EXCUSED` | - | **No** | **No penalty** (excluded from computation) |
| `UNEXCUSED` | 0 | Yes | **Bumaba grade** (0 points, counted) |

### Example Calculations

**Scenario 1: Absent 2 days, both EXCUSED**
```
Week: 5 work days
- Mon: GREEN (100)
- Tue: GREEN (100)
- Wed: Absent → EXCUSED (not counted)
- Thu: Absent → EXCUSED (not counted)
- Fri: GREEN (100)

Counted days = 3
Score = (100 + 100 + 100) / 3 = 100
Grade = A ✅
```

**Scenario 2: Absent 2 days, both UNEXCUSED**
```
Week: 5 work days
- Mon: GREEN (100)
- Tue: GREEN (100)
- Wed: Absent → UNEXCUSED (0)
- Thu: Absent → UNEXCUSED (0)
- Fri: GREEN (100)

Counted days = 5
Score = (100 + 100 + 0 + 0 + 100) / 5 = 60
Grade = D ❌
```

**Scenario 3: Absent 2 days, 1 EXCUSED + 1 UNEXCUSED**
```
Week: 5 work days
- Mon: GREEN (100)
- Tue: GREEN (100)
- Wed: Absent → EXCUSED (not counted)
- Thu: Absent → UNEXCUSED (0)
- Fri: GREEN (100)

Counted days = 4
Score = (100 + 100 + 0 + 100) / 4 = 75
Grade = C
```

---

## Frontend Components

### 1. Worker Popup - Multiple Days (Individual Forms)

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Pending Absence Justifications                          │
│                                                              │
│  You have 3 unexcused absences that require explanation      │
│  before you can continue.                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📅 Tuesday, January 7, 2026                           │  │
│  │                                                        │  │
│  │  Reason:                                               │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Select reason                                  ▼ │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  Explanation:                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │                                                  │  │  │
│  │  │                                                  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📅 Wednesday, January 8, 2026                         │  │
│  │                                                        │  │
│  │  Reason:                                               │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Select reason                                  ▼ │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  Explanation:                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │                                                  │  │  │
│  │  │                                                  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📅 Friday, January 10, 2026                           │  │
│  │                                                        │  │
│  │  Reason:                                               │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Select reason                                  ▼ │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  Explanation:                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │                                                  │  │  │
│  │  │                                                  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ☐ Use same reason and explanation for all absences   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    [ Submit Justification ]                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2. Worker Popup - Same Reason Checked

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Pending Absence Justifications                          │
│                                                              │
│  You have 3 unexcused absences that require explanation      │
│  before you can continue.                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📅 Absences:                                                │
│  • Tuesday, January 7, 2026                                  │
│  • Wednesday, January 8, 2026                                │
│  • Friday, January 10, 2026                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Reason (for all):                                     │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Sick                                           ▼ │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  Explanation (for all):                                │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Nilagnat po at hindi makabangon. Nagpahinga     │  │  │
│  │  │ ng 3 days.                                      │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ☑ Use same reason and explanation for all absences   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    [ Submit Justification ]                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3. Reason Dropdown Options

```
┌──────────────────────────────────────┐
│ Select reason                      ▼ │
├──────────────────────────────────────┤
│ Sick                                 │
│ Emergency                            │
│ Personal                             │
│ Forgot to check-in                   │
│ Technical issue                      │
│ Other                                │
└──────────────────────────────────────┘
```

### 4. Team Leader Review Section

Add to Daily Monitoring page:

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Pending Absence Reviews (3)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 Juan Dela Cruz                                       ││
│  │ 📅 Tuesday, January 7, 2026                             ││
│  │                                                         ││
│  │ Reason: Sick                                            ││
│  │ "Nilagnat po, hindi makabangon"                         ││
│  │                                                         ││
│  │ Submitted: Jan 10, 2026 8:00 AM                         ││
│  │                                                         ││
│  │              [ Excuse ]    [ Mark Unexcused ]           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 Juan Dela Cruz                                       ││
│  │ 📅 Wednesday, January 8, 2026                           ││
│  │                                                         ││
│  │ Reason: Sick                                            ││
│  │ "Nilagnat pa rin, nagpahinga"                           ││
│  │                                                         ││
│  │ Submitted: Jan 10, 2026 8:00 AM                         ││
│  │                                                         ││
│  │              [ Excuse ]    [ Mark Unexcused ]           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 Maria Santos                                         ││
│  │ 📅 Friday, January 10, 2026                             ││
│  │                                                         ││
│  │ Reason: Personal                                        ││
│  │ "May pinuntahan lang po"                                ││
│  │                                                         ││
│  │ Submitted: Jan 13, 2026 9:30 AM                         ││
│  │                                                         ││
│  │              [ Excuse ]    [ Mark Unexcused ]           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Worker History View

Worker can see their absence history in My History page:

```
┌─────────────────────────────────────────────────────────────┐
│  📅 My Absence History                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Jan 7, 2026                                             ││
│  │ Reason: Sick                                            ││
│  │ "Nilagnat po"                                           ││
│  │ Status: ✅ EXCUSED                                      ││
│  │ Reviewed: Jan 10, 2026 by Team Leader                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Jan 14, 2026                                            ││
│  │ Reason: Personal                                        ││
│  │ "May pinuntahan"                                        ││
│  │ Status: ❌ UNEXCUSED                                    ││
│  │ Reviewed: Jan 15, 2026 by Team Leader                   ││
│  │ Note: "Hindi valid reason"                              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Jan 16, 2026                                            ││
│  │ Status: ⏳ PENDING                                      ││
│  │ (Waiting for Team Leader review)                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Worker Endpoints

**GET /api/absences/my-pending**

Returns worker's absences that need justification (not yet justified).

```typescript
// First, detect and create any new absences
await detectAndCreateAbsences(userId, companyId, timezone);

// Then get pending (not yet justified)
const absences = await prisma.absence.findMany({
  where: {
    userId,
    status: 'PENDING_JUSTIFICATION',
    justifiedAt: null  // NOT YET justified by worker
  },
  orderBy: { absenceDate: 'asc' }
});
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "absenceDate": "2026-01-07",
      "status": "PENDING_JUSTIFICATION"
    },
    {
      "id": "uuid-2",
      "absenceDate": "2026-01-08",
      "status": "PENDING_JUSTIFICATION"
    },
    {
      "id": "uuid-3",
      "absenceDate": "2026-01-10",
      "status": "PENDING_JUSTIFICATION"
    }
  ],
  "count": 3
}
```

**POST /api/absences/justify**

Worker submits justification.

**Request Body:**
```json
{
  "justifications": [
    {
      "absenceId": "uuid-1",
      "reasonCategory": "SICK",
      "explanation": "Nilagnat po"
    },
    {
      "absenceId": "uuid-2",
      "reasonCategory": "SICK",
      "explanation": "Nilagnat pa rin"
    },
    {
      "absenceId": "uuid-3",
      "reasonCategory": "SICK",
      "explanation": "Nagpahinga pa"
    }
  ]
}
```

```typescript
// Validate all absences belong to this user
for (const item of body.justifications) {
  const absence = await prisma.absence.findUnique({
    where: { id: item.absenceId }
  });

  if (!absence || absence.userId !== userId) {
    return c.json({ error: 'Invalid absence ID' }, 400);
  }

  if (absence.justifiedAt) {
    return c.json({ error: 'Already justified' }, 400);
  }
}

// Update all absences with justification
for (const item of body.justifications) {
  await prisma.absence.update({
    where: { id: item.absenceId },
    data: {
      reasonCategory: item.reasonCategory,
      explanation: item.explanation,
      justifiedAt: new Date()  // Mark as justified NOW
    }
  });
}

return c.json({ success: true, count: body.justifications.length });
```

**GET /api/absences/my-history**

Returns worker's all absences (for history page).

```json
{
  "data": [
    {
      "id": "uuid-1",
      "absenceDate": "2026-01-07",
      "reasonCategory": "SICK",
      "explanation": "Nilagnat po",
      "status": "EXCUSED",
      "justifiedAt": "2026-01-10T08:00:00Z",
      "reviewedAt": "2026-01-10T09:00:00Z"
    }
  ]
}
```

### Team Leader Endpoints

**GET /api/absences/team-pending**

Returns pending reviews for TL's team members only.

```typescript
// Query filters:
// 1. Only TL's team (teamId = user.teamId)
// 2. Only justified (justifiedAt IS NOT NULL)
// 3. Only pending (status = PENDING_JUSTIFICATION)

const absences = await prisma.absence.findMany({
  where: {
    teamId: user.teamId,           // Only their team
    justifiedAt: { not: null },    // Already justified by worker
    status: 'PENDING_JUSTIFICATION' // Waiting for TL review
  },
  include: {
    user: { select: { id: true, firstName: true, lastName: true } }
  },
  orderBy: { justifiedAt: 'asc' }  // Oldest first
});
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "user": {
        "id": "user-uuid",
        "firstName": "Juan",
        "lastName": "Dela Cruz"
      },
      "absenceDate": "2026-01-07",
      "reasonCategory": "SICK",
      "explanation": "Nilagnat po",
      "status": "PENDING_JUSTIFICATION",
      "justifiedAt": "2026-01-10T08:00:00Z"
    }
  ]
}
```

**POST /api/absences/:id/review**

Team Leader reviews absence.

```json
{
  "action": "EXCUSED",
  "notes": "Valid reason"
}
```

```typescript
// Validation
const absence = await prisma.absence.findUnique({ where: { id } });

// Must be TL's team
if (absence.teamId !== user.teamId) {
  return c.json({ error: 'Not your team member' }, 403);
}

// Must be justified first
if (!absence.justifiedAt) {
  return c.json({ error: 'Worker has not justified yet' }, 400);
}

// Update
await prisma.absence.update({
  where: { id },
  data: {
    status: body.action, // 'EXCUSED' or 'UNEXCUSED'
    reviewedBy: userId,
    reviewedAt: new Date(),
    reviewNotes: body.notes
  }
});

// Log to SystemLog
await prisma.systemLog.create({
  data: {
    userId,
    companyId,
    action: `ABSENCE_${body.action}`,
    details: { absenceId: id, workerId: absence.userId }
  }
});
```

---

## Backend Logic

### On-Demand Absence Detection

`backend/src/utils/absence.ts`

```typescript
import { prisma } from '../config/prisma.js';
import {
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
  getStartOfNextDay,
  toDateTime,
  getNowDT,
  DEFAULT_TIMEZONE,
  DAY_NAMES
} from './date-helpers.js';

export async function detectAndCreateAbsences(
  userId: string,
  companyId: string,
  timezone: string = DEFAULT_TIMEZONE
) {
  // 1. Get user with team info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: true, company: true }
  });

  if (!user?.team) return [];

  // Use company timezone
  const tz = user.company?.timezone || timezone;
  const teamWorkDays = user.team.workDays.split(',').map(d => d.trim().toUpperCase());

  // 2. Get first check-in (to determine baseline)
  const firstCheckin = await prisma.checkin.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  });

  // 3. Determine baseline date (when check-in requirement starts)
  // Priority:
  // a) First check-in date (worker already active)
  // b) NEXT DAY after teamJoinedAt (new worker - join day is free)
  // c) NEXT DAY after createdAt (fallback)
  let baselineDate: Date;

  if (firstCheckin) {
    // Already checked in before - use first check-in date
    baselineDate = firstCheckin.createdAt;
  } else if (user.teamJoinedAt) {
    // New worker - requirement starts NEXT DAY after joining
    baselineDate = getStartOfNextDay(new Date(user.teamJoinedAt), tz);
  } else {
    // Fallback - NEXT DAY after account creation
    baselineDate = getStartOfNextDay(new Date(user.createdAt), tz);
  }

  // 4. Get yesterday in COMPANY TIMEZONE (not UTC!)
  const nowInTz = getNowDT(tz);
  const yesterdayInTz = nowInTz.minus({ days: 1 }).startOf('day');
  const baselineDateInTz = toDateTime(baselineDate, tz).startOf('day');

  // 5. If no gap, return early
  if (baselineDateInTz >= yesterdayInTz) return [];

  // 6. Get existing data for quick lookup
  const [checkins, exemptions, holidays, existingAbsences] = await Promise.all([
    prisma.checkin.findMany({
      where: { userId, createdAt: { gte: baselineDate } },
      select: { createdAt: true }
    }),
    prisma.exception.findMany({
      where: { userId, status: 'APPROVED' }
    }),
    prisma.holiday.findMany({
      where: { companyId },
      select: { date: true }
    }),
    prisma.absence.findMany({
      where: { userId },
      select: { absenceDate: true }
    })
  ]);

  // Build lookup sets using COMPANY TIMEZONE
  const checkinDates = new Set(checkins.map(c => getDateStringInTimezone(c.createdAt, tz)));
  const holidayDates = new Set(holidays.map(h => getDateStringInTimezone(h.date, tz)));
  const absenceDates = new Set(existingAbsences.map(a => getDateStringInTimezone(a.absenceDate, tz)));

  const isDateExempted = (dateStr: string) => {
    return exemptions.some(e => {
      if (!e.startDate || !e.endDate) return false;
      const start = getDateStringInTimezone(e.startDate, tz);
      const end = getDateStringInTimezone(e.endDate, tz);
      return dateStr >= start && dateStr <= end;
    });
  };

  const createdAbsences = [];

  // 7. Iterate using Luxon DateTime in company timezone
  let current = baselineDateInTz; // Start from baseline date

  while (current <= yesterdayInTz) {
    const dateStr = current.toFormat('yyyy-MM-dd');

    // Get day of week in COMPANY TIMEZONE
    const dayOfWeek = getDayOfWeekInTimezone(current.toJSDate(), tz);
    const dayName = DAY_NAMES[dayOfWeek];

    // Skip if not a work day
    if (!teamWorkDays.includes(dayName)) {
      current = current.plus({ days: 1 });
      continue;
    }

    // Skip if has check-in, holiday, exemption, or existing absence
    if (checkinDates.has(dateStr) || holidayDates.has(dateStr) ||
        isDateExempted(dateStr) || absenceDates.has(dateStr)) {
      current = current.plus({ days: 1 });
      continue;
    }

    // Create absence record with date in company timezone
    const absence = await prisma.absence.create({
      data: {
        userId,
        teamId: user.team.id,  // Include teamId for TL filtering
        companyId,
        absenceDate: current.toJSDate(),
        status: 'PENDING_JUSTIFICATION'
      }
    });
    createdAbsences.push(absence);

    current = current.plus({ days: 1 });
  }

  return createdAbsences;
}

export async function getPendingJustifications(userId: string) {
  return prisma.absence.findMany({
    where: {
      userId,
      status: 'PENDING_JUSTIFICATION',
      justifiedAt: null  // Only absences NOT YET justified by worker
    },
    orderBy: { absenceDate: 'asc' }
  });
}
```

### Grade Calculation Integration

Update `backend/src/utils/attendance.ts`:

```typescript
// Add to calculatePerformanceScore function

// Fetch absences along with other data
const absences = await prisma.absence.findMany({
  where: {
    userId,
    absenceDate: { gte: startDate, lte: endDate }
  }
});

// Build absence map
const absenceMap = new Map();
for (const absence of absences) {
  const dateKey = getDateStringInTimezone(absence.absenceDate, timezone);
  absenceMap.set(dateKey, absence);
}

// When processing each date:
const absence = absenceMap.get(dateKey);

if (absence) {
  if (absence.status === 'EXCUSED') {
    // Not counted - no penalty
    breakdown.excused++;
  } else {
    // PENDING_JUSTIFICATION or UNEXCUSED = 0 points
    breakdown.absent++;
    totalScore += 0;
    countedDays++;
  }
}
```

---

## Integration Points

### 1. Check on App Load / Check-in

```typescript
// In checkin route or app initialization
const pending = await getPendingJustifications(userId);

if (pending.length > 0) {
  return c.json({
    error: 'PENDING_JUSTIFICATIONS',
    message: 'You have pending absence justifications',
    absences: pending
  }, 403);
}
```

### 2. Frontend App Wrapper

```typescript
// Check for pending absences on app load
const { data: pendingAbsences } = useQuery({
  queryKey: ['absences', 'pending'],
  queryFn: absenceService.getMyPending,
});

// Show blocking modal if has pending
if (pendingAbsences?.length > 0) {
  return <AbsenceJustificationModal absences={pendingAbsences} />;
}
```

---

## Potential Issues & Considerations

### 1. Worker Never Opens App

**Problem:** Kung hindi na bumalik ang worker, walang justification forever.

**Solution:**
- Worker cannot use app without justifying (blocking popup)
- If worker never returns, absences stay as PENDING_JUSTIFICATION (0 points)
- This is an HR issue (worker not reporting), not a system issue
- TL waits for worker - no auto actions

---

### 2. Team Leader Never Reviews

**Problem:** Absences stay as PENDING_JUSTIFICATION forever (still 0 points).

**Solution:**
- Dashboard notification for TL: "You have X pending reviews"
- Grade is already 0 while pending, so worker is not unfairly penalized
- TL must manually review - no auto actions

---

### 3. Retroactive Exemption

**Problem:** Worker files exemption AFTER absence record was created.

**Solution:**
- TL can see both: pending absence justification AND exemption request
- TL manually decides: approve exemption AND excuse the absence
- No auto actions - TL handles both manually
- TL responsibility to check if may related exemption request

---

### 4. New Worker / Historical Data

**Problem:** Workers who joined before this system don't have absence records.

**Solution:**
- Only start tracking from system implementation date
- Or: Only track from worker's first check-in date (existing logic)
- Don't backfill old absences

---

### 5. Performance on App Load

**Problem:** Checking many days might be slow.

**Solution:**
- Limit check to last 30-60 days max
- Use efficient batch queries (already in the code above)
- Cache results if needed

---

### 6. Team Transfer

**Problem:** Worker moves to different team with different work days.

**Solution:**
- Use current team's work days for detection
- Historical absences remain as-is
- Transfer date becomes new baseline

---

## Important Rules (MUST FOLLOW)

### 1. No Auto Actions
```
❌ NO auto-excuse
❌ NO auto-unexcused after X days
❌ NO auto-escalation
❌ NO bulk actions (excuse all / reject all)

✅ ALL reviews must be manual
✅ ALL reviews must be one-by-one
✅ TL must read each justification
```

### 2. TL Responsibility
```
✅ Review each absence individually
✅ Read worker's explanation
✅ Decide: EXCUSE or UNEXCUSED
✅ Check if may related exemption request
✅ Wait for worker to justify (no rushing)
```

### 3. Worker Responsibility
```
✅ Submit justification for ALL absences
✅ Provide reason category + explanation
✅ Cannot proceed until all justified
✅ Grade is 0 while pending (motivation to justify quickly)
```

### 4. Grade Calculation Rules
```
PENDING_JUSTIFICATION = 0 points, counted (temporary)
EXCUSED               = not counted (no penalty)
UNEXCUSED             = 0 points, counted (penalty)
```

### 5. Detection Rules
```
Skip if: Has check-in
Skip if: Has approved exemption
Skip if: Is holiday
Skip if: Is rest day
Skip if: Already has absence record
Create absence if: NONE of above
```

### 6. Baseline Date Rules (When to Start Counting)
```
Priority order:
1. First check-in date     → Worker already active, use this
2. NEXT DAY after teamJoinedAt → New worker, join day is FREE
3. NEXT DAY after createdAt    → Fallback

Example:
  Juan joins team: Jan 10 (Friday)
  Team work days: Mon-Fri

  Jan 10 (Fri) = Join day, NO requirement (FREE)
  Jan 11 (Sat) = Rest day, skip
  Jan 12 (Sun) = Rest day, skip
  Jan 13 (Mon) = FIRST required check-in ← Baseline

  If Juan opens app on Jan 15 without checking in Jan 13-14:
  → System creates 2 absence records (Jan 13, Jan 14)
```

### 7. Timing Rules (When Popup Appears)
```
✅ Check absences for: YESTERDAY and before (past days only)
✅ Today: NOT counted yet (day not complete)
✅ Popup appears: Next day onwards

Example:
  Worker misses check-in: Monday Jan 13
  Worker opens app Monday 10PM: NO popup (day not over)
  Worker opens app Tuesday 8AM: ✅ POPUP (Monday now counted)

Why:
  - Fair to worker (whole day to check-in)
  - Timezone-safe
  - Consistent with existing attendance.ts logic
```

### 8. Timezone Rules (CRITICAL)
```
✅ Use COMPANY TIMEZONE for all date calculations
✅ Use Luxon DateTime (not native JS Date)
✅ Use existing date-helpers.js functions:
   - getNowDT(timezone)
   - toDateTime(date, timezone)
   - getDateStringInTimezone(date, timezone)
   - getDayOfWeekInTimezone(date, timezone)
   - DAY_NAMES array

❌ NEVER use: new Date() directly for comparisons
❌ NEVER use: date.toLocaleDateString() for day names
❌ NEVER assume UTC

Example:
  Company timezone: Asia/Manila
  Server time (UTC): Jan 10, 2026 18:00 (6PM)
  Manila time:       Jan 11, 2026 02:00 (2AM next day)

  "Yesterday" in Manila = Jan 10
  "Yesterday" in UTC    = Jan 9 (WRONG!)
```

---

## Summary

| Component | Description |
|-----------|-------------|
| **Detection** | On-demand when worker opens app (no cron) |
| **Blocking** | Worker cannot proceed without justification |
| **TL Actions** | 2 options only: EXCUSE or UNEXCUSED |
| **TL Review** | One-by-one, manual, no bulk actions |
| **Grade Impact** | EXCUSED = no penalty, UNEXCUSED = 0 points |
| **Team Analytics** | Reflects accurate grades based on absence status |
| **Auto Actions** | NONE - all manual |

---

## Files to Create/Modify

### Backend
| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Add Absence model + enums |
| `backend/src/modules/absences/index.ts` | New module for absence routes |
| `backend/src/utils/absence.ts` | Detection + helper functions |
| `backend/src/utils/attendance.ts` | Integrate absence in grade calc |
| `backend/src/routes.ts` | Register absence routes |

### Frontend
| File | Action |
|------|--------|
| `frontend/src/components/absences/AbsenceJustificationModal.tsx` | Blocking popup |
| `frontend/src/services/absence.service.ts` | API service |
| `frontend/src/types/absence.ts` | Type definitions |
| `frontend/src/pages/team-leader/daily-monitoring.page.tsx` | Add review section |
| `frontend/src/app/router.tsx` or App wrapper | Check for pending on load |
