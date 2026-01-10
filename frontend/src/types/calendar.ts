// Calendar Types

export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdBy?: string;
  createdAt?: string;
}

export interface Exemption {
  id: string;
  userId?: string;
  userName?: string;
  type: string;
  reason: string;
  startDate: string | null;
  endDate: string | null;
}

export interface DayInfo {
  date: string;
  dayOfWeek: string;
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isExempted: boolean;
  exemptionType?: string;
  checkinStatus?: 'GREEN' | 'YELLOW' | 'RED';
  checkinTime?: string;
  readinessScore?: number;
  attendanceStatus?: string;
  isPast: boolean;
  isToday: boolean;
  isBeforeStart?: boolean; // Date is before user joined team
}

export interface TeamDayInfo {
  date: string;
  dayOfWeek: string;
  isWorkDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isBeforeTeamStart?: boolean; // Date is before team was created
  memberStatuses: MemberStatus[];
  checkedInCount: number;
  exemptedCount: number;
  requiredCount?: number; // Members required to check in (excludes not_required)
  isPast: boolean;
  isToday: boolean;
}

export interface MemberStatus {
  userId: string;
  name: string;
  avatar?: string;
  status: 'checked_in' | 'exempted' | 'absent' | 'pending' | 'not_required';
  checkinTime?: string;
  readinessStatus?: string;
  exemptionType?: string;
  startDate?: string; // When member started requiring check-ins
}

export interface CalendarSummary {
  totalDays: number;
  workDays: number;
  checkedIn?: number;
  holidays: number;
  exempted?: number;
  totalMembers?: number;
}

export interface TeamInfo {
  id: string;
  name: string;
  workDays: string;
  shiftStart: string;
  shiftEnd: string;
  memberCount?: number;
}

export interface MemberInfo {
  id: string;
  name: string;
  avatar?: string;
}

// API Response Types

export interface MyCalendarResponse {
  year: number;
  month: number;
  startDate?: string; // When user's check-in requirement started
  team: TeamInfo | null;
  days: DayInfo[];
  summary: CalendarSummary;
  holidays: { date: string; name: string }[];
  exemptions: Exemption[];
}

export interface TeamCalendarResponse {
  year: number;
  month: number;
  startDate?: string; // When team was created (check-in requirement started)
  team: TeamInfo;
  members: MemberInfo[];
  days: TeamDayInfo[];
  summary: CalendarSummary;
  holidays: { date: string; name: string }[];
  exemptions: Exemption[];
}

export interface HolidayListResponse {
  data: Holiday[];
}

// Calendar Component Props
export interface CalendarProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onDateClick?: (date: string) => void;
  renderDay?: (date: string, dayData: DayInfo | TeamDayInfo | null) => React.ReactNode;
  holidays: Holiday[];
  workDays?: string;
  className?: string;
}
