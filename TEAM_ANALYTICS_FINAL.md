# Team Analytics - Final System Flow

> Based on actual database schema: Prisma models

---

## Data Sources (From Your Database)

### 1. Users Table
```
- id, firstName, lastName
- isActive (boolean)
- teamId (which team)
- currentStreak, longestStreak
- lastCheckinDate
```

### 2. Checkins Table
```
- userId, companyId
- mood (1-10)
- stress (1-10)
- sleep (1-10)
- physicalHealth (1-10)
- readinessScore (0-100)
- readinessStatus (GREEN/YELLOW/RED)
- lowScoreReason (enum - see below)
- lowScoreDetails (text for "OTHER")
- createdAt
```

### 3. LowScoreReason Enum (Actual Values)
```
- PHYSICAL_INJURY
- ILLNESS_SICKNESS
- POOR_SLEEP
- HIGH_STRESS
- PERSONAL_ISSUES
- FAMILY_EMERGENCY
- WORK_RELATED
- OTHER
```

### 4. Exceptions Table (Leave/Exemptions)
```
- userId, companyId
- type (SICK_LEAVE, PERSONAL_LEAVE, MEDICAL_APPOINTMENT, FAMILY_EMERGENCY, OTHER)
- status (PENDING, APPROVED, REJECTED)
- startDate, endDate
- isExemption (boolean - true if triggered by critical check-in)
```

### 5. DailyAttendance Table
```
- userId, teamId, date
- status (GREEN, YELLOW, ABSENT, EXCUSED)
- score (100, 75, 0, null)
- isCounted (false for EXCUSED)
```

---

## Team Grade Computation - Final Formula

```
Team Grade = (Average Readiness Score × 0.60) + (Check-in Compliance × 0.40)
```

---

## Complete System Flow

### Step 1: Identify Team Members

```sql
-- Get all members of the team
SELECT * FROM users
WHERE teamId = '{team_id}'
  AND isActive = true
```

**Result:** List of all active team members

---

### Step 2: Identify Who is On Leave (Exclude from Computation)

```sql
-- Get members with APPROVED exception covering today
SELECT userId FROM exceptions
WHERE status = 'APPROVED'
  AND startDate <= CURRENT_DATE
  AND endDate >= CURRENT_DATE
  AND userId IN (team_member_ids)
```

**Result:** List of members on approved leave

**Computation:**
```
Total Members = 12
On Leave = 2
Active Members = 12 - 2 = 10  ← Use this for compliance
```

---

### Step 3: Get Today's Check-ins

```sql
-- Get check-ins from today for active members (not on leave)
SELECT * FROM checkins
WHERE userId IN (active_member_ids)
  AND DATE(createdAt) = CURRENT_DATE
ORDER BY createdAt DESC
```

**Note:** If member has multiple check-ins today, use the LATEST one.

**Result:**
| Member | Checked In | Score | Status |
|--------|------------|-------|--------|
| Juan | ✅ | 85 | GREEN |
| Maria | ✅ | 72 | YELLOW |
| Pedro | ✅ | 45 | RED |
| Carlo | ❌ | - | - |
| Beth | ❌ | - | - |

---

### Step 4: Calculate Compliance

```
Checked In Today = 8
Active Members = 10 (excluding those on leave)

Compliance = (8 / 10) × 100 = 80%
```

**Important Rules:**
- ❌ Members on APPROVED leave are NOT counted in active members
- ❌ Members with PENDING leave are STILL counted (not yet approved)
- ✅ Only APPROVED exceptions exclude from count

---

### Step 5: Calculate Average Readiness Score

```sql
-- Get average of today's check-in scores
SELECT AVG(readinessScore) as avg_score
FROM checkins
WHERE userId IN (members_who_checked_in_today)
  AND DATE(createdAt) = CURRENT_DATE
```

**Result:**
```
Scores: 85, 72, 45, 78, 65, 90, 55, 80
Sum: 570
Count: 8
Average: 570 / 8 = 71.25%
```

---

### Step 6: Apply Team Grade Formula

