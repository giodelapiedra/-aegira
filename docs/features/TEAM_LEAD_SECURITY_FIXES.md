# Team Lead Security Fixes

> **Date:** 2024  
> **Issue:** Team leads were able to access and modify data from other teams  
> **Status:** ✅ Fixed

---

## Overview

During security review, we discovered that team leads had access to company-wide data instead of being restricted to only their own team's data. This document outlines all the security fixes implemented to ensure proper data isolation for team leads.

---

## Security Issues Found

### Problem
Team leads were able to:
- View data from other teams (check-ins, incidents, exceptions, users)
- Modify data from other teams (update incidents, approve exceptions)
- Access company-wide analytics instead of team-specific analytics

### Impact
- **Privacy Violation**: Team leads could see sensitive data from other teams
- **Data Leakage**: Unauthorized access to company-wide information
- **Compliance Risk**: Violation of data access controls

---

## Fixes Implemented

### 1. Analytics Module (`backend/src/modules/analytics/index.ts`)

#### Issue
Team leads could see company-wide analytics instead of only their team's data.

#### Endpoints Fixed

**GET `/analytics/dashboard`**
- **Before:** Team leads saw ALL teams' summaries in the company
- **After:** Team leads see only their team's summary
- **Fix:** Added team lead check and filter by `teamId`
- **Code:**
```typescript
// TEAM_LEAD: Only see their own team's data
let teamIdFilter: string | undefined;
if (isTeamLead) {
  const team = await prisma.team.findFirst({
    where: { leaderId: userId, companyId, isActive: true },
    select: { id: true },
  });
  if (!team) {
    return c.json({ error: 'You are not assigned to lead any team' }, 403);
  }
  teamIdFilter = team.id;
}

// Filter summaries by teamId
if (isTeamLead && teamIdFilter) {
  where.teamId = teamIdFilter;
  where.companyId = companyId;
}
```

**GET `/analytics/recent-checkins`**
- **Before:** Team leads saw ALL check-ins in the company
- **After:** Team leads see only their team's check-ins
- **Fix:** Added `where.user.teamId = teamIdFilter` filter

**GET `/analytics/readiness`**
- **Before:** Team leads saw ALL readiness data in the company
- **After:** Team leads see only their team's readiness data
- **Fix:** Added `where.user.teamId = teamIdFilter` filter

**GET `/analytics/trends`**
- **Before:** Team leads saw ALL trends in the company
- **After:** Team leads see only their team's trends
- **Fix:** Added team filtering for both check-ins and incidents

**GET `/analytics/export`**
- **Before:** Team leads could export ALL company data
- **After:** Team leads can only export their team's data
- **Fix:** Added `where.user.teamId = teamIdFilter` filter

**Reason:** Analytics endpoints aggregate data across teams. Without filtering, team leads could see performance metrics, check-in rates, and trends from other teams, which violates data privacy and access control principles.

---

### 2. Checkins Module (`backend/src/modules/checkins/index.ts`)

#### Issue
Team leads could view check-ins from other teams by ID.

#### Endpoints Fixed

**GET `/checkins/:id`**
- **Before:** Team leads could access any check-in if they knew the ID
- **After:** Team leads can only access check-ins from their team members
- **Fix:** Added team lead authorization check after fetching check-in
- **Code:**
```typescript
// TEAM_LEAD: Can only view check-ins from their own team members
if (isTeamLead && checkin.user.teamId) {
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: userId, companyId, isActive: true },
    select: { id: true },
  });

  if (!leaderTeam || checkin.user.teamId !== leaderTeam.id) {
    return c.json({ error: 'You can only view check-ins from your own team members' }, 403);
  }
}
```

**Reason:** Direct ID access bypasses list filtering. A team lead could guess or discover check-in IDs from other teams and view sensitive wellness data (mood, stress, sleep, physical health) that should be private.

---

### 3. Incidents Module (`backend/src/modules/incidents/index.ts`)

#### Issue
Team leads could view, update, assign, and comment on incidents from other teams.

#### Endpoints Fixed

**GET `/incidents/:id`**
- **Before:** Team leads could view any incident by ID
- **After:** Team leads can only view incidents from their own team
- **Fix:** Added team lead check: `incident.teamId === leaderTeam.id`

**PUT `/incidents/:id`**
- **Before:** Team leads could update ANY incident in the company
- **After:** Team leads can only update incidents from their own team
- **Fix:** Added team lead authorization check before update
- **Code:**
```typescript
// TEAM_LEAD: Can only update incidents from their own team
if (isTeamLead && existing.teamId) {
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: userId, companyId, isActive: true },
    select: { id: true },
  });

  if (!leaderTeam || existing.teamId !== leaderTeam.id) {
    return c.json({ error: 'You can only update incidents from your own team' }, 403);
  }
}
```

