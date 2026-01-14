# Team Members Page Refactor Plan

## Overview

Refactor `team-members.page.tsx` (588 lines) into a modular folder structure similar to `daily-monitoring/` for better reusability across roles and lighter queries.

---

## Current State Analysis

### Current File
```
frontend/src/pages/team-leader/team-members.page.tsx (588 lines)
```

### Current Data Flow
```
TeamMembersPage
    └── useQuery(['my-team']) → teamService.getMyTeam()
            └── Returns: TeamDetails { team info + ALL members with stats }
```

### Current Components (inline, memoized)
- `MemberCard` - Mobile card view
- `MemberRow` - Desktop table row
- Transfer Modal (inline JSX)
- Deactivate Modal (uses ConfirmModal)

### Current Issues
1. Single large file (588 lines)
2. Loads ALL members at once (not paginated)
3. Hardcoded to `/teams/my` - not reusable for other roles
4. Components not shareable

---

## Dependencies & Related Files

### Files That Import/Reference team-members

| File | Usage |
|------|-------|
| `router.tsx:59` | Lazy import `TeamMembersPage` |
| `router.tsx:285` | Route element `<TeamMembersPage />` |
| `navigation.ts:198` | Sidebar link `href: '/team/members'` |

### Files That Navigate TO `/team/members`

| File | Line | Context |
|------|------|---------|
| `member-profile.page.tsx:165` | After transfer success: `navigate('/team/members')` |
| `member-profile.page.tsx:241` | Error state back button |
| `member-profile.page.tsx:256` | Header back button |

### Files That Navigate FROM `/team/members`

| File | Line | Context |
|------|------|---------|
| `team-members.page.tsx:376` | View profile: `navigate('/team/members/${member.id}')` |
| `team-overview.page.tsx:214` | Click member: `navigate('/team/members/${memberId}')` |
| `team-analytics.page.tsx:522,569` | Members needing attention links |

### Duplicate Logic Found

**member-profile.page.tsx (1023 lines) has SAME logic:**
- Transfer modal (lines 935-993) - almost identical to team-members
- Transfer mutation (lines 159-170)
- Deactivate mutation (lines 131-142)
- Reactivate mutation (lines 145-156)
- `useQuery(['all-teams-for-transfer'])` - same query

**Opportunity:** Extract shared `TransferMemberModal` and `useMemberMutations` hook to be reused by BOTH pages.

### Query Keys to Consider

```typescript
// Used by team-members.page.tsx
['my-team']                    // Main team data
['all-teams-for-transfer']     // Transfer modal teams

// Used by member-profile.page.tsx
['member-profile', userId]     // Member details
['all-teams-for-transfer']     // Same! Can share
['my-team']                    // Invalidated after transfer/deactivate

// After mutations, need to invalidate:
['my-team']                    // Team members list
['member-profile', userId]     // If on profile page
```

### Existing Utility: query-utils.ts

```typescript
// frontend/src/lib/query-utils.ts
invalidateRelatedQueries(queryClient, 'teams')
// Invalidates: ['teams'], ['team'], ['my-team'], ['team-members']
```

**Consider using this in useMemberMutations hook** instead of manual invalidation.

### Pages That Use ['my-team'] Query

These pages will benefit from cache when user navigates between them:

| Page | Purpose |
|------|---------|
| `team-members.page.tsx` | Member list |
| `team-overview.page.tsx` | Dashboard overview |
| `team-summary.page.tsx` | Weekly summary |
| `team-incidents.page.tsx` | Team incidents |
| `team-member-history.page.tsx` | Check-in history |
| `ai-insights-*.page.tsx` | AI insights pages |
| `member-profile.page.tsx` | Invalidates after mutations |

### Logic to Preserve (from team-members.page.tsx)

1. **Click Outside Handler** (line 301-305)
   ```typescript
   useEffect(() => {
     const handleClickOutside = () => setOpenDropdownId(null);
     document.addEventListener('click', handleClickOutside);
     return () => document.removeEventListener('click', handleClickOutside);
   }, []);
   ```

