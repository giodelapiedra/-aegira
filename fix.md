. Simplified PeriodSelector Component
File: frontend/src/components/ui/PeriodSelector.tsx
Changes:
Removed custom date range option
Fixed periods lang: 7d, 30d, 90d, 1y, all
Simple dropdown UI (tulad sa image)
Removed complex desktop quick buttons
Consistent across all devices
Before: 8 presets + custom date range picker
After: 5 fixed periods lang, simple dropdown
2. Team Analytics - Work Day Check for "Today" Display
File: frontend/src/pages/team-leader/team-analytics.page.tsx
Changes:
Added isTodayWorkDayForTeam check
Excludes members on leave from expected count
Shows "Not a work day today" if hindi work day
Updated MemberAnalytics interface:
Added isOnLeave: boolean
Added 'ON_LEAVE' to todayStatus type
Lines changed:
Line 252-253: Added work day check
Line 264-269: Calculate expected members (exclude on leave, only if work day)
Line 421-427: Updated card subtitle to show work day status
Before: "0/1 today" kahit Sunday
After: "Not a work day today" kung hindi work day
3. Team Analytics - Period Check-in Rate Card
File: frontend/src/pages/team-leader/team-analytics.page.tsx
Changes:
Changed from "Checked In Today" to "Period Check-in Rate"
Main value: Average period check-in rate (period-based)
Subtitle: Shows today's status (only if work day)
Color coding based on period rate
Lines changed:
Line 271-274: Calculate avgPeriodCheckinRate from members' check-in rates
Line 421-427: Updated card to show period rate + today context
Before: "Checked In Today: 1/2" (today lang)
After: "Period Check-in Rate: 85%" + "Based on team work days • 1/1 checked in today"
4. Team Analytics - Work Days Count Display
File: frontend/src/pages/team-leader/team-analytics.page.tsx
Changes:
Added work days count sa header subtitle
Shows kung ilang work days sa selected period
Lines changed:
Line 391-395: Added work days count display
Display: "Performance insights for Team Name • 22 work days in this period"
5. Team Overview - Backend Stats Endpoint Fix
File: backend/src/modules/teams/index.ts
Changes:
Added isWorkDay() helper function
Checks if today is work day based on team schedule
Excludes members on approved leave from expected count
Returns isWorkDay: boolean in response
notCheckedIn = 0 if not work day
Lines changed:
Line 7-12: Added isWorkDay() helper
Line 238: Get teamWorkDays from database
Line 247: Check if today is work day
Line 257-267: Get members on leave
Line 270-272: Calculate expected (only if work day, exclude on leave)
Line 295-296: Return isWorkDay flag and adjusted notCheckedIn
Before: notCheckedIn: memberIds.length - todayCheckins.length (always counted)
After: notCheckedIn: isTodayWorkDay ? (expectedToCheckIn - todayCheckins.length) : 0
6. Team Overview - Frontend "Not Checked In" Card
File: frontend/src/pages/team-leader/team-overview.page.tsx
Changes:
Shows "—" if not work day
Shows actual count if work day
Color changes to secondary (gray) if not work day
Updated TeamStats interface to include isWorkDay?: boolean
Lines changed:
Line 38-48: Updated TeamStats interface
Line 261-267: Updated card to show "—" if not work day
Before: "Not Checked In: 1" kahit Sunday
After: "Not Checked In: —" kung hindi work day
7. Team Overview - Member List "Not Checked In" Status
File: frontend/src/pages/team-leader/team-overview.page.tsx
Changes:
Shows "Not a work day" instead of "Not checked in" if not work day
Different styling (lighter gray) for non-work days
Lines changed:
Line 431-439: Updated member status display
Before: "Not checked in" badge kahit Sunday
After: "Not a work day" badge kung hindi work day
8. Team Overview - Next Check-in Section
File: frontend/src/pages/team-leader/team-overview.page.tsx
Changes:
Added "Next Check-in" section sa header
Calculates next check-in time based on:
Team work days schedule
Team shift start time
Grace period (30 minutes before shift)
Live countdown timer (updates every minute)
Shows upcoming date/time and time until
Lines changed:
Line 1: Added useEffect import
Line 18: Added Timer icon
Line 26-27: Added schedule utils imports
Line 173-220: Added getNextCheckinInfo() function
Line 222-266: Added timeUntil state and useEffect for countdown
Line 341-375: Added "Next Check-in" UI section
Display:
Next Check-inUpcoming: Mon, Jan 5 at 07:30 AMTime until: 8h 7m
9. Next Check-in - Grace Period Fix
File: frontend/src/pages/team-leader/team-overview.page.tsx
Changes:
Fixed to use grace period (30 min before shift start) instead of shift start time
Consistent with worker's calculation
Lines changed:
Line 207-209: Subtract 30 minutes for tomorrow's check-in
Line 219-221: Subtract 30 minutes for next work day
Before: "Mon, Jan 5 at 08:00 AM" (shift start)
After: "Mon, Jan 5 at 07:30 AM" (grace period)
10. Worker Home - Time Format Fix
File: frontend/src/pages/worker/home.page.tsx
Changes:
Added minutes display sa time until calculation
Consistent format with team leader
Lines changed:
Line 153: Added diffMins calculation
Line 157-160: Updated format to show hours + minutes
Before: "8h" (hours lang)
After: "8h 7m" (hours + minutes)
Summary ng lahat ng files modified
frontend/src/components/ui/PeriodSelector.tsx - Simplified to fixed periods
frontend/src/pages/team-leader/team-analytics.page.tsx - Work day checks, period-based cards
backend/src/modules/teams/index.ts - Work day aware stats endpoint
frontend/src/pages/team-leader/team-overview.page.tsx - Work day checks, next check-in section
frontend/src/pages/worker/home.page.tsx - Time format consistency
Key improvements
Work day awareness — lahat ng "today" metrics ay nagche-check kung work day
Consistent calculations — parehong base sa team work days schedule
Period-based analytics — standardized periods para sa consistent KPIs
Grace period consistency — parehong 30 min before shift start
Better UX — clear messaging kung hindi work day
Lahat ng fixes ay naka-base sa team work days schedule na naka-set sa database.