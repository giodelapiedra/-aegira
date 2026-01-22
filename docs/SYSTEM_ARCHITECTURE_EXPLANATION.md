# Aegira System Architecture: Wellness Metrics vs HR Attendance

**Document Purpose:** Explain why Aegira is designed as a **Wellness Metrics Monitoring System**, not an HR Attendance System

**Date:** January 2025  
**Version:** 2.0

---

## Executive Summary

Aegira is **NOT** an HR attendance tracking system. It is a **Workforce Health Intelligence Platform** that focuses on **actual wellness metrics** from daily check-ins. This document explains the architectural decisions and why this approach provides better value than traditional attendance systems.

---

## Core Philosophy

### ❌ What Aegira is NOT:
- **NOT** an HR attendance system
- **NOT** a compliance tracking tool
- **NOT** a system that penalizes absence
- **NOT** a replacement for your HR system

### ✅ What Aegira IS:
- **Wellness Metrics Monitoring System**
- **Health Intelligence Platform**
- **Data-driven insights from actual check-ins**
- **Complements your HR system** (doesn't replace it)

---

## System Architecture: Two Separate Concerns

### 1. **Checkin Table** (Wellness Metrics) - PRIMARY FOCUS

```typescript
model Checkin {
  // Wellness Metrics (1-10 scale)
  mood            Int             // How are you feeling?
  stress          Int             // Stress level?
  sleep           Int             // Sleep quality?
  physicalHealth  Int             // Physical condition?
  
  // Calculated Readiness Score
  readinessScore  Float           // 0-100 weighted average
  readinessStatus ReadinessStatus  // GREEN/YELLOW/RED
  
  // Optional Context
  notes           String?
  lowScoreReason  LowScoreReason? // Why low score?
  
  createdAt       DateTime        // When checked in
}
```

**Purpose:** Capture **actual wellness data** from workers who check in.

**Key Points:**
- ✅ Only contains data from **actual check-ins**
- ✅ No assumptions about absent workers
- ✅ No penalties for missing check-ins
- ✅ Pure health metrics only

### 2. **DailyAttendance Table** (Attendance Tracking) - SECONDARY

```typescript
model DailyAttendance {
  status    AttendanceStatus  // GREEN/ABSENT/EXCUSED
  checkInTime DateTime?       // When they checked in
  date      DateTime          // Which day
  
  // Link to Checkin (if exists)
  checkinId String?           // Optional link to wellness data
}
```

**Purpose:** Simple attendance record for **reference only**.

**Key Points:**
- ✅ Created automatically when check-in happens
- ✅ Used for compliance rate calculation (informational)
- ✅ **NOT used for wellness calculations**
- ✅ HR system handles actual attendance tracking

---

## Why This Architecture is Better

### 🎯 **1. Separation of Concerns**

```
┌─────────────────────────────────────────────────────────┐
│                    HR SYSTEM                           │
│  • Payroll                                              │
│  • Leave Management                                     │
│  • Attendance Tracking                                  │
│  • Compliance & Policies                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    AEGIRA SYSTEM                       │
│  • Wellness Metrics                                     │
│  • Health Readiness Scores                              │
│  • Team Health Analytics                                │
│  • Incident Management                                  │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Each system does what it's best at
- ✅ No duplication of HR functionality
- ✅ Aegira focuses on health intelligence
- ✅ HR system handles compliance

### 🎯 **2. Data-Driven Insights (Not Compliance-Driven)**

#### Traditional Attendance System:
```
❌ Focus: "Did they show up?"
❌ Penalties: Absence = negative score
❌ Assumptions: No check-in = absent = bad
❌ Compliance: 80% attendance = good?
```

#### Aegira Wellness System:
```
✅ Focus: "How are they feeling?"
✅ No Penalties: No check-in = no data (not bad)
✅ No Assumptions: Only count actual check-ins
✅ Insights: "Team avg mood is 7.2, stress is 4.5"
```

### 🎯 **3. Accurate Metrics Calculation**

#### Readiness Score Formula:
```typescript
// Weighted Average of Wellness Metrics
readinessScore = (
  (mood / 10) * 25% +
  ((10 - stress) / 10) * 25% +  // Inverted (high stress = low score)
  (sleep / 10) * 25% +
  (physicalHealth / 10) * 25%
) * 100

// Status Classification
GREEN:  score >= 70  // Ready to work
YELLOW: score >= 40  // Caution
RED:    score < 40   // Not ready / At risk
```

**Key Principle:** Only workers who **actually check in** contribute to metrics.

**Why This Matters:**
- ✅ Accurate averages (no zero values from absent workers)
- ✅ Real health insights (not attendance compliance)
- ✅ Fair calculations (only count actual data)

### 🎯 **4. Team Grade Calculation**

#### Old Approach (Compliance-Based):
```typescript
❌ Team Grade = (Readiness × 60%) + (Compliance × 40%)
❌ Problem: Absent workers lower the grade
❌ Result: Attendance compliance affects health grade
```

#### New Approach (Metrics-Only):
```typescript
✅ Team Grade = Average Readiness Score (100%)
✅ Only counts workers who checked in
✅ No penalty for absence
✅ Pure health intelligence
```

**Example:**
```
Team Alpha - Last 7 Days:
- 5 members expected to check in
- 4 members checked in (80% compliance)
- Avg Readiness: 75%

OLD System: Grade = (75 × 0.6) + (80 × 0.4) = 77% (B+)
NEW System: Grade = 75% (C+) - Pure health metric

Why NEW is better:
- Grade reflects actual health, not attendance
- HR handles attendance separately
- Clear separation of concerns
```

---

## Data Flow: How It Works

### Daily Check-In Process

```
1. Worker opens app during shift hours
   ↓
2. Worker submits wellness metrics:
   - Mood: 7/10
   - Stress: 4/10
   - Sleep: 6/10
   - Physical: 8/10
   ↓
3. System calculates Readiness Score:
   - Score: 72% → GREEN status
   ↓
4. Two records created:
   a) Checkin (wellness data) ← PRIMARY
   b) DailyAttendance (attendance record) ← SECONDARY
   ↓
