# TypeScript Cleanup Plan

**Date:** January 13, 2026
**Total Errors:** 78
**Goal:** Fix all errors safely without breaking logic

---

## Error Categories

### Category A: SAFE - Unused Imports/Variables (45 errors)
These are 100% safe to remove. No logic changes.

### Category B: MEDIUM - Type Mismatches (25 errors)
Need to check what the code expects vs what's provided.

### Category C: RISKY - Missing Exports/Properties (8 errors)
Need deeper analysis before fixing.

---

## Category A: SAFE Fixes (Unused Code)

| # | File | Line | Unused Item | Action |
|---|------|------|-------------|--------|
| 1 | components/absences/AbsenceReviewCard.tsx | 88 | `formatDate` | Remove |
| 2 | components/charts/MetricsAverageChart.tsx | 21 | `showLabels` | Prefix `_` |
| 3 | components/charts/TopReasonsChart.tsx | 69 | `index` | Prefix `_` |
| 4 | components/monitoring/ExemptionCard.tsx | 6 | `useState` | Remove import |
| 5 | components/monitoring/ExemptionCard.tsx | 15 | `AlertTriangle` | Remove import |
| 6 | components/monitoring/ExemptionCard.tsx | 42,162 | `onViewDetails` | Prefix `_` |
| 7 | components/monitoring/SuddenChangeCard.tsx | 197 | `todayStatus` | Prefix `_` |
| 8 | components/ui/DataTable.tsx | 228 | `hasData` | Remove |
| 9 | components/ui/StatusBadge.tsx | 11-14 | 4 config imports | Remove imports |
| 10 | lib/schedule-utils.ts | 9 | `DAY_INDEX_TO_CODE` | Remove |
| 11 | lib/schedule-utils.ts | 196 | `shiftEnd` | Prefix `_` |
| 12 | pages/executive/company-calendar.page.tsx | 35 | `holidaysLoading` | Remove |
| 13 | pages/executive/teams-overview.page.tsx | 22,26,27 | `Calendar`, `Search`, `SlidersHorizontal` | Remove imports |
| 14 | pages/executive/teams-overview.page.tsx | 299 | `showFilters`, `setShowFilters` | Remove |
| 15 | pages/executive/users.page.tsx | 10 | `Users` | Remove import |
| 16 | pages/supervisor/dashboard.page.tsx | 18 | `Loader2` | Remove import |
| 17 | pages/supervisor/dashboard.page.tsx | 30 | `checkinsLoading` | Remove |
| 18 | pages/team-leader/ai-insights-detail.page.tsx | 17,21,22,32 | `Loader2`, `AlertCircle`, `BarChart3`, `formatDate` | Remove |
| 19 | pages/team-leader/approvals.page.tsx | 5 | `CardContent`, `CardHeader`, `CardTitle` | Remove |
| 20 | pages/team-leader/approvals.page.tsx | 16,24 | `FileText`, `AlertCircle` | Remove |
| 21 | pages/team-leader/team-analytics.page.tsx | 14,35 | `ReferenceArea`, `FileText` | Remove |
| 22 | pages/team-leader/team-incidents.page.tsx | 9 | `Eye` | Remove |
| 23 | pages/team-leader/team-member-history.page.tsx | 19 | `Loader2` | Remove |
| 24 | pages/team-leader/team-overview.page.tsx | 17 | `TrendingUp` | Remove |
| 25 | pages/whs/dashboard.page.tsx | 13,16 | `Loader2`, `WHSDashboardData` | Remove |
| 26 | pages/whs/fill-forms.page.tsx | 76 | `pageSizes` | Remove |
| 27 | pages/whs/visual-pdf-fill.page.tsx | 41,283 | `navigate`, `getFieldPosition` | Remove |
| 28 | pages/worker/checkin.page.tsx | 9,15,19,21,47 | `WeekStats`, `getExceptionTypeLabel`, `LeaveStatus`, `CardDescription`, `Target` | Remove |
| 29 | pages/worker/checkin.page.tsx | 633,1000 | `getStatusBadge`, `isFutureDay` | Remove |
| 30 | pages/worker/home.page.tsx | 49,89,97,105,1121 | `ORDERED_DAYS`, `createDateFormatter`, `partsToDateStr`, `getWeekdayFromDate`, `isRed` | Remove |
| 31 | pages/worker/report-incident.page.tsx | 28 | `Loader2` | Remove |
| 32 | pages/worker/request-exception.page.tsx | 27 | `Loader2` | Remove |
| 33 | services/absence.service.ts | 5 | `AbsenceWithReviewer` | Remove |

---

## Category B: MEDIUM Fixes (Type Mismatches)

