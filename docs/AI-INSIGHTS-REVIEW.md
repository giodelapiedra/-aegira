# AI Insights Review & Improvement Suggestions

---

## New Approach: Team-Level Predictive Summaries

> **SCOPE: Team Lead Only**
> This feature is currently designed for Team Leads only.
> Supervisor and Executive views may be added in the future.

### Key Principles
1. **No Individual Names** - Report on team-level patterns only, not specific members
2. **Based on DailyTeamSummary** - Single source of truth for accurate data
3. **Prediction-Focused** - Use patterns to predict future trends
4. **Word-Based Narrative** - Human-readable summaries, not data tables
5. **Team Lead Scope** - Each Team Lead sees only their own team's data

### Data Source: DailyTeamSummary
```typescript
// Query from DailyTeamSummary table (already accounts for holidays, exemptions, etc.)
const summaries = await prisma.dailyTeamSummary.findMany({
  where: {
    teamId: teamLead.teamId,
    date: { gte: startDate, lte: endDate }
  }
});

// This gives us pre-calculated daily metrics:
// - totalMembers, checkedInCount, missedCount
// - greenCount, yellowCount, redCount
// - avgMood, avgStress, avgSleep, avgPhysicalHealth
// - onLeaveCount, exemptionCount
```

### Why This Approach Works
- **Accurate**: DailyTeamSummary already handles holidays, exemptions, absences
- **Scalable**: Team-level aggregates, not individual analysis
- **Privacy-Respecting**: No specific names in reports
- **Actionable**: Predictions help Team Leads plan ahead

---

## Report Format Examples

### Example 1: Weekly Team Health Summary
```
TEAM HEALTH SUMMARY - Week of Jan 8-14, 2025

Overall Readiness: 78% (Up from 72% last week)

This week your team showed improved wellness patterns. Check-in compliance
reached 94%, with most of your team consistently reporting on time.

Current Status Breakdown:
- Healthy (GREEN): 8 members
- Caution (YELLOW): 3 members
- Attention (RED): 1 member

Observations:
Your team's average stress level decreased from 5.2 to 4.1 this week,
suggesting recent workload adjustments are having a positive effect.
Sleep quality remains stable at an average of 6.8.

Active Exemptions: 2 members currently on approved leave
Open Incidents: 1 incident pending review
```

### Example 2: Predictive Analysis
```
TREND ANALYSIS & PREDICTIONS

Pattern Detected: Rising Stress
Over the past 3 weeks, your team's average stress has increased:
- Week 1: 3.8 average
- Week 2: 4.5 average
- Week 3: 5.2 average

Prediction: If this pattern continues, there is a 65% likelihood of:
- 2-3 additional exemption requests in the next 2 weeks
- Increased RED status occurrences
- Potential check-in compliance drop

Pattern Detected: Sleep Quality Decline
4 members have shown declining sleep scores for 5+ consecutive days.

Prediction: Without intervention, this may lead to:
- Reduced productivity
- Higher absenteeism risk
- Potential safety concerns for physical roles

Recommended Team-Level Actions:
1. Consider team workload review
2. Discuss flexible scheduling options in next team meeting
3. Share sleep wellness resources with the team
```

### Example 3: Compliance & Risk Summary
```
WHS COMPLIANCE SNAPSHOT

Psychosocial Risk Indicators:
- High job demands: 3 members showing sustained high stress (7+)
- Low recovery: Team average sleep below 6 for 4 consecutive days

Exemption Trends:
- This month: 5 exemption requests (3 approved, 1 pending, 1 rejected)
- Last month: 3 exemption requests
- Trend: 67% increase - may indicate emerging team stress

Incident Summary:
- Open incidents: 1 (Mental Health category)
- Resolved this month: 2
- Average resolution time: 4.2 days

Compliance Status: CAUTION
Your team shows early signs of psychosocial strain. Per Safe Work Australia
guidelines, consider proactive consultation with affected team members.
```

