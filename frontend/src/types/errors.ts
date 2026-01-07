// API Error codes used by the backend
export type CheckinErrorCode =
  | 'NO_TEAM'
  | 'NO_TEAM_LEADER'
  | 'NOT_WORK_DAY'
  | 'TOO_EARLY'
  | 'TOO_LATE'
  | 'ALREADY_CHECKED_IN';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DEACTIVATED'
  | 'NO_COMPANY'
  | 'INVALID_TOKEN';

export type GeneralErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'EMAIL_IN_USE';

export type ApiErrorCode = CheckinErrorCode | AuthErrorCode | GeneralErrorCode;

export interface ApiError {
  error: string;
  code?: ApiErrorCode;
  details?: unknown;
}

export interface ValidationError extends ApiError {
  details: Array<{
    code: string;
    message: string;
    path: string[];
  }>;
}

// Error messages mapping for user-friendly display
export const ERROR_MESSAGES: Record<string, string> = {
  NO_TEAM: 'You must be assigned to a team first.',
  NO_TEAM_LEADER: 'Your team does not have a team leader assigned. Please contact your administrator.',
  NOT_WORK_DAY: 'Today is not a scheduled work day for your team.',
  TOO_EARLY: 'Check-in is not yet available. Please wait until your shift time.',
  TOO_LATE: 'Check-in time has ended for today.',
  ALREADY_CHECKED_IN: 'You have already checked in today.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_DEACTIVATED: 'Your account has been deactivated.',
  NO_COMPANY: 'Your account is not associated with a company.',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  EMAIL_IN_USE: 'This email address is already in use.',
};

// Helper function to get user-friendly error message
export function getErrorMessage(error: ApiError | unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const apiError = error as ApiError;
    if (apiError.code && ERROR_MESSAGES[apiError.code]) {
      return ERROR_MESSAGES[apiError.code];
    }
    if (apiError.error) {
      return apiError.error;
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

// Type guard to check if error is an API error
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as ApiError).error === 'string'
  );
}
