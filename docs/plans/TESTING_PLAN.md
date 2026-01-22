# Aegira Testing Plan

## Overview

This document outlines the comprehensive testing strategy for the Aegira Workplace Health & Safety system.

---

## 1. Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **E2E Tests** | Playwright | Full user flow testing |
| **API Tests** | Vitest + Supertest | Backend endpoint testing |
| **Component Tests** | Vitest + React Testing Library | UI component testing |
| **Visual Regression** | Playwright Screenshots | Catch UI changes |

### Why Playwright for E2E?

- Fast execution (parallel tests)
- Multi-browser support (Chrome, Firefox, Safari)
- Auto-wait for elements (less flaky tests)
- Built-in screenshots/videos on failure
- Great TypeScript support
- Free and open source

---

## 2. Test Categories by Priority

### Priority 1: Critical Paths (Must Have)

These are core business flows that must always work:

| Flow | Role | Description |
|------|------|-------------|
| Authentication | All | Login, logout, session refresh |
| Daily Check-in | Worker | Complete check-in flow |
| Low Score → Auto-Exemption | Worker/TL | RED status triggers exemption request |
| Exception Request | Worker | Submit leave/exception request |
| Exception Approval | Team Lead | Approve/reject requests |
| Incident Report | Worker | Report new incident |
| Incident Assignment | Supervisor | Assign incident to WHS |
| WHS Case Handling | WHS | Update status, RTW certificate |

### Priority 2: Important Flows (Should Have)

| Flow | Role | Description |
|------|------|-------------|
| Worker Home Dashboard | Worker | Weekly stats, calendar, tips |
| Worker History | Worker | View check-in history |
| Team Daily Monitoring | Team Lead | All tabs: Check-ins, Changes, Exemptions, Absences |
| Team Members Management | Team Lead | View member list, profiles |
| Team Analytics | Team Lead | Charts, trends, member analytics |
| AI Chat & Insights | Team Lead | Chat with AI, view generated insights |
| Supervisor Dashboard | Supervisor | Multi-team overview |
| Personnel Management | Supervisor | Filter, search all personnel |
| WHS My Incidents | WHS | View assigned cases, fill forms |
| Notifications | All | View, mark read, archive |

### Priority 3: Secondary Flows (Nice to Have)

| Flow | Role | Description |
|------|------|-------------|
| Profile Update | All | Edit profile settings |
| Worker Calendar | Worker | View personal schedule |
| Team Calendar | Team Lead | View team schedule |
| Team Weekly Summary | Team Lead | Summary table view |
| Executive Dashboard | Executive | Company overview |
| User Management | Executive | Create/edit/deactivate users |
| Team Management | Executive | Create/edit teams |
| Company Settings | Executive | Timezone, company info |
| Teams Overview | Executive | All teams with grades |
| PDF Templates | Admin | Manage templates |
| Template Builder | Admin | Create PDF templates |
| System Logs | Admin | View audit trail |
| Print Preview | All | Print incident case report |
| Error Pages | All | 404, 403, error boundary |

---

## 3. Test Structure

```
tests/
├── e2e/                          # Playwright E2E tests
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   ├── register.spec.ts
│   │   └── session.spec.ts
│   ├── worker/
│   │   ├── home.spec.ts              # Home dashboard
│   │   ├── checkin.spec.ts           # Check-in flow
│   │   ├── low-score-flow.spec.ts    # RED → auto-exemption
│   │   ├── report-incident.spec.ts
│   │   ├── my-incidents.spec.ts
│   │   ├── request-exception.spec.ts
│   │   ├── my-history.spec.ts
│   │   └── calendar.spec.ts
│   ├── team-lead/
│   │   ├── team-overview.spec.ts
│   │   ├── daily-monitoring.spec.ts  # All 5 tabs
│   │   ├── approvals.spec.ts
│   │   ├── team-members.spec.ts      # List + profiles
│   │   ├── member-history.spec.ts
│   │   ├── team-analytics.spec.ts
│   │   ├── team-summary.spec.ts      # Weekly table
│   │   ├── team-calendar.spec.ts
│   │   ├── team-incidents.spec.ts
│   │   ├── ai-chat.spec.ts
│   │   ├── ai-insights.spec.ts
│   │   └── ai-insights-detail.spec.ts
│   ├── supervisor/
│   │   ├── dashboard.spec.ts
│   │   ├── personnel.spec.ts
│   │   ├── analytics.spec.ts
│   │   └── incident-assignment.spec.ts
│   ├── whs/
│   │   ├── dashboard.spec.ts
│   │   ├── my-incidents.spec.ts
│   │   ├── case-management.spec.ts
│   │   ├── fill-forms.spec.ts        # Template selection
│   │   └── visual-fill.spec.ts       # PDF fill UI
│   ├── executive/
│   │   ├── dashboard.spec.ts
│   │   ├── teams-overview.spec.ts    # All teams with grades
│   │   ├── teams.spec.ts             # Team management
│   │   ├── users.spec.ts             # User list
│   │   ├── create-account.spec.ts
│   │   ├── company-settings.spec.ts
│   │   └── calendar.spec.ts
│   ├── admin/
│   │   ├── dashboard.spec.ts
│   │   ├── templates.spec.ts
│   │   ├── template-builder.spec.ts
│   │   └── system-logs.spec.ts
│   ├── shared/
│   │   ├── notifications.spec.ts
│   │   ├── profile.spec.ts
│   │   ├── incident-detail.spec.ts
│   │   └── incident-print.spec.ts
│   └── error/
│       ├── not-found.spec.ts
│       ├── forbidden.spec.ts
│       └── error-boundary.spec.ts
├── api/                          # API integration tests
│   ├── auth.test.ts
│   ├── checkins.test.ts
│   ├── exceptions.test.ts
│   ├── exemptions.test.ts
│   ├── incidents.test.ts
│   ├── users.test.ts
│   ├── teams.test.ts
│   ├── analytics.test.ts
│   ├── notifications.test.ts
│   ├── absences.test.ts
│   └── ai-insights.test.ts
├── components/                   # Component unit tests
│   ├── ui/
│   │   ├── Button.test.tsx
│   │   ├── Badge.test.tsx
│   │   ├── Card.test.tsx
│   │   └── Pagination.test.tsx
│   └── domain/
│       ├── CheckinForm.test.tsx
│       ├── ApprovalCard.test.tsx
│       └── ExemptionCard.test.tsx
├── flows/                        # Complex multi-step flows
│   ├── low-score-exemption.spec.ts   # Worker RED → TL approval
│   ├── incident-lifecycle.spec.ts    # Report → Assign → WHS → Close
│   └── rtw-certificate.spec.ts       # RTW upload flow
└── fixtures/                     # Test data
    ├── users.json
    ├── teams.json
    ├── incidents.json
    ├── checkins.json
    └── exemptions.json
```

