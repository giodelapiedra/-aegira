# WHS Control Role - Integration Design

## Current System State

### Existing Role Hierarchy
```
EXECUTIVE (5) → ADMIN (4) → SUPERVISOR (3) → TEAM_LEAD (2) → MEMBER (1)
```

### Proposed New Hierarchy
```
                    ┌─────────────┐
                    │    ADMIN    │ Level 6 (System-wide)
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  EXECUTIVE  │ Level 5 (Company owner)
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐
│  SUPERVISOR   │  │   CLINICIAN   │  │  WHS_CONTROL  │  Level 4 (Parallel)
│ (Multi-team)  │  │  (Rehab mgmt) │  │    (Certs)    │
└───────┬───────┘  └───────────────┘  └───────────────┘
        │
┌───────┴───────┐
│  TEAM_LEAD    │ Level 3 (Single team)
└───────┬───────┘
        │
┌───────┴───────┐
│    WORKER     │ Level 2 (Daily operations)
└───────────────┘
```

**Note**: MEMBER → WORKER (rename for clarity)

---

## Existing Features to Integrate

| Feature | Current Status | WHS Integration |
|---------|----------------|-----------------|
| **Incidents** | ✅ Fully implemented | View all incidents, link certs |
| **Certificates** | ❌ TODO (stub only) | **MAIN FOCUS** - Full implementation |
| **Rehabilitation** | ❌ TODO (stub only) | View only (Clinician manages) |
| **System Logs** | ✅ Implemented | Certificate actions logged |
| **Analytics** | ✅ Implemented | Add cert compliance metrics |
| **Notifications** | ✅ Model exists | Expiry alerts |

---

## WHS Control Features

### 1. Certificate Management (Primary)

#### 1.1 Certificate Types (NEW Model)
Define standard certificate types for the company.

```prisma
model CertificateType {
  id              String   @id @default(uuid())
  companyId       String
  name            String        // "Forklift License", "First Aid", etc.
  description     String?
  validityMonths  Int           // How long cert is valid
  isRequired      Boolean       @default(false)
  requiredForRoles Role[]       // Which roles need this cert
  reminderDays    Int           @default(30) // Days before expiry to remind
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  company      Company       @relation(fields: [companyId], references: [id])
  certificates Certificate[]

  @@unique([companyId, name])
  @@map("certificate_types")
}
```

#### 1.2 Enhanced Certificate Model
```prisma
model Certificate {
  id               String    @id @default(uuid())
  certNumber       String?   @unique  // CERT-YYYY-XXXX
  userId           String
  companyId        String
  certificateTypeId String?           // Link to type
  name             String
  issuer           String
  issueDate        DateTime
  expirationDate   DateTime?
  certificateUrl   String?            // Uploaded file
  status           CertStatus @default(ACTIVE)
  verifiedById     String?            // WHS who verified
  verifiedAt       DateTime?
  notes            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user            User             @relation(fields: [userId], references: [id])
  company         Company          @relation(fields: [companyId], references: [id])
  certificateType CertificateType? @relation(fields: [certificateTypeId], references: [id])
  verifiedBy      User?            @relation("CertVerifier", fields: [verifiedById], references: [id])

  @@map("certificates")
}

enum CertStatus {
  PENDING     // Uploaded, awaiting verification
  ACTIVE      // Verified and valid
  EXPIRING    // Within reminder period
  EXPIRED     // Past expiration date
  REVOKED     // Manually revoked
}
```

#### 1.3 Certificate Endpoints

```
# Certificate Types (WHS/Admin/Exec only)
POST   /api/certificate-types           - Create cert type
GET    /api/certificate-types           - List all types
PUT    /api/certificate-types/:id       - Update type
DELETE /api/certificate-types/:id       - Deactivate type

# Certificates
POST   /api/certificates                - Upload certificate (all users)
GET    /api/certificates                - List all (WHS/Admin/Exec/Supervisor)
GET    /api/certificates/my             - My certificates (all users)
GET    /api/certificates/:id            - Certificate details
PUT    /api/certificates/:id            - Update (owner or WHS)
DELETE /api/certificates/:id            - Delete (WHS/Admin only)

# WHS-specific
GET    /api/certificates/pending        - Pending verification (WHS)
PUT    /api/certificates/:id/verify     - Verify certificate (WHS)
PUT    /api/certificates/:id/revoke     - Revoke certificate (WHS)
GET    /api/certificates/expiring       - Expiring soon (WHS)
GET    /api/certificates/expired        - Already expired (WHS)
GET    /api/certificates/compliance     - Compliance report (WHS)
GET    /api/certificates/user/:userId   - User's certificates
```