```
Team Grade = (Avg Readiness × 0.60) + (Compliance × 0.40)

Team Grade = (71.25 × 0.60) + (80 × 0.40)
Team Grade = 42.75 + 32.00
Team Grade = 74.75%

Rounded: 75%
```

---

### Step 7: Determine Grade Color & Label

```javascript
function getGradeInfo(score) {
  if (score >= 90) return { color: 'GREEN', label: 'Excellent' };
  if (score >= 70) return { color: 'YELLOW', label: 'Good' };
  if (score >= 50) return { color: 'ORANGE', label: 'Needs Improvement' };
  return { color: 'RED', label: 'Critical' };
}

// Result for 75%:
{ color: 'YELLOW', label: 'Good' }
```

---

## Complete Scenario

### Team: Alpha Team
**Date:** January 5, 2026

### Raw Data

| # | Name | isActive | On Leave? | Checked In? | Score | Status | lowScoreReason |
|---|------|----------|-----------|-------------|-------|--------|----------------|
| 1 | Juan | ✅ | No | ✅ Yes | 85 | GREEN | - |
| 2 | Maria | ✅ | No | ✅ Yes | 72 | YELLOW | - |
| 3 | Pedro | ✅ | No | ✅ Yes | 45 | RED | HIGH_STRESS |
| 4 | Ana | ✅ | No | ✅ Yes | 78 | GREEN | - |
| 5 | Jose | ✅ | No | ✅ Yes | 65 | YELLOW | POOR_SLEEP |
| 6 | Luis | ✅ | No | ✅ Yes | 90 | GREEN | - |
| 7 | Rosa | ✅ | No | ✅ Yes | 55 | RED | PERSONAL_ISSUES |
| 8 | Carlo | ✅ | No | ❌ No | - | - | - |
| 9 | Beth | ✅ | No | ❌ No | - | - | - |
| 10 | Mark | ✅ | No | ✅ Yes | 80 | GREEN | - |
| 11 | Nina | ✅ | ✅ SICK_LEAVE | ➖ Exempt | - | - | - |
| 12 | Rex | ✅ | ✅ PERSONAL_LEAVE | ➖ Exempt | - | - | - |

### Computation

```
Step 1: Total Team Members = 12

Step 2: Members on Approved Leave
        - Nina (SICK_LEAVE, approved, Jan 3-10)
        - Rex (PERSONAL_LEAVE, approved, Jan 1-15)
        Total on Leave = 2

Step 3: Active Members = 12 - 2 = 10

Step 4: Checked In Today
        - Juan, Maria, Pedro, Ana, Jose, Luis, Rosa, Mark
        Total = 8

Step 5: Not Checked In (and NOT on leave)
        - Carlo, Beth
        Total = 2

Step 6: Compliance = 8 / 10 × 100 = 80%

Step 7: Average Score = (85+72+45+78+65+90+55+80) / 8 = 71.25%

Step 8: Team Grade = (71.25 × 0.60) + (80 × 0.40) = 74.75% → 75%

Step 9: Grade Color = YELLOW, Label = "Good"
```

### Final Output

```json
{
  "teamGrade": {
    "score": 75,
    "color": "YELLOW",
    "label": "Good"
  },
  "breakdown": {
    "avgReadiness": 71.25,
    "compliance": 80,
    "checkedIn": 8,
    "activeMembers": 10,
    "onLeave": 2,
    "notCheckedIn": 2
  },
  "statusDistribution": {
    "green": 4,
    "yellow": 2,
    "red": 2
  }
}
```

---

## Top Reasons Analytics

### Query
```sql
SELECT
  lowScoreReason,
  COUNT(*) as count
FROM checkins
WHERE userId IN (team_member_ids)
  AND lowScoreReason IS NOT NULL
  AND createdAt >= NOW() - INTERVAL '30 days'
GROUP BY lowScoreReason
ORDER BY count DESC
LIMIT 5
```

### Result (Example)
| Reason | Count | Label |
|--------|-------|-------|
| HIGH_STRESS | 15 | High Stress |
| POOR_SLEEP | 12 | Poor Sleep |
| PERSONAL_ISSUES | 8 | Personal Issues |
| WORK_RELATED | 5 | Work Related |
| ILLNESS_SICKNESS | 3 | Illness/Sickness |

