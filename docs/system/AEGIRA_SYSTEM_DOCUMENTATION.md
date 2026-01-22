# AEGIRA - Personnel Readiness Management System

## System Overview

Ang **Aegira** ay isang enterprise web application para sa **Personnel Readiness Management**. Ito ay ginawa para i-track ang employee wellness, readiness status, incidents, at health-related data ng mga personnel sa isang kumpanya.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js + TypeScript, Hono Framework |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | Supabase Auth + JWT Tokens |
| **AI/ML** | OpenAI (GPT-4o-mini) |
| **Frontend** | React 19 + TypeScript, Vite |
| **State Management** | Zustand + React Query |
| **Styling** | Tailwind CSS |
| **File Storage** | AWS S3 / Cloudflare R2 (optional) |

---

## Core Features

### 1. Daily Check-in System
- Employees mag-assess ng kanilang readiness araw-araw
- Metrics: Mood, Stress, Sleep, Physical Health (1-10 scale)
- Auto-calculate ng Readiness Score (GREEN/YELLOW/RED)
- AI-powered insights para sa check-in analysis

### 2. Readiness Scoring Algorithm
```
Calculation:
- Normalize all scores to 0-100
- Invert stress (high stress = low score)
- Weighted average: 25% each metric
- Result: GREEN >= 70, YELLOW 40-69, RED < 40
```

### 3. Incident Management
- Full lifecycle: Report -> Investigation -> Resolution -> Closed
- Severity levels: LOW, MEDIUM, HIGH, CRITICAL
- Activity timeline at audit trail
- Assignment system para sa incident handlers
- Case number generation (INC-YYYY-XXXX)

### 4. Exception/Leave Management
- Request types: Sick Leave, Personal Leave, Medical Appointment, Family Emergency
- Approval workflow (Team Lead/Supervisor approval)
- Document attachment support

### 5. Team Management
- Team creation at member assignment
- Shift schedule configuration
- Work days setup
- Team-level analytics

### 6. Multi-tenant Architecture
- Company isolation (data separation)
- Role-based access control
- Invitation system para mag-join ng company

### 7. Analytics Dashboard
- Real-time readiness metrics
- Team health trends
- Check-in rates
- Incident statistics

### 8. Streak Tracking (Gamification)
- Consecutive work days na may check-in
- Longest streak tracking
- Motivation feature para sa employees

### 9. System Logs (Admin Feature)
- Track all system activities
- Filter by action type, entity type, date range
- Search functionality
- User activity monitoring
- Statistics and insights
- Available for ADMIN and EXECUTIVE roles only

---

## Role Hierarchy at Permissions

```
EXECUTIVE (Level 5)
    ├── Full control ng company
    ├── Create/manage all users
    ├── Company settings
    └── View all data

ADMIN (Level 4)
    ├── Manage users (except Executive)
    ├── Team management
    └── View all personnel

SUPERVISOR (Level 3)
    ├── View all personnel
    ├── Approve exceptions
    └── Analytics access

TEAM_LEAD (Level 2)
    ├── Manage own team
    ├── Approve team exceptions
    └── Team analytics

MEMBER (Level 1)
    ├── Daily check-in
    ├── Report incidents
    └── Request exceptions
```

### Permission Matrix

| Action | EXECUTIVE | ADMIN | SUPERVISOR | TEAM_LEAD | MEMBER |
|--------|-----------|-------|------------|-----------|--------|
| Create Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Personnel | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Teams | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve Exceptions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Invite Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Company Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Daily Check-in | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Database Models

### Core Entities

| Model | Description |
|-------|-------------|
| `Company` | Multi-tenant container (companies) |
| `User` | Personnel with roles |
| `Team` | Group of members |
| `Checkin` | Daily readiness assessment |
| `Incident` | Workplace incidents |
| `IncidentActivity` | Audit trail for incidents |
| `Exception` | Leave/absence requests |
| `Schedule` | Work schedules |
| `Notification` | User notifications |
| `Invitation` | User invitations |
| `SystemLog` | System activity logs (Admin) |

### Advanced Features (Future)

| Model | Description |
|-------|-------------|
| `Rehabilitation` | Post-incident recovery |
| `Certificate` | Employee certifications |
| `Alert` | AI-powered warnings |
| `OneOnOne` | Manager meetings |
| `PulseSurvey` | Team surveys |
| `Recognition` | Peer kudos |
| `WellnessSnapshot` | Daily aggregates |

