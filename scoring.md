# Worker Scoring System

## Overview
Performance scoring system para sa workers based on Team Lead schedule, with Exception Approval workflow.

---

## Status Definitions (Based on Team Schedule)

| Status    | Condition                              | Score  |
|-----------|----------------------------------------|--------|
| GREEN     | On-time check-in, full work hours      | 100    |
| YELLOW    | Late ≤30min OR early-out ≤30min        | 70-85  |
| RED       | Late >30min OR missed check-in         | 30-50  |
| EXCUSED   | Approved exception (sick, emergency)   | —      |
| ABSENT    | No check-in, no exception request      | 0      |

---

## Sample Daily Check-ins

| Araw    | Status         | Score |
|---------|----------------|-------|
| Day 1   | GREEN          | 100   |
| Day 2   | GREEN          | 95    |
| Day 3   | YELLOW         | 75    |
| Day 4   | EXCUSED (Sick) | —     |
| Day 5   | GREEN          | 98    |
| Day 6   | RED            | 40    |
| Day 7   | GREEN          | 92    |
| Day 8   | GREEN          | 96    |
| Day 9   | YELLOW         | 70    |
| Day 10  | GREEN          | 100   |

### Computation:
```
(100 + 95 + 75 + 98 + 40 + 92 + 96 + 70 + 100) ÷ 9 = 85.1
```

### Dashboard Display:
- **Performance Score:** 85
- **Excused Days:** 1
- **Absent Days:** 0

### Attendance View (Separate)
| Type         | Count |
|--------------|-------|
| Worked Days  | 9     |
| Excused Days | 1     |
| Absent Days  | 0     |

---

## Exception Approval Workflow

### Main Flow
```
┌─────────────────────────────────────────────────────────────┐
│  TEAM LEAD sets schedule (e.g., 9AM-6PM, Mon-Fri)           │
│                         ↓                                    │
│  WORKER dapat mag check-in within that schedule             │
│                         ↓                                    │
│  IF late/absent/early-out → System auto-flags as YELLOW/RED │
│                         ↓                                    │
│  WORKER can request Exception Approval                      │
│                         ↓                                    │
│  TEAM LEAD approves/rejects                                 │
│                         ↓                                    │
│  IF APPROVED → Status changes to EXCUSED (no score impact)  │
│  IF REJECTED → Original score remains (YELLOW/RED)          │
└─────────────────────────────────────────────────────────────┘
```

### Exception Types

| Type           | Auto-Score After Approval   |
|----------------|------------------------------|
| Sick Leave     | EXCUSED (—)                  |
| Emergency      | EXCUSED (—)                  |
| WFH Adjustment | Recalculate based on WFH sched |
| OT Offset      | EXCUSED or partial score     |

---

## Exception Lifecycle

### States Flow
```
┌──────────────────────────────────────────────────────────────────┐
│                    EXCEPTION STATES                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PENDING ──→ APPROVED ──→ ACTIVE ──→ ENDED                     │
│      │            │           │          │                       │
│      ↓            │           │          ↓                       │
│   REJECTED        │           │    Back to NORMAL SCORING        │
│                   │           │                                  │
│                   │           ├──→ EARLY_ENDED (Team Lead)       │
│                   │           │          │                       │
│                   │           │          ↓                       │
│                   │           │    Back to NORMAL SCORING        │
│                   │           │                                  │
│                   │           └──→ EXTENDED (needs new approval) │
│                   │                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Exception End Scenarios

### Scenario 1: Exception Ends Normally
```
Member: Juan
Exception: Sick Leave (Jan 5-7)
Status: APPROVED

Timeline:
├─ Jan 5  → EXCUSED (—)
├─ Jan 6  → EXCUSED (—)
├─ Jan 7  → EXCUSED (—)  ← Last day of exception
└─ Jan 8  → BACK TO NORMAL
            System expects check-in based on Team Schedule
            If no check-in = RED/ABSENT
            If on-time = GREEN
```

### Scenario 2: Team Lead Ends Early (Member Returns)
```
Member: Juan
Exception: Sick Leave (Jan 5-10) ← Approved 5 days
Team Lead Action: "End Exception" on Jan 7

