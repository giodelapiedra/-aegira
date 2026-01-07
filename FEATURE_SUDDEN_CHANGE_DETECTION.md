# FEATURE: Sudden Score Change Detection
**Feature Name:** Readiness Change Monitor / "Suddenly Changed" List
**Priority:** HIGH
**Target Users:** Team Lead, Supervisor, Executive
**Date:** January 5, 2026

---

## 1. PROBLEM STATEMENT

### Current Situation:
- Team Leads can see current readiness scores ng mga workers
- Pero walang easy way to detect kung may SUDDEN CHANGE sa score
- Example: Si Juan usually GREEN (80+), biglang YELLOW (50) today
- Kailangan manually i-check lahat ng workers para makita changes

### Pain Points:
1. **Hindi agad nakikita** ang mga workers na biglang bumaba ang score
2. **Time-consuming** mag-check ng each worker individually
3. **Missed opportunities** for early intervention
4. **No historical trend comparison** in real-time

---

## 2. PROPOSED SOLUTION

### Feature: "Suddenly Changed" List

Automatic detection ng workers na may significant change sa readiness score compared to their recent average.

### Key Components:

```
┌─────────────────────────────────────────────────────────────┐
│  TEAM ANALYTICS - Suddenly Changed                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ 3 members with significant changes today                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 Juan Santos         DROP                         │   │
│  │    Today: 45 (YELLOW)  │  7-day avg: 82 (GREEN)    │   │
│  │    Change: -37 points  │  ↓ Significant Drop        │   │
│  │    [View History] [Schedule 1-on-1]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟡 Maria Cruz          DROP                         │   │
│  │    Today: 55 (YELLOW)  │  7-day avg: 78 (GREEN)    │   │
│  │    Change: -23 points  │  ↓ Notable Drop            │   │
│  │    [View History] [Schedule 1-on-1]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 Pedro Reyes         IMPROVEMENT                  │   │
│  │    Today: 85 (GREEN)   │  7-day avg: 52 (YELLOW)   │   │
│  │    Change: +33 points  │  ↑ Significant Improvement │   │
│  │    [View History] [Send Recognition]                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. CHANGE DETECTION LOGIC

### 3.1 Calculation Method

```typescript
interface ScoreChange {
  userId: string;
  userName: string;
  todayScore: number;
  todayStatus: 'GREEN' | 'YELLOW' | 'RED';
  averageScore: number;      // 7-day rolling average
  averageStatus: 'GREEN' | 'YELLOW' | 'RED';
  changeAmount: number;      // todayScore - averageScore
  changePercent: number;     // (change / averageScore) * 100
  changeType: 'DROP' | 'IMPROVEMENT' | 'STABLE';
  severity: 'CRITICAL' | 'SIGNIFICANT' | 'NOTABLE' | 'MINOR';
  consecutiveDays: number;   // Days in same direction
}
```

### 3.2 Threshold Definitions

| Severity | Point Change | Description |
|----------|--------------|-------------|
| **CRITICAL** | ≥ 30 points drop | Urgent attention needed |
| **SIGNIFICANT** | 20-29 points | Needs follow-up |
| **NOTABLE** | 15-19 points | Worth monitoring |
| **MINOR** | 10-14 points | Slight change |
| **STABLE** | < 10 points | Normal variation |

### 3.3 Status Change Detection

Additional flag when STATUS changes (not just score):

| Change | Flag |
|--------|------|
| GREEN → RED | 🚨 CRITICAL DROP |
| GREEN → YELLOW | ⚠️ DROPPED |
| YELLOW → RED | 🔴 WORSENING |
| RED → YELLOW | 🔄 RECOVERING |
| YELLOW → GREEN | ✅ IMPROVED |
| RED → GREEN | 🎉 FULLY RECOVERED |

### 3.4 Algorithm

```typescript
function detectSuddenChanges(teamId: string): ScoreChange[] {
  // 1. Get all team members
  const members = await getTeamMembers(teamId);

  // 2. For each member, calculate:
  const changes: ScoreChange[] = [];

  for (const member of members) {
    // Get today's check-in
    const todayCheckin = await getTodayCheckin(member.id);
    if (!todayCheckin) continue; // Skip if not checked in

    // Get last 7 days of check-ins (excluding today)
    const recentCheckins = await getRecentCheckins(member.id, 7);

    // Need at least 3 days of history for meaningful average
    if (recentCheckins.length < 3) continue;

    // Calculate 7-day average
    const avgScore = recentCheckins.reduce((sum, c) => sum + c.readinessScore, 0)
                     / recentCheckins.length;

    // Calculate change
    const change = todayCheckin.readinessScore - avgScore;
    const changePercent = (Math.abs(change) / avgScore) * 100;

    // Determine severity
    let severity: 'CRITICAL' | 'SIGNIFICANT' | 'NOTABLE' | 'MINOR' | 'STABLE';
    const absChange = Math.abs(change);

    if (absChange >= 30) severity = 'CRITICAL';
    else if (absChange >= 20) severity = 'SIGNIFICANT';
    else if (absChange >= 15) severity = 'NOTABLE';
    else if (absChange >= 10) severity = 'MINOR';
    else severity = 'STABLE';

    // Only include non-stable changes
    if (severity !== 'STABLE') {
      changes.push({
        userId: member.id,
        userName: `${member.firstName} ${member.lastName}`,
        todayScore: todayCheckin.readinessScore,
        todayStatus: todayCheckin.readinessStatus,
        averageScore: Math.round(avgScore),
        averageStatus: getStatusFromScore(avgScore),
        changeAmount: Math.round(change),
        changePercent: Math.round(changePercent),
        changeType: change < 0 ? 'DROP' : 'IMPROVEMENT',
        severity,
        consecutiveDays: await getConsecutiveTrendDays(member.id, change < 0 ? 'down' : 'up'),
      });
    }
  }

  // Sort by severity (CRITICAL first) then by change amount
  return changes.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, SIGNIFICANT: 1, NOTABLE: 2, MINOR: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return Math.abs(b.changeAmount) - Math.abs(a.changeAmount);
  });
}
```

---

## 4. DATABASE CHANGES

### Option A: Real-time Calculation (No New Tables)
Calculate on-demand when viewing analytics. Simpler but slower for large teams.

### Option B: Pre-computed Cache (Recommended)
Add new model for caching computed changes:

```prisma
// Add to schema.prisma