---

### 2. Integration with Incidents

#### Link Certificates to Incidents
When an incident involves certification issues (e.g., operator without valid license).

```prisma
// Add to Incident model
model Incident {
  // ... existing fields ...

  // NEW: Certificate link
  relatedCertId    String?   // If incident related to cert issue
  certViolation    Boolean   @default(false)  // Cert violation flag

  relatedCert      Certificate? @relation(fields: [relatedCertId], references: [id])
}
```

#### WHS Incident Access
```typescript
// WHS can view all incidents where:
// 1. certViolation = true
// 2. type = INJURY or EQUIPMENT (safety-related)
// 3. severity = HIGH or CRITICAL
```

---

### 3. Compliance Dashboard

#### WHS Dashboard Components

```
┌─────────────────────────────────────────────────────────────────┐
│  WHS CONTROL DASHBOARD                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CERTIFICATE STATUS                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Active       │  │ Expiring     │  │ Expired      │          │
│  │    156       │  │     12       │  │      5       │          │
│  │    ✅        │  │     ⚠️       │  │     ❌       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Compliance Rate: 92%                              │          │
│  │ ████████████████████████████░░░░                 │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  PENDING VERIFICATION                    EXPIRING SOON          │
│  ┌─────────────────────┐                ┌─────────────────────┐│
│  │ Juan Dela Cruz      │                │ First Aid - 5 days  ││
│  │ Forklift License    │                │ Forklift - 12 days  ││
│  │ [Verify] [Reject]   │                │ Safety Trng - 30d   ││
│  └─────────────────────┘                └─────────────────────┘│
│                                                                 │
│  RECENT INCIDENTS (Safety-Related)                              │
│  ┌──────────────────────────────────────────────────┐          │
│  │ INC-2026-0015 | Equipment | HIGH | OPEN          │          │
│  │ INC-2026-0012 | Injury    | CRITICAL | IN_PROG   │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
│  WORKERS WITHOUT REQUIRED CERTS                                 │
│  ┌──────────────────────────────────────────────────┐          │
│  │ ⚠️ 3 workers missing "Safety Training"           │          │
│  │ ⚠️ 1 worker missing "Forklift License"          │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Compliance Reporting

#### Report Types

| Report | Description | Format |
|--------|-------------|--------|
| **Cert Status Report** | All certs by status | Table/PDF |
| **Expiry Forecast** | Certs expiring in 30/60/90 days | Table |
| **Compliance by Team** | % compliance per team | Chart |
| **Missing Certs** | Workers without required certs | Table |
| **Violation History** | Incidents with cert violations | Table |
| **Training Matrix** | Who has what cert | Matrix |

#### API Endpoints
```
GET /api/whs/reports/status          - Cert status summary
GET /api/whs/reports/expiry          - Expiry forecast
GET /api/whs/reports/compliance      - Compliance by team
GET /api/whs/reports/missing         - Missing required certs
GET /api/whs/reports/violations      - Cert violation incidents
GET /api/whs/reports/matrix          - Training/cert matrix
```

---

### 5. Notification Integration

#### Auto-Notifications

| Trigger | Recipients | Template |
|---------|------------|----------|
| Cert uploaded | WHS_CONTROL | "New cert pending: {name}" |
| Cert verified | User | "Your {name} was verified" |
| Cert expiring (30d) | User, WHS | "{name} expires in 30 days" |
| Cert expiring (7d) | User, WHS, Supervisor | "URGENT: {name} expires in 7 days" |
| Cert expired | User, WHS, Supervisor, Exec | "{name} has expired" |
| Cert revoked | User, Supervisor | "{name} has been revoked" |

---

### 6. System Log Integration

#### New Log Actions

```prisma
enum SystemLogAction {
  // ... existing ...

  // NEW: Certificate actions
  CERTIFICATE_UPLOADED
  CERTIFICATE_VERIFIED
  CERTIFICATE_REJECTED
  CERTIFICATE_EXPIRED
  CERTIFICATE_REVOKED
  CERTIFICATE_TYPE_CREATED
  CERTIFICATE_TYPE_UPDATED
}
```

---

## Role Permissions Update

### Updated roles.ts

```typescript
export const ROLES = {
  ADMIN: 'ADMIN',           // Level 6
  EXECUTIVE: 'EXECUTIVE',   // Level 5
  SUPERVISOR: 'SUPERVISOR', // Level 4
  CLINICIAN: 'CLINICIAN',   // Level 4 (parallel)
  WHS_CONTROL: 'WHS_CONTROL', // Level 4 (parallel)
  TEAM_LEAD: 'TEAM_LEAD',   // Level 3
  WORKER: 'WORKER',         // Level 2 (renamed from MEMBER)
} as const;

