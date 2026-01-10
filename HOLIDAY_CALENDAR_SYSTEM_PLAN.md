# Holiday & Calendar System Implementation Plan

## Overview

This document outlines the implementation plan for the Holiday and Calendar system in Aegira. The system allows:
- **Executive**: Manage company holidays (add/remove by clicking dates on calendar)
- **Team Leader**: View calendar with holidays, team exemptions, and check-in requirements
- **Worker**: View personal calendar with their required check-in days, holidays, and exemptions

---

## System Architecture

### User Roles & Calendar Access

| Role | Calendar View | Can Add Holiday | Can See |
|------|---------------|-----------------|---------|
| Executive | Full calendar | Yes (click to add/remove) | All company holidays |
| Team Leader | Read-only | No | Holidays + Team exemptions |
| Worker | Read-only | No | Holidays + Own exemptions + Required check-ins |

---

## Database Schema

### New Model: Holiday

```prisma
model Holiday {
  id          String   @id @default(cuid())
  companyId   String
  date        DateTime @db.Date
  name        String
  createdBy   String   // Executive who added
  createdAt   DateTime @default(now())

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  creator     User     @relation("HolidayCreator", fields: [createdBy], references: [id])

  @@unique([companyId, date])  // One holiday per date per company
  @@index([companyId])
  @@index([date])
  @@map("holidays")
}
```

### Update Company Model

```prisma
model Company {
  // ... existing fields
  holidays    Holiday[]  // Add relation
}
```

### Update User Model

```prisma
model User {
  // ... existing fields
  createdHolidays  Holiday[]  @relation("HolidayCreator")
}
```

---

## API Endpoints

### Holiday Management (Executive Only)

```
GET    /api/holidays
       - Query: ?year=2026&month=1 (optional filters)
       - Returns: List of holidays for company
       - Access: All authenticated users (read)

POST   /api/holidays
       - Body: { date: "2026-01-01", name: "New Year's Day" }
       - Returns: Created holiday
       - Access: EXECUTIVE only

DELETE /api/holidays/:id
       - Returns: Success/Error
       - Access: EXECUTIVE only

GET    /api/holidays/calendar
       - Query: ?year=2026&month=1
       - Returns: Calendar data with holidays for the month
       - Access: All authenticated users
```

### Calendar View Endpoints

```
GET    /api/calendar/my
       - Query: ?year=2026&month=1
       - Returns: Personal calendar data
         - holidays: Company holidays
         - exemptions: User's approved exemptions
         - workDays: Team's work days (MON,TUE,etc)
         - checkins: User's check-ins for the month
       - Access: WORKER, MEMBER

GET    /api/calendar/team
       - Query: ?year=2026&month=1
       - Returns: Team calendar data
         - holidays: Company holidays
         - exemptions: All team exemptions
         - workDays: Team's work days
         - memberCheckins: Check-in status per member per day
       - Access: TEAM_LEAD
```

---

## Backend Implementation

### File: `backend/src/modules/holidays/index.ts`

```typescript
// Holiday routes
// - GET /holidays - List holidays
// - POST /holidays - Add holiday (Executive only)
// - DELETE /holidays/:id - Remove holiday (Executive only)
// - GET /holidays/calendar - Calendar view data
```

### File: `backend/src/modules/calendar/index.ts`

```typescript
// Calendar routes for workers and team leads
// - GET /calendar/my - Worker's personal calendar
// - GET /calendar/team - Team leader's team calendar
```

### Update: `backend/src/modules/checkins/index.ts`

Add holiday check after work day validation:

```typescript
// Line ~237, after work day check
// Check if today is a company holiday
const holiday = await prisma.holiday.findFirst({
  where: {
    companyId,
    date: todayForDb,
  },
});

if (holiday) {
  return c.json({
    error: `Today is a company holiday (${holiday.name}). Check-in is not required.`,
    code: 'HOLIDAY'
  }, 400);
}
```

### Update: `backend/src/modules/teams/index.ts`

#### Team Stats (GET /teams/:id/stats)

