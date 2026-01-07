# Timezone Implementation Documentation

## Overview
This document records all changes made to implement timezone-aware functionality across the application. The system now supports any IANA timezone selected during company registration, ensuring accurate time calculations and displays regardless of the user's browser timezone.

## Changes Summary

### 1. Backend Changes

#### File: `backend/src/modules/teams/index.ts`

**Updated `/teams/my` endpoint** to include timezone in company data:

```typescript
company: {
  select: {
    id: true,
    name: true,
    timezone: true,  // ✅ Added
  },
}
```

**Purpose**: Ensures timezone is available in frontend for all timezone-aware calculations.

---

### 2. Frontend Utility Functions

#### File: `frontend/src/lib/date-utils.ts`

#### A. `getNowInTimezone(timezone: string)`

**Purpose**: Get current date/time in a specific timezone

**Returns**: 
```typescript
{
  date: Date;
  hour: number;
  minute: number;
  dayOfWeek: number;
}
```

**Implementation**:
- Uses `Intl.DateTimeFormat` with `timeZone` option
- Formats current time in target timezone
- Creates UTC-based Date object for consistent comparisons
- Calculates day of week in target timezone

**Usage**:
```typescript
const nowInTz = getNowInTimezone('Australia/Sydney');
// Returns current time as it appears in Sydney timezone
```

#### B. `createDateWithTimeInTimezone(timeString, date, timezone)`

**Purpose**: Create a Date object representing a specific time in a specific timezone

**Parameters**:
- `timeString`: Time in "HH:mm" format (e.g., "08:00")
- `date`: Date to set the time on (in target timezone)
- `timezone`: IANA timezone string (e.g., "Australia/Sydney")

**Returns**: `Date` object (UTC-based) that represents the time in target timezone

**Implementation**:
- Uses iterative search to find correct UTC timestamp
- Searches ±14 hours range (covers all timezone offsets)
- Refines with minute-level precision if needed
- Returns UTC-based Date for accurate comparisons

**Usage**:
```typescript
const shiftStart = createDateWithTimeInTimezone('08:00', todayDate, 'Australia/Sydney');
// Returns Date object that, when displayed in Sydney timezone, shows 08:00
```

---

### 3. Frontend Page Updates

#### File: `frontend/src/pages/team-leader/team-overview.page.tsx`

#### A. Next Check-in Calculation

**Changes**:
- Uses `getNowInTimezone()` for current time in company timezone
- Uses `createDateWithTimeInTimezone()` for all shift time calculations
- Grace period calculation is timezone-aware
- All date comparisons use company timezone

**Key Code**:
```typescript
const timezone = team.company?.timezone || 'Asia/Manila';
const nowInTz = getNowInTimezone(timezone);
const now = nowInTz.date;

// Create shift times in company timezone
const todayShiftEnd = createDateWithTimeInTimezone(team.shiftEnd, todayInTz, timezone);

// Grace period calculation
const graceStart = createDateWithTimeInTimezone(graceTimeString, todayInTz, timezone);
```

#### B. Shift Hours Display

**Changes**:
- Timezone-aware formatting
- Displays in 12-hour format (AM/PM) in company timezone
- Uses `toLocaleTimeString()` with `timeZone` option

**Key Code**:
```typescript
const startTime = createDateWithTimeInTimezone(shiftStart, todayDate, timezone);
const startFormatted = startTime.toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: timezone,
});
```

#### C. Next Check-in Display

**Changes**:
- Date/time display includes `timeZone` option
- All formatting uses company timezone

**Key Code**:
```typescript
nextCheckinInfo.date.toLocaleDateString('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: team?.company?.timezone || 'Asia/Manila',
})
```

#### D. Time Until Calculation

**Changes**:
- Uses company timezone for current time
- All calculations based on same timezone

**Key Code**:
```typescript
const timezone = team?.company?.timezone || 'Asia/Manila';
const nowInTz = getNowInTimezone(timezone);
const now = nowInTz.date;
const diffMs = nextCheckinInfo.date.getTime() - now.getTime();
```

#### E. Timezone Indicator

**Changes**:
- Added timezone display in Work Schedule section
- Shows which timezone is being used

**Key Code**:
```typescript
{team?.company?.timezone && (
  <span className="text-xs text-gray-500">
    Timezone: {team.company.timezone}
  </span>
)}
```

---

## Key Features

### 1. Universal Timezone Support
- ✅ Works with **any IANA timezone** (not limited to Philippines/Australia)
- ✅ Uses standard `Intl.DateTimeFormat` API
- ✅ Supports all timezone offsets (-12 to +14 hours)

### 2. Consistent Timezone Usage
- ✅ All calculations based on **company timezone**
- ✅ No longer depends on user's browser timezone
- ✅ Same timezone used throughout the application

