/**
 * Daily Monitoring Module Types
 * Local types for the daily monitoring page components
 */

import type { TodayCheckin, MonitoringStats, TeamInfo } from '../../../services/daily-monitoring.service';
import type { Exemption, ExceptionType } from '../../../services/exemption.service';

// Tab types
export type MonitoringTab = 'checkins' | 'changes' | 'exemptions' | 'absences';

// Stats bar props
export interface StatsBarProps {
  stats: {
    greenCount: number;
    yellowCount: number;
    redCount: number;
    totalCheckedIn: number;
    teamSize: number;
  };
}

// Check-in item props
export interface CheckinItemProps {
  checkin: TodayCheckin;
  onCreateExemption?: (checkin: TodayCheckin) => void;
}

// Modal props
export interface ApproveModalProps {
  exemption: Exemption;
  onClose: () => void;
  onConfirm: (endDate: string, notes?: string) => void;
  isLoading: boolean;
  timezone: string;
}

export interface CreateExemptionModalProps {
  checkin: TodayCheckin;
  onClose: () => void;
  onConfirm: (data: { type: ExceptionType; reason: string; endDate: string; notes?: string }) => void;
  isLoading: boolean;
  timezone: string;
}

// Re-export for convenience
export type { TodayCheckin, MonitoringStats, TeamInfo, Exemption, ExceptionType };