model ReadinessChange {
  id              String   @id @default(uuid())
  companyId       String
  teamId          String
  userId          String
  date            DateTime @db.Date

  // Today's data
  todayScore      Float
  todayStatus     ReadinessStatus

  // Historical comparison
  avgScore7Day    Float    // 7-day rolling average
  avgScore30Day   Float?   // 30-day rolling average (optional)

  // Change metrics
  changeAmount    Float    // Positive = improvement, Negative = drop
  changePercent   Float
  changeType      ChangeType
  severity        ChangeSeverity

  // Trend tracking
  consecutiveDays Int      @default(1)  // Days trending same direction
  statusChanged   Boolean  @default(false)  // Did status change?
  previousStatus  ReadinessStatus?

  // Flags
  isAcknowledged  Boolean  @default(false)  // Team lead saw it
  acknowledgedAt  DateTime?
  acknowledgedBy  String?

  createdAt       DateTime @default(now())

  company         Company  @relation(fields: [companyId], references: [id])
  team            Team     @relation(fields: [teamId], references: [id])
  user            User     @relation(fields: [userId], references: [id])

  @@unique([userId, date])
  @@index([teamId, date])
  @@index([severity])
  @@index([changeType])
  @@map("readiness_changes")
}

enum ChangeType {
  DROP
  IMPROVEMENT
  STABLE
}

enum ChangeSeverity {
  CRITICAL
  SIGNIFICANT
  NOTABLE
  MINOR
  STABLE
}
```

---

## 5. API ENDPOINTS

### 5.1 Get Sudden Changes for Team

```
GET /api/analytics/team/:teamId/sudden-changes
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| date | string | today | Date to check (YYYY-MM-DD) |
| severity | string | all | Filter: CRITICAL, SIGNIFICANT, NOTABLE, MINOR |
| type | string | all | Filter: DROP, IMPROVEMENT |
| minChange | number | 10 | Minimum point change to include |

**Response:**
```json
{
  "date": "2026-01-06",
  "teamId": "team-123",
  "teamName": "Warehouse Team",
  "totalMembers": 10,
  "checkedInToday": 8,
  "changesDetected": 3,
  "summary": {
    "critical": 1,
    "significant": 1,
    "notable": 1,
    "drops": 2,
    "improvements": 1
  },
  "changes": [
    {
      "userId": "user-456",
      "userName": "Juan Santos",
      "avatar": "https://...",
      "todayScore": 45,
      "todayStatus": "YELLOW",
      "avgScore7Day": 82,
      "avgStatus": "GREEN",
      "changeAmount": -37,
      "changePercent": 45,
      "changeType": "DROP",
      "severity": "CRITICAL",
      "statusChanged": true,
      "previousStatus": "GREEN",
      "consecutiveDays": 1,
      "isAcknowledged": false,
      "checkinTime": "2026-01-06T08:15:00Z",
      "notes": "Feeling unwell, didn't sleep well"
    },
    // ... more changes
  ]
}
```

### 5.2 Get Change History for User

```
GET /api/analytics/user/:userId/change-history
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | number | 30 | Number of days to look back |

**Response:**
```json
{
  "userId": "user-456",
  "userName": "Juan Santos",
  "period": {
    "start": "2025-12-07",
    "end": "2026-01-06"
  },
  "stats": {
    "totalCheckins": 23,
    "avgScore": 75,
    "scoreRange": { "min": 45, "max": 92 },
    "volatility": "MODERATE",  // LOW, MODERATE, HIGH
    "dropsCount": 3,
    "improvementsCount": 5
  },
  "history": [
    {
      "date": "2026-01-06",
      "score": 45,
      "status": "YELLOW",
      "change": -37,
      "severity": "CRITICAL"
    },
    {
      "date": "2026-01-03",
      "score": 82,
      "status": "GREEN",
      "change": +5,
      "severity": "STABLE"
    },
    // ... more days
  ],
  "recentTrend": "DECLINING"  // STABLE, IMPROVING, DECLINING
}
```

### 5.3 Acknowledge Change

```
PATCH /api/analytics/changes/:changeId/acknowledge
```

Marks a detected change as "seen" by team lead.

**Request:**
```json
{
  "notes": "Scheduled 1-on-1 for tomorrow"
}
```

### 5.4 Get Company-wide Changes (Supervisor/Executive)

```
GET /api/analytics/company/sudden-changes
```

Shows all sudden changes across all teams.

---

## 6. FRONTEND COMPONENTS

### 6.1 SuddenChangesCard (Team Analytics Page)

```tsx
// Location: frontend/src/components/analytics/SuddenChangesCard.tsx

interface SuddenChangesCardProps {
  teamId: string;
  date?: string;
}