| # | File | Line | Error | Fix |
|---|------|------|-------|-----|
| 1 | components/calendar/Calendar.tsx | 72,83,87,98 | `null` in Record type | Change type to allow null or filter nulls |
| 2 | components/layout/Sidebar.tsx | 34 | `NodeJS` namespace | Use `ReturnType<typeof setTimeout>` |
| 3 | lib/index.ts | 38,72,77 | Duplicate export, missing export | Fix re-exports |
| 4 | pages/admin/templates.page.tsx | 192 | `"outline"` invalid variant | Change to `"secondary"` |
| 5 | pages/executive/company-settings.page.tsx | 75 | Missing `timezone` | Add timezone to object |
| 6 | pages/executive/create-account.page.tsx | 159,360 | Missing icons | Add imports |
| 7 | pages/executive/dashboard.page.tsx | 128 | String vs Number | Parse to number |
| 8 | pages/executive/teams.page.tsx | 1135,1136 | Invalid modal type | Change to valid type |
| 9 | pages/incidents/incident-detail.page.tsx | 333 | `image.type` | Cast to proper type |
| 10 | pages/team-leader/ai-chat.page.tsx | 369 | `recommended` property | Add type guard |
| 11 | pages/team-leader/approvals.page.tsx | 105,106,121,122 | Invalid invalidation type | Add to type union or remove |
| 12 | pages/team-leader/member-profile.page.tsx | 921 | String vs Role | Cast or validate |
| 13 | pages/whs/visual-pdf-fill.page.tsx | 315,590 | `"outline"` invalid | Change to `"secondary"` |
| 14 | pages/worker/my-incidents.page.tsx | 130 | PageHeader props | Fix props |

---

## Category C: RISKY Fixes (Missing Properties)

| # | File | Line | Error | Analysis Needed |
|---|------|------|-------|-----------------|
| 1 | pages/executive/teams.page.tsx | 926 | `avatar` not on User | Check if User type needs update |
| 2 | pages/team-leader/approvals.page.tsx | 285,357 | `avatar` not on Pick<User> | Check if Pick needs avatar |
| 3 | pages/team-leader/daily-monitoring/tabs/ExemptionsTab.tsx | 59 | `notes` not on Exemption | Check Exemption type |
| 4 | pages/team-leader/daily-monitoring/tabs/SuddenChangesTab.tsx | 86 | Props mismatch | Check component props |

---

## Execution Plan

### Phase 1: Safe Fixes (Category A)
**Time:** 30-45 mins
**Risk:** None

1. Fix each file in order
2. Run `npm run build` after every 5 files
3. If error count increases → rollback
4. If error count decreases → continue

### Phase 2: Medium Fixes (Category B)
**Time:** 30-45 mins
**Risk:** Low

1. Read file first to understand context
2. Make minimal change to fix type
3. Run build after each file
4. Test affected feature if possible

### Phase 3: Risky Fixes (Category C)
**Time:** 15-30 mins
**Risk:** Medium

1. Analyze the type definitions first
2. Check if backend sends the property
3. Decide: update type OR remove usage
4. Test thoroughly

---

## Rollback Plan

If anything breaks:
```bash
git checkout -- <file>
```

Or restore from git:
```bash
git stash
```

---

## Success Criteria

- [ ] `npm run build` passes with 0 errors
- [ ] `npm run dev` starts without issues
- [ ] App works in browser (manual test)

---

## Files to Modify (Sorted by Safety)

### Batch 1: Components (SAFE)
1. components/absences/AbsenceReviewCard.tsx
2. components/charts/MetricsAverageChart.tsx
3. components/charts/TopReasonsChart.tsx
4. components/monitoring/ExemptionCard.tsx
5. components/monitoring/SuddenChangeCard.tsx
6. components/ui/DataTable.tsx
7. components/ui/StatusBadge.tsx

### Batch 2: Lib (SAFE)
8. lib/schedule-utils.ts
9. lib/index.ts (MEDIUM - needs care)

### Batch 3: Pages - Executive (SAFE)
10. pages/executive/company-calendar.page.tsx
11. pages/executive/teams-overview.page.tsx
12. pages/executive/users.page.tsx

### Batch 4: Pages - Team Leader (SAFE)
13. pages/team-leader/ai-insights-detail.page.tsx
14. pages/team-leader/approvals.page.tsx
15. pages/team-leader/team-analytics.page.tsx
16. pages/team-leader/team-incidents.page.tsx
17. pages/team-leader/team-member-history.page.tsx
18. pages/team-leader/team-overview.page.tsx

### Batch 5: Pages - Other (SAFE)
19. pages/supervisor/dashboard.page.tsx
20. pages/whs/dashboard.page.tsx
21. pages/whs/fill-forms.page.tsx
22. pages/whs/visual-pdf-fill.page.tsx
23. pages/worker/checkin.page.tsx
24. pages/worker/home.page.tsx
25. pages/worker/report-incident.page.tsx
26. pages/worker/request-exception.page.tsx

### Batch 6: Services (SAFE)
27. services/absence.service.ts

### Batch 7: Type Fixes (MEDIUM)
28. components/calendar/Calendar.tsx
29. components/layout/Sidebar.tsx
30. pages/admin/templates.page.tsx
31. pages/executive/company-settings.page.tsx
32. pages/executive/create-account.page.tsx
33. pages/executive/dashboard.page.tsx
34. pages/executive/teams.page.tsx
35. pages/incidents/incident-detail.page.tsx
36. pages/team-leader/ai-chat.page.tsx
37. pages/team-leader/member-profile.page.tsx
38. pages/worker/my-incidents.page.tsx

### Batch 8: Risky Fixes
39. pages/team-leader/daily-monitoring/tabs/ExemptionsTab.tsx
40. pages/team-leader/daily-monitoring/tabs/SuddenChangesTab.tsx
41. Check User type definition

---

## Ready for Execution

Plan complete. Waiting for approval to start.
