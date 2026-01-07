-- Fix dailyAttendance date for records affected by timezone bug
-- The bug stored dates using timezone-converted UTC which caused wrong dates
-- e.g., Jan 7 Manila became Jan 6 in database

-- First, let's see what records exist for member2@gmail.com
-- SELECT da.*, u.email 
-- FROM "DailyAttendance" da
-- JOIN "User" u ON da."userId" = u.id
-- WHERE u.email = 'member2@gmail.com';

-- Fix: Update the date to be at noon UTC for the correct date
-- This updates records where the date appears to be off by a day

-- For member2@gmail.com specifically, update Jan 6 to Jan 7:
UPDATE "DailyAttendance" da
SET date = '2026-01-07'::date
FROM "User" u
WHERE da."userId" = u.id 
  AND u.email = 'member2@gmail.com'
  AND da.date = '2026-01-06'::date;

-- Generic fix: For all records created today that might have wrong date
-- (Only run this if you just checked in and the date is wrong)
-- UPDATE "DailyAttendance"
-- SET date = date + INTERVAL '1 day'
-- WHERE date = CURRENT_DATE - INTERVAL '1 day'
--   AND "createdAt" >= CURRENT_DATE;