function SuddenChangesCard({ teamId, date }: SuddenChangesCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['sudden-changes', teamId, date],
    queryFn: () => analyticsService.getSuddenChanges(teamId, date),
  });

  if (isLoading) return <LoadingSpinner />;

  if (data.changesDetected === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <p>No significant changes detected today</p>
            <p className="text-sm">All team members are within normal range</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Sudden Changes
          <Badge variant="warning">{data.changesDetected}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.changes.map((change) => (
            <ChangeItem key={change.userId} change={change} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.2 ChangeItem Component

```tsx
function ChangeItem({ change }: { change: ScoreChange }) {
  const severityColors = {
    CRITICAL: 'border-red-500 bg-red-50',
    SIGNIFICANT: 'border-orange-500 bg-orange-50',
    NOTABLE: 'border-yellow-500 bg-yellow-50',
    MINOR: 'border-blue-500 bg-blue-50',
  };

  const changeIcon = change.changeType === 'DROP'
    ? <TrendingDown className="h-5 w-5 text-red-500" />
    : <TrendingUp className="h-5 w-5 text-green-500" />;

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${severityColors[change.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={change.avatar} name={change.userName} />
          <div>
            <p className="font-medium">{change.userName}</p>
            <div className="flex items-center gap-2 text-sm">
              <StatusBadge status={change.todayStatus} />
              <span className="text-gray-500">
                Today: {change.todayScore}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                7-day avg: {change.avgScore7Day}
              </span>
            </div>
          </div>
        </div>
        {changeIcon}
      </div>

      <div className="mt-2 flex items-center gap-4">
        <div className={`text-lg font-bold ${
          change.changeType === 'DROP' ? 'text-red-600' : 'text-green-600'
        }`}>
          {change.changeAmount > 0 ? '+' : ''}{change.changeAmount} points
        </div>

        {change.statusChanged && (
          <Badge variant="outline">
            {change.previousStatus} → {change.todayStatus}
          </Badge>
        )}

        {change.consecutiveDays > 1 && (
          <span className="text-sm text-gray-500">
            {change.consecutiveDays} days {change.changeType === 'DROP' ? 'declining' : 'improving'}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`/team/member-history?userId=${change.userId}`}>
            View History
          </Link>
        </Button>
        {change.changeType === 'DROP' && (
          <Button size="sm" variant="outline">
            Schedule 1-on-1
          </Button>
        )}
        {change.changeType === 'IMPROVEMENT' && (
          <Button size="sm" variant="outline">
            Send Recognition
          </Button>
        )}
      </div>
    </div>
  );
}
```

### 6.3 Score Trend Chart

```tsx
// Mini sparkline chart showing 7-day trend
function ScoreTrendChart({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ['score-trend', userId],
    queryFn: () => analyticsService.getScoreTrend(userId, 7),
  });

  return (
    <div className="h-10 w-24">
      <Sparkline
        data={data?.scores || []}
        color={data?.trend === 'DECLINING' ? '#ef4444' : '#22c55e'}
      />
    </div>
  );
}
```

---

## 7. NOTIFICATION INTEGRATION

### Auto-Alert for Critical Changes

When a CRITICAL change is detected, automatically create an Alert:

```typescript
// When check-in is submitted and change is detected
if (change.severity === 'CRITICAL' && change.changeType === 'DROP') {
  await prisma.alert.create({
    data: {
      companyId,
      type: 'DECLINING_TREND',  // or new type: 'SUDDEN_DROP'
      priority: 'HIGH',
      status: 'ACTIVE',
      title: `${userName} has a significant wellness drop`,
      description: `Readiness score dropped from ${avgScore} to ${todayScore} (-${Math.abs(change)} points)`,
      targetUserId: userId,
      recipientId: teamLeaderId,
      data: {
        todayScore,
        avgScore,
        change: changeAmount,
        todayStatus,
        previousAvgStatus,
      },
    },
  });

  // Also create notification
  await prisma.notification.create({
    data: {
      userId: teamLeaderId,
      companyId,
      title: 'Critical Wellness Alert',
      message: `${userName}'s readiness score dropped significantly today. Consider following up.`,
      type: 'WELLNESS_ALERT',
      data: { userId, changeId },
    },
  });
}
```

---

## 8. USE CASES & EXAMPLES

### Use Case 1: Team Lead Morning Check

```
=== 9:00 AM - Ana (Team Lead) opens Team Analytics ===

Ana sees:
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Sudden Changes Today                                 │
│                                                         │
│ 🚨 CRITICAL: Juan Santos                                │
│    Score: 45 (YELLOW) | 7-day avg: 82 (GREEN)          │
│    Change: -37 points                                   │
│    Note from check-in: "Didn't sleep, family problem"  │
│    [View] [Schedule 1-on-1]                            │
│                                                         │
│ ⚠️ SIGNIFICANT: Carlos Garcia                          │
│    Score: 55 (YELLOW) | 7-day avg: 78 (GREEN)          │
│    Change: -23 points                                   │
│    3rd consecutive day declining ↓                      │
│    [View] [Schedule 1-on-1]                            │
│                                                         │
│ ✅ IMPROVEMENT: Maria Cruz                              │
│    Score: 88 (GREEN) | 7-day avg: 60 (YELLOW)          │
│    Change: +28 points                                   │
│    [View] [Send Recognition]                           │
└─────────────────────────────────────────────────────────┘

Ana's Actions:
1. Clicks "Schedule 1-on-1" for Juan → Opens meeting scheduler
2. Acknowledges Carlos's change, adds note: "Will check in at lunch"
3. Sends recognition to Maria for improvement
```

### Use Case 2: Supervisor Dashboard View

```
=== Supervisor sees company-wide view ===

┌─────────────────────────────────────────────────────────┐
│ COMPANY WELLNESS CHANGES - Today                        │
│                                                         │
│ Summary: 47 check-ins | 5 significant changes           │
│                                                         │
│ By Team:                                                │
│ ├── Warehouse Team: 2 drops (1 critical)               │
│ ├── Logistics Team: 1 drop                             │
│ ├── HR Team: 0 changes                                  │
│ └── Operations Team: 2 improvements                     │
│                                                         │
│ [View Details] [Export Report]                          │
└─────────────────────────────────────────────────────────┘
```

### Use Case 3: Trend Detection Over Time

```
=== Pedro's 7-Day History ===

