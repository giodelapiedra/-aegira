/**
 * Absence Types for Absence Justification System
 */

export type AbsenceReason =
  | 'SICK'
  | 'EMERGENCY'
  | 'PERSONAL'
  | 'FORGOT_CHECKIN'
  | 'TECHNICAL_ISSUE'
  | 'OTHER';

export type AbsenceStatus =
  | 'PENDING_JUSTIFICATION'
  | 'EXCUSED'
  | 'UNEXCUSED';

export interface Absence {
  id: string;
  userId: string;
  absenceDate: string;
  teamId: string;
  reasonCategory: AbsenceReason | null;
  explanation: string | null;
  justifiedAt: string | null;
  status: AbsenceStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AbsenceWithUser extends Absence {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

export interface AbsenceWithReviewer extends Absence {
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AbsenceWithAll extends AbsenceWithUser {
  team?: {
    id: string;
    name: string;
    leaderId: string | null;
  };
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface JustificationInput {
  absenceId: string;
  reasonCategory: AbsenceReason;
  explanation: string;
}

export interface JustifyAbsencesRequest {
  justifications: JustificationInput[];
}

export interface ReviewAbsenceRequest {
  action: 'EXCUSED' | 'UNEXCUSED';
  notes?: string;
}

export interface PendingAbsencesResponse {
  data: Absence[];
  count: number;
  hasBlocking: boolean;
}

export interface AbsenceHistoryResponse {
  data: AbsenceWithReviewer[];
  count: number;
}

export interface TeamPendingResponse {
  data: AbsenceWithUser[];
  count: number;
}

export interface AbsenceStatsResponse {
  pendingJustification: number;
  pendingReview: number;
  excused: number;
  unexcused: number;
  total: number;
}

export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  SICK: 'Sick',
  EMERGENCY: 'Emergency',
  PERSONAL: 'Personal',
  FORGOT_CHECKIN: 'Forgot to check-in',
  TECHNICAL_ISSUE: 'Technical issue',
  OTHER: 'Other',
};

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  PENDING_JUSTIFICATION: 'Pending',
  EXCUSED: 'Excused',
  UNEXCUSED: 'Unexcused',
};

export const ABSENCE_STATUS_COLORS: Record<AbsenceStatus, string> = {
  PENDING_JUSTIFICATION: 'yellow',
  EXCUSED: 'green',
  UNEXCUSED: 'red',
};
