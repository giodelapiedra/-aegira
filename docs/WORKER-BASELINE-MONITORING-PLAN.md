# Worker Baseline Monitoring Feature Plan

> Feature para ma-detect ang sudden changes at patterns sa worker check-ins

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Solution Design](#3-solution-design)
4. [Database Schema](#4-database-schema)
5. [Detection Logic](#5-detection-logic)
6. [Safeguards](#6-safeguards)
7. [UI Changes](#7-ui-changes)
8. [Implementation Steps](#8-implementation-steps)
9. [API Endpoints](#9-api-endpoints)

---

## 1. Overview

### Ano ang Feature na Ito?

Isang system na:
1. **Tracks baseline** - Alam ang "normal" score ng bawat worker
2. **Detects sudden changes** - Naka-flag kung malayo sa baseline ang score ngayon
3. **Identifies volatile workers** - Naka-flag kung laging taas-baba ang scores
4. **Monitors key metrics** - Tracks stress at sleep patterns specifically

### Key Concepts

```
BASELINE = Average score ng worker sa last 7-30 days (their "normal")

SUDDEN CHANGE = Today's score is significantly different from baseline
                Example: Baseline 80, Today 55 = -31% drop = FLAG!

VOLATILITY = Worker's scores are always inconsistent (high standard deviation)
             Example: 85, 52, 78, 55, 88, 50 = UNSTABLE pattern

STRESS SPIKE = Stress level today is much higher than usual
               Example: Normal stress 3, Today 9 = FLAG!

SLEEP CRASH = Sleep score today is much lower than usual
              Example: Normal sleep 8, Today 3 = FLAG!
```

---

## 2. Problem Statement

### Current System Limitations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   PROBLEM 1: No Personal Baseline                                       │
│   ───────────────────────────────                                       │
│   Current: Everyone judged by same thresholds (50, 70)                  │
│   Issue: Score 65 is normal for Pedro but alarming for Maria (baseline 85)│
│                                                                          │
│   PROBLEM 2: Can't Detect Gradual Decline                               │
│   ─────────────────────────────────────                                 │
│   Current: Only flags RED status                                        │
│   Issue: Worker going 78 → 72 → 68 → 62 → 58 not detected              │
│          No sudden drop, but clearly declining                          │
│                                                                          │
│   PROBLEM 3: Volatile Workers Not Identified                            │
│   ──────────────────────────────────────────                            │
│   Current: Each day judged independently                                │
│   Issue: Worker with scores 85, 50, 82, 48, 88, 52 looks "sometimes RED"│
│          But the PATTERN is the problem - unstable                      │
│                                                                          │
│   PROBLEM 4: Hidden Stress/Sleep Issues                                 │
│   ───────────────────────────────────────                               │
│   Current: Only overall score matters                                   │
│   Issue: Stress 9 (very high) but overall score 75 (GREEN)             │
│          Stress spike hidden by other good scores                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Solution Design

### Detection Types

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   TYPE 1: SUDDEN DROP                                                   │
│   ─────────────────────                                                 │
│   What: Today's score significantly below baseline                      │
│   Threshold: Drop ≥ 20% from baseline                                   │
│   For: STABLE workers (low volatility)                                  │
│   Example: Baseline 80, Today 60 = -25% → FLAG                          │
│                                                                          │
│   TYPE 2: VOLATILITY PATTERN                                            │
│   ──────────────────────────                                            │
│   What: Worker's scores are always inconsistent                         │
│   Threshold: Standard Deviation > 12                                    │
│   For: Workers with erratic patterns                                    │
│   Example: 85, 52, 78, 55, 88, 50 (StdDev 16) → FLAG                   │
│                                                                          │
│   TYPE 3: STRESS SPIKE                                                  │
│   ────────────────────                                                  │
│   What: Today's stress much higher than usual                           │
│   Threshold: Stress increase ≥ 100% (double or more)                    │
│   Example: Avg stress 3, Today 7 = +133% → FLAG                         │
│                                                                          │
│   TYPE 4: SLEEP CRASH                                                   │
│   ───────────────────                                                   │
│   What: Today's sleep much lower than usual                             │
│   Threshold: Sleep drop ≥ 40%                                           │
│   Example: Avg sleep 8, Today 4 = -50% → FLAG                           │
│                                                                          │
│   TYPE 5: CONSECUTIVE DECLINE                                           │
│   ───────────────────────────                                           │
│   What: Score declining for multiple days in a row                      │
│   Threshold: 3+ consecutive declining days                              │
│   Example: Day1: 78, Day2: 72, Day3: 65, Day4: 58 → FLAG               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Minimum Data Requirement

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   MINIMUM: 7 check-ins before baseline detection activates             │
│                                                                          │
│   Days 1-6:  Use existing RED/YELLOW/GREEN system only                 │
│   Day 7+:    Baseline detection ACTIVE                                  │
│                                                                          │
│   Rationale:                                                             │
│   - 7 days = 1 full work week                                           │
│   - Enough data to establish "normal"                                   │
│   - Not too long to wait                                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### New Table: WorkerBaseline

```prisma
model WorkerBaseline {
  id                String    @id @default(uuid())
  userId            String    @unique  // One record per worker
  companyId         String

  // ===== OVERALL BASELINE =====
  baseline          Float?    // Average overall score (7-30 days)
  baselineStdDev    Float?    // Standard deviation (consistency measure)

  // ===== KEY METRICS BASELINE =====
  avgStress         Float?    // Average stress level
  avgSleep          Float?    // Average sleep score

  // ===== FLAGS =====
  isVolatile        Boolean   @default(false)  // StdDev > 12

  // ===== TRACKING =====
  consecutiveDecline Int      @default(0)      // Days in a row declining
  lastScoreDropPct   Float?                    // Today vs baseline % change

  // ===== META =====
  dataPoints        Int       @default(0)      // Number of check-ins used
  updatedAt         DateTime  @updatedAt
  createdAt         DateTime  @default(now())

  // ===== RELATIONS =====
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  company           Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([isVolatile])
  @@index([userId])
}
```

### Update User Model (Add Relation Only)

```prisma
model User {
  // ... existing fields ...

  // Add relation
  workerBaseline    WorkerBaseline?
}
```

### Summary of Schema

| Field | Type | Purpose |
|-------|------|---------|
| `baseline` | Float | Average overall score |
| `baselineStdDev` | Float | Consistency (standard deviation) |
| `avgStress` | Float | Average stress level |
| `avgSleep` | Float | Average sleep score |
| `isVolatile` | Boolean | Flag for unstable workers |
| `consecutiveDecline` | Int | Count of declining days |
| `lastScoreDropPct` | Float | Today's % change from baseline |
| `dataPoints` | Int | Number of check-ins used |

**Total: 8 data fields + meta fields**

---

## 5. Detection Logic

### Main Detection Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   WORKER SUBMITS CHECK-IN                                               │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────┐                               │
│   │ 1. Save check-in (existing logic)   │                               │
│   └─────────────────────────────────────┘                               │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────┐                               │
│   │ 2. Get worker's WorkerBaseline      │                               │
│   │    (or create if first time)        │                               │
│   └─────────────────────────────────────┘                               │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────┐                               │
│   │ 3. Has 7+ check-ins?                │                               │
│   └─────────────────────────────────────┘                               │
│            │                                                             │
│      ┌─────┴─────┐                                                       │
│      ▼           ▼                                                       │
│   [ NO ]      [ YES ]                                                   │
│      │           │                                                       │
│      ▼           ▼                                                       │
│   Skip       ┌─────────────────────────────────────┐                    │
│   detection  │ 4. Calculate new baseline values    │                    │
│              │    - baseline (avg score)           │                    │
│              │    - baselineStdDev                 │                    │
│              │    - avgStress, avgSleep            │                    │
│              └─────────────────────────────────────┘                    │
│                          │                                               │
│                          ▼                                               │
│              ┌─────────────────────────────────────┐                    │
│              │ 5. Run detection checks             │                    │
│              │    - Sudden drop?                   │                    │
│              │    - Stress spike?                  │                    │
│              │    - Sleep crash?                   │                    │
│              │    - Consecutive decline?           │                    │
│              │    - Volatile pattern?              │                    │
│              └─────────────────────────────────────┘                    │
│                          │                                               │
│                          ▼                                               │
│              ┌─────────────────────────────────────┐                    │
│              │ 6. Update WorkerBaseline record     │                    │
│              └─────────────────────────────────────┘                    │
│                          │                                               │
│                          ▼                                               │
│              ┌─────────────────────────────────────┐                    │
│              │ 7. Return flags to frontend         │                    │
│              │    (for Team Lead dashboard)        │                    │
│              └─────────────────────────────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Detection Thresholds

```typescript
const THRESHOLDS = {
  // Minimum data requirement
  MIN_CHECKINS: 7,                    // Need 7 check-ins before detection

  // Sudden drop detection
  SUDDEN_DROP_PERCENT: -20,           // Flag if drop >= 20%

  // Volatility detection
  VOLATILE_STDDEV: 12,                // Flag if StdDev > 12

  // Stress spike detection
  STRESS_SPIKE_PERCENT: 100,          // Flag if stress increase >= 100%

  // Sleep crash detection
  SLEEP_CRASH_PERCENT: -40,           // Flag if sleep drop >= 40%

  // Consecutive decline
  CONSECUTIVE_DECLINE_DAYS: 3,        // Flag if 3+ days declining

  // Absolute limits (always apply regardless of baseline)
  ABSOLUTE_RED: 50,                   // Always RED below 50
  ABSOLUTE_YELLOW: 60,                // Always YELLOW below 60
  BASELINE_FLOOR: 65,                 // Minimum baseline for calculations
};
```

### Calculation Functions

```typescript
// Calculate baseline (average of scores)
function calculateBaseline(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Calculate standard deviation (consistency)
function calculateStdDev(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg = calculateBaseline(scores);
  const squareDiffs = scores.map(score => Math.pow(score - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / scores.length;
  return Math.sqrt(avgSquareDiff);
}

// Calculate drop percentage
function calculateDropPercent(today: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((today - baseline) / baseline) * 100;
}

// Count consecutive declining days
function countConsecutiveDecline(scores: number[]): number {
  // scores ordered newest first
  let count = 0;
  for (let i = 0; i < scores.length - 1; i++) {
    if (scores[i] < scores[i + 1]) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
```

---

## 6. Safeguards

### Anti-Gaming Measures

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   SAFEGUARD 1: ABSOLUTE FLOOR                                           │
│   ─────────────────────────────                                         │
│   Score < 50 = ALWAYS RED (regardless of baseline)                      │
│   Score < 60 = ALWAYS YELLOW                                            │
│                                                                          │
│   Prevents: Worker lowering baseline then staying just above 50         │
│                                                                          │
│   ─────────────────────────────────────────────────────────────────────│
│                                                                          │
│   SAFEGUARD 2: BASELINE FLOOR                                           │
│   ────────────────────────────                                          │
│   Minimum baseline for calculations = 65                                │
│   If actual average is 55, we use 65 for drop calculations             │
│                                                                          │
│   Prevents: Worker training a very low baseline                         │
│                                                                          │
│   ─────────────────────────────────────────────────────────────────────│
│                                                                          │
│   SAFEGUARD 3: TEAM COMPARISON (Future Enhancement)                     │
│   ─────────────────────────────────────────────────                     │
│   Flag if worker's baseline is significantly below team average         │
│                                                                          │
│   Example: Team avg 78, Worker avg 55 = FLAG as outlier                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Safeguard Logic

```typescript
function applyAbsoluteLimits(score: number): { status: string; bypassed: boolean } {
  if (score < 50) {
    return { status: 'RED', bypassed: true };  // Always RED
  }
  if (score < 60) {
    return { status: 'YELLOW', bypassed: true };  // Always YELLOW
  }
  return { status: 'CHECK_BASELINE', bypassed: false };
}

function getEffectiveBaseline(actualBaseline: number): number {
  const BASELINE_FLOOR = 65;
  return Math.max(actualBaseline, BASELINE_FLOOR);
}
```

---

## 7. UI Changes

### Daily Monitoring Dashboard (Team Lead)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   DAILY MONITORING                                                       │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  ⚠️ BASELINE ALERTS (3)                                          │  │
│   │                                                                   │  │
│   │  ┌───────────────────────────────────────────────────────────┐  │  │
│   │  │ 🔴 SUDDEN DROP - Juan dela Cruz                           │  │  │
│   │  │                                                            │  │  │
│   │  │ Today: 52    Baseline: 80                                 │  │  │
│   │  │ Drop: -35%                                                │  │  │
│   │  │                                                            │  │  │
│   │  │ ⚡ Unusual for this worker                                │  │  │
│   │  │ Recommendation: Check in today                            │  │  │
│   │  │                                                            │  │  │
│   │  │ [ VIEW HISTORY ]  [ ACKNOWLEDGE ]                         │  │  │
│   │  └───────────────────────────────────────────────────────────┘  │  │
│   │                                                                   │  │
│   │  ┌───────────────────────────────────────────────────────────┐  │  │
│   │  │ 🟠 STRESS SPIKE - Maria Santos                            │  │  │
│   │  │                                                            │  │  │
│   │  │ Today Score: 75 (GREEN)                                   │  │  │
│   │  │ BUT: Stress 8 vs Normal 3 (+167%)                         │  │  │
│   │  │                                                            │  │  │
│   │  │ ⚡ Score looks fine but stress unusually high             │  │  │
│   │  │ Recommendation: Monitor for 2 days                        │  │  │
│   │  │                                                            │  │  │
│   │  │ [ VIEW HISTORY ]  [ ACKNOWLEDGE ]                         │  │  │
│   │  └───────────────────────────────────────────────────────────┘  │  │
│   │                                                                   │  │
│   │  ┌───────────────────────────────────────────────────────────┐  │  │
│   │  │ 🔄 VOLATILE PATTERN - Pedro Reyes                         │  │  │
│   │  │                                                            │  │  │
│   │  │ Last 7 days: 85, 52, 78, 55, 88, 50, 82                  │  │  │
│   │  │ Pattern: Very inconsistent (StdDev: 16.2)                 │  │  │
│   │  │                                                            │  │  │
│   │  │ ⚡ Worker has unstable pattern                            │  │  │
│   │  │ Recommendation: Regular check-ins, not just today         │  │  │
│   │  │                                                            │  │  │
│   │  │ [ VIEW HISTORY ]  [ ACKNOWLEDGE ]                         │  │  │
│   │  └───────────────────────────────────────────────────────────┘  │  │
│   │                                                                   │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  📊 TEAM BASELINE OVERVIEW                                       │  │
│   │                                                                   │  │
│   │  Worker          Baseline   Today   Change   Status              │  │
│   │  ────────────────────────────────────────────────────────────   │  │
│   │  Juan dela Cruz     80       52     -35%    🔴 Sudden Drop      │  │
│   │  Maria Santos       76       75      -1%    🟠 Stress Spike     │  │
│   │  Pedro Reyes        70       82     +17%    🔄 Volatile         │  │
│   │  Ana Garcia         82       80      -2%    ✅ Normal           │  │
│   │  Carlos Mendez      78       79      +1%    ✅ Normal           │  │
│   │  ...                                                             │  │
│   │                                                                   │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Worker History View (Enhancement)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   JUAN DELA CRUZ - Baseline Analysis                                    │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  BASELINE STATS                                                  │  │
│   │                                                                   │  │
│   │  Overall Baseline: 80                                            │  │
│   │  Consistency: ████████████░░░░ Stable (StdDev: 4.2)             │  │
│   │                                                                   │  │
│   │  Avg Stress: 3.2                                                 │  │
│   │  Avg Sleep: 7.5                                                  │  │
│   │                                                                   │  │
│   │  Data Points: 25 check-ins                                       │  │
│   │  Last Updated: Today 8:15 AM                                     │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  30-DAY TREND                                                    │  │
│   │                                                                   │  │
│   │  Score                                                           │  │
│   │   100│                                                           │  │
│   │    90│      ╭─╮   ╭─╮                                           │  │
│   │    80│──────╯ ╰───╯ ╰────────────╮          ← Baseline          │  │
│   │    70│                           ╰──╮                            │  │
│   │    60│                              ╰──╮                         │  │
│   │    50│                                 ╰── Today (52)            │  │
│   │    40│                                                           │  │
│   │      └────────────────────────────────────────────               │  │
│   │        Week 1      Week 2      Week 3      Week 4                │  │
│   │                                                                   │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Steps

### Phase 1: Database Setup

```
[ ] 1.1 Create WorkerBaseline model in schema.prisma
[ ] 1.2 Add relation to User model
[ ] 1.3 Run prisma db push
[ ] 1.4 Verify table created in database
```

### Phase 2: Backend Core Logic

```
[ ] 2.1 Create baseline-calculator.ts utility
       - calculateBaseline()
       - calculateStdDev()
       - calculateDropPercent()
       - countConsecutiveDecline()

[ ] 2.2 Create baseline-detector.ts utility
       - detectSuddenDrop()
       - detectStressSpike()
       - detectSleepCrash()
       - detectVolatility()
       - detectConsecutiveDecline()

[ ] 2.3 Create baseline-service.ts
       - updateWorkerBaseline()
       - getWorkerBaseline()
       - getTeamBaselineAlerts()
```

### Phase 3: Integration with Check-in

```
[ ] 3.1 Modify POST /checkins endpoint
       - After saving check-in, call updateWorkerBaseline()
       - Include baseline alerts in response

[ ] 3.2 Test with sample data
       - Create test worker with 10+ check-ins
       - Verify baseline calculations
       - Verify alert detection
```

### Phase 4: API Endpoints

```
[ ] 4.1 GET /baseline/:userId
       - Get worker's baseline data

[ ] 4.2 GET /baseline/team/:teamId/alerts
       - Get all baseline alerts for team

[ ] 4.3 GET /baseline/team/:teamId/overview
       - Get baseline overview for all team members
```

### Phase 5: Frontend (Daily Monitoring)

```
[ ] 5.1 Add "Baseline Alerts" section to daily monitoring
[ ] 5.2 Show alert cards with details
[ ] 5.3 Add baseline column to worker list
[ ] 5.4 Add worker baseline history view
```

### Phase 6: Testing & Refinement

```
[ ] 6.1 Test edge cases
       - New worker (< 7 check-ins)
       - Volatile worker
       - Gaming attempts

[ ] 6.2 Adjust thresholds if needed
[ ] 6.3 Performance testing
```

---

## 9. API Endpoints

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/baseline/:userId` | Get worker's baseline data |
| GET | `/api/baseline/team/:teamId/alerts` | Get baseline alerts for team |
| GET | `/api/baseline/team/:teamId/overview` | Get baseline overview for team |

### Modified Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| POST | `/api/checkins` | Add baseline calculation after check-in |
| GET | `/api/daily-monitoring` | Include baseline alerts |

### Response Examples

#### GET /api/baseline/:userId

```json
{
  "userId": "uuid",
  "baseline": 80,
  "baselineStdDev": 4.2,
  "avgStress": 3.2,
  "avgSleep": 7.5,
  "isVolatile": false,
  "consecutiveDecline": 0,
  "lastScoreDropPct": -35,
  "dataPoints": 25,
  "updatedAt": "2024-01-12T08:15:00Z"
}
```

#### GET /api/baseline/team/:teamId/alerts

```json
{
  "alerts": [
    {
      "type": "SUDDEN_DROP",
      "userId": "uuid",
      "userName": "Juan dela Cruz",
      "todayScore": 52,
      "baseline": 80,
      "dropPercent": -35,
      "recommendation": "Check in with worker today"
    },
    {
      "type": "STRESS_SPIKE",
      "userId": "uuid",
      "userName": "Maria Santos",
      "todayScore": 75,
      "todayStress": 8,
      "avgStress": 3,
      "stressIncrease": 167,
      "recommendation": "Monitor for 2 days"
    },
    {
      "type": "VOLATILITY",
      "userId": "uuid",
      "userName": "Pedro Reyes",
      "baseline": 70,
      "stdDev": 16.2,
      "recentScores": [85, 52, 78, 55, 88, 50, 82],
      "recommendation": "Schedule regular check-ins"
    }
  ]
}
```

---

## Summary

### What We're Building

| Component | Description |
|-----------|-------------|
| **WorkerBaseline table** | Stores baseline data per worker |
| **Baseline calculator** | Calculates avg, stdDev, metrics |
| **Baseline detector** | Detects sudden changes, spikes, patterns |
| **API endpoints** | Exposes baseline data |
| **UI updates** | Shows alerts in daily monitoring |

### Key Thresholds

| Detection | Threshold |
|-----------|-----------|
| Minimum check-ins | 7 |
| Sudden drop | ≥ 20% drop |
| Volatility | StdDev > 12 |
| Stress spike | ≥ 100% increase |
| Sleep crash | ≥ 40% drop |
| Consecutive decline | 3+ days |

### Safeguards

| Safeguard | Value |
|-----------|-------|
| Absolute RED | Score < 50 |
| Absolute YELLOW | Score < 60 |
| Baseline floor | Minimum 65 |

---

*Plan created for Aegira Worker Baseline Monitoring Feature*
