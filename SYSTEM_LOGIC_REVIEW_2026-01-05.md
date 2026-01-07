# AEGIRA SYSTEM LOGIC REVIEW
**Review Date:** January 5, 2026
**Reviewer:** Claude Code
**Status:** COMPREHENSIVE REVIEW

---

## EXECUTIVE SUMMARY

The Aegira Personnel Readiness Management System demonstrates **solid architecture** and **well-thought-out business logic**. The codebase follows modern best practices with TypeScript, proper separation of concerns, and comprehensive feature implementation.

### Overall Assessment: **GOOD** (8/10)

| Category | Rating | Notes |
|----------|--------|-------|
| Code Structure | 9/10 | Clean modular architecture |
| Business Logic | 8/10 | Well-implemented with minor improvements possible |
| Security | 8/10 | Strong foundation, some enhancements recommended |
| Type Safety | 9/10 | Excellent TypeScript usage |
| Database Design | 9/10 | Proper normalization and relationships |
| Frontend-Backend Integration | 8/10 | Clean API contracts |

---

## BACKEND LOGIC ANALYSIS

### 1. READINESS SCORE CALCULATION (`src/utils/readiness.ts`)

**Status: CORRECT**

```typescript
// Current Implementation:
moodScore = (mood / 10) * 100           // Normalize to 0-100
stressScore = ((10 - stress) / 10) * 100 // Invert stress (high stress = low score)
sleepScore = (sleep / 10) * 100
physicalScore = (physicalHealth / 10) * 100

// Weighted average (equal weights 0.25 each)
score = moodScore * 0.25 + stressScore * 0.25 + sleepScore * 0.25 + physicalScore * 0.25

// Status thresholds:
// GREEN: score >= 70
// YELLOW: score >= 40 && score < 70
// RED: score < 40
```

**Analysis:**
- Stress inversion is correctly implemented (high input = low wellness)
- Equal weighting (25% each) is reasonable for general wellness
- Thresholds (70/40) are sensible for categorization
- Math is correct: Round() applied after calculation

**Verdict:** NO ISSUES

---

### 2. ATTENDANCE STATUS CALCULATION (`src/utils/attendance.ts`)

**Status: CORRECT**

```typescript
// GREEN = On-time (within 15-min grace period) = 100 points
// YELLOW = Late (after grace period) = 75 points
// ABSENT = No check-in, no approved exception = 0 points
// EXCUSED = Has approved exception = NOT COUNTED

// minutesLate calculation:
minutesLate = max(0, checkInMinutes - graceEndMinutes)
```

**Analysis:**
- Grace period logic is correct (schedule + 15 min)
- Score values are sensible (100/75/0)
- EXCUSED properly excluded from calculation (isCounted = false)
- `minutesLate` is 0 when on-time (not negative)

**Verdict:** NO ISSUES

---

### 3. PERFORMANCE SCORE (Lazy Evaluation)

**Status: CORRECT with SMART DESIGN**

```typescript
// Key design decisions:
1. teamJoinedAt prevents false absences for new members
2. Future days are NOT counted as absent
3. Approved exceptions are properly detected and excluded
4. Work days are dynamically checked from team configuration
```

**Logic Flow:**
```
For each day in period:
  1. Skip if not a work day for team
  2. Skip if before user joined team (teamJoinedAt)
  3. If attendance record exists → use its status
  4. If approved exception covers day → mark EXCUSED (not counted)
  5. If past day with no record/exception → mark ABSENT (counts against)
  6. If future day → skip (don't penalize)
```

**Analysis:**
- Lazy evaluation is efficient (no cron jobs needed)
- `teamJoinedAt` tracking prevents unfair penalties
- Date range handling is correct with UTC normalization
- Grade calculation (A/B/C/D) uses standard cutoffs (90/80/70)

**Verdict:** EXCELLENT IMPLEMENTATION

---

### 4. CHECK-IN VALIDATION LOGIC (`src/modules/checkins/index.ts`)

**Status: CORRECT - COMPREHENSIVE**

**Validation Order:**
```typescript
1. Role check: Only WORKER/MEMBER can check in
2. Team assignment check: Must belong to a team
3. Leave status check: Cannot check in during approved leave
4. Work day check: Today must be team's work day
5. Shift time check: Must be within shift hours (30-min early grace)
6. Duplicate check: Cannot check in twice same day
```

**Streak Logic:**
```typescript
// Streak continues if:
- Consecutive day check-in (daysDiff === 1)
- OR gap covered by approved leave
- OR gap only contains non-work days

// Otherwise streak resets to 1
```

**Analysis:**
- All edge cases properly handled
- Streak logic accounts for weekends and leave
- Transaction ensures atomicity (checkin + attendance created together)
- System log created for audit trail

