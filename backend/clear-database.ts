import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('Clearing all data from database...\n');

  try {
    // Delete in order to respect foreign key constraints
    // Start with tables that have the most dependencies (leaf tables first)

    console.log('Deleting pulse survey responses...');
    await prisma.pulseSurveyResponse.deleteMany();

    console.log('Deleting pulse surveys...');
    await prisma.pulseSurvey.deleteMany();

    console.log('Deleting recognitions...');
    await prisma.recognition.deleteMany();

    console.log('Deleting one-on-ones...');
    await prisma.oneOnOne.deleteMany();

    console.log('Deleting alerts...');
    await prisma.alert.deleteMany();

    console.log('Deleting wellness snapshots...');
    await prisma.wellnessSnapshot.deleteMany();

    console.log('Deleting AI summaries...');
    await prisma.aISummary.deleteMany();

    console.log('Deleting system logs...');
    await prisma.systemLog.deleteMany();

    console.log('Deleting notifications...');
    await prisma.notification.deleteMany();

    console.log('Deleting filled PDF forms...');
    await prisma.filledPDFForm.deleteMany();

    console.log('Deleting PDF templates...');
    await prisma.pDFTemplate.deleteMany();

    console.log('Deleting incident activities...');
    await prisma.incidentActivity.deleteMany();

    console.log('Deleting daily attendance...');
    await prisma.dailyAttendance.deleteMany();

    console.log('Deleting exceptions...');
    await prisma.exception.deleteMany();

    console.log('Deleting checkins...');
    await prisma.checkin.deleteMany();

    console.log('Deleting incidents...');
    await prisma.incident.deleteMany();

    console.log('Deleting rehabilitation...');
    await prisma.rehabilitation.deleteMany();

    console.log('Deleting schedules...');
    await prisma.schedule.deleteMany();

    console.log('Deleting holidays...');
    await prisma.holiday.deleteMany();

    console.log('Deleting users...');
    await prisma.user.deleteMany();

    console.log('Deleting teams...');
    await prisma.team.deleteMany();

    console.log('Deleting companies...');
    await prisma.company.deleteMany();

    console.log('\n✅ Database cleared successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
