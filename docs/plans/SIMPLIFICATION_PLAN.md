# Aegira Simplification Plan

## Goal

Transform from "Attendance System with Wellness" to "Workforce Health Intelligence Platform"

```
BEFORE: Track who showed up + wellness metrics + compliance
AFTER:  Track health metrics only (from actual data)

Focus: Daily health check-ins + Incident lifecycle
Remove: All attendance/compliance/absence logic
```

---

## Core Concept

```
OLD APPROACH:
┌─────────────────────────────────────────┐
│ Expected check-ins: 5 (Mon-Fri)         │
│ Actual check-ins: 4                     │
│ Compliance: 80%                         │
│ Missing: 1 day ← TRACKING ABSENCE       │
└─────────────────────────────────────────┘

NEW APPROACH:
┌─────────────────────────────────────────┐
│ Check-ins this week: 4                  │
│ Avg Mood: 7.2                           │
│ Avg Stress: 4.5                         │
│ Avg Sleep: 6.8                          │
│ Avg Physical: 7.5                       │
│ ← TRACKING ACTUAL HEALTH DATA ONLY      │
└─────────────────────────────────────────┘

No "expected". No "missing". No "compliance".
Just: Here's the data from check-ins that exist.
```

---

## What We're Building

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   PREVENT           RESPOND           RECOVER       │
│                                                     │
│   Daily Health  →   Incident      →   Physio &     │
│   Check-ins         Management        RTW Certs    │
│                                                     │
│   • Mood            • Report          • Assign     │
│   • Stress          • WHS assign      • Track      │
│   • Sleep           • Investigate     • Certify    │
│   • Physical        • Resolve         • Return     │
│                                                     │
└─────────────────────────────────────────────────────┘

NO attendance. NO compliance. NO HR complexity.
```

---

## What STAYS (For Structure)

| Keep | Purpose | Used For |
|------|---------|----------|
| Teams | Group workers | Organization |
| Team Lead | Manages team | Views team data |
| Work Days | Optional reference | NOT for compliance |
| Roles | Access control | Permissions |

**Teams stay for STRUCTURE, not for COMPLIANCE.**

---

## New Calculation Logic

```javascript
// OLD (Compliance-based) ❌
const expected = team.workDays.length; // 5
const actual = checkins.length; // 4
const compliance = actual / expected; // 80%
const missing = expected - actual; // 1

// NEW (Data-based only) ✅
const checkins = getCheckins(userId, dateRange);
if (checkins.length === 0) {
  return { message: "No check-ins yet" };
}

