# DailyTeamSummary Implementation Plan

## Overview

Pre-computed daily statistics per team to optimize analytics queries. Instead of querying thousands of check-in records, we read pre-aggregated daily summaries.

---

## 1. Schema Design

```prisma
model DailyTeamSummary {
  id                  String   @id @default(uuid())
  teamId              String
  companyId           String
  date                DateTime @db.Date

  // === FLAGS ===
  isWorkDay           Boolean  // Based on team.workDays (MON,TUE,WED,THU,FRI)
  isHoliday           Boolean  // Based on company Holiday table

  // === MEMBER COUNTS ===
  totalMembers        Int      // Active WORKER/MEMBER in team (snapshot)
  onLeaveCount        Int      // Members with APPROVED exemption covering this date
  expectedToCheckIn   Int      // totalMembers - onLeaveCount (0 if !isWorkDay or isHoliday)

  // === CHECK-IN STATS ===
  checkedInCount      Int      @default(0)
  notCheckedInCount   Int      @default(0)  // expectedToCheckIn - checkedInCount
  greenCount          Int      @default(0)
  yellowCount         Int      @default(0)
  redCount            Int      @default(0)

  // === SCORES ===
  avgReadinessScore   Float?   // Average of all check-in scores (null if no check-ins)
  complianceRate      Float?   // checkedIn / expected * 100 (null if expected = 0)

  // === METADATA ===
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // === RELATIONS ===
  team                Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  company             Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // === INDEXES ===
  @@unique([teamId, date])
  @@index([companyId, date])
  @@index([date])

  @@map("daily_team_summaries")
}
```

---

## 2. Core Logic

### 2.1 Determining isWorkDay

```typescript
// Team.workDays = "MON,TUE,WED,THU,FRI"
const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const workDaysList = team.workDays.split(',').map(d => d.trim().toUpperCase());
const currentDayName = dayNames[dateInTimezone.getDay()];
const isWorkDay = workDaysList.includes(currentDayName);
```

### 2.2 Determining isHoliday

```typescript
const holiday = await prisma.holiday.findFirst({
  where: {
    companyId,
    date: targetDate,  // @db.Date field
  },
});
const isHoliday = !!holiday;
```

### 2.3 Counting Members on Leave

```typescript
// Exemption covers date if: startDate <= date <= endDate
const onLeaveCount = await prisma.exception.count({
  where: {
    userId: { in: teamMemberIds },
    status: 'APPROVED',
    startDate: { lte: targetDate },
    endDate: { gte: targetDate },
  },
});
```

### 2.4 Calculating expectedToCheckIn

```typescript
if (!isWorkDay || isHoliday) {
  expectedToCheckIn = 0;
} else {
  expectedToCheckIn = totalMembers - onLeaveCount;
}
```

### 2.5 Calculating Compliance Rate

```typescript
if (expectedToCheckIn === 0) {
  complianceRate = null;  // N/A - no one expected
} else {
  complianceRate = (checkedInCount / expectedToCheckIn) * 100;
}
```

---

## 3. Timezone Handling

All date calculations must use **company timezone**, not UTC.

```typescript
import { getTodayForDbDate } from '../utils/date-helpers.js';

// Get "today" in company timezone for @db.Date fields
const company = await prisma.company.findUnique({ where: { id: companyId } });
const timezone = company?.timezone || 'Asia/Manila';
const todayDate = getTodayForDbDate(timezone);
```

### Important:
- Check-in `createdAt` is stored in UTC
- Summary `date` is stored as @db.Date (date only, no time)
- Use company timezone to determine which "day" a check-in belongs to

---

## 4. When Summary is Updated

| Event | Action |
|-------|--------|
| Worker checks in | Recalculate summary for their team + today |
| Exemption APPROVED | Recalculate summaries for affected date range |
| Exemption REJECTED/CANCELLED | Recalculate summaries for affected date range |
| Holiday ADDED | Recalculate summary for that date for all teams |
| Holiday REMOVED | Recalculate summary for that date for all teams |
| Member ADDED to team | Recalculate today's summary |
| Member REMOVED from team | Recalculate today's summary |
| End of day (optional cron) | Finalize/verify today's summaries |

