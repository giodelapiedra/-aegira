/**
 * DATA INTEGRITY FIX SCRIPT
 *
 * Fixes:
 * 1. Recalculates readiness scores for all check-ins
 * 2. Creates missing DailyAttendance records
 *
 * Run: npx tsx fix-data-integrity.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateReadiness } from './src/utils/readiness.js';
import { calculateAttendanceStatus, ATTENDANCE_SCORES } from './src/utils/attendance.js';

const prisma = new PrismaClient();

const DEFAULT_TIMEZONE = 'Asia/Manila';
const GRACE_PERIOD = 15;

async function fixDataIntegrity() {
  console.log('=== DATA INTEGRITY FIX ===\n');

  // Get all check-ins
  const allCheckins = await prisma.checkin.findMany({
    include: {
      user: {
        include: {
          team: true,
          company: { select: { timezone: true } },
        },
      },
    },
  });

  console.log(`Total check-ins to process: ${allCheckins.length}\n`);

  let fixedScores = 0;
  let createdAttendance = 0;

  for (const checkin of allCheckins) {
    const { user } = checkin;
    const timezone = user.company?.timezone || DEFAULT_TIMEZONE;
    const shiftStart = user.team?.shiftStart || '08:00';

    // 1. Fix readiness score if mismatched
    const recalc = calculateReadiness({
      mood: checkin.mood,
      stress: checkin.stress,
      sleep: checkin.sleep,
      physicalHealth: checkin.physicalHealth,
    });

    if (checkin.readinessScore !== recalc.score || checkin.readinessStatus !== recalc.status) {
      await prisma.checkin.update({
        where: { id: checkin.id },
        data: {
          readinessScore: recalc.score,
          readinessStatus: recalc.status,
        },
      });
      console.log(`FIXED: ${user.firstName} ${user.lastName} - ${checkin.readinessScore}%→${recalc.score}% (${checkin.readinessStatus}→${recalc.status})`);
      fixedScores++;
    }

    // 2. Create DailyAttendance if missing
    if (!user.team) continue;

    // Get date in company timezone
    const checkinDate = new Date(checkin.createdAt);
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    const dateStr = dateFormatter.format(checkinDate);

    // Create date at noon UTC for proper DB storage
    const dbDate = new Date(dateStr + 'T12:00:00Z');

    // Check if attendance record exists
    const existingAttendance = await prisma.dailyAttendance.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: dbDate,
        },
      },
    });

    if (!existingAttendance) {
      // Calculate attendance status
      const attendanceResult = calculateAttendanceStatus(
        checkinDate,
        shiftStart,
        GRACE_PERIOD,
        timezone
      );

      await prisma.dailyAttendance.create({
        data: {
          userId: user.id,
          companyId: user.companyId,
          teamId: user.team.id,
          date: dbDate,
          scheduledStart: shiftStart,
          gracePeriodMins: GRACE_PERIOD,
          checkInTime: checkinDate,
          minutesLate: attendanceResult.minutesLate,
          status: attendanceResult.status,
          score: attendanceResult.score,
          isCounted: attendanceResult.isCounted,
        },
      });
      console.log(`CREATED ATTENDANCE: ${user.firstName} ${user.lastName} - ${dateStr} (${attendanceResult.status})`);
      createdAttendance++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed readiness scores: ${fixedScores}`);
  console.log(`Created attendance records: ${createdAttendance}`);
  console.log('Done!');
}

fixDataIntegrity()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