**Verdict:** NO ISSUES

---

### 5. INCIDENT MANAGEMENT (`src/modules/incidents/index.ts`)

**Status: CORRECT with GOOD DESIGN**

**Key Features:**
- Auto-generated case numbers: `INC-YYYY-XXXX`
- Full lifecycle: OPEN → IN_PROGRESS → RESOLVED → CLOSED
- Activity timeline with IncidentActivity records
- Auto-exception creation for CRITICAL/HIGH severity personal incidents
- RTW (Return to Work) certificate tracking

**Auto-Exception Logic:**
```typescript
if (type in ['INJURY', 'ILLNESS', 'MENTAL_HEALTH'] && severity in ['CRITICAL', 'HIGH']) {
  // Create PENDING exception linked to incident
  // Notify team leader
  // Exception must still be approved
}
```

**Analysis:**
- Case number generation is company-scoped (correct)
- Authorization checks for updates are proper
- Activity timeline provides full audit history
- Linked exceptions maintain data integrity

**Verdict:** EXCELLENT IMPLEMENTATION

---

### 6. EXCEPTION/LEAVE MANAGEMENT (`src/modules/exceptions/index.ts`)

**Status: CORRECT**

**Workflow:**
```
PENDING → APPROVED/REJECTED
         ↓
    If APPROVED:
      - Days marked as EXCUSED (not counted in attendance)
      - Notification sent to user
      - If linked to incident, activity logged
```

**Key Features:**
- Team lead can only see their team's pending exceptions
- Supervisor/Executive/Admin can see all
- Owner can only update PENDING exceptions
- End-early feature with proper date validation
- Linked incident gets activity update

**Verdict:** NO ISSUES

---

### 7. AUTHENTICATION & AUTHORIZATION

**Status: CORRECT**

**Auth Middleware (`src/middlewares/auth.middleware.ts`):**
```typescript
1. Extract Bearer token from Authorization header
2. Check token blacklist (for logged-out tokens)
3. Verify JWT with jose library
4. Fetch user from database
5. Check if user is active
6. Set user, userId, companyId in context
```

**Role Middleware (`src/middlewares/role.middleware.ts`):**
```typescript
// Role-based: Check if user.role in allowedRoles
// Permission-based: Check ROLE_PERMISSIONS matrix

// Hierarchy (higher number = more access):
ADMIN: 6
EXECUTIVE: 5
SUPERVISOR: 4, CLINICIAN: 4, WHS_CONTROL: 4
TEAM_LEAD: 3
WORKER: 2, MEMBER: 2
```

**Analysis:**
- JWT verification is proper
- Token blacklist prevents reuse of logged-out tokens
- Company scoping is enforced via middleware
- Role hierarchy allows proper permission inheritance
- Parallel roles (SUPERVISOR, CLINICIAN, WHS_CONTROL) at same level

**Verdict:** SOLID SECURITY MODEL

---

### 8. USER MANAGEMENT (`src/modules/users/index.ts`)

**Status: CORRECT**

**Key Logic:**
- Only EXECUTIVE can create users (not ADMIN - this is intentional)
- Role assignment restricted by `getAssignableRoles()` (can only assign lower roles)
- EXECUTIVE role cannot be modified or deleted
- Soft delete (isActive = false) preserves data integrity
- Team assignment updates `teamJoinedAt` timestamp

**Verdict:** NO ISSUES

---

## FRONTEND LOGIC ANALYSIS

### 1. ROUTING & GUARDS (`src/app/router.tsx`, `src/app/role-guard.tsx`)

**Status: CORRECT**

**Route Protection:**
```typescript
// ProtectedRoute: Requires authentication
// RoleGuard: Requires specific roles

// Example:
<RoleGuard allowedRoles={['WORKER', 'MEMBER']}>
  <CheckinPage />
</RoleGuard>
```

**Role Mapping:**
| Route | Allowed Roles |
|-------|---------------|
| `/checkin` | WORKER, MEMBER |
| `/team/*` | TEAM_LEAD, SUPERVISOR, EXECUTIVE, ADMIN |
| `/dashboard` | SUPERVISOR, EXECUTIVE, ADMIN |
| `/executive/*` | EXECUTIVE, ADMIN |
| `/admin/*` | ADMIN only |
| `/whs/*` | WHS_CONTROL, EXECUTIVE, ADMIN |

**Verdict:** PROPER ROLE-BASED ACCESS CONTROL

---

### 2. API SERVICE LAYER (`src/services/*.ts`)

**Status: CORRECT**

**Patterns Used:**
- Axios-based HTTP client with interceptors
- TypeScript interfaces matching backend responses
- Proper error handling (404 returns null where appropriate)
- Pagination support in service methods