5. User stats updated:
   - totalCheckins: +1
   - avgReadinessScore: recalculated
   - currentStreak: updated
   ↓
6. Team summary recalculated:
   - DailyTeamSummary updated with today's metrics
   - Only includes workers who checked in
```

### What Happens if Worker Doesn't Check In?

```
❌ OLD System Approach:
- Creates ABSENT record
- Lowers compliance rate
- Affects team grade negatively
- Assumes worker is "bad"

✅ NEW System Approach:
- No check-in record created
- No wellness data (not bad, just no data)
- Compliance rate shows separately (informational)
- Team grade only counts actual check-ins
- HR system handles absence tracking
```

---

## Key Metrics Explained

### 1. **Readiness Score** (0-100)
- **What:** Weighted average of mood, stress, sleep, physical health
- **Purpose:** Measure worker's readiness to work safely
- **Calculation:** Only from actual check-ins
- **Use Case:** Identify at-risk workers, team health trends

### 2. **Team Average Readiness**
- **What:** Average of all team members' readiness scores
- **Purpose:** Team health overview
- **Calculation:** Only includes workers who checked in
- **Use Case:** Team performance, health trends

### 3. **Compliance Rate** (0-100%)
- **What:** Percentage of expected workers who checked in
- **Purpose:** Informational metric (not used for grading)
- **Calculation:** `checkedInCount / expectedToCheckIn × 100`
- **Use Case:** Reference only (HR handles actual attendance)

### 4. **Wellness Metrics Averages**
- **What:** Average mood, stress, sleep, physical health
- **Purpose:** Identify specific health concerns
- **Calculation:** Only from actual check-ins
- **Use Case:** "Team stress is high" insights

---

## Database Schema: Clean Separation

### Checkin Table (Wellness)
```sql
-- Stores actual wellness data
SELECT 
  mood, stress, sleep, physicalHealth,
  readinessScore, readinessStatus,
  createdAt
FROM checkins
WHERE userId = '...' AND createdAt >= '...'
```

**Use Cases:**
- Individual health trends
- Team wellness analytics
- Readiness score calculations
- Health insights

### DailyAttendance Table (Reference)
```sql
-- Simple attendance record
SELECT 
  status, checkInTime, date
FROM daily_attendance
WHERE userId = '...' AND date = '...'
```

**Use Cases:**
- Compliance rate calculation (informational)
- Reference for HR system
- Not used for wellness calculations

### DailyTeamSummary Table (Pre-computed Analytics)
```sql
-- Pre-computed daily team stats
SELECT 
  checkedInCount,           -- How many checked in
  expectedToCheckIn,        -- How many expected
  avgReadinessScore,        -- Average wellness (only checked-in)
  avgMood, avgStress,       -- Wellness metrics
  complianceRate            -- Informational only