Timeline:
├─ Jan 5  → EXCUSED (—)
├─ Jan 6  → EXCUSED (—)
├─ Jan 7  → Team Lead clicks "End Exception"
│           System asks: "Effective when?"
│           Option A: "End Today" → Jan 7 still EXCUSED, Jan 8 normal
│           Option B: "End Tomorrow" → Jan 8 becomes normal
└─ Jan 8  → BACK TO NORMAL SCORING
```

### Scenario 3: Auto-End + Grace Period
```
Exception ends: Jan 7 (Sunday)
Next working day: Jan 8 (Monday)

System Behavior on Jan 8:
├─ 6:00 AM  → System sends reminder: "Your exception ended. Please check-in today."
├─ 9:00 AM  → Grace period starts (Team Schedule)
├─ 9:15 AM  → Still within grace = GREEN if check-in
├─ 9:30 AM+ → Late = YELLOW/RED
└─ No check-in → RED/ABSENT
```

---

## Team Lead Actions (Dashboard UI)

### Active Exceptions View
```
┌─────────────────────────────────────────────────────┐
│  ACTIVE EXCEPTIONS                                  │
├─────────────────────────────────────────────────────┤
│  Juan Dela Cruz                                     │
│  Type: Sick Leave                                   │
│  Period: Jan 5-10, 2026                            │
│  Days Remaining: 3                                  │
│                                                     │
│  [View Details]  [End Exception]  [Extend]          │
└─────────────────────────────────────────────────────┘
```

### End Exception Modal
```
┌─────────────────────────────────────┐
│  End Exception for Juan Dela Cruz   │
├─────────────────────────────────────┤
│  Effective Date:                    │
│  ○ Today - Scoring starts tomorrow  │
│  ○ Immediately - Scoring starts now │
│                                     │
│  Reason (optional):                 │
│  [Member recovered and returned___] │
│                                     │
│  [Cancel]  [Confirm End]            │
└─────────────────────────────────────┘
```

---

## Automatic Notifications

| Event                        | Who Gets Notified | Message |
|------------------------------|-------------------|---------|
| Exception Ending Tomorrow    | Worker            | "Your sick leave ends tomorrow. Please check-in on Jan 8." |
| Exception Early Ended        | Worker            | "Your Team Lead has ended your exception. Normal schedule resumes on Jan 8." |
| Worker Back After Exception  | Team Lead         | "Juan has checked in after exception period." |
| No Check-in After Exception  | Team Lead         | "Warning: Juan did not check-in. Exception ended yesterday." |

---

## Database Schema

### team_schedules
Team Lead's defined schedule per team.
```
- id
- team_id
- working_days (e.g., ["Mon","Tue","Wed","Thu","Fri"])
- shift_start (e.g., "09:00")
- check_in_window_before (e.g., 30 mins before shift_start)
- grace_period_minutes (e.g., 15 mins after shift_start)
- created_by (team_lead_id)
- created_at
- updated_at
```

### worker_checkins
Daily check-in records.
```
- id
- worker_id
- team_id
- check_in_time
- date
- scheduled_start (from team_schedules)
- minutes_late (0 if on-time, positive if late)
- auto_status (GREEN/YELLOW/RED based on schedule)
- final_status (after exception approval)
- score
- created_at
```

### exception_requests
Pending/approved/rejected exception requests.
```
- id
- worker_id
- type (SICK, EMERGENCY, LEAVE, WFH_ADJUSTMENT, OT_OFFSET)
- start_date
- end_date (original approved end)
- actual_end_date (nullable - filled when early ended)
- status (PENDING, APPROVED, ACTIVE, ENDED, EARLY_ENDED, REJECTED)
- reason
- approved_by (team_lead_id)
- approved_at
- ended_by (team_lead_id, nullable)
- end_reason (nullable)
- created_at
- updated_at
```

### daily_scores
Computed scores per worker per day.
```
- id
- worker_id
- date
- status (GREEN/YELLOW/RED/EXCUSED/ABSENT)
- score (nullable if EXCUSED)
- exception_id (nullable, links to exception_requests)
- created_at
```

---

## Team Lead Schedule Integration

1. **Team Lead defines:** working_days, shift_start, shift_end, grace_period
2. **Worker score auto-computed** based on actual vs scheduled times
3. **Exception requests** go to Team Lead queue for approval
4. **Dashboard shows** real-time performance scores excluding EXCUSED days

---

## Detailed Score Computation (Daily Check-In)

### Check-In Window

Based on Team Lead Schedule (e.g., Shift Start: 9:00 AM, Grace Period: 15 mins)

```
CHECK-IN WINDOW RULES:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ❌ Before 8:30 AM    → Check-in NOT yet open              │
│                         (30 mins before shift)              │
│                                                             │
│  ✅ 8:30 AM - 9:15 AM → Check-in OPEN (On-time window)     │
│                                                             │
│  ✅ 9:16 AM onwards   → Check-in OPEN pero LATE na         │
│                                                             │
│  ❌ After shift end   → Check-in CLOSED for the day        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Check-In Scoring Table