**Verdict:** CLEAN API INTEGRATION

---

## DATABASE SCHEMA ANALYSIS

### Key Design Decisions (All Correct):

1. **Multi-tenancy via `companyId`**
   - Every entity has companyId FK
   - Proper cascading deletes

2. **Team-User Relationship**
   - `teamJoinedAt` tracks assignment date
   - Leader relationship separate from membership

3. **Daily Attendance**
   - Unique constraint on `(userId, date)`
   - Stores snapshot of schedule at time of check-in
   - Links to exception if excused

4. **Incident Activity Timeline**
   - Separate model for full audit history
   - Types: CREATED, STATUS_CHANGED, ASSIGNED, COMMENT, RESOLVED

5. **Exception-Incident Link**
   - `linkedIncidentId` creates one-to-one relationship
   - Auto-created exceptions maintain this link

**Verdict:** EXCELLENT DATABASE DESIGN

---

## IDENTIFIED ISSUES (Minor)

### Issue 1: Timezone Handling
**Location:** Various date operations
**Severity:** LOW
**Details:** Some date comparisons use local time, others use UTC. Recommend consistent UTC handling.
**Files Affected:**
- `src/utils/attendance.ts` - Uses `setHours(0,0,0,0)` (local)
- `src/modules/checkins/index.ts` - Mixed local/UTC

**Recommendation:**
```typescript
// Standardize on UTC for all date-only comparisons
const dateOnly = new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate()
));
```

### Issue 2: Potential Race Condition in Case Number Generation
**Location:** `src/modules/incidents/index.ts:10-31`
**Severity:** LOW (unlikely in practice)
**Details:** `generateCaseNumber()` reads last number then creates new. Under high concurrency, duplicates possible.

**Recommendation:**
```typescript
// Wrap in transaction or use database sequence
// Option 1: Database sequence
// Option 2: Retry on unique constraint violation
```

### Issue 3: Missing Input Sanitization for Notes/Comments
**Location:** Various `notes` and `comment` fields
**Severity:** LOW (XSS risk if displayed unsanitized)
**Details:** Free-text fields should be sanitized before display.

**Recommendation:** Ensure frontend sanitizes HTML when displaying user-generated content.

---

## SECURITY CHECKLIST

| Check | Status |
|-------|--------|
| JWT token verification | PASS |
| Token expiration | PASS (15 min access, 7 day refresh) |
| Token blacklist on logout | PASS |
| Company scoping in queries | PASS |
| Role-based access control | PASS |
| Input validation (Zod) | PASS |
| SQL injection prevention (Prisma) | PASS |
| Password hashing (Supabase) | PASS |
| Soft delete for users | PASS |
| Audit logging | PASS |

---

## RECOMMENDATIONS

### Priority 1: Quick Wins
1. **Standardize timezone handling** - Use UTC consistently
2. **Add rate limiting** - Prevent brute force on auth endpoints
3. **Add input length limits** - For notes/description fields

### Priority 2: Enhancements
1. **Email notifications** - Exception approvals, incident updates
2. **Push notifications** - For mobile app (future)
3. **Data export** - CSV/PDF for compliance reports

### Priority 3: Future Considerations
1. **SSO integration** - For enterprise customers
2. **Offline support** - For mobile workers
3. **Advanced analytics** - ML-based burnout prediction

---

## CODE QUALITY METRICS

| Metric | Assessment |
|--------|------------|
| TypeScript strictness | Excellent |
| Error handling | Good |
| Code organization | Excellent |
| API consistency | Excellent |
| Documentation | Good |
| Test coverage | Not assessed |

---

## CONCLUSION

The Aegira system demonstrates **professional-grade engineering** with:

- Well-structured modular architecture
- Correct business logic implementation
- Proper security measures
- Comprehensive feature set
- Good TypeScript practices

**The logic is CORRECT and the code is PROPER.**

Minor improvements around timezone handling and race conditions are recommended but not critical for current operations.

---

## APPENDIX: CORE ALGORITHMS SUMMARY

### Readiness Score Formula
```
score = ((mood/10) * 25) + (((10-stress)/10) * 25) + ((sleep/10) * 25) + ((physical/10) * 25)
```

### Attendance Score
```
GREEN (on-time)  = 100 points
YELLOW (late)    = 75 points
ABSENT          = 0 points
EXCUSED         = not counted
```

### Performance Grade
```
A: score >= 90 (Excellent)
B: score >= 80 (Good)
C: score >= 70 (Fair)
D: score < 70  (Poor)
```

### Streak Rules
```
Continue if:
  - Consecutive work day check-in, OR
  - Gap fully covered by approved leave, OR
  - Gap contains no work days
Reset otherwise.
```