Day 1 (Mon): 78 (GREEN)  → Baseline
Day 2 (Tue): 75 (GREEN)  → -3 (stable)
Day 3 (Wed): 68 (YELLOW) → -7 (MINOR drop, status changed!)
Day 4 (Thu): 62 (YELLOW) → -6 (consecutive decline)
Day 5 (Fri): 55 (YELLOW) → -7 (3 days declining)
Day 6 (Mon): 48 (YELLOW) → -7 (4 days declining) ⚠️ ALERT!
Day 7 (Tue): 42 (YELLOW) → -6 (5 days declining) 🚨 CRITICAL

System flags Pedro as:
- Severity: CRITICAL (cumulative drop of 36 points from baseline)
- Trend: DECLINING for 5 consecutive work days
- Recommendation: Immediate 1-on-1 suggested
```

---

## 9. IMPLEMENTATION PHASES

### Phase 1: Basic Detection (MVP)
- [ ] Create `ReadinessChange` model
- [ ] Implement detection algorithm in check-in flow
- [ ] Add API endpoint for team sudden changes
- [ ] Create basic SuddenChangesCard component
- [ ] Show on Team Analytics page

### Phase 2: Enhanced Features
- [ ] Add company-wide view for Supervisor
- [ ] Implement acknowledge/dismiss functionality
- [ ] Add notification integration for critical changes
- [ ] Score trend sparkline charts
- [ ] Consecutive days tracking

### Phase 3: Advanced Analytics
- [ ] Historical change patterns
- [ ] Predictive alerts (early warning)
- [ ] Team volatility metrics
- [ ] Export/reporting functionality
- [ ] Mobile push notifications

---

## 10. TECHNICAL CONSIDERATIONS

### Performance
- Calculate changes AFTER check-in is submitted (not on-demand)
- Store pre-computed 7-day averages
- Index on `teamId + date` for fast queries
- Consider caching for dashboard views

### Edge Cases
1. **New team member** (< 3 days history): Exclude from change detection
2. **Returning from leave**: Don't compare to pre-leave average
3. **First check-in of week** (Monday): Compare to last week's average
4. **Multiple check-ins same day**: Use latest (shouldn't happen with validation)

### Data Retention
- Keep ReadinessChange records for 90 days
- Archive older records to cold storage
- Aggregate historical data for long-term trends

---

## 11. SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| Detection accuracy | 95% | True positives / Total flags |
| Team Lead engagement | 80% | Changes acknowledged within 4 hours |
| Follow-up rate | 70% | 1-on-1 scheduled for critical drops |
| Early intervention | Increase | Incidents prevented due to early detection |

---

## 12. MOCKUP SUMMARY

### Team Analytics Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TEAM ANALYTICS - Warehouse Team                    Jan 6, 2026  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│ │ Check-in    │ │ Avg Score   │ │ On-time %   │ │ Changes     ││
│ │ Rate        │ │             │ │             │ │ Detected    ││
│ │   8/10      │ │    72       │ │   85%       │ │   ⚠️ 3       ││
│ │   80%       │ │   GREEN     │ │             │ │             ││
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ⚠️ SUDDEN CHANGES                              [View All →] ││
│ │                                                             ││
│ │ 🚨 Juan Santos    -37 pts   GREEN→YELLOW   [View][1-on-1]  ││
│ │ ⚠️ Carlos Garcia  -23 pts   GREEN→YELLOW   [View][1-on-1]  ││
│ │ ✅ Maria Cruz     +28 pts   YELLOW→GREEN   [View][Kudos]   ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ TEAM MEMBERS                                                ││
│ │ [List of all team members with today's status...]          ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. ADDITIONAL FEATURE: Worker Watch List (Flag/Plug System)

### Problem:
Team Leader nakakita ng sudden change, pero after a few days nakalimutan na i-monitor. Walang way to "flag" a worker for continued monitoring.

### Solution: Worker Watch List

Team Leader can **"plug"** or **flag** a worker para ma-monitor continuously until resolved.

---

### 13.1 Watch Types (Flag Categories)

| Flag Type | Icon | Description | Auto-Remove? |
|-----------|------|-------------|--------------|
| **NEEDS_ATTENTION** | 🔴 | Urgent concern, needs immediate follow-up | No |
| **MONITORING** | 🟡 | Under observation, check daily | After 7 days GREEN |
| **RECOVERING** | 🔵 | Coming back from issue, track progress | After 14 days stable |
| **IMPROVING** | 🟢 | Positive trend, encourage | After 7 days |
| **FOLLOW_UP** | 📌 | Scheduled follow-up pending | After action completed |

---

### 13.2 Database Model

```prisma
// Add to schema.prisma

model WorkerWatch {
  id            String      @id @default(uuid())
  companyId     String
  teamId        String
  workerId      String      // The worker being watched
  watchedById   String      // Team Lead who flagged them

  // Watch details
  watchType     WatchType
  reason        String      // Why they were flagged
  notes         String?     // Additional notes
  priority      WatchPriority @default(MEDIUM)

  // Tracking
  scoreAtFlag   Float       // Score when flagged
  statusAtFlag  ReadinessStatus
  targetScore   Float?      // Target score to reach (optional)

  // Status
  isActive      Boolean     @default(true)
  resolvedAt    DateTime?
  resolvedBy    String?
  resolvedNote  String?     // Why it was resolved

  // Auto-check settings
  checkDaily    Boolean     @default(true)
  alertOnChange Boolean     @default(true)  // Alert if score drops further
  reminderDays  Int?        // Remind after X days if not resolved

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  // Relations
  company       Company     @relation(fields: [companyId], references: [id])
  team          Team        @relation(fields: [teamId], references: [id])
  worker        User        @relation("WatchedWorker", fields: [workerId], references: [id])
  watchedBy     User        @relation("Watcher", fields: [watchedById], references: [id])
  activities    WatchActivity[]

  @@index([teamId, isActive])
  @@index([workerId])
  @@index([watchedById])
  @@map("worker_watches")
}

