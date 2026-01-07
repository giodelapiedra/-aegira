# Team Analytics Dashboard Plan

## Overview
Dashboard page para sa Team Leaders na nagpapakita ng comprehensive analytics ng kanilang team's wellness at performance.

**Route:** `/team/analytics`

---

## Team Grade Computation

### Formula
```
Team Grade = (Average Readiness Score × 0.60) + (Check-in Compliance × 0.40)
```

### Key Rules
1. **Exclude members on leave/exemption** - Hindi sila counted sa total members
2. **Only count today's check-ins** for compliance
3. **Use latest check-in score** for each member

---

## Complete Scenario with Exemptions

### Team Setup
**Team:** Alpha Team
**Total Members:** 12
**Members on Leave/Exemption:** 2 (Nina - Sick Leave, Rex - Vacation)
**Active Members (for computation):** 10
**Date:** January 5, 2026

---

### Today's Check-in Data

| # | Member | Status | Checked In? | Readiness Score | Readiness Status |
|---|--------|--------|-------------|-----------------|------------------|
| 1 | Juan | Active | ✅ Yes | 85% | 🟢 GREEN |
| 2 | Maria | Active | ✅ Yes | 72% | 🟡 YELLOW |
| 3 | Pedro | Active | ✅ Yes | 45% | 🔴 RED |
| 4 | Ana | Active | ✅ Yes | 78% | 🟢 GREEN |
| 5 | Jose | Active | ✅ Yes | 65% | 🟡 YELLOW |
| 6 | Luis | Active | ✅ Yes | 90% | 🟢 GREEN |
| 7 | Rosa | Active | ✅ Yes | 55% | 🔴 RED |
| 8 | Carlo | Active | ❌ No | - | - |
| 9 | Beth | Active | ❌ No | - | - |
| 10 | Mark | Active | ✅ Yes | 80% | 🟢 GREEN |
| 11 | Nina | 🏥 Sick Leave | ➖ Exempt | - | - |
| 12 | Rex | 🏖️ Vacation | ➖ Exempt | - | - |

---

### Step-by-Step Computation

#### Step 1: Identify Active Members (Exclude Exemptions)
```
Total Members: 12
On Leave/Exemption: 2 (Nina, Rex)
─────────────────────
Active Members: 10
```

#### Step 2: Calculate Check-in Compliance
```
Members who checked in: 8 (Juan, Maria, Pedro, Ana, Jose, Luis, Rosa, Mark)
Active members: 10 (excluding Nina & Rex)

Compliance = 8 / 10 × 100 = 80%
```

#### Step 3: Calculate Average Readiness Score
```
Scores from those who checked in:
Juan:  85%
Maria: 72%
Pedro: 45%
Ana:   78%
Jose:  65%
Luis:  90%
Rosa:  55%
Mark:  80%
─────────────
Total: 570%

Average = 570 / 8 = 71.25%
```

#### Step 4: Apply Formula
```
Team Grade = (Average Readiness × 0.60) + (Compliance × 0.40)

Team Grade = (71.25 × 0.60) + (80 × 0.40)
Team Grade = 42.75 + 32.00
Team Grade = 74.75%

Rounded: 75%
```

---

### Final Result Summary

| Metric | Value | Notes |
|--------|-------|-------|
| **Team Grade** | **75%** | 🟡 YELLOW |
| Average Readiness | 71.25% | Based on 8 check-ins |
| Check-in Compliance | 80% | 8 of 10 active members |
| Total Members | 12 | - |
| Active Members | 10 | Excluding exemptions |
| On Leave/Exemption | 2 | Nina, Rex |
| Checked In Today | 8 | - |
| Not Checked In | 2 | Carlo, Beth |

---

### Status Distribution (from those who checked in)

| Status | Count | Percentage | Members |
|--------|-------|------------|---------|
| 🟢 GREEN | 4 | 50% | Juan, Ana, Luis, Mark |
| 🟡 YELLOW | 2 | 25% | Maria, Jose |
| 🔴 RED | 2 | 25% | Pedro, Rosa |

---

### Grade Interpretation Table