2. **Filtered & Sorted Members** (line 355-372)
   - Filter by search (firstName, lastName, email)
   - Sort by ROLE_HIERARCHY (higher roles first)
   - Then alphabetically by name

3. **Lazy Load Transfer Teams** (line 312-316)
   ```typescript
   enabled: showTransferModal  // Only fetch when modal opens
   ```

4. **Other Teams Filter** (line 349-352)
   - Exclude current team from transfer options

---

## Existing UI Components to Reuse

**IMPORTANT: Use these existing components - DO NOT create duplicates!**

| Component | Path | Usage in Refactor |
|-----------|------|-------------------|
| `Button` | `@/components/ui/Button` | All buttons |
| `Avatar` | `@/components/ui/Avatar` | Member avatars (has status prop!) |
| `Badge` | `@/components/ui/Badge` | Role badges, status badges |
| `LoadingSpinner` | `@/components/ui/LoadingSpinner` | Loading states |
| `ConfirmModal` | `@/components/ui/ConfirmModal` | Deactivate confirmation |
| `EmptyState` | `@/components/ui/EmptyState` | No members state |
| `NoSearchResults` | `@/components/ui/EmptyState` | No search results |
| `Card` | `@/components/ui/Card` | Card wrappers if needed |
| `Input` | `@/components/ui/Input` | Search input (or custom) |

### EmptyState Usage Example
```typescript
import { EmptyState, NoSearchResults } from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';

// No members
<EmptyState
  icon={Users}
  title="No Team Assigned"
  description="Contact your administrator"
/>

// No search results
<NoSearchResults
  searchTerm={searchQuery}
  onClear={() => setSearchQuery('')}
/>
```

### Avatar with Status
```typescript
<Avatar
  src={member.avatar}
  firstName={member.firstName}
  lastName={member.lastName}
  size="md"
  status={member.isActive ? 'online' : 'offline'}  // Built-in!
/>
```

---

## Additional Details (Previously Missing)

### Lucide Icons Used
```typescript
import {
  Users,          // Empty state, header
  Search,         // Search bar
  MoreVertical,   // Dropdown trigger
  Eye,            // View profile action
  UserMinus,      // Deactivate action
  ArrowRightLeft, // Transfer action
  Loader2,        // Loading spinner in buttons
  ChevronDown,    // Select dropdown
  X,              // Close modal
  CheckCircle,    // Status indicator
  Mail,           // Email icon
  Shield,         // Team badge in header
} from 'lucide-react';
```

### useToast Hook
```typescript
import { useToast } from '@/components/ui/Toast';

const toast = useToast();
toast.success('Member transferred successfully');
toast.error('Failed to transfer member');
```

### Shared Props Interface
```typescript
// Used by BOTH MemberCard and MemberRow
interface MemberItemProps {
  member: TeamMemberWithStats;
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer: (member: TeamMemberWithStats) => void;
  onDeactivate: (member: TeamMemberWithStats) => void;
}
```

### Responsive Breakpoints
```
Mobile:  < md (768px)  → Card view, bottom sheet modal
Desktop: >= md         → Table view, centered modal
```

### Transfer Modal - Mobile Optimization
The transfer modal uses **bottom sheet pattern** on mobile:
```typescript
// Mobile: slides from bottom, full width
// Desktop: centered modal with max-width

<div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
  {/* Mobile drag handle */}
  <div className="sm:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />
  ...
</div>
```

### Two Different Empty States
1. **No Team Assigned** (error state) - when `!team`
2. **No Members Found** (search state) - when `filteredMembers.length === 0`

---

## Target State

