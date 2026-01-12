import { getStartOfDay, formatLocalDate } from './src/utils/date-helpers.js';

const TIMEZONE = 'Asia/Manila';

// Jose's exemption: Jan 5-7
const exemptStartRaw = new Date('2026-01-05');
const exemptEndRaw = new Date('2026-01-07');

console.log('Jose exemption dates (raw):');
console.log('  Start:', exemptStartRaw.toISOString());
console.log('  End:', exemptEndRaw.toISOString());

const exemptStart = getStartOfDay(exemptStartRaw, TIMEZONE);
const exemptEnd = getStartOfDay(exemptEndRaw, TIMEZONE);

console.log('\nAfter getStartOfDay (Manila TZ):');
console.log('  exemptStart:', exemptStart.toISOString(), '=', formatLocalDate(exemptStart, TIMEZONE));
console.log('  exemptEnd:', exemptEnd.toISOString(), '=', formatLocalDate(exemptEnd, TIMEZONE));

// Check Jan 6, 7, 8
const testDates = [
  new Date('2026-01-06'),
  new Date('2026-01-07'),
  new Date('2026-01-08'),
];

console.log('\nDate comparison for Jose exemption (Jan 5-7):');
for (const date of testDates) {
  const currentDayStart = getStartOfDay(date, TIMEZONE);
  const dateStr = formatLocalDate(date, TIMEZONE);

  const isGte = currentDayStart >= exemptStart;
  const isLte = currentDayStart <= exemptEnd;
  const isInRange = isGte && isLte;

  console.log(`\n  ${dateStr}:`);
  console.log(`    currentDayStart: ${currentDayStart.toISOString()}`);
  console.log(`    >= exemptStart (${formatLocalDate(exemptStart, TIMEZONE)}): ${isGte}`);
  console.log(`    <= exemptEnd (${formatLocalDate(exemptEnd, TIMEZONE)}): ${isLte}`);
  console.log(`    In range: ${isInRange}`);
}