---

## REAL-LIFE SCENARIOS (System in Action)

Mga halimbawa kung paano gumagana ang system sa totoong buhay.

---

### SCENARIO 1: Normal Work Day - Si Juan Nag Check-in

**Characters:**
- **Juan Santos** - Worker sa Operations Team
- **Maria Cruz** - Team Leader ng Operations Team

**Timeline:**

```
=== JANUARY 6, 2026 (Monday) ===

07:45 AM - Juan arrives at work
           Team schedule: 08:00 - 17:00, Grace period: 15 mins

08:05 AM - Juan opens Aegira app, goes to /checkin

           SYSTEM VALIDATES:
           [✓] Role check: Juan is WORKER - can check in
           [✓] Team check: Juan belongs to Operations Team
           [✓] Leave check: Juan has no active approved leave
           [✓] Work day check: Monday is a work day for Operations
           [✓] Time check: 08:05 is within shift (08:00-17:00)
           [✓] Duplicate check: Juan hasn't checked in today

08:06 AM - Juan submits check-in:
           - Mood: 8/10 (feeling good)
           - Stress: 3/10 (low stress)
           - Sleep: 7/10 (slept well)
           - Physical: 8/10 (physically fine)

           SYSTEM CALCULATES:
           ┌─────────────────────────────────────────┐
           │ Readiness Score Calculation:            │
           │                                         │
           │ Mood:     (8/10) × 100 = 80            │
           │ Stress:   ((10-3)/10) × 100 = 70       │
           │ Sleep:    (7/10) × 100 = 70            │
           │ Physical: (8/10) × 100 = 80            │
           │                                         │
           │ Score = (80+70+70+80) / 4 = 75         │
           │ Status = GREEN (75 >= 70)              │
           └─────────────────────────────────────────┘

           ATTENDANCE CALCULATION:
           ┌─────────────────────────────────────────┐
           │ Check-in time: 08:05                    │
           │ Scheduled start: 08:00                  │
           │ Grace period ends: 08:15                │
           │                                         │
           │ 08:05 <= 08:15? YES                     │
           │ Status = GREEN (on-time)                │
           │ Score = 100 points                      │
           │ Minutes late = 0                        │
           └─────────────────────────────────────────┘

           RECORDS CREATED:
           - Checkin record (readiness: GREEN, score: 75)
           - DailyAttendance record (status: GREEN, score: 100)
           - SystemLog: "Juan Santos submitted daily check-in (Readiness: GREEN, Attendance: GREEN)"
           - Streak updated: currentStreak = previousStreak + 1

08:07 AM - Juan sees result:
           "You're all set for today! Readiness: GREEN (75)"
```

**Database State After:**
```sql
-- checkins table
id: "abc123"
userId: "juan-id"
mood: 8, stress: 3, sleep: 7, physicalHealth: 8
readinessScore: 75
readinessStatus: "GREEN"

-- daily_attendance table
id: "att456"
userId: "juan-id"
date: "2026-01-06"
checkInTime: "2026-01-06T08:05:00"
status: "GREEN"
score: 100
minutesLate: 0
isCounted: true
```

---

### SCENARIO 2: Late Check-in - Si Pedro Nag Late

**Characters:**
- **Pedro Reyes** - Worker sa Logistics Team

**Timeline:**

```
=== JANUARY 6, 2026 (Monday) ===

Team schedule: 09:00 - 18:00, Grace period: 15 mins

09:35 AM - Pedro arrives late (traffic)
           Opens Aegira app

           SYSTEM VALIDATES:
           [✓] All checks pass
           [✓] Time check: 09:35 is within shift (09:00-18:00)

09:36 AM - Pedro submits check-in:
           - Mood: 5/10 (stressed from traffic)
           - Stress: 7/10 (high stress)
           - Sleep: 6/10 (okay sleep)
           - Physical: 7/10 (fine)

           SYSTEM CALCULATES:
           ┌─────────────────────────────────────────┐
           │ Readiness Score:                        │
           │ Mood:     (5/10) × 100 = 50            │
           │ Stress:   ((10-7)/10) × 100 = 30       │
           │ Sleep:    (6/10) × 100 = 60            │
           │ Physical: (7/10) × 100 = 70            │
           │                                         │
           │ Score = (50+30+60+70) / 4 = 52.5 ≈ 53  │
           │ Status = YELLOW (40 <= 53 < 70)        │
           └─────────────────────────────────────────┘

           ATTENDANCE CALCULATION:
           ┌─────────────────────────────────────────┐
           │ Check-in time: 09:35                    │
           │ Scheduled start: 09:00                  │
           │ Grace period ends: 09:15                │
           │                                         │
           │ 09:35 > 09:15? YES (LATE!)              │
           │ Status = YELLOW (late)                  │
           │ Score = 75 points                       │
           │ Minutes late = 35 - 15 = 20 mins       │
           └─────────────────────────────────────────┘

           SystemLog: "Pedro Reyes submitted daily check-in
                      (Readiness: YELLOW, Attendance: YELLOW, 20 mins late)"
```