---

## 4. Detailed Test Cases

### 4.1 Authentication Tests

```typescript
// tests/e2e/auth/login.spec.ts

describe('Login', () => {
  test('Worker can login with valid credentials')
  test('Team Lead can login and see correct dashboard')
  test('Supervisor can login and see correct dashboard')
  test('WHS Officer can login and see correct dashboard')
  test('Executive can login and see correct dashboard')
  test('Shows error for invalid credentials')
  test('Shows error for deactivated account')
  test('Redirects to intended page after login')
});

describe('Session', () => {
  test('Token refreshes automatically before expiry')
  test('Redirects to login when session expires')
  test('Logout clears session and redirects to login')
});
```

### 4.2 Worker Home Dashboard Tests

```typescript
// tests/e2e/worker/home.spec.ts

describe('Worker Home Dashboard', () => {
  test('Shows greeting based on time of day')
  test('Shows current date in company timezone')
  test('Shows team info and work schedule')
  test('Shows week calendar with status indicators')
  test('Shows weekly summary (check-ins, absences)')
  test('Shows dynamic tip based on check-in data')
  test('Shows next check-in time when not checked in')
  test('Shows return to work date when on leave')
  test('Navigate to check-in page from button')
});
```

### 4.3 Worker Check-in Tests

```typescript
// tests/e2e/worker/checkin.spec.ts

describe('Check-in Flow', () => {
  test('Shows check-in form when not checked in today')
  test('Can adjust mood slider (1-10)')
  test('Can adjust stress slider (1-10)')
  test('Can adjust sleep slider (1-10)')
  test('Can adjust physical health slider (1-10)')
  test('Can add optional notes')
  test('Can submit check-in with all metrics')
  test('Shows dashboard after successful check-in')
  test('Shows correct readiness status (GREEN/YELLOW/RED)')
  test('Prompts for low score reason when RED')
  test('Can select low score reason category')
  test('Can add low score details')
  test('Can submit low score reason')
  test('Cannot check-in twice on same day')
  test('Shows "Not Work Day" on weekends')
  test('Shows "Holiday" on company holidays')
  test('Shows "On Leave" when has active exemption')
  test('Shows "Too Early" before shift start')
  test('Shows "Too Late" after shift end')
  test('Shows "Welcome" state for new team members')
  test('Shows "No Team" state when not assigned')
});
```

### 4.4 Worker History & Calendar Tests

```typescript
// tests/e2e/worker/my-history.spec.ts

describe('My History', () => {
  test('Shows paginated check-in history')
  test('Displays date, score, and status for each check-in')
  test('Shows metrics (mood, stress, sleep, physical)')
  test('Shows notes if present')
  test('Pagination works correctly')
  test('Empty state when no history')
});

// tests/e2e/worker/calendar.spec.ts

describe('Worker Calendar', () => {
  test('Shows monthly calendar view')
  test('Shows check-in indicators on days')
  test('Shows exemption/leave markers')
  test('Shows holiday markers')
  test('Can navigate between months')
  test('Shows day details on click')
});
```

### 4.5 Exception Request Tests

```typescript
// tests/e2e/worker/request-exception.spec.ts

describe('Exception Request', () => {
  test('Can submit SICK_LEAVE request')
  test('Can submit VACATION request with date range')
  test('Can submit PERSONAL_LEAVE request')
  test('Can submit MEDICAL_APPOINTMENT request')
  test('Can submit FAMILY_EMERGENCY request')
  test('Can link incident to exception request')
  test('Shows pending request status')
  test('Cannot submit duplicate pending request')
  test('Date validation (end >= start)')
  test('Shows my exceptions list')
});
```

### 4.6 Team Lead Approval Tests

```typescript
// tests/e2e/team-lead/approvals.spec.ts

describe('Approvals', () => {
  test('Shows pending exception requests')
  test('Shows member info (name, avatar)')
  test('Shows exception type and reason')
  test('Shows requested date range')
  test('Can approve exception request')
  test('Can set return date on approval')
  test('Can add approval notes')
  test('Can reject exception request with note')
  test('Approved exception shows in active list')
  test('Can end exemption early')
  test('Worker status updates after approval')
  test('Pagination works for many requests')
  test('Search/filter requests')
});
```

### 4.7 Team Lead Daily Monitoring Tests