```typescript
// Check if today is a holiday
const isHoliday = await prisma.holiday.findFirst({
  where: { companyId, date: todayForDb }
});

// Update expected calculation
const expectedToCheckIn = (isTodayWorkDay && !isHoliday)
  ? memberIds.length - membersOnLeaveIds.size
  : 0;
```

#### Team Analytics (GET /teams/my/analytics)

```typescript
// Fetch holidays for the period
const holidays = await prisma.holiday.findMany({
  where: {
    companyId,
    date: {
      gte: startDate,
      lte: endDate,
    },
  },
});

// In trendData loop, check if day is a holiday
const isHolidayDay = holidays.some(h => isSameDay(h.date, currentDate, timezone));

if (isHolidayDay) {
  const holidayInfo = holidays.find(h => isSameDay(h.date, currentDate, timezone));
  trendData.push({
    date: formatLocalDate(currentDate, timezone),
    score: null,
    compliance: null,  // Skip in average calculation
    checkedIn: 0,
    onExemption: 0,
    isHoliday: true,
    holidayName: holidayInfo?.name || 'Holiday',
    hasData: false,
  });
  continue; // Skip to next day
}
```

---

## Frontend Implementation

### New Pages

#### 1. Executive Holiday Management
**File:** `frontend/src/pages/executive/holidays.page.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ Company Holidays                                                │
│ Click on a date to add or remove a holiday                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────┐  ┌──────────────────┐ │
│  │        ◀  January 2026  ▶            │  │ Holidays 2026    │ │
│  │                                      │  │                  │ │
│  │  Sun  Mon  Tue  Wed  Thu  Fri  Sat   │  │ Jan 1 - New Year │ │
│  │                 🔴1   2    3    4    │  │ Apr 9 - Araw ng  │ │
│  │   5    6    7    8    9   10   11    │  │ May 1 - Labor    │ │
│  │  12   13   14   15   16   17   18    │  │ Jun 12 - Indep.  │ │
│  │  19   20   21   22   23   24   25    │  │ Dec 25 - Xmas    │ │
│  │  26   27   28   29   30   31         │  │ Dec 30 - Rizal   │ │
│  │                                      │  │                  │ │
│  └──────────────────────────────────────┘  └──────────────────┘ │
│                                                                 │
│  🔴 = Holiday    ⬜ = Work Day    ⬛ = Non-Work Day              │
│                                                                 │
│  ℹ️ Holidays apply to all teams. Workers cannot check in on     │
│     these dates and compliance is not affected.                 │
└─────────────────────────────────────────────────────────────────┘
```

**Interaction:**
- Click on a date → Modal opens:
  - If no holiday: "Add holiday for [date]?" + Name input
  - If holiday exists: "Remove [name] from [date]?"

