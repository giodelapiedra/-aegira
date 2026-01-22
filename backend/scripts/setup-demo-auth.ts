/**
 * Setup Demo Auth Users
 *
 * Creates Supabase Auth accounts for demo users and links them to existing database records.
 *
 * Usage: npx tsx scripts/setup-demo-auth.ts
 */

import { prisma } from '../src/config/prisma.js';
import { supabaseAdmin } from '../src/config/supabase.js';

const DEMO_PASSWORD = 'demo123';

async function setupDemoAuth() {
  console.log('🚀 Setting up demo auth users...\n');

  try {
    // Get all users from database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { role: 'asc' },
    });

    console.log(`Found ${users.length} users in database\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      console.log(`Processing: ${user.email} (${user.role})`);

      // Check if user already exists in Supabase Auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = existingUsers?.users?.find(u => u.email === user.email);

      if (existingAuthUser) {
        // User exists in Supabase, check if IDs match
        if (existingAuthUser.id === user.id) {
          console.log(`   ⏭️  Already set up correctly`);
          skipped++;
        } else {
          // Different ID - update database to match Supabase ID
          console.log(`   🔄 Updating database ID to match Supabase...`);
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { id: existingAuthUser.id },
            });
            console.log(`   ✅ Updated ID`);
            created++;
          } catch (e: any) {
            console.log(`   ❌ Failed to update: ${e.message}`);
            errors++;
          }
        }
        continue;
      }

      // Create user in Supabase Auth with same ID as database
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });

      if (authError) {
        console.log(`   ❌ Error: ${authError.message}`);
        errors++;
        continue;
      }

      // Update database user ID to match Supabase Auth ID
      if (authData.user.id !== user.id) {
        try {
          // Need to update the user ID in database to match Supabase
          await prisma.user.update({
            where: { id: user.id },
            data: { id: authData.user.id },
          });
          console.log(`   ✅ Created and linked (ID updated)`);
        } catch (e: any) {
          console.log(`   ⚠️  Created in Auth but failed to update DB ID: ${e.message}`);
        }
      } else {
        console.log(`   ✅ Created`);
      }
      created++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SETUP COMPLETE');
    console.log('='.repeat(50));
    console.log(`✅ Created/Updated: ${created}`);
    console.log(`⏭️  Skipped (already exists): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('\n🔐 All demo users can login with password: ' + DEMO_PASSWORD);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDemoAuth();
