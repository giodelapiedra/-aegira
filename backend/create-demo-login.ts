import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const DEMO_COMPANY_NAME = 'DEMO_PhilHealth';

// Demo login credentials - YOU CAN CHANGE THESE
const DEMO_EMAIL = 'demo.executive@aegira.test';
const DEMO_PASSWORD = 'Demo123!@#';

async function createDemoLogin() {
  console.log('='.repeat(70));
  console.log('CREATING DEMO LOGIN ACCOUNT');
  console.log('='.repeat(70));

  // Get Supabase credentials from env
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing Supabase credentials in .env');
    console.log('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Get demo company
  const company = await prisma.company.findFirst({
    where: { name: DEMO_COMPANY_NAME },
  });

  if (!company) {
    console.log(`❌ Demo company "${DEMO_COMPANY_NAME}" not found!`);
    console.log('   Run create-demo-data.ts first.');
    return;
  }

  console.log(`\n📍 Company: ${company.name}`);

  // Check if user already exists in Supabase
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === DEMO_EMAIL);

  let supabaseUserId: string;

  if (existingUser) {
    console.log(`\n⚠️ Supabase user already exists: ${DEMO_EMAIL}`);
    supabaseUserId = existingUser.id;
  } else {
    // Create Supabase auth user
    console.log(`\n📧 Creating Supabase auth user: ${DEMO_EMAIL}`);
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true, // Auto-confirm email
    });

    if (createError) {
      console.log(`❌ Failed to create Supabase user: ${createError.message}`);
      return;
    }

    supabaseUserId = newUser.user.id;
    console.log(`   ✅ Supabase user created: ${supabaseUserId}`);
  }

  // Check if user exists in our database
  const existingDbUser = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL },
  });

  if (existingDbUser) {
    console.log(`\n⚠️ Database user already exists: ${DEMO_EMAIL}`);
    console.log(`   Role: ${existingDbUser.role}`);
  } else {
    // Create user in our database
    console.log(`\n👤 Creating database user...`);
    await prisma.user.create({
      data: {
        id: supabaseUserId,
        email: DEMO_EMAIL,
        firstName: 'Demo',
        lastName: 'Executive',
        role: 'EXECUTIVE',
        companyId: company.id,
        isActive: true,
      },
    });
    console.log(`   ✅ Database user created as EXECUTIVE`);
  }

  // Also create Team Lead account for testing
  const TL_EMAIL = 'demo.teamlead@aegira.test';
  const TL_PASSWORD = 'Demo123!@#';

  const existingTL = existingUsers?.users?.find(u => u.email === TL_EMAIL);
  let tlSupabaseId: string;

  if (existingTL) {
    console.log(`\n⚠️ Team Lead Supabase user already exists: ${TL_EMAIL}`);
    tlSupabaseId = existingTL.id;
  } else {
    console.log(`\n📧 Creating Team Lead Supabase user: ${TL_EMAIL}`);
    const { data: newTL, error: tlError } = await supabaseAdmin.auth.admin.createUser({
      email: TL_EMAIL,
      password: TL_PASSWORD,
      email_confirm: true,
    });

    if (tlError) {
      console.log(`❌ Failed to create TL Supabase user: ${tlError.message}`);
    } else {
      tlSupabaseId = newTL.user.id;
      console.log(`   ✅ TL Supabase user created: ${tlSupabaseId}`);

      // Get first team
      const team = await prisma.team.findFirst({
        where: { companyId: company.id },
      });

      if (team) {
        await prisma.user.create({
          data: {
            id: tlSupabaseId,
            email: TL_EMAIL,
            firstName: 'Demo',
            lastName: 'TeamLead',
            role: 'TEAM_LEAD',
            companyId: company.id,
            teamId: team.id,
            isActive: true,
          },
        });
        console.log(`   ✅ Database TL user created for ${team.name}`);
      }
    }
  }

  // Also create Worker account for testing
  const WORKER_EMAIL = 'demo.worker@aegira.test';
  const WORKER_PASSWORD = 'Demo123!@#';

  const existingWorker = existingUsers?.users?.find(u => u.email === WORKER_EMAIL);

  if (existingWorker) {
    console.log(`\n⚠️ Worker Supabase user already exists: ${WORKER_EMAIL}`);
  } else {
    console.log(`\n📧 Creating Worker Supabase user: ${WORKER_EMAIL}`);
    const { data: newWorker, error: workerError } = await supabaseAdmin.auth.admin.createUser({
      email: WORKER_EMAIL,
      password: WORKER_PASSWORD,
      email_confirm: true,
    });

    if (workerError) {
      console.log(`❌ Failed to create Worker Supabase user: ${workerError.message}`);
    } else {
      const workerSupabaseId = newWorker.user.id;
      console.log(`   ✅ Worker Supabase user created: ${workerSupabaseId}`);

      // Get first team
      const team = await prisma.team.findFirst({
        where: { companyId: company.id },
      });

      if (team) {
        await prisma.user.create({
          data: {
            id: workerSupabaseId,
            email: WORKER_EMAIL,
            firstName: 'Demo',
            lastName: 'Worker',
            role: 'WORKER',
            companyId: company.id,
            teamId: team.id,
            teamJoinedAt: new Date(),
            isActive: true,
          },
        });
        console.log(`   ✅ Database Worker user created for ${team.name}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('DEMO LOGIN ACCOUNTS READY');
  console.log('='.repeat(70));

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│ LOGIN CREDENTIALS                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 👔 EXECUTIVE:                                                       │
│    Email:    ${DEMO_EMAIL.padEnd(45)}│
│    Password: ${DEMO_PASSWORD.padEnd(45)}│
│                                                                     │
│ 👤 TEAM LEAD:                                                       │
│    Email:    ${TL_EMAIL.padEnd(45)}│
│    Password: ${TL_PASSWORD.padEnd(45)}│
│                                                                     │
│ 👷 WORKER:                                                          │
│    Email:    ${WORKER_EMAIL.padEnd(45)}│
│    Password: ${WORKER_PASSWORD.padEnd(45)}│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Company: ${DEMO_COMPANY_NAME.padEnd(58)}│
└─────────────────────────────────────────────────────────────────────┘

🚀 You can now login at your frontend URL with these credentials!
`);
}

createDemoLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