---

## API Modules

### 1. Auth Module (`/api/auth`)
```
POST /register              - Register company + executive
POST /register-with-invite  - Join existing company
POST /login                 - Login user
POST /refresh               - Refresh token
POST /logout                - Logout user
POST /forgot-password       - Request password reset
POST /reset-password        - Reset password
```

### 2. Users Module (`/api/users`)
```
POST /                      - Create user (Executive only)
GET /me                     - Get current user
PUT /me                     - Update profile
PUT /me/password            - Change password
GET /                       - List users (paginated)
GET /:id                    - Get user by ID
PUT /:id/role               - Change user role
DELETE /:id                 - Soft delete user
PUT /:id/reactivate         - Reactivate user
```

### 3. Teams Module (`/api/teams`)
```
GET /                       - List all teams
GET /:id                    - Get team details
GET /:id/statistics         - Get team stats
POST /                      - Create team
PUT /:id                    - Update team
DELETE /:id                 - Delete team
POST /:id/members           - Add member
DELETE /:id/members/:userId - Remove member
```

### 4. Checkins Module (`/api/checkins`)
```
POST /                      - Submit daily check-in
GET /today                  - Get today's check-in
GET /my                     - List personal check-ins
GET /                       - List all check-ins (admin)
GET /:id                    - Get check-in details
```

### 5. Incidents Module (`/api/incidents`)
```
POST /                      - Report incident
GET /                       - List incidents
GET /:id                    - Get incident details
PUT /:id                    - Update incident
PUT /:id/status             - Change status
PUT /:id/assign             - Assign to personnel
POST /:id/comments          - Add comment
GET /:id/activities         - Get timeline
```

### 6. Exceptions Module (`/api/exceptions`)
```
POST /                      - Request exception
GET /                       - List exceptions
GET /:id                    - Get exception details
PUT /:id/approve            - Approve exception
PUT /:id/reject             - Reject exception
```

### 7. Analytics Module (`/api/analytics`)
```
GET /dashboard              - Dashboard stats
GET /personnel              - Personnel trends
GET /team/:id               - Team analytics
```

### 8. Invitations Module (`/api/invitations`)
```
POST /                      - Send invitation
GET /                       - List invitations
GET /verify/:token          - Verify invitation
DELETE /:id                 - Cancel invitation
```

### 9. System Logs Module (`/api/system-logs`) - Admin Only
```
GET /                       - List all system logs (paginated, filterable)
GET /stats                  - Get log statistics
GET /actions                - Get available action types
GET /entity-types           - Get available entity types
GET /:id                    - Get single log detail
```

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `action` - Filter by action type
- `entityType` - Filter by entity type (user, team, incident, etc.)
- `userId` - Filter by user
- `startDate` - Filter from date
- `endDate` - Filter to date
- `search` - Search in description

---

## Frontend Routes

### Member Pages
| Route | Description |
|-------|-------------|
| `/checkin` | Daily check-in form |
| `/my-status` | Readiness status dashboard |
| `/my-history` | Check-in history |
| `/my-incidents` | Personal incidents |
| `/report-incident` | Report new incident |
| `/request-exception` | Request leave |

### Team Lead Pages
| Route | Description |
|-------|-------------|
| `/team/overview` | Team dashboard |
| `/team/approvals` | Exception approvals |
| `/team/incidents` | Team incidents |
| `/team/analytics` | Team analytics |

### Admin Pages
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard with overview |
| `/admin/system-logs` | System activity logs |
| `/dashboard` | Operations dashboard |
| `/personnel` | Personnel list |
| `/analytics` | Company analytics |
| `/executive/users` | User management |
| `/executive/teams` | Team management |
| `/executive/invitations` | Invitation management |

### Supervisor Pages
| Route | Description |
|-------|-------------|
| `/dashboard` | Company dashboard |
| `/personnel` | Personnel list |
| `/analytics` | Company analytics |

### Executive Pages
| Route | Description |
|-------|-------------|
| `/executive` | Executive dashboard |
| `/executive/users` | User management |
| `/executive/teams` | Team management |
| `/executive/invitations` | Invitation management |
| `/executive/create-account` | Bulk user creation |