**Impact on Performance:**
```
Pedro's 30-day performance (example):
- 18 days GREEN (100 pts each) = 1800
- 8 days YELLOW (75 pts each)  = 600
- 2 days ABSENT (0 pts each)   = 0
- 2 days EXCUSED               = not counted

Total: 2400 / 28 counted days = 85.7
Grade: B (Good)
```

---

### SCENARIO 3: Worker Gets Injured - Complete Flow

**Characters:**
- **Carlos Garcia** - Worker sa Warehouse Team
- **Ana Mendoza** - Team Leader ng Warehouse Team
- **Dr. Santos** - Company Clinician

**Timeline:**

```
=== JANUARY 6, 2026 (Monday) ===

08:00 AM - Carlos checks in normally (GREEN status)

10:30 AM - ACCIDENT! Carlos slips and injures his back
           while lifting heavy boxes

10:45 AM - Carlos (or Ana) reports incident via /report-incident

           INCIDENT FORM SUBMITTED:
           ┌─────────────────────────────────────────┐
           │ Type: INJURY                            │
           │ Title: "Back injury from lifting"       │
           │ Description: "Slipped while lifting     │
           │              heavy boxes in warehouse"  │
           │ Severity: HIGH                          │
           │ Location: "Warehouse Section B"         │
           │ Incident Date: January 6, 2026          │
           └─────────────────────────────────────────┘

           SYSTEM ACTIONS:

           1. CREATE INCIDENT
              ┌─────────────────────────────────────┐
              │ Case Number: INC-2026-0042          │
              │ Status: OPEN                        │
              │ Reporter: Carlos Garcia             │
              │ Team: Warehouse Team                │
              └─────────────────────────────────────┘

           2. AUTO-CREATE EXCEPTION (because INJURY + HIGH severity)
              ┌─────────────────────────────────────┐
              │ Type: SICK_LEAVE                    │
              │ Status: PENDING                     │
              │ Reason: "Auto-generated from        │
              │         incident INC-2026-0042"     │
              │ Start Date: January 6, 2026         │
              │ End Date: January 6, 2026           │
              │ Linked Incident: INC-2026-0042      │
              └─────────────────────────────────────┘

           3. NOTIFY TEAM LEADER
              → Ana receives notification:
              "A HIGH severity INJURY incident was reported by
               Carlos Garcia. A pending exception request has
               been auto-created and requires your review."

           4. CREATE ACTIVITY LOG
              → IncidentActivity: "Incident reported: Back injury from lifting"

           5. SYSTEM LOG
              → "Carlos Garcia reported incident: Back injury from lifting (HIGH)"
              → "Exception auto-created from HIGH INJURY incident INC-2026-0042"

11:00 AM - Ana sees notification, reviews incident
           Goes to /team/approvals

11:05 AM - Ana APPROVES the exception
           Extends end date to January 10, 2026 (5 days leave)

           SYSTEM ACTIONS:
           ┌─────────────────────────────────────────┐
           │ Exception Status: APPROVED              │
           │ Start: Jan 6, End: Jan 10               │
           │ Approved By: Ana Mendoza                │
           │ Review Note: "Rest and recover. Submit  │
           │              medical cert when able."   │
           └─────────────────────────────────────────┘

           → Notification to Carlos:
             "Your sick leave request has been approved by Ana Mendoza"

           → Incident Activity added:
             "Ana Mendoza approved the linked leave request"

           → Days Jan 6-10 marked as EXCUSED in attendance
             (will NOT count against Carlos's performance)

=== JANUARY 7-10, 2026 (Tuesday-Friday) ===

           Carlos is on approved leave

           SYSTEM BEHAVIOR:
           - If Carlos tries to check in:
             ERROR "You are currently on approved sick leave.
                    Check-in is not required during your leave period."

           - Attendance for these days: EXCUSED (not counted)
           - Streak is PRESERVED (leave covers gap)

=== JANUARY 11, 2026 (Saturday) ===

           Non-work day for Warehouse Team
           No action needed

=== JANUARY 13, 2026 (Monday) - RETURN TO WORK ===

07:55 AM - Carlos opens Aegira app

           SYSTEM DETECTS:
           ┌─────────────────────────────────────────┐
           │ isReturning: true                       │
           │ lastException: SICK_LEAVE (Jan 6-10)    │
           │                                         │
           │ Shows welcome back message              │
           └─────────────────────────────────────────┘

08:02 AM - Carlos checks in:
           - Mood: 6/10
           - Stress: 4/10
           - Sleep: 7/10
           - Physical: 5/10 (still recovering)

           Score = 60 (YELLOW - expected during recovery)

           → SystemLog: "Carlos Garcia submitted daily check-in
                        (Readiness: YELLOW, Attendance: GREEN)
                        - returning from leave"

           → Streak continues! (gap was covered by leave)

=== LATER - RTW CERTIFICATE UPLOAD ===

           Ana or WHS Control uploads Return to Work certificate

           PATCH /incidents/INC-2026-0042/rtw-certificate
           {
             certificateUrl: "https://storage.../carlos-rtw-cert.pdf",
             certDate: "2026-01-12",
             notes: "Cleared for light duties"
           }

           → Incident Activity: "Return to Work Certificate uploaded:
                                Cleared for light duties"

           → Can now close incident if fully resolved
```