```typescript
// tests/e2e/team-lead/daily-monitoring.spec.ts

describe('Daily Monitoring', () => {
  // Overview Stats
  test('Shows team stats (total, active, on leave)')
  test('Shows check-in count for today')
  test('Shows not checked in count')
  test('Shows holiday indicator when applicable')

  // Check-ins Tab
  test('Shows today check-ins list')
  test('Shows member name and avatar')
  test('Shows readiness score and status badge')
  test('Shows metrics (mood, stress, sleep, physical)')
  test('Shows check-in time')
  test('Pagination works')
  test('Search by member name')

  // Sudden Changes Tab
  test('Shows members with significant score changes')
  test('Shows severity levels (CRITICAL, SIGNIFICANT, NOTABLE)')
  test('Shows average vs today comparison')
  test('Shows change amount with color coding')
  test('Click member shows details')

  // Exemptions Tab
  test('Shows pending exemptions (actionable)')
  test('Shows active exemptions')
  test('Shows exemption type and reason')
  test('Shows auto-triggered indicator (from low score)')
  test('Can approve pending exemption')
  test('Can reject pending exemption')
  test('Can end active exemption early')

  // Absences Tab
  test('Shows pending justification absences')
  test('Shows member and absence date')
  test('Shows reason category')
  test('Can mark as EXCUSED')
  test('Can mark as UNEXCUSED')
  test('Can add review notes')

  // Not Checked In Tab
  test('Shows members who have not checked in')
  test('Excludes members on leave')
  test('Shows member contact info')
  test('Can send reminder (if applicable)')
});
```

### 4.8 Team Lead Team Members Tests

```typescript
// tests/e2e/team-lead/team-members.spec.ts

describe('Team Members List', () => {
  test('Shows all team members')
  test('Shows member avatar and name')
  test('Shows email')
  test('Shows current streak')
  test('Shows latest status')
  test('Shows active/inactive indicator')
  test('Search by name/email')
  test('Sort by name, streak, status')
  test('Pagination works')
  test('Click member goes to profile')
});

// tests/e2e/team-lead/member-profile.spec.ts

describe('Member Profile', () => {
  test('Shows member details (name, email, phone)')
  test('Shows role and team assignment')
  test('Shows current and longest streak')
  test('Shows total check-ins count')
  test('Shows attendance statistics')
  test('Shows recent check-ins list')
  test('Shows exemptions history')
  test('Shows incidents history')
  test('Shows absences history')
  test('Can navigate to member history page')
});
```

### 4.9 Team Lead Analytics Tests

```typescript
// tests/e2e/team-lead/team-analytics.spec.ts

describe('Team Analytics', () => {
  test('Shows period selector (7d, 14d, 30d, 90d, custom)')
  test('Shows team grade (A, B, C, D)')
  test('Shows team score (0-100)')
  test('Shows trend indicator (up/down/stable)')
  test('Shows compliance percentage')
  test('Shows status distribution chart')
  test('Shows readiness trend line chart')
  test('Shows top performers list')
  test('Shows at-risk members list')
  test('Shows average metrics breakdown')
  test('Shows top low-score reasons')
  test('Shows members needing attention')
  test('Period change updates all data')
});

// tests/e2e/team-lead/team-summary.spec.ts

describe('Weekly Summary Table', () => {
  test('Shows all team members')
  test('Shows daily status per day of week')
  test('Shows weekly average score')
  test('Shows attendance rate')
  test('Color-coded status cells')
  test('Sortable columns')
  test('Shows summary statistics')
});
```

### 4.10 Team Lead AI Features Tests

```typescript
// tests/e2e/team-lead/ai-chat.spec.ts

describe('AI Chat', () => {
  test('Shows chat interface')
  test('Shows suggested commands')
  test('Can send message')
  test('Shows AI response')
  test('Shows loading state during response')
  test('Message history persists')
  test('Can clear history')
  test('Error handling for failed requests')
});

// tests/e2e/team-lead/ai-insights.spec.ts

describe('AI Insights History', () => {
  test('Shows list of generated insights')
  test('Shows generation date')
  test('Shows period covered')
  test('Shows overall status badge')
  test('Shows key highlights preview')
  test('Pagination works')
  test('Click insight goes to detail')
});

// tests/e2e/team-lead/ai-insights-detail.spec.ts

describe('AI Insights Detail', () => {
  test('Shows full AI summary')
  test('Shows highlights section')
  test('Shows concerns identified')
  test('Shows recommendations')
  test('Shows aggregate data')
  test('Shows member analytics table')
  test('Shows risk level indicators')
  test('Shows comparison with previous period')
});
```

### 4.11 Incident Management Tests

```typescript
// tests/e2e/worker/report-incident.spec.ts

describe('Report Incident', () => {
  test('Shows incident form')
  test('Can enter incident title')
  test('Can select incident type (INJURY, ILLNESS, etc.)')
  test('Can select severity (LOW, MEDIUM, HIGH, CRITICAL)')
  test('Can add description')
  test('Can add location (optional)')
  test('Can set incident date')
  test('Can request exception with incident')
  test('Shows success message after submission')
  test('New incident appears in my incidents list')
  test('Form validation for required fields')
});

// tests/e2e/worker/my-incidents.spec.ts

describe('My Incidents', () => {
  test('Shows list of reported incidents')
  test('Shows case number and title')
  test('Shows type and severity badges')
  test('Shows status badge')
  test('Shows date reported')
  test('Pagination works')
  test('Filter by status')
  test('Click incident goes to detail')
});

// tests/e2e/shared/incident-detail.spec.ts

describe('Incident Detail', () => {
  test('Shows case number and title')
  test('Shows type and severity')
  test('Shows full description')
  test('Shows reporter information')
  test('Shows location if present')
  test('Shows incident date')
  test('Shows current status')
  test('Shows activity timeline')
  test('Shows comments section')
  test('Can add comment')
  test('Shows RTW certificate if uploaded')
  test('Print preview link works')
});

// tests/e2e/shared/incident-print.spec.ts

describe('Incident Print Preview', () => {
  test('Shows printable incident report')
  test('Shows all incident details')
  test('Shows company info')
  test('Shows activity history')
  test('Print button works')
  test('Back button navigates correctly')
});
```