model WatchActivity {
  id          String   @id @default(uuid())
  watchId     String
  userId      String   // Who performed action
  action      WatchAction
  note        String?
  scoreAtTime Float?   // Score at time of activity
  createdAt   DateTime @default(now())

  watch       WorkerWatch @relation(fields: [watchId], references: [id], onDelete: Cascade)

  @@index([watchId])
  @@map("watch_activities")
}

enum WatchType {
  NEEDS_ATTENTION
  MONITORING
  RECOVERING
  IMPROVING
  FOLLOW_UP
}

enum WatchPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum WatchAction {
  CREATED          // Watch started
  NOTE_ADDED       // Added a note
  TYPE_CHANGED     // Changed watch type
  CHECKED_IN       // Manual check-in by TL
  SCORE_IMPROVED   // System detected improvement
  SCORE_DROPPED    // System detected further drop
  ONE_ON_ONE_DONE  // 1-on-1 completed
  RESOLVED         // Watch ended
  EXTENDED         // Watch period extended
}
```

---

### 13.3 API Endpoints

```
# Watch List Management
POST   /api/watches                    - Create new watch
GET    /api/watches/team/:teamId       - Get team's watch list
GET    /api/watches/:id                - Get watch details
PATCH  /api/watches/:id                - Update watch
DELETE /api/watches/:id                - Remove watch (resolve)

# Watch Activities
POST   /api/watches/:id/activities     - Add activity/note
GET    /api/watches/:id/activities     - Get watch history

# Worker's watch status
GET    /api/watches/worker/:userId     - Check if worker is being watched
```

#### Create Watch Request:
```json
POST /api/watches
{
  "workerId": "user-456",
  "watchType": "NEEDS_ATTENTION",
  "reason": "Significant score drop detected",
  "notes": "Score dropped 37 points. Will schedule 1-on-1 tomorrow.",
  "priority": "HIGH",
  "targetScore": 70,
  "alertOnChange": true,
  "reminderDays": 3
}
```

#### Response:
```json
{
  "id": "watch-789",
  "workerId": "user-456",
  "workerName": "Juan Santos",
  "watchType": "NEEDS_ATTENTION",
  "reason": "Significant score drop detected",
  "priority": "HIGH",
  "scoreAtFlag": 45,
  "statusAtFlag": "YELLOW",
  "targetScore": 70,
  "isActive": true,
  "daysSinceFlag": 0,
  "currentScore": 45,
  "progress": -25,  // points away from target
  "createdAt": "2026-01-06T09:00:00Z",
  "watchedBy": {
    "id": "tl-123",
    "name": "Ana Mendoza"
  }
}
```

---

### 13.4 UI Components

#### Watch List Card (Team Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│ 👁️ WATCH LIST                                      [+ Add Watch]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Active Watches: 3                                               │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🔴 NEEDS ATTENTION                           HIGH PRIORITY  ││
│ │                                                             ││
│ │ 👤 Juan Santos                                              ││
│ │    Reason: Significant score drop (-37 points)              ││
│ │    Flagged: 2 days ago by Ana Mendoza                       ││
│ │                                                             ││
│ │    Score at flag: 45 │ Current: 48 │ Target: 70            ││
│ │    Progress: ████░░░░░░ 48/70 (+3 since flag)              ││
│ │                                                             ││
│ │    Last activity: 1-on-1 scheduled for tomorrow             ││
│ │                                                             ││
│ │    [View History] [Add Note] [Mark Resolved]                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🟡 MONITORING                               MEDIUM PRIORITY ││
│ │                                                             ││
│ │ 👤 Carlos Garcia                                            ││
│ │    Reason: Returning from injury leave                      ││
│ │    Flagged: 5 days ago                                      ││
│ │                                                             ││
│ │    Score at flag: 55 │ Current: 68 │ Target: 75            ││
│ │    Progress: █████████░ 68/75 (+13 since flag) ↑           ││
│ │                                                             ││
│ │    [View History] [Add Note] [Mark Resolved]                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🟢 IMPROVING                                  LOW PRIORITY  ││
│ │                                                             ││
│ │ 👤 Maria Cruz                                               ││
│ │    Reason: Showed great improvement, tracking               ││
│ │    Flagged: 3 days ago                                      ││
│ │                                                             ││
│ │    Score at flag: 88 │ Current: 85 │ Maintaining GREEN     ││
│ │    ✅ Stable for 3 days                                     ││
│ │                                                             ││
│ │    [View History] [Send Recognition] [Remove from Watch]    ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Add to Watch Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ 👁️ Add to Watch List                                      [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Worker: Juan Santos                                             │
│ Current Score: 45 (YELLOW)                                      │
│ 7-day Average: 82 (GREEN)                                       │
│                                                                 │
│ ─────────────────────────────────────────────────────────────   │
│                                                                 │
│ Watch Type: [Dropdown]                                          │
│   🔴 Needs Attention - Urgent concern                          │
│   🟡 Monitoring - Check daily                                  │
│   🔵 Recovering - Track progress                               │
│   🟢 Improving - Encourage                                     │
│   📌 Follow-up - Action pending                                │
│                                                                 │
│ Priority: ○ Low  ● Medium  ○ High  ○ Urgent                    │
│                                                                 │
│ Reason: [Text input]                                            │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Significant score drop detected. Need to check in.          ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Target Score (optional): [70]                                   │
│                                                                 │
│ ☑ Alert me if score drops further                              │
│ ☑ Remind me in [3] days if not resolved                        │
│                                                                 │
│ ─────────────────────────────────────────────────────────────   │
│                                                                 │
│                              [Cancel]  [Add to Watch List]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Watch Activity Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Watch History - Juan Santos                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Current Status: 🔴 NEEDS ATTENTION (Day 3)                      │
│ Progress: 45 → 52 (+7 points)                                   │
│                                                                 │
│ ─────────────────────────────────────────────────────────────   │
│                                                                 │
│ 📅 Jan 8, 2026 (Today)                                          │
│ │                                                               │
│ ├─ 08:15 AM - Score Update                                     │
│ │  Check-in score: 52 (YELLOW) ↑ +4 from yesterday             │
│ │                                                               │
│ ├─ 09:00 AM - Note Added by Ana Mendoza                        │
│ │  "Juan seems better today. Will continue monitoring."        │
│ │                                                               │
│ │                                                               │
│ 📅 Jan 7, 2026                                                  │
│ │                                                               │
│ ├─ 08:30 AM - Score Update                                     │
│ │  Check-in score: 48 (YELLOW) ↑ +3 from flag                  │
│ │                                                               │
│ ├─ 02:00 PM - 1-on-1 Completed                                 │
│ │  By: Ana Mendoza                                              │
│ │  "Discussed family situation. Offered flexible schedule."    │
│ │                                                               │
│ │                                                               │
│ 📅 Jan 6, 2026                                                  │
│ │                                                               │
│ ├─ 09:00 AM - Watch Created                                    │
│ │  By: Ana Mendoza                                              │
│ │  Type: NEEDS_ATTENTION (High Priority)                        │
│ │  Reason: "Significant score drop detected (-37 points)"      │
│ │  Score at flag: 45 (YELLOW)                                   │
│ │                                                               │
│ ├─ 09:05 AM - 1-on-1 Scheduled                                 │
│ │  Scheduled for: Jan 7, 2026 2:00 PM                          │
│ │                                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 13.5 REAL-LIFE SCENARIOS

---

#### SCENARIO A: Team Leader Flags Worker After Sudden Drop

**Characters:**
- **Ana Mendoza** - Team Leader
- **Juan Santos** - Worker with sudden score drop

**Timeline:**

```
=== JANUARY 6, 2026 (Monday) ===