### Example 4: Continuous Pattern Reporting
```
PATTERN CONTINUATION REPORT

Week 1 (Jan 1-7):
"Your team's wellness is stable. 85% GREEN status, low stress levels."

Week 2 (Jan 8-14):
"Slight uptick in stress noted. 2 members moved from GREEN to YELLOW.
Monitor for continuation."

Week 3 (Jan 15-21):
"Stress pattern continuing. 4 members now in YELLOW status.
Sleep averages dropping. Early intervention recommended."

Week 4 (Jan 22-28):
"ALERT: Pattern has persisted for 3 weeks. Without action:
- Predicted: 2 members may reach RED status within 7 days
- Predicted: 1-2 exemption requests likely
- Recommended: Schedule team wellness check-in"

Week 5 (Jan 29-Feb 4):
"Team wellness stabilizing after intervention. 3 members returned
to GREEN status. Stress average down 15%. Continue monitoring."
```

---

## AI Prompt Design for Team-Level Reports

### System Prompt
```
You are a workplace wellness analyst providing team-level insights.

CRITICAL RULES:
1. NEVER mention specific employee names
2. Only refer to members by count (e.g., "3 members", "several team members")
3. Focus on team patterns and aggregates
4. Provide predictions based on trends
5. Suggest team-wide actions, not individual interventions
6. Reference Australian WHS guidelines when applicable

DATA CONTEXT:
- All data comes from DailyTeamSummary (pre-validated, accounts for exemptions)
- Team Lead can only see their own team's data
- Dates are in company timezone (Australia/Sydney default)
```

### Data Payload to AI
```typescript
// What we send to OpenAI (no individual names)
const aiPayload = {
  teamSize: 12,
  period: "Jan 8-14, 2025",

  dailyMetrics: [
    { date: "2025-01-08", checkedIn: 11, greenCount: 8, yellowCount: 2, redCount: 1, avgStress: 4.2 },
    { date: "2025-01-09", checkedIn: 10, greenCount: 7, yellowCount: 2, redCount: 1, avgStress: 4.5 },
    // ... etc
  ],

  weeklyTrend: {
    currentWeek: { avgStress: 4.8, avgSleep: 6.5, complianceRate: 92 },
    previousWeek: { avgStress: 4.2, avgSleep: 6.8, complianceRate: 88 },
    change: { stress: +14%, sleep: -4%, compliance: +4% }
  },

  exemptionCounts: { pending: 1, approved: 2, thisMonth: 5, lastMonth: 3 },
  incidentCounts: { open: 1, resolvedThisMonth: 2 },

  patterns: {
    stressTrending: "up",
    sleepTrending: "down",
    consecutiveHighStressDays: 4,
    membersWithDecliningScores: 3  // count only, no names
  }
};
```

---

## TODO - Gagawin Natin

### High Priority (Immediate)
- [ ] Refactor AI prompt to use team-level data only (no names)
- [ ] Create aggregation queries from DailyTeamSummary
- [ ] Add trend calculation (week-over-week changes)
- [ ] Add prediction logic based on patterns
- [ ] Add data freshness warning sa UI (if report >7 days old)

### Medium Priority (Next Sprint)
- [ ] Add Australian WHS context sa AI prompt
- [ ] Add pattern continuation tracking (multi-week trends)
- [ ] Add intervention templates (team-level only)
- [ ] Add action tracking (mark recommendations as "Done")

### Low Priority (Future)
- [ ] Add ROI calculations for team interventions
- [ ] Auto-generate weekly reports
- [ ] Add comparison with live data on old reports
- [ ] Add benchmarking against company averages

---

## Task Details

### 1. Team-Level Burnout Risk Detection
**File:** `backend/src/utils/ai.ts` & `backend/src/modules/analytics/index.ts`

Logic (team aggregates only):
```
IF (team avgStress >= 7 AND avgSleep <= 5) for 3+ days → TEAM HIGH RISK
IF (redCount >= 3 in last 7 days) → ESCALATION ALERT
IF (team mood declining for 2+ weeks) → EARLY WARNING
```

Add to AI prompt (no names, counts only):
```
TEAM BURNOUT RISK INDICATORS:
- X members showing high stress (7+) for 3+ consecutive days
- Team sleep average below threshold for X days
- Recommendation: Team-wide workload review needed
```

### 2. Data Freshness Warning
**File:** `frontend/src/pages/team-leader/ai-insights-detail.page.tsx`

Show warning banner if:
- Report created >7 days ago
- "This report is X days old. Data may have changed."
- Add "Generate New Report" button

### 3. Australian WHS Context
**File:** `backend/src/utils/ai.ts`