| Check-In Time | Status | Score | Description |
|---------------|--------|-------|-------------|
| 8:30 - 9:00 AM | GREEN | 100 | Early (before shift start) |
| 9:00 - 9:15 AM | GREEN | 100 | Within grace period |
| 9:16 - 9:30 AM | YELLOW | 90 | Late 1-15 mins (after grace) |
| 9:31 - 9:45 AM | YELLOW | 80 | Late 16-30 mins |
| 9:46 - 10:00 AM | YELLOW | 70 | Late 31-45 mins |
| 10:01 - 10:30 AM | RED | 50 | Late 46-75 mins |
| 10:31 - 11:00 AM | RED | 40 | Late 76-105 mins |
| After 11:00 AM | RED | 30 | Very late (>2 hours) |
| No check-in | ABSENT | 0 | Did not check-in |

### Score Examples

```
Team Schedule: 9:00 AM start, 15 min grace period
Check-in Window Opens: 8:30 AM

┌─────────────────────────────────────────────────────────────┐
│ Scenario 1: Early Bird                                      │
│ Check-in: 8:45 AM                                          │
│ SCORE = 100 (GREEN)                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 2: On Time (Within Grace)                          │
│ Check-in: 9:10 AM                                          │
│ SCORE = 100 (GREEN)                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 3: Slightly Late                                   │
│ Check-in: 9:25 AM (10 mins after grace)                    │
│ SCORE = 90 (YELLOW)                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 4: Late                                            │
│ Check-in: 9:50 AM (35 mins late)                           │
│ SCORE = 70 (YELLOW)                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 5: Very Late                                       │
│ Check-in: 10:45 AM (>1.5 hours late)                       │
│ SCORE = 40 (RED)                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Scenario 6: No Show                                         │
│ Check-in: None                                             │
│ SCORE = 0 (ABSENT)                                         │
└─────────────────────────────────────────────────────────────┘
```

### Status Determination

| Score | Status |
|-------|--------|
| 100 | GREEN |
| 70-90 | YELLOW |
| 30-50 | RED |
| 0 | ABSENT |

---

## Member Dashboard Layout

### Full Dashboard View
```
┌─────────────────────────────────────────────────────────────────────────┐
│  DASHBOARD - Juan Dela Cruz                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐                    │
│  │   PERFORMANCE SCORE  │  │   TODAY'S STATUS     │                    │
│  │                      │  │                      │                    │
│  │        85            │  │      GREEN           │                    │
│  │      ━━━━━━━━        │  │     On Time          │                    │
│  │     Good Standing    │  │   Checked in: 8:45AM │                    │
│  └──────────────────────┘  └──────────────────────┘                    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  THIS WEEK'S PERFORMANCE                                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  Mon    Tue    Wed    Thu    Fri    Sat    Sun                   │  │
│  │  [98]   [95]   [75]   [--]   [92]   [ - ]  [ - ]                 │  │
│  │  GREEN  GREEN  YELLOW EXCUSED GREEN  OFF    OFF                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  ATTENDANCE SUMMARY     │  │  ACTIVE EXCEPTION                   │  │
│  │  (This Month)           │  │                                     │  │
│  ├─────────────────────────┤  │  Type: Sick Leave                   │  │
│  │  Worked Days:    18     │  │  Period: Jan 4-5                    │  │
│  │  Excused Days:    2     │  │  Status: APPROVED                   │  │
│  │  Absent Days:     0     │  │  Days Left: 1                       │  │
│  │  Late Days:       3     │  │                                     │  │
│  └─────────────────────────┘  │  [View Details]                     │  │
│                               └─────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  [+ Request Exception]   [View Full History]   [My Schedule]     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Performance Score Card
```
┌────────────────────────┐
│   PERFORMANCE SCORE    │
│                        │
│         85             │  ← Big number, easy to see
│       ━━━━━━━━         │  ← Progress bar (color coded)
│    "Good Standing"     │  ← Label based on score range
│                        │
│   Last 30 days avg     │  ← Period clarification
└────────────────────────┘

