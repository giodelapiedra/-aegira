# Aegira: Final Direction

## Target Market: Australia

---

## What Aegira IS

**Workforce Health Intelligence Platform**

```
Workers voluntarily submit daily health check-ins
    ↓
System aggregates health data (mood, stress, sleep, physical)
    ↓
Team Leads see real-time health insights
    ↓
AI identifies patterns and risks
    ↓
Better decisions. Healthier teams.
```

---

## What Aegira is NOT

| NOT This | Why |
|----------|-----|
| ❌ Attendance system | Companies already have this |
| ❌ HR software | Not competing with Sprout, etc. |
| ❌ Compliance tool | No enforcement, no penalties |
| ❌ Leave management | Too much HR complexity |
| ❌ Time tracking | Commodity, no differentiation |

---

## Strategic Position

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   EXISTING SYSTEMS          AEGIRA                  │
│   (HR, Payroll, Attendance) (Health Intelligence)   │
│                                                     │
│   ┌─────────────┐          ┌─────────────┐         │
│   │ Who showed  │          │ How healthy │         │
│   │ up today?   │    +     │ is the team?│         │
│   │             │          │             │         │
│   │ Time in/out │          │ Mood/Stress │         │
│   │ Leave days  │          │ Sleep/Energy│         │
│   │ Payroll     │          │ Risk flags  │         │
│   └─────────────┘          └─────────────┘         │
│                                                     │
│   THEY HAVE THIS            THEY DON'T HAVE THIS   │
│                                                     │
└─────────────────────────────────────────────────────┘

Aegira fills the GAP. Not competing. Complementing.
```

---

## The Pitch

### Old Pitch (Wrong):
> "Replace your attendance system with our smarter wellness-based one"
>
> ❌ They already have attendance
> ❌ Switching cost is high
> ❌ Feature comparison with HR tools
> ❌ Hard sell

### New Pitch (Right):
> "Keep your HR system. Add health intelligence."
>
> ✅ No replacement needed
> ✅ Fills a gap they don't have
> ✅ Easy add-on sale
> ✅ Unique value

---

## Core Product (Simplified)

### Features to KEEP:

| Feature | Purpose |
|---------|---------|
| **Teams & Team Leads** | Structure for data organization |
| **Voluntary Health Check-in** | Mood, stress, sleep, physical (30 sec) |
| **Fitness Score** | Fit / Monitor / Unfit status |
| **Team Dashboard** | See who checked in & their scores |
| **Team Averages** | Aggregate health metrics |
| **AI Insights** | Patterns, trends, recommendations |
| **Individual History** | Worker sees own trends |
| **Incident Reporting** | When something goes wrong |

### Features to REMOVE:

| Feature | Why Remove |
|---------|------------|
| ❌ Compliance rate/scoring | Feels like attendance |
| ❌ "Expected check-ins" | Implies mandatory |
| ❌ Absence tracking | HR territory |
| ❌ Absence justification | HR territory |
| ❌ Leave/Exception requests | HR complexity |
| ❌ Holiday blocking | HR complexity |
| ❌ Attendance status | We're not attendance |
| ❌ Daily absence cron jobs | Not needed |
| ❌ ABSENT/LATE concepts | Not our domain |

---

## New Data Model (Simplified)

### What we track:

```
HealthCheckIn:
  - workerId
  - date
  - mood (1-10)
  - stress (1-10)
  - sleep (1-10)
  - physical (1-10)
  - fitnessScore (calculated)
  - status: FIT | MONITOR | UNFIT
  - notes (optional)

Team:
  - name
  - teamLeadId
  - members[]

Incident:
  - (keep as is for when things go wrong)
