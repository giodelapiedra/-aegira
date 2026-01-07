import { prisma } from '../src/config/prisma.js';
import { supabaseAdmin } from '../src/config/supabase.js';

// Helper to generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Math.random().toString(36).substring(2, 8);
}

async function createAdminAccount() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const emailIndex = args.indexOf('--email');
  const firstNameIndex = args.indexOf('--firstName');
  const lastNameIndex = args.indexOf('--lastName');
  const passwordIndex = args.indexOf('--password');
  const companyIdIndex = args.indexOf('--companyId');
  const companyNameIndex = args.indexOf('--companyName');

  const email = emailIndex !== -1 && args[emailIndex + 1] ? args[emailIndex + 1] : 'admin@example.com';
  const firstName = firstNameIndex !== -1 && args[firstNameIndex + 1] ? args[firstNameIndex + 1] : 'Admin';
  const lastName = lastNameIndex !== -1 && args[lastNameIndex + 1] ? args[lastNameIndex + 1] : 'User';
  const password = passwordIndex !== -1 && args[passwordIndex + 1] ? args[passwordIndex + 1] : 'Admin123!';
  const companyId = companyIdIndex !== -1 && args[companyIdIndex + 1] ? args[companyIdIndex + 1] : null;
  const companyName = companyNameIndex !== -1 && args[companyNameIndex + 1] ? args[companyNameIndex + 1] : 'Default Company';

  try {
    console.log('🚀 Creating admin account...');
    console.log(`Email: ${email}`);
    console.log(`Name: ${firstName} ${lastName}`);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error(`❌ Error: Email ${email} already exists!`);
      process.exit(1);
    }

    // Get or create company
    let finalCompanyId = companyId;
    
    if (companyId) {
      // Check if company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });
      
      if (!company) {
        console.error(`❌ Error: Company with ID ${companyId} not found!`);
        process.exit(1);
      }
      
      console.log(`✅ Using existing company: ${company.name}`);
    } else {
      // Find first existing company or create one
      const existingCompany = await prisma.company.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (existingCompany) {
        finalCompanyId = existingCompany.id;
        console.log(`✅ Using existing company: ${existingCompany.name}`);
      } else {
        // Create new company
        const newCompany = await prisma.company.create({
          data: {
            name: companyName,
            slug: generateSlug(companyName),
          },
        });
        finalCompanyId = newCompany.id;
        console.log(`✅ Created new company: ${newCompany.name}`);
      }
    }

    // Create user in Supabase Auth
    console.log('📝 Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`❌ Error creating user in Supabase: ${authError.message}`);
      process.exit(1);
    }

    console.log('✅ User created in Supabase Auth');

    // Create user in Prisma with ADMIN role
    console.log('📝 Creating user in database...');
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email,
        firstName,
        lastName,
        role: 'ADMIN',
        companyId: finalCompanyId!,
      },
    });

    console.log('✅ Admin account created successfully!');
    console.log('\n📋 Account Details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Company ID: ${user.companyId}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log('\n🔐 You can now login with:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createAdminAccount();

