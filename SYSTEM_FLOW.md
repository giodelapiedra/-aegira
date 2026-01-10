# Aegira System Flow Documentation

## Overview

Aegira is an attendance management system with wellness monitoring, leave management, and incident reporting capabilities.

---

## Role Hierarchy

```
ADMIN → EXECUTIVE → SUPERVISOR → TEAM_LEAD → WORKER/MEMBER
(highest)                                      (lowest)
```

---

## 1. Worker Check-in Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    WORKER OPENS APP                                   │
└─────────────────────────────┬────────────────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │   VALIDATION CHECKS:           │
              │   • Worker role?               │
              │   • Has team?                  │
              │   • Work day today?            │
              │   • Not a holiday?             │
              │   • Within shift hours?        │
              │   • Not checked in yet?        │
              │   • No approved leave?         │
              └───────────────┬───────────────┘
                              ▼
                 ┌────────────────────────┐
           NO ◄──┤   ALL CHECKS PASS?     ├──► YES
                 └────────────────────────┘
                 │                              │
                 ▼                              ▼
        ┌────────────────┐          ┌──────────────────────┐
        │  ERROR MESSAGE │          │  SHOW CHECK-IN FORM  │
        │  (cannot       │          │  • Mood (0-100)      │
        │   check in)    │          │  • Stress (0-100)    │
        └────────────────┘          │  • Sleep (0-100)     │
                                    │  • Physical (0-100)  │
                                    │  • Notes (optional)  │
                                    └──────────┬───────────┘
                                               ▼
                              ┌────────────────────────────────┐
                              │    CALCULATE READINESS SCORE   │
                              │    Average of 4 metrics        │
                              └────────────────┬───────────────┘
                                               ▼
                 ┌─────────────────────────────────────────────┐
                 │              READINESS STATUS               │
                 ├─────────────────────────────────────────────┤
                 │  GREEN  = Score >= 70 (Ready)               │
                 │  YELLOW = Score 50-69 (Limited)             │
                 │  RED    = Score < 50 (Critical)             │
                 └─────────────────────┬───────────────────────┘
                                       ▼
                 ┌─────────────────────────────────────────────┐
                 │           ATTENDANCE STATUS                 │
                 ├─────────────────────────────────────────────┤
                 │  GREEN  = On-time (within 15-min grace)     │
                 │          = 100 points                       │
                 │  YELLOW = Late (after grace period)         │
                 │          = 75 points                        │
                 └─────────────────────┬───────────────────────┘
                                       ▼
                          ┌────────────────────┐
                    NO ◄──┤  RED READINESS?    ├──► YES
                          └────────────────────┘
                          │                         │
                          ▼                         ▼
               ┌──────────────────┐    ┌─────────────────────────┐
               │  SUCCESS!        │    │  MODAL: "Request        │
               │  Check-in saved  │    │  exemption?"            │
               │  Streak updated  │    └───────────┬─────────────┘
               └──────────────────┘                ▼
                                      ┌─────────────────────────┐
                                      │  Worker selects reason: │
                                      │  • Physical Injury      │
                                      │  • Illness              │
                                      │  • Poor Sleep           │
                                      │  • High Stress          │
                                      │  • Personal Issues      │
                                      │  • Family Emergency     │
                                      │  • Work Related         │
                                      │  • Other                │
                                      └───────────┬─────────────┘
                                                  ▼
                                      ┌─────────────────────────┐
                                      │  EXEMPTION REQUEST      │
                                      │  Status: PENDING        │
                                      │  → Notify Team Leader   │
                                      └─────────────────────────┘
