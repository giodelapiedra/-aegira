# COMPARISON: Current System vs. Proposed Exemption System

**Date:** January 5, 2026
**Purpose:** Clarify the difference between existing logic and the new Exemption feature

---

## SUMMARY

| Aspect | Current System | Proposed Exemption System |
|--------|----------------|---------------------------|
| **Focus** | Detection & Manual Monitoring | Worker Request + TL Approval |
| **Who initiates?** | System auto-detects, TL manually flags | Worker requests, TL approves/denies |
| **Status handling** | CRITICAL = needs attention | CRITICAL = status, EXEMPTION = decision |
| **Tracking** | Watch List (TL-managed) | Exemption Tab (auditable records) |
| **Workflow** | TL sees drop → TL monitors | Worker explains → TL approves → System tracks |

---

## CURRENT SYSTEM LOGIC (Sudden Change Detection + Watch List)

### How It Works Now:

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT FLOW: Team Leader-Driven Monitoring                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Worker checks in                                            │
│     └─→ System calculates score (e.g., 45)                     │
│                                                                 │
│  2. System compares to 7-day average (e.g., 82)                │
│     └─→ Detects: DROP of 37 points = CRITICAL                  │
│                                                                 │
│  3. Team Leader sees "Sudden Changes" list                     │
│     └─→ Juan Santos: 45 (TODAY) vs 82 (AVG) = -37 CRITICAL     │
│                                                                 │
│  4. Team Leader MANUALLY decides to:                           │
│     ├─→ [Add to Watch List] - Manual flag for monitoring       │
│     ├─→ [Schedule 1-on-1] - Manual action                      │
│     └─→ [Acknowledge] - Just mark as "seen"                    │
│                                                                 │
│  5. If Watch List:                                              │
│     └─→ TL manually tracks progress over days                  │
│     └─→ TL manually resolves when better                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Characteristics:

1. **System detects** sudden changes automatically
2. **Team Leader initiates** all follow-up actions
3. **Worker is passive** - just checks in, has no say
4. **No formal exemption** - just "acknowledged" or "on watch list"
5. **CRITICAL status remains** as-is, no official excuse
6. **Watch List** is for TL's personal tracking

### What's Missing:

- Worker cannot explain WHY score dropped
- Worker cannot REQUEST exemption
- No formal approval process
- No auditable exemption records
- CRITICAL status has no "official excuse" attached

---

## PROPOSED EXEMPTION SYSTEM (New Idea)

### Core Concept:

```
┌─────────────────────────────────────────────────────────────────┐
│  KEY INSIGHT:                                                   │
│                                                                 │
│  CRITICAL = Status of check-in (SYSTEM determines)             │
│  EXEMPTION = Decision by Team Leader (HUMAN determines)        │
│                                                                 │
│  They are DIFFERENT but CONNECTED.                             │
│                                                                 │
│  → Even if EXEMPTED, the worker's history still shows CRITICAL │
│  → Exemption is a separate record that JUSTIFIES the critical  │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works:

```
┌─────────────────────────────────────────────────────────────────┐
│  NEW FLOW: Worker Request + Team Leader Approval                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Worker checks in with LOW score                            │
│     └─→ Score: 55% | Status: 🔴 CRITICAL                       │
│                                                                 │
│  2. WORKER provides reason and requests exemption              │
│     ├─→ Reason: "Family emergency - parent hospitalized"       │
│     └─→ Action: [Request Exemption]                            │
│                                                                 │
│  3. Team Leader receives exemption request                     │
│     └─→ Sees: Ricardo Gomez requesting exemption               │
│         Reason: Family emergency                                │
│         Score: 55% (CRITICAL)                                   │
│                                                                 │
│  4. Team Leader makes DECISION:                                │
│     ├─→ [✅ Approve - 1 Day]                                   │
│     ├─→ [✅ Approve - 3 Days]                                  │
│     └─→ [❌ Deny] + Note                                       │
│                                                                 │
│  5. SYSTEM auto-creates Exemption Record:                      │
│     ┌─────────────────────────────────────────────────────────┐│
│     │ Exemption ID: EX-00123                                  ││
│     │ Worker: Ricardo Gomez                                   ││
│     │ Team Leader: Juan Dela Cruz                             ││
│     │ Reason: Family emergency                                ││
│     │ Status: 🟢 ACTIVE                                       ││
│     │ Approved Date: Jan 4, 2026                              ││
│     │ Valid Until: Jan 4, 2026                                ││
│     └─────────────────────────────────────────────────────────┘│
│                                                                 │
│  6. Daily Check-In shows BOTH statuses:                        │
│     └─→ Ricardo Gomez | 🔴 Critical | Exempted ✅              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## SYSTEM TABS STRUCTURE

### Tab 1: Daily Check-Ins (Enhanced)

Shows current status WITH exemption indicator:

```
┌─────────────────────────────────────────────────────────────────┐
│  DAILY CHECK-INS - January 4, 2026                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Worker           Score    Status      Exemption                │
│  ─────────────────────────────────────────────────────────────  │
│  Maria Santos     85%      🟢 Normal    -                       │
│  Ricardo Gomez    55%      🔴 Critical  ✅ Exempted             │
│  Pedro Cruz       72%      🟡 Monitor   -                       │
│  Ana Reyes        45%      🔴 Critical  ⏳ Pending              │
│  Carlos Garcia    68%      🟡 Monitor   -                       │
│                                                                 │
│  Legend:                                                        │
│  ✅ Exempted = Approved exemption active                       │
│  ⏳ Pending = Exemption request waiting for TL                 │
│  - = No exemption requested/needed                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 2: Exemptions (NEW TAB)

Dedicated tracking for all exemptions:

```
┌─────────────────────────────────────────────────────────────────┐
│  🚫 EXEMPTIONS                              [+ Manual Exemption]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filter: [All] [Active] [Pending] [Expired] [Closed]            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ID        Worker          Reason         Approved By        ││
│  │ ────────────────────────────────────────────────────────────││
│  │ EX-00123  Ricardo Gomez   Family emerg.  Juan Dela Cruz    ││
│  │           Valid: Jan 4    Status: 🟢 ACTIVE                 ││
│  │                                                             ││
│  │ EX-00122  Ana Reyes       Medical appt.  Maria Santos      ││
│  │           Valid: Jan 3    Status: ⬛ CLOSED (Resolved)      ││
│  │                                                             ││
│  │ EX-00121  Pedro Cruz      Car accident   Juan Dela Cruz    ││
│  │           Valid: Jan 1-2  Status: 🔴 EXPIRED                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## EXEMPTION LIFECYCLE

### State Transitions:

```
                    ┌─────────────┐
                    │   PENDING   │ ← Worker submits request
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ APPROVED │    │  DENIED  │    │ EXPIRED  │
    │ (ACTIVE) │    │          │    │(no action│
    └────┬─────┘    └──────────┘    │ by TL)   │
         │                          └──────────┘
         │
         ▼
   ┌───────────────────────────────┐
   │                               │
   ▼                               ▼
┌──────────┐                 ┌──────────┐
│  CLOSED  │ (Worker        │ EXPIRED  │ (Validity
│(Resolved)│  improved)     │          │  ended)
└──────────┘                 └──────────┘
```

### Status Definitions:

| Status | Meaning | Trigger |
|--------|---------|---------|
| **PENDING** | Waiting for TL approval | Worker submits request |
| **ACTIVE** | Approved and currently valid | TL approves |
| **DENIED** | TL rejected the request | TL denies |
| **EXPIRED** | Validity period ended | Date passed without renewal |
| **CLOSED** | Worker recovered, no longer needed | Score improved OR TL manually closes |

---

## NEXT DAY BEHAVIOR (Automatic)

### Case A: Worker Improved

```
DAY 2 (Exemption Day):
  Score: 55% | Status: CRITICAL | Exemption: ACTIVE

DAY 3 (Next Day):
  Score: 75% | Status: NORMAL

  SYSTEM AUTO-ACTIONS:
  ├─→ Check-in status: 🟢 NORMAL
  ├─→ Exemption status: CLOSED (auto)
  └─→ Note: "Resolved automatically - score improved"

  EXEMPTION TAB:
  │ EX-00123 │ Ricardo Gomez │ ⬛ CLOSED │ Resolved: Auto │
```

### Case B: Still Critical, Exemption Expired

```
DAY 2 (Exemption Day):
  Score: 55% | Status: CRITICAL | Exemption: ACTIVE

DAY 3 (Next Day):
  Score: 50% | Status: CRITICAL

  SYSTEM AUTO-ACTIONS:
  ├─→ Check-in status: 🔴 CRITICAL
  ├─→ Exemption status: EXPIRED
  └─→ Alert: "Ricardo's exemption expired. Score still critical."

  EXEMPTION TAB:
  │ EX-00123 │ Ricardo Gomez │ 🔴 EXPIRED │ Re-approval needed │

  OPTIONS FOR WORKER:
  └─→ [Request New Exemption]

  OPTIONS FOR TL:
  └─→ [Extend Exemption] or [Deny Further Exemption]
```

### Case C: Exemption Extended

```
DAY 3 - Worker still critical, requests extension:
  Worker: "Parent still in hospital, need 2 more days"

  TL ACTIONS:
  ├─→ [✅ Approve Extension - 2 Days]
  └─→ [❌ Deny Extension]

  IF APPROVED:
  ├─→ New Exemption: EX-00124 (linked to EX-00123)
  ├─→ Valid: Jan 5-6, 2026
  └─→ Parent Exemption: EX-00123 marked as "Extended to EX-00124"
```

---