---

## 5. Edge Cases

### 5.1 New Worker (< 3 check-ins)
- **Included** in DailyTeamSummary counts (totalMembers, checkedInCount)
- **Filtered out** in analytics display using `user.totalCheckins < 3` threshold
- Summary stores raw data; analytics applies business rules

### 5.2 Worker Transferred Mid-Day
- If checked in before transfer: check-in stays with OLD team's summary
- New team's summary: worker counted in totalMembers but not checkedIn
- Recommendation: Transfers should happen at start of day

### 5.3 Exemption Approved Retroactively
- Recalculate summaries for all dates in exemption range
- May change compliance from 80% to 100% (if missing day was due to leave)

### 5.4 Multiple Check-ins Same Day
- Current system prevents this (one check-in per user per day)
- Summary counts unique users who checked in

### 5.5 Team with 0 Members
- totalMembers = 0
- expectedToCheckIn = 0
- complianceRate = null

### 5.6 All Members on Leave
- totalMembers = 5
- onLeaveCount = 5
- expectedToCheckIn = 0
- complianceRate = null (not 0% - nobody was expected)

---

## 6. Recalculation Function

```typescript
async function recalculateDailyTeamSummary(
  teamId: string,
  date: Date,  // @db.Date format
  timezone: string
): Promise<DailyTeamSummary> {

  // 1. Get team with members
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
        select: { id: true },
      },
    },
  });

  const memberIds = team.members.map(m => m.id);
  const totalMembers = memberIds.length;

  // 2. Check if work day
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const workDaysList = team.workDays.split(',').map(d => d.trim().toUpperCase());
  const dayOfWeek = date.getDay();
  const isWorkDay = workDaysList.includes(dayNames[dayOfWeek]);

  // 3. Check if holiday
  const holiday = await prisma.holiday.findFirst({
    where: { companyId: team.companyId, date },
  });
  const isHoliday = !!holiday;

  // 4. Count members on leave
  const onLeaveCount = await prisma.exception.count({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  // 5. Calculate expected
  const expectedToCheckIn = (!isWorkDay || isHoliday) ? 0 : (totalMembers - onLeaveCount);

  // 6. Get check-in stats for this date
  const { start, end } = getDateRange(date, timezone);  // Start and end of day in timezone

  const checkins = await prisma.checkin.findMany({
    where: {
      userId: { in: memberIds },
      createdAt: { gte: start, lt: end },
    },
    select: {
      readinessScore: true,
      readinessStatus: true,
    },
  });

  const checkedInCount = checkins.length;
  const notCheckedInCount = Math.max(0, expectedToCheckIn - checkedInCount);
  const greenCount = checkins.filter(c => c.readinessStatus === 'GREEN').length;
  const yellowCount = checkins.filter(c => c.readinessStatus === 'YELLOW').length;
  const redCount = checkins.filter(c => c.readinessStatus === 'RED').length;

  // 7. Calculate scores
  const avgReadinessScore = checkins.length > 0
    ? checkins.reduce((sum, c) => sum + c.readinessScore, 0) / checkins.length
    : null;

  const complianceRate = expectedToCheckIn > 0
    ? (checkedInCount / expectedToCheckIn) * 100
    : null;

  // 8. Upsert summary
  return prisma.dailyTeamSummary.upsert({
    where: { teamId_date: { teamId, date } },
    create: {
      teamId,
      companyId: team.companyId,
      date,
      isWorkDay,
      isHoliday,
      totalMembers,
      onLeaveCount,
      expectedToCheckIn,
      checkedInCount,
      notCheckedInCount,
      greenCount,
      yellowCount,
      redCount,
      avgReadinessScore,
      complianceRate,
    },
    update: {
      isWorkDay,
      isHoliday,
      totalMembers,
      onLeaveCount,
      expectedToCheckIn,
      checkedInCount,
      notCheckedInCount,
      greenCount,
      yellowCount,
      redCount,
      avgReadinessScore,
      complianceRate,
      updatedAt: new Date(),
    },
  });
}
```

