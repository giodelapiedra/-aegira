/**
 * Attendance Finalizer Cron Job
 *
 * Runs hourly with TWO modes:
 *
 * 1. YESTERDAY CHECK (5 AM):
 *    - Processes each company at their local 5 AM
 *    - Marks workers ABSENT if they didn't check in yesterday
 *    - Safety net for anyone missed by shift-end check
 *
 * 2. SHIFT-END CHECK (per team):
 *    - Processes teams whose shift just ended
 *    - Marks workers ABSENT for TODAY if they didn't check in
 *    - Real-time detection (same day)
 *
 * Safeguards:
 * 1. Timezone-aware processing per company
 * 2. Skip if already has attendance record (idempotent)
 * 3. Check all skip conditions (holiday, leave, non-work day, baseline)
 * 4. Transaction for atomic creation
 */

import { DateTime } from 'luxon';
import { prisma } from '../config/prisma.js';
import { recalculateDailyTeamSummary } from '../utils/daily-summary.js';
import { logger } from '../utils/logger.js';
import {
  getNowDT,
  toDateTime,
  toDbDate,
  getDayName,
  DEFAULT_TIMEZONE,
  getStartOfNextDay,
} from '../utils/date-helpers.js';

/**
 * Get baseline date for a worker (when check-in requirement starts)
 * Priority: first check-in > next day after teamJoinedAt > next day after createdAt
 */
async function getBaselineDate(user: {
  id: string;
  teamJoinedAt: Date | null;
  createdAt: Date;
}, timezone: string): Promise<DateTime> {
  // Get first check-in
  const firstCheckin = await prisma.checkin.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  if (firstCheckin) {
    return toDateTime(firstCheckin.createdAt, timezone).startOf('day');
  }

  // No check-ins yet - requirement starts NEXT DAY after joining team
  if (user.teamJoinedAt) {
    return toDateTime(getStartOfNextDay(user.teamJoinedAt, timezone), timezone).startOf('day');
  }

  // Fallback - NEXT DAY after account creation
  return toDateTime(getStartOfNextDay(user.createdAt, timezone), timezone).startOf('day');
}

/**
 * Finalize attendance for all companies
 * Processes each company at their local 5 AM
 * @param forceRun - Skip the 5 AM check (for testing only)
 */
