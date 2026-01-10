import api from './api';
import type { Holiday, HolidayListResponse } from '../types/calendar';

// Get all holidays for company
export async function getHolidays(year?: number, month?: number): Promise<Holiday[]> {
  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  if (month) params.append('month', month.toString());

  const query = params.toString();
  const response = await api.get<HolidayListResponse>(`/holidays${query ? `?${query}` : ''}`);
  return response.data.data;
}

// Check if a specific date is a holiday
export async function checkHoliday(date: string): Promise<{ isHoliday: boolean; holiday: Holiday | null }> {
  const response = await api.get<{ isHoliday: boolean; holiday: Holiday | null }>(`/holidays/check/${date}`);
  return response;
}

// Add a holiday (Executive only)
export async function addHoliday(date: string, name: string): Promise<Holiday> {
  const response = await api.post<Holiday>('/holidays', { date, name });
  return response;
}

// Remove a holiday by ID (Executive only)
export async function removeHoliday(id: string): Promise<void> {
  await api.delete(`/holidays/${id}`);
}

// Remove a holiday by date (Executive only)
export async function removeHolidayByDate(date: string): Promise<void> {
  await api.delete(`/holidays/date/${date}`);
}
