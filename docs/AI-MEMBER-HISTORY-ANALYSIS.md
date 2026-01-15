# AI Expert Data Interpretation Feature

## Overview

Update "Generate Summary" in AI Chat (`/team/ai-chat`) to:
1. Read **same data** as Member History page (`/team/member-history`)
2. Output **Expert Data Interpretation** narrative style

---

## Data Source

### API Endpoint (Same as Member History page)
```
GET /checkins
```

### Parameters
```typescript
{
  teamId: string;        // From /teams/my
  startDate: string;     // Based on selected period (7/14/30 days)
  endDate: string;       // Today
}
```

### Data Fields (Same as Member History)
```typescript
{
  id: string;
  readinessStatus: 'GREEN' | 'YELLOW' | 'RED';
  readinessScore: number;        // 0-100
  mood: number;                  // 1-10
  stress: number;                // 1-10
  sleep: number;                 // 1-10
  physicalHealth: number;        // 1-10
  notes?: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}
```

---

## User Flow (Same as Current)

```
1. Go to /team/ai-chat
2. Click "Generate Summary"
3. PeriodModal appears → Select 7/14/30 days
4. Click "Generate Report"
5. AI fetches check-in data from /checkins
6. AI generates Expert Data Interpretation Summary
```

---

## Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Expert Data Interpretation Summary (Team-Level)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: January 8-15, 2026
Team: Alpha Team (8 members)
Records Analyzed: 45 check-ins
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on the recorded assessments, the team demonstrates generally
favorable well-being and readiness indicators, with most observations
falling within the higher performance range. The data suggests that
the team is, on average, operating under acceptable to optimal
conditions, with only intermittent declines.

───────────────────────────────────────────────────────
✅ Positive Findings
───────────────────────────────────────────────────────

The majority of records show adequate sleep duration, manageable
stress levels, and stable physical condition, which collectively
correspond to higher overall scores.

High readiness periods are characterized by balanced profiles,
where no single metric is critically low.

Physical condition remains relatively stable across observations,
indicating that physical strain or injury is not a dominant issue
within the team.

───────────────────────────────────────────────────────
⚠️ Negative Findings
───────────────────────────────────────────────────────

Periodic declines in overall readiness are primarily associated
with acute fatigue, reflected by low sleep scores.

Episodes of elevated stress coincide with reduced overall
performance indicators, especially when combined with poor sleep.

The lowest recorded outcomes occur when multiple domains deteriorate
simultaneously, suggesting vulnerability during periods of compounded
strain rather than isolated issues.

───────────────────────────────────────────────────────
📋 Overall Summary
───────────────────────────────────────────────────────

The dataset reflects a team that is predominantly stable and
well-functioning, with readiness fluctuations driven by short-term
factors rather than persistent deficiencies. Declines appear to be
episodic and recoverable, indicating resilience within the group.

From an expert perspective, the data suggests that maintaining
consistent sleep and managing stress are the most critical factors
for sustaining optimal team performance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: January 15, 2026 at 11:30 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Backend Changes

### File: `backend/src/modules/chatbot/index.ts`

### 1. Update `generate_summary` handler to fetch from /checkins

```typescript
// In generate_summary handler:

// Fetch check-ins (SAME data as Member History page)
const checkins = await prisma.checkin.findMany({
  where: {
    user: { teamId },
    createdAt: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    },
  },
  include: {
    user: { select: { id: true, firstName: true, lastName: true } },
  },
  orderBy: { createdAt: 'desc' },
});
```

### 2. Aggregate data before sending to AI

```typescript
function aggregateCheckinData(checkins) {
  const total = checkins.length;

  // Status distribution
  const statusCounts = {
    GREEN: checkins.filter(c => c.readinessStatus === 'GREEN').length,
    YELLOW: checkins.filter(c => c.readinessStatus === 'YELLOW').length,
    RED: checkins.filter(c => c.readinessStatus === 'RED').length,
  };

  // Averages
  const avgScore = checkins.reduce((sum, c) => sum + c.readinessScore, 0) / total;
  const avgMood = checkins.reduce((sum, c) => sum + c.mood, 0) / total;
  const avgStress = checkins.reduce((sum, c) => sum + c.stress, 0) / total;
  const avgSleep = checkins.reduce((sum, c) => sum + c.sleep, 0) / total;
  const avgPhysical = checkins.reduce((sum, c) => sum + c.physicalHealth, 0) / total;

  // Per-member breakdown
  const memberMap = new Map();
  checkins.forEach(c => {
    const key = c.user.id;
    if (!memberMap.has(key)) {
      memberMap.set(key, { name: `${c.user.firstName} ${c.user.lastName}`, scores: [], statuses: [] });
    }
    memberMap.get(key).scores.push(c.readinessScore);
    memberMap.get(key).statuses.push(c.readinessStatus);
  });

  return {
    totalCheckins: total,
    memberCount: memberMap.size,
    statusDistribution: statusCounts,
    averages: { score: avgScore, mood: avgMood, stress: avgStress, sleep: avgSleep, physical: avgPhysical },
    memberStats: Array.from(memberMap.values()),
  };
}
```

### 3. Update AI prompt for narrative style

```typescript
const prompt = `
You are an Expert Data Analyst specializing in workplace wellness.
Analyze this team check-in data and provide a professional narrative interpretation.

PERIOD: ${startDate} to ${endDate}
TOTAL CHECK-INS: ${summary.totalCheckins}
MEMBERS: ${summary.memberCount}

DATA:
- Average Score: ${summary.averages.score.toFixed(0)}%
- Status Distribution: GREEN ${summary.statusDistribution.GREEN}, YELLOW ${summary.statusDistribution.YELLOW}, RED ${summary.statusDistribution.RED}
- Avg Mood: ${summary.averages.mood.toFixed(1)}/10
- Avg Stress: ${summary.averages.stress.toFixed(1)}/10
- Avg Sleep: ${summary.averages.sleep.toFixed(1)}/10
- Avg Physical: ${summary.averages.physical.toFixed(1)}/10

MEMBER BREAKDOWN:
${summary.memberStats.map(m => `- ${m.name}: avg ${(m.scores.reduce((a,b)=>a+b,0)/m.scores.length).toFixed(0)}%, ${m.scores.length} check-ins, ${m.statuses.filter(s=>s==='RED').length} RED`).join('\n')}

Write a formal expert interpretation with these sections:
1. Opening paragraph - overall assessment
2. ✅ Positive Findings - what's working well (narrative paragraphs, NOT bullets)
3. ⚠️ Negative Findings - areas of concern (narrative paragraphs, NOT bullets)
4. 📋 Overall Summary - expert conclusion

Be professional. Focus on patterns and insights, not just numbers.
`;
```

---

## Frontend Changes

### File: `frontend/src/pages/team-leader/ai-chat.page.tsx`

**No changes needed** - existing PeriodModal already handles date selection.

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| PeriodModal | No change (reuse existing) |
| Data source | Change to `/checkins` endpoint |
| AI prompt | Update to narrative style |
| Output format | Expert Data Interpretation |

---

## Data Guarantee

```
PeriodModal selects: 7 days
        ↓
Fetches: GET /checkins?teamId=xxx&startDate=Jan8&endDate=Jan15
        ↓
Same data as: Member History page with 7-day filter
        ↓
AI interprets → Expert narrative output
```

**Same endpoint + Same filters = Same data as Member History**