export async function finalizeAttendance(forceRun = false) {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, timezone: true },
  });

  let totalAbsent = 0;
  let totalSkipped = 0;
  let companiesProcessed = 0;

  for (const company of companies) {
    const timezone = company.timezone || DEFAULT_TIMEZONE;
    const now = getNowDT(timezone);

    // ═══════════════════════════════════════════════════
    // SAFEGUARD 1: Only process at 5 AM LOCAL time
    // ═══════════════════════════════════════════════════
    if (!forceRun && now.hour !== 5) {
      continue; // Not their time yet
    }

    companiesProcessed++;
    logger.info(`[CRON] Processing company ${company.id} at ${now.toFormat('HH:mm')} ${timezone}`);

    // ═══════════════════════════════════════════════════
    // SAFEGUARD 2: Calculate "yesterday" in THEIR timezone
    // ═══════════════════════════════════════════════════
    const yesterday = now.minus({ days: 1 });
    const yesterdayDate = toDbDate(yesterday.toJSDate(), timezone);
    const dayName = getDayName(yesterdayDate, timezone);

    // Check if yesterday was a holiday
    const holiday = await prisma.holiday.findFirst({
      where: { companyId: company.id, date: yesterdayDate },
    });
    if (holiday) {
      logger.info(`[CRON] Skipping - holiday: ${holiday.name}`);
      continue;
    }

    // ═══════════════════════════════════════════════════
    // SAFEGUARD 3: Only get THIS company's workers
    // ═══════════════════════════════════════════════════
    const workers = await prisma.user.findMany({
      where: {
        companyId: company.id,
        role: { in: ['WORKER', 'MEMBER'] },
        teamId: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        teamId: true,
        teamJoinedAt: true,
        createdAt: true,
        firstName: true,
        lastName: true,
        team: {
          select: {
            id: true,
            workDays: true,
            shiftStart: true,
            isActive: true,
          },
        },
      },
    });

    const teamsToRecalculate = new Set<string>();

    for (const worker of workers) {
      if (!worker.team || !worker.teamId || !worker.team.isActive) {
        totalSkipped++;
        continue;
      }

      // ═══════════════════════════════════════════════════
      // SAFEGUARD 5a: Check if work day for this team
      // ═══════════════════════════════════════════════════
      const workDays = worker.team.workDays?.split(',').map((d) => d.trim().toUpperCase()) || [];
      if (!workDays.includes(dayName)) {
        totalSkipped++;
        continue;
      }

      // ═══════════════════════════════════════════════════
      // SAFEGUARD 5b: Check baseline date
      // ═══════════════════════════════════════════════════
      const baselineDate = await getBaselineDate(worker, timezone);
      const yesterdayDateTime = toDateTime(yesterdayDate, timezone).startOf('day');
      if (yesterdayDateTime < baselineDate) {
        totalSkipped++;
        continue;
      }

      // ═══════════════════════════════════════════════════
      // SAFEGUARD 4a: Check if already has attendance record
      // ═══════════════════════════════════════════════════
      const existingAttendance = await prisma.dailyAttendance.findUnique({
        where: { userId_date: { userId: worker.id, date: yesterdayDate } },
      });
      if (existingAttendance) {
        totalSkipped++;
        continue;
      }

      // ═══════════════════════════════════════════════════
      // SAFEGUARD 5c: Check if on approved leave
      // ═══════════════════════════════════════════════════
      const onLeave = await prisma.exception.findFirst({
        where: {
          userId: worker.id,
          status: 'APPROVED',
          startDate: { lte: yesterdayDate },
          endDate: { gte: yesterdayDate },
        },
      });
      if (onLeave) {
        totalSkipped++;
        continue;
      }

      // ═══════════════════════════════════════════════════
      // SAFEGUARD 4b: Check if absence already exists (idempotency)
      // ═══════════════════════════════════════════════════
      const existingAbsence = await prisma.absence.findUnique({
        where: { userId_absenceDate: { userId: worker.id, absenceDate: yesterdayDate } },
      });
      if (existingAbsence) {
        totalSkipped++;
        continue;
      }

      // ═══════════════════════════════════════════════════
      // SAFEGUARD 6: Create records in transaction
      // ═══════════════════════════════════════════════════
      try {
        await prisma.$transaction([
          prisma.dailyAttendance.create({
            data: {
              userId: worker.id,
              companyId: worker.companyId,
              teamId: worker.teamId,
              date: yesterdayDate,
              status: 'ABSENT',
              score: 0,
              isCounted: true,
              scheduledStart: worker.team.shiftStart || '08:00',
              checkInTime: null,
            },
          }),
          prisma.absence.create({
            data: {
              userId: worker.id,
              teamId: worker.teamId,
              companyId: worker.companyId,
              absenceDate: yesterdayDate,
              status: 'PENDING_JUSTIFICATION',
              reasonCategory: null,
              explanation: null,
            },
          }),
        ]);

        logger.info(`[CRON] Marked absent: ${worker.firstName} ${worker.lastName}`);
        teamsToRecalculate.add(worker.teamId);
        totalAbsent++;
      } catch (error) {
        logger.error(error, `[CRON] Failed for ${worker.id}`);
      }
    }

    // Recalculate team summaries in parallel
    await Promise.all(
      Array.from(teamsToRecalculate).map((teamId) =>
        recalculateDailyTeamSummary(teamId, yesterdayDate, timezone).catch((err) => {
          logger.error(err, `[CRON] Failed to recalculate summary for team ${teamId}`);
        })
      )
    );
  }

  return {
    companiesProcessed,
    markedAbsent: totalAbsent,
    skipped: totalSkipped,
  };
}

/**
 * Process teams whose shift just ended (same-day absence detection)
 * Called every hour, checks if current hour matches any team's shift end
 */
