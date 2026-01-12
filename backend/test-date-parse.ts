import { getStartOfDay, formatLocalDate } from './src/utils/date-helpers.js';

const TIMEZONE = 'Asia/Manila';

// How is Jan 8 being parsed?
const jan8String = '2026-01-08';
const jan8Date = new Date(jan8String);

console.log('new Date("2026-01-08"):');
console.log('  ISO:', jan8Date.toISOString());
console.log('  formatLocalDate:', formatLocalDate(jan8Date, TIMEZONE));
console.log('  getStartOfDay:', getStartOfDay(jan8Date, TIMEZONE).toISOString());

// Exemption end date (stored in DB)
const exemptEnd = new Date('2026-01-07');
console.log('\nExemption end date:');
console.log('  Raw:', exemptEnd.toISOString());
console.log('  getStartOfDay:', getStartOfDay(exemptEnd, TIMEZONE).toISOString());

// Compare
const jan8Start = getStartOfDay(jan8Date, TIMEZONE);
const exemptEndStart = getStartOfDay(exemptEnd, TIMEZONE);
console.log('\nComparison:');
console.log('  jan8Start.getTime():', jan8Start.getTime());
console.log('  exemptEndStart.getTime():', exemptEndStart.getTime());
console.log('  jan8Start <= exemptEndStart:', jan8Start <= exemptEndStart);
console.log('  jan8Start.getTime() <= exemptEndStart.getTime():', jan8Start.getTime() <= exemptEndStart.getTime());