#### 2. Worker Calendar View
**File:** `frontend/src/pages/worker/calendar.page.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ My Calendar                                                     │
│ View your check-in schedule and time off                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────┐  ┌──────────────────┐ │
│  │        ◀  January 2026  ▶            │  │ Legend           │ │
│  │                                      │  │                  │ │
│  │  Sun  Mon  Tue  Wed  Thu  Fri  Sat   │  │ 🟢 Checked In    │ │
│  │                 🔴1  🟢2  🟢3   4    │  │ 🟡 Late          │ │
│  │   5   🟢6  🟢7  🟢8  🟢9  🟢10  11   │  │ ⚪ Pending       │ │
│  │  12   ⚪13 ⚪14 ⚪15 ⚪16 ⚪17  18    │  │ 🔴 Holiday       │ │
│  │  19   ⚪20 ⚪21 ⚪22 ⚪23 ⚪24  25    │  │ 🟣 Exemption     │ │
│  │  26   ⚪27 ⚪28 ⚪29 ⚪30 ⚪31         │  │ ⬛ Day Off       │ │
│  │                                      │  │                  │ │
│  └──────────────────────────────────────┘  └──────────────────┘ │
│                                                                 │
│  📊 This Month: 15 work days | 10 checked in | 1 holiday        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Click on date:**
- Shows check-in details (if checked in)
- Shows exemption info (if exempted)
- Shows holiday name (if holiday)

#### 3. Team Leader Calendar View
**File:** `frontend/src/pages/team-leader/team-calendar.page.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ Team Calendar                                                   │
│ View team schedule, holidays, and exemptions                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────┐  ┌──────────────────┐ │
│  │        ◀  January 2026  ▶            │  │ January 6, 2026  │ │
│  │                                      │  │                  │ │
│  │  Sun  Mon  Tue  Wed  Thu  Fri  Sat   │  │ 🟢 Juan (8:02am) │ │
│  │                 🔴1   ●2   ●3   4    │  │ 🟢 Maria (8:15am)│ │
│  │   5    ●6   ●7  [●8]  ●9  ●10  11    │  │ 🟣 Pedro (Leave) │ │
│  │  12   ●13  ●14  ●15  ●16  ●17  18    │  │                  │ │
│  │  19   ●20  ●21  ●22  ●23  ●24  25    │  │ 2/3 Checked In   │ │
│  │  26   ●27  ●28  ●29  ●30  ●31        │  │                  │ │
│  │                                      │  │                  │ │
│  └──────────────────────────────────────┘  └──────────────────┘ │
│                                                                 │
│  🔴 Holiday    ● Work Day    🟣 Has Exemptions    ⬛ Day Off     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Click on date:**
- Shows all team members' status for that day
- Check-in times, exemptions, etc.

---

## Navigation Updates

### Executive Sidebar
```typescript
// frontend/src/config/navigation.ts
{
  id: 'holidays',
  label: 'Company Holidays',
  href: '/executive/holidays',
  icon: Calendar,
}
```

### Worker Sidebar
```typescript
{
  id: 'my-calendar',
  label: 'My Calendar',
  href: '/calendar',
  icon: Calendar,
}
```

### Team Leader Sidebar
```typescript
{
  id: 'team-calendar',
  label: 'Team Calendar',
  href: '/team/calendar',
  icon: Calendar,
}
```

---

## Router Updates

### File: `frontend/src/app/router.tsx`

```typescript
// Executive routes
{ path: '/executive/holidays', element: <HolidaysPage /> }

// Worker routes
{ path: '/calendar', element: <WorkerCalendarPage /> }

// Team Leader routes
{ path: '/team/calendar', element: <TeamCalendarPage /> }
```

---

## Calendar Component

### Shared Calendar Component
**File:** `frontend/src/components/calendar/Calendar.tsx`

```typescript
interface CalendarProps {
  year: number;
  month: number;
  onDateClick?: (date: Date) => void;
  holidays: Holiday[];
  exemptions?: Exemption[];
  checkins?: Checkin[];
  workDays: string; // "MON,TUE,WED,THU,FRI"
  readOnly?: boolean;
  renderDay?: (date: Date, data: DayData) => ReactNode;
}

interface DayData {
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isExempted: boolean;
  exemptionType?: string;
  checkin?: Checkin;
  isToday: boolean;
  isPast: boolean;
}
```

---

## Service Layer

### File: `frontend/src/services/holiday.service.ts`

```typescript
// Get holidays for a year/month
export async function getHolidays(year?: number, month?: number): Promise<Holiday[]>

// Add a holiday (Executive only)
export async function addHoliday(date: string, name: string): Promise<Holiday>

// Remove a holiday (Executive only)
export async function removeHoliday(id: string): Promise<void>
```

### File: `frontend/src/services/calendar.service.ts`

```typescript
// Get personal calendar data (Worker)
export async function getMyCalendar(year: number, month: number): Promise<CalendarData>

// Get team calendar data (Team Leader)
export async function getTeamCalendar(year: number, month: number): Promise<TeamCalendarData>
```

---

## Type Definitions

### File: `frontend/src/types/calendar.ts`