Score Ranges & Labels:
90-100 = "Excellent" (Green bar)
80-89  = "Good Standing" (Light Green bar)
70-79  = "Needs Improvement" (Yellow bar)
Below 70 = "At Risk" (Red bar)
```

### Today's Status Card
```
┌────────────────────────┐
│    TODAY'S STATUS      │
│                        │
│       GREEN            │  ← Color-coded status
│      On Time           │
│  Checked in: 8:45 AM   │  ← Actual check-in time
│  Schedule: 9:00 AM     │  ← Expected time (from Team Lead)
│  Score: 100            │  ← Today's score
│                        │
└────────────────────────┘
```

### Today's Score Breakdown (Expandable)
```
┌────────────────────────────────────────────┐
│  TODAY'S SCORE BREAKDOWN                   │
├────────────────────────────────────────────┤
│                                            │
│  Scheduled Start:       9:00 AM            │
│  Grace Period:          15 mins            │
│  Check-in Window:       8:30 AM - 9:15 AM  │
│                                            │
│  Your Check-in:         9:20 AM            │
│  Status:                Late by 5 mins     │
│                         (after grace)      │
│                                            │
│  ─────────────────────────────────         │
│  SCORE:                 90 (YELLOW)        │
│                                            │
└────────────────────────────────────────────┘
```

### Weekly Performance Visual
```
┌──────────────────────────────────────────────────┐
│  THIS WEEK                                       │
├──────────────────────────────────────────────────┤
│                                                  │
│   Mon   Tue   Wed   Thu   Fri   Sat   Sun       │
│   ┌─┐   ┌─┐   ┌─┐   ┌─┐   ┌─┐   ┌─┐   ┌─┐      │
│   │█│   │█│   │▄│   │ │   │█│   │-│   │-│      │
│   └─┘   └─┘   └─┘   └─┘   └─┘   └─┘   └─┘      │
│   98    95    75    --    92    OFF   OFF       │
│                      ↑                          │
│                  EXCUSED                        │
└──────────────────────────────────────────────────┘

Legend:
█ = GREEN (90-100)
▄ = YELLOW (70-89)
▂ = RED (30-69)
  = EXCUSED (no score)
- = OFF/Rest day
```

### Member Quick Actions

| Button | Function |
|--------|----------|
| Check In | Daily check-in (only available during check-in window) |
| Request Exception | Open form to request sick leave, emergency, etc. |
| View Full History | See all daily check-in scores (paginated) |
| My Schedule | View Team Lead's assigned schedule |

---

## History View (Member)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CHECK-IN HISTORY - January 2026                       [< Prev Month]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Date       Schedule    Check-In    Score    Status                  │
│  ─────────────────────────────────────────────────────────────────── │
│  Jan 10     9:00 AM     8:55 AM     100      GREEN                   │
│  Jan 9      9:00 AM     9:10 AM     100      GREEN     │
│  Jan 8      9:00 AM     9:25 AM     90       YELLOW    │
│  Jan 7      --          --          --       EXCUSED (Sick Leave)    │
│  Jan 6      9:00 AM     10:30 AM    50       RED    │
│  Jan 5      9:00 AM     9:00 AM     100      GREEN                   │
│  ...                                                                 │
│                                                                      │
│  [1] [2] [3] ... [Next >]                                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