**Final State:**
```
Incident INC-2026-0042:
├── Status: RESOLVED (or CLOSED)
├── Reporter: Carlos Garcia
├── Activities:
│   ├── [Jan 6 10:45] CREATED - Incident reported
│   ├── [Jan 6 11:05] COMMENT - Ana approved linked leave
│   ├── [Jan 13 14:00] COMMENT - RTW Certificate uploaded
│   └── [Jan 13 14:05] RESOLVED - Cleared to work
├── Linked Exception: APPROVED (Jan 6-10)
└── RTW Certificate: Uploaded

Carlos's Attendance (Jan 1-13):
├── Jan 1-3: GREEN, GREEN, GREEN
├── Jan 6: GREEN (checked in before accident)
├── Jan 7-10: EXCUSED (approved leave)
├── Jan 13: GREEN (returned)
└── Performance: Not affected by leave days
```

---

### SCENARIO 4: Worker Requests Personal Leave

**Characters:**
- **Lisa Tan** - Worker sa HR Team
- **Mark Reyes** - Team Leader ng HR Team

**Timeline:**

```
=== JANUARY 5, 2026 (Sunday) ===

           Lisa needs to take leave for family event
           Opens Aegira app, goes to /request-exception

           EXCEPTION FORM:
           ┌─────────────────────────────────────────┐
           │ Type: PERSONAL_LEAVE                    │
           │ Start Date: January 8, 2026             │
           │ End Date: January 9, 2026               │
           │ Reason: "Family reunion in province"    │
           │ Notes: "Will be back Jan 10"            │
           └─────────────────────────────────────────┘

           SYSTEM VALIDATES:
           [✓] Lisa has team assigned
           [✓] Team has leader (Mark)

           SYSTEM ACTIONS:
           → Exception created (Status: PENDING)
           → Notification to Mark:
             "Lisa Tan has submitted a personal leave request for review"

=== JANUARY 6, 2026 (Monday) ===

09:00 AM - Mark sees notification
           Goes to /team/approvals
           Reviews Lisa's request

09:15 AM - Mark APPROVES

           SYSTEM ACTIONS:
           ┌─────────────────────────────────────────┐
           │ Exception Status: APPROVED              │
           │ Approved By: Mark Reyes                 │
           │ Approved At: Jan 6, 09:15               │
           └─────────────────────────────────────────┘

           → Notification to Lisa:
             "Your personal leave request has been approved by Mark Reyes"

           → Jan 8-9 will be marked EXCUSED when evaluated

=== JANUARY 8-9, 2026 ===

           Lisa is on approved leave

           If Lisa tries to check in:
           ERROR "You are currently on approved personal leave.
                  Check-in is not required during your leave period."

           Attendance: EXCUSED (not counted in performance)

=== JANUARY 10, 2026 (Friday) ===

08:00 AM - Lisa returns and checks in normally
           Streak preserved (leave covered the gap)
```

---

### SCENARIO 5: Declined Exception Request

**Characters:**
- **Rico Cruz** - Worker
- **Sarah Lim** - Team Leader

**Timeline:**

```
=== JANUARY 6, 2026 ===

           Rico requests leave for January 7-8
           Reason: "Personal errands"

           → Notification sent to Sarah

=== JANUARY 6, 2026 (Later) ===

           Sarah reviews and REJECTS
           Reason: "Critical deadline on Jan 7, need all hands"

           SYSTEM ACTIONS:
           ┌─────────────────────────────────────────┐
           │ Exception Status: REJECTED              │
           │ Rejected By: Sarah Lim                  │
           │ Review Note: "Critical deadline..."     │
           └─────────────────────────────────────────┘

           → Notification to Rico:
             "Your personal leave request has been rejected by Sarah Lim.
              Reason: Critical deadline on Jan 7, need all hands"

=== JANUARY 7, 2026 ===

           Rico MUST check in (no approved leave)

           If Rico doesn't check in:
           → End of day: Status = ABSENT
           → Score = 0
           → Affects performance grade
```