export async function processShiftEndAbsences(forceRun = false) {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, timezone: true },
  });

  let totalAbsent = 0;
  let totalSkipped = 0;
  let teamsProcessed = 0;

  for (const company of companies) {
    const timezone = company.timezone || DEFAULT_TIMEZONE;
    const now = getNowDT(timezone);
    const currentHour = now.hour;

    // Get teams whose shift just ended (shiftEnd hour matches current hour)
    // Example: shiftEnd = "17:00" → hour 17
    const teams = await prisma.team.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        shiftEnd: true,
        shiftStart: true,
        workDays: true,
      },
    });

    // Filter teams whose shift ended this hour
    const teamsEndedThisHour = teams.filter((team) => {
      const shiftEndHour = parseInt(team.shiftEnd?.split(':')[0] || '17', 10);
      return forceRun || shiftEndHour === currentHour;
    });

    if (teamsEndedThisHour.length === 0) continue;

    // Check if TODAY is a holiday
    const todayDate = toDbDate(now.toJSDate(), timezone);
    const holiday = await prisma.holiday.findFirst({
      where: { companyId: company.id, date: todayDate },
    });
    if (holiday) {
      logger.info(`[CRON-SHIFT] Skipping ${company.id} - holiday: ${holiday.name}`);
      continue;
    }

    const dayName = getDayName(todayDate, timezone);

    for (const team of teamsEndedThisHour) {
      teamsProcessed++;
      logger.info(`[CRON-SHIFT] Processing team ${team.name} (shift ended ${team.shiftEnd}) at ${now.toFormat('HH:mm')} ${timezone}`);

      // Check if today is a work day for this team
      const workDays = team.workDays?.split(',').map((d) => d.trim().toUpperCase()) || [];
      if (!workDays.includes(dayName)) {
        logger.info(`[CRON-SHIFT] Skipping ${team.name} - not a work day (${dayName})`);
        continue;
      }

      // Get workers in this team
      const workers = await prisma.user.findMany({
        where: {
          teamId: team.id,
          role: { in: ['WORKER', 'MEMBER'] },
          isActive: true,
        },
        select: {
          id: true,
          companyId: true,
          teamId: true,
          teamJoinedAt: true,
          createdAt: true,
          firstName: true,
          lastName: true,
        },
      });

      for (const worker of workers) {
        // Check baseline date
        const baselineDate = await getBaselineDate(worker, timezone);
        const todayDateTime = toDateTime(todayDate, timezone).startOf('day');
        if (todayDateTime < baselineDate) {
          totalSkipped++;
          continue;
        }

        // Check if already has attendance record for today
        const existingAttendance = await prisma.dailyAttendance.findUnique({
          where: { userId_date: { userId: worker.id, date: todayDate } },
        });
        if (existingAttendance) {
          totalSkipped++;
          continue;
        }

        // Check if on approved leave
        const onLeave = await prisma.exception.findFirst({
          where: {
            userId: worker.id,
            status: 'APPROVED',
            startDate: { lte: todayDate },
            endDate: { gte: todayDate },
          },
        });
        if (onLeave) {
          totalSkipped++;
          continue;
        }

        // Check if absence already exists
        const existingAbsence = await prisma.absence.findUnique({
          where: { userId_absenceDate: { userId: worker.id, absenceDate: todayDate } },
        });
        if (existingAbsence) {
          totalSkipped++;
          continue;
        }

        // Create records
        try {
          await prisma.$transaction([
            prisma.dailyAttendance.create({
              data: {
                userId: worker.id,
                companyId: worker.companyId,
                teamId: worker.teamId!,
                date: todayDate,
                status: 'ABSENT',
                score: 0,
                isCounted: true,
                scheduledStart: team.shiftStart || '08:00',
                checkInTime: null,
              },
            }),
            prisma.absence.create({
              data: {
                userId: worker.id,
                teamId: worker.teamId!,
                companyId: worker.companyId,
                absenceDate: todayDate,
                status: 'PENDING_JUSTIFICATION',
                reasonCategory: null,
                explanation: null,
              },
            }),
          ]);

          logger.info(`[CRON-SHIFT] Marked absent (today): ${worker.firstName} ${worker.lastName}`);
          totalAbsent++;
        } catch (error) {
          logger.error(error, `[CRON-SHIFT] Failed for ${worker.id}`);
        }
      }

      // Recalculate team summary for today
      await recalculateDailyTeamSummary(team.id, todayDate, timezone).catch((err) => {
        logger.error(err, `[CRON-SHIFT] Failed to recalculate summary for team ${team.id}`);
      });
    }
  }

  return {
    teamsProcessed,
    markedAbsent: totalAbsent,
    skipped: totalSkipped,
  };
}

