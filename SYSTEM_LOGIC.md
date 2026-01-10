# Aegira System Logic Documentation

> Official system flow and logic documentation for the Aegira Attendance & Wellness Management System

**Last Updated:** January 9, 2026
**Version:** 1.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Hierarchy](#2-user-roles--hierarchy)
3. [Daily Check-in Flow](#3-daily-check-in-flow)
4. [Attendance Scoring System](#4-attendance-scoring-system)
5. [Exemption/Leave Management](#5-exemptionleave-management)
6. [Incident Management](#6-incident-management)
7. [Team Management](#7-team-management)
8. [Analytics & AI Insights](#8-analytics--ai-insights)
9. [Holiday/Calendar System](#9-holidaycalendar-system)
10. [AI Chatbot](#10-ai-chatbot)
11. [Edge Cases & Special Scenarios](#11-edge-cases--special-scenarios)

---

## 1. System Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Hono + Prisma + TypeScript |
| Frontend | React + Zustand + React Query + Tailwind CSS |
| Database | PostgreSQL (via Supabase) |
| Authentication | Supabase Auth + JWT |
| AI | OpenAI GPT-4 |
| Timezone | Luxon (Asia/Manila default) |

### Core Purpose

Aegira is a comprehensive attendance and wellness management system that:
- Tracks daily employee wellness check-ins
- Monitors team health and readiness
- Manages leave/exemption requests
- Handles workplace incident reporting
- Generates AI-powered analytics and insights

---

## 2. User Roles & Hierarchy

### Role Levels (Highest to Lowest)

| Role | Level | Access Scope |
|------|-------|--------------|
| **ADMIN** | 6 | System-wide, all companies |
| **EXECUTIVE** | 5 | Company-wide control |
| **SUPERVISOR** | 4 | View all teams, analytics |
| **CLINICIAN** | 4 | Rehabilitation programs |
| **WHS_CONTROL** | 4 | Safety/incidents management |
| **TEAM_LEAD** | 3 | Own team only |
| **WORKER** | 2 | Own data only |

### Role Capabilities

```
WORKER:
  - Daily check-in
  - Request exemptions
  - Report incidents
  - View own history

TEAM_LEAD:
  - All WORKER capabilities
  - View team members
  - Approve/reject exemptions
  - Team analytics & AI insights
  - Daily monitoring dashboard

EXECUTIVE:
  - Manage all users
  - Manage all teams
  - Company settings
  - Holiday management
  - Company-wide analytics

ADMIN:
  - Cross-company access
  - System configuration
  - Template management
```

---

## 3. Daily Check-in Flow

### Check-in Window

```
Allowed: [Shift Start - 15 min] → [Shift End]

Example: Shift 08:00-17:00
  - Can check in: 07:45 - 17:00
  - Cannot check in: Before 07:45 or after 17:00
```

### Check-in Process

```
┌──────────────────────────────────────────────────────────┐
│                    WORKER CHECK-IN                        │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    Check Conditions    │
              │  - Is work day?        │
              │  - Within shift window?│
              │  - Not on holiday?     │
              │  - Not on leave?       │
              └────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
        [BLOCKED]     [ALLOWED]      [ON LEAVE]
            │              │              │
            │              ▼              ▼
            │     Submit Wellness     Show "On Leave"
            │     - Mood (1-10)       message
            │     - Stress (1-10)
            │     - Sleep (1-10)
            │     - Physical (1-10)
            │     - Notes (optional)
            │              │
            │              ▼
            │     Calculate Readiness
            │              │
            │              ▼
            │     Determine Status
            │     GREEN ≥70%
            │     YELLOW 50-69%
            │     RED <50%
            │              │
            │   ┌──────────┼──────────┐
            │   ▼          ▼          ▼
            │  GREEN     YELLOW      RED
            │   │          │          │
            │   │          │          ▼
            │   │          │    Require Reason
            │   │          │    + Offer Exemption
            │   │          │          │
            │   └──────────┴──────────┘
            │              │
            ▼              ▼
         [END]     Update Attendance
                   Update Streak
                   Create Records
```

### Readiness Score Calculation

```javascript
// Input: mood, stress, sleep, physicalHealth (each 1-10)

invertedStress = 11 - stress  // Invert stress (high stress = bad)
rawScore = (mood + invertedStress + sleep + physicalHealth) / 4
readinessScore = rawScore * 10  // Scale to 0-100

// Status thresholds
if (readinessScore >= 70) status = 'GREEN'
else if (readinessScore >= 50) status = 'YELLOW'
else status = 'RED'
```

**Example:**
```
Mood: 8, Stress: 3, Sleep: 7, Physical: 8
invertedStress = 11 - 3 = 8
rawScore = (8 + 8 + 7 + 8) / 4 = 7.75
readinessScore = 7.75 * 10 = 77.5% → GREEN
```

### Check-in Blocking Conditions

| Condition | Message |
|-----------|---------|
| Before shift window | "Too early, check-in opens at HH:MM" |
| After shift window | "Check-in closed for today" |
| Non-work day | "Not a scheduled work day" |
| Company holiday | "Today is a holiday" |
| On approved leave | "You're on leave until [date]" |
| Already checked in | "Already checked in today" |

---

## 4. Attendance Scoring System

### Daily Attendance Status

| Status | Points | Counted | Condition |
|--------|--------|---------|-----------|
| **GREEN** | 100 | Yes | On-time (within 15-min grace) |
| **YELLOW** | 75 | Yes | Late (after grace period) |
| **ABSENT** | 0 | Yes | No check-in, no exemption |
| **EXCUSED** | null | No | Approved exemption |

### Attendance Timing Logic

```
Shift Start: 08:00
Grace Period: 15 minutes

07:45 - 08:15 → GREEN (100 points)
08:16 - 17:00 → YELLOW (75 points)
No check-in   → ABSENT (0 points)
On leave      → EXCUSED (excluded)
```

### Performance Score Formula

```
Performance Score = (Total Points) / (Counted Days)

Example (30-day period):
┌─────────────────────────────────────┐
│ GREEN:   20 days × 100 = 2000 pts   │
│ YELLOW:   5 days ×  75 =  375 pts   │
│ ABSENT:   2 days ×   0 =    0 pts   │
│ EXCUSED:  3 days (not counted)      │
├─────────────────────────────────────┤
│ Total: 2375 pts / 27 days = 88%     │
└─────────────────────────────────────┘
```

### Grade Scale

| Grade | Score Range | Status |
|-------|-------------|--------|
| A | 90-100% | Excellent |
| B | 80-89% | Good |
| C | 70-79% | Fair |
| D | 60-69% | Poor |
| F | <60% | Failing |

### Streak System

```
┌─────────────────────────────────────────┐
│             STREAK LOGIC                │
├─────────────────────────────────────────┤
│ +1 on: GREEN or YELLOW check-in         │
│ Reset: ABSENT (no check-in, no excuse)  │
│ Preserved: Holidays, EXCUSED days       │
│ Continue: Returns from approved leave   │
└─────────────────────────────────────────┘
```

### Baseline Date Logic

The baseline date determines when a worker starts being counted for attendance:

```
Priority Order:
1. First ever check-in date (most accurate)
2. Day AFTER teamJoinedAt (if no check-ins yet)
3. Day AFTER createdAt (fallback)

Why: Prevents ABSENT marks before worker actually starts
```

---

## 5. Exemption/Leave Management

### Exception Types

| Type | Description |
|------|-------------|
| SICK_LEAVE | Illness/medical condition |
| PERSONAL_LEAVE | Personal matters |
| MEDICAL_APPOINTMENT | Doctor visits |
| FAMILY_EMERGENCY | Family-related urgent matters |
| TEAM_INACTIVE | Auto-created when team deactivated |
| OTHER | Miscellaneous reasons |

### Exemption Request Flow

```
┌──────────────────────────────────────────────────────────┐
│                  EXEMPTION REQUEST FLOW                   │
└──────────────────────────────────────────────────────────┘

[Worker RED Check-in] or [Worker requests leave]
                │
                ▼
        ┌───────────────┐
        │  POST /exemptions │
        │  - type           │
        │  - reason         │
        │  (no dates)       │
        └───────────────┘
                │
                ▼
        Status: PENDING
        Notify: Team Lead
                │
                ▼
        ┌───────────────────────┐
        │   TEAM LEAD REVIEW    │
        │   - View request      │
        │   - See user history  │
        │   - See recent scores │
        └───────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
    APPROVE         REJECT
        │               │
        ▼               ▼
   Set endDate     Status: REJECTED
   Status: APPROVED    │
        │               │
        ▼               ▼
   Create EXCUSED   Notify Worker
   attendance for       │
   each day             │
        │               │
        ▼               ▼
   Block check-ins    [END]
   until endDate+1
        │
        ▼
   Notify Worker
        │
        ▼
      [END]
```

### Leave Period Logic

```
CRITICAL: endDate = LAST DAY of leave (inclusive)

Example:
  Exemption approved with endDate = Jan 6

  Jan 5: On leave ✓ (check-in blocked)
  Jan 6: On leave ✓ (check-in blocked, LAST DAY)
  Jan 7: First work day (check-in required)

Return Flow:
  - System detects "isReturning" within 3 days of leave end
  - Shows "Welcome Back" message
  - Streak continues (not reset to 1)
```

### Attendance Records During Leave

```
For each day in leave period:
┌────────────────────────────────────┐
│ DailyAttendance record created:    │
│   status: 'EXCUSED'                │
│   score: null                      │
│   isCounted: false                 │
│   exceptionId: [linked]            │
└────────────────────────────────────┘
```

---

## 6. Incident Management

### Incident Types & Severity

**Types:**
- INJURY
- ILLNESS
- MENTAL_HEALTH
- EQUIPMENT
- ENVIRONMENTAL
- OTHER

**Severity Levels:**
- LOW
- MEDIUM
- HIGH
- CRITICAL

### Incident Status Flow

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED

┌─────────────────────────────────────────────────────────┐
│                  INCIDENT LIFECYCLE                      │
└─────────────────────────────────────────────────────────┘

[Worker Reports Incident]
         │
         ▼
    Status: OPEN
    Case #: INC-YYYY-XXXX
    Notify: Team Lead, WHS
         │
         ▼
    ┌──────────────────┐
    │  WHS/TL Assigns  │
    │  Status: IN_PROGRESS
    └──────────────────┘
         │
         ▼
    Investigation &
    Documentation
         │
         ▼
    ┌──────────────────┐
    │ Upload RTW Cert  │ (Return to Work)
    │ Status: RESOLVED │
    └──────────────────┘
         │
         ▼
    Final Review
    Status: CLOSED
```

### RTW (Return to Work) Certificate

```
Required for:
- CRITICAL severity incidents
- INJURY or ILLNESS types
- Before worker can return to full duty

Fields:
- rtwCertificateUrl: File URL
- rtwCertDate: Date certificate issued
- rtwUploadedBy: WHS user who uploaded
- rtwNotes: Additional notes
```

---

## 7. Team Management

### Team Configuration

```javascript
Team {
  name: "Production Team A",
  description: "Manufacturing floor team",
  leaderId: "uuid-of-team-lead",
  isActive: true,

  // Schedule
  workDays: "MON,TUE,WED,THU,FRI",
  shiftStart: "08:00",
  shiftEnd: "17:00",

  // Deactivation tracking
  deactivatedAt: null,
  deactivatedReason: null,
  reactivatedAt: null
}
```

### Team Deactivation Flow

```
┌─────────────────────────────────────────┐
│          TEAM DEACTIVATION              │
└─────────────────────────────────────────┘

[Executive deactivates team]
              │
              ▼
    Set team.isActive = false
    Set deactivatedAt = now
    Set deactivatedReason = "..."
              │
              ▼
    For each team member:
    Create TEAM_INACTIVE exception
    (startDate = today, endDate = null)
              │
              ▼
    Block all check-ins for team
              │
              ▼
         [LATER]
              │
              ▼
    [Executive reactivates team]
              │
              ▼
    Set team.isActive = true
    Set reactivatedAt = now
    Delete TEAM_INACTIVE exceptions
              │
              ▼
    Members can check in again
```

---

## 8. Analytics & AI Insights

### Team Grade Formula

```
Team Grade = (Avg Readiness × 60%) + (Compliance Rate × 40%)

Readiness: Average of all member readiness scores
Compliance: (GREEN + YELLOW days) / (Total counted days) × 100
```

### Analytics Data Structure

```javascript
TeamAnalytics {
  // Period stats
  totalCheckins: 150,
  greenCount: 100,
  yellowCount: 35,
  redCount: 15,

  // Rates
  complianceRate: 92.5,  // % of work days with check-in
  greenRate: 66.7,       // % GREEN of total
  yellowRate: 23.3,
  redRate: 10.0,

  // Comparison
  previousPeriod: {...},
  changeFromPrevious: +5.2,

  // Incidents & Exceptions
  openIncidents: 2,
  pendingExceptions: 3,

  // Member breakdown
  members: [
    {
      userId: "...",
      name: "Maria Santos",
      score: 88,
      streak: 22,
      compliance: 95,
      riskLevel: "LOW"
    },
    ...
  ]
}
```

### AI Summary Generation

```
┌─────────────────────────────────────────┐
│           AI SUMMARY FLOW               │
└─────────────────────────────────────────┘

[Team Lead requests AI summary]
              │
              ▼
    Fetch team data for period
    - Member analytics
    - Check-in patterns
    - Incidents & exceptions
    - Period comparisons
              │
              ▼
    Send to OpenAI GPT-4
    with structured prompt
              │
              ▼
    Parse response:
    {
      summary: "Narrative text...",
      highlights: ["Positive 1", "Positive 2"],
      concerns: ["Issue 1", "Issue 2"],
      recommendations: ["Action 1", "Action 2"],
      overallStatus: "healthy" | "attention" | "critical"
    }
              │
              ▼
    Save to AISummary table
    Return to user
```

### Sudden Change Detection

```
Compare today's score vs. 7-day average:

CRITICAL:    Dropped 30+ points
SIGNIFICANT: Dropped 20-29 points
NOTABLE:     Dropped 10-19 points
MINOR:       Dropped <10 points

Alert shown in Daily Monitoring dashboard
```

---

## 9. Holiday/Calendar System

### Holiday Management

```
┌─────────────────────────────────────────┐
│            HOLIDAY LOGIC                │
└─────────────────────────────────────────┘

[Executive adds holiday]
              │
              ▼
    Holiday {
      name: "New Year's Day",
      date: "2026-01-01",
      companyId: "...",
      createdBy: "..."
    }
              │
              ▼
    On that date for ALL workers:
    - Check-in BLOCKED
    - No attendance record created
    - Day EXCLUDED from compliance calc
    - Streak PRESERVED (not broken)
```

### Calendar Views by Role

| Role | Can View | Can Manage |
|------|----------|------------|
| WORKER | Own schedule, holidays | No |
| TEAM_LEAD | Team schedule, holidays | No |
| EXECUTIVE | All schedules, holidays | Yes (CRUD) |

---

## 10. AI Chatbot

### Available Commands (Team Lead)

| Command | Description |
|---------|-------------|
| "Show team summary" | Overview of team health |
| "Who needs help?" | Members with low scores |
| "Attendance report" | Compliance statistics |
| "Incidents update" | Recent safety issues |
| "Predict trends" | AI forecast |

### Chat Flow

```
[Team Lead sends message]
         │
         ▼
   Parse intent from message
         │
         ▼
   Fetch relevant team data
         │
         ▼
   Generate contextual response
   via OpenAI
         │
         ▼
   Return natural language answer
   with data-driven insights
```

---

## 11. Edge Cases & Special Scenarios

### Check-in Edge Cases

| Scenario | Behavior |
|----------|----------|
| Check-in after shift end | Blocked, day becomes ABSENT |
| Holiday + on leave | Holiday takes precedence |
| Multiple check-ins same day | Only first one counts |
| Timezone midnight crossing | Uses company timezone |

### Leave Edge Cases

| Scenario | Behavior |
|----------|----------|
| Overlapping exemptions | System prevents creation |
| Leave during holiday | Holiday days excluded from leave count |
| Team deactivated while on leave | TEAM_INACTIVE takes precedence |
| Return date on holiday | First work day = next non-holiday |

### Attendance Edge Cases

| Scenario | Behavior |
|----------|----------|
| Worker joins mid-month | Baseline = day after join |
| No check-ins ever | Use createdAt + 1 as baseline |
| Worker changes teams | Stats recalculated per team |
| Team schedule changes | New schedule applies immediately |

### Streak Preservation

```
Streak is PRESERVED (not reset) when:
✓ Company holiday
✓ Approved exemption/leave
✓ Non-work day (weekend)
✓ Team temporarily deactivated

Streak is RESET when:
✗ ABSENT (no check-in, no excuse)
```

---

## API Quick Reference

### Check-in Endpoints

```
POST   /checkins                    Submit check-in
GET    /checkins/today              Today's check-in
GET    /checkins/leave-status       Current leave status
GET    /checkins/week-stats         Weekly statistics
GET    /checkins/attendance/today   Today's attendance
GET    /checkins/attendance/history Attendance history
PATCH  /checkins/:id/low-score-reason  Set RED reason
```

### Exemption Endpoints

```
POST   /exemptions                  Request exemption
GET    /exemptions/:id              Get details
PUT    /exemptions/:id/approve      Approve (TL)
PUT    /exemptions/:id/reject       Reject (TL)
```

### Exception Endpoints

```
GET    /exceptions                  List exceptions
POST   /exceptions                  Create exception
PUT    /exceptions/:id              Update
DELETE /exceptions/:id              Delete
```

### Incident Endpoints

```
POST   /incidents                   Report incident
GET    /incidents                   List incidents
GET    /incidents/my                User's incidents
PUT    /incidents/:id               Update incident
POST   /incidents/:id/activities    Add activity
```

### Analytics Endpoints

```
GET    /analytics/dashboard         Company overview
GET    /analytics/team/:id          Team analytics
POST   /analytics/team/:id/ai-summary   Generate AI
GET    /analytics/team/:id/ai-summary   Latest summary
GET    /analytics/export            Export data
```

### Team Endpoints

```
GET    /teams                       List teams
POST   /teams                       Create team
GET    /teams/:id                   Team details
PUT    /teams/:id                   Update team
PUT    /teams/:id/deactivate        Deactivate
```

### Daily Monitoring

```
GET    /daily-monitoring            Team health dashboard
```

### Chatbot

```
GET    /chatbot/suggestions         Available commands
POST   /chatbot/message             Send message
```

---

## Summary Flowchart

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AEGIRA DAILY WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │  MORNING    │
                        └─────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      ┌──────────┐      ┌──────────┐      ┌──────────┐
      │  WORKER  │      │ TEAM LEAD│      │EXECUTIVE │
      └──────────┘      └──────────┘      └──────────┘
            │                 │                 │
            ▼                 ▼                 ▼
       Check-in         Review Team        Company
       Wellness         Dashboard          Overview
            │                 │                 │
            ▼                 ▼                 │
      GREEN/YELLOW      Handle Alerts          │
         or RED         Approve/Reject         │
            │           Exemptions             │
            │                 │                 │
        ┌───┴───┐             │                 │
        ▼       ▼             │                 │
    Continue  Request         │                 │
    Work      Exemption       │                 │
                │             │                 │
                └─────────────┘                 │
                        │                       │
                        ▼                       │
                 ┌─────────────┐                │
                 │  AFTERNOON  │                │
                 └─────────────┘                │
                        │                       │
            ┌───────────┼───────────┐           │
            ▼           ▼           ▼           │
       Report      AI Insights   Review         │
       Incidents   Generation    Analytics      │
            │           │           │           │
            └───────────┴───────────┴───────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │  END OF DAY │
                       └─────────────┘
                              │
                              ▼
                    Attendance Records
                    Created/Updated
                              │
                              ▼
                    Streaks Updated
                    Grades Calculated
```

---

**Document Version:** 1.0
**System:** Aegira Attendance & Wellness Management
**Maintained by:** Development Team
