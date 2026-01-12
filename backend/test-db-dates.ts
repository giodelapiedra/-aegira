import { PrismaClient } from '@prisma/client';
import { getStartOfDay, formatLocalDate } from './src/utils/date-helpers.js';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Manila';

async function check() {
  // Get Jose's exemption from DB
  const exemption = await prisma.exception.findFirst({
    where: {
      user: { firstName: 'Jose', lastName: 'Garcia' },
      status: 'APPROVED',
    },
  });

  if (!exemption) {
    console.log('No exemption found');
    return;
  }

  console.log('Jose exemption from DB:');
  console.log('  startDate raw:', exemption.startDate);
  console.log('  startDate ISO:', exemption.startDate.toISOString());
  console.log('  endDate raw:', exemption.endDate);
  console.log('  endDate ISO:', exemption.endDate.toISOString());

  // Apply getStartOfDay
  const exemptStart = getStartOfDay(exemption.startDate, TIMEZONE);
  const exemptEnd = getStartOfDay(exemption.endDate, TIMEZONE);

  console.log('\nAfter getStartOfDay:');
  console.log('  exemptStart:', exemptStart.toISOString(), '=', formatLocalDate(exemptStart, TIMEZONE));
  console.log('  exemptEnd:', exemptEnd.toISOString(), '=', formatLocalDate(exemptEnd, TIMEZONE));

  // Test Jan 8
  const jan8 = new Date('2026-01-08T00:00:00Z');
  const jan8Start = getStartOfDay(jan8, TIMEZONE);

  console.log('\nJan 8 test:');
  console.log('  jan8Start:', jan8Start.toISOString());
  console.log('  jan8Start >= exemptStart:', jan8Start >= exemptStart);
  console.log('  jan8Start <= exemptEnd:', jan8Start <= exemptEnd);
  console.log('  In range:', jan8Start >= exemptStart && jan8Start <= exemptEnd);

  await prisma.$disconnect();
}

check().catch(console.error);
