# AEGIRA Personnel Readiness Management System
## System Workflow Documentation

---

## 1. System Overview

Ang AEGIRA ay isang Personnel Readiness Management System na nagmo-monitor ng wellness at readiness ng mga workers. Ang system ay gumagamit ng daily check-in mechanism para i-assess ang readiness ng bawat worker at may approval workflow para sa mga exceptions/exemptions.

### Tech Stack
- **Backend:** Node.js + TypeScript + Hono Framework
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** Supabase Auth + JWT
- **Frontend:** React 19 + TypeScript + Vite
- **File Storage:** AWS S3 / Cloudflare R2

---

## 2. Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                        ADMIN (Level 6)                       │
│               System-wide control, super-admin               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     EXECUTIVE (Level 5)                      │
│              Company owner, full company control             │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
│  SUPERVISOR   │ │   CLINICIAN   │ │  WHS_CONTROL  │
│   (Level 4)   │ │   (Level 4)   │ │   (Level 4)   │
│ Multi-team    │ │ Rehab domain  │ │ Safety domain │
└───────┬───────┘ └───────────────┘ └───────────────┘
        │
┌───────▼─────────────────────────────────────────────────────┐
│                     TEAM_LEAD (Level 3)                      │
│            Single team management, approval authority        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   WORKER/MEMBER (Level 2)                    │
│         Basic worker access, daily check-in, requests        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Permission Matrix

| Permission                | ADMIN | EXEC | SUPER | TL | WORKER |
|--------------------------|:-----:|:----:|:-----:|:--:|:------:|
| Create Users             | ✅    | ✅   | ❌    | ❌ | ❌     |
| Manage Users             | ✅    | ✅   | ❌    | ❌ | ❌     |
| View All Personnel       | ✅    | ✅   | ✅    | ❌ | ❌     |
| Manage Teams             | ✅    | ✅   | ✅    | ✅ (own) | ❌ |
| Approve Exceptions       | ✅    | ✅   | ✅    | ✅ (own team) | ❌ |
| View Team Analytics      | ✅    | ✅   | ✅    | ✅ (own) | ❌ |
| Daily Check-in           | ❌    | ❌   | ❌    | ❌ | ✅     |
| Report Incidents         | ❌    | ❌   | ❌    | ❌ | ✅     |
| Request Exceptions       | ❌    | ❌   | ❌    | ❌ | ✅     |
| View Own Data Only       | ❌    | ❌   | ❌    | ❌ | ✅     |

---

## 4. Worker to Team Leader Workflow

### 4.1 Daily Check-in Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          WORKER DAILY CHECK-IN                            │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Worker submits daily readiness check-in:                                 │
│  • Mood (1-10)                                                           │
│  • Stress (1-10)                                                         │
│  • Sleep (1-10)                                                          │
│  • Physical Health (1-10)                                                │
│  • Optional notes                                                        │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    SYSTEM CALCULATES READINESS SCORE                      │
│  Formula: 25% weighted average of normalized metrics (stress inverted)   │
│  Result: Score 0-100                                                      │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
   │  GREEN (70+)   │    │ YELLOW (40-69) │    │   RED (<40)    │
   │  Ready to work │    │    Caution     │    │   CRITICAL     │
   └────────┬───────┘    └────────┬───────┘    └────────┬───────┘
            │                     │                     │
            ▼                     ▼                     ▼
   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
   │ Normal check-in│    │ Monitor worker │    │ Trigger        │
   │ completed      │    │ optional notes │    │ EXEMPTION FLOW │
   └────────────────┘    └────────────────┘    └────────┬───────┘
                                                        │
                                                        ▼
                                          ┌─────────────────────────┐
                                          │ Worker requests         │
                                          │ EXEMPTION with:         │
                                          │ • Type (leave type)     │
                                          │ • Reason                │
                                          │ • checkinId reference   │
                                          └─────────────┬───────────┘
                                                        │
                                                        ▼
                                          ┌─────────────────────────┐
                                          │ TEAM LEAD reviews       │
                                          │ (See Section 4.2)       │
                                          └─────────────────────────┘
