# Daily Monitoring Refactor - Implementation Plan

## Overview
Refactor the Daily Monitoring module for 5,000+ member scale with proper folder structure.

---

## 1. Current Files (What We Have)

### Backend
```
backend/src/modules/daily-monitoring/index.ts  (779 lines)
  - GET /daily-monitoring           → Returns ALL data (not scalable)
  - GET /daily-monitoring/teams     → Team list
  - GET /daily-monitoring/sudden-changes → Detailed changes
  - GET /daily-monitoring/member/:memberId → Member history
```

### Frontend
```
frontend/src/pages/team-leader/daily-monitoring.page.tsx  (920 lines)
  - Single monolithic file
  - 4 tabs: checkins, changes, exemptions, absences
  - Inline modals: ApproveModal, CreateExemptionModal
  - Inline components: CheckinCard, CheckinRow, StatsBar, etc.
```

### Connected Services
```
frontend/src/services/daily-monitoring.service.ts
  - getDailyMonitoring()
  - getAvailableTeams()
  - getSuddenChanges()
  - getMemberDetail()
```

### Connected Components (Reusable)
```
frontend/src/components/monitoring/
  ├── MetricsBadge.tsx      → MetricsBadge, MetricsRow (REUSE)
  ├── SuddenChangeCard.tsx  → SuddenChangeCard, SuddenChangeRow (REUSE)
  ├── ExemptionCard.tsx     → PendingExemptionCard, ActiveExemptionCard (REUSE)
  └── index.ts

frontend/src/components/absences/
  └── AbsenceReviewCard.tsx  → (REUSE)

frontend/src/components/ui/
  ├── Button.tsx            → (REUSE)
  ├── Card.tsx              → (REUSE)
  ├── Avatar.tsx            → (REUSE)
  ├── LoadingSpinner.tsx    → (REUSE)
  ├── EmptyState.tsx        → (REUSE)
  └── Toast.tsx             → useToast (REUSE)
```

---

## 2. New Folder Structure

### Backend (New Endpoints Only - Keep Existing)
```
backend/src/modules/daily-monitoring/index.ts
  ADD:
  - GET /daily-monitoring/stats              → Lightweight stats only
  - GET /daily-monitoring/checkins           → Paginated check-ins
  - GET /daily-monitoring/not-checked-in     → Paginated not-checked-in
  - GET /daily-monitoring/exemptions         → Paginated exemptions
  ENHANCE:
  - GET /daily-monitoring/sudden-changes     → Add pagination
```

### Frontend (New Folder Structure)
```
frontend/src/pages/team-leader/daily-monitoring/
├── index.tsx                           # Main page (orchestrator)
├── DailyMonitoringPage.tsx             # Export wrapper for router
├── types.ts                            # Local types
│
├── components/
│   ├── index.ts                        # Re-exports
│   ├── StatsBar.tsx                    # Desktop stats (extracted)
│   ├── MobileStatsCards.tsx            # Mobile stats (extracted)
│   ├── CriticalAlert.tsx               # Critical drop alert (extracted)
│   ├── SearchBar.tsx                   # Search input
│   ├── TabNavigation.tsx               # Tab buttons
│   │
│   ├── checkins/
│   │   ├── index.ts
│   │   ├── CheckinCard.tsx             # Mobile card (extracted)
│   │   ├── CheckinRow.tsx              # Desktop row (extracted)
│   │   ├── CheckinTable.tsx            # Desktop table wrapper
│   │   ├── CheckinVirtualList.tsx      # Virtual scroll (NEW)
│   │   └── NotCheckedInSection.tsx     # Not checked in (extracted)
│   │
│   └── modals/
│       ├── index.ts
│       ├── ApproveExemptionModal.tsx   # (extracted)
│       └── CreateExemptionModal.tsx    # (extracted)
│
├── hooks/
│   ├── index.ts                        # Re-exports
│   ├── useMonitoringStats.ts           # Stats query (lightweight)
│   ├── useCheckins.ts                  # Infinite scroll checkins
│   ├── useNotCheckedIn.ts              # Paginated not-checked-in
│   ├── useSuddenChanges.ts             # Paginated sudden changes
│   ├── useExemptions.ts                # Paginated exemptions
│   └── useExemptionMutations.ts        # Mutations (extracted)
│
└── tabs/
    ├── index.ts                        # Re-exports
    ├── CheckinsTab.tsx                 # Check-ins tab
    ├── SuddenChangesTab.tsx            # Sudden changes tab
    ├── ExemptionsTab.tsx               # Exemptions tab
    └── AbsencesTab.tsx                 # Absences tab
```

