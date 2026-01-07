// Timezone options organized by region
// Uses IANA timezone format

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export interface TimezoneGroup {
  label: string;
  options: TimezoneOption[];
}

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    label: 'Asia',
    options: [
      { value: 'Asia/Manila', label: 'Philippines (Manila)', offset: 'UTC+8' },
      { value: 'Asia/Singapore', label: 'Singapore', offset: 'UTC+8' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: 'UTC+8' },
      { value: 'Asia/Taipei', label: 'Taiwan (Taipei)', offset: 'UTC+8' },
      { value: 'Asia/Shanghai', label: 'China (Shanghai)', offset: 'UTC+8' },
      { value: 'Asia/Tokyo', label: 'Japan (Tokyo)', offset: 'UTC+9' },
      { value: 'Asia/Seoul', label: 'South Korea (Seoul)', offset: 'UTC+9' },
      { value: 'Asia/Bangkok', label: 'Thailand (Bangkok)', offset: 'UTC+7' },
      { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (Ho Chi Minh)', offset: 'UTC+7' },
      { value: 'Asia/Jakarta', label: 'Indonesia (Jakarta)', offset: 'UTC+7' },
      { value: 'Asia/Makassar', label: 'Indonesia (Makassar)', offset: 'UTC+8' },
      { value: 'Asia/Jayapura', label: 'Indonesia (Jayapura)', offset: 'UTC+9' },
      { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (Kuala Lumpur)', offset: 'UTC+8' },
      { value: 'Asia/Kolkata', label: 'India (Kolkata)', offset: 'UTC+5:30' },
      { value: 'Asia/Dubai', label: 'UAE (Dubai)', offset: 'UTC+4' },
      { value: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh)', offset: 'UTC+3' },
      { value: 'Asia/Qatar', label: 'Qatar (Doha)', offset: 'UTC+3' },
      { value: 'Asia/Kuwait', label: 'Kuwait', offset: 'UTC+3' },
    ],
  },
  {
    label: 'Australia & Pacific',
    options: [
      { value: 'Australia/Sydney', label: 'Australia (Sydney)', offset: 'UTC+10/+11' },
      { value: 'Australia/Melbourne', label: 'Australia (Melbourne)', offset: 'UTC+10/+11' },
      { value: 'Australia/Brisbane', label: 'Australia (Brisbane)', offset: 'UTC+10' },
      { value: 'Australia/Perth', label: 'Australia (Perth)', offset: 'UTC+8' },
      { value: 'Australia/Adelaide', label: 'Australia (Adelaide)', offset: 'UTC+9:30/+10:30' },
      { value: 'Australia/Darwin', label: 'Australia (Darwin)', offset: 'UTC+9:30' },
      { value: 'Australia/Hobart', label: 'Australia (Hobart)', offset: 'UTC+10/+11' },
      { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)', offset: 'UTC+12/+13' },
      { value: 'Pacific/Fiji', label: 'Fiji', offset: 'UTC+12' },
      { value: 'Pacific/Guam', label: 'Guam', offset: 'UTC+10' },
      { value: 'Pacific/Port_Moresby', label: 'Papua New Guinea', offset: 'UTC+10' },
    ],
  },
  {
    label: 'Americas',
    options: [
      { value: 'America/New_York', label: 'US Eastern (New York)', offset: 'UTC-5/-4' },
      { value: 'America/Chicago', label: 'US Central (Chicago)', offset: 'UTC-6/-5' },
      { value: 'America/Denver', label: 'US Mountain (Denver)', offset: 'UTC-7/-6' },
      { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)', offset: 'UTC-8/-7' },
      { value: 'America/Anchorage', label: 'US Alaska', offset: 'UTC-9/-8' },
      { value: 'Pacific/Honolulu', label: 'US Hawaii', offset: 'UTC-10' },
      { value: 'America/Toronto', label: 'Canada (Toronto)', offset: 'UTC-5/-4' },
      { value: 'America/Vancouver', label: 'Canada (Vancouver)', offset: 'UTC-8/-7' },
      { value: 'America/Mexico_City', label: 'Mexico (Mexico City)', offset: 'UTC-6/-5' },
      { value: 'America/Sao_Paulo', label: 'Brazil (Sao Paulo)', offset: 'UTC-3' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)', offset: 'UTC-3' },
    ],
  },
  {
    label: 'Europe & Africa',
    options: [
      { value: 'Europe/London', label: 'UK (London)', offset: 'UTC+0/+1' },
      { value: 'Europe/Paris', label: 'France (Paris)', offset: 'UTC+1/+2' },
      { value: 'Europe/Berlin', label: 'Germany (Berlin)', offset: 'UTC+1/+2' },
      { value: 'Europe/Amsterdam', label: 'Netherlands (Amsterdam)', offset: 'UTC+1/+2' },
      { value: 'Europe/Rome', label: 'Italy (Rome)', offset: 'UTC+1/+2' },
      { value: 'Europe/Madrid', label: 'Spain (Madrid)', offset: 'UTC+1/+2' },
      { value: 'Europe/Moscow', label: 'Russia (Moscow)', offset: 'UTC+3' },
      { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)', offset: 'UTC+2' },
      { value: 'Africa/Cairo', label: 'Egypt (Cairo)', offset: 'UTC+2' },
      { value: 'Africa/Lagos', label: 'Nigeria (Lagos)', offset: 'UTC+1' },
    ],
  },
];

// Flat list of all timezones
export const ALL_TIMEZONES: TimezoneOption[] = TIMEZONE_GROUPS.flatMap(g => g.options);

// Get timezone label by value
export function getTimezoneLabel(value: string): string {
  const tz = ALL_TIMEZONES.find(t => t.value === value);
  return tz ? `${tz.label} (${tz.offset})` : value;
}

// Get timezone by value
export function getTimezone(value: string): TimezoneOption | undefined {
  return ALL_TIMEZONES.find(t => t.value === value);
}