```

### 4.2 Exception/Exemption Approval Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    WORKER CREATES EXCEPTION REQUEST                       │
│  Types: SICK_LEAVE, PERSONAL_LEAVE, MEDICAL_APPOINTMENT,                 │
│         FAMILY_EMERGENCY, OTHER                                          │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     STATUS: PENDING                                       │
│  Team Lead receives notification                                          │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      TEAM LEAD REVIEW                                     │
│  • Views pending exceptions: GET /exceptions/pending                      │
│  • Reviews worker profile & history                                       │
│  • Checks recent check-ins & incidents                                   │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│         APPROVE               │  │          REJECT               │
│ PATCH /exceptions/:id/approve │  │ PATCH /exceptions/:id/reject  │
├───────────────────────────────┤  ├───────────────────────────────┤
│ Team Lead sets:               │  │ Team Lead provides:           │
│ • Return date                 │  │ • Rejection reason            │
│ • Approval notes (optional)   │  │                               │
└───────────────┬───────────────┘  └───────────────┬───────────────┘
                │                                  │
                ▼                                  ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ STATUS: APPROVED              │  │ STATUS: REJECTED              │
│ • Worker marked ON LEAVE      │  │ • Worker remains ACTIVE       │
│ • Notification sent to worker │  │ • Notification sent to worker │
│ • Excluded from compliance    │  │ • Must check-in as normal     │
└───────────────┬───────────────┘  └───────────────────────────────┘
                │
                ▼
┌───────────────────────────────┐
│ DURING APPROVED LEAVE:        │
│ • Worker cannot check-in      │
│ • Excluded from attendance    │
│ • Until return date           │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ ON RETURN DATE:               │
│ • Worker must check-in        │
│ • Leave period ends           │
│ • Normal workflow resumes     │
│ • STATUS: COMPLETED           │
└───────────────────────────────┘
```

### 4.3 Exception Status Lifecycle

```
                              ┌─────────┐
                              │ PENDING │
                              └────┬────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
     ┌──────────┐          ┌──────────┐           ┌───────────┐
     │ APPROVED │          │ REJECTED │           │ CANCELLED │
     └────┬─────┘          └──────────┘           └───────────┘
          │
          ▼
     ┌──────────┐
     │  ACTIVE  │ (within date range)
     └────┬─────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
┌─────────┐ ┌───────────┐
│ ENDED   │ │ COMPLETED │
│ EARLY   │ │ (auto)    │
└─────────┘ └───────────┘
```

---

## 5. Team Leader Dashboard Functions

### 5.1 Team Management
```
GET    /teams/my              → Get current team with member stats
GET    /teams/:id/stats       → Team statistics
GET    /teams/my/analytics    → Detailed analytics dashboard
POST   /teams/:id/members     → Add member to team
DELETE /teams/:id/members/:id → Remove member from team
```

### 5.2 Member Oversight
```
GET /teams/members/:id/profile     → Full member profile
GET /teams/members/:id/checkins    → Check-in history (paginated)
GET /teams/members/:id/exemptions  → Exemption history
GET /teams/members/:id/incidents   → Incident history
GET /teams/members/:id/analytics   → Member analytics & trends
```

### 5.3 Analytics Dashboard Data
- **Team Grade:** A+ to F based on readiness + compliance
- **Status Distribution:** GREEN/YELLOW/RED counts
- **Average Readiness Score:** Team-wide average
- **Compliance Rate:** Check-in rate percentage
- **Members Needing Attention:** RED status, missing check-in
- **Members On Leave:** Approved exemptions
- **Top Reasons:** Common reasons for low scores
- **Trend Data:** Over selected time period

---

## 6. Readiness Score Calculation

### Formula
```
Readiness Score = ((mood + (10 - stress) + sleep + physicalHealth) / 40) × 100
```

### Status Thresholds
| Score Range | Status | Meaning |
|-------------|--------|---------|
| 70 - 100    | 🟢 GREEN  | Ready to work |
| 40 - 69     | 🟡 YELLOW | Caution, proceed with care |
| 0 - 39      | 🔴 RED    | Critical, not ready |

---

## 7. Key Database Relationships

### User → Team Relationship
```
User {
  teamId        → Team (worker belongs to)
  leadingTeams  → Team[] (teams they lead)
}

Team {
  leaderId  → User (team leader)
  members   → User[] (team members)
}
```

### Exception → User/Team Relationship
```
Exception {
  userId     → User (requester - worker)
  approverId → User (approver - team lead)
  teamId     → Team (worker's team)
}
```

---

## 8. API Endpoints Summary

### Worker Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /checkins | Submit daily check-in |
| GET    | /checkins/my | View own check-in history |
| POST   | /exceptions | Create exception request |
| POST   | /exemptions | Create exemption (from RED check-in) |
| GET    | /exceptions/my | View own exceptions |
| POST   | /incidents | Report incident |