---

## 3. Connected Logic - DO NOT BREAK

### 3.1 Router Connection
```typescript
// frontend/src/app/router.tsx
// Currently imports: DailyMonitoringPage from '../pages/team-leader/daily-monitoring.page'
// After: Import from '../pages/team-leader/daily-monitoring' (folder index)
```

### 3.2 Navigation Connection
```typescript
// frontend/src/config/navigation.ts
// Path: '/team/daily-monitoring' - NO CHANGE NEEDED
```

### 3.3 Service Dependencies
```typescript
// frontend/src/services/daily-monitoring.service.ts
// - getDailyMonitoring() → Used by current page
// - Will add new functions for paginated endpoints
// - Keep old function for backward compatibility
```

### 3.4 Type Dependencies
```typescript
// frontend/src/services/daily-monitoring.service.ts exports types:
// - DailyMonitoringData, TodayCheckin, MonitoringStats, etc.
// - These types are used in the page - keep them or re-export
```

### 3.5 Monitoring Components
```typescript
// frontend/src/components/monitoring/
// - MetricsRow → Used in CheckinCard, CheckinRow
// - SuddenChangeCard → Used in SuddenChangesTab
// - PendingExemptionCard, ActiveExemptionCard → Used in ExemptionsTab
// ALL MUST BE IMPORTED CORRECTLY
```

### 3.6 Absence Service
```typescript
// frontend/src/services/absence.service.ts
// - absenceService.getTeamPending() → Used in AbsencesTab
// - AbsenceReviewCard component → Must import correctly
```

### 3.7 Exemption Service
```typescript
// frontend/src/services/exemption.service.ts
// - approveExemption, rejectExemption, endExemptionEarly, createExemptionForWorker
// - EXCEPTION_TYPE_OPTIONS, ExceptionType
// - These are used in modals and mutations
```

### 3.8 URL State (Tab Sync)
```typescript
// useSearchParams for tab state
// ?tab=checkins | changes | exemptions | absences
// Must preserve this behavior
```

---

## 4. UI Components to Reuse

### From components/ui/
| Component | Usage |
|-----------|-------|
| `Button` | All actions (Refresh, Approve, Reject, etc.) |
| `Card, CardHeader, CardTitle, CardContent` | Section containers |
| `Avatar` | User avatars |
| `LoadingSpinner` | Loading states |
| `EmptyState` | Empty list states |
| `useToast` | Success/error notifications |

### From components/monitoring/
| Component | Usage |
|-----------|-------|
| `MetricsRow` | Show mood/stress/sleep/physical in checkins |
| `SuddenChangeCard` | Changes tab cards |
| `PendingExemptionCard` | Pending exemptions |
| `ActiveExemptionCard` | Active exemptions |

### From components/absences/
| Component | Usage |
|-----------|-------|
| `AbsenceReviewCard` | Absences tab |

### Icons from lucide-react
```
CheckCircle2, AlertTriangle, Shield, CalendarX, RefreshCw, Users,
TrendingDown, Clock, Timer, ChevronRight, X, Flame, UserMinus,
Eye, MessageSquare, Search
```

---

## 5. Implementation Order