### 4.12 Supervisor Tests

```typescript
// tests/e2e/supervisor/dashboard.spec.ts

describe('Supervisor Dashboard', () => {
  test('Shows multi-team overview')
  test('Shows total personnel count')
  test('Shows overall compliance percentage')
  test('Shows open incidents count')
  test('Shows pending exceptions count')
  test('Shows team performance cards')
  test('Shows teams at risk')
  test('Shows recent activities')
  test('Navigate to teams overview')
  test('Navigate to personnel')
  test('Navigate to analytics')
  test('Navigate to incident assignment')
});

// tests/e2e/supervisor/personnel.spec.ts

describe('Personnel Management', () => {
  test('Shows all company personnel')
  test('Shows name, avatar, email')
  test('Shows team assignment')
  test('Shows current status')
  test('Shows latest check-in score')
  test('Filter by status (GREEN, RED, ON_LEAVE, NOT_CHECKED_IN)')
  test('Filter by team')
  test('Search by name/email')
  test('Sort options')
  test('Pagination works')
  test('Click personnel goes to detail')
});

// tests/e2e/supervisor/analytics.spec.ts

describe('Supervisor Analytics', () => {
  test('Shows company-wide analytics')
  test('Filter by team')
  test('Period selector works')
  test('Shows compliance charts')
  test('Shows trend analysis')
  test('Shows team comparison')
});

// tests/e2e/supervisor/incident-assignment.spec.ts

describe('Incident Assignment', () => {
  test('Shows pending incidents (not assigned)')
  test('Shows assigned incidents')
  test('Shows incident details (case number, title, type)')
  test('Shows severity badge')
  test('Shows reporter info')
  test('Can select WHS officer from dropdown')
  test('Can add assignment notes')
  test('Can submit assignment')
  test('Success confirmation shown')
  test('Can reassign incident')
  test('Pagination works')
  test('Filter by status')
  test('Filter by WHS officer')
  test('Search by case number/title')
});
```

### 4.13 WHS Control Tests

```typescript
// tests/e2e/whs/dashboard.spec.ts

describe('WHS Dashboard', () => {
  test('Shows WHS overview')
  test('Shows total members count')
  test('Shows open incidents count')
  test('Shows assigned cases count')
  test('Shows recent safety incidents')
  test('Shows recent activity log')
  test('Navigate to my cases')
  test('Navigate to fill forms')
});

// tests/e2e/whs/my-incidents.spec.ts

describe('WHS My Incidents', () => {
  test('Shows assigned cases list')
  test('Shows case number and title')
  test('Shows incident type and severity')
  test('Shows current status')
  test('Shows reporter info')
  test('Shows date reported')
  test('Pagination works')
  test('Search by case number/title')
  test('Filter by status')
  test('Click case goes to detail')
});

// tests/e2e/whs/case-management.spec.ts

describe('Case Management', () => {
  test('Can view assigned incident details')
  test('Can update incident status (IN_PROGRESS, RESOLVED, etc.)')
  test('Can add comment to incident')
  test('Can upload RTW certificate')
  test('RTW certificate shows after upload')
  test('Can mark incident as resolved')
  test('Activity timeline shows all actions')
  test('Status change creates timeline entry')
});

// tests/e2e/whs/fill-forms.spec.ts

describe('Fill Forms', () => {
  test('Shows available PDF templates')
  test('Filter by category')
  test('Search templates')
  test('Can select template to fill')
  test('Navigate to visual fill page')
});

// tests/e2e/whs/visual-fill.spec.ts

describe('Visual PDF Fill', () => {
  test('Shows PDF preview')
  test('Shows editable form fields')
  test('Can fill text fields')
  test('Can check checkboxes')
  test('Can select from dropdowns')
  test('Can pick dates')
  test('Shows required field indicators')
  test('Validates required fields')
  test('Can link to incident')
  test('Can save filled form')
  test('Can generate PDF')
  test('Can download generated PDF')
});
```

### 4.14 Executive Tests

