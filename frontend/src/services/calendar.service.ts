import api from './api';
import type { MyCalendarResponse, TeamCalendarResponse } from '../types/calendar';

// Get personal calendar data (Worker/Member)
export async function getMyCalendar(year: number, month: number): Promise<MyCalendarResponse> {
  const response = await api.get<MyCalendarResponse>(`/calendar/my?year=${year}&month=${month}`);
  return response.data;
}

// Get team calendar data (Team Leader)
export async function getTeamCalendar(year: number, month: number): Promise<TeamCalendarResponse> {
  const response = await api.get<TeamCalendarResponse>(`/calendar/team?year=${year}&month=${month}`);
  return response.data;
}