```

### Check-in Validation Details

| Check | Description |
|-------|-------------|
| Role | Only MEMBER/WORKER roles can check in |
| Team | User must belong to a team |
| Work Day | Today must be in team's scheduled work days (e.g., MON-FRI) |
| Holiday | Today must not be a company holiday |
| Shift Hours | Current time must be within shift (with 15-min grace before) |
| Already Checked In | User hasn't already checked in today |
| Leave Status | User is not on approved leave |

---

## 2. Exemption Approval Flow (Team Leader)

```
┌──────────────────────────────────────────────────────────────────────┐
│                 TEAM LEADER DAILY MONITORING                          │
└─────────────────────────────┬────────────────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │  SEES PENDING EXEMPTIONS:      │
              │  • Worker name                 │
              │  • RED check-in details        │
              │  • Readiness score             │
              │  • Reason given                │
              └───────────────┬───────────────┘
                              ▼
                 ┌────────────────────────┐
                 │   TEAM LEADER DECIDES  │
                 └────────────────────────┘
                 │                        │
         ┌───────┘                        └───────┐
         ▼                                        ▼
┌──────────────────┐                    ┌──────────────────┐
│     APPROVE      │                    │     REJECT       │
│  Set return date │                    │  Add notes       │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         ▼                                       ▼
┌──────────────────────────┐          ┌──────────────────────┐
│  Exemption APPROVED       │          │  Exemption REJECTED  │
│  Worker exempt from       │          │  Worker still needs  │
│  check-in until return    │          │  to check-in         │
│  date                     │          └──────────────────────┘
│  Attendance = EXCUSED     │
└──────────────────────────┘
```

### Exemption vs Exception

| Exemption | Exception (Leave) |
|-----------|-------------------|
| Triggered by RED check-in | Worker-initiated request |
| Worker provides reason only | Worker provides dates + reason |
| Team Lead sets return date | Worker specifies start/end dates |
| Immediate (starts tomorrow) | Can be for future dates |

---

## 3. Exception/Leave Request Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│              WORKER REQUESTS LEAVE (Exception)                        │
└─────────────────────────────┬────────────────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │  WORKER FILLS FORM:            │
              │  • Leave Type:                 │
              │    - SICK_LEAVE               │
              │    - PERSONAL_LEAVE           │
              │    - MEDICAL_APPOINTMENT      │
              │    - FAMILY_EMERGENCY         │
              │    - OTHER                    │
              │  • Start Date                  │
              │  • End Date                    │
              │  • Reason                      │
              │  • Link to Incident (optional) │
              └───────────────┬───────────────┘
                              ▼
              ┌───────────────────────────────┐
              │  Exception created             │
              │  Status: PENDING               │
              │  → Notify Team Leader          │
              └───────────────┬───────────────┘
                              ▼
                 ┌────────────────────────┐
                 │   TEAM LEADER REVIEWS  │
                 └────────────────────────┘
                 │                        │
         ┌───────┘                        └───────┐
         ▼                                        ▼
┌──────────────────┐                    ┌──────────────────┐
│     APPROVE      │                    │     REJECT       │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         ▼                                       ▼
┌──────────────────────────┐          ┌──────────────────────┐
│  Leave APPROVED           │          │  Leave REJECTED      │
│  Worker exempt from       │          │  Worker must attend  │
│  check-in during period   │          │  work                │
│  Attendance = EXCUSED     │          └──────────────────────┘
│  (NOT counted in score)   │
└──────────────────────────┘
```

### Leave Types

| Type | Description |
|------|-------------|
| SICK_LEAVE | Illness or health-related absence |
| PERSONAL_LEAVE | Personal matters |
| MEDICAL_APPOINTMENT | Scheduled medical visit |
| FAMILY_EMERGENCY | Family-related urgent matters |
| OTHER | Other reasons (requires explanation) |

---

## 4. Incident Reporting Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    WORKER REPORTS INCIDENT                            │
└─────────────────────────────┬────────────────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │  INCIDENT FORM:                │
              │  • Type: INJURY, ILLNESS,      │
              │    MENTAL_HEALTH, EQUIPMENT,   │
              │    ENVIRONMENTAL, OTHER        │
              │  • Severity: LOW, MEDIUM,      │
              │    HIGH, CRITICAL              │
              │  • Title & Description         │
              │  • Location                    │
              │  • Request leave? (optional)   │
              └───────────────┬───────────────┘
                              ▼
              ┌───────────────────────────────┐
              │  System generates:             │
              │  Case #: INC-2026-0001        │
              │  Auto-assign to Team Lead      │
              │  Status: OPEN                  │
              │  → Notify Team Leader          │
              └───────────────┬───────────────┘
                              ▼
              ┌───────────────────────────────┐
              │  TEAM LEADER MANAGES:          │
              │  OPEN → IN_PROGRESS →         │
              │  RESOLVED → CLOSED            │
              │                                │
              │  • Update severity             │
              │  • Add comments                │
              │  • Reassign if needed          │
              │  • Upload RTW certificate      │
              └───────────────────────────────┘