### 3. Accurate Date/Time Calculations
- ✅ UTC-based Date objects for correct comparisons
- ✅ Iterative search for accurate timezone conversion
- ✅ Handles DST (Daylight Saving Time) automatically

### 4. User-Friendly Display
- ✅ Shift hours: 12-hour format (8:00 AM - 5:00 PM)
- ✅ Next check-in: Formatted date/time in company timezone
- ✅ Timezone indicator: Shows which timezone is being used

---

## Files Modified

1. **`backend/src/modules/teams/index.ts`**
   - Added `timezone` to company select in `/teams/my` endpoint

2. **`frontend/src/lib/date-utils.ts`**
   - Added `getNowInTimezone()` function
   - Added `createDateWithTimeInTimezone()` function

3. **`frontend/src/pages/team-leader/team-overview.page.tsx`**
   - Updated `getNextCheckinInfo()` to use timezone-aware calculations
   - Updated Shift Hours display to use company timezone
   - Updated Next Check-in display to use company timezone
   - Updated Time Until calculation to use company timezone
   - Added timezone indicator in UI

---

## How It Works

### Flow Diagram

```
1. Registration
   └─> Executive selects timezone
       └─> Saved to database (Company.timezone)

2. Team Data Retrieval
   └─> GET /teams/my
       └─> Includes company.timezone in response

3. Frontend Calculations
   └─> getNowInTimezone(company.timezone)
       └─> Gets current time in company timezone
   └─> createDateWithTimeInTimezone(time, date, company.timezone)
       └─> Creates Date objects in company timezone

4. Display
   └─> toLocaleTimeString({ timeZone: company.timezone })
       └─> Formats times in company timezone
```

### Example: Australia/Sydney Timezone

**Scenario**: Company timezone is `Australia/Sydney` (UTC+10/+11)

1. **Shift Hours**: `08:00 - 17:00` stored in database
2. **Display**: Shows as `8:00 AM - 5:00 PM` (Sydney time)
3. **Grace Period**: `07:30 AM` (Sydney time)
4. **Next Check-in**: Calculated based on Sydney timezone
5. **Time Until**: Calculated using Sydney timezone

**Result**: All times are accurate for Sydney timezone, regardless of user's browser timezone.

---

## Supported Timezones

The system supports **all IANA timezones**, including:

### Asia
- `Asia/Manila` (Philippines)
- `Asia/Singapore`
- `Asia/Tokyo` (Japan)
- `Asia/Shanghai` (China)
- `Asia/Dubai` (UAE)
- And many more...

### Australia & Pacific
- `Australia/Sydney`
- `Australia/Melbourne`
- `Australia/Brisbane`
- `Pacific/Auckland` (New Zealand)
- And more...

### Americas
- `America/New_York` (US Eastern)
- `America/Chicago` (US Central)
- `America/Los_Angeles` (US Pacific)
- `America/Toronto` (Canada)
- And more...

### Europe & Africa
- `Europe/London` (UK)
- `Europe/Paris` (France)
- `Europe/Berlin` (Germany)
- `Africa/Johannesburg` (South Africa)
- And more...

---

## Benefits

### ✅ Accuracy
- All times are based on company timezone
- No confusion from browser timezone differences

### ✅ Consistency
- All users see the same times
- Team members in different locations see consistent schedules

### ✅ Universal Support
- Works with any IANA timezone
- Not limited to specific regions

### ✅ User-Friendly
- Clear timezone indicator
- Formatted times (12-hour format)
- Easy to understand

---

## Testing Checklist

When testing timezone functionality:

- [ ] Register with different timezone (e.g., Australia/Sydney)
- [ ] Verify Shift Hours display shows correct timezone
- [ ] Verify Next Check-in shows correct timezone
- [ ] Verify Time Until calculation is accurate
- [ ] Verify timezone indicator is displayed
- [ ] Test with different timezones (US, Europe, Asia, etc.)
- [ ] Verify calculations work across different browser timezones

---

## Notes

- **IANA Timezone Format**: All timezones use IANA format (e.g., `Australia/Sydney`, not `GMT+10`)
- **UTC-Based Storage**: All Date objects are UTC-based internally for accurate comparisons
- **Browser Support**: Uses standard `Intl.DateTimeFormat` API (supported in all modern browsers)
- **DST Handling**: Automatically handled by browser's Intl API

---

## Future Enhancements

Potential improvements:
- [ ] Add timezone selector for individual users (override company timezone)
- [ ] Show timezone offset in UI (e.g., "UTC+10")
- [ ] Add timezone conversion helper for multi-timezone teams
- [ ] Cache timezone calculations for performance

---

**Last Updated**: 2025-01-06
**Version**: 1.0