---

## 7. Migration for Historical Data

Need to generate summaries for all past dates with check-in data.

```typescript
async function migrateHistoricalSummaries() {
  // 1. Find date range (first check-in to today)
  const firstCheckin = await prisma.checkin.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  const startDate = firstCheckin.createdAt;
  const endDate = new Date();

  // 2. Get all teams
  const teams = await prisma.team.findMany({
    where: { isActive: true },
  });

  // 3. For each team, for each date, recalculate
  for (const team of teams) {
    const company = await prisma.company.findUnique({ where: { id: team.companyId } });
    const timezone = company?.timezone || 'Asia/Manila';

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      await recalculateDailyTeamSummary(team.id, currentDate, timezone);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
}
```

---

## 8. Analytics Query Examples

### Before (Slow):
```typescript
// 30-day compliance: Query 600+ check-ins, calculate on-the-fly
const checkins = await prisma.checkin.findMany({
  where: {
    user: { teamId },
    createdAt: { gte: thirtyDaysAgo },
  },
});
// + exemptions query
// + holidays query
// + work days calculation
// = Complex and slow
```

### After (Fast):
```typescript
// 30-day compliance: Read 30 pre-computed rows
const summaries = await prisma.dailyTeamSummary.findMany({
  where: {
    teamId,
    date: { gte: thirtyDaysAgo },
    isWorkDay: true,
    isHoliday: false,
  },
});

const totalExpected = summaries.reduce((sum, s) => sum + s.expectedToCheckIn, 0);
const totalCheckedIn = summaries.reduce((sum, s) => sum + s.checkedInCount, 0);
const compliance = (totalCheckedIn / totalExpected) * 100;
```

---

## 9. Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add DailyTeamSummary model |
| `src/utils/daily-summary.ts` | NEW: Recalculation functions |
| `src/modules/checkins/index.ts` | Call recalculate on check-in |
| `src/modules/exceptions/index.ts` | Call recalculate on exemption status change |
| `src/modules/holidays/index.ts` | Call recalculate on holiday add/remove |
| `src/modules/teams/index.ts` | Call recalculate on member add/remove |
| `src/modules/analytics/index.ts` | Use summary table for queries |
| `migrate-daily-summaries.ts` | NEW: Historical data migration |

---

## 10. Implementation Checklist

- [x] Add DailyTeamSummary to schema (`prisma/schema.prisma`)
- [x] Push schema to database (run `npm run db:push`)
- [x] Create `src/utils/daily-summary.ts` with recalculation logic
- [x] Update check-in creation to recalculate summary (`src/modules/checkins/index.ts`)
- [x] Update exemption approval/rejection to recalculate summaries (`src/modules/exceptions/index.ts`)
- [x] Update holiday add/remove to recalculate summaries (`src/modules/holidays/index.ts`)
- [x] Update team member add/remove to recalculate summary (`src/modules/teams/index.ts`)
- [x] Update team workDays change to recalculate summary
- [x] Update team deactivation/reactivation to recalculate summary
- [x] Create migration script for historical data (`migrate-daily-summaries.ts`)
- [x] Run migration (88 summaries created for 44 days × 2 teams)
- [x] Update analytics module to use summary table
  - [x] `/analytics/dashboard` - Uses DailyTeamSummary for company-wide stats
  - [x] `/analytics/team/:teamId` - Uses DailyTeamSummary for team stats
- [x] Test all scenarios
- [ ] Remove old complex queries (optional - keep for fallback)

### Additional Features Implemented

- [x] Worker Health Report API (`GET /teams/members/:userId/health-report`)
  - Generates comprehensive health report for claim validation
  - Monthly baseline history using GROUP BY
  - Period-based baseline calculation

- [x] Worker Health History API (`GET /teams/members/:userId/health-history`)
  - Get check-in history around a specific date
  - Useful for validating claims by showing data before and after an incident

---

## 11. Summary Table Data Example