08:15 AM - Juan checks in with score 45 (YELLOW)
           His 7-day average is 82 (GREEN)
           System detects: CRITICAL DROP (-37 points)

09:00 AM - Ana opens Team Analytics
           Sees Juan in "Sudden Changes" list

           Ana thinks: "Juan is usually one of my best performers.
                       Something must be wrong. I need to track this."

09:02 AM - Ana clicks [Add to Watch] on Juan's card

           ADD TO WATCH MODAL:
           ┌─────────────────────────────────────────┐
           │ Worker: Juan Santos                     │
           │ Current: 45 (YELLOW) | Avg: 82 (GREEN) │
           │                                         │
           │ Watch Type: 🔴 Needs Attention          │
           │ Priority: ● High                        │
           │                                         │
           │ Reason:                                 │
           │ "Significant drop. Usually GREEN.       │
           │  Check-in notes say family problem."    │
           │                                         │
           │ Target Score: 70                        │
           │ ☑ Alert on further drop                 │
           │ ☑ Remind in 3 days                      │
           │                                         │
           │            [Cancel] [Add to Watch]      │
           └─────────────────────────────────────────┘

09:03 AM - Ana submits → Watch created

           SYSTEM ACTIONS:
           ┌─────────────────────────────────────────┐
           │ WorkerWatch created:                    │
           │ - Worker: Juan Santos                   │
           │ - Type: NEEDS_ATTENTION                 │
           │ - Priority: HIGH                        │
           │ - Score at flag: 45                     │
           │ - Target: 70                            │
           │ - Alert on change: true                 │
           │ - Reminder: 3 days                      │
           └─────────────────────────────────────────┘

           → WatchActivity: "Watch created by Ana Mendoza"
           → SystemLog: "Ana Mendoza added Juan Santos to watch list"

09:10 AM - Ana schedules 1-on-1 for tomorrow
           → WatchActivity: "1-on-1 scheduled for Jan 7, 2:00 PM"

=== JANUARY 7, 2026 (Tuesday) ===

08:20 AM - Juan checks in with score 48 (YELLOW)
           Slight improvement (+3 from yesterday)

           SYSTEM DETECTS:
           → Juan is on watch list
           → Score improved slightly
           → Still below target (48 < 70)

           SYSTEM ACTIONS:
           → WatchActivity: "Score update: 48 (+3 from flag)"
           → No alert (score improved, not dropped)

02:00 PM - Ana has 1-on-1 with Juan
           Finds out: Family emergency, sick parent

02:30 PM - Ana adds note to watch:
           "1-on-1 done. Family issue with sick parent.
            Offered flexible hours. Juan appreciated support."

           → WatchActivity: "1-on-1 completed. Note added."

=== JANUARY 8, 2026 (Wednesday) ===

08:15 AM - Juan checks in with score 52 (YELLOW)
           → WatchActivity: "Score update: 52 (+7 from flag)"

=== JANUARY 9, 2026 (Thursday) ===

08:10 AM - Juan checks in with score 65 (YELLOW)
           Getting closer to target!
           → WatchActivity: "Score update: 65 (+20 from flag)"

           Ana sees progress bar:
           Progress: ████████░░ 65/70 (+20 since flag)