Add to system prompt:
```
AUSTRALIAN WHS COMPLIANCE:
- Reference Safe Work Australia Code of Practice for Managing Psychosocial Hazards
- Flag psychosocial risks: high job demands, low job control, poor support
- Suggest reasonable adjustments under Disability Discrimination Act
- Recommend EAP referrals when clinical thresholds met
- Consider duty of care obligations under model WHS laws
```

### 4. Data Quality Validation
**File:** `backend/src/modules/analytics/index.ts`

Before AI call, calculate:
```typescript
const dataQuality = {
  avgCheckinsPerMember: totalCheckins / totalMembers,
  membersWithZeroCheckins: memberAnalytics.filter(m => m.checkinCount === 0).length,
  confidenceScore: // 0-100 based on data completeness
};

// Add warning to AI prompt if low confidence
if (dataQuality.avgCheckinsPerMember < 3) {
  prompt += "\nWARNING: Limited data (avg <3 check-ins per member). Insights may be less reliable.";
}
```

---

## Current Implementation

### Data Flow
1. User requests AI summary for their team
2. Backend fetches team analytics for specified period (default: 30 days)
3. Data includes:
   - Member analytics (avg score, check-in rate, risk level, streaks)
   - Status distribution (GREEN/YELLOW/RED)
   - Open incidents & pending exceptions
   - Top reasons for low scores
   - Team grade & health score
   - Period comparison (current vs previous)
4. Data is sent to OpenAI GPT-4o-mini with structured prompt
5. AI generates summary, highlights, concerns, recommendations
6. Response stored in database for future reference

### Files Involved
- `backend/src/modules/analytics/index.ts` - API endpoints
- `backend/src/utils/ai.ts` - OpenAI prompt generation
- `frontend/src/pages/team-leader/ai-insights-detail.page.tsx` - Display

---

## Potential Data Issues

### 1. Stale Report Data
- Reports are snapshots at generation time
- If viewing old report, data may not reflect current state
- **Fix**: Show warning if report is >7 days old

### 2. Period Mismatch
- Default period is 30 days but can be customized
- Make sure displayed period matches analyzed period
- **Fix**: Always show analysis date range prominently

### 3. Work Days Calculation
- Exemptions and holidays affect expected work days
- Make sure calculations match Team Analytics page
- **Status**: Already using DailyTeamSummary for consistency

---

## Suggestions for Better AI Insights (Team-Level Only)

### 1. Add Team Trend Analysis
Enhance period comparison with team aggregates:
- Week-over-week team averages (stress, sleep, mood)
- Declining pattern detection (3+ consecutive weeks of decline)
- Team-level early warning indicators

```typescript
// Example enhancement (team-level only)
const trendAnalysis = {
  membersWithDecliningTrendCount: 4,  // count only, no names
  membersImprovingCount: 6,
  weeklyTrendData: [
    { week: 1, avgStress: 3.8, avgSleep: 7.1 },
    { week: 2, avgStress: 4.5, avgSleep: 6.8 },
    { week: 3, avgStress: 5.2, avgSleep: 6.3 },
  ]
};
```

### 2. Add Team Burnout Risk Indicators
Aggregate-based burnout detection:
- Count of members with high stress (7+) + poor sleep (<5) for 3+ days
- Team mood trend direction
- Exemption request frequency trends

```typescript
// Add to AI prompt (counts only)
TEAM BURNOUT RISK INDICATORS:
- ${highRiskCount} members showing burnout warning signs
- Team stress trending ${stressTrend} over past 3 weeks
- Exemption requests ${exemptionTrend}% vs last month
```

### 3. Add Australian WHS Compliance Context
Since target market is Australian companies:
- Reference Safe Work Australia guidelines
- Include psychosocial hazard assessment at team level
- Suggest WHS-compliant team interventions

```typescript
// Add to system prompt
AUSTRALIAN WHS CONTEXT:
- Consider Safe Work Australia Code of Practice for psychological safety
- Flag team-level psychosocial hazards (high demands, low control)
- Suggest interventions aligned with model WHS regulations
- Reference duty of care obligations
```

### 4. Add Team Pattern Analysis
- Check-in compliance rate trends
- Correlation between team workload periods and wellness dips
- Day-of-week patterns (e.g., Mondays have higher stress)

### 5. Add Team-Level Intervention Templates
Team-wide actions (no individual targeting):
- Team briefing templates for addressing collective issues
- Team meeting agenda suggestions
- Resource sharing recommendations (wellness guides, EAP info)