```
Team: Alpha Team (5 members)
Company Timezone: Asia/Manila
Work Days: MON, TUE, WED, THU, FRI

┌────────────┬─────────┬─────────┬─────────┬────────┬──────────┬────────┬───────┬─────┬─────┬──────────┬────────────┐
│    Date    │ WorkDay │ Holiday │ Members │ OnLeave│ Expected │ Checked│ Green │ Yel │ Red │ AvgScore │ Compliance │
├────────────┼─────────┼─────────┼─────────┼────────┼──────────┼────────┼───────┼─────┼─────┼──────────┼────────────┤
│ 2026-01-05 │  true   │  false  │    5    │   0    │    5     │   5    │   4   │  1  │  0  │   82.5   │   100.0%   │
│ 2026-01-06 │  true   │  false  │    5    │   1    │    4     │   4    │   3   │  1  │  0  │   78.2   │   100.0%   │
│ 2026-01-07 │  true   │  false  │    5    │   1    │    4     │   3    │   2   │  1  │  0  │   75.0   │    75.0%   │
│ 2026-01-08 │  true   │  false  │    5    │   0    │    5     │   5    │   4   │  0  │  1  │   71.8   │   100.0%   │
│ 2026-01-09 │  true   │  false  │    5    │   0    │    5     │   5    │   5   │  0  │  0  │   85.4   │   100.0%   │
│ 2026-01-10 │  false  │  false  │    5    │   0    │    0     │   0    │   0   │  0  │  0  │   null   │    null    │ ← Saturday
│ 2026-01-11 │  false  │  false  │    5    │   0    │    0     │   0    │   0   │  0  │  0  │   null   │    null    │ ← Sunday
│ 2026-01-01 │  true   │  true   │    5    │   0    │    0     │   0    │   0   │  0  │  0  │   null   │    null    │ ← Holiday
└────────────┴─────────┴─────────┴─────────┴────────┴──────────┴────────┴───────┴─────┴─────┴──────────┴────────────┘

Weekly Stats (Jan 5-9, work days only):
- Total Expected: 5+4+4+5+5 = 23
- Total Checked In: 5+4+3+5+5 = 22
- Weekly Compliance: 22/23 = 95.7%
- Average Readiness: (82.5+78.2+75.0+71.8+85.4) / 5 = 78.6
```

---

## 12. Questions to Consider

1. **Should we store summaries for non-work days?**
   - Current plan: YES, with expectedToCheckIn = 0
   - Benefit: Complete historical record, easier queries

2. **How far back should migration go?**
   - Recommendation: From first check-in date
   - Or: Last 90-180 days if too much data

3. **Real-time vs End-of-day calculation?**
   - Current plan: Real-time (on each check-in)
   - Alternative: Batch calculation at end of day (simpler but delayed)

4. **What if team.workDays changes?**
   - Need to recalculate affected summaries
   - Or: Store workDays snapshot in summary (denormalization)

---

## Ready for Implementation

**Status: FULLY IMPLEMENTED** (2026-01-12)

Core implementation is complete and verified:
- [x] Schema model added and pushed to database
- [x] Utility functions created
- [x] All module integrations done (check-ins, exemptions, holidays, teams)
- [x] Additional triggers: workDays change, team deactivation/reactivation
- [x] Worker health report APIs added
- [x] End-to-end testing passed
- [x] Historical data migration completed
- [x] Analytics module updated to use DailyTeamSummary

Migration Results:
- Date range: Nov 30, 2025 to Jan 12, 2026 (44 days)
- Teams processed: 2 (Alpha Team, Bravo Team)
- Total summaries: 88 records
- Summaries with check-ins: 53
- Errors: 0

Optimized Endpoints:
- `/analytics/dashboard` - Now uses pre-computed DailyTeamSummary
- `/analytics/team/:teamId` - Now uses pre-computed DailyTeamSummary
- `/teams/:id/stats` - Now uses pre-computed DailyTeamSummary

Frontend Updates:
- Team Lead Overview page now shows: On Leave count, Avg Score, Holiday/Rest Day indicators
- Stats come from DailyTeamSummary for fast loading

Note: Complex analytics (team grades, AI summaries) still use direct queries
because they need per-member data not stored in team-level summaries.