## DATABASE DESIGN (Proposed)

### New Model: Exemption

```prisma
model Exemption {
  id              String           @id @default(uuid())
  companyId       String
  teamId          String
  workerId        String           // Worker who requested
  approvedById    String?          // TL who approved/denied

  // Request details
  reason          String           // Worker's explanation
  requestedAt     DateTime         @default(now())

  // Approval details
  status          ExemptionStatus  @default(PENDING)
  decision        ExemptionDecision?
  decisionNote    String?          // TL's note when approving/denying
  decidedAt       DateTime?

  // Validity
  validFrom       DateTime?        // Start of exemption
  validUntil      DateTime?        // End of exemption
  durationDays    Int?             // 1, 2, 3, etc.

  // Context
  scoreAtRequest  Float            // Score when requested
  statusAtRequest ReadinessStatus  // Status when requested (CRITICAL, etc.)
  checkinId       String?          // Link to the check-in that triggered this

  // Closure
  closedAt        DateTime?
  closeReason     String?          // "Auto-resolved", "TL closed", "Expired"
  scoreAtClose    Float?           // Score when closed

  // Extensions
  parentId        String?          // If this is an extension of another exemption

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  // Relations
  company         Company          @relation(fields: [companyId], references: [id])
  team            Team             @relation(fields: [teamId], references: [id])
  worker          User             @relation("ExemptedWorker", fields: [workerId], references: [id])
  approvedBy      User?            @relation("ExemptionApprover", fields: [approvedById], references: [id])
  checkin         Checkin?         @relation(fields: [checkinId], references: [id])
  parent          Exemption?       @relation("ExemptionExtension", fields: [parentId], references: [id])
  extensions      Exemption[]      @relation("ExemptionExtension")

  @@index([teamId, status])
  @@index([workerId])
  @@index([validUntil])
  @@map("exemptions")
}

enum ExemptionStatus {
  PENDING   // Waiting for TL decision
  ACTIVE    // Approved and valid
  DENIED    // TL rejected
  EXPIRED   // Validity ended
  CLOSED    // Resolved (worker improved or TL closed)
}

enum ExemptionDecision {
  APPROVED
  DENIED
}
```

---

## KEY DIFFERENCES SUMMARY

| Feature | Current (Watch List) | Proposed (Exemption) |
|---------|---------------------|----------------------|
| **Who initiates?** | Team Leader | Worker (requests) |
| **Purpose** | TL wants to monitor | Worker needs official excuse |
| **Tracking** | TL's personal list | Company-wide auditable record |
| **Visibility** | Only TL sees | Everyone sees exemption status |
| **Record** | Informal notes | Formal Exemption ID (EX-00123) |
| **Duration** | Until TL resolves | Defined validity period |
| **Auto-expire** | No (manual) | Yes (system enforced) |
| **History impact** | Status unchanged | Status stays CRITICAL, exemption tracked separately |
| **Audit trail** | Watch activities | Full exemption lifecycle |
| **Worker action** | None | Can request/explain |

---

## RECOMMENDATION: Both Systems Can Coexist

### Complementary Use Cases:

```
┌─────────────────────────────────────────────────────────────────┐
│  EXEMPTION SYSTEM (Worker-Initiated)                            │
│  ─────────────────────────────────────────────────────────────  │
│  Use when:                                                      │
│  • Worker knows WHY they're not ready (family, medical, etc.)  │
│  • Worker wants official record/excuse                          │
│  • Need auditable approval trail                                │
│  • Short-term valid excuse (1-3 days)                          │
│                                                                 │
│  Example: "My parent is hospitalized, I need 1-day exemption"  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  WATCH LIST SYSTEM (TL-Initiated)                               │
│  ─────────────────────────────────────────────────────────────  │
│  Use when:                                                      │
│  • TL notices pattern/concern                                   │
│  • Worker doesn't explain drop                                  │
│  • Need long-term monitoring (weeks)                            │
│  • TL wants to track recovery progress                          │
│                                                                 │
│  Example: "Pedro's scores declining for 3 days, need to watch"  │
└─────────────────────────────────────────────────────────────────┘
```

### Combined View for TL:

```
┌─────────────────────────────────────────────────────────────────┐
│  TEAM OVERSIGHT - January 5, 2026                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 CHECK-INS        │ 🚫 EXEMPTIONS      │ 👁️ WATCH LIST      │
│  8/10 checked in     │ 1 active           │ 2 being monitored  │
│  2 critical          │ 1 pending request  │ 1 needs attention  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## NEXT STEPS

1. **Decide**: Keep both systems or merge?
2. **Define**: Exact workflow for exemption request
3. **Design**: API endpoints for exemption CRUD
4. **Implement**: Exemption Tab UI
5. **Test**: Scenario testing for all exemption states

---

*Document created: January 5, 2026*
*For Aegira Personnel Readiness Management System*
