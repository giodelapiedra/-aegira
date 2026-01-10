# Grade Consistency Fix Documentation

## Problem Statement

The **Teams Overview** (Executive/Supervisor view) and **Team Analytics** (Team Lead view) were showing different grades for the same team and period.

**Example Discrepancy (Before Fix):**
| View | Team | Period | Grade | Score | Compliance | Members |
|------|------|--------|-------|-------|------------|---------|
| Teams Overview | Alpha Team | 14 days | D- | 62 | 70% | 5 |
| Team Analytics | Alpha Team | 14 days | D | 65 | 70% | 6 |

## Root Causes Identified

### 1. Member Count Difference (6 vs 5)

**Issue:** Team Analytics was including ALL active team members, while Teams Overview filtered by role.

**Team Analytics (OLD):**
```typescript
members: {
  where: { isActive: true },  // No role filter - includes TEAM_LEAD
}
```

**Teams Overview:**
```typescript
members: {
  where: { isActive: true, role: { in: ['WORKER', 'MEMBER'] } },
}
```

**Fix:** Updated Team Analytics to also filter by role `['WORKER', 'MEMBER']`.

**Files Changed:**
- `backend/src/modules/teams/index.ts` (lines 1383-1384 and 1410)

---

### 2. AvgReadiness Calculation Method

**Issue:** Different averaging methods produced different results.

**Teams Overview (OLD) - Flat Average:**
```typescript
// Average of ALL check-in scores (members with more check-ins have more weight)
avgReadiness = sum(all_scores) / count(all_scores)
```

**Team Analytics - Member Averages:**
```typescript
// Average of each member's average (each member weighted equally)
avgReadiness = sum(member_averages) / count(members)
```

**Example showing the difference:**
- Member A: 3 check-ins (80, 80, 80) → member avg = 80
- Member B: 1 check-in (40) → member avg = 40

| Method | Calculation | Result |
|--------|-------------|--------|
| Flat Average | (80+80+80+40)/4 | **70** |
| Member Averages | (80+40)/2 | **60** |

**Fix:** Updated Teams Overview to use member averages.

**Files Changed:**
- `backend/src/utils/team-grades-optimized.ts` (lines 551-563, 585-596)

---

### 3. Exemption Date Comparison (Timezone Issue)

**Issue:** Raw Date object comparison without timezone normalization caused exemptions to be detected on wrong days.

**OLD Code:**
```typescript
const isExempted = userExemptions.some(ex => {
  return current >= ex.startDate && current <= ex.endDate;  // Raw comparison
});
```

**NEW Code:**
```typescript
const currentDayStart = getStartOfDay(current, timezone);
const isExempted = userExemptions.some(ex => {
  const exemptStart = getStartOfDay(ex.startDate, timezone);
  const exemptEnd = getStartOfDay(ex.endDate, timezone);
  return currentDayStart >= exemptStart && currentDayStart <= exemptEnd;
});
```

**Files Changed:**
- `backend/src/utils/team-grades-optimized.ts` (lines 378, 391-394, 477, 486-488)

---

### 4. Exempted-But-Checked-In Logic

**Issue:** Teams Overview was completely skipping exempted members, while Team Analytics counts exempted members who still checked in.

**Team Analytics Logic:**
- If a member is on exemption but still checks in, they count in BOTH:
  - Numerator (checked in count)
  - Denominator (expected count)
- This ensures their effort is recognized (100% for that member)

**OLD Teams Overview:**
```typescript
if (isExempted) {
  totalExcused++;
  continue;  // Skipped entirely - didn't count their check-in!
}
```

**NEW Teams Overview:**
```typescript
// First separate expected and exempted members
for (member of team.members) {
  if (isExempted) {
    exemptedMembers.push(member.id);
  } else {
    expectedMembers.push(member.id);
  }
}

// Count check-ins for each category
const expectedCheckedIn = expectedMembers.filter(hasCheckin).length;
const exemptedButCheckedIn = exemptedMembers.filter(hasCheckin).length;

// Compliance formula (same as Team Analytics)
const dayExpected = expectedMembers.length + exemptedButCheckedIn;
const dayCheckedIn = expectedCheckedIn + exemptedButCheckedIn;
const compliance = dayCheckedIn / dayExpected;
```

**Files Changed:**
- `backend/src/utils/team-grades-optimized.ts` (lines 372-452, 472-532)

---

## Grade Formula (Consistent Across Both Views)

```
Grade Score = (Team Avg Readiness × 60%) + (Period Compliance × 40%)
```

### Grade Scale
| Score | Letter Grade | Label |
|-------|--------------|-------|
| 97-100 | A+ | Outstanding |
| 93-96 | A | Excellent |
| 90-92 | A- | Excellent |
| 87-89 | B+ | Very Good |
| 83-86 | B | Good |
| 80-82 | B- | Good |
| 77-79 | C+ | Satisfactory |
| 73-76 | C | Satisfactory |
| 70-72 | C- | Satisfactory |
| 67-69 | D+ | Needs Improvement |
| 63-66 | D | Needs Improvement |
| 60-62 | D- | Needs Improvement |
| <60 | F | Critical |

---

## Definitions

### Team Avg Readiness
- **Method:** Average of member averages
- **Calculation:**
  1. For each member, calculate their average readiness score from all check-ins in the period
  2. Average all member averages together
- **Weighting:** Each member is weighted equally regardless of check-in count

### Period Compliance
- **Method:** Average of daily compliance rates
- **Calculation:**
  1. For each work day in period:
     - Expected = non-exempted members + exempted members who checked in
     - CheckedIn = expected who checked in + exempted who checked in
     - Daily Compliance = CheckedIn / Expected × 100
  2. Average all daily compliance rates
- **Exclusions:** Weekends, holidays, members who haven't started yet

### Members Counted
- **Included:** Users with role `WORKER` or `MEMBER`
- **Excluded:** Users with role `TEAM_LEAD`, `SUPERVISOR`, `EXECUTIVE`, `ADMIN`
- **Reason:** Team leads supervise but don't check in as workers

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/utils/team-grades-optimized.ts` | Main grade calculation logic - member averages, exemption handling |
| `backend/src/modules/teams/index.ts` | Team Analytics endpoint - role filter for members |

---

## Test Results (After Fix)

### Alpha Team - 7 Days
| Metric | Teams Overview | Team Analytics | Match |
|--------|----------------|----------------|-------|
| Grade | C- | C- | ✅ |
| Score | 72 | 72 | ✅ |
| Compliance | 88% | 88% | ✅ |
| Members | 5 | 5 | ✅ |

### Bravo Team - 7 Days
| Metric | Teams Overview | Team Analytics | Match |
|--------|----------------|----------------|-------|
| Grade | D- | D- | ✅ |
| Score | 61 | 61 | ✅ |
| Compliance | 80% | 80% | ✅ |

### Bravo Team - 14 Days
| Metric | Teams Overview | Team Analytics | Match |
|--------|----------------|----------------|-------|
| Grade | D- | D- | ✅ |
| Score | 62 | 62 | ✅ |
| Compliance | 84% | 84% | ✅ |

---

## Test Scripts

Located in `backend/`:
- `test-compare-both.ts` - Compares Teams Overview vs Team Analytics for same team
- `test-alpha-team.ts` - Specific test for Alpha Team
- `test-grade-consistency.ts` - Overall grade consistency test

Run with:
```bash
cd backend
npx tsx test-compare-both.ts
npx tsx test-alpha-team.ts
```

---

## Date: January 9, 2026