```

### What we DON'T track:

```
❌ Expected check-ins
❌ Compliance percentage
❌ Absences
❌ Leave balances
❌ Attendance status
❌ Work schedules (for compliance)
```

---

## Dashboard Design (New)

### Team Lead View:

```
┌─────────────────────────────────────────────────────┐
│ TEAM ALPHA - Health Snapshot                        │
│ Today: Jan 18, 2026                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Check-ins Today: 12 workers                         │
│                                                     │
│ ● Fit for Duty: 9                                   │
│ ● Monitor: 2                                        │
│ ● Unfit: 1 ⚠️                                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Team Averages                                       │
│                                                     │
│ Mood      ████████░░ 7.2                           │
│ Stress    ████░░░░░░ 4.1  (lower is better)        │
│ Sleep     ██████░░░░ 6.5                           │
│ Physical  ████████░░ 7.8                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ⚠️ Needs Attention (1)                              │
│                                                     │
│ Juan Reyes - UNFIT                                  │
│ High stress (9/10), Low sleep (3/10)               │
│ [View Details] [Contact]                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 📈 Trends                                           │
│                                                     │
│ Team stress up 15% vs last week                     │
│ 3 workers flagged fatigue multiple days            │
│ [View Full Analytics]                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**No compliance %. No "expected" count. Just health data.**

---

## Worker Experience

### Check-in Flow:

```
"How are you feeling today?"

Mood:     😞 ─────●───── 😊  [7]
Stress:   😌 ─────────●─ 😰  [8]
Sleep:    😴 ───●─────── 🌟  [4]
Physical: 🤕 ───────●─── 💪  [7]

Notes: (optional)
[────────────────────────────]

[Submit Check-in]
```

### Worker Benefits:

```
- See your own health trends
- "Your sleep has been low this week"
- No penalty for not checking in
- Voice concerns safely
- Track your wellbeing over time
```

---

## Value Proposition (Australia)

### For Team Leads / Supervisors:

```
"See how your team is really doing."

- Real-time health visibility
- Know who needs support
- Spot burnout before it happens
- Data for better decisions
```

### For Safety Managers:

```
"Health data that prevents incidents."

- Fatigued workers flagged early
- Stress patterns identified
- Link health trends to incidents
- Proactive, not reactive
```

### For Executives:

```
"Workforce health intelligence."

- Department health comparisons
- Trend analysis over time
- ROI: Healthier team = fewer incidents
- Data you've never had before
```

### For Workers:

```
"Track your own wellbeing."

- See your trends
- No punishment for honest answers
- Voice when you're struggling
- Company cares about your health
```

---

## Adoption Strategy (Voluntary Model)

### Risk: "What if workers don't check in?"

### Mitigation:

| Strategy | How |
|----------|-----|
| **Value for workers** | Show them their own trends, insights |
| **Gamification** | Streaks, badges (optional) |
| **Team Lead culture** | TLs encourage, not enforce |
| **AI insights** | More data = better insights (motivation) |
| **Privacy first** | Workers trust it → more honest data |

### The Goal:

```
Not 100% check-in rate.
Just enough data for meaningful insights.

50% participation with honest data
> 100% participation with fake data
```

---

## Pricing (Australia - Simplified)

| Tier | Team Size | Price (AUD) |
|------|-----------|-------------|
| Starter | Up to 50 | $399/month |
| Growth | Up to 200 | $999/month |
| Enterprise | Unlimited | Custom |

**Positioning:** Affordable add-on, not expensive replacement.