### 6. Add ROI Context
Help managers justify wellness investments:
- Team absenteeism costs (aggregate)
- Potential savings from early intervention
- Industry benchmarks for comparison

### 7. Add Root Cause Analysis
When team-wide patterns emerge (e.g., "Low Sleep Average"):
- Suggest team interventions
- Consider systemic causes (shift schedules, workload distribution)
- Recommend policy reviews

---

## Data Quality Improvements

### 1. Validate Data Before AI Analysis
```typescript
// Check data completeness from DailyTeamSummary
const summaries = await prisma.dailyTeamSummary.findMany({ where: { teamId, date: { gte, lte } } });

const dataQuality = {
  daysWithData: summaries.length,
  avgComplianceRate: summaries.reduce((sum, s) => sum + (s.checkedInCount / s.totalMembers), 0) / summaries.length * 100,
  dataConfidenceScore: calculateConfidence(summaries)
};

// Add to AI prompt if data is sparse
if (dataQuality.avgComplianceRate < 50) {
  prompt += "\nNOTE: Low check-in compliance. Team insights may be less reliable.";
}
```

### 2. Include Historical Context
- How does this period compare to team's historical average?
- Is the team new (less baseline data)?
- Any significant events during period (holidays, restructuring)?

### 3. Team Composition Awareness
- New teams (<30 days) should be flagged differently
- Teams with high turnover may need different interpretation

---

## UI/UX Improvements

### 1. Data Freshness Indicator
Show when the report was generated and if data is stale:
```tsx
{summary.createdAt && (
  <div className="text-sm text-gray-500">
    Generated: {formatRelativeTime(summary.createdAt)}
    {isOlderThanWeek(summary.createdAt) && (
      <span className="text-amber-600 ml-2">
        (Data may be outdated - consider generating new report)
      </span>
    )}
  </div>
)}
```

### 2. Comparison with Live Data
- Show quick comparison: "At report time vs Now"
- Highlight significant changes since report

### 3. Action Tracking
- Allow marking recommendations as "Done"
- Track which interventions were implemented
- Link to follow-up reports

---

## Priority Implementation Order

| Priority | Enhancement | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | Data freshness warning | Low | High |
| 2 | Burnout risk prediction | Medium | High |
| 3 | Australian WHS context | Low | Medium |
| 4 | Trend analysis | Medium | High |
| 5 | Action tracking | Medium | Medium |
| 6 | ROI calculations | High | Medium |

---

## Code Changes Needed

### Backend Changes
1. `backend/src/utils/ai.ts`:
   - Refactor to use team-level data only (no member names)
   - Add team burnout risk indicators (counts only)
   - Add trend calculation from DailyTeamSummary
   - Enhance system prompt with WHS context
   - Add prediction logic based on patterns

2. `backend/src/modules/analytics/index.ts`:
   - Create new endpoint: `GET /analytics/team-summary`
   - Query DailyTeamSummary for team metrics
   - Calculate week-over-week trends
   - Add data quality score
   - Include exemption/incident counts (no names)

### Frontend Changes
1. `frontend/src/pages/team-leader/ai-insights-detail.page.tsx`:
   - Add freshness indicator
   - Display team-level narrative (no member lists)
   - Show prediction sections
   - Add action tracking UI
   - Show data quality warning if applicable

---

## Questions for Product Decision

### Current Scope (Team Lead)
1. Should AI insights be auto-generated on schedule (e.g., weekly)?
2. Should insights be private per Team Lead or visible to their Supervisor?
3. Should there be different report types (daily brief vs weekly deep-dive)?
4. Should AI flag compliance risks for WHS audits at team level?

### Future Scope (Not Yet)
5. Should Supervisors get aggregated insights across all teams they manage?
6. Should Executives get company-wide aggregated insights?

---

## Related Fixes Done

### 1. "Currently On Leave" Bug (Fixed)
- Was showing expired leaves for non-today periods
- Now always shows TODAY's active exemptions
- File: `backend/src/modules/teams/index.ts`

### 2. Auto-Refetch Optimization (Fixed)
- Removed 60-second polling on daily monitoring hooks
- Now uses 5-min staleTime + manual refresh
- Files: `frontend/src/pages/team-leader/daily-monitoring/hooks/*.ts`

### 3. Unused Code Cleanup (Fixed)
- Removed duplicate ROLE_HIERARCHY from lib/constants.ts
- Consolidated to config/roles.ts as single source