09:00 AM - Ana gets notification:
           "Juan Santos is making good progress! Score up 20 points
            since flagged. Current: 65, Target: 70"

=== JANUARY 10, 2026 (Friday) ===

08:05 AM - Juan checks in with score 72 (GREEN) ✅
           Target reached! Back to GREEN!

           SYSTEM DETECTS:
           → Target score reached (72 >= 70)
           → Status back to GREEN
           → Consecutive improvement

           SYSTEM SUGGESTS:
           → "Juan Santos has reached target score and is back to GREEN.
              Consider resolving watch."

09:00 AM - Ana reviews watch, sees great progress

09:05 AM - Ana resolves watch:
           ┌─────────────────────────────────────────┐
           │ Resolve Watch - Juan Santos             │
           │                                         │
           │ Final Score: 72 (GREEN) ✅              │
           │ Score at Flag: 45                       │
           │ Improvement: +27 points                 │
           │                                         │
           │ Resolution Note:                        │
           │ "Family situation improving. Juan back  │
           │  to normal. Great recovery!"            │
           │                                         │
           │ ☑ Send recognition for improvement     │
           │                                         │
           │         [Cancel] [Resolve Watch]        │
           └─────────────────────────────────────────┘

           SYSTEM ACTIONS:
           → Watch marked as resolved
           → WatchActivity: "Watch resolved by Ana Mendoza"
           → Recognition sent: "Great job bouncing back, Juan! 🎉"
           → SystemLog: "Watch for Juan Santos resolved. +27 point improvement."
```

**Final Watch Summary:**
```
┌─────────────────────────────────────────────────────────────────┐
│ RESOLVED WATCH - Juan Santos                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Duration: 5 days (Jan 6-10, 2026)                               │
│ Type: NEEDS_ATTENTION → RESOLVED                                │
│                                                                 │
│ Score Journey:                                                  │
│ Day 1: 45 (YELLOW) - Flagged                                   │
│ Day 2: 48 (YELLOW) - +3                                        │
│ Day 3: 52 (YELLOW) - +7                                        │
│ Day 4: 65 (YELLOW) - +20                                       │
│ Day 5: 72 (GREEN)  - +27 ✅ Target reached!                    │
│                                                                 │
│ Timeline:                                                       │
│ • Watch created with 1-on-1 scheduled                          │
│ • 1-on-1 completed, identified family issue                    │
│ • Offered flexible schedule support                             │
│ • Steady improvement over 5 days                                │
│ • Back to GREEN, watch resolved                                 │
│                                                                 │
│ Outcome: SUCCESSFUL INTERVENTION                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### SCENARIO B: Monitoring Worker Returning from Injury Leave

**Characters:**
- **Ana Mendoza** - Team Leader
- **Carlos Garcia** - Worker returning from back injury

**Timeline:**

```
=== JANUARY 13, 2026 (Monday) - Carlos Returns ===

08:02 AM - Carlos checks in after 5-day injury leave
           Score: 60 (YELLOW)
           System flags: "Returning from leave"

09:00 AM - Ana sees Carlos returned
           Thinks: "Carlos was injured. I should monitor
                   his recovery for the next 2 weeks."

09:05 AM - Ana adds Carlos to watch:
           ┌─────────────────────────────────────────┐
           │ Watch Type: 🔵 RECOVERING               │
           │ Priority: Medium                        │
           │                                         │
           │ Reason: "Returning from back injury.    │
           │         Monitor for 2 weeks to ensure   │
           │         proper recovery."               │
           │                                         │
           │ Target Score: 75                        │
           │ ☑ Alert on drop (might indicate pain)  │
           │ ☐ Reminder (will check daily)          │
           └─────────────────────────────────────────┘

=== JANUARY 14-17, 2026 - Monitoring Period ===

Carlos's daily scores:
• Jan 14: 62 (+2)
• Jan 15: 58 (-4) ⚠️ Slight dip
• Jan 16: 65 (+7)
• Jan 17: 68 (+10)

Jan 15 - Alert triggered:
         "Carlos Garcia's score dropped. Current: 58.
          Watch type: RECOVERING from injury."

         Ana adds note: "Checked in with Carlos.
         Said back was a bit sore. Taking it easy today."

=== JANUARY 20-24, 2026 - Continued Progress ===

Carlos's scores:
• Jan 20: 72 (GREEN!)
• Jan 21: 75 (target reached!)
• Jan 22: 78
• Jan 23: 80
• Jan 24: 82

=== JANUARY 27, 2026 - 2 Weeks Complete ===

Ana reviews watch:
- Carlos stable at GREEN for 7 consecutive days
- Score consistently above target
- No complaints about back pain

Ana resolves watch:
"Full recovery confirmed. Carlos back to pre-injury levels.
 Great job recovering!"

SYSTEM:
→ Watch resolved (14 days, RECOVERING → RESOLVED)
→ Recovery outcome: SUCCESSFUL
```

---

#### SCENARIO C: Tracking an Improving Worker

**Characters:**
- **Mark Reyes** - Team Leader
- **Lisa Tan** - Worker who showed sudden improvement

**Timeline:**

