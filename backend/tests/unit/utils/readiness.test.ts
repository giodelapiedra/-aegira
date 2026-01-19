/**
 * Unit Tests for readiness.ts
 *
 * Tests the readiness score calculation logic.
 */

import { describe, it, expect } from 'vitest';
import { calculateReadiness, type ReadinessStatus, type CheckinData } from '../../../src/utils/readiness.js';

// ============================================
// calculateReadiness TESTS
// ============================================

describe('calculateReadiness', () => {
  describe('Score Calculation', () => {
    it('calculates perfect score (100) for all 10s', () => {
      const data: CheckinData = {
        mood: 10,
        stress: 0, // 0 stress = 100% stress score (inverted)
        sleep: 10,
        physicalHealth: 10,
      };
      const result = calculateReadiness(data);
      expect(result.score).toBe(100);
      expect(result.status).toBe('GREEN');
    });

    it('calculates worst score (0) for worst inputs', () => {
      const data: CheckinData = {
        mood: 0,
        stress: 10, // Max stress = 0% stress score (inverted)
        sleep: 0,
        physicalHealth: 0,
      };
      const result = calculateReadiness(data);
      expect(result.score).toBe(0);
      expect(result.status).toBe('RED');
    });

    it('calculates middle score (50) for all 5s', () => {
      const data: CheckinData = {
        mood: 5,
        stress: 5, // 5 stress = 50% stress score (inverted: (10-5)/10 * 100 = 50)
        sleep: 5,
        physicalHealth: 5,
      };
      const result = calculateReadiness(data);
      expect(result.score).toBe(50);
      expect(result.status).toBe('YELLOW');
    });

    it('applies equal weights (25% each)', () => {
      // mood = 10 (100%), stress = 10 (0%), sleep = 10 (100%), physical = 10 (100%)
      // Expected = (100 + 0 + 100 + 100) / 4 = 75
      const data: CheckinData = {
        mood: 10,
        stress: 10, // High stress = 0% stress score
        sleep: 10,
        physicalHealth: 10,
      };
      const result = calculateReadiness(data);
      expect(result.score).toBe(75);
    });

    it('inverts stress correctly (high stress = low score)', () => {
      // Only stress at 10, others at 0
      // Expected = (0 + 0 + 0 + 0) / 4 = 0
      const data: CheckinData = {
        mood: 0,
        stress: 10,
        sleep: 0,
        physicalHealth: 0,
      };
      const result = calculateReadiness(data);
      expect(result.score).toBe(0);

      // Only stress at 0 (no stress = good), others at 0
      // Expected = (0 + 100 + 0 + 0) / 4 = 25
      const data2: CheckinData = {
        mood: 0,
        stress: 0,
        sleep: 0,
        physicalHealth: 0,
      };
      const result2 = calculateReadiness(data2);
      expect(result2.score).toBe(25);
    });

    it('rounds the score to nearest integer', () => {
      // mood=7 (70%), stress=3 (70%), sleep=8 (80%), physical=6 (60%)
      // Expected = (70 + 70 + 80 + 60) / 4 = 70
      const data: CheckinData = {
        mood: 7,
        stress: 3,
        sleep: 8,
        physicalHealth: 6,
      };
      const result = calculateReadiness(data);
      expect(result.score).toBe(70);
    });
  });

  describe('Status Determination', () => {
    it('returns GREEN for score >= 70', () => {
      const greenScores = [70, 75, 80, 90, 100];

      for (const targetScore of greenScores) {
        // Calculate inputs that would give this score
        // With equal weights, if all inputs are the same:
        // score = input * 10 for non-stress, (10-input) * 10 for stress
        // For simplicity, use mood only at different levels
        const data: CheckinData = {
          mood: targetScore / 10,
          stress: (100 - targetScore) / 10,
          sleep: targetScore / 10,
          physicalHealth: targetScore / 10,
        };
        const result = calculateReadiness(data);
        expect(result.status).toBe('GREEN');
      }
    });

    it('returns YELLOW for score between 40-69', () => {
      // Test boundary at 40
      const data40: CheckinData = {
        mood: 4,
        stress: 6, // (10-6)/10*100 = 40
        sleep: 4,
        physicalHealth: 4,
      };
      const result40 = calculateReadiness(data40);
      expect(result40.status).toBe('YELLOW');

      // Test boundary at 69
      const data69: CheckinData = {
        mood: 6.9,
        stress: 3.1, // (10-3.1)/10*100 = 69
        sleep: 6.9,
        physicalHealth: 6.9,
      };
      const result69 = calculateReadiness(data69);
      expect(result69.status).toBe('YELLOW');
    });

    it('returns RED for score < 40', () => {
      const data: CheckinData = {
        mood: 3,
        stress: 7, // (10-7)/10*100 = 30
        sleep: 3,
        physicalHealth: 3,
      };
      const result = calculateReadiness(data);
      expect(result.status).toBe('RED');
    });

    it('returns RED for zero score', () => {
      const data: CheckinData = {
        mood: 0,
        stress: 10,
        sleep: 0,
        physicalHealth: 0,
      };
      const result = calculateReadiness(data);
      expect(result.status).toBe('RED');
    });
  });

  describe('Edge Cases', () => {
    it('handles decimal inputs', () => {
      const data: CheckinData = {
        mood: 7.5,
        stress: 2.5,
        sleep: 8.5,
        physicalHealth: 6.5,
      };
      const result = calculateReadiness(data);
      expect(typeof result.score).toBe('number');
      expect(Number.isInteger(result.score)).toBe(true);
    });

    it('handles boundary values correctly', () => {
      // Exactly at GREEN boundary
      const green: CheckinData = { mood: 7, stress: 3, sleep: 7, physicalHealth: 7 };
      expect(calculateReadiness(green).status).toBe('GREEN');

      // Exactly at YELLOW boundary
      const yellow: CheckinData = { mood: 4, stress: 6, sleep: 4, physicalHealth: 4 };
      expect(calculateReadiness(yellow).status).toBe('YELLOW');
    });
  });

  describe('Real-world Scenarios', () => {
    it('tired worker with high stress', () => {
      const data: CheckinData = {
        mood: 5,
        stress: 8, // High stress
        sleep: 3, // Poor sleep
        physicalHealth: 6,
      };
      const result = calculateReadiness(data);
      // (50 + 20 + 30 + 60) / 4 = 40
      expect(result.score).toBe(40);
      expect(result.status).toBe('YELLOW');
    });

    it('well-rested worker, low stress', () => {
      const data: CheckinData = {
        mood: 8,
        stress: 2, // Low stress
        sleep: 9, // Great sleep
        physicalHealth: 8,
      };
      const result = calculateReadiness(data);
      // (80 + 80 + 90 + 80) / 4 = 82.5 -> 83
      expect(result.score).toBe(83);
      expect(result.status).toBe('GREEN');
    });

    it('worker with minor physical issue', () => {
      const data: CheckinData = {
        mood: 7,
        stress: 4,
        sleep: 7,
        physicalHealth: 4, // Minor injury
      };
      const result = calculateReadiness(data);
      // (70 + 60 + 70 + 40) / 4 = 60
      expect(result.score).toBe(60);
      expect(result.status).toBe('YELLOW');
    });

    it('critically unwell worker', () => {
      const data: CheckinData = {
        mood: 2,
        stress: 9,
        sleep: 2,
        physicalHealth: 2,
      };
      const result = calculateReadiness(data);
      // (20 + 10 + 20 + 20) / 4 = 17.5 -> 18
      expect(result.score).toBe(18);
      expect(result.status).toBe('RED');
    });
  });
});