```typescript
// tests/e2e/executive/dashboard.spec.ts

describe('Executive Dashboard', () => {
  test('Shows company overview')
  test('Shows total members count')
  test('Shows total teams count')
  test('Shows key metrics')
  test('Shows overall health score')
  test('Shows recent activities')
  test('Shows team performance summary')
  test('Navigate to teams overview')
  test('Navigate to user management')
  test('Navigate to settings')
});

// tests/e2e/executive/teams-overview.spec.ts

describe('Teams Overview', () => {
  test('Shows all teams with grades')
  test('Shows team name and leader')
  test('Shows member count')
  test('Shows grade (A, B, C, D)')
  test('Shows score (0-100)')
  test('Shows attendance rate')
  test('Shows status breakdown')
  test('Shows trend indicator')
  test('Shows at-risk members count')
  test('Sort by grade, name, score, members')
  test('Period selector works')
  test('Click team goes to detail')
});

// tests/e2e/executive/teams.spec.ts

describe('Team Management', () => {
  test('Shows all teams list')
  test('Shows team name, size, leader')
  test('Search by name')
  test('Can create new team')
  test('Can edit team details')
  test('Can change team leader')
  test('Can add member to team')
  test('Can remove member from team')
  test('Can delete team')
  test('Pagination works')
});

// tests/e2e/executive/users.spec.ts

describe('User Management', () => {
  test('Shows all company users')
  test('Shows name, email, role, team')
  test('Shows active/inactive status')
  test('Filter by role')
  test('Filter by team')
  test('Filter by active/inactive')
  test('Search by name/email')
  test('Sort options')
  test('Pagination works')
  test('Click user goes to detail')
  test('Can edit user')
  test('Can change user role')
  test('Can deactivate user')
  test('Can reactivate user')
});

// tests/e2e/executive/create-account.spec.ts

describe('Create Account', () => {
  test('Shows create account form')
  test('Can enter email')
  test('Can enter password')
  test('Shows password requirements')
  test('Password confirmation must match')
  test('Can enter first and last name')
  test('Can select role')
  test('Can select team (if applicable role)')
  test('Form validation')
  test('Success message on create')
  test('Error for duplicate email')
});

// tests/e2e/executive/company-settings.spec.ts

describe('Company Settings', () => {
  test('Shows company information')
  test('Can edit company name')
  test('Can upload company logo')
  test('Can edit industry')
  test('Can edit company size')
  test('Can edit address')
  test('Can edit phone')
  test('Can edit website')
  test('Can change timezone')
  test('Shows default work days')
  test('Shows default shift times')
  test('Save changes persists')
});

// tests/e2e/executive/calendar.spec.ts

describe('Company Calendar', () => {
  test('Shows monthly calendar')
  test('Shows holiday markers')
  test('Shows company events')
  test('Can add new holiday/event')
  test('Can edit event')
  test('Can delete event')
  test('Navigate between months')
});
```

### 4.15 Admin Tests

```typescript
// tests/e2e/admin/dashboard.spec.ts

describe('Admin Dashboard', () => {
  test('Shows system overview')
  test('Shows total companies count')
  test('Shows total users count')
  test('Shows system health')
  test('Shows recent activities')
  test('Navigate to templates')
  test('Navigate to template builder')
  test('Navigate to system logs')
});

// tests/e2e/admin/templates.spec.ts

describe('PDF Templates', () => {
  test('Shows all templates list')
  test('Shows template name and description')
  test('Shows category')
  test('Shows active status')
  test('Shows usage count')
  test('Can create new template')
  test('Can edit template details')
  test('Can activate/deactivate template')
  test('Can delete template')
  test('Can download template')
  test('Navigate to template builder')
});

// tests/e2e/admin/template-builder.spec.ts

describe('Template Builder', () => {
  test('Can upload PDF file')
  test('Shows PDF preview')
  test('Can add text field')
  test('Can add checkbox field')
  test('Can add dropdown field')
  test('Can add date field')
  test('Can configure field properties')
  test('Can set field as required')
  test('Can adjust field position')
  test('Can delete field')
  test('Can save template')
  test('Can test preview')
});

// tests/e2e/admin/system-logs.spec.ts

describe('System Logs', () => {
  test('Shows paginated system logs')
  test('Shows action performed')
  test('Shows entity type')
  test('Shows user who performed action')
  test('Shows timestamp')
  test('Shows IP address')
  test('Filter by action type')
  test('Filter by entity type')
  test('Filter by user')
  test('Date range filter')
  test('Search by description')
  test('Pagination works')
  test('Shows log statistics')
});
```

### 4.16 Shared Features Tests

```typescript
// tests/e2e/shared/notifications.spec.ts

describe('Notifications', () => {
  test('Shows notification dropdown in header')
  test('Shows unread count badge')
  test('Shows notification list')
  test('Shows notification type icon')
  test('Shows notification message')
  test('Shows time ago')
  test('Click notification navigates to related item')
  test('Can mark as read')
  test('Can mark all as read')
  test('Navigate to notifications page')

  // Notifications Page
  test('Shows all notifications')
  test('Filter: all, unread, read, archived')
  test('Can archive notification')
  test('Can unarchive notification')
  test('Can delete notification')
  test('Pagination works')
});

// tests/e2e/shared/profile.spec.ts

describe('Profile Settings', () => {
  test('Shows user profile')
  test('Shows first name, last name, email')
  test('Shows phone number')
  test('Shows avatar')
  test('Shows role')
  test('Shows company name')
  test('Shows team assignment')
  test('Can update first name')
  test('Can update last name')
  test('Can update phone')
  test('Can update avatar')
  test('Changes persist after save')
});
```

### 4.17 Error Page Tests

```typescript
// tests/e2e/error/not-found.spec.ts

describe('404 Not Found', () => {
  test('Shows 404 page for unknown routes')
  test('Shows "Page Not Found" message')
  test('Shows illustration')
  test('Shows "Go Home" button')
  test('Shows "Go Back" button')
  test('Go Home navigates to home')
  test('Go Back navigates to previous page')
});

// tests/e2e/error/forbidden.spec.ts

describe('403 Forbidden', () => {
  test('Shows 403 when accessing unauthorized route')
  test('Shows "Access Denied" message')
  test('Shows explanation text')
  test('Shows "Go Home" button')
  test('Worker cannot access admin pages')
  test('Team Lead cannot access executive pages')
});

// tests/e2e/error/error-boundary.spec.ts

describe('Error Boundary', () => {
  test('Catches React errors')
  test('Shows error fallback UI')
  test('Shows "Something went wrong" message')
  test('Shows "Reload" button')
  test('Reload refreshes the page')
});
```

### 4.18 Complex Flow Tests