**PATCH `/incidents/:id/status`**
- **Before:** NO authorization check - anyone could change status
- **After:** Team leads can only change status of their team's incidents
- **Fix:** Added authorization check (reporter, assignee, or team lead of incident's team)

**PATCH `/incidents/:id/assign`**
- **Before:** NO authorization check - anyone could assign incidents
- **After:** Team leads can only assign incidents from their own team
- **Fix:** Added authorization check

**GET `/incidents/:id/activities`**
- **Before:** Team leads could see activities from any incident
- **After:** Team leads can only see activities from their team's incidents
- **Fix:** Added team lead check before returning activities

**POST `/incidents/:id/comments`**
- **Before:** Team leads could comment on any incident
- **After:** Team leads can only comment on incidents from their own team
- **Fix:** Added team lead check before creating comment

**Reason:** Incidents contain sensitive safety and health information. Team leads should only manage incidents reported by their own team members, not interfere with other teams' incident management.

---

### 4. Exceptions Module (`backend/src/modules/exceptions/index.ts`)

#### Issue
Team leads could view, update, approve, reject, and delete exceptions from other teams.

#### Endpoints Fixed

**GET `/exceptions`**
- **Before:** Team leads saw ALL exceptions in the company
- **After:** Team leads see only exceptions from their team members
- **Fix:** Added `where.user = { teamId: teamIdFilter }` filter

**GET `/exceptions/:id`**
- **Before:** Team leads could view any exception by ID
- **After:** Team leads can only view exceptions from their team members
- **Fix:** Added check: `exception.user.team?.leaderId === currentUserId`

**PUT `/exceptions/:id`**
- **Before:** Team leads could update ANY exception
- **After:** Team leads can only update exceptions from their team members
- **Fix:** Added team lead authorization check

**PATCH `/exceptions/:id/approve`**
- **Before:** Team leads could approve exceptions from ANY team
- **After:** Team leads can only approve exceptions from their team members
- **Fix:** Added check: `existing.user.team?.leaderId !== reviewerId`
- **Code:**
```typescript
// TEAM_LEAD: Can only approve exceptions from their own team members
const isTeamLead = currentUser?.role === 'TEAM_LEAD';
if (isTeamLead && existing.user.team?.leaderId !== reviewerId) {
  return c.json({ error: 'You can only approve exceptions from your own team members' }, 403);
}
```

**PATCH `/exceptions/:id/reject`**
- **Before:** Team leads could reject exceptions from ANY team
- **After:** Team leads can only reject exceptions from their team members
- **Fix:** Added team lead authorization check

**PATCH `/exceptions/:id/end-early`**
- **Before:** Team leads could end exceptions from ANY team
- **After:** Team leads can only end exceptions from their team members
- **Fix:** Added team lead authorization check

**DELETE `/exceptions/:id`**
- **Before:** Team leads could delete exceptions from ANY team
- **After:** Team leads can only delete exceptions from their team members
- **Fix:** Added team lead authorization check

**Reason:** Exceptions represent leave requests and exemptions. Team leads should only approve/reject leave requests from their own team members, not from other teams. This ensures proper workflow and prevents unauthorized leave approvals.

---

### 5. Users Module (`backend/src/modules/users/index.ts`)

#### Issue
Team leads could view all users in the company, not just their team members.

#### Endpoints Fixed

**GET `/users`**
- **Before:** Team leads saw ALL users in the company
- **After:** Team leads see only users from their team
- **Fix:** Force `teamId` filter for team leads
- **Code:**
```typescript
// TEAM_LEAD: Can only see users from their own team
if (isTeamLead) {
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: userId, companyId, isActive: true },
    select: { id: true },
  });

  if (!leaderTeam) {
    return c.json({ error: 'You are not assigned to lead any team' }, 403);
  }

  // Force teamId to their team (even if not provided)
  teamId = leaderTeam.id;
}
```

**GET `/users/:id`**
- **Before:** Team leads could view any user by ID
- **After:** Team leads can only view users from their team
- **Fix:** Added team lead check after fetching user

**Reason:** User profiles contain personal information (email, phone, role, team assignment). Team leads should only see information about their own team members, not access other teams' member lists or profiles.

---

## Security Pattern Applied

### Consistent Authorization Pattern

All fixes follow this pattern:

1. **Detect Team Lead Role**
```typescript
const isTeamLead = user.role?.toUpperCase() === 'TEAM_LEAD';
```

2. **Get Leader's Team**
```typescript
if (isTeamLead) {
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: userId, companyId, isActive: true },
    select: { id: true },
  });
  
  if (!leaderTeam) {
    return c.json({ error: 'You are not assigned to lead any team' }, 403);
  }
  teamIdFilter = leaderTeam.id;
}
```

3. **Apply Filter**
```typescript
// For list endpoints
if (isTeamLead && teamIdFilter) {
  where.teamId = teamIdFilter;
  // OR
  where.user.teamId = teamIdFilter;
}

// For get-by-ID endpoints
if (isTeamLead && resource.teamId !== leaderTeam.id) {
  return c.json({ error: 'Access denied' }, 403);
}
```

---

## Endpoints Already Secure

These endpoints already had proper team lead filtering:

✅ **GET `/teams/:id`** - Already checks `team.leaderId === currentUserId`  
✅ **GET `/teams/:id/stats`** - Already checks team ownership  
✅ **GET `/teams/:id/summary`** - Already checks team ownership  
✅ **GET `/teams/members/:userId/profile`** - Already checks team membership  
✅ **GET `/teams/members/:userId/checkins`** - Already checks team membership  
✅ **GET `/teams/members/:userId/exemptions`** - Already checks team membership  
✅ **GET `/teams/members/:userId/incidents`** - Already checks team membership  
✅ **GET `/teams/members/:userId/absences`** - Already checks team membership  
✅ **GET `/teams/members/:userId/analytics`** - Already checks team membership  
✅ **GET `/exceptions/pending`** - Already filters by `user.teamId`  
✅ **GET `/exemptions`** - Already filters by `user.teamId`  
✅ **GET `/exemptions/active`** - Already filters by `user.teamId`  
✅ **GET `/exemptions/:id`** - Already checks team ownership  
✅ **GET `/absences/:id`** - Already checks team ownership  
✅ **GET `/incidents`** - Already filters by `teamId`  
✅ **GET `/checkins`** - Already filters by `teamId`  
✅ **GET `/daily-monitoring`** - Uses `getTeamForUser` helper (secure)

---

## Access Restricted Endpoints

These endpoints are intentionally restricted to higher roles:

🔒 **GET `/analytics/teams-overview`** - EXECUTIVE/SUPERVISOR only (403 for team leads)  
🔒 **GET `/system-logs`** - ADMIN/EXECUTIVE/SUPERVISOR only (403 for team leads)

---

## No Filtering Needed

These endpoints don't need team filtering:

✅ **GET `/holidays`** - Company-wide (everyone sees the same holidays)  
✅ **GET `/notifications`** - User-specific (each user sees their own)  
✅ **GET `/calendar`** - User-specific calendar view

---

## Testing Recommendations

### Manual Testing Checklist

- [ ] Team lead can view their team's analytics dashboard
- [ ] Team lead CANNOT view other teams' analytics
- [ ] Team lead can view their team's check-ins
- [ ] Team lead CANNOT view other teams' check-ins by ID
- [ ] Team lead can view their team's incidents
- [ ] Team lead CANNOT view/update other teams' incidents
- [ ] Team lead can approve exceptions from their team
- [ ] Team lead CANNOT approve exceptions from other teams
- [ ] Team lead can view their team's users
- [ ] Team lead CANNOT view other teams' users
- [ ] Team lead gets 403 when accessing restricted endpoints

### Test Cases

**Test 1: Team Lead Accessing Other Team's Data**
```
1. Login as Team Lead A
2. Try to access Team B's incident: GET /incidents/{teamB_incident_id}
3. Expected: 403 Forbidden
```

**Test 2: Team Lead Viewing Company Analytics**
```
1. Login as Team Lead
2. GET /analytics/dashboard
3. Expected: Only shows Team Lead's team data, not all teams
```

**Test 3: Team Lead Approving Other Team's Exception**
```
1. Login as Team Lead A
2. Try to approve Team B's exception: PATCH /exceptions/{teamB_exception_id}/approve
3. Expected: 403 Forbidden
```

---

## Summary

### Total Endpoints Fixed: **10**

- **GET endpoints:** 7 fixed
- **PUT/PATCH endpoints:** 3 fixed
- **POST endpoints:** 1 fixed

### Security Improvements

1. ✅ **Data Isolation**: Team leads can only access their team's data
2. ✅ **Authorization**: Proper checks on all modify operations
3. ✅ **Consistency**: Same security pattern across all modules
4. ✅ **Privacy**: Sensitive data protected from unauthorized access

---

## Related Documents

- `docs/TIMEZONE_OPTIMIZATION.md` - Timezone handling improvements
- `docs/PERFORMANCE_OPTIMIZATION_QUERIES.md` - Query performance optimizations
- `docs/MEMBER_PROFILE_OPTIMIZATION.md` - Member profile page optimizations

---

*Last Updated: 2024*