```

### Incident Status Flow

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
  │         │            │
  └─────────┴────────────┴──► Can add comments at any stage
```

### Incident Severity Levels

| Severity | Description |
|----------|-------------|
| LOW | Minor issue, no immediate action needed |
| MEDIUM | Moderate concern, should be addressed soon |
| HIGH | Serious issue, requires prompt attention |
| CRITICAL | Urgent, requires immediate action |

---

## 5. Performance Scoring System

### Attendance Points

| Status | Points | Description |
|--------|--------|-------------|
| GREEN | 100 | On-time (within 15-min grace period) |
| YELLOW | 75 | Late (after grace period) |
| ABSENT | 0 | No check-in, no approved leave |
| EXCUSED | N/A | Approved leave (not counted) |

### Performance Formula

```
Performance Score = (Total Points / Counted Days) × 10

Where:
- Total Points = Sum of all GREEN (100) + YELLOW (75) + ABSENT (0)
- Counted Days = GREEN days + YELLOW days + ABSENT days
- EXCUSED days are NOT counted
```

### Example Calculation

```
Week Summary:
- 3 GREEN days  = 300 points
- 2 YELLOW days = 150 points
- 1 ABSENT day  = 0 points
- 1 EXCUSED day = Not counted

Counted Days = 3 + 2 + 1 = 6
Total Points = 300 + 150 + 0 = 450
Performance Score = (450 / 6) × 10 = 75.0
Grade = C
```

### Grade Scale

| Grade | Score Range |
|-------|-------------|
| A | 90 - 100 |
| B | 80 - 89 |
| C | 70 - 79 |
| D | Below 70 |

### Data Visibility Design Decision (Trust-First Approach)

**Important:** Grades, scores, and metrics are **NOT visible to workers** to encourage honest check-ins.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA VISIBILITY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WORKER sees:                  TEAM LEAD sees:                   │
│  ├─ Check-in status only       ├─ Individual grades (A,B,C,D)   │
│  │   (GREEN/YELLOW/RED)        ├─ Individual scores (0-100)     │
│  ├─ Check-in count             ├─ Readiness scores              │
│  ├─ Week calendar (✓ only)     ├─ Metrics (Mood,Stress,etc)     │
│  ├─ Leave status               ├─ Attendance breakdown          │
│  └─ Supportive messages        ├─ Sudden change detection       │
│                                └─ Full team analytics           │
│     NO grades                                                    │
│     NO scores                                                    │
│     NO metrics breakdown                                         │
│     NO rankings                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**What was removed from Worker view:**
- Attendance Grade (A, B, C, D)
- Attendance Score (85%)
- Readiness Score percentage (75%)
- Today's Metrics (Mood, Stress, Sleep, Physical breakdown)
- Average scores and trends
- Attendance breakdown (On-time, Late, Absent counts)

**What Workers still see:**
- Check-in status badge (GREEN/YELLOW/RED)
- Week calendar with checkmarks (✓) for completed days
- Check-in count (simple number)
- Supportive messaging and tips
- RED alert for exemption requests

**Rationale:**
- Showing grades/scores to workers creates "mental health surveillance" anxiety
- Workers may game the system or provide dishonest check-ins to look better
- The purpose of check-ins is to get honest wellness data for support, not evaluation
- Team Leaders monitor all data privately and reach out supportively when needed
- Honest data = actionable insights for the company

---

## 6. Role-Based Features

