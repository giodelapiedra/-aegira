/**
 * Worker Home Utils Tests
 *
 * Tests for worker home page utility functions.
 */

import { describe, it, expect } from 'vitest';
import { calculateWeeklySummary } from '../../../src/pages/worker/home/utils';
import type { WeekCalendarDay } from '../../../src/pages/worker/home/types';

// ============================================
// CALCULATE WEEKLY SUMMARY TESTS
// ============================================

describe('calculateWeeklySummary', () => {
  const createDay = (overrides: Partial<WeekCalendarDay> = {}): WeekCalendarDay => ({
    dayName: 'M',
    dayNum: 1,
    dateStr: '2025-01-13',
    isToday: false,
    isWorkDay: true,
    isFuture: false,
    checkin: null,
    isExempted: false,
    absence: null,
    ...overrides,
  });

  describe('checkin counting', () => {
    it('counts zero check-ins when none exist', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, dateStr: '2025-01-13' }),
        createDay({ dayName: 'T', dayNum: 14, dateStr: '2025-01-14' }),
        createDay({ dayName: 'W', dayNum: 15, dateStr: '2025-01-15' }),
        createDay({ dayName: 'T', dayNum: 16, dateStr: '2025-01-16' }),
        createDay({ dayName: 'F', dayNum: 17, dateStr: '2025-01-17' }),
        createDay({ dayName: 'S', dayNum: 18, dateStr: '2025-01-18', isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, dateStr: '2025-01-19', isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.checkinsThisWeek).toBe(0);
    });

    it('counts check-ins correctly', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          checkin: { id: '1', createdAt: '2025-01-13T09:00:00' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 14,
          checkin: { id: '2', createdAt: '2025-01-14T09:00:00' },
        }),
        createDay({
          dayName: 'W',
          dayNum: 15,
          checkin: { id: '3', createdAt: '2025-01-15T09:00:00' },
        }),
        createDay({ dayName: 'T', dayNum: 16 }),
        createDay({ dayName: 'F', dayNum: 17 }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.checkinsThisWeek).toBe(3);
    });

    it('counts all check-ins for perfect week', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          checkin: { id: '1', createdAt: '2025-01-13T09:00:00' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 14,
          checkin: { id: '2', createdAt: '2025-01-14T09:00:00' },
        }),
        createDay({
          dayName: 'W',
          dayNum: 15,
          checkin: { id: '3', createdAt: '2025-01-15T09:00:00' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 16,
          checkin: { id: '4', createdAt: '2025-01-16T09:00:00' },
        }),
        createDay({
          dayName: 'F',
          dayNum: 17,
          checkin: { id: '5', createdAt: '2025-01-17T09:00:00' },
        }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.checkinsThisWeek).toBe(5);
    });
  });

  describe('work day counting', () => {
    it('counts 5 work days for standard Mon-Fri schedule', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, isWorkDay: true }),
        createDay({ dayName: 'T', dayNum: 14, isWorkDay: true }),
        createDay({ dayName: 'W', dayNum: 15, isWorkDay: true }),
        createDay({ dayName: 'T', dayNum: 16, isWorkDay: true }),
        createDay({ dayName: 'F', dayNum: 17, isWorkDay: true }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.workDaysThisWeek).toBe(5);
    });

    it('counts work days for custom schedule', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, isWorkDay: true }),
        createDay({ dayName: 'T', dayNum: 14, isWorkDay: false }),
        createDay({ dayName: 'W', dayNum: 15, isWorkDay: true }),
        createDay({ dayName: 'T', dayNum: 16, isWorkDay: false }),
        createDay({ dayName: 'F', dayNum: 17, isWorkDay: true }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.workDaysThisWeek).toBe(3);
    });

    it('counts 7 work days for daily schedule', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, isWorkDay: true }),
        createDay({ dayName: 'T', dayNum: 14, isWorkDay: true }),
        createDay({ dayName: 'W', dayNum: 15, isWorkDay: true }),
        createDay({ dayName: 'T', dayNum: 16, isWorkDay: true }),
        createDay({ dayName: 'F', dayNum: 17, isWorkDay: true }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: true }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: true }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.workDaysThisWeek).toBe(7);
    });
  });

  describe('work days passed counting', () => {
    it('counts past work days correctly mid-week', () => {
      // Today is Wednesday
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, isWorkDay: true, isFuture: false }),
        createDay({ dayName: 'T', dayNum: 14, isWorkDay: true, isFuture: false }),
        createDay({ dayName: 'W', dayNum: 15, isWorkDay: true, isFuture: false, isToday: true }),
        createDay({ dayName: 'T', dayNum: 16, isWorkDay: true, isFuture: true }),
        createDay({ dayName: 'F', dayNum: 17, isWorkDay: true, isFuture: true }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false, isFuture: true }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false, isFuture: true }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.workDaysPassed).toBe(3); // Mon, Tue, Wed (including today)
    });

    it('counts zero work days passed on Monday morning', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, isWorkDay: true, isFuture: false, isToday: true }),
        createDay({ dayName: 'T', dayNum: 14, isWorkDay: true, isFuture: true }),
        createDay({ dayName: 'W', dayNum: 15, isWorkDay: true, isFuture: true }),
        createDay({ dayName: 'T', dayNum: 16, isWorkDay: true, isFuture: true }),
        createDay({ dayName: 'F', dayNum: 17, isWorkDay: true, isFuture: true }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false, isFuture: true }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false, isFuture: true }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.workDaysPassed).toBe(1); // Just Monday
    });

    it('counts all work days passed on Friday evening', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13, isWorkDay: true, isFuture: false }),
        createDay({ dayName: 'T', dayNum: 14, isWorkDay: true, isFuture: false }),
        createDay({ dayName: 'W', dayNum: 15, isWorkDay: true, isFuture: false }),
        createDay({ dayName: 'T', dayNum: 16, isWorkDay: true, isFuture: false }),
        createDay({ dayName: 'F', dayNum: 17, isWorkDay: true, isFuture: false, isToday: true }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false, isFuture: true }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false, isFuture: true }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.workDaysPassed).toBe(5);
    });
  });

  describe('absence counting', () => {
    it('counts excused absences', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          absence: { id: '1', absenceDate: '2025-01-13', status: 'EXCUSED' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 14,
          absence: { id: '2', absenceDate: '2025-01-14', status: 'EXCUSED' },
        }),
        createDay({ dayName: 'W', dayNum: 15 }),
        createDay({ dayName: 'T', dayNum: 16 }),
        createDay({ dayName: 'F', dayNum: 17 }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.excusedAbsences).toBe(2);
    });

    it('counts unexcused absences', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          absence: { id: '1', absenceDate: '2025-01-13', status: 'UNEXCUSED' },
        }),
        createDay({ dayName: 'T', dayNum: 14 }),
        createDay({
          dayName: 'W',
          dayNum: 15,
          absence: { id: '2', absenceDate: '2025-01-15', status: 'UNEXCUSED' },
        }),
        createDay({ dayName: 'T', dayNum: 16 }),
        createDay({ dayName: 'F', dayNum: 17 }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.unexcusedAbsences).toBe(2);
    });

    it('counts pending justification absences', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          absence: { id: '1', absenceDate: '2025-01-13', status: 'PENDING_JUSTIFICATION' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 14,
          absence: { id: '2', absenceDate: '2025-01-14', status: 'PENDING_JUSTIFICATION' },
        }),
        createDay({
          dayName: 'W',
          dayNum: 15,
          absence: { id: '3', absenceDate: '2025-01-15', status: 'PENDING_JUSTIFICATION' },
        }),
        createDay({ dayName: 'T', dayNum: 16 }),
        createDay({ dayName: 'F', dayNum: 17 }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.pendingAbsences).toBe(3);
    });

    it('counts mixed absence types correctly', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          absence: { id: '1', absenceDate: '2025-01-13', status: 'EXCUSED' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 14,
          absence: { id: '2', absenceDate: '2025-01-14', status: 'UNEXCUSED' },
        }),
        createDay({
          dayName: 'W',
          dayNum: 15,
          absence: { id: '3', absenceDate: '2025-01-15', status: 'PENDING_JUSTIFICATION' },
        }),
        createDay({
          dayName: 'T',
          dayNum: 16,
          absence: { id: '4', absenceDate: '2025-01-16', status: 'EXCUSED' },
        }),
        createDay({ dayName: 'F', dayNum: 17 }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.excusedAbsences).toBe(2);
      expect(result.unexcusedAbsences).toBe(1);
      expect(result.pendingAbsences).toBe(1);
    });

    it('returns zero absences when none exist', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({ dayName: 'M', dayNum: 13 }),
        createDay({ dayName: 'T', dayNum: 14 }),
        createDay({ dayName: 'W', dayNum: 15 }),
        createDay({ dayName: 'T', dayNum: 16 }),
        createDay({ dayName: 'F', dayNum: 17 }),
        createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
        createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.excusedAbsences).toBe(0);
      expect(result.unexcusedAbsences).toBe(0);
      expect(result.pendingAbsences).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty calendar array', () => {
      const result = calculateWeeklySummary([]);

      expect(result.checkinsThisWeek).toBe(0);
      expect(result.workDaysThisWeek).toBe(0);
      expect(result.workDaysPassed).toBe(0);
      expect(result.excusedAbsences).toBe(0);
      expect(result.unexcusedAbsences).toBe(0);
      expect(result.pendingAbsences).toBe(0);
    });

    it('handles single day calendar', () => {
      const calendar: WeekCalendarDay[] = [
        createDay({
          dayName: 'M',
          dayNum: 13,
          isWorkDay: true,
          isFuture: false,
          checkin: { id: '1', createdAt: '2025-01-13T09:00:00' },
        }),
      ];

      const result = calculateWeeklySummary(calendar);

      expect(result.checkinsThisWeek).toBe(1);
      expect(result.workDaysThisWeek).toBe(1);
      expect(result.workDaysPassed).toBe(1);
    });
  });
});

