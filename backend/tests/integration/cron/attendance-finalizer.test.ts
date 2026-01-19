/**
 * Integration Tests for attendance-finalizer.ts (Cron Jobs)
 *
 * Tests the shift-end absence creation and yesterday's absence check logic.
 * Uses mocked Prisma to avoid database dependency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';

// Mock Prisma before importing the module
vi.mock('../../../src/config/prisma.js', () => ({
  prisma: {
    company: {
      findMany: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    checkin: {
      findFirst: vi.fn(),
    },
    dailyAttendance: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    absence: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    exception: {
      findFirst: vi.fn(),
    },
    holiday: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock daily-summary to avoid additional DB calls
vi.mock('../../../src/utils/daily-summary.js', () => ({
  recalculateDailyTeamSummary: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger to suppress output during tests
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocking
import { finalizeAttendance, processShiftEndAbsences } from '../../../src/cron/attendance-finalizer.js';
import { prisma } from '../../../src/config/prisma.js';

// Type the mocked prisma for better TypeScript support
const mockedPrisma = prisma as unknown as {
  company: { findMany: ReturnType<typeof vi.fn> };
  team: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  checkin: { findFirst: ReturnType<typeof vi.fn> };
  dailyAttendance: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  absence: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  exception: { findFirst: ReturnType<typeof vi.fn> };
  holiday: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('Attendance Finalizer Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // finalizeAttendance (Yesterday's Check - 5 AM)
  // ============================================

  describe('finalizeAttendance (Yesterday Check)', () => {
    it('skips processing when not 5 AM local time', async () => {
      // Set time to 10 AM Manila
      vi.setSystemTime(new Date('2025-01-15T02:00:00Z')); // 10 AM in Manila (UTC+8)

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);

      const result = await finalizeAttendance(false); // Not forced

      expect(result.companiesProcessed).toBe(0);
      expect(result.markedAbsent).toBe(0);
    });

    it('processes at 5 AM local time', async () => {
      // Set time to 5 AM Manila (21:00 UTC previous day)
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z')); // 5 AM Jan 15 in Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([]);

      const result = await finalizeAttendance(false);

      expect(result.companiesProcessed).toBe(1);
    });

    it('skips holidays', async () => {
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue({
        name: 'New Year',
        date: new Date('2025-01-14'),
      });
      mockedPrisma.user.findMany.mockResolvedValue([]);

      const result = await finalizeAttendance(false);

      // Holiday should cause skip, so 0 companies "fully" processed with absences
      expect(result.companiesProcessed).toBe(1);
      expect(result.markedAbsent).toBe(0);
    });

    it('forces run regardless of time when forceRun=true', async () => {
      // Set time to 10 AM - normally would skip
      vi.setSystemTime(new Date('2025-01-15T02:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([]);

      const result = await finalizeAttendance(true); // Forced

      expect(result.companiesProcessed).toBe(1);
    });

    it('skips workers who already have attendance records', async () => {
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'John',
          lastName: 'Doe',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue({
        id: 'att-1',
        status: 'GREEN',
      }); // Already has record

      const result = await finalizeAttendance(true);

      expect(result.skipped).toBe(1);
      expect(result.markedAbsent).toBe(0);
    });

    it('skips workers on approved leave', async () => {
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'John',
          lastName: 'Doe',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue(null);
      mockedPrisma.exception.findFirst.mockResolvedValue({
        id: 'exc-1',
        type: 'SICK_LEAVE',
        status: 'APPROVED',
      }); // On leave

      const result = await finalizeAttendance(true);

      expect(result.skipped).toBe(1);
      expect(result.markedAbsent).toBe(0);
    });

    it('skips non-work days for the team', async () => {
      // Set to Saturday (which is not a work day for Mon-Fri schedule)
      vi.setSystemTime(new Date('2025-01-17T21:00:00Z')); // 5 AM Jan 18 (Sat) in Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'John',
          lastName: 'Doe',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI', // No Saturday
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });

      const result = await finalizeAttendance(true);

      expect(result.skipped).toBe(1); // Skipped because Friday is work day but checking Sat
    });

    it('creates absence record for worker who missed check-in', async () => {
      vi.setSystemTime(new Date('2025-01-15T21:00:00Z')); // 5 AM Jan 16 (Thu) in Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'John',
          lastName: 'Doe',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue(null);
      mockedPrisma.exception.findFirst.mockResolvedValue(null);
      mockedPrisma.absence.findUnique.mockResolvedValue(null);
      mockedPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await finalizeAttendance(true);

      expect(mockedPrisma.$transaction).toHaveBeenCalled();
      expect(result.markedAbsent).toBe(1);
    });
  });

  // ============================================
  // processShiftEndAbsences (Same-day Shift-End Check)
  // ============================================

  describe('processShiftEndAbsences (Shift-End Check)', () => {
    it('processes teams whose shift just ended', async () => {
      // Set time to 5 PM (17:00) Manila
      vi.setSystemTime(new Date('2025-01-15T09:00:00Z')); // 5 PM in Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Team A',
          shiftEnd: '17:00', // Matches current hour
          shiftStart: '08:00',
          workDays: 'MON,TUE,WED,THU,FRI',
        },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([]);

      const result = await processShiftEndAbsences(false);

      expect(result.teamsProcessed).toBe(1);
    });

    it('skips teams whose shift has not ended yet', async () => {
      // Set time to 3 PM (15:00) Manila
      vi.setSystemTime(new Date('2025-01-15T07:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Team A',
          shiftEnd: '17:00', // Not yet
          shiftStart: '08:00',
          workDays: 'MON,TUE,WED,THU,FRI',
        },
      ]);

      const result = await processShiftEndAbsences(false);

      expect(result.teamsProcessed).toBe(0);
    });

    it('forces processing all teams when forceRun=true', async () => {
      vi.setSystemTime(new Date('2025-01-15T01:00:00Z')); // 9 AM Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Team A',
          shiftEnd: '17:00',
          shiftStart: '08:00',
          workDays: 'MON,TUE,WED,THU,FRI',
        },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([]);

      const result = await processShiftEndAbsences(true);

      expect(result.teamsProcessed).toBe(1);
    });

    it('skips holidays', async () => {
      vi.setSystemTime(new Date('2025-01-15T09:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Team A',
          shiftEnd: '17:00',
          shiftStart: '08:00',
          workDays: 'MON,TUE,WED,THU,FRI',
        },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue({
        name: 'Holiday',
        date: new Date('2025-01-15'),
      });

      const result = await processShiftEndAbsences(true);

      // Holiday causes skip of the company
      expect(result.teamsProcessed).toBe(0);
    });

    it('marks absent worker who did not check in today', async () => {
      vi.setSystemTime(new Date('2025-01-15T09:00:00Z')); // 5 PM Wed in Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Team A',
          shiftEnd: '17:00',
          shiftStart: '08:00',
          workDays: 'MON,TUE,WED,THU,FRI',
        },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'John',
          lastName: 'Doe',
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue(null);
      mockedPrisma.exception.findFirst.mockResolvedValue(null);
      mockedPrisma.absence.findUnique.mockResolvedValue(null);
      mockedPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await processShiftEndAbsences(true);

      expect(mockedPrisma.$transaction).toHaveBeenCalled();
      expect(result.markedAbsent).toBe(1);
    });
  });

  // ============================================
  // Multiple Timezone Tests
  // ============================================

  describe('Multiple Timezone Handling', () => {
    it('processes multiple companies in different timezones independently', async () => {
      // Set to a time that's 5 AM in Manila but not in New York
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z')); // 5 AM Jan 15 Manila, 4 PM Jan 14 NY

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-manila', timezone: 'Asia/Manila' },
        { id: 'company-ny', timezone: 'America/New_York' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([]);

      const result = await finalizeAttendance(false);

      // Only Manila company should be processed (5 AM there)
      expect(result.companiesProcessed).toBe(1);
    });
  });

  // ============================================
  // New Worker Baseline Date Tests
  // ============================================

  describe('New Worker Baseline Date', () => {
    it('skips worker who joined today (no check-in required yet)', async () => {
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z')); // 5 AM Jan 15 Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'new-worker',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-14T08:00:00Z'), // Joined yesterday
          createdAt: new Date('2025-01-14T08:00:00Z'),
          firstName: 'New',
          lastName: 'Worker',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      // No first check-in - requirement starts next day after joining
      mockedPrisma.checkin.findFirst.mockResolvedValue(null);

      const result = await finalizeAttendance(true);

      // Worker joined Jan 14, checking for Jan 14 absences
      // First required check-in is Jan 15, so Jan 14 should be skipped
      expect(result.skipped).toBe(1);
      expect(result.markedAbsent).toBe(0);
    });

    it('marks absent worker who joined before baseline', async () => {
      vi.setSystemTime(new Date('2025-01-15T21:00:00Z')); // 5 AM Jan 16 Manila

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-10T08:00:00Z'), // Joined Jan 10
          createdAt: new Date('2025-01-10T08:00:00Z'),
          firstName: 'John',
          lastName: 'Doe',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      // Has previous check-in (established worker)
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-13T08:00:00Z'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue(null);
      mockedPrisma.exception.findFirst.mockResolvedValue(null);
      mockedPrisma.absence.findUnique.mockResolvedValue(null);
      mockedPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await finalizeAttendance(true);

      expect(result.markedAbsent).toBe(1);
    });
  });

  // ============================================
  // Holiday Exclusion Tests
  // ============================================

  describe('Holiday Exclusion', () => {
    it('skips entire company on company-wide holiday', async () => {
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue({
        name: 'Independence Day',
        date: new Date('2025-01-14'),
      });

      const result = await finalizeAttendance(true);

      // Company processed but marked absent should be 0 due to holiday
      expect(result.markedAbsent).toBe(0);
    });

    it('correctly handles consecutive holidays', async () => {
      // First day of holiday
      vi.setSystemTime(new Date('2025-01-14T21:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue({
        name: 'Holiday Week Day 1',
        date: new Date('2025-01-14'),
      });

      const result1 = await finalizeAttendance(true);
      expect(result1.markedAbsent).toBe(0);

      // Second day of holiday
      vi.setSystemTime(new Date('2025-01-15T21:00:00Z'));
      mockedPrisma.holiday.findFirst.mockResolvedValue({
        name: 'Holiday Week Day 2',
        date: new Date('2025-01-15'),
      });

      const result2 = await finalizeAttendance(true);
      expect(result2.markedAbsent).toBe(0);
    });
  });

  // ============================================
  // Exemption/Leave Status Tests
  // ============================================

  describe('Exemption/Leave Status', () => {
    it('skips worker with approved exemption covering the date', async () => {
      vi.setSystemTime(new Date('2025-01-15T21:00:00Z'));

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-on-leave',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'On',
          lastName: 'Leave',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue(null);
      // Worker has approved exemption
      mockedPrisma.exception.findFirst.mockResolvedValue({
        id: 'exc-1',
        type: 'SICK_LEAVE',
        status: 'APPROVED',
        startDate: new Date('2025-01-14'),
        endDate: new Date('2025-01-17'),
      });

      const result = await finalizeAttendance(true);

      expect(result.skipped).toBe(1);
      expect(result.markedAbsent).toBe(0);
    });

    it('marks absent worker whose exemption ended yesterday', async () => {
      vi.setSystemTime(new Date('2025-01-16T21:00:00Z')); // Checking Jan 16

      mockedPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1', timezone: 'Asia/Manila' },
      ]);
      mockedPrisma.holiday.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'worker-1',
          companyId: 'company-1',
          teamId: 'team-1',
          teamJoinedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
          firstName: 'John',
          lastName: 'Doe',
          team: {
            id: 'team-1',
            workDays: 'MON,TUE,WED,THU,FRI',
            shiftStart: '08:00',
            isActive: true,
          },
        },
      ]);
      mockedPrisma.checkin.findFirst.mockResolvedValue({
        createdAt: new Date('2025-01-10'),
      });
      mockedPrisma.dailyAttendance.findUnique.mockResolvedValue(null);
      // Exemption ended Jan 15, checking for Jan 16 - no longer covered
      mockedPrisma.exception.findFirst.mockResolvedValue(null);
      mockedPrisma.absence.findUnique.mockResolvedValue(null);
      mockedPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await finalizeAttendance(true);

      expect(result.markedAbsent).toBe(1);
    });
  });
});