```typescript
// tests/flows/low-score-exemption.spec.ts

describe('Low Score → Auto-Exemption Flow', () => {
  test('Worker submits check-in with RED score')
  test('System prompts for low score reason')
  test('Worker selects reason category')
  test('Worker adds optional details')
  test('Worker submits low score reason')
  test('System creates pending exemption request')
  test('Team Lead sees exemption in Daily Monitoring')
  test('Team Lead approves exemption')
  test('Worker status shows "On Leave"')
  test('Worker cannot check-in while on leave')
  test('Team Lead can end exemption early')
  test('Worker can check-in after exemption ends')
});

// tests/flows/incident-lifecycle.spec.ts

describe('Incident Lifecycle Flow', () => {
  test('Worker reports new incident')
  test('Incident appears in team incidents')
  test('Team Lead can view incident')
  test('Supervisor sees incident in assignment page')
  test('Supervisor assigns incident to WHS')
  test('WHS receives assignment notification')
  test('WHS views incident in my cases')
  test('WHS updates status to IN_PROGRESS')
  test('WHS adds investigation comment')
  test('WHS fills related form (if needed)')
  test('WHS uploads RTW certificate')
  test('WHS marks incident as RESOLVED')
  test('Worker sees resolved status')
  test('Activity timeline shows full history')
});

// tests/flows/rtw-certificate.spec.ts

describe('RTW Certificate Flow', () => {
  test('Worker has incident that requires RTW')
  test('WHS navigates to incident detail')
  test('WHS uploads RTW certificate')
  test('Certificate info displays correctly')
  test('Worker can view RTW in incident detail')
  test('RTW shows in print preview')
});
```

---

## 5. Backend Unit & Integration Tests

### 5.1 Timezone Handling Tests

```typescript
// backend/tests/utils/date-helpers.test.ts

describe('getTodayRange', () => {
  test('Returns correct range for Asia/Manila timezone')
  test('Returns correct range for America/New_York timezone')
  test('Returns correct range for UTC timezone')
  test('Handles daylight saving time transitions')
  test('Returns start at 00:00:00 and end at 23:59:59 in local time')
});

describe('formatLocalDate', () => {
  test('Formats date correctly for Asia/Manila')
  test('Formats date correctly for different timezones')
  test('Handles edge cases (midnight, end of day)')
});

describe('isWorkDay', () => {
  test('Returns true for Monday when workDays includes Monday')
  test('Returns false for Sunday when workDays is Mon-Fri')
  test('Works correctly across timezone boundaries')
});

describe('getShiftTimes', () => {
  test('Calculates shift start time in company timezone')
  test('Calculates shift end time in company timezone')
  test('Handles overnight shifts correctly')
});

// backend/tests/utils/schedule-utils.test.ts

describe('parseWorkDays', () => {
  test('Parses "1,2,3,4,5" to Monday-Friday')
  test('Parses "1,2,3,4,5,6" to Monday-Saturday')
  test('Handles empty string')
});

describe('isHoliday', () => {
  test('Returns true for company holiday')
  test('Returns false for regular work day')
  test('Checks correct date in company timezone')
});
```

### 5.2 Cron Job Tests

```typescript
// backend/tests/cron/shift-end.test.ts

describe('Shift End Cron Job', () => {
  // Absence Creation
  test('Creates PENDING_JUSTIFICATION absence for workers who did not check in')
  test('Does NOT create absence for workers on approved leave')
  test('Does NOT create absence for workers who checked in')
  test('Does NOT create absence on non-work days')
  test('Does NOT create absence on holidays')
  test('Respects company timezone for shift end time')

  // Notifications
  test('Sends notification to team lead about absent workers')
  test('Does NOT send notification if no absent workers')
  test('Groups notifications by team')
});

// backend/tests/cron/check-in-reminder.test.ts

describe('Check-in Reminder Cron Job', () => {
  test('Sends reminder to workers who have not checked in')
  test('Does NOT send reminder to workers on leave')
  test('Does NOT send reminder after shift end')
  test('Does NOT send reminder on non-work days')
  test('Respects company timezone for reminder timing')
});

// backend/tests/cron/exemption-expiry.test.ts

describe('Exemption Expiry Cron Job', () => {
  test('Updates exemption status to EXPIRED when end date passes')
  test('Sends notification to worker when exemption expires')
  test('Worker can check in again after exemption expires')
  test('Handles timezone correctly for expiry date')
});
```

### 5.3 Check-in Logic Tests

```typescript
// backend/tests/modules/checkins.test.ts

describe('Check-in Availability', () => {
  test('Returns available=true during work hours on work day')
  test('Returns available=false before shift start (TOO_EARLY)')
  test('Returns available=false after shift end (TOO_LATE)')
  test('Returns available=false on weekend (NOT_WORK_DAY)')
  test('Returns available=false on holiday (HOLIDAY)')
  test('Returns available=false when on approved leave (ON_LEAVE)')
  test('Checks availability in company timezone, not UTC')
});

describe('Readiness Score Calculation', () => {
  test('Calculates average of mood, stress, sleep, physicalHealth')
  test('Returns GREEN for score >= 7')
  test('Returns YELLOW for score 4-6')
  test('Returns RED for score < 4')
  test('Inverts stress score (high stress = low readiness)')
});

describe('Duplicate Check-in Prevention', () => {
  test('Prevents second check-in on same day')
  test('Allows check-in on different day')
  test('Uses company timezone to determine "same day"')
});
```

### 5.4 Exception/Exemption Logic Tests

```typescript
// backend/tests/modules/exceptions.test.ts

describe('Exception Request', () => {
  test('Creates exception with PENDING status')
  test('Validates start date is not in the past')
  test('Validates end date is after start date')
  test('Links to incident if incidentId provided')
  test('Prevents duplicate pending request for same dates')
});

describe('Exception Approval', () => {
  test('Updates status to APPROVED')
  test('Creates exemption record')
  test('Sends notification to worker')
  test('Only team lead can approve their team members')
});

describe('Exemption Check', () => {
  test('isOnLeave returns true during exemption period')
  test('isOnLeave returns false before exemption starts')
  test('isOnLeave returns false after exemption ends')
  test('Uses company timezone for date comparison')
});
```