### Team Lead Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /exceptions/pending | View pending exceptions |
| PATCH  | /exceptions/:id/approve | Approve exception |
| PATCH  | /exceptions/:id/reject | Reject exception |
| PATCH  | /exceptions/:id/end-early | End exception early |
| GET    | /teams/my | Get team with stats |
| GET    | /teams/my/analytics | Team analytics dashboard |
| GET    | /teams/members/:id/profile | View member profile |
| POST   | /teams/:id/members | Add team member |
| DELETE | /teams/:id/members/:id | Remove team member |

---

## 9. Business Rules

### Rule 1: Team Requirement
- Worker MUST be assigned to a team with a Team Lead before:
  - Requesting exceptions
  - Reporting incidents
  - Submitting exemptions

### Rule 2: Approval Authority
- Only TEAM_LEAD role and above can approve exceptions
- Team Leads can only approve for their own team members
- Supervisors and Executives can approve for any team

### Rule 3: Leave Compliance
- Workers on approved leave are excluded from compliance calculations
- On return date, worker MUST check-in (not exempted that day)
- If worker on leave checks in before return date: check-in is invalid

### Rule 4: Multi-tenant Isolation
- All queries filter by companyId
- Users can only see data from their own company
- ADMIN role can override for super-admin access

---

## 10. File Structure Reference

### Core Modules
```
backend/src/modules/
├── auth/              → Authentication & registration
├── users/             → User management
├── teams/             → Team management & analytics
├── checkins/          → Daily check-in submission
├── exceptions/        → Exception CRUD & approval
├── exemptions/        → RED-triggered exemptions
├── incidents/         → Incident reporting
└── system-logs/       → Audit trail
```

### Key Files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema with all models |
| `src/types/roles.ts` | Role hierarchy & permissions |
| `src/utils/readiness.ts` | Readiness score calculation |
| `src/utils/leave.ts` | Leave status checking |
| `src/middlewares/auth.middleware.ts` | Auth & role enforcement |

---

## 11. Scenarios

### Scenario 1: Normal Day - Worker Checks In GREEN
```
1. Worker Juan logs in at 8:00 AM
2. Submits daily check-in:
   - Mood: 8/10
   - Stress: 2/10
   - Sleep: 7/10
   - Physical Health: 8/10
3. System calculates: ((8 + 8 + 7 + 8) / 40) × 100 = 77.5
4. Status: GREEN ✅
5. Juan proceeds with normal work day
6. Team Lead sees Juan as "checked in" in dashboard
```

### Scenario 2: Worker Gets YELLOW Status
```
1. Worker Maria logs in at 8:30 AM
2. Submits daily check-in:
   - Mood: 5/10
   - Stress: 6/10
   - Sleep: 5/10
   - Physical Health: 6/10
3. System calculates: ((5 + 4 + 5 + 6) / 40) × 100 = 50
4. Status: YELLOW ⚠️
5. Maria adds notes: "Hindi nakatulog ng maayos"
6. Team Lead monitors Maria - may optional follow-up
7. Maria continues work but under observation
```

### Scenario 3: Worker Gets RED Status → Exemption Request
```
1. Worker Pedro logs in at 9:00 AM
2. Submits daily check-in:
   - Mood: 2/10
   - Stress: 9/10
   - Sleep: 2/10
   - Physical Health: 3/10
3. System calculates: ((2 + 1 + 2 + 3) / 40) × 100 = 20
4. Status: RED 🔴 CRITICAL

5. Pedro requests EXEMPTION:
   - Type: SICK_LEAVE
   - Reason: "Sobrang pagod at stress, hindi kayang mag-focus"
   - Linked to: checkinId of RED check-in

6. Team Lead Ana receives notification:
   "New pending exemption from Pedro"

7. Ana reviews:
   - Views Pedro's recent check-ins (declining trend)
   - Checks Pedro's exception history
   - Reviews incident reports

8. Ana APPROVES exemption:
   - Sets return date: 3 days from now
   - Notes: "Rest well, see you on Friday"

9. Pedro receives notification:
   "Your exemption has been approved. Return date: Friday"

10. For next 3 days:
    - Pedro marked as "ON LEAVE"
    - Excluded from compliance calculations
    - Cannot submit check-ins

11. On Friday:
    - Pedro must check-in
    - Normal workflow resumes
```