---

### SCENARIO 6: Team Leader Views Team Analytics

**Characters:**
- **Ana Mendoza** - Team Leader ng Warehouse Team (5 members)

**Timeline:**

```
=== JANUARY 6, 2026 ===

02:00 PM - Ana goes to /team/analytics

           SYSTEM FETCHES:
           ┌─────────────────────────────────────────────────┐
           │ TEAM OVERVIEW - Warehouse Team                  │
           │                                                 │
           │ Today's Check-ins: 4/5 (80%)                    │
           │   ├── GREEN: 3 members                          │
           │   ├── YELLOW: 1 member                          │
           │   └── Not checked in: 1 member (Carlos - leave) │
           │                                                 │
           │ Team Readiness Score: 72 (GREEN)                │
           │                                                 │
           │ 30-Day Performance:                             │
           │   ├── Average: 87.5 (Grade B)                   │
           │   ├── Check-in Rate: 94%                        │
           │   ├── On-time Rate: 85%                         │
           │   └── Incidents: 2                              │
           └─────────────────────────────────────────────────┘

02:05 PM - Ana requests AI Summary via /team/ai-chat

           Prompt: "Generate team summary"

           AI RESPONSE:
           ┌─────────────────────────────────────────────────┐
           │ TEAM SUMMARY - Warehouse Team                   │
           │ Period: Dec 7, 2025 - Jan 6, 2026              │
           │                                                 │
           │ Overall Status: ATTENTION                       │
           │                                                 │
           │ Highlights:                                     │
           │ • 94% check-in compliance rate                  │
           │ • Team morale generally positive                │
           │ • 3 members maintaining excellent streaks       │
           │                                                 │
           │ Concerns:                                       │
           │ • 2 workplace injuries this month               │
           │ • Pedro showing declining readiness trend       │
           │ • Higher than average stress levels             │
           │                                                 │
           │ Recommendations:                                │
           │ • Review safety procedures in Section B         │
           │ • Consider 1-on-1 with Pedro                    │
           │ • Team stress management session suggested      │
           └─────────────────────────────────────────────────┘

           → AI Summary saved to database
           → Viewable in /team/ai-insights
```

---

### SCENARIO 7: Performance Calculation Example

**Characters:**
- **Juan Santos** - Worker (30-day period analysis)

```
=== JANUARY 6, 2026 - Viewing Performance ===

Juan goes to /my-history
Clicks "Performance" tab

SYSTEM CALCULATES (Last 30 Days: Dec 7 - Jan 6):

┌──────────────────────────────────────────────────────────┐
│ PERFORMANCE CALCULATION FOR JUAN SANTOS                  │
│                                                          │
│ Team Work Days: MON, TUE, WED, THU, FRI                  │
│ Juan joined team: November 1, 2025                       │
│                                                          │
│ Period: Dec 7, 2025 - Jan 6, 2026                        │
│ Total calendar days: 31                                  │
│ Work days in period: 23                                  │
│                                                          │
│ Breakdown:                                               │
│ ┌─────────────────────────────────────────┐              │
│ │ GREEN (on-time):     18 days × 100 = 1800             │
│ │ YELLOW (late):        3 days ×  75 =  225             │
│ │ ABSENT:               0 days ×   0 =    0             │
│ │ EXCUSED (leave):      2 days (not counted)            │
│ └─────────────────────────────────────────┘              │
│                                                          │
│ Counted Days: 21 (23 work days - 2 excused)              │
│ Total Score: 2025                                        │
│                                                          │
│ Performance = 2025 / 21 = 96.4                           │
│                                                          │
│ GRADE: A (Excellent)                                     │
│                                                          │
│ Streak: 15 consecutive work days                         │
└──────────────────────────────────────────────────────────┘

Note: The 2 EXCUSED days (approved leave) did NOT count against Juan.
If they were ABSENT instead, calculation would be:
  1800 + 225 + 0 = 2025 / 23 = 88.0 (Grade B)
```

---

### SCENARIO 8: System Logs View (Executive/Admin)

**Characters:**
- **Mr. Santos** - Executive

