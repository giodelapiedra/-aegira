# Aegira System Flow Documentation

Complete documentation of the check-in, attendance, exception, and scoring system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Roles](#user-roles)
3. [Team Assignment](#team-assignment)
4. [Daily Check-in Process](#daily-check-in-process)
5. [Readiness Scoring](#readiness-scoring)
6. [Attendance Scoring](#attendance-scoring)
7. [Exception (Leave) System](#exception-leave-system)
8. [Performance Score Calculation](#performance-score-calculation)
9. [Complete Flow Examples](#complete-flow-examples)

---

## System Overview

Aegira is a workforce readiness and attendance tracking system. Workers check in daily to report their physical and mental state, and the system tracks their attendance, calculates readiness scores, and manages leave/exception requests.

### Key Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        AEGIRA SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   CHECK-IN  │───>│  READINESS  │    │      EXCEPTION      │ │
│  │   (Daily)   │    │    SCORE    │    │    (Leave Request)  │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                                        │              │
│         v                                        v              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  ATTENDANCE TRACKING                     │   │
│  │    GREEN (100) | YELLOW (75) | ABSENT (0) | EXCUSED     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              v                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               PERFORMANCE SCORE (Lazy Evaluation)        │   │
│  │           Total Score ÷ Counted Days = Average           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles

### Role Hierarchy

| Role        | Description                                      | Check-in Required |
|-------------|--------------------------------------------------|-------------------|
| `ADMIN`     | Super admin - manages all companies              | No               |
| `EXECUTIVE` | Company executive - sees analytics, all data     | No               |
| `SUPERVISOR`| Company supervisor - monitors all teams          | No               |
| `TEAM_LEAD` | Team leader - manages their team                 | No               |
| `MEMBER`    | Team member - daily check-in required            | **Yes**          |
| `WORKER`    | Team worker - daily check-in required            | **Yes**          |

### Important Note

Both `MEMBER` and `WORKER` roles have the same check-in and attendance requirements. The system checks for both roles in all relevant places:

```typescript
// Example role check
if (user.role === 'MEMBER' || user.role === 'WORKER') {
  // User must check in, can report incidents, request exceptions, etc.
}
```

---

## Team Assignment

### Team Structure

Each team has:
- **Name**: Team identifier
- **Work Days**: e.g., `"MON,TUE,WED,THU,FRI"`
- **Shift Start**: e.g., `"08:00"`
- **Shift End**: e.g., `"17:00"`
- **Team Leader**: Assigned user who approves exceptions

### teamJoinedAt Field

When a user is assigned to a team, the system records `teamJoinedAt` timestamp:

```typescript
// When adding member to team
await prisma.user.update({
  where: { id: userId },
  data: {
    teamId: teamId,
    teamJoinedAt: new Date()  // Records when user joined this team
  },
});
```

**Why `teamJoinedAt` matters:**
- Attendance tracking starts from this date
- Days before joining are NOT counted as absent
- Prevents false "21 Absent" errors for new team members

### Requirements for Check-in

A user must have:
1. Role = `MEMBER` or `WORKER`
2. Assigned to a team (`teamId` set)
3. Team has a leader (`team.leaderId` set) - for exception approval

---

## Daily Check-in Process

### Check-in Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                       CHECK-IN PROCESS                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User opens check-in page                                     │
│                     ▼                                            │
│  2. System validates:                                            │
│     ├─ Is user MEMBER or WORKER? ───────────> No: Block          │
│     ├─ Is user assigned to team? ───────────> No: Block          │
│     ├─ Is user on approved leave? ──────────> Yes: Block         │
│     ├─ Is today a work day? ────────────────> No: Block          │
│     ├─ Is it within shift hours? ───────────> No: Block          │
│     └─ Already checked in today? ───────────> Yes: Block         │
│                     ▼                                            │
│  3. User submits check-in data:                                  │
│     • Mood (1-10)                                                │
│     • Stress (1-10)                                              │
│     • Sleep (1-10)                                               │
│     • Physical Health (1-10)                                     │
│     • Notes (optional)                                           │
│                     ▼                                            │
│  4. System calculates:                                           │
│     • Readiness Score (0-100)                                    │
│     • Readiness Status (GREEN/YELLOW/RED)                        │
│     • Attendance Status (GREEN or YELLOW based on time)          │
│                     ▼                                            │
│  5. System creates:                                              │
│     • Checkin record                                             │
│     • DailyAttendance record                                     │
│     • Updates user streak                                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Check-in Time Windows

```
                    SHIFT TIMING EXAMPLE
                    Shift: 08:00 - 17:00
                    Grace Period: 15 minutes

    07:30        08:00        08:15                   17:00
      │            │            │                       │
      ├────────────┼────────────┼───────────────────────┤
      │            │            │                       │
   TOO EARLY    SHIFT       GRACE     LATE (YELLOW)   TOO LATE
  (Can't check) STARTS     PERIOD                    (Can't check)
      │            │            │                       │
      │<-- 30min ->│<-- GREEN ->│<----- YELLOW ------->│
         early         on-time                         │
```

- **30 mins before shift**: Can check in early
- **Within grace period (15 mins)**: Marked as GREEN (on-time)
- **After grace period**: Marked as YELLOW (late)
- **After shift end**: Cannot check in

---

## Readiness Scoring

### Readiness Score Calculation

User inputs 4 metrics (1-10 scale):

```typescript
// Score calculation
const moodScore = (mood / 10) * 100;
const stressScore = ((10 - stress) / 10) * 100;  // Inverted! High stress = low score
const sleepScore = (sleep / 10) * 100;
const physicalScore = (physicalHealth / 10) * 100;

// Weighted average (equal weights)
const score = Math.round(
  moodScore * 0.25 +
  stressScore * 0.25 +
  sleepScore * 0.25 +
  physicalScore * 0.25
);
```

### Readiness Status Thresholds

| Score Range | Status  | Meaning                              |
|-------------|---------|--------------------------------------|
| 70-100      | GREEN   | Good readiness, ready for work       |
| 40-69       | YELLOW  | Moderate concern, monitor closely    |
| 0-39        | RED     | At risk, may need support            |

### Example Calculation

```
Input: mood=8, stress=3, sleep=7, physicalHealth=9

Mood:     (8/10) * 100 = 80
Stress:   ((10-3)/10) * 100 = 70  (inverted)
Sleep:    (7/10) * 100 = 70
Physical: (9/10) * 100 = 90

Score = (80 + 70 + 70 + 90) / 4 = 77.5 ≈ 78

Status = GREEN (score >= 70)
```

---

## Attendance Scoring

### Attendance Status Types

| Status    | Score | Counted | Description                              |
|-----------|-------|---------|------------------------------------------|
| `GREEN`   | 100   | Yes     | On-time check-in (within grace period)   |
| `YELLOW`  | 75    | Yes     | Late check-in (after grace period)       |
| `ABSENT`  | 0     | Yes     | No check-in and no approved exception    |
| `EXCUSED` | null  | **No**  | Has approved exception (leave)           |

### Key Points

1. **GREEN and YELLOW** are recorded when user checks in
2. **ABSENT** is determined lazily (on-demand) for past work days with no check-in
3. **EXCUSED** is determined by checking approved exceptions
4. **Only counted statuses affect performance score** - EXCUSED is excluded

### Grace Period for Attendance

```typescript
// Default grace period: 15 minutes
const gracePeriodMins = 15;

// Check-in time vs scheduled start
if (checkInMinutes <= scheduledMinutes + gracePeriodMins) {
  // GREEN - on time
} else {
  // YELLOW - late
}
```

---

## Exception (Leave) System

### Exception Types

| Type                 | Description                    |
|----------------------|--------------------------------|
| `SICK_LEAVE`         | User is unwell                 |
| `PERSONAL_LEAVE`     | Personal matters               |
| `MEDICAL_APPOINTMENT`| Scheduled medical visit        |
| `FAMILY_EMERGENCY`   | Urgent family situation        |
| `OTHER`              | Other reasons                  |

### Exception Status Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    EXCEPTION WORKFLOW                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐                                                 │
│  │ PENDING │ ──────────────────────────────────────────────┐│
│  └────┬────┘                                               ││
│       │                                                    ││
│       ├───────────────┬───────────────┐                    ││
│       ▼               ▼               ▼                    ││
│  ┌─────────┐    ┌──────────┐    ┌──────────┐              ││
│  │APPROVED │    │ REJECTED │    │CANCELLED │ <────────────┘│
│  └────┬────┘    └──────────┘    └──────────┘               │
│       │                                                     │
│       ▼                                                     │
│  Days covered by exception become EXCUSED                   │
│  (not counted in performance calculation)                   │
│                                                             │
└──────────────────────────────────────────────────────────────┘
```

### Exception Approval Impact

When an exception is **APPROVED**:
- All work days within `startDate` to `endDate` are marked as **EXCUSED**
- User cannot check in during this period (blocked)
- These days are **NOT counted** in performance score calculation

---

## Performance Score Calculation

### Lazy Evaluation Approach

The system uses **lazy evaluation** - it doesn't create ABSENT records proactively. Instead, it determines status on-demand when calculating performance.

### Calculation Logic

```typescript
async function calculatePerformanceScore(userId, startDate, endDate) {
  // 1. Get user's team and teamJoinedAt
  const user = await getUser(userId);

  // 2. Adjust start date - don't count before team assignment
  const effectiveStartDate = max(startDate, user.teamJoinedAt);

  // 3. For each work day in the period:
  for (let day = effectiveStartDate; day <= endDate; day++) {
    if (!isWorkDay(day, team.workDays)) continue;

    // Check for existing attendance record
    const record = getAttendanceRecord(userId, day);

    if (record) {
      // Use recorded status (GREEN, YELLOW, etc.)
      addToScore(record.status);
    } else if (hasApprovedException(userId, day)) {
      // Has approved leave = EXCUSED (not counted)
      breakdown.excused++;
    } else if (day < today) {
      // Past day with no record and no exception = ABSENT
      breakdown.absent++;
      addToScore(0);  // ABSENT = 0 points
    }
    // Future days are skipped
  }

  // 4. Calculate average
  return totalScore / countedDays;
}
```

### Formula

```
Performance Score = (Total Score of Counted Days) ÷ (Number of Counted Days)

Where:
- GREEN days contribute 100 points each
- YELLOW days contribute 75 points each
- ABSENT days contribute 0 points each
- EXCUSED days are NOT counted (excluded from both numerator and denominator)
```

### Performance Grades

| Score Range | Grade | Label     |
|-------------|-------|-----------|
| 90-100      | **A** | Excellent |
| 80-89       | **B** | Good      |
| 70-79       | **C** | Fair      |
| 0-69        | **D** | Poor      |

### Example Calculation

```
User joined team on Dec 15, 2025
Calculating last 30 days (Dec 5, 2025 - Jan 4, 2026)
Team work days: MON, TUE, WED, THU, FRI

Effective start: Dec 15, 2025 (not Dec 5, because user joined on Dec 15)

Work days since Dec 15: 15 days

Breakdown:
- GREEN: 8 days × 100 = 800
- YELLOW: 3 days × 75 = 225
- ABSENT: 2 days × 0 = 0
- EXCUSED: 2 days (not counted)

Counted days: 8 + 3 + 2 = 13 (EXCUSED excluded)
Total score: 800 + 225 + 0 = 1025

Performance Score = 1025 ÷ 13 = 78.8%
Grade: C (Fair)
```

---

## Complete Flow Examples

### Example 1: Normal Work Day

```
User: John (WORKER role, Team A)
Date: Monday (work day)
Shift: 08:00 - 17:00

08:05 - John opens check-in page
      - System validates: WORKER role ✓, Team assigned ✓,
        No leave ✓, Work day ✓, Within shift ✓, Not checked in ✓

08:05 - John submits: mood=7, stress=4, sleep=8, physical=7
      - Readiness Score: 70 (GREEN)
      - Attendance: GREEN (checked in at 08:05, within 15min grace)

Result:
- Checkin record created
- DailyAttendance record: status=GREEN, score=100
- Streak updated
```

### Example 2: Late Check-in

```
User: Jane (MEMBER role, Team B)
Date: Tuesday (work day)
Shift: 09:00 - 18:00

09:30 - Jane checks in (30 minutes late)
      - Attendance: YELLOW (after 15min grace period)
      - Minutes late: 15 (30 - 15 grace = 15 mins late)

Result:
- Attendance: YELLOW, score=75, minutesLate=15
```

### Example 3: Approved Leave

```
User: Bob (WORKER role, Team C)
Date Range: Jan 2-3, 2026

Jan 1 - Bob submits exception request (Sick Leave)
Jan 1 - Team Lead approves exception

Jan 2 - Bob tries to check in
      - System: "You are on approved sick leave"
      - Check-in blocked

Jan 4 - Performance calculation
      - Jan 2: EXCUSED (approved leave)
      - Jan 3: EXCUSED (approved leave)
      - These days NOT counted in score
```

### Example 4: Missed Check-in (Absent)

```
User: Alice (MEMBER role, Team D)
Date: Wednesday (work day)

Alice does not check in on Wednesday.
No approved exception for Wednesday.

Thursday - System calculates attendance history:
- Wednesday: No attendance record, no exception
- Status: ABSENT, score=0
- This pulls down Alice's performance average
```

### Example 5: New Team Member

```
User: Mike (WORKER role)
Date: Jan 4, 2026

Jan 4 - Mike added to Team E
      - teamJoinedAt = Jan 4, 2026

Jan 4 - Mike's dashboard shows:
      - "Last 30 days" attendance
      - System calculates from Jan 4 (teamJoinedAt), not 30 days ago
      - Result: 0 days tracked (just joined today)
      - No false ABSENT records from before team assignment
```

---

## API Endpoints Summary

### Check-in Endpoints

| Endpoint                          | Method | Description                    |
|-----------------------------------|--------|--------------------------------|
| `/checkins`                       | POST   | Submit daily check-in          |
| `/checkins/today`                 | GET    | Get today's check-in           |
| `/checkins/my`                    | GET    | Get user's check-in history    |
| `/checkins/leave-status`          | GET    | Check if on leave/returning    |
| `/checkins/attendance/today`      | GET    | Get today's attendance status  |
| `/checkins/attendance/history`    | GET    | Get attendance history (lazy)  |
| `/checkins/attendance/performance`| GET    | Get performance score          |

### Exception Endpoints

| Endpoint                          | Method | Description                    |
|-----------------------------------|--------|--------------------------------|
| `/exceptions`                     | POST   | Create exception request       |
| `/exceptions/my`                  | GET    | Get user's exceptions          |
| `/exceptions/pending`             | GET    | Get pending exceptions         |
| `/exceptions/:id/approve`         | PATCH  | Approve exception              |
| `/exceptions/:id/reject`          | PATCH  | Reject exception               |
| `/exceptions/:id/end-early`       | PATCH  | End approved exception early   |

---

## Database Models

### Key Fields

```prisma
model User {
  teamId       String?    // Current team assignment
  teamJoinedAt DateTime?  // When assigned to current team
  // Used for attendance tracking start date
}

model DailyAttendance {
  userId       String
  date         DateTime   // Work day date
  status       String     // GREEN, YELLOW, ABSENT, EXCUSED
  score        Int?       // 100, 75, 0, or null
  isCounted    Boolean    // Whether to count in performance
  checkInTime  DateTime?  // When user checked in
  minutesLate  Int        // Minutes late (0 if on time)
}

model Exception {
  userId       String
  status       String     // PENDING, APPROVED, REJECTED
  type         String     // SICK_LEAVE, PERSONAL_LEAVE, etc.
  startDate    DateTime
  endDate      DateTime
  // When APPROVED, days are EXCUSED
}
```

---

## Summary

1. **MEMBER/WORKER users** must check in daily on work days
2. **Readiness Score** (0-100) calculated from mood, stress, sleep, physical health
3. **Attendance Status**: GREEN (on-time), YELLOW (late), ABSENT (missed), EXCUSED (on leave)
4. **Approved Exceptions** make days EXCUSED (not counted in score)
5. **Performance Score** = average of counted days only
6. **teamJoinedAt** ensures attendance tracking starts from team assignment date
7. **Lazy Evaluation** - ABSENT determined on-demand, not via cron jobs