### Reason Label Mapping
```javascript
const REASON_LABELS = {
  PHYSICAL_INJURY: 'Physical Injury',
  ILLNESS_SICKNESS: 'Illness/Sickness',
  POOR_SLEEP: 'Poor Sleep',
  HIGH_STRESS: 'High Stress',
  PERSONAL_ISSUES: 'Personal Issues',
  FAMILY_EMERGENCY: 'Family Emergency',
  WORK_RELATED: 'Work Related',
  OTHER: 'Other'
};
```

---

## Members Needing Attention

### Criteria
1. **RED Status Today** - Checked in with RED status
2. **No Check-in** - Active member who didn't check in today
3. **Declining Trend** - 3+ consecutive days of declining scores

### Query: RED Status Today
```sql
SELECT u.id, u.firstName, u.lastName, c.readinessScore
FROM users u
JOIN checkins c ON c.userId = u.id
WHERE u.teamId = '{team_id}'
  AND DATE(c.createdAt) = CURRENT_DATE
  AND c.readinessStatus = 'RED'
```

### Query: No Check-in Today
```sql
SELECT u.id, u.firstName, u.lastName, u.lastCheckinDate
FROM users u
WHERE u.teamId = '{team_id}'
  AND u.isActive = true
  AND u.id NOT IN (
    SELECT userId FROM checkins
    WHERE DATE(createdAt) = CURRENT_DATE
  )
  AND u.id NOT IN (
    SELECT userId FROM exceptions
    WHERE status = 'APPROVED'
      AND startDate <= CURRENT_DATE
      AND endDate >= CURRENT_DATE
  )
```

### Output
```json
{
  "membersNeedingAttention": [
    {
      "id": "uuid-pedro",
      "name": "Pedro Garcia",
      "issue": "RED_STATUS",
      "details": "Score: 45%, Reason: High Stress"
    },
    {
      "id": "uuid-rosa",
      "name": "Rosa Santos",
      "issue": "RED_STATUS",
      "details": "Score: 55%, Reason: Personal Issues"
    },
    {
      "id": "uuid-carlo",
      "name": "Carlo Reyes",
      "issue": "NO_CHECKIN",
      "details": "Last check-in: 2 days ago"
    },
    {
      "id": "uuid-beth",
      "name": "Beth Cruz",
      "issue": "NO_CHECKIN",
      "details": "Last check-in: 1 day ago"
    }
  ]
}
```

---

## Members On Leave

### Query
```sql
SELECT
  u.id, u.firstName, u.lastName,
  e.type, e.startDate, e.endDate
FROM exceptions e
JOIN users u ON e.userId = u.id
WHERE u.teamId = '{team_id}'
  AND e.status = 'APPROVED'
  AND e.startDate <= CURRENT_DATE
  AND e.endDate >= CURRENT_DATE
```

### Output
```json
{
  "membersOnLeave": [
    {
      "id": "uuid-nina",
      "name": "Nina Cruz",
      "leaveType": "SICK_LEAVE",
      "startDate": "2026-01-03",
      "endDate": "2026-01-10"
    },
    {
      "id": "uuid-rex",
      "name": "Rex Tan",
      "leaveType": "PERSONAL_LEAVE",
      "startDate": "2026-01-01",
      "endDate": "2026-01-15"
    }
  ]
}
```

---

## Team Metrics (30-day Average)

### Query
```sql
SELECT
  AVG(mood) as avgMood,
  AVG(stress) as avgStress,
  AVG(sleep) as avgSleep,
  AVG(physicalHealth) as avgPhysicalHealth
FROM checkins
WHERE userId IN (team_member_ids)
  AND createdAt >= NOW() - INTERVAL '30 days'
```

### Output
```json
{
  "avgMetrics": {
    "mood": 7.2,
    "stress": 4.5,
    "sleep": 6.8,
    "physicalHealth": 6.5
  }
}
```

---

## Trend Data (Last 30 Days)