### Worker Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WORKER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Daily Check-in           • View own attendance history                    │
│  • Request Exception/Leave  • View check-in streak & count                   │
│  • Report Incident          • View own incidents                             │
│  • View Notifications       • Personal Calendar                              │
│                                                                              │
│  NOTE: Workers do NOT see grades or performance scores (by design)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Team Leader Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TEAM LEADER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Daily Monitoring Dashboard   • Team Calendar                              │
│  • Approve/Reject Exemptions    • AI Chat/Insights                          │
│  • Approve/Reject Leaves        • Team Analytics                             │
│  • Manage Team Incidents        • View Team Member Profiles                  │
│  • View Team Check-ins          • Sudden Change Detection                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Supervisor Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPERVISOR                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  • View All Personnel           • View All Teams Analytics                   │
│  • Company-wide Dashboard       • Cross-team Comparisons                     │
│  • All Incidents View           • No approval powers (view only)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Executive Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXECUTIVE                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Full Company Dashboard       • Create User Accounts                       │
│  • Manage Teams                 • Company Calendar/Holidays                  │
│  • Manage Users                 • System Logs (Audit Trail)                  │
│  • View All Analytics           • Company Settings                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Feature Access Matrix

| Feature | Worker | Team Lead | Supervisor | Executive |
|---------|:------:|:---------:|:----------:|:---------:|
| Check-in | ✅ | ❌ | ❌ | ❌ |
| Request Leave | ✅ | ❌ | ❌ | ❌ |
| Report Incident | ✅ | ✅ | ✅ | ✅ |
| **View Grades/Scores** | **❌** | **✅** | **✅** | **✅** |
| Approve Exemptions | ❌ | ✅ | ❌ | ❌ |
| Approve Leaves | ❌ | ✅ | ❌ | ❌ |
| View Team Members | ❌ | ✅ (own) | ✅ (all) | ✅ (all) |
| Daily Monitoring | ❌ | ✅ | ✅ | ✅ |
| Manage Incidents | ❌ | ✅ (assigned) | ✅ (all) | ✅ (all) |
| Team Analytics | ❌ | ✅ | ✅ | ✅ |
| Create Users | ❌ | ❌ | ❌ | ✅ |
| Manage Teams | ❌ | ❌ | ❌ | ✅ |
| System Logs | ❌ | ❌ | ❌ | ✅ |

---

## 7. Daily Monitoring Dashboard (Team Leader)

### Dashboard Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DAILY MONITORING DASHBOARD                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        TODAY'S METRICS                               │    │
│  │  Total Members: 10  |  Checked In: 8  |  On Leave: 1  |  Missing: 1 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      CHECK-IN BREAKDOWN                              │    │
│  │  GREEN: 5  |  YELLOW: 2  |  RED: 1                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     SUDDEN CHANGES DETECTED                          │    │
│  │  • Juan dela Cruz - Score dropped 35 pts (CRITICAL)                 │    │
│  │  • Maria Santos - Score dropped 22 pts (SIGNIFICANT)                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    PENDING EXEMPTIONS (2)                            │    │
│  │  • Pedro Reyes - RED check-in, reason: Illness                      │    │
│  │    [APPROVE] [REJECT]                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ACTIVE EXEMPTIONS (1)                             │    │
│  │  • Ana Garcia - Returns: Jan 15, 2026                               │    │
│  │    [END EARLY]                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sudden Change Detection

| Severity | Score Drop | Priority |
|----------|------------|----------|
| CRITICAL | >= 30 points | Highest |
| SIGNIFICANT | >= 20 points | High |
| NOTABLE | >= 10 points | Medium |
| MINOR | < 10 points | Low |

---

## 8. Timezone Handling

All dates and times use the **Company Timezone** (default: Asia/Manila).

### Why This Matters