### Phase 1: Backend API (No Frontend Changes Yet)
- [ ] 1.1 Add helper: `getTeamForUser()` - reusable team lookup
- [ ] 1.2 Add `GET /daily-monitoring/stats` endpoint
- [ ] 1.3 Add `GET /daily-monitoring/checkins?page=1&limit=50&search=&status=`
- [ ] 1.4 Add `GET /daily-monitoring/not-checked-in?page=1&limit=50`
- [ ] 1.5 Enhance `GET /daily-monitoring/sudden-changes` with pagination
- [ ] 1.6 Add `GET /daily-monitoring/exemptions?status=PENDING|ACTIVE`
- [ ] 1.7 Test all endpoints with Postman

### Phase 2: Frontend Service Layer
- [ ] 2.1 Add `getMonitoringStats()` function
- [ ] 2.2 Add `getCheckins()` with pagination params
- [ ] 2.3 Add `getNotCheckedIn()` with pagination params
- [ ] 2.4 Update `getSuddenChanges()` with pagination
- [ ] 2.5 Add `getExemptions()` with pagination params

### Phase 3: Create Folder Structure & Types
- [ ] 3.1 Create `daily-monitoring/` folder
- [ ] 3.2 Create `types.ts` with local types
- [ ] 3.3 Create folder structure (components/, hooks/, tabs/)

### Phase 4: Extract Hooks
- [ ] 4.1 Create `useMonitoringStats.ts`
- [ ] 4.2 Create `useCheckins.ts` with useInfiniteQuery
- [ ] 4.3 Create `useNotCheckedIn.ts`
- [ ] 4.4 Create `useSuddenChanges.ts`
- [ ] 4.5 Create `useExemptions.ts`
- [ ] 4.6 Create `useExemptionMutations.ts`

### Phase 5: Extract Components
- [ ] 5.1 Extract `StatsBar.tsx` and `MobileStatsCards.tsx`
- [ ] 5.2 Extract `CriticalAlert.tsx`
- [ ] 5.3 Extract `SearchBar.tsx`
- [ ] 5.4 Extract `CheckinCard.tsx` and `CheckinRow.tsx`
- [ ] 5.5 Extract `CheckinTable.tsx`
- [ ] 5.6 Extract `NotCheckedInSection.tsx`
- [ ] 5.7 Extract `ApproveExemptionModal.tsx`
- [ ] 5.8 Extract `CreateExemptionModal.tsx`

### Phase 6: Install Virtual Scroll & Create Virtual List
- [ ] 6.1 Install `@tanstack/react-virtual`
- [ ] 6.2 Create `CheckinVirtualList.tsx`

### Phase 7: Create Tab Components
- [ ] 7.1 Create `CheckinsTab.tsx`
- [ ] 7.2 Create `SuddenChangesTab.tsx`
- [ ] 7.3 Create `ExemptionsTab.tsx`
- [ ] 7.4 Create `AbsencesTab.tsx`

### Phase 8: Create Main Page & Export
- [ ] 8.1 Create `index.tsx` (orchestrator)
- [ ] 8.2 Create `DailyMonitoringPage.tsx` (export wrapper)
- [ ] 8.3 Update router import

### Phase 9: Delete Old File & Test
- [ ] 9.1 Delete `daily-monitoring.page.tsx` (old file)
- [ ] 9.2 Test all tabs work correctly
- [ ] 9.3 Test pagination/infinite scroll
- [ ] 9.4 Test search functionality
- [ ] 9.5 Test modals (approve, create exemption)
- [ ] 9.6 Test mutations (approve, reject, end early)

---

## 6. API Response Shapes

### GET /daily-monitoring/stats
```typescript
{
  team: {
    id: string;
    name: string;
    workDays: string;
    shiftStart: string;
    shiftEnd: string;
    timezone: string;
  };
  stats: {
    totalMembers: number;
    activeMembers: number;
    onLeave: number;
    checkedIn: number;
    notCheckedIn: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
    pendingExemptions: number;
    activeExemptions: number;
    suddenChanges: number;
    criticalChanges: number;
    isHoliday: boolean;
    holidayName: string | null;
  };
  generatedAt: string;
}
```