---

## Core Workflows

### 1. Daily Check-in Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  START: User navigates to /checkin                          │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  VALIDATION:                                                 │
│  - User must be MEMBER role                                  │
│  - User must be assigned to a team                           │
│  - Must be within shift hours (30-min grace)                 │
│  - Cannot check-in twice same day                            │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  INPUT:                                                      │
│  - Mood (1-10)                                               │
│  - Stress (1-10)                                             │
│  - Sleep (1-10)                                              │
│  - Physical Health (1-10)                                    │
│  - Notes (optional)                                          │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  CALCULATION:                                                │
│  - Normalize scores to 0-100                                 │
│  - Invert stress score                                       │
│  - Weighted average (25% each)                               │
│  - Determine status: GREEN/YELLOW/RED                        │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  UPDATE:                                                     │
│  - Save check-in record                                      │
│  - Update user streak                                        │
│  - Generate AI insights (optional)                           │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  END: Return readiness score and status                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Incident Reporting Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  START: User reports incident                                │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  CREATE:                                                     │
│  - Generate case number (INC-YYYY-XXXX)                      │
│  - Set initial status: OPEN                                  │
│  - Create IncidentActivity (CREATED)                         │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  INVESTIGATION:                                              │
│  - Team Lead/Supervisor reviews                              │
│  - Assign to handler                                         │
│  - Update status: IN_PROGRESS                                │
│  - Add comments/activities                                   │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  RESOLUTION:                                                 │
│  - Mark as RESOLVED                                          │
│  - Add resolution notes                                      │
│  - Optional: Create rehabilitation plan                      │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOSURE:                                                    │
│  - Final review                                              │
│  - Mark as CLOSED                                            │
│  - Archive                                                   │
└─────────────────────────────────────────────────────────────┘
```

### 3. Exception Request Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  START: Member requests exception                            │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  REQUEST:                                                    │
│  - Type: Sick Leave/Personal/Medical/Emergency               │
│  - Start date, End date                                      │
│  - Reason                                                    │
│  - Attachments (optional)                                    │
│  - Status: PENDING                                           │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  REVIEW:                                                     │
│  - Team Lead/Supervisor receives notification                │
│  - Review request details                                    │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
            ┌─────────┴─────────┐
            ▼                   ▼
┌───────────────────┐ ┌───────────────────┐
│  APPROVED         │ │  REJECTED         │
│  - approvedBy     │ │  - rejectedBy     │
│  - approvedAt     │ │  - rejectedAt     │
│  - Status: OK     │ │  - Status: DENIED │
└───────────────────┘ └───────────────────┘
```

---

## System Planning Guide

### Phase 1: Core Foundation (Completed)
- [x] Project setup (Backend + Frontend)
- [x] Database schema design
- [x] Authentication system (Supabase + JWT)
- [x] User management
- [x] Role-based access control
- [x] Multi-tenant architecture

### Phase 2: Core Features (Completed)
- [x] Daily check-in system
- [x] Readiness score calculation
- [x] Incident reporting
- [x] Exception requests
- [x] Team management
- [x] Basic analytics

### Phase 3: Enhancement (In Progress)
- [x] Invitation system
- [x] Activity audit trails
- [x] AI-powered insights
- [ ] File upload system
- [ ] Email notifications
- [ ] Push notifications

### Phase 4: Advanced Features (Planned)
- [ ] Rehabilitation tracking
- [ ] Certificate management
- [ ] Pulse surveys
- [ ] Recognition/Kudos system
- [ ] Alert intelligence
- [ ] One-on-one meetings
- [ ] Wellness heatmaps

### Phase 5: Enterprise Features (Future)
- [ ] Advanced reporting
- [ ] Data export (CSV/PDF)
- [ ] API rate limiting
- [ ] Audit logs
- [ ] SSO integration
- [ ] Mobile app (React Native)
- [ ] Offline support

---

## Implementation Checklist

### Backend Tasks
- [ ] Complete rehabilitation module
- [ ] Complete certificate module
- [ ] Implement file upload to R2
- [ ] Add email notifications (Resend/SendGrid)
- [ ] Implement alert system
- [ ] Add pulse survey endpoints
- [ ] Implement recognition system
- [ ] Add data export endpoints
- [ ] Rate limiting middleware
- [ ] API documentation (Swagger)