```
Example:
- Server stores: 2026-01-10 16:00:00 UTC
- Company timezone: Asia/Manila (UTC+8)
- Displayed as: 2026-01-11 00:00:00 Manila time

This affects:
- Check-in eligibility (based on company time)
- Attendance status calculation
- Leave date ranges
- Work day determination
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `getTodayRange(timezone)` | Get start/end of today in company TZ |
| `getTimeInTimezone()` | Convert UTC to company TZ |
| `getDateStringInTimezone()` | Get YYYY-MM-DD in company TZ |
| `getDayOfWeekInTimezone()` | Get day name (MON, TUE, etc.) |

---

## 9. System Logs (Audit Trail)

### Logged Actions

| Action | Description |
|--------|-------------|
| CHECKIN_SUBMITTED | Worker submitted check-in |
| EXCEPTION_CREATED | Leave request created |
| EXCEPTION_APPROVED | Leave approved by TL |
| EXCEPTION_REJECTED | Leave rejected by TL |
| EXEMPTION_APPROVED | Exemption approved by TL |
| EXEMPTION_REJECTED | Exemption rejected by TL |
| INCIDENT_CREATED | Incident report submitted |
| INCIDENT_UPDATED | Incident status/details changed |
| USER_CREATED | New user account created |
| TEAM_CREATED | New team created |

### Log Data Structure

```
{
  userId: "...",
  companyId: "...",
  action: "CHECKIN_SUBMITTED",
  details: {
    checkinId: "...",
    readinessScore: 75,
    attendanceStatus: "GREEN"
  },
  ipAddress: "192.168.1.1",
  createdAt: "2026-01-10T08:00:00Z"
}
```

---

## 10. API Endpoints Summary

### Worker Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checkins` | Submit daily check-in |
| GET | `/checkins/history` | Get check-in history |
| GET | `/checkins/leave-status` | Check if on leave |
| POST | `/exceptions` | Request leave |
| GET | `/exceptions/my` | Get own leave requests |
| POST | `/incidents` | Report incident |
| GET | `/incidents/my` | Get own incidents |

### Team Leader Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/daily-monitoring` | Get team dashboard data |
| GET | `/exemptions/pending` | Get pending exemptions |
| PUT | `/exemptions/:id/approve` | Approve exemption |
| PUT | `/exemptions/:id/reject` | Reject exemption |
| GET | `/exceptions/pending` | Get pending leaves |
| PUT | `/exceptions/:id/approve` | Approve leave |
| PUT | `/exceptions/:id/reject` | Reject leave |
| GET | `/teams/:id/members` | Get team members |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/dashboard` | Company dashboard |
| GET | `/analytics/team/:id` | Team analytics |
| GET | `/analytics/attendance` | Attendance stats |

---

## 11. Complete User Journey

### Worker's Daily Journey

```
1. Morning
   └─► Open app
       └─► Check if work day & not on leave
           └─► Fill check-in form (mood, stress, sleep, physical)
               └─► Submit
                   ├─► GREEN/YELLOW: Done for the day
                   └─► RED: Prompted to request exemption
                       └─► Submit exemption reason
                           └─► Wait for TL approval

2. If incident occurs
   └─► Report incident
       └─► Optionally link to leave request
           └─► Wait for TL to manage

3. Need time off
   └─► Submit leave request
       └─► Specify dates & reason
           └─► Wait for TL approval
```

### Team Leader's Daily Journey

```
1. Morning
   └─► Open Daily Monitoring dashboard
       └─► Review today's check-ins
           └─► Note any RED statuses
               └─► Check sudden changes

2. Review pending items
   └─► Pending exemptions
       └─► Approve with return date OR reject
   └─► Pending leave requests
       └─► Approve OR reject

3. Manage incidents
   └─► Review open incidents
       └─► Update status, add comments
           └─► Close when resolved

4. End of day
   └─► Check who didn't check in
       └─► Review team analytics
```

### Executive's Weekly Journey

```
1. Review company metrics
   └─► Overall check-in rates
       └─► Team comparisons
           └─► Incident statistics

2. User management
   └─► Create new accounts
       └─► Manage team assignments

3. Audit review
   └─► Check system logs
       └─► Review any anomalies
```

---

## 12. Tech Stack Reference

| Layer | Technology |
|-------|------------|
| Backend | Hono (TypeScript) |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Frontend | React + TypeScript |
| State | Zustand |
| Data Fetching | React Query |
| Styling | Tailwind CSS |
| Auth | Supabase Auth + JWT |
| AI | OpenAI GPT-4 |

---

*Last updated: January 2026*