### 5.5 Incident Assignment Tests

```typescript
// backend/tests/modules/incidents.test.ts

describe('Incident Assignment', () => {
  test('Supervisor can assign incident to WHS officer')
  test('Assignment creates notification for WHS')
  test('Assignment updates incident assignedToId')
  test('Non-supervisor cannot assign incidents')
});

describe('Incident Status Updates', () => {
  test('WHS can update status to IN_PROGRESS')
  test('WHS can update status to RESOLVED')
  test('Status change creates activity log entry')
  test('Only assigned WHS can update their incidents')
});
```

### 5.6 Analytics Calculation Tests

```typescript
// backend/tests/modules/analytics.test.ts

describe('Team Grade Calculation', () => {
  test('Calculates grade A for score >= 90')
  test('Calculates grade B for score 80-89')
  test('Calculates grade C for score 70-79')
  test('Calculates grade D for score < 70')
  test('Handles teams with no check-ins')
});

describe('Compliance Calculation', () => {
  test('Calculates compliance rate correctly')
  test('Excludes workers on leave from calculation')
  test('Excludes non-work days from calculation')
});

describe('Trend Calculation', () => {
  test('Returns UP when current > previous')
  test('Returns DOWN when current < previous')
  test('Returns STABLE when current == previous')
});
```

### 5.7 Notification System Tests

```typescript
// backend/tests/modules/notifications.test.ts

describe('Notification Creation', () => {
  test('Creates notification with correct type')
  test('Sets isRead to false by default')
  test('Links to correct entity (incident, exception, etc.)')
});

describe('Notification Triggers', () => {
  test('Creates notification when exception is approved')
  test('Creates notification when exception is rejected')
  test('Creates notification when incident is assigned')
  test('Creates notification when incident status changes')
  test('Creates notification for RED status team members')
});
```

---

## 6. Test Data Strategy

### 6.1 Test Users (Seeded in Test DB)

| Email | Password | Role | Team |
|-------|----------|------|------|
| worker@test.com | Test123! | WORKER | Team Alpha |
| worker2@test.com | Test123! | WORKER | Team Alpha |
| worker3@test.com | Test123! | WORKER | Team Beta |
| teamlead@test.com | Test123! | TEAM_LEAD | Team Alpha |
| teamlead2@test.com | Test123! | TEAM_LEAD | Team Beta |
| supervisor@test.com | Test123! | SUPERVISOR | - |
| whs@test.com | Test123! | WHS_CONTROL | - |
| whs2@test.com | Test123! | WHS_CONTROL | - |
| executive@test.com | Test123! | EXECUTIVE | - |
| admin@test.com | Test123! | ADMIN | - |

### 6.2 Test Teams

| Team Name | Work Days | Shift | Leader |
|-----------|-----------|-------|--------|
| Team Alpha | Mon-Fri | 8:00 AM - 5:00 PM | teamlead@test.com |
| Team Beta | Mon-Sat | 9:00 AM - 6:00 PM | teamlead2@test.com |

### 6.3 Test Data Reset

```typescript
// Before each test suite
beforeAll(async () => {
  await resetTestDatabase();
  await seedTestData();
});

// After each test (optional)
afterEach(async () => {
  await cleanupTestData();
});
```

---

## 7. Implementation Phases

### Phase 1: Setup (Day 1)

- [ ] Install Playwright (frontend)
- [ ] Install Vitest (backend)
- [ ] Configure playwright.config.ts
- [ ] Configure vitest.config.ts (backend)
- [ ] Create test utilities (login helper, API helpers)
- [ ] Setup test database/environment
- [ ] Create test user fixtures

### Phase 2: Critical Path E2E Tests (Day 2-3)

- [ ] Authentication tests (login, logout, session)
- [ ] Worker check-in flow
- [ ] Exception request flow
- [ ] Team Lead approval flow

### Phase 3: Backend Unit Tests (Day 4-5)

- [ ] Timezone handling tests (date-helpers)
- [ ] Check-in logic tests (availability, score calculation)
- [ ] Exception/Exemption logic tests
- [ ] Analytics calculation tests

### Phase 4: Backend Cron Job Tests (Day 6-7)

- [ ] Shift-end cron tests (absence creation)
- [ ] Check-in reminder cron tests
- [ ] Exemption expiry cron tests
- [ ] Notification trigger tests

### Phase 5: Incident Flow E2E Tests (Day 8-9)

- [ ] Report incident
- [ ] Supervisor assignment
- [ ] WHS case management
- [ ] Incident status updates

### Phase 6: Secondary E2E Tests (Day 10-11)

- [ ] Dashboard loading tests (all roles)
- [ ] Navigation tests
- [ ] Error page tests
- [ ] Notification tests

### Phase 7: CI/CD Integration (Day 12)

- [ ] GitHub Actions workflow for E2E
- [ ] GitHub Actions workflow for Backend tests
- [ ] Test reporting
- [ ] Screenshot artifacts on failure

---

## 8. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/tests.yml

name: Tests (E2E + Backend)

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd frontend && npm ci
          cd ../backend && npm ci

      - name: Install Playwright browsers
        run: cd frontend && npx playwright install --with-deps

      - name: Start backend
        run: cd backend && npm run dev &

      - name: Start frontend
        run: cd frontend && npm run dev &

      - name: Wait for servers
        run: npx wait-on http://localhost:5173 http://localhost:3000

      - name: Run Backend tests
        run: cd backend && npm test

      - name: Run E2E tests
        run: cd frontend && npx playwright test

      - name: Upload E2E test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/

      - name: Upload Backend test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: backend/coverage/