### New Folder Structure
```
frontend/src/pages/team-leader/team-members/
├── index.tsx                          # Re-export for router
├── TeamMembersPage.tsx                # Main orchestrator (~150 lines)
├── components/
│   ├── MemberCard.tsx                 # Mobile card component
│   ├── MemberRow.tsx                  # Desktop table row
│   ├── MemberTable.tsx                # Table wrapper with header
│   ├── MemberGrid.tsx                 # Mobile grid wrapper
│   ├── MemberSearchBar.tsx            # Search input component
│   ├── MemberActionMenu.tsx           # Dropdown action menu (uses existing UI)
│   └── TransferMemberModal.tsx        # Transfer modal component
├── hooks/
│   ├── index.ts                       # Re-export hooks
│   ├── useTeamMembers.ts              # Main data fetching hook
│   ├── useMemberMutations.ts          # Transfer/Deactivate/Reactivate mutations
│   └── useTransferTeams.ts            # Lazy load teams for transfer modal
├── types/
│   └── index.ts                       # Local type definitions
└── utils/
    └── member-helpers.ts              # Role styles, sorting, filtering

# NOTE: No MemberEmptyState.tsx - use existing EmptyState/NoSearchResults from @/components/ui/EmptyState
```

---

## Component Breakdown

### 1. TeamMembersPage.tsx (Main Orchestrator)
```typescript
// Responsibilities:
// - URL params handling (teamId from route or default to my-team)
// - State management (search, modals, selected member)
// - Render layout and compose components
// - Handle callbacks from child components

interface TeamMembersPageProps {
  teamId?: string;           // Optional: for Executive/Supervisor viewing other teams
  mode?: 'full' | 'readonly'; // Optional: limit actions for certain roles
}
```

### 2. MemberCard.tsx (Mobile)
```typescript
// Extracted from current MemberCard memo component
// Props:
interface MemberCardProps {
  member: TeamMemberWithStats;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;    // Optional for readonly
  onDeactivate?: (member: TeamMemberWithStats) => void;  // Optional for readonly
  showActions?: boolean;  // Default true
}
```

### 3. MemberRow.tsx (Desktop)
```typescript
// Extracted from current MemberRow memo component
// Same props as MemberCard for consistency
interface MemberRowProps {
  member: TeamMemberWithStats;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
  showActions?: boolean;
}
```

### 4. MemberTable.tsx
```typescript
// Wraps MemberRow with table header
interface MemberTableProps {
  members: TeamMemberWithStats[];
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
  showActions?: boolean;
}
```

### 5. MemberGrid.tsx
```typescript
// Wraps MemberCard for mobile grid
interface MemberGridProps {
  members: TeamMemberWithStats[];
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
  showActions?: boolean;
}
```

### 6. MemberSearchBar.tsx
```typescript
interface MemberSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

### 7. MemberActionMenu.tsx
```typescript
// Dropdown menu with View Profile, Transfer, Deactivate
interface MemberActionMenuProps {
  member: TeamMemberWithStats;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  onViewProfile: () => void;
  onTransfer?: () => void;
  onDeactivate?: () => void;
}
```

### 8. TransferMemberModal.tsx
```typescript
// Extracted transfer modal
interface TransferMemberModalProps {
  member: TeamMemberWithStats;
  currentTeamId: string;
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (targetTeamId: string) => void;
  isLoading: boolean;
}
```

---

## Hooks Breakdown

### 1. useTeamMembers.ts
```typescript
interface UseTeamMembersOptions {
  teamId?: string;        // If provided, fetch specific team; else fetch my-team
  enabled?: boolean;      // Control when to fetch
}