### Query
```sql
SELECT
  DATE(createdAt) as date,
  AVG(readinessScore) as avgScore,
  COUNT(DISTINCT userId) as checkedInCount
FROM checkins
WHERE userId IN (team_member_ids)
  AND createdAt >= NOW() - INTERVAL '30 days'
GROUP BY DATE(createdAt)
ORDER BY date ASC
```

### Output
```json
{
  "trendData": [
    { "date": "2026-01-01", "score": 72, "checkedIn": 9 },
    { "date": "2026-01-02", "score": 75, "checkedIn": 10 },
    { "date": "2026-01-03", "score": 68, "checkedIn": 8 },
    { "date": "2026-01-04", "score": 71, "checkedIn": 9 },
    { "date": "2026-01-05", "score": 71, "checkedIn": 8 }
  ]
}
```

---

## Complete API Response

```
GET /teams/my/analytics
```

```json
{
  "team": {
    "id": "uuid",
    "name": "Alpha Team",
    "totalMembers": 12
  },

  "teamGrade": {
    "score": 75,
    "color": "YELLOW",
    "label": "Good",
    "avgReadiness": 71.25,
    "compliance": 80
  },

  "complianceDetails": {
    "checkedIn": 8,
    "activeMembers": 10,
    "onLeave": 2,
    "notCheckedIn": 2
  },

  "statusDistribution": {
    "green": 4,
    "yellow": 2,
    "red": 2,
    "total": 8
  },

  "topReasons": [
    { "reason": "HIGH_STRESS", "label": "High Stress", "count": 15 },
    { "reason": "POOR_SLEEP", "label": "Poor Sleep", "count": 12 },
    { "reason": "PERSONAL_ISSUES", "label": "Personal Issues", "count": 8 }
  ],

  "avgMetrics": {
    "mood": 7.2,
    "stress": 4.5,
    "sleep": 6.8,
    "physicalHealth": 6.5
  },

  "trendData": [
    { "date": "2026-01-01", "score": 72 },
    { "date": "2026-01-02", "score": 75 }
  ],

  "membersNeedingAttention": [
    {
      "id": "uuid",
      "name": "Pedro Garcia",
      "avatar": null,
      "issue": "RED_STATUS",
      "details": "Score: 45%, Reason: High Stress"
    }
  ],

  "membersOnLeave": [
    {
      "id": "uuid",
      "name": "Nina Cruz",
      "leaveType": "SICK_LEAVE",
      "endDate": "2026-01-10"
    }
  ]
}
```

---

## Edge Cases Handled

### Case 1: Everyone is on Leave
```
Active Members = 0
Team Grade = N/A
Display: "All team members are currently on leave"
```

### Case 2: No One Checked In (but active members exist)
```
Compliance = 0%
Avg Score = 0%
Team Grade = (0 × 0.60) + (0 × 0.40) = 0%
Display: "No check-ins today"
Color: RED
```

### Case 3: Member Has Multiple Check-ins Today
```
Use the LATEST check-in (ORDER BY createdAt DESC LIMIT 1)
```

### Case 4: Member Has PENDING Leave Request
```
Still counted as active (leave not yet approved)
Still expected to check in
```

### Case 5: Weekend / Non-Work Day
```
Check team.workDays field
If today is not a work day, show:
"Today is not a scheduled work day"
```

---

## Summary

| Component | Data Source | Computation |
|-----------|-------------|-------------|
| Active Members | users WHERE isActive AND teamId | Exclude those with approved exceptions |
| Compliance | checkins (today) | checked_in / active_members × 100 |
| Avg Readiness | checkins (today) | AVG(readinessScore) |
| Team Grade | Computed | (avgReadiness × 0.60) + (compliance × 0.40) |
| Top Reasons | checkins (30 days) | GROUP BY lowScoreReason |
| Avg Metrics | checkins (30 days) | AVG(mood, stress, sleep, physicalHealth) |
| Trend | checkins (30 days) | Daily AVG(readinessScore) |

---

## Implementation Complete!

### Files Created/Modified

#### Backend
| File | Description |
|------|-------------|
| `backend/src/modules/teams/index.ts` | Added `GET /teams/my/analytics` endpoint with full analytics computation |

