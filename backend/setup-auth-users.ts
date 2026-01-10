import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default password for all test users
const TEST_PASSWORD = 'Test@123456';

async function setupAuthUsers() {
  console.log('🔐 Setting up Supabase Auth users...\n');

  // Get all users from Prisma
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  console.log(`Found ${users.length} users in database\n`);

  const results: { email: string; status: string; role: string }[] = [];

  for (const user of users) {
    try {
      // First, check if user already exists in Supabase Auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      if (existingUser) {
        // User exists, update Prisma user ID to match Supabase ID
        if (existingUser.id !== user.id) {
          // Need to update Prisma user ID
          console.log(`Updating ${user.email} - syncing IDs...`);

          // Delete old user and recreate with correct ID
          await prisma.user.delete({ where: { id: user.id } });
          await prisma.user.create({
            data: {
              id: existingUser.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              companyId: (await prisma.company.findFirst())!.id,
            },
          });
        }
        results.push({ email: user.email, status: 'EXISTS', role: user.role });
        continue;
      }

      // Create user in Supabase Auth
      const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      });

      if (error) {
        console.error(`Failed to create ${user.email}:`, error.message);
        results.push({ email: user.email, status: `FAILED: ${error.message}`, role: user.role });
        continue;
      }

      // Update Prisma user with Supabase user ID
      await prisma.user.update({
        where: { id: user.id },
        data: { id: authData.user.id },
      });

      results.push({ email: user.email, status: 'CREATED', role: user.role });
      console.log(`✅ Created: ${user.email} (${user.role})`);
    } catch (error: any) {
      console.error(`Error processing ${user.email}:`, error.message);
      results.push({ email: user.email, status: `ERROR: ${error.message}`, role: user.role });
    }
  }

  console.log('\n========================================');
  console.log('🎉 AUTH SETUP COMPLETE!');
  console.log('========================================\n');

  console.log('📋 Summary:');
  console.log('-'.repeat(60));

  const created = results.filter(r => r.status === 'CREATED').length;
  const exists = results.filter(r => r.status === 'EXISTS').length;
  const failed = results.filter(r => r.status.startsWith('FAILED') || r.status.startsWith('ERROR')).length;

  console.log(`Created: ${created} | Already Exists: ${exists} | Failed: ${failed}`);

  console.log('\n🔑 LOGIN CREDENTIALS:');
  console.log('-'.repeat(60));
  console.log(`Password for ALL users: ${TEST_PASSWORD}`);
  console.log('\n📧 Test Accounts:');

  const roleOrder = ['EXECUTIVE', 'SUPERVISOR', 'WHS_CONTROL', 'CLINICIAN', 'TEAM_LEAD', 'WORKER'];
  const sortedResults = results.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

  for (const result of sortedResults) {
    const statusIcon = result.status === 'CREATED' || result.status === 'EXISTS' ? '✅' : '❌';
    console.log(`${statusIcon} ${result.role.padEnd(12)} | ${result.email}`);
  }

  console.log('\n');
}

setupAuthUsers()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
