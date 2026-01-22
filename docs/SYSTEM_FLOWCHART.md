# Aegira System Flowchart

**Document Purpose:** Visual representation of Aegira system flow from check-in to analytics

**Date:** January 2025  
**Version:** 1.0

---

## Table of Contents

1. [System Overview Flowchart](#1-system-overview-flowchart)
2. [Daily Check-In Flow](#2-daily-check-in-flow)
3. [Readiness Score Calculation](#3-readiness-score-calculation)
4. [Team Summary Calculation](#4-team-summary-calculation)
5. [Data Flow Between Tables](#5-data-flow-between-tables)
6. [Analytics Flow](#6-analytics-flow)

---

## 1. System Overview Flowchart

```
┌─────────────────────────────────────────────────────────────────┐
│                      AEGIRA SYSTEM OVERVIEW                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   WORKER     │
│  Opens App   │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    CHECK-IN PROCESS                         │
│                                                             │
│  1. Validates:                                              │
│     ✓ Is work day?                                         │
│     ✓ Within shift hours?                                   │
│     ✓ Not on leave?                                         │
│     ✓ Not already checked in?                               │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              WELLNESS METRICS INPUT                         │
│                                                             │
│  Worker submits:                                            │
│  • Mood (1-10)                                              │
│  • Stress (1-10)                                            │
│  • Sleep (1-10)                                             │
│  • Physical Health (1-10)                                   │
│  • Notes (optional)                                         │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│           READINESS SCORE CALCULATION                       │
│                                                             │
│  Formula:                                                   │
│  Score = (Mood×25%) + (Stress×25%) +                      │
│          (Sleep×25%) + (Physical×25%)                      │
│                                                             │
│  Status:                                                    │
│  • GREEN (70-100)                                           │
│  • YELLOW (40-69)                                           │
│  • RED (0-39)                                               │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              DATABASE UPDATES                                │
│                                                             │
│  ✓ Checkin table (wellness data)                            │
│  ✓ DailyAttendance table (reference)                       │
│  ✓ User stats (totalCheckins, avgReadinessScore)           │
│  ✓ DailyTeamSummary (team analytics)                        │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    ANALYTICS & INSIGHTS                     │
│                                                             │
│  • Individual health trends                                 │
│  • Team readiness scores                                    │
│  • Health alerts                                            │
│  • Team grades                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Daily Check-In Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  DAILY CHECK-IN FLOW                        │
└──────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌─────────────────────┐
│ Worker Opens App    │
│ During Shift Hours  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ VALIDATION CHECKS                       │
│                                         │
│ ✓ User role = MEMBER/WORKER?           │
│ ✓ User has team?                       │
│ ✓ Today is work day?                   │
│ ✓ Within shift hours?                  │
│ ✓ Not on approved leave?                │
│ ✓ Not already checked in today?         │
└──────────┬─────────────────────────────┘
           │
           ├─── NO ───► Return Error ───► END
           │
           ▼ YES
┌─────────────────────────────────────────┐
│ DISPLAY CHECK-IN FORM                   │
│                                         │
│ • Mood slider (1-10)                    │
│ • Stress slider (1-10)                  │
│ • Sleep slider (1-10)                   │
│ • Physical Health slider (1-10)         │
│ • Notes (optional)                      │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Worker Submits Form                     │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CALCULATE READINESS SCORE               │
│                                         │
│ moodScore = (mood / 10) × 100          │
│ stressScore = ((10 - stress) / 10) × 100│
│ sleepScore = (sleep / 10) × 100        │
│ physicalScore = (physical / 10) × 100  │
│                                         │
│ readinessScore =                        │
│   (moodScore × 0.25) +                  │
│   (stressScore × 0.25) +                │
│   (sleepScore × 0.25) +                 │
│   (physicalScore × 0.25)                │
│                                         │
│ status =                                │
│   score >= 70 ? GREEN :                 │
│   score >= 40 ? YELLOW : RED            │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CREATE DATABASE RECORDS                 │
│ (Transaction)                           │
│                                         │
│ 1. Checkin table:                       │
│    • mood, stress, sleep, physical      │
│    • readinessScore, readinessStatus    │
│    • notes, createdAt                   │
│                                         │
│ 2. DailyAttendance table:               │
│    • status = GREEN                     │
│    • checkInTime = now                  │
│    • date = today                       │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ UPDATE USER STATS                       │
│                                         │
│ • totalCheckins += 1                    │
│ • avgReadinessScore = recalculate       │
│ • currentStreak = update                │
│ • longestStreak = update if needed      │
│ • lastCheckinDate = now                 │
│ • lastReadinessStatus = status          │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ RECALCULATE TEAM SUMMARY                │
│ (Background job)                        │
│                                         │
│ • Update DailyTeamSummary for today     │
│ • Recalculate team averages             │
│ • Update compliance rate                │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ RETURN SUCCESS RESPONSE                 │
│                                         │
│ • Check-in ID                           │
│ • Readiness Score                       │
│ • Status (GREEN/YELLOW/RED)             │
│ • Success message                       │
└──────────┬─────────────────────────────┘
           │
           ▼
         END
```

---

## 3. Readiness Score Calculation

```
┌──────────────────────────────────────────────────────────────┐
│            READINESS SCORE CALCULATION FLOW                  │
└──────────────────────────────────────────────────────────────┘

INPUT: Wellness Metrics (1-10 scale)
  │
  ├─── Mood: 7
  ├─── Stress: 4
  ├─── Sleep: 6
  └─── Physical Health: 8
  │
  ▼
┌─────────────────────────────────────────┐
│ STEP 1: Normalize to 0-100 Scale       │
│                                         │
│ moodScore = (7 / 10) × 100 = 70        │
│ stressScore = ((10-4) / 10) × 100 = 60 │
│ sleepScore = (6 / 10) × 100 = 60       │
│ physicalScore = (8 / 10) × 100 = 80    │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ STEP 2: Apply Weights                  │
│                                         │
│ All metrics weighted equally (25% each) │
│                                         │
│ weightedMood = 70 × 0.25 = 17.5        │
│ weightedStress = 60 × 0.25 = 15.0      │
│ weightedSleep = 60 × 0.25 = 15.0       │
│ weightedPhysical = 80 × 0.25 = 20.0    │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ STEP 3: Calculate Total Score           │
│                                         │
│ readinessScore =                        │
│   17.5 + 15.0 + 15.0 + 20.0 = 67.5     │
│                                         │
│ Round to nearest integer: 68            │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ STEP 4: Determine Status                │
│                                         │
│ IF score >= 70:                         │
│   status = GREEN (Ready)                │
│ ELSE IF score >= 40:                    │
│   status = YELLOW (Caution)             │
│ ELSE:                                   │
│   status = RED (Not Ready)              │
│                                         │
│ Result: 68 → YELLOW                     │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ OUTPUT                                  │
│                                         │
│ • readinessScore: 68                    │
│ • readinessStatus: YELLOW               │
└─────────────────────────────────────────┘
```

---

## 4. Team Summary Calculation

```
┌──────────────────────────────────────────────────────────────┐
│            TEAM SUMMARY CALCULATION FLOW                    │
└──────────────────────────────────────────────────────────────┘

TRIGGER: Check-in created OR Manual recalculation
  │
  ▼
┌─────────────────────────────────────────┐
│ GET TEAM DATA                           │
│                                         │
│ • Team ID                               │
│ • Date (today)                          │
│ • Timezone                              │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ GET TEAM MEMBERS                        │
│                                         │
│ • All active members                    │
│ • Exclude team leader                   │
│ • Count: totalMembers                   │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CHECK WORK DAY & HOLIDAY                │
│                                         │
│ • Is today a work day?                  │
│ • Is today a holiday?                   │
│                                         │
│ IF NOT work day OR holiday:             │
│   expectedToCheckIn = 0                 │
│ ELSE:                                   │
│   expectedToCheckIn = totalMembers -     │
│                      onLeaveCount       │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ GET ACTUAL CHECK-INS                    │
│                                         │
│ Query Checkin table:                    │
│ • userId IN (memberIds)                 │
│ • createdAt BETWEEN (dayStart, dayEnd)  │
│                                         │
│ Result: Array of check-ins              │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CALCULATE METRICS                       │
│                                         │
│ checkedInCount = checkins.length        │
│                                         │
│ greenCount = count(GREEN)               │
│ yellowCount = count(YELLOW)             │
│ redCount = count(RED)                   │
│                                         │
│ avgReadinessScore =                     │
│   sum(readinessScore) / checkedInCount  │
│                                         │
│ avgMood = sum(mood) / checkedInCount    │
│ avgStress = sum(stress) / checkedInCount│
│ avgSleep = sum(sleep) / checkedInCount  │
│ avgPhysical = sum(physical) /           │
│               checkedInCount            │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CALCULATE COMPLIANCE RATE               │
│                                         │
│ IF expectedToCheckIn > 0:               │
│   complianceRate = min(100,             │
│     (checkedInCount /                   │
│      expectedToCheckIn) × 100)          │
│ ELSE:                                   │
│   complianceRate = null                 │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ UPSERT DailyTeamSummary                 │
│                                         │
│ Save to database:                       │
│ • teamId, date                          │
│ • totalMembers                          │
│ • onLeaveCount                          │
│ • expectedToCheckIn                     │
│ • checkedInCount                        │
│ • greenCount, yellowCount, redCount     │
│ • avgReadinessScore                     │
│ • complianceRate (informational)        │
│ • avgMood, avgStress, avgSleep,         │
│   avgPhysical                           │
└──────────┬─────────────────────────────┘
           │
           ▼
         DONE
```

---

## 5. Data Flow Between Tables

```
┌──────────────────────────────────────────────────────────────┐
│              DATA FLOW BETWEEN TABLES                       │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    CHECK-IN CREATED                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │                                     │
        ▼                                     ▼
┌───────────────────┐              ┌──────────────────────┐
│   CHECKIN TABLE   │              │ DAILY_ATTENDANCE TABLE │
│  (PRIMARY DATA)   │              │   (REFERENCE ONLY)    │
├───────────────────┤              ├──────────────────────┤
│ • mood            │              │ • status = GREEN     │
│ • stress          │              │ • checkInTime        │
│ • sleep           │              │ • date               │
│ • physicalHealth  │              │ • checkinId (link)   │
│ • readinessScore  │              └──────────────────────┘
│ • readinessStatus │                        │
│ • createdAt       │                        │
└─────────┬─────────┘                        │
          │                                   │
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    USER TABLE UPDATE                        │
│                                                             │
│ • totalCheckins += 1                                        │
│ • avgReadinessScore = recalculate                           │
│ • currentStreak = update                                    │
│ • longestStreak = update if needed                          │
│ • lastCheckinDate = now                                    │
│ • lastReadinessStatus = status                             │
└──────────┬──────────────────────────────────────────────────┘
           │
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│              DAILY_TEAM_SUMMARY UPDATE                      │
│                                                             │
│ Triggered by:                                               │
│ • New check-in created                                      │
│ • Manual recalculation                                      │
│                                                             │
│ Calculates:                                                 │
│ • checkedInCount (from Checkin table)                       │
│ • avgReadinessScore (from Checkin table)                   │
│ • greenCount, yellowCount, redCount                         │
│ • avgMood, avgStress, avgSleep, avgPhysical                │
│ • complianceRate (informational only)                      │
└──────────┬──────────────────────────────────────────────────┘
           │
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ANALYTICS QUERIES                        │
│                                                             │
│ Uses:                                                       │
│ • DailyTeamSummary (fast pre-computed data)                │
│ • Checkin table (for detailed analysis)                     │
│ • User table (for member stats)                             │
│                                                             │
│ Generates:                                                  │
│ • Team grades                                               │
│ • Health trends                                             │
│ • Readiness scores                                          │
│ • Insights & alerts                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    KEY PRINCIPLES                          │
│                                                             │
│ 1. Checkin table = Source of truth for wellness data       │
│ 2. DailyAttendance = Reference only (not used in calc)     │
│ 3. User table = Pre-computed stats (auto-updated)         │
│ 4. DailyTeamSummary = Pre-computed analytics (fast)       │
│ 5. Only actual check-ins contribute to metrics             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Analytics Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    ANALYTICS FLOW                           │
└──────────────────────────────────────────────────────────────┘

REQUEST: Team Analytics
  │
  ▼
┌─────────────────────────────────────────┐
│ GET PERIOD                              │
│                                         │
│ • today                                 │
│ • 7 days                                │
│ • 14 days                               │
│ • 30 days                               │
│ • Custom date range                     │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ QUERY DailyTeamSummary                  │
│                                         │
│ • Fast pre-computed data                │
│ • Date range filter                     │
│ • Team filter                           │
│                                         │
│ Returns:                                │
│ • Daily summaries for period            │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CALCULATE PERIOD AVERAGES               │
│                                         │
│ • Total work days                       │
│ • Total expected to check in            │
│ • Total checked in                      │
│ • Average compliance rate                │
│ • Average readiness score                │
│ • Total green/yellow/red counts         │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ GET MEMBER AVERAGES                     │
│                                         │
│ Query User table:                       │
│ • avgReadinessScore per member          │
│ • Only members with check-ins           │
│                                         │
│ Calculate:                              │
│ • Team avg = average of member avgs     │
│ • Equal weight per member               │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ CALCULATE TEAM GRADE                    │
│                                         │
│ Grade = Team Avg Readiness Score        │
│                                         │
│ Scale:                                  │
│ • A+ (97-100)                           │
│ • A (93-96)                             │
│ • A- (90-92)                            │
│ • B+ (87-89)                            │
│ • B (83-86)                             │
│ • B- (80-82)                            │
│ • C+ (77-79)                            │
│ • C (73-76)                             │
│ • C- (70-72)                            │
│ • D+ (67-69)                            │
│ • D (63-66)                             │
│ • D- (60-62)                            │
│ • F (<60)                               │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ GENERATE INSIGHTS                       │
│                                         │
│ • Top reasons for low scores            │
│ • Health trends                         │
│ • Risk alerts                           │
│ • Recommendations                       │
└──────────┬─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ RETURN ANALYTICS DATA                   │
│                                         │
│ • Team grade                            │
│ • Average readiness                     │
│ • Compliance rate (informational)       │
│ • Status distribution                   │
│ • Trend data                            │
│ • Insights                              │
└─────────────────────────────────────────┘
```

---

## 7. Complete System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AEGIRA SYSTEM ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Worker     │  │ Team Leader  │  │  Supervisor  │          │
│  │   Dashboard  │  │  Dashboard   │  │  Dashboard   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Check-ins   │  │    Teams     │  │  Analytics   │          │
│  │   Module     │  │   Module     │  │   Module     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              CHECKIN TABLE (PRIMARY)                     │  │
│  │  • Wellness metrics (mood, stress, sleep, physical)     │  │
│  │  • Readiness score & status                             │  │
│  │  • Timestamp                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         DAILY_ATTENDANCE TABLE (REFERENCE)               │  │
│  │  • Status (GREEN/ABSENT/EXCUSED)                         │  │
│  │  • Check-in time                                         │  │
│  │  • Link to Checkin (optional)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              USER TABLE (PRE-COMPUTED)                   │  │
│  │  • totalCheckins (auto-updated)                          │  │
│  │  • avgReadinessScore (running average)                   │  │
│  │  • currentStreak, longestStreak                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            │                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      DAILY_TEAM_SUMMARY TABLE (PRE-COMPUTED)             │  │
│  │  • checkedInCount                                        │  │
│  │  • avgReadinessScore                                     │  │
│  │  • greenCount, yellowCount, redCount                     │  │
│  │  • avgMood, avgStress, avgSleep, avgPhysical            │  │
│  │  • complianceRate (informational)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW SUMMARY                          │
│                                                                 │
│  1. Check-in → Checkin table (wellness data)                   │
│  2. Check-in → DailyAttendance table (reference)               │
│  3. Check-in → User table (update stats)                       │
│  4. Check-in → DailyTeamSummary (recalculate)                  │
│  5. Analytics → Query DailyTeamSummary (fast)                  │
│  6. Analytics → Query Checkin table (detailed)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Key Decision Points Flowchart

```
┌──────────────────────────────────────────────────────────────┐
│              KEY DECISION POINTS IN SYSTEM                   │
└──────────────────────────────────────────────────────────────┘

START: Worker wants to check in
  │
  ▼
┌─────────────────────┐
│ Is it work day?     │
└───┬─────────────┬───┘
    │ NO          │ YES
    │             │
    ▼             ▼
┌─────────┐  ┌─────────────────────┐
│ REJECT  │  │ Within shift hours? │
│ ERROR   │  └───┬─────────────┬───┘
└─────────┘      │ NO          │ YES
                 │             │
                 ▼             ▼
            ┌─────────┐  ┌─────────────────────┐
            │ REJECT  │  │ On approved leave?  │
            │ ERROR   │  └───┬─────────────┬───┘
            └─────────┘      │ YES          │ NO
                             │             │
                             ▼             ▼
                        ┌─────────┐  ┌─────────────────────┐
                        │ REJECT  │  │ Already checked in? │
                        │ ERROR   │  └───┬─────────────┬───┘
                        └─────────┘      │ YES          │ NO
                                         │             │
                                         ▼             ▼
                                    ┌─────────┐  ┌─────────────────┐
                                    │ REJECT  │  │ PROCESS CHECK-IN│
                                    │ ERROR   │  └─────────────────┘
                                    └─────────┘
```

---

## 9. Metrics Calculation Decision Tree

```
┌──────────────────────────────────────────────────────────────┐
│         METRICS CALCULATION DECISION TREE                   │
└──────────────────────────────────────────────────────────────┘

Question: How is Team Grade calculated?
  │
  ▼
┌─────────────────────────────────────────┐
│ Get all check-ins in period            │
└──────────┬──────────────────────────────┘
           │
           ├─── No check-ins ───► Grade = F (no data)
           │
           ▼ Has check-ins
┌─────────────────────────────────────────┐
│ Calculate member averages               │
│ (one average per member)                │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Calculate team average                  │
│ (average of member averages)            │
│ Equal weight per member                 │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Determine grade                         │
│                                         │
│ A+ (97-100)  ████████████████████      │
│ A  (93-96)   ██████████████████        │
│ A- (90-92)   ████████████████          │
│ B+ (87-89)   ██████████████            │
│ B  (83-86)   ████████████              │
│ B- (80-82)   ██████████                │
│ C+ (77-79)   ████████                  │
│ C  (73-76)   ███████                   │
│ C- (70-72)   ██████                    │
│ D+ (67-69)   █████                     │
│ D  (63-66)   ████                      │
│ D- (60-62)   ███                       │
│ F  (<60)     ██                        │
└─────────────────────────────────────────┘

Key Principle:
- Only workers who checked in are counted
- No penalty for absence
- Pure health metric (no compliance factor)
```

---

## Summary

These flowcharts illustrate:

1. **System Overview** - High-level flow from check-in to analytics
2. **Daily Check-In Flow** - Step-by-step check-in process
3. **Readiness Score Calculation** - How wellness metrics become scores
4. **Team Summary Calculation** - How team analytics are computed
5. **Data Flow** - How data moves between tables
6. **Analytics Flow** - How analytics are generated
7. **System Architecture** - Complete system structure
8. **Decision Points** - Key validation logic
9. **Metrics Decision Tree** - How grades are calculated

**Key Takeaway:** All metrics are based on **actual check-in data only**. No assumptions, no penalties, pure health intelligence.