const metrics = {
  count: checkins.length,
  avgMood: average(checkins.map(c => c.mood)),
  avgStress: average(checkins.map(c => c.stress)),
  avgSleep: average(checkins.map(c => c.sleep)),
  avgPhysical: average(checkins.map(c => c.physical)),
  avgFitnessScore: average(checkins.map(c => c.fitnessScore)),
};
// Just calculate from what exists. No judgment.
```

---

## REMOVE - Backend

### Database Schema (Prisma)

- [ ] Remove `Absence` model entirely
- [ ] Remove `DailyAttendance` model entirely
- [ ] Remove `Holiday` model entirely (not needed)
- [ ] Remove `Schedule` model entirely (not needed)
- [ ] Remove attendance-related fields from `Checkin`:
  - [ ] `attendanceStatus` (GREEN/ABSENT concept)
  - [ ] `isLate` fields if any
  - [ ] `expectedCheckinTime`
- [ ] Remove compliance fields from `DailyTeamSummary`:
  - [ ] `expectedCount`
  - [ ] `complianceRate`
  - [ ] `absentCount`
- [ ] Simplify `Exception` model:
  - [ ] Remove leave types (SICK_LEAVE, PERSONAL_LEAVE, etc.)
  - [ ] Keep only as "Stand Down" for unfit workers
- [ ] Remove from `Team` (optional):
  - [ ] `workDays` (or keep as reference only)
  - [ ] `shiftStart` / `shiftEnd` (or keep as reference only)

### Backend Modules

- [ ] **DELETE: `backend/src/modules/absences/`**
  - Absence tracking not needed

- [ ] **DELETE: `backend/src/modules/daily-attendance/`**
  - Attendance status not needed

- [ ] **SIMPLIFY: `backend/src/modules/checkins/`**
  - Remove attendance logic
  - Keep health metrics only
  - Remove "expected check-in" concept

- [ ] **SIMPLIFY: `backend/src/modules/exceptions/`**
  - Remove leave request types
  - Keep only as "Stand Down" (worker unfit)
  - Simpler flow: Unfit → Stand Down → Return

- [ ] **SIMPLIFY: `backend/src/modules/daily-monitoring/`**
  - Remove compliance tab
  - Remove absences tab
  - Keep: Check-ins, Metrics, Alerts

- [ ] **SIMPLIFY: `backend/src/modules/holidays/`**
  - Optional: Remove entirely OR
  - Keep as simple "company closed" dates (no blocking logic)

- [ ] **REMOVE: Absence cron jobs**
  - No more daily "create absence records" job
  - No more "mark absent" logic

### Backend Utils

- [ ] **SIMPLIFY: `backend/src/utils/team-grades-optimized.ts`**
  - Remove compliance-based grading
  - Grade based on health metrics only

- [ ] **REMOVE: Attendance calculation utils**
  - Any "expected vs actual" logic
  - Compliance rate calculations

---

## REMOVE - Frontend

### Pages to DELETE

- [ ] `frontend/src/pages/*/absences*.tsx` (if exists)
- [ ] Any "attendance" specific pages
- [ ] Leave request pages (simplify to stand-down only)

### Pages to SIMPLIFY

- [ ] **Team Leader Daily Monitoring**
  - Remove: Compliance %, Absences tab
  - Keep: Health metrics, Check-ins, Alerts

- [ ] **Worker Check-in**
  - Remove: Attendance language
  - Keep: Health input (mood, stress, sleep, physical)

- [ ] **Dashboards**
  - Remove: "Expected check-ins", "Compliance rate"
  - Add: "Check-ins today", "Team averages", "Needs attention"

### Components to UPDATE

- [ ] Remove "attendance" terminology everywhere
- [ ] Remove "compliance" terminology everywhere
- [ ] Remove "absent/late" status badges
- [ ] Update status to: FIT / MONITOR / UNFIT only

### Navigation

- [ ] Remove any "Attendance" menu items
- [ ] Remove any "Leave Management" menu items
- [ ] Simplify menu structure

---

## KEEP - Core Features

### ✅ Daily Health Check-in
```
Worker submits:
- Mood (1-10)
- Stress (1-10)
- Sleep (1-10)
- Physical (1-10)
- Notes (optional)

System calculates:
- Fitness Score
- Status: FIT / MONITOR / UNFIT
```

### ✅ Team Dashboard
```
Team Lead sees:
- Who checked in today (no "expected" count)
- Team averages (mood, stress, sleep, physical)
- Workers needing attention (MONITOR/UNFIT)
- Trends over time
```

### ✅ AI Insights
```
Keep:
- Team summaries
- Pattern detection
- Risk alerts
- Recommendations
```

### ✅ Incident Management
```
Keep entire incident workflow:
- Report incident
- Assign to WHS
- Investigation
- Resolution
```

### ✅ WHS Role & Workflow
```
Keep:
- WHS officer assignment
- Incident management
- Physio assignment
- RTW certificates
```

### ✅ Stand Down (Simplified Exemption)
```
Simplified flow:
- Worker is UNFIT
- Team Lead or WHS puts on "Stand Down"
- Worker recovers
- RTW certificate issued
- Worker returns to check-ins
```

### ✅ Return to Work
```
Keep:
- RTW certificate upload
- Fitness clearance
- Return tracking
```

### ✅ Teams & Users
```
Keep:
- Team structure
- Team Lead assignment
- User roles (WORKER, TEAM_LEAD, SUPERVISOR, WHS, etc.)
- Basic user management
```

---

## Terminology Changes

| OLD | NEW |
|-----|-----|
| Check-in | Health Check-in |
| Attendance | ❌ Remove |
| Compliance | ❌ Remove |
| GREEN (attendance) | FIT |
| YELLOW | MONITOR |
| RED | UNFIT |
| Absent | ❌ Remove |
| Late | ❌ Remove |
| Exception | Stand Down |
| Leave Request | ❌ Remove |
| Expected check-ins | ❌ Remove |
| Compliance rate | ❌ Remove |

---

## New Dashboard Design

### Team Lead View - Today

```
┌─────────────────────────────────────────────────────┐
│ TEAM ALPHA - Today                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Check-ins Today: 12                                 │
│                                                     │
│ ● FIT: 9                                            │
│ ● MONITOR: 2                                        │
│ ● UNFIT: 1 ⚠️                                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Today's Averages (from 12 check-ins)                │
│                                                     │
│ Mood      ████████░░ 7.2                           │
│ Stress    ████░░░░░░ 4.1                           │
│ Sleep     ██████░░░░ 6.5                           │
│ Physical  ████████░░ 7.8                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ⚠️ Needs Attention                                  │
│                                                     │
│ • Juan Reyes - UNFIT (High stress, low sleep)      │
│ • Maria Santos - MONITOR (Fatigue flagged)         │
│                                                     │
│ [View Details]                                      │
│                                                     │
└─────────────────────────────────────────────────────┘

NO "Expected: 15"
NO "Compliance: 80%"
NO "Missing: 3"
NO "Absent: 3"

Just: "12 check-ins today, here's the data"
```

### Team Lead View - Weekly

```
┌─────────────────────────────────────────────────────┐
│ TEAM ALPHA - This Week                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Total Check-ins: 47                                 │
│ Workers who checked in: 12                          │
│                                                     │
│ Weekly Averages (from 47 check-ins):                │
│                                                     │
│ Mood      ████████░░ 7.1                           │
│ Stress    ████░░░░░░ 4.2                           │
│ Sleep     ██████░░░░ 6.5                           │
│ Physical  ████████░░ 7.4                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Trends vs Last Week:                                │
│                                                     │
│ Mood: ↑ +0.3                                        │
│ Stress: ↓ -0.5 (improving)                          │
│ Sleep: → same                                       │
│ Physical: ↑ +0.2                                    │
│                                                     │
└─────────────────────────────────────────────────────┘

Just data from what exists. No compliance judgment.
```

### Individual Worker View

```
┌─────────────────────────────────────────────────────┐
│ JUAN REYES - This Week                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Check-ins: 4                                        │
│                                                     │
│ Averages (from 4 check-ins):                        │
│ Mood: 7.2 | Stress: 4.5 | Sleep: 6.8 | Physical: 7.5│
│                                                     │
│ Fitness Score: 74% (FIT)                            │
│                                                     │
│ Trend: ↑ Improving vs last week                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Check-in History:                                   │
│                                                     │
│ Mon: Mood 7, Stress 5, Sleep 6, Physical 7 (FIT)   │
│ Tue: Mood 8, Stress 4, Sleep 7, Physical 8 (FIT)   │
│ Wed: (no check-in)                                  │
│ Thu: Mood 7, Stress 4, Sleep 7, Physical 7 (FIT)   │
│ Fri: Mood 7, Stress 5, Sleep 7, Physical 8 (FIT)   │
│                                                     │
└─────────────────────────────────────────────────────┘

"Wed: (no check-in)" = neutral info, NOT "ABSENT"
```

---

## Simplified Data Model

### Keep These Models

```prisma
model User {
  id
  email
  firstName
  lastName
  role
  teamId
  companyId
  // Remove: schedule, workDays, etc.
}

model Team {
  id
  name
  teamLeadId
  companyId
  isActive
  // Remove: workDays, shiftStart, shiftEnd
}

model HealthCheckin {  // Renamed from Checkin
  id
  userId
  date
  mood
  stress
  sleep
  physical
  fitnessScore
  status          // FIT, MONITOR, UNFIT
  notes
  createdAt
  // Remove: attendanceStatus, isLate, etc.
}

model Incident {
  // Keep as-is
}

model StandDown {  // Simplified from Exception
  id
  userId
  reason
  startDate
  endDate
  status         // ACTIVE, RETURNED
  approvedBy
  rtwCertificate
  // Remove: type (SICK_LEAVE, etc.)
}
```

### Remove These Models

```prisma
// DELETE
model Absence { }
model DailyAttendance { }
model Holiday { }  // Or make optional
model Schedule { }
```

---

## Implementation Order

### Phase 1: Database Cleanup
1. [ ] Create migration to remove attendance fields
2. [ ] Remove Absence model
3. [ ] Remove DailyAttendance model
4. [ ] Simplify Exception → StandDown
5. [ ] Remove Schedule model (if not needed)

### Phase 2: Backend Cleanup
1. [ ] Delete absences module
2. [ ] Delete daily-attendance module
3. [ ] Remove attendance logic from checkins module
4. [ ] Simplify exceptions module
5. [ ] Remove absence cron jobs
6. [ ] Update daily-monitoring module

### Phase 3: Frontend Cleanup
1. [ ] Update terminology (attendance → health)
2. [ ] Remove compliance UI elements
3. [ ] Remove absences UI elements
4. [ ] Simplify dashboards
5. [ ] Update navigation

### Phase 4: Testing
1. [ ] Test health check-in flow
2. [ ] Test team dashboard
3. [ ] Test incident workflow
4. [ ] Test stand-down workflow
5. [ ] Test RTW flow

### Phase 5: Polish
1. [ ] Update all copy/text
2. [ ] Update API documentation
3. [ ] Update error messages
4. [ ] Final UI review

---

## Files to Review

### Backend - Likely to Modify/Delete

```
backend/src/modules/
├── absences/           # DELETE
├── daily-attendance/   # DELETE
├── checkins/           # SIMPLIFY
├── exceptions/         # SIMPLIFY → StandDown
├── daily-monitoring/   # SIMPLIFY
├── holidays/           # DELETE or SIMPLIFY
├── teams/              # REMOVE schedule fields
├── analytics/          # REMOVE compliance metrics
└── incidents/          # KEEP
└── whs/                # KEEP

backend/src/utils/
├── team-grades*.ts     # SIMPLIFY (no compliance)
└── date-helpers.ts     # KEEP
```

### Frontend - Likely to Modify/Delete

```
frontend/src/pages/
├── worker/
│   ├── checkin/        # SIMPLIFY (remove attendance)
│   ├── request-exception.page.tsx  # SIMPLIFY
│   └── ...
├── team-leader/
│   ├── daily-monitoring.page.tsx   # MAJOR SIMPLIFY
│   ├── approvals.page.tsx          # SIMPLIFY
│   └── ...
├── supervisor/
│   └── ...             # SIMPLIFY dashboards
└── whs/
    └── ...             # KEEP as-is
```

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Database cleanup | Medium | 1 |
| Backend modules | Medium | 2 |
| Frontend pages | Large | 3 |
| Testing | Medium | 4 |
| Polish | Small | 5 |

**Total: 1-2 weeks of focused work**

---

## Success Criteria

After simplification:

- [ ] No "attendance" word anywhere in UI
- [ ] No "compliance" word anywhere in UI
- [ ] No "expected check-ins" concept
- [ ] No "absent/late" status
- [ ] Workers can check in voluntarily
- [ ] Team Leads see health metrics only
- [ ] Incident → WHS → Physio → RTW flow works
- [ ] System feels like health tool, not attendance

---

## TL;DR

```
CORE IDEA:
- Calculate metrics from ACTUAL check-ins only
- No "expected" count, no compliance
- 4 check-ins this week? Calculate averages from 4.
- 0 check-ins? Show "No data yet"

REMOVE:
- Absences module
- Attendance tracking
- Compliance scoring
- Leave management (keep Stand Down only)
- Holiday blocking
- Expected check-in logic
- Absence cron jobs
- Schedule model

KEEP:
- Teams (for structure)
- Team Lead (for organization)
- Health check-ins (voluntary)
- Fitness scoring (FIT/MONITOR/UNFIT)
- Metrics from actual data
- AI insights
- Incident management
- WHS workflow
- Physio/RTW tracking

RESULT:
- Simpler codebase
- Clearer product
- No HR competition
- Calculate from what exists
- No judgment on missing data
```