### Scenario 4: Team Lead Rejects Exemption
```
1. Worker Luis requests exception:
   - Type: PERSONAL_LEAVE
   - Reason: "May lakad ako bukas"

2. Team Lead Ana reviews:
   - Sees Luis has multiple recent absences
   - Important project deadline tomorrow
   - No prior notice given

3. Ana REJECTS exemption:
   - Reason: "Critical deadline tomorrow. Please coordinate
              leave requests at least 1 week in advance."

4. Luis receives notification:
   "Your exemption was rejected. Reason: Critical deadline..."

5. Luis remains ACTIVE and must check-in tomorrow
```

### Scenario 5: Team Lead Views Daily Dashboard
```
1. Team Lead Ana logs in at 7:30 AM
2. Opens Team Dashboard (/teams/my/analytics)

3. Dashboard shows:
   ┌─────────────────────────────────────────┐
   │ Team: Operations Alpha                   │
   │ Grade: B+                                │
   │ Members: 12                              │
   ├─────────────────────────────────────────┤
   │ Today's Status:                          │
   │ 🟢 GREEN: 8 members                      │
   │ 🟡 YELLOW: 2 members                     │
   │ 🔴 RED: 1 member                         │
   │ ❌ Not checked in: 1 member              │
   ├─────────────────────────────────────────┤
   │ Compliance Rate: 91.7%                   │
   │ Avg Readiness: 72.3                      │
   ├─────────────────────────────────────────┤
   │ ⚠️ NEEDS ATTENTION:                      │
   │ • Pedro - RED status                     │
   │ • Luis - Not checked in                  │
   ├─────────────────────────────────────────┤
   │ 📋 Pending Exceptions: 2                 │
   │ • Pedro - SICK_LEAVE (pending)           │
   │ • Maria - PERSONAL_LEAVE (pending)       │
   └─────────────────────────────────────────┘

4. Ana takes action:
   - Reviews Pedro's exemption → Approves
   - Follows up with Luis (not checked in)
   - Reviews Maria's request → Approves/Rejects
```

### Scenario 6: Worker Reports Incident
```
1. Worker Juan witnesses safety incident at workplace
2. Reports incident via /incidents:
   - Type: SAFETY_HAZARD
   - Description: "Wet floor near entrance, no warning sign"
   - Location: "Main entrance"
   - Severity: MEDIUM

3. Team Lead Ana receives notification

4. Ana reviews and escalates:
   - Assigns to WHS_CONTROL for investigation
   - Documents the incident
   - Follows up on resolution
```

### Scenario 7: Supervisor Monitors Multiple Teams
```
1. Supervisor Carlos logs in
2. Has access to all teams under their supervision

3. Views company-wide analytics:
   ┌─────────────────────────────────────────┐
   │ Company Overview                         │
   ├─────────────────────────────────────────┤
   │ Team Alpha: Grade A  (Compliance 95%)    │
   │ Team Beta:  Grade B+ (Compliance 88%)    │
   │ Team Gamma: Grade C  (Compliance 72%)    │
   └─────────────────────────────────────────┘

4. Identifies Team Gamma needs attention
5. Drills down to Team Gamma analytics
6. Coordinates with Team Gamma's Team Lead
```

### Scenario 8: End Exception Early
```
1. Worker Pedro on approved leave until Friday
2. Pedro feels better on Wednesday
3. Contacts Team Lead Ana

4. Ana uses: PATCH /exceptions/:id/end-early
   - Sets new end date: Wednesday
   - Notes: "Worker recovered early"

5. Pedro's leave ends immediately
6. Pedro must check-in on Thursday
7. Status changes: ENDED_EARLY
```

---

## 12. Security & Audit

### Audit Trail
Every action is logged in SystemLog:
- USER_CREATED
- USER_UPDATED
- EXCEPTION_CREATED
- EXCEPTION_APPROVED
- EXCEPTION_REJECTED
- CHECKIN_SUBMITTED
- INCIDENT_REPORTED

### Access Control
- JWT tokens required for all API requests
- Role validation on every request
- Team-scoped access for Team Leads
- Company-scoped isolation for all users

---

## 13. Summary

Ang AEGIRA system ay may clear na workflow:

1. **Worker** → Check-in daily → Gets readiness status
2. **RED status** → Triggers exemption request
3. **Team Lead** → Reviews and approves/rejects
4. **System** → Tracks compliance and analytics
5. **All actions** → Logged for audit

Ang Team Lead ang primary gatekeeper para sa worker exemptions at ang responsible sa monitoring ng team performance.

---

*Document Version: 1.0*
*Last Updated: January 7, 2026*