// ============================================
// REAL-WORLD SCENARIOS
// ============================================

describe('Worker Home Utils - Real-world Scenarios', () => {
  const createDay = (overrides: Partial<WeekCalendarDay> = {}): WeekCalendarDay => ({
    dayName: 'M',
    dayNum: 1,
    dateStr: '2025-01-13',
    isToday: false,
    isWorkDay: true,
    isFuture: false,
    checkin: null,
    isExempted: false,
    absence: null,
    ...overrides,
  });

  it('perfect attendance week', () => {
    const calendar: WeekCalendarDay[] = [
      createDay({
        dayName: 'M',
        dayNum: 13,
        checkin: { id: '1', createdAt: '2025-01-13T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 14,
        checkin: { id: '2', createdAt: '2025-01-14T09:00:00' },
      }),
      createDay({
        dayName: 'W',
        dayNum: 15,
        checkin: { id: '3', createdAt: '2025-01-15T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 16,
        checkin: { id: '4', createdAt: '2025-01-16T09:00:00' },
      }),
      createDay({
        dayName: 'F',
        dayNum: 17,
        checkin: { id: '5', createdAt: '2025-01-17T09:00:00' },
      }),
      createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
      createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
    ];

    const result = calculateWeeklySummary(calendar);

    expect(result.checkinsThisWeek).toBe(5);
    expect(result.workDaysThisWeek).toBe(5);
    expect(result.excusedAbsences).toBe(0);
    expect(result.unexcusedAbsences).toBe(0);
  });

  it('worker on sick leave for 2 days', () => {
    const calendar: WeekCalendarDay[] = [
      createDay({
        dayName: 'M',
        dayNum: 13,
        absence: { id: '1', absenceDate: '2025-01-13', status: 'EXCUSED' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 14,
        absence: { id: '2', absenceDate: '2025-01-14', status: 'EXCUSED' },
      }),
      createDay({
        dayName: 'W',
        dayNum: 15,
        checkin: { id: '1', createdAt: '2025-01-15T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 16,
        checkin: { id: '2', createdAt: '2025-01-16T09:00:00' },
      }),
      createDay({
        dayName: 'F',
        dayNum: 17,
        checkin: { id: '3', createdAt: '2025-01-17T09:00:00' },
      }),
      createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
      createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
    ];

    const result = calculateWeeklySummary(calendar);

    expect(result.checkinsThisWeek).toBe(3);
    expect(result.excusedAbsences).toBe(2);
  });

  it('worker with unexcused absence', () => {
    const calendar: WeekCalendarDay[] = [
      createDay({
        dayName: 'M',
        dayNum: 13,
        checkin: { id: '1', createdAt: '2025-01-13T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 14,
        absence: { id: '1', absenceDate: '2025-01-14', status: 'UNEXCUSED' },
      }),
      createDay({
        dayName: 'W',
        dayNum: 15,
        checkin: { id: '2', createdAt: '2025-01-15T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 16,
        checkin: { id: '3', createdAt: '2025-01-16T09:00:00' },
      }),
      createDay({
        dayName: 'F',
        dayNum: 17,
        checkin: { id: '4', createdAt: '2025-01-17T09:00:00' },
      }),
      createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
      createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
    ];

    const result = calculateWeeklySummary(calendar);

    expect(result.checkinsThisWeek).toBe(4);
    expect(result.unexcusedAbsences).toBe(1);
  });

  it('mid-week summary (Wednesday afternoon)', () => {
    const calendar: WeekCalendarDay[] = [
      createDay({
        dayName: 'M',
        dayNum: 13,
        isFuture: false,
        checkin: { id: '1', createdAt: '2025-01-13T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 14,
        isFuture: false,
        checkin: { id: '2', createdAt: '2025-01-14T09:00:00' },
      }),
      createDay({
        dayName: 'W',
        dayNum: 15,
        isFuture: false,
        isToday: true,
        checkin: { id: '3', createdAt: '2025-01-15T09:00:00' },
      }),
      createDay({ dayName: 'T', dayNum: 16, isFuture: true }),
      createDay({ dayName: 'F', dayNum: 17, isFuture: true }),
      createDay({ dayName: 'S', dayNum: 18, isWorkDay: false, isFuture: true }),
      createDay({ dayName: 'S', dayNum: 19, isWorkDay: false, isFuture: true }),
    ];

    const result = calculateWeeklySummary(calendar);

    expect(result.checkinsThisWeek).toBe(3);
    expect(result.workDaysThisWeek).toBe(5);
    expect(result.workDaysPassed).toBe(3);
  });

  it('worker waiting for absence justification', () => {
    const calendar: WeekCalendarDay[] = [
      createDay({
        dayName: 'M',
        dayNum: 13,
        absence: { id: '1', absenceDate: '2025-01-13', status: 'PENDING_JUSTIFICATION' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 14,
        checkin: { id: '1', createdAt: '2025-01-14T09:00:00' },
      }),
      createDay({
        dayName: 'W',
        dayNum: 15,
        checkin: { id: '2', createdAt: '2025-01-15T09:00:00' },
      }),
      createDay({
        dayName: 'T',
        dayNum: 16,
        checkin: { id: '3', createdAt: '2025-01-16T09:00:00' },
      }),
      createDay({
        dayName: 'F',
        dayNum: 17,
        checkin: { id: '4', createdAt: '2025-01-17T09:00:00' },
      }),
      createDay({ dayName: 'S', dayNum: 18, isWorkDay: false }),
      createDay({ dayName: 'S', dayNum: 19, isWorkDay: false }),
    ];

    const result = calculateWeeklySummary(calendar);

    expect(result.checkinsThisWeek).toBe(4);
    expect(result.pendingAbsences).toBe(1);
  });
});