interface UseTeamMembersReturn {
  team: TeamDetails | undefined;
  members: TeamMemberWithStats[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTeamMembers(options?: UseTeamMembersOptions): UseTeamMembersReturn {
  const { teamId, enabled = true } = options || {};

  return useQuery({
    queryKey: teamId ? ['team', teamId] : ['my-team'],
    queryFn: () => teamId
      ? teamService.getById(teamId)
      : teamService.getMyTeam(),
    enabled,
  });
}
```

### 2. useMemberMutations.ts
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { invalidateRelatedQueries } from '@/lib/query-utils';

interface UseMemberMutationsOptions {
  // Callbacks for UI state management
  onTransferSuccess?: () => void;
  onTransferError?: (error: Error) => void;
  onDeactivateSuccess?: () => void;
  onDeactivateError?: (error: Error) => void;
  onReactivateSuccess?: () => void;  // For member-profile page
  onReactivateError?: (error: Error) => void;
}

export function useMemberMutations(options?: UseMemberMutationsOptions) {
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      userService.update(userId, { teamId }),
    onSuccess: () => {
      // Use utility for comprehensive invalidation
      invalidateRelatedQueries(queryClient, 'teams');
      queryClient.invalidateQueries({ queryKey: ['all-teams-for-transfer'] });
      options?.onTransferSuccess?.();
    },
    onError: (error) => options?.onTransferError?.(error as Error),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => userService.deactivate(userId),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'teams');
      options?.onDeactivateSuccess?.();
    },
    onError: (error) => options?.onDeactivateError?.(error as Error),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => userService.reactivate(userId),
    onSuccess: () => {
      invalidateRelatedQueries(queryClient, 'teams');
      options?.onReactivateSuccess?.();
    },
    onError: (error) => options?.onReactivateError?.(error as Error),
  });

  return {
    transferMutation,
    deactivateMutation,
    reactivateMutation,
    isLoading: transferMutation.isPending || deactivateMutation.isPending || reactivateMutation.isPending,
  };
}
```

### 3. useTransferTeams.ts (New - for lazy loading)
```typescript
import { useQuery } from '@tanstack/react-query';
import { teamService, type TeamWithStats } from '@/services/team.service';

interface UseTransferTeamsOptions {
  enabled: boolean;           // Only fetch when modal opens
  excludeTeamId?: string;     // Exclude current team
}

export function useTransferTeams({ enabled, excludeTeamId }: UseTransferTeamsOptions) {
  const { data, isLoading } = useQuery({
    queryKey: ['all-teams-for-transfer'],
    queryFn: () => teamService.getAll({ forTransfer: true }),
    enabled,
  });

  const teams: TeamWithStats[] = data?.data || [];
  const filteredTeams = excludeTeamId
    ? teams.filter((t) => t.id !== excludeTeamId)
    : teams;

  return {
    teams: filteredTeams,
    isLoading,
  };
}
```

---

## Utils Breakdown

### member-helpers.ts
```typescript
// Constants
export const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 5,
  EXECUTIVE: 4,
  SUPERVISOR: 3,
  TEAM_LEAD: 2,
  WORKER: 1,
};

export const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-700',
  EXECUTIVE: 'bg-blue-50 text-blue-700',
  SUPERVISOR: 'bg-indigo-50 text-indigo-700',
  TEAM_LEAD: 'bg-cyan-50 text-cyan-700',
  WORKER: 'bg-gray-50 text-gray-600',
};

// Helpers
export function getRoleDisplay(role: string | undefined): string;
export function getRoleStyle(role: string | undefined): string;
export function filterMembers(members: TeamMemberWithStats[], search: string): TeamMemberWithStats[];
export function sortMembersByRole(members: TeamMemberWithStats[]): TeamMemberWithStats[];
```

---

## Types Breakdown

### types/index.ts
```typescript
// Re-export from team.service for convenience
export type { TeamMemberWithStats, TeamDetails, TeamWithStats } from '@/services/team.service';

// Shared props for MemberCard and MemberRow
export interface MemberItemProps {
  member: TeamMemberWithStats;
  isMenuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;   // Optional for readonly
  onDeactivate?: (member: TeamMemberWithStats) => void; // Optional for readonly
  showActions?: boolean; // Hide actions entirely
}

// Page-level configuration
export interface TeamMembersPageConfig {
  teamId?: string;        // View specific team (for other roles)
  showActions?: boolean;
  canTransfer?: boolean;
  canDeactivate?: boolean;
  mode?: 'full' | 'readonly';
}

// Action callbacks (for hooks)
export interface MemberActionCallbacks {
  onViewProfile: (member: TeamMemberWithStats) => void;
  onTransfer?: (member: TeamMemberWithStats) => void;
  onDeactivate?: (member: TeamMemberWithStats) => void;
}
```

---

## Data Flow (After Refactor)

```
TeamMembersPage
    │
    ├── useTeamMembers(teamId?)
    │       └── Returns: { team, members, isLoading, error }
    │
    ├── useMemberMutations()
    │       └── Returns: { transferMutation, deactivateMutation }
    │
    ├── Local State
    │       ├── searchQuery
    │       ├── openDropdownId
    │       ├── showTransferModal
    │       ├── showDeactivateModal
    │       └── memberToAction
    │
    └── Renders:
            ├── Header (team name, member count)
            ├── MemberSearchBar
            ├── MemberGrid (mobile) OR MemberTable (desktop)
            │       └── MemberCard/MemberRow
            │               └── MemberActionMenu
            ├── TransferMemberModal
            └── ConfirmModal (deactivate)
```

---

## Migration Steps

### Phase 1: Create Folder Structure
1. Create `frontend/src/pages/team-leader/team-members/` folder
2. Create subfolders: `components/`, `hooks/`, `types/`, `utils/`
3. Create `index.tsx` with re-export

### Phase 2: Extract Utils & Types
1. Move constants (ROLE_HIERARCHY, ROLE_STYLES) to `utils/member-helpers.ts`
2. Move helper functions to `utils/member-helpers.ts`
3. Create `types/index.ts` with local types

### Phase 3: Extract Hooks
1. Create `hooks/useTeamMembers.ts`
2. Create `hooks/useMemberMutations.ts`
3. Create `hooks/index.ts` re-export

### Phase 4: Extract Components
1. Extract `MemberCard.tsx` (keep memo)
2. Extract `MemberRow.tsx` (keep memo)
3. Create `MemberTable.tsx` wrapper
4. Create `MemberGrid.tsx` wrapper
5. Extract `MemberSearchBar.tsx`
6. Create `MemberEmptyState.tsx`
7. Extract `MemberActionMenu.tsx`
8. Extract `TransferMemberModal.tsx`

### Phase 5: Create Main Page
1. Create `TeamMembersPage.tsx` orchestrator
2. Import all components and hooks
3. Wire up state and callbacks

### Phase 6: Update Router & Cleanup
1. Update `router.tsx` import path
2. Delete old `team-members.page.tsx`
3. Test all functionality

### Phase 7: Refactor member-profile.page.tsx (Optional but Recommended)
1. Import shared `TransferMemberModal` from team-members/components
2. Import shared `useMemberMutations` hook
3. Remove duplicate modal JSX (~60 lines saved)
4. Remove duplicate mutation code (~40 lines saved)
5. Test transfer/deactivate still works from profile page

---

## Reusability Examples

### Example 1: Executive Viewing Any Team
```typescript
// frontend/src/pages/executive/team-details.page.tsx
import { TeamMembersPage } from '../team-leader/team-members';

export function ExecutiveTeamDetailsPage() {
  const { teamId } = useParams();

  return (
    <TeamMembersPage
      teamId={teamId}
      mode="readonly"  // No transfer/deactivate actions
    />
  );
}
```

### Example 2: Supervisor with Limited Actions
```typescript
// frontend/src/pages/supervisor/team-members.page.tsx
import { TeamMembersPage } from '../team-leader/team-members';

export function SupervisorTeamMembersPage() {
  return (
    <TeamMembersPage
      canDeactivate={false}  // Can transfer but not deactivate
    />
  );
}
```

### Example 3: Using Individual Components
```typescript
// Some other page that needs member cards
import { MemberCard } from '../team-leader/team-members/components/MemberCard';
import { useTeamMembers } from '../team-leader/team-members/hooks';

export function SomePage() {
  const { members } = useTeamMembers();

  return (
    <div>
      {members.slice(0, 5).map(member => (
        <MemberCard
          key={member.id}
          member={member}
          onViewProfile={() => {}}
          showActions={false}
        />
      ))}
    </div>
  );
}
```

---

## Testing Checklist

### Team Members Page (`/team/members`)

- [ ] Page loads correctly (loading state shows)
- [ ] Team name and member count display
- [ ] Search filters members correctly
- [ ] Mobile card view renders
- [ ] Desktop table view renders
- [ ] Dropdown menu opens/closes
- [ ] View Profile navigates to `/team/members/:id`
- [ ] Transfer modal opens with member info
- [ ] Transfer modal loads other teams
- [ ] Transfer executes successfully
- [ ] Deactivate modal opens
- [ ] Deactivate executes successfully
- [ ] Empty state shows when no members
- [ ] Empty state shows when search has no results
- [ ] Click outside closes dropdown
- [ ] All toasts show correctly
- [ ] Query invalidation works after mutations

### Navigation From Other Pages

- [ ] From team-overview: click member → navigates to profile
- [ ] From team-analytics: click "needs attention" member → navigates to profile

### Member Profile Page (`/team/members/:id`) - After Phase 7

- [ ] Back button navigates to `/team/members`
- [ ] Transfer modal works (uses shared component)
- [ ] Deactivate modal works
- [ ] Reactivate modal works
- [ ] After transfer → redirects to `/team/members`
- [ ] Query invalidation updates both profile and list

---

## Files to Create (Summary)

| File | Lines (est.) | Purpose |
|------|--------------|---------|
| `index.tsx` | 5 | Re-export |
| `TeamMembersPage.tsx` | 150 | Main orchestrator |
| `components/MemberCard.tsx` | 80 | Mobile card |
| `components/MemberRow.tsx` | 70 | Table row |
| `components/MemberTable.tsx` | 40 | Table wrapper |
| `components/MemberGrid.tsx` | 25 | Grid wrapper |
| `components/MemberSearchBar.tsx` | 25 | Search input |
| `components/MemberActionMenu.tsx` | 60 | Dropdown menu |
| `components/TransferMemberModal.tsx` | 90 | Transfer modal |
| `hooks/index.ts` | 5 | Re-export |
| `hooks/useTeamMembers.ts` | 30 | Data fetching |
| `hooks/useMemberMutations.ts` | 60 | Transfer/Deactivate/Reactivate mutations |
| `hooks/useTransferTeams.ts` | 25 | Lazy load teams for transfer modal |
| `types/index.ts` | 20 | Type definitions |
| `utils/member-helpers.ts` | 40 | Helpers & constants |

**Total: ~680 lines across 15 files** (vs 588 lines in 1 file)

Note: Slightly more total lines due to imports/exports overhead, but much more maintainable and reusable.

**UI Components Reused (NOT counted above):**
- `EmptyState` / `NoSearchResults` - from `@/components/ui/EmptyState`
- `ConfirmModal` - from `@/components/ui/ConfirmModal`
- `Button`, `Avatar`, `Badge`, `LoadingSpinner` - from `@/components/ui/*`

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: Folder Structure | 5 min |
| Phase 2: Utils & Types | 15 min |
| Phase 3: Hooks | 20 min |
| Phase 4: Components | 45 min |
| Phase 5: Main Page | 20 min |
| Phase 6: Router & Cleanup | 10 min |
| Phase 7: Refactor member-profile (optional) | 20 min |
| Testing | 20 min |
| **Total** | **~2.5 hours** (with Phase 7) |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Keep pagination for later | Current getMyTeam() works, add pagination when needed |
| Memo on Card/Row components | Already optimized, keep it |
| Separate MemberTable/MemberGrid | Clear separation of mobile/desktop concerns |
| Action callbacks optional | Enables readonly mode for other roles |
| teamId as optional param | Default to my-team, but allow override |
| Share TransferModal with member-profile | Avoid duplicate code, single source of truth |
| useMemberMutations handles all mutations | Centralized query invalidation logic |
| Keep components in team-members folder | Primary owner, others import from here |
| Phase 7 optional but recommended | Immediate benefit if time permits |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing navigation | Test all navigation paths in checklist |
| Query cache issues | Verify query keys match exactly |
| Import path errors after move | Use absolute imports with `@/` alias |
| Mobile/desktop regressions | Test on both viewport sizes |
| Transfer modal state sync | Use same mutation hook in both pages |