| Team Grade | Color | Label | Meaning |
|------------|-------|-------|---------|
| 90-100% | 🟢 GREEN | Excellent | Team is doing great! |
| 70-89% | 🟡 YELLOW | Good | Okay but monitor closely |
| 50-69% | 🟠 ORANGE | Needs Improvement | Some issues, intervention needed |
| 0-49% | 🔴 RED | Critical | Serious problems, immediate action |

---

### What the Team Leader Sees

```
┌─────────────────────────────────────────────────────────┐
│  Team Grade                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │                     75%                          │   │
│  │                   YELLOW                         │   │
│  │              Good / Monitor Closely              │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Avg Score    │  │ Compliance   │  │ On Leave     │  │
│  │    71%       │  │  8/10 (80%)  │  │     2        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ⚠️ Needs Attention                                     │
│  ├─ Carlo - No check-in today                          │
│  ├─ Beth - No check-in today                           │
│  ├─ Pedro - RED status (45%)                           │
│  └─ Rosa - RED status (55%)                            │
│                                                         │
│  🏥 On Leave/Exemption                                  │
│  ├─ Nina - Sick Leave (until Jan 10)                   │
│  └─ Rex - Vacation (until Jan 15)                      │
└─────────────────────────────────────────────────────────┘
```

---

### Action Items Generated for Team Leader

| Priority | Action | Member | Reason |
|----------|--------|--------|--------|
| 🔴 High | Check on | Pedro | RED status, score 45% |
| 🔴 High | Check on | Rosa | RED status, score 55% |
| 🟡 Medium | Send reminder | Carlo | No check-in today |
| 🟡 Medium | Send reminder | Beth | No check-in today |

---

## Edge Cases

### Case 1: All Members on Leave
```
Active Members: 0
Team Grade: N/A (display "No active members")
```

### Case 2: No One Checked In
```
Compliance: 0%
Average Score: 0%
Team Grade = (0 × 0.60) + (0 × 0.40) = 0%
Display: "No check-ins today"
```

### Case 3: Everyone Checked In with Perfect Scores
```
Compliance: 100%
Average Score: 100%
Team Grade = (100 × 0.60) + (100 × 0.40) = 100%
```

### Case 4: Small Team (2 members, 1 on leave)
```
Total: 2
On Leave: 1
Active: 1
Checked In: 1 (100% compliance)
Score: 80%
Team Grade = (80 × 0.60) + (100 × 0.40) = 88%
```

---

## Features List

### 1. Team Grade Overview (Hero Section)
- Big circular progress showing Team Grade %
- Color coded (GREEN/YELLOW/ORANGE/RED)
- Label (Excellent/Good/Needs Improvement/Critical)
- Breakdown: Avg Score | Compliance | On Leave count

### 2. Team Readiness Trend (Line Chart)
- Last 30 days of team average scores
- Color zones (GREEN/YELLOW/RED backgrounds)
- Hover to see daily details

### 3. Status Distribution (Donut Chart)
- GREEN / YELLOW / RED breakdown
- From today's or selected period's check-ins

### 4. Top Reasons for Low Scores (Bar Chart)
- Horizontal bars showing count per reason
- From `lowScoreReason` field
- Categories: Work Stress, Personal, Health, Sleep, Family, Financial, Other

### 5. Team Metrics Averages (Progress Bars)
- Mood (1-10)
- Stress (1-10, lower is better)
- Sleep (1-10)
- Physical Health (1-10)

### 6. Members Needing Attention (List)
- No check-in today
- RED status
- Declining trend (3+ days of dropping scores)

### 7. On Leave/Exemption (List)
- Show who's on leave
- Leave type and end date

### 8. Top Performers (Optional/Phase 2)
- Longest streaks
- Best scores
- Most improved

---

## Technical Implementation

### Backend Endpoint
```
GET /teams/my/analytics?days=30
```