### Frontend Tasks
- [ ] My Schedule page
- [ ] My Certificates page
- [ ] Executive Settings page
- [ ] Rehabilitation pages
- [ ] Alert notifications UI
- [ ] Pulse survey components
- [ ] Recognition/Kudos UI
- [ ] Data export buttons
- [ ] Improve mobile responsiveness
- [ ] Dark mode support

### DevOps Tasks
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Environment configuration
- [ ] Database backup strategy
- [ ] Monitoring setup (logs, metrics)
- [ ] Load testing
- [ ] Security audit

---

## Project Structure

```
D:\Aegira/
├── backend/
│   ├── src/
│   │   ├── server.ts           # HTTP server entry
│   │   ├── app.ts              # Hono app setup
│   │   ├── routes.ts           # API route aggregation
│   │   ├── config/             # Configuration files
│   │   │   ├── env.ts
│   │   │   ├── prisma.ts
│   │   │   ├── supabase.ts
│   │   │   └── r2.ts
│   │   ├── middlewares/        # Middleware functions
│   │   │   ├── auth.ts
│   │   │   ├── error.ts
│   │   │   └── role.ts
│   │   ├── modules/            # Feature modules
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── teams/
│   │   │   ├── checkins/
│   │   │   ├── incidents/
│   │   │   ├── exceptions/
│   │   │   ├── analytics/
│   │   │   ├── invitations/
│   │   │   └── ...
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Utility functions
│   │       ├── readiness.ts    # Score calculation
│   │       ├── ai.ts           # OpenAI integration
│   │       └── logger.ts
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                # Router and guards
│   │   ├── pages/              # Page components
│   │   │   ├── auth/
│   │   │   ├── worker/
│   │   │   ├── team-lead/
│   │   │   ├── supervisor/
│   │   │   └── executive/
│   │   ├── components/         # Reusable components
│   │   │   ├── ui/
│   │   │   └── layout/
│   │   ├── services/           # API services
│   │   ├── store/              # Zustand stores
│   │   ├── hooks/              # Custom hooks
│   │   ├── types/              # TypeScript types
│   │   ├── lib/                # Utilities
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
└── Documentation files
```

---

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/aegira"

# Supabase
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# JWT
JWT_SECRET="your-secret-key"

# OpenAI (Optional)
OPENAI_API_KEY="sk-..."

# R2 Storage (Optional)
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="aegira-uploads"
R2_ACCOUNT_ID="..."

# Server
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

---

## Quick Commands

### Backend
```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev

# Build for production
npm run build
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## Security Features

1. **JWT Authentication** - Access token (15min) + Refresh token (7 days)
2. **httpOnly Cookies** - Secure token storage
3. **Company Scoping** - All queries filtered by companyId
4. **Role-based Access** - Permission checks on every endpoint
5. **Input Validation** - Zod schemas for all inputs
6. **Error Handling** - Standardized error responses
7. **Audit Trail** - Activity logging for incidents

---

## Key Files Reference

| Purpose | Backend | Frontend |
|---------|---------|----------|
| Entry Point | `src/server.ts` | `src/main.tsx` |
| App Setup | `src/app.ts` | `src/App.tsx` |
| Routes | `src/routes.ts` | `src/app/router.tsx` |
| Auth Middleware | `src/middlewares/auth.ts` | `src/app/guards/` |
| Auth Service | `src/modules/auth/` | `src/services/auth.service.ts` |
| User Service | `src/modules/users/` | `src/services/user.service.ts` |
| Check-in Logic | `src/modules/checkins/` | `src/pages/worker/CheckinPage.tsx` |
| Incident Logic | `src/modules/incidents/` | `src/pages/worker/ReportIncidentPage.tsx` |
| Score Calculation | `src/utils/readiness.ts` | - |
| AI Integration | `src/utils/ai.ts` | - |
| Auth Store | - | `src/store/auth.store.ts` |
| API Client | - | `src/lib/axios.ts` |

---

## Notes

- Ang system ay designed para sa enterprise use
- Multi-tenant architecture para sa multiple companies
- Scalable at production-ready na architecture
- May AI integration para sa intelligent insights
- Mobile-responsive ang frontend design

---

*Last Updated: December 2024*
*Version: 1.0*