export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 6,
  EXECUTIVE: 5,
  SUPERVISOR: 4,
  CLINICIAN: 4,      // Same level as Supervisor
  WHS_CONTROL: 4,    // Same level as Supervisor
  TEAM_LEAD: 3,
  WORKER: 2,
};

export const ROLE_PERMISSIONS = {
  // ... existing permissions ...

  // NEW: Certificate permissions
  canManageCertTypes: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL] as Role[],
  canVerifyCerts: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL] as Role[],
  canViewAllCerts: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL, ROLES.SUPERVISOR] as Role[],
  canRevokeCerts: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL] as Role[],

  // NEW: Rehabilitation permissions (for Clinician)
  canManageRehab: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.CLINICIAN] as Role[],
  canViewAllRehab: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.CLINICIAN, ROLES.SUPERVISOR] as Role[],

  // NEW: WHS Dashboard
  canViewWHSDashboard: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.WHS_CONTROL] as Role[],
  canViewClinicianDashboard: [ROLES.ADMIN, ROLES.EXECUTIVE, ROLES.CLINICIAN] as Role[],
};
```

---

## Frontend Pages

### WHS Control Pages

```
/pages/whs/
├── dashboard.page.tsx              # WHS main dashboard
├── certificates/
│   ├── index.page.tsx              # All certificates list
│   ├── pending.page.tsx            # Pending verification
│   ├── expiring.page.tsx           # Expiring certificates
│   └── [id].page.tsx               # Certificate details
├── certificate-types/
│   ├── index.page.tsx              # Manage cert types
│   └── new.page.tsx                # Create cert type
├── compliance/
│   ├── index.page.tsx              # Compliance overview
│   ├── by-team.page.tsx            # Compliance by team
│   └── missing.page.tsx            # Missing certs report
├── incidents/
│   └── safety.page.tsx             # Safety-related incidents
└── reports/
    ├── index.page.tsx              # Report generation
    └── matrix.page.tsx             # Training matrix
```

### Worker Certificate Pages

```
/pages/worker/
├── my-certificates.page.tsx        # View my certificates
└── upload-certificate.page.tsx     # Upload new certificate
```

---

## Database Schema Changes Summary

### New Models
1. `CertificateType` - Certificate type definitions

### Modified Models
1. `Certificate` - Add status, verification, certNumber, typeId
2. `Incident` - Add relatedCertId, certViolation
3. `User` - Add relation for certVerifier

### New Enums
1. `CertStatus` - PENDING, ACTIVE, EXPIRING, EXPIRED, REVOKED

### Modified Enums
1. `Role` - Add CLINICIAN, WHS_CONTROL, rename MEMBER→WORKER
2. `SystemLogAction` - Add certificate-related actions

---

## Implementation Order

### Phase 1: Role System Update
- [ ] Update Role enum in Prisma schema
- [ ] Update roles.ts with new hierarchy
- [ ] Update role middleware
- [ ] Migrate existing MEMBER users to WORKER

### Phase 2: Certificate Types
- [ ] Create CertificateType model
- [ ] Implement CRUD endpoints
- [ ] Create management UI (WHS)

### Phase 3: Certificate Enhancement
- [ ] Update Certificate model
- [ ] Implement all certificate endpoints
- [ ] Add verification workflow
- [ ] Create worker upload UI
- [ ] Create WHS verification UI

### Phase 4: Integration
- [ ] Link incidents to certificates
- [ ] Add cert violation tracking
- [ ] Implement notifications
- [ ] Add system logging

### Phase 5: Dashboard & Reports
- [ ] WHS dashboard
- [ ] Compliance reports
- [ ] Training matrix

---

## Questions

1. **Parallel Role Access**: Can SUPERVISOR see WHS data? Can WHS see Supervisor data?

2. **Certificate Upload**: Who can upload certs?
   - Option A: Workers upload their own, WHS verifies
   - Option B: Only WHS can add certificates
   - Option C: Both

3. **Incident Link**: Should WHS be able to mark any incident as "cert violation"?

4. **Clinician Integration**: Should Clinician see cert status during rehab?

---

## Summary

Ang WHS Control role ay **domain-specific role** na parallel sa Supervisor at Clinician:

| Role | Domain | Primary Functions |
|------|--------|-------------------|
| **Supervisor** | Team Operations | Multi-team oversight, approvals |
| **Clinician** | Rehabilitation | Injury recovery, RTW programs |
| **WHS_Control** | Certification | Cert verification, compliance |

Hindi sila hierarchical sa isa't isa - equal level sila pero iba-iba ang access sa features.