FROM daily_team_summaries
WHERE teamId = '...' AND date = '...'
```

**Purpose:** Fast analytics queries without recalculating every time.

---

## Benefits for Employers

### 🎯 **1. Accurate Health Intelligence**
- ✅ Real wellness data, not attendance compliance
- ✅ Identifies actual health concerns
- ✅ Data-driven insights for decision making

### 🎯 **2. No Penalty System**
- ✅ Workers aren't penalized for absence
- ✅ Focus on health, not compliance
- ✅ Better worker engagement

### 🎯 **3. Complements HR System**
- ✅ Doesn't duplicate HR functionality
- ✅ HR handles attendance, Aegira handles health
- ✅ Clear separation of responsibilities

### 🎯 **4. Scalable Architecture**
- ✅ Pre-computed summaries for fast queries
- ✅ Efficient database design
- ✅ Can handle large teams

### 🎯 **5. Actionable Insights**
- ✅ "Team stress is high" → Action needed
- ✅ "Worker readiness declining" → Early intervention
- ✅ "Sleep quality improving" → Positive trend

---

## Comparison: Traditional vs Aegira

| Aspect | Traditional HR System | Aegira System |
|--------|----------------------|---------------|
| **Primary Focus** | Attendance compliance | Wellness metrics |
| **Data Source** | Clock in/out times | Health check-ins |
| **Absence Handling** | Penalizes absence | No data (not bad) |
| **Metrics** | Attendance rate | Readiness score |
| **Team Grade** | Based on compliance | Based on health |
| **Use Case** | Payroll, compliance | Health intelligence |
| **Integration** | Standalone | Complements HR |

---

## Technical Implementation

### Pre-computed Stats (Performance Optimization)

**User Table:**
```typescript
totalCheckins: Int        // Total check-ins ever (auto-updated)
avgReadinessScore: Float  // Running average (auto-updated)
currentStreak: Int        // Consecutive check-ins
longestStreak: Int        // Best streak ever
```

**Why Pre-computed?**
- ✅ Fast queries (no need to count every time)
- ✅ Auto-updated on each check-in
- ✅ Consistent across all endpoints

### Daily Team Summary (Analytics Optimization)

**Pre-computed Daily Stats:**
```typescript
checkedInCount: Int           // How many checked in today
expectedToCheckIn: Int        // How many expected
avgReadinessScore: Float      // Average wellness (checked-in only)
avgMood, avgStress, etc.      // Wellness metric averages
complianceRate: Float         // Informational (not for grading)
```

**Why Pre-computed?**
- ✅ Fast analytics queries
- ✅ Historical data available
- ✅ No need to recalculate from raw check-ins

---

## Conclusion

### Key Takeaways:

1. **Aegira is NOT an HR system** - It's a wellness monitoring platform
2. **Focus on actual metrics** - Only count data from real check-ins
3. **No penalties** - Absence doesn't affect wellness scores
4. **Complements HR** - Each system does what it's best at
5. **Data-driven insights** - Real health intelligence, not compliance tracking

### Why This Approach is Better:

✅ **Accurate Metrics:** Only counts actual wellness data  
✅ **Fair System:** No penalties for absence  
✅ **Clear Purpose:** Health intelligence, not attendance  
✅ **Scalable:** Pre-computed stats for performance  
✅ **Actionable:** Real insights for decision making  

---

## Questions & Answers

### Q: Why not combine attendance and wellness?
**A:** Separation of concerns. HR handles compliance, Aegira handles health. Each system is optimized for its purpose.

### Q: What if workers don't check in?
**A:** No wellness data (not bad, just no data). HR system handles absence tracking separately.

### Q: How is team grade calculated?
**A:** 100% based on average readiness score from actual check-ins. No compliance factor.

### Q: Can we use this for payroll?
**A:** No. Use your HR system for payroll. Aegira provides health insights only.

### Q: What about compliance tracking?
**A:** Compliance rate is shown for reference, but HR system handles actual compliance tracking.

---

**Document Version:** 2.0  
**Last Updated:** January 2025  
**Author:** Aegira Development Team