### GET /daily-monitoring/checkins
```typescript
{
  data: TodayCheckin[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### GET /daily-monitoring/not-checked-in
```typescript
{
  data: NotCheckedInMember[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### GET /daily-monitoring/sudden-changes (Enhanced)
```typescript
{
  data: SuddenChange[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    criticalCount: number;
    significantCount: number;
    notableCount: number;
    minorCount: number;
  };
}
```

### GET /daily-monitoring/exemptions
```typescript
{
  pending: Exemption[];
  active: Exemption[];
  pagination: {
    pendingTotal: number;
    activeTotal: number;
    page: number;
    limit: number;
  };
}
```

---

## 7. Dependencies to Install

```bash
cd frontend
npm install @tanstack/react-virtual
```

---

## 8. Files to Delete After Migration

```
frontend/src/pages/team-leader/daily-monitoring.page.tsx  (old monolithic file)
```

---

## 9. Testing Checklist

- [ ] Page loads without errors
- [ ] Stats bar shows correct counts
- [ ] Check-ins tab:
  - [ ] List loads with pagination
  - [ ] Search works (debounced)
  - [ ] Filter by status works
  - [ ] Infinite scroll loads more
  - [ ] Not checked in section shows
- [ ] Sudden Changes tab:
  - [ ] List loads with pagination
  - [ ] Severity sorting works
- [ ] Exemptions tab:
  - [ ] Pending list loads
  - [ ] Active list loads
  - [ ] Approve modal works
  - [ ] Reject action works
  - [ ] End early action works
- [ ] Absences tab:
  - [ ] Pending absences load
  - [ ] Review actions work
- [ ] Tab URL sync (?tab=xxx)
- [ ] Mobile responsive layout
- [ ] Toast notifications work

---

## 10. Rollback Plan

If something breaks:
1. Keep old `/daily-monitoring` endpoint working (backward compat)
2. Keep old service functions
3. Git: Can revert to previous commit

---

## 11. COMPREHENSIVE CHECKLIST - EVERYTHING TO PRESERVE

### 11.1 React Imports
```typescript
// FROM react
- useMemo          ✓ Used in filteredCheckins
- useState         ✓ Multiple state variables
- useCallback      ✓ Handler functions
- useEffect        ✓ Tab URL sync
- memo             ✓ CheckinCard, CheckinRow, StatsBar, MobileStatsCards
```

### 11.2 React Query Imports
```typescript
// FROM @tanstack/react-query
- useQuery         ✓ Main data query + absences query
- useMutation      ✓ 4 mutations (approve, reject, endEarly, create)
- useQueryClient   ✓ Invalidate queries on mutation success
```

### 11.3 Router Imports
```typescript
// FROM react-router-dom
- useSearchParams  ✓ Tab URL sync (?tab=xxx)
```

### 11.4 Lucide Icons (16 icons)
```typescript
CheckCircle2, AlertTriangle, Shield, CalendarX, RefreshCw, Users,
TrendingDown, Clock, Timer, ChevronRight, X, Flame, UserMinus,
Eye, MessageSquare, Search
```

### 11.5 UI Components
```typescript
// FROM components/ui/
- Button           ✓ Refresh, Cancel, Approve, Reject, View
- Card             ✓ CardHeader, CardTitle, CardContent
- LoadingSpinner   ✓ Loading state
- EmptyState       ✓ Empty list states
- useToast         ✓ Success/error notifications
- Avatar           ✓ User avatars
```

### 11.6 Monitoring Components
```typescript
// FROM components/monitoring/
- MetricsRow              ✓ In CheckinCard & CheckinRow
- SuddenChangeCard        ✓ In changes tab
- PendingExemptionCard    ✓ In exemptions tab
- ActiveExemptionCard     ✓ In exemptions tab
```

### 11.7 Services & Types
```typescript
// FROM services/daily-monitoring.service
- getDailyMonitoring      ✓ Main data fetch
- getStatusColor          ✓ Status badge colors
- type DailyMonitoringData
- type TodayCheckin

// FROM services/exemption.service
- approveExemption        ✓ Approve mutation
- rejectExemption         ✓ Reject mutation
- endExemptionEarly       ✓ End early mutation
- createExemptionForWorker ✓ Create mutation
- EXCEPTION_TYPE_OPTIONS  ✓ CreateExemptionModal dropdown
- type Exemption
- type ExceptionType

// FROM services/absence.service
- absenceService.getTeamPending ✓ Absences query
```

### 11.8 Absence Components
```typescript
// FROM components/absences/
- AbsenceReviewCard       ✓ In absences tab
```

### 11.9 Utils
```typescript
// FROM lib/utils
- cn                      ✓ Conditional classnames

// FROM lib/date-utils
- getNowInTimezone        ✓ Modals date calculation
```

### 11.10 Local Types
```typescript
type MonitoringTab = 'checkins' | 'changes' | 'exemptions' | 'absences';
```

### 11.11 Constants
```typescript
const QUERY_KEY = 'daily-monitoring';
const REFETCH_INTERVAL = 60000; // 1 minute
```

### 11.12 State Variables (Main Component)
```typescript
// URL State
const [searchParams, setSearchParams] = useSearchParams();
const tabFromUrl = searchParams.get('tab') as MonitoringTab | null;

// UI State
const [activeTab, setActiveTab] = useState<MonitoringTab>(tabFromUrl || 'checkins');
const [searchQuery, setSearchQuery] = useState('');

// Modal State
const [selectedExemption, setSelectedExemption] = useState<Exemption | null>(null);
const [showApproveModal, setShowApproveModal] = useState(false);
const [selectedCheckinForExemption, setSelectedCheckinForExemption] = useState<TodayCheckin | null>(null);
```

### 11.13 Queries (2 queries)
```typescript
// Main monitoring data
useQuery({
  queryKey: [QUERY_KEY],
  queryFn: getDailyMonitoring,
  refetchInterval: REFETCH_INTERVAL,
  staleTime: 30000,
});

// Pending absences
useQuery({
  queryKey: ['absences', 'team-pending'],
  queryFn: () => absenceService.getTeamPending(),
  refetchInterval: REFETCH_INTERVAL,
});
```

### 11.14 Mutations (4 mutations)
```typescript
// 1. Approve Exemption
useMutation({
  mutationFn: ({ id, endDate, notes }) => approveExemption(id, { endDate, notes }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    setShowApproveModal(false);
    setSelectedExemption(null);
    toast.success('Exemption approved');
  },
  onError: () => toast.error('Failed to approve exemption'),
});

// 2. Reject Exemption
useMutation({
  mutationFn: ({ id, notes }) => rejectExemption(id, { notes }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    toast.success('Exemption rejected');
  },
  onError: () => toast.error('Failed to reject exemption'),
});

// 3. End Early
useMutation({
  mutationFn: ({ id, notes }) => endExemptionEarly(id, { notes }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    toast.success('Exemption ended');
  },
  onError: () => toast.error('Failed to end exemption'),
});

// 4. Create Exemption (for RED worker)
useMutation({
  mutationFn: (params) => createExemptionForWorker(params),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    setSelectedCheckinForExemption(null);
    toast.success('Exemption created');
  },
  onError: () => toast.error('Failed to create exemption'),
});
```

### 11.15 Handler Functions
```typescript
handleTabChange(tab)       → setActiveTab + setSearchParams
handleApprove(exemption)   → Open approve modal
handleReject(exemption)    → Confirm + reject mutation
handleEndEarly(exemption)  → Confirm + end early mutation
```

### 11.16 Computed Values
```typescript
// Filtered checkins by search
const filteredCheckins = useMemo(() => {
  if (!data || !searchQuery) return data?.todayCheckins || [];
  const query = searchQuery.toLowerCase();
  return data.todayCheckins.filter(c =>
    c.user.firstName.toLowerCase().includes(query) ||
    c.user.lastName.toLowerCase().includes(query) ||
    c.user.email.toLowerCase().includes(query)
  );
}, [data, searchQuery]);
```

### 11.17 Effects
```typescript
// Sync tab state with URL
useEffect(() => {
  if (tabFromUrl && tabFromUrl !== activeTab) {
    setActiveTab(tabFromUrl);
  }
}, [tabFromUrl]);
```

### 11.18 Inline Components (To Extract)
```
1. ApproveModal (~100 lines)
   - Props: exemption, onClose, onConfirm, isLoading, timezone
   - State: endDate, notes
   - Date calculation with timezone
   - Quick date buttons (Tomorrow, 3 days, 1 week)

2. CreateExemptionModal (~130 lines)
   - Props: checkin, onClose, onConfirm, isLoading, timezone
   - State: type, reason, endDate, notes
   - Exception type dropdown
   - Date calculation with timezone
   - Quick date buttons

3. CheckinCard (~70 lines) - MOBILE
   - Props: checkin, onCreateExemption
   - Uses: Avatar, MetricsRow, getStatusColor
   - Shows: user info, streak, score, status, metrics
   - Actions: Put on Leave (RED only), Details, Message

4. CheckinRow (~65 lines) - DESKTOP
   - Props: checkin, onCreateExemption
   - Uses: Avatar, MetricsRow, getStatusColor
   - Table row version of CheckinCard

5. StatsBar (~25 lines) - DESKTOP
   - Props: stats { greenCount, yellowCount, redCount, totalCheckedIn, teamSize }
   - Shows: Ready/Limited/At Risk counts + checked in ratio

6. MobileStatsCards (~25 lines) - MOBILE
   - Props: stats (same as StatsBar)
   - 4-column grid of stat cards
```

### 11.19 UI Sections
```
1. Page Header
   - Title: "Daily Monitoring"
   - Subtitle: team.name + date
   - Refresh button

2. Stats Bar (desktop) / Mobile Stats Cards (mobile)

3. Critical Alert Banner
   - Shows when stats.criticalChanges > 0
   - "View" button → switches to changes tab

4. Search Bar
   - Only visible on checkins tab
   - Filters by firstName, lastName, email

5. Tab Content Panels:
   a. CHECK-INS TAB
      - Mobile: CheckinCard grid
      - Desktop: CheckinRow table
      - "Not Checked In" section (Card with Avatar list)

   b. CHANGES TAB
      - SuddenChangeCard grid (md:grid-cols-2)
      - Empty state when no changes

   c. EXEMPTIONS TAB
      - Pending section (h3 + PendingExemptionCard grid)
      - Active section (h3 + ActiveExemptionCard grid)

   d. ABSENCES TAB
      - AbsenceReviewCard grid
      - Info box (How Absence Reviews Work)

6. Modals (conditionally rendered)
   - ApproveModal
   - CreateExemptionModal
```

### 11.20 Data Structure from API
```typescript
const {
  team,                    // TeamInfo
  stats,                   // MonitoringStats
  todayCheckins,           // TodayCheckin[]
  notCheckedInMembers,     // NotCheckedInMember[]
  suddenChanges,           // SuddenChange[]
  pendingExemptions,       // Exemption[]
  activeExemptions         // Exemption[]
} = data;

// Stats shape for StatsBar
{
  greenCount, yellowCount, redCount,
  totalCheckedIn: stats.checkedIn,
  teamSize: stats.totalMembers
}
```

### 11.21 Error Handling
```typescript
// Loading state
if (isLoading) → LoadingSpinner

// Error state
if (error || !data) {
  - Check if "not assigned to a team" error
  - Show appropriate icon (Users or AlertTriangle)
  - Show appropriate message
  - Retry button (only for non-team errors)
}
```

### 11.22 Responsive Breakpoints
```
- Mobile: default
- Desktop: md: (768px+)
- Large: lg: (1024px+) - only for exemptions grid

CheckinCard: visible on mobile only (md:hidden via grid)
CheckinRow/Table: visible on desktop only (hidden md:block)
StatsBar: hidden md:flex
MobileStatsCards: grid md:hidden
```

---

## 12. FILE MAPPING - Old → New

| Old Location | New Location |
|--------------|--------------|
| `daily-monitoring.page.tsx` (entire file) | Split into folder |
| Lines 87-191 (ApproveModal) | `components/modals/ApproveExemptionModal.tsx` |
| Lines 193-322 (CreateExemptionModal) | `components/modals/CreateExemptionModal.tsx` |
| Lines 334-405 (CheckinCard) | `components/checkins/CheckinCard.tsx` |
| Lines 408-475 (CheckinRow) | `components/checkins/CheckinRow.tsx` |
| Lines 492-514 (StatsBar) | `components/StatsBar.tsx` |
| Lines 517-541 (MobileStatsCards) | `components/MobileStatsCards.tsx` |
| Lines 714-729 (CriticalAlert) | `components/CriticalAlert.tsx` |
| Lines 731-743 (SearchBar) | `components/SearchBar.tsx` |
| Lines 786-805 (NotCheckedIn) | `components/checkins/NotCheckedInSection.tsx` |
| Lines 547-916 (Main) | Split into `index.tsx` + tabs |

---

## 13. CROSS-CHECK: Router Connection

```typescript
// frontend/src/app/router.tsx - Line 58
// CURRENT (lazy load):
const DailyMonitoringPage = lazy(() =>
  import('../pages/team-leader/daily-monitoring.page')
    .then(m => ({ default: m.DailyMonitoringPage }))
);

// AFTER:
const DailyMonitoringPage = lazy(() =>
  import('../pages/team-leader/daily-monitoring')
    .then(m => ({ default: m.DailyMonitoringPage }))
);

// Route path (Line 226): 'team/daily-monitoring' - NO CHANGE
```

Must verify router import works after migration!

---

## 14. FINAL FOLDER STRUCTURE SUMMARY

```
frontend/src/pages/team-leader/
├── daily-monitoring.page.tsx          ← DELETE after migration
│
└── daily-monitoring/                   ← NEW FOLDER
    ├── index.tsx                       # Re-export DailyMonitoringPage
    ├── DailyMonitoringPage.tsx         # Main orchestrator component
    ├── types.ts                        # MonitoringTab, local types
    │
    ├── components/
    │   ├── index.ts                    # Re-exports all components
    │   ├── StatsBar.tsx
    │   ├── MobileStatsCards.tsx
    │   ├── CriticalAlert.tsx
    │   ├── SearchBar.tsx
    │   │
    │   ├── checkins/
    │   │   ├── index.ts
    │   │   ├── CheckinCard.tsx
    │   │   ├── CheckinRow.tsx
    │   │   ├── CheckinTable.tsx
    │   │   ├── CheckinVirtualList.tsx  # For 5k scale
    │   │   └── NotCheckedInSection.tsx
    │   │
    │   └── modals/
    │       ├── index.ts
    │       ├── ApproveExemptionModal.tsx
    │       └── CreateExemptionModal.tsx
    │
    ├── hooks/
    │   ├── index.ts
    │   ├── useMonitoringStats.ts       # Stats only (lightweight)
    │   ├── useCheckins.ts              # Paginated + infinite scroll
    │   ├── useNotCheckedIn.ts          # Paginated
    │   ├── useSuddenChanges.ts         # Paginated
    │   ├── useExemptions.ts            # Paginated
    │   └── useExemptionMutations.ts    # 4 mutations
    │
    └── tabs/
        ├── index.ts
        ├── CheckinsTab.tsx
        ├── SuddenChangesTab.tsx
        ├── ExemptionsTab.tsx
        └── AbsencesTab.tsx
```

---

## 15. READY TO IMPLEMENT?

Before starting, verify:
- [ ] Plan reviewed and understood
- [ ] All connections identified
- [ ] All components listed
- [ ] Router import path noted
- [ ] Reusable components identified
- [ ] Types and services documented

Start with Phase 1: Backend API!