**Comparison:**
- HR systems: $10-30/user/month (but you already have one)
- Aegira: ~$5-10/user/month (adds what you don't have)

---

## Competitive Landscape

### Direct Competitors: Almost None

Because we're not competing in HR/attendance space.

### Adjacent Products:

| Product | What They Do | Aegira Difference |
|---------|--------------|-------------------|
| SafetyCulture | Inspections, audits | Not daily health data |
| HR Systems | Attendance, payroll | Not health insights |
| Wellness Apps | Individual wellness | Not team/workplace focused |
| EAP Programs | Mental health support | Not daily data collection |

### Aegira's Unique Space:

```
"Daily workforce health intelligence for teams"

No one else does this specifically.
```

---

## Go-to-Market (Australia)

### Phase 1: Validate

1. Find 3-5 companies willing to pilot
2. Industries: Construction, mining, logistics
3. Offer: Free 30-60 day trial
4. Learn: Do they use it? What do they value?

### Phase 2: Refine

1. Build case studies from pilots
2. Refine features based on feedback
3. Introduce pricing

### Phase 3: Scale

1. Content marketing (LinkedIn, safety blogs)
2. Partner with safety consultants
3. Industry conferences
4. Word of mouth from pilots

---

## Technical Simplification

### Remove from Codebase:

```
- Compliance calculation logic
- Absence tracking & cron jobs
- Absence justification workflow
- Leave/exception request system
- Holiday blocking logic
- "Expected check-ins" calculations
- Attendance status (GREEN/ABSENT/etc for attendance)
- DOLE forms (PH-specific)
```

### Keep & Enhance:

```
- Health check-in submission
- Fitness score calculation (FIT/MONITOR/UNFIT)
- Team dashboard with health metrics
- Individual health history
- AI insights engine
- Incident reporting
- Basic team/user management
```

### Result:

```
Smaller codebase
Less edge cases
Easier to maintain
Clearer product
```

---

## Marketing Website (Updated)

### Hero:

```
"How Healthy is Your Workforce Today?"

Daily health insights. Real-time visibility.
Not attendance. Not HR. Pure health intelligence.

[Book a Demo] [See How It Works]
```

### Problem:

```
"You know who showed up. But do you know how they're doing?"

Your HR system tracks attendance.
But it can't tell you:
- Who's burned out?
- Who's struggling with stress?
- Who's too fatigued to work safely?

By the time you find out, it's too late.
```

### Solution:

```
"Aegira gives you health visibility."

Workers share how they're feeling (30 seconds).
You see team health in real-time.
AI spots patterns before they become problems.

Keep your HR system. Add health intelligence.
```

### Features:

```
1. Daily Health Check-ins
   Quick, voluntary wellness assessment

2. Real-time Team Dashboard
   See who's fit, who needs attention

3. AI-Powered Insights
   Patterns, trends, early warnings

4. Individual Trends
   Workers track their own wellbeing

5. Incident Reporting
   When prevention isn't enough
```

---

## Final Summary

### What Aegira Is:

```
Workforce Health Intelligence Platform

- Voluntary daily health check-ins
- Team health dashboards
- AI-powered insights
- Complements existing HR systems
```

### What Aegira Is NOT:

```
- Not attendance tracking
- Not HR software
- Not compliance enforcement
- Not leave management
```

### Why This Works:

```
✅ No competition with HR systems
✅ Fills a gap companies don't have filled
✅ Easy add-on sale
✅ Simpler product to build & maintain
✅ Unique positioning
✅ Honest data (voluntary = truthful)
```

### Target Market:

```
Australia - High-risk industries
Construction, Mining, Logistics, Manufacturing

Companies that:
- Already have HR/attendance systems
- Care about worker safety & health
- Want data they don't currently have
```

---

## Action Items

1. [ ] Remove compliance/attendance logic from codebase
2. [ ] Simplify to health check-in + dashboard + insights
3. [ ] Update UI terminology (no "attendance" language)
4. [ ] Create Australian-focused marketing site
5. [ ] Find 3-5 pilot companies in Australia
6. [ ] Price in AUD as affordable add-on
7. [ ] Host data in Australia (AWS Sydney)

---

## TL;DR

```
OLD: Attendance system with wellness features
     → Competing with HR software
     → Hard sell

NEW: Health intelligence platform
     → Complements HR software
     → Easy add-on

"Keep your HR system. Add Aegira for health insights."

No compliance. No attendance. No HR complexity.
Just: How healthy is your workforce?
```