```
=== JANUARY 6, 2026 ===

04:00 PM - Mr. Santos goes to /system-logs
           Filters: Today's activities

SYSTEM SHOWS:
┌────────────────────────────────────────────────────────────────────┐
│ SYSTEM ACTIVITY LOG - January 6, 2026                              │
│                                                                    │
│ 08:06 AM │ CHECKIN_SUBMITTED │ Juan Santos submitted daily         │
│          │                   │ check-in (Readiness: GREEN,         │
│          │                   │ Attendance: GREEN)                  │
│                                                                    │
│ 08:15 AM │ CHECKIN_SUBMITTED │ Maria Cruz submitted daily          │
│          │                   │ check-in (Readiness: GREEN,         │
│          │                   │ Attendance: GREEN)                  │
│                                                                    │
│ 09:36 AM │ CHECKIN_SUBMITTED │ Pedro Reyes submitted daily         │
│          │                   │ check-in (Readiness: YELLOW,        │
│          │                   │ Attendance: YELLOW, 20 mins late)   │
│                                                                    │
│ 10:45 AM │ INCIDENT_CREATED  │ Carlos Garcia reported incident:    │
│          │                   │ Back injury from lifting (HIGH)     │
│                                                                    │
│ 10:45 AM │ EXCEPTION_AUTO_   │ Exception auto-created from HIGH    │
│          │ CREATED           │ INJURY incident INC-2026-0042       │
│                                                                    │
│ 11:05 AM │ EXCEPTION_        │ Ana Mendoza approved sick leave     │
│          │ APPROVED          │ request for Carlos Garcia           │
│                                                                    │
│ 02:30 PM │ AI_SUMMARY_       │ Ana Mendoza generated AI summary    │
│          │ GENERATED         │ for Warehouse Team                  │
│                                                                    │
│ Statistics:                                                        │
│ - Total actions today: 47                                          │
│ - Check-ins: 38                                                    │
│ - Incidents: 2                                                     │
│ - Exceptions: 5                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### SCENARIO 9: Streak Preservation Logic

**Example: How Streak Survives Leave**

```
=== TIMELINE ===

Jan 1 (Wed): Juan checks in → Streak: 1
Jan 2 (Thu): Juan checks in → Streak: 2
Jan 3 (Fri): Juan checks in → Streak: 3
Jan 4 (Sat): Weekend (not work day)
Jan 5 (Sun): Weekend (not work day)
Jan 6 (Mon): Juan checks in → Streak: 4 (weekends don't break streak)

Jan 7 (Tue): Juan on APPROVED leave
Jan 8 (Wed): Juan on APPROVED leave
Jan 9 (Thu): Juan checks in → Streak: 5 (leave doesn't break streak!)

CALCULATION ON JAN 9:
┌─────────────────────────────────────────────────────────┐
│ Last check-in: Jan 6 (Monday)                           │
│ Today: Jan 9 (Thursday)                                 │
│ Days gap: 3                                             │
│                                                         │
│ Check gap days:                                         │
│ - Jan 7 (Tue): Work day, but APPROVED LEAVE ✓          │
│ - Jan 8 (Wed): Work day, but APPROVED LEAVE ✓          │
│                                                         │
│ All work days in gap covered by leave?                  │
│ YES → Streak CONTINUES                                  │
│                                                         │
│ Result: Streak = 4 + 1 = 5                              │
└─────────────────────────────────────────────────────────┘
```

**Example: Streak Breaks**

```
=== TIMELINE ===

Jan 1 (Wed): Juan checks in → Streak: 3
Jan 2 (Thu): Juan FORGETS to check in (no leave) → ABSENT
Jan 3 (Fri): Juan checks in → Streak: 1 (RESET!)

CALCULATION ON JAN 3:
┌─────────────────────────────────────────────────────────┐
│ Last check-in: Jan 1 (Wednesday)                        │
│ Today: Jan 3 (Friday)                                   │
│ Days gap: 2                                             │
│                                                         │
│ Check gap days:                                         │
│ - Jan 2 (Thu): Work day, NO APPROVED LEAVE ✗           │
│                                                         │
│ Gap covered by leave? NO                                │
│ Streak RESETS to 1                                      │
└─────────────────────────────────────────────────────────┘
```

---

### QUICK REFERENCE: System Responses

| Situation | System Response |
|-----------|-----------------|
| Worker tries to check in twice | "Already checked in today" (400) |
| Worker tries to check in on Saturday | "Today is not a scheduled work day" (400) |
| Worker tries to check in at 6 AM (shift 8 AM) | "Check-in not yet available" (400) |
| Worker tries to check in while on leave | "You are currently on approved leave" (400) |
| Team Lead tries to check in | "Daily check-in is only required for team members" (400) |
| Worker without team tries to check in | "You must be assigned to a team" (400) |
| HIGH severity INJURY reported | Auto-creates PENDING exception |
| Exception approved | Days marked EXCUSED, notification sent |
| Worker returns from leave | "isReturning: true" flag, streak preserved |

---

*Scenarios based on actual system logic implementation.*

---

*Document generated by Claude Code system review.*