```
=== JANUARY 6, 2026 ===

Lisa's check-in: 88 (GREEN)
Her 7-day average was: 55 (YELLOW)
System detects: SIGNIFICANT IMPROVEMENT (+33 points)

Mark sees this in "Sudden Changes" list:
┌─────────────────────────────────────────────────┐
│ ✅ Lisa Tan           IMPROVEMENT               │
│    Today: 88 (GREEN) | 7-day avg: 55 (YELLOW)  │
│    Change: +33 points | ↑ Significant!          │
└─────────────────────────────────────────────────┘

Mark thinks: "Wow, Lisa really turned things around!
             I want to track this and make sure it continues."

Mark adds Lisa to watch:
┌─────────────────────────────────────────────────┐
│ Watch Type: 🟢 IMPROVING                        │
│ Priority: Low                                   │
│                                                 │
│ Reason: "Great improvement! Want to ensure     │
│         this positive trend continues and      │
│         recognize her efforts."                │
│                                                 │
│ Target Score: Maintain 75+                      │
│ ☐ Alert on drop                                │
│ ☑ Remind in 7 days to send recognition        │
└─────────────────────────────────────────────────┘

=== JANUARY 13, 2026 - 7 Day Reminder ===

Mark gets reminder:
"Lisa Tan has been on IMPROVING watch for 7 days.
 She has maintained GREEN status consistently.
 Consider sending recognition!"

Lisa's 7-day stats:
• Average score: 85
• All 7 days GREEN
• No drops detected

Mark sends recognition:
"Amazing turnaround, Lisa! You've maintained excellent
 wellness scores for a full week. Keep it up! 🌟"

Mark resolves watch:
"Positive trend confirmed. Lisa is thriving!"
```

---

#### SCENARIO D: Watch Escalation (Score Keeps Dropping)

**Characters:**
- **Ana Mendoza** - Team Leader
- **Pedro Reyes** - Worker with continuing decline

**Timeline:**

```
=== JANUARY 6, 2026 ===

Pedro flagged: MONITORING (Score: 55, dropped from 72)

=== JANUARY 7, 2026 ===

Pedro checks in: 52 (-3)
→ WatchActivity: "Score dropped to 52"

Ana notes: "Spoke with Pedro. Says he's fine."

=== JANUARY 8, 2026 ===

Pedro checks in: 48 (-7 from flag)
→ Alert: "Pedro continues to decline!"

Ana escalates watch type:
MONITORING → NEEDS_ATTENTION
Priority: Medium → High

Adds note: "Declining further. Will have serious 1-on-1."

=== JANUARY 9, 2026 ===

Pedro checks in: 42 (YELLOW, -13 from flag)
Still declining!

Ana schedules formal meeting with HR present.
Updates watch: Priority → URGENT

=== JANUARY 10, 2026 ===

Meeting held with Pedro and HR.
Discovers: Pedro is experiencing workplace bullying
           from another team member.

Actions taken:
1. HR opens investigation
2. Pedro moved to different shift temporarily
3. Support resources provided

Watch updated:
Type: NEEDS_ATTENTION → RECOVERING
Note: "Issue identified. Support being provided."

=== JANUARY 13-17, 2026 ===

With issue addressed, Pedro's scores:
• Jan 13: 50
• Jan 14: 58
• Jan 15: 65
• Jan 16: 72
• Jan 17: 78 (GREEN!)

Watch resolved:
"Issue was workplace bullying. After investigation and
 support, Pedro has fully recovered. Important lesson
 in the value of monitoring and follow-up."
```

---

### 13.6 Auto-Actions & Integrations

#### Auto-Flag Triggers (Optional)
```typescript
// System can auto-add to watch list when:
const AUTO_FLAG_TRIGGERS = {
  // Critical drop auto-flags as NEEDS_ATTENTION
  CRITICAL_DROP: {
    condition: 'score drops >= 30 points',
    watchType: 'NEEDS_ATTENTION',
    priority: 'HIGH',
    reason: 'Auto-flagged: Critical score drop detected',
  },

  // Returning from injury auto-flags as RECOVERING
  RETURNING_FROM_INJURY: {
    condition: 'first check-in after injury-related leave',
    watchType: 'RECOVERING',
    priority: 'MEDIUM',
    reason: 'Auto-flagged: Returning from injury leave',
  },

  // 3 consecutive declining days
  SUSTAINED_DECLINE: {
    condition: 'score declined for 3+ consecutive days',
    watchType: 'MONITORING',
    priority: 'MEDIUM',
    reason: 'Auto-flagged: 3 consecutive days of declining scores',
  },
};
```

#### Integration with Existing Features

| Feature | Integration |
|---------|-------------|
| **1-on-1 Meetings** | Schedule directly from watch card |
| **Recognition** | Send kudos when resolving IMPROVING watch |
| **Incidents** | Link watch to related incident |
| **AI Summary** | Include watch list status in team summary |
| **System Logs** | All watch actions logged |
| **Notifications** | Alerts for drops, reminders for follow-up |

---

### 13.7 Implementation Phases

#### Phase 1: Basic Watch List (MVP)
- [ ] Create WorkerWatch and WatchActivity models
- [ ] API: Create, Read, Update, Delete watches
- [ ] UI: Watch list card on Team Analytics
- [ ] UI: Add to watch modal
- [ ] Basic activity logging

#### Phase 2: Enhanced Features
- [ ] Watch activity timeline view
- [ ] Score progress tracking
- [ ] Reminder system
- [ ] Alert on further drops
- [ ] Integration with 1-on-1 scheduling

#### Phase 3: Automation
- [ ] Auto-flag triggers
- [ ] Auto-resolve suggestions
- [ ] AI recommendations for watch actions
- [ ] Analytics on watch outcomes

---

### 13.8 Success Metrics

| Metric | Target |
|--------|--------|
| Workers flagged and recovered | 80% improvement |
| Average time on watch | < 14 days |
| Follow-up actions taken | 90% of watches |
| Early issue detection | Increase in early interventions |
| Team Lead engagement | Active use by 80% of Team Leads |

---

*End of Watch List Feature Specification*

---

*Feature specification created for Aegira Personnel Readiness Management System*
*Ready for implementation review*