**Endpoint Details:**
- **Route:** `GET /teams/my/analytics`
- **Query Params:** `period` (week, month, quarter), `startDate`, `endDate`
- **Auth:** Team Leader, Supervisor, Admin, Executive

#### Frontend

| File | Description |
|------|-------------|
| `frontend/src/services/team.service.ts` | Added `TeamAnalytics` interface and `getTeamAnalytics()` method |
| `frontend/src/components/charts/TeamGradeCircle.tsx` | Circular progress indicator for team grade (NEW) |
| `frontend/src/components/charts/TopReasonsChart.tsx` | Horizontal bar chart for low score reasons (NEW) |
| `frontend/src/components/charts/index.ts` | Updated exports |
| `frontend/src/pages/team-leader/team-analytics.page.tsx` | Main analytics dashboard page |
| `frontend/src/app/router.tsx` | Route at `/team/analytics` |
| `frontend/src/config/navigation.ts` | Navigation link in Team Management section |

---

### Components Overview

#### 1. TeamGradeCircle
```tsx
import { TeamGradeCircle, TeamGradeEmpty } from '../components/charts';

<TeamGradeCircle
  score={75}
  color="YELLOW"
  label="Good"
  size={180}
/>

<TeamGradeEmpty size={180} /> // When no data
```

**Props:**
- `score`: 0-100
- `color`: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
- `label`: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical'
- `size`: number (default: 180)

#### 2. TopReasonsChart
```tsx
import { TopReasonsChart } from '../components/charts';

<TopReasonsChart
  data={[
    { reason: 'HIGH_STRESS', label: 'High Stress', count: 15 },
    { reason: 'POOR_SLEEP', label: 'Poor Sleep', count: 12 },
  ]}
  maxItems={5}
/>
```

**Props:**
- `data`: Array of `{ reason: string, label: string, count: number }`
- `maxItems`: number (default: 5)

---

### Color System

| Grade Range | Color | Label |
|-------------|-------|-------|
| 90-100% | GREEN | Excellent |
| 70-89% | YELLOW | Good |
| 50-69% | ORANGE | Needs Improvement |
| 0-49% | RED | Critical |

**Tailwind Classes Used:**
- `success-*` for GREEN
- `warning-*` for YELLOW
- `orange-*` for ORANGE
- `danger-*` for RED

---

### API Response Structure

```typescript
interface TeamAnalytics {
  team: {
    id: string;
    name: string;
    totalMembers: number;
  };
  period: {
    type: string;
    startDate: string;
    endDate: string;
  };
  teamGrade: {
    score: number;
    color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
    label: string;
    avgReadiness: number;
    compliance: number;
  } | null;
  complianceDetails: {
    checkedIn: number;
    activeMembers: number;
    onLeave: number;
    notCheckedIn: number;
  };
  statusDistribution: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
  trendData: {
    date: string;
    score: number | null;
    compliance: number;
    checkedIn: number;
    hasData: boolean;
  }[];
  topReasons: {
    reason: string;
    label: string;
    count: number;
  }[];
  avgMetrics: {
    mood: number;
    stress: number;
    sleep: number;
    physicalHealth: number;
  };
  membersNeedingAttention: {
    id: string;
    name: string;
    avatar: string | null;
    issue: 'RED_STATUS' | 'NO_CHECKIN';
    details: string;
  }[];
  membersOnLeave: {
    id: string;
    name: string;
    avatar: string | null;
    leaveType: string;
    startDate: string;
    endDate: string;
  }[];
}
```

---

### Usage

1. Navigate to `/team/analytics` as a Team Leader
2. Select period filter: This Week, This Month, This Quarter
3. View:
   - Team Grade with circular indicator
   - Compliance breakdown stats
   - Status distribution bar
   - Average metrics
   - Readiness trend chart
   - Top reasons for low scores
   - Members needing attention
   - Members currently on leave

---

### Access Control

| Role | Access |
|------|--------|
| TEAM_LEAD | ✅ Full access to their team |
| SUPERVISOR | ✅ Full access |
| ADMIN | ✅ Full access |
| EXECUTIVE | ✅ Full access |
| WORKER/MEMBER | ❌ No access |