```typescript
export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export interface CalendarData {
  holidays: Holiday[];
  exemptions: Exemption[];
  checkins: Checkin[];
  workDays: string;
  team: {
    shiftStart: string;
    shiftEnd: string;
  };
}

export interface TeamCalendarData extends CalendarData {
  members: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  memberCheckins: Map<string, Map<string, Checkin>>; // userId -> date -> checkin
  memberExemptions: Map<string, Exemption[]>; // userId -> exemptions
}

export interface DayInfo {
  date: string;
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isExempted: boolean;
  exemptionInfo?: {
    type: string;
    reason: string;
  };
  checkinStatus?: 'GREEN' | 'YELLOW' | 'RED' | null;
  checkinTime?: string;
}
```

---

## Implementation Order

### Phase 1: Database & Backend Core
1. Add Holiday model to Prisma schema
2. Run migration
3. Create holidays module (CRUD endpoints)
4. Create calendar module (read-only endpoints)

### Phase 2: Backend Integration
5. Update checkins module - add holiday check
6. Update teams module - skip holidays in stats
7. Update teams module - skip holidays in analytics

### Phase 3: Frontend Core
8. Create Calendar component (shared)
9. Create holiday.service.ts
10. Create calendar.service.ts
11. Add type definitions

### Phase 4: Frontend Pages
12. Create Executive holidays page
13. Create Worker calendar page
14. Create Team Leader calendar page
15. Update navigation and router

### Phase 5: Testing & Polish
16. Test holiday blocking on check-in
17. Test compliance calculation with holidays
18. Test calendar views for all roles
19. UI polish and responsive design

---

## Edge Cases to Handle

1. **Holiday on non-work day**: Show in calendar but no effect on compliance
2. **Exemption + Holiday same day**: Holiday takes precedence (both skip check-in)
3. **Past holidays**: Can add/remove (for data correction)
4. **Future holidays**: Normal add/remove
5. **Timezone**: All dates stored as @db.Date, use company timezone for display
6. **Multiple exemptions on same day**: Show all in calendar detail

---

## UI/UX Guidelines

### Calendar Colors
- 🟢 Green: Checked in (on-time)
- 🟡 Yellow: Checked in (late)
- 🔴 Red: Holiday
- 🟣 Purple: Exemption/Leave
- ⚪ White/Light: Work day (pending/future)
- ⬛ Gray: Non-work day (weekend, etc.)

### Interactions
- **Executive**: Click date → Add/Remove holiday modal
- **Team Leader**: Click date → View team status for that day
- **Worker**: Click date → View own status/check-in details

### Responsive Design
- Desktop: Calendar + sidebar list
- Tablet: Calendar + collapsible sidebar
- Mobile: Calendar only, click for details

---

## Success Criteria

1. Executive can add/remove holidays by clicking calendar dates
2. Holidays block check-in with clear message
3. Holidays don't affect compliance (skipped in calculation)
4. Team analytics shows holidays in trend data
5. Workers see their required check-in days clearly
6. Team leaders see full team schedule with exemptions
7. All calendar views are timezone-aware

---

## Files to Create/Modify Summary

### New Files
- `backend/src/modules/holidays/index.ts`
- `backend/src/modules/calendar/index.ts`
- `frontend/src/pages/executive/holidays.page.tsx`
- `frontend/src/pages/worker/calendar.page.tsx`
- `frontend/src/pages/team-leader/team-calendar.page.tsx`
- `frontend/src/components/calendar/Calendar.tsx`
- `frontend/src/services/holiday.service.ts`
- `frontend/src/services/calendar.service.ts`
- `frontend/src/types/calendar.ts`

### Modified Files
- `backend/prisma/schema.prisma` - Add Holiday model
- `backend/src/routes.ts` - Add holiday & calendar routes
- `backend/src/modules/checkins/index.ts` - Add holiday check
- `backend/src/modules/teams/index.ts` - Skip holidays in stats/analytics
- `frontend/src/config/navigation.ts` - Add calendar menu items
- `frontend/src/app/router.tsx` - Add calendar routes

---

*Document created: January 7, 2026*
*Last updated: January 7, 2026*