### Response Structure
```json
{
  "teamGrade": {
    "score": 75,
    "label": "Good",
    "color": "YELLOW",
    "avgReadiness": 71.25,
    "compliance": 80,
    "complianceDetails": {
      "checkedIn": 8,
      "activeMembers": 10,
      "onLeave": 2
    }
  },
  "statusDistribution": {
    "green": 4,
    "yellow": 2,
    "red": 2,
    "total": 8
  },
  "trendData": [
    { "date": "2026-01-01", "score": 72, "compliance": 90 },
    { "date": "2026-01-02", "score": 75, "compliance": 85 }
  ],
  "topReasons": [
    { "reason": "WORK_STRESS", "label": "Work Stress", "count": 12 },
    { "reason": "SLEEP_ISSUES", "label": "Sleep Issues", "count": 8 }
  ],
  "avgMetrics": {
    "mood": 7.2,
    "stress": 4.1,
    "sleep": 6.8,
    "physicalHealth": 6.5
  },
  "membersNeedingAttention": [
    {
      "id": "uuid-carlo",
      "name": "Carlo Santos",
      "issue": "NO_CHECKIN",
      "details": "No check-in today"
    },
    {
      "id": "uuid-pedro",
      "name": "Pedro Garcia",
      "issue": "RED_STATUS",
      "details": "Score: 45%"
    }
  ],
  "membersOnLeave": [
    {
      "id": "uuid-nina",
      "name": "Nina Cruz",
      "leaveType": "SICK_LEAVE",
      "endDate": "2026-01-10"
    }
  ]
}
```

### Frontend Files
```
frontend/src/
├── pages/
│   └── team-leader/
│       └── team-analytics.page.tsx
├── components/
│   └── charts/
│       ├── TeamGradeCircle.tsx      # NEW - circular progress
│       ├── ReadinessTrendChart.tsx  # Reuse
│       ├── StatusDistributionChart.tsx  # Reuse
│       ├── MetricsAverageChart.tsx  # Reuse
│       └── TopReasonsChart.tsx      # NEW - horizontal bars
└── services/
    └── team.service.ts              # Add getTeamAnalytics()
```

---

## Mobile Design

```
┌─────────────────────────┐
│ ← Team Analytics        │
├─────────────────────────┤
│    ┌───────────────┐    │
│    │               │    │
│    │      75%      │    │
│    │    YELLOW     │    │
│    │     Good      │    │
│    └───────────────┘    │
├─────────────────────────┤
│ ┌───────┐ ┌───────┐    │
│ │ 71%   │ │ 8/10  │    │ <- Horizontal scroll
│ │ Score │ │ Today │    │
│ └───────┘ └───────┘    │
├─────────────────────────┤
│ Readiness Trend         │
│ [━━━━━━━━━━━━━━━━━━━━] │
├─────────────────────────┤
│ Status Distribution     │
│      [Donut Chart]      │
├─────────────────────────┤
│ Top Reasons             │
│ Work Stress    ████ 12  │
│ Sleep Issues   ███  8   │
│ Personal       ██   5   │
├─────────────────────────┤
│ ⚠️ Needs Attention (4)  │
│ ┌─────────────────────┐ │
│ │ 🔴 Pedro - 45%      │ │
│ │ 🔴 Rosa - 55%       │ │
│ │ ⚪ Carlo - No check │ │
│ │ ⚪ Beth - No check  │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ 🏥 On Leave (2)         │
│ ┌─────────────────────┐ │
│ │ Nina - Sick (Jan 10)│ │
│ │ Rex - Vacation (15) │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## Implementation Priority

### Phase 1 - Core (Must Have)
- [ ] Backend endpoint `/teams/my/analytics`
- [ ] Team Grade computation with exemption handling
- [ ] Team Grade circle component
- [ ] Basic stats cards
- [ ] Status distribution chart

### Phase 2 - Insights (Should Have)
- [ ] Readiness trend chart
- [ ] Top reasons chart
- [ ] Members needing attention list
- [ ] On leave list

### Phase 3 - Polish (Nice to Have)
- [ ] Team metrics averages
- [ ] Top performers
- [ ] Export to PDF
- [ ] Date range selector

---

## Ready to Implement?

Confirm the following:
1. ✅ Formula: `(Avg Readiness × 0.60) + (Compliance × 0.40)`
2. ✅ Exclude members on leave from computation
3. ✅ Grade colors: GREEN (90+), YELLOW (70-89), ORANGE (50-69), RED (<50)

**Say "go" to start implementation!**