```

### Backend Test Script (package.json)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 9. Test Utilities

### Login Helper

```typescript
// tests/utils/auth.ts

export async function loginAs(page: Page, role: 'worker' | 'teamlead' | 'supervisor' | 'whs' | 'executive' | 'admin') {
  const credentials = {
    worker: { email: 'worker@test.com', password: 'Test123!' },
    teamlead: { email: 'teamlead@test.com', password: 'Test123!' },
    supervisor: { email: 'supervisor@test.com', password: 'Test123!' },
    whs: { email: 'whs@test.com', password: 'Test123!' },
    executive: { email: 'executive@test.com', password: 'Test123!' },
    admin: { email: 'admin@test.com', password: 'Test123!' },
  };

  const { email, password } = credentials[role];

  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/**', { waitUntil: 'networkidle' });
}
```

### API Helper

```typescript
// tests/utils/api.ts

export async function createTestIncident(token: string) {
  const response = await fetch('http://localhost:3000/api/incidents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Test Incident',
      description: 'Created by E2E test',
      type: 'NEAR_MISS',
      severity: 'LOW',
    }),
  });
  return response.json();
}
```

---

## 10. Running Tests

### Commands

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/worker/checkin.spec.ts

# Run tests with UI mode (debugging)
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test by name
npx playwright test -g "Worker can complete daily check-in"

# Generate HTML report
npx playwright show-report
```

### Test Tags (Optional)

```typescript
// Run only critical tests
test('Worker can login @critical', async ({ page }) => {
  // ...
});

// Command: npx playwright test --grep @critical
```

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage (Critical Paths) | 100% |
| Test Pass Rate | > 95% |
| Flaky Test Rate | < 5% |
| Average Test Duration | < 30 seconds |
| Total E2E Suite Duration | < 10 minutes |

---

## 12. Maintenance

### Weekly Tasks

- Review failed tests from CI
- Update tests when features change
- Remove obsolete tests
- Add tests for new features

### Quarterly Tasks

- Review test coverage
- Optimize slow tests
- Update Playwright version
- Review and update test data

---

## Summary

### Test Count by Category

#### E2E Tests (Playwright)

| Category | Test Count |
|----------|------------|
| Authentication | 14 |
| Worker (Home, Check-in, History, Calendar) | 42 |
| Worker Incidents & Exceptions | 21 |
| Team Lead (Overview, Monitoring, Members) | 70 |
| Team Lead (Analytics, AI Features) | 50 |
| Supervisor | 38 |
| WHS Control | 43 |
| Executive | 62 |
| Admin | 40 |
| Shared Features (Notifications, Profile) | 23 |
| Error Pages | 15 |
| Complex Flows | 32 |
| **Subtotal E2E** | **~450** |

#### Backend Tests (Vitest)

| Category | Test Count |
|----------|------------|
| Timezone Handling (date-helpers) | 18 |
| Cron Jobs (shift-end, reminders, expiry) | 22 |
| Check-in Logic (availability, scoring) | 15 |
| Exception/Exemption Logic | 13 |
| Incident Assignment | 8 |
| Analytics Calculations | 11 |
| Notification System | 8 |
| **Subtotal Backend** | **~95** |

#### Grand Total

| Test Type | Count |
|-----------|-------|
| E2E Tests | ~450 |
| Backend Unit/Integration | ~95 |
| **Grand Total** | **~545** |

### Test Count by Priority

| Priority | Tests | Estimated Effort |
|----------|-------|------------------|
| P1 Critical (E2E) | ~80 tests | 3-4 days |
| P2 Important (E2E) | ~180 tests | 5-7 days |
| P3 Secondary (E2E) | ~150 tests | 4-5 days |
| Complex Flows (E2E) | ~40 tests | 2-3 days |
| Backend Unit Tests | ~60 tests | 2-3 days |
| Backend Integration Tests | ~35 tests | 2-3 days |
| **Total** | **~545 tests** | **18-25 days** |

### Coverage Summary

#### Frontend (E2E)

| Role | Pages | Features Tested |
|------|-------|-----------------|
| Worker/Member | 8 | Home, Check-in, Incidents, Exceptions, History, Calendar |
| Team Lead | 12 | Monitoring, Approvals, Members, Analytics, AI Features |
| Supervisor | 4 | Dashboard, Personnel, Analytics, Incident Assignment |
| WHS Control | 5 | Dashboard, My Cases, Case Management, Form Filling |
| Executive | 7 | Dashboard, Teams, Users, Settings, Calendar |
| Admin | 4 | Dashboard, Templates, Builder, System Logs |
| Shared | 4 | Notifications, Profile, Incident Detail, Error Pages |

#### Backend (Unit/Integration)

| Module | Features Tested |
|--------|-----------------|
| date-helpers | Timezone calculations, date ranges, work day checks |
| Cron Jobs | Shift-end absences, reminders, exemption expiry |
| Check-ins | Availability logic, score calculation, duplicate prevention |
| Exceptions | Request validation, approval flow, exemption checks |
| Incidents | Assignment, status updates, activity logging |
| Analytics | Grade calculation, compliance, trends |
| Notifications | Creation, triggers, delivery |

### Next Steps

1. Review and approve this plan
2. Setup Playwright in frontend
3. Setup Vitest in backend
4. Start with Phase 1 (Setup)
5. Implement E2E Critical tests
6. Implement Backend Unit tests
7. Implement Backend Cron tests
8. Implement remaining E2E tests
9. Integrate with CI/CD
