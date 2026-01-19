/**
 * Test script to fill ALL fields in the Certificate of Capacity form
 * Run: npx tsx scripts/test-fill-all-fields.ts
 *
 * CORRECTED based on field-mapping.pdf visual verification
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function testFillAllFields() {
  console.log('\n📄 Loading Certificate of Capacity PDF...\n');

  const pdfPath = path.join(__dirname, '../public/templates/certificate-of-capacity-nsw.pdf');
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const form = pdfDoc.getForm();
  const fields = form.getFields();

  console.log(`Total fields: ${fields.length}`);
  console.log('='.repeat(60));

  let filled = 0;
  let skipped = 0;
  const errors: string[] = [];

  // CORRECTED test data based on field-mapping.pdf visual verification
  const testData: Record<string, any> = {
    // ============================================
    // PAGE 1 - SECTION 1: Injured Person Details
    // ============================================
    'Check Box 232': false, // CTP - unchecked
    'Check Box 233': true,  // Workers Comp - checked
    'Check Box 1': true,    // Initial Certificate - checked
    'FN1': 'Juan',          // First Name
    'LN1': 'Dela Cruz',     // Last Name
    'Text Field 1038': '15/03/1985', // DOB
    'Text Field 1037': '0412 345 678', // Phone
    'Text Field 3012': '123 Main Street, Suburbia', // Address
    'Text Field 3026': 'Sydney', // Suburb
    'Combo Box 41': 'NSW', // State dropdown
    'Text Field 3021': '2000', // Postcode
    'CN1': 'WC-2024-123456', // Claim Number
    'Text Field 1039': '1234 5678 9012', // Medicare
    'Text Field 3024': 'Warehouse Operator', // Occupation
    'Text Field 3027': 'ABC Logistics Pty Ltd - (02) 9876 5432', // Employer
    'Text Field 327': '18/01/2026', // Consent signature date

    // ============================================
    // PAGE 1 - SECTION 2: Medical Certification
    // ============================================
    'Text Field 3025': 'Lower back strain - L4/L5 disc herniation with radiculopathy', // Diagnosis
    'Text Field 1049': '10/01/2026', // Injury date
    'Text Field 1048': '11/01/2026', // First seen date
    'Radio Button 1': 'Yes', // Injury consistent
    'Text Field 1055': 'Injury occurred while lifting heavy boxes at work warehouse. Patient reports sudden onset of pain.', // How related
    'Text Field 1056': 'Previous episode of lower back pain in 2020, resolved with physiotherapy.', // Pre-existing

    // ============================================
    // PAGE 2 - SECTION 3: Capacity for Work
    // ============================================

    // Work capacity checkboxes
    'Check Box 222': false, // Totally unfit - unchecked
    'Check Box 223': true,  // Fit for selected duties - checked
    'Check Box 224': false, // Fit for pre-injury - unchecked

    // CORRECTED: Capacity date fields
    'Text Field 1063': '01/02/2026', // Fit for pre-injury duties FROM date
    'Text Field 1065': '5', // Days per week
    'Text Field 1051': '20/01/2026', // Has capacity FROM date
    'Text Field 1052': '20/02/2026', // Has capacity TO date
    'Text Field 1062': '10/01/2026', // No capacity FROM date
    'Text Field 1058': '19/01/2026', // No capacity TO date

    // Physical capacity table (unchanged)
    'aaa 2': '4', // Sitting hours
    'bbb 2': '2', // Standing hours
    'ccc 2': '1', // Walking hours
    'ddd 2': '0', // Driving hours
    'eee 2': '5kg', // Lifting
    'fff 2': 'No repetitive bending', // Other restrictions

    // CORRECTED: Treatment/referral (these are text fields, not dates)
    'Text Field 1054': 'Physiotherapy 2x weekly, NSAIDs as needed, gradual return to work program', // Treatment
    'Text Field 1053': 'Referred to physiotherapist - Smith Physio Clinic', // Referrals
    'Text Field 3042': 'Also referred to occupational therapist for workplace assessment', // Additional referrals

    // Review dates
    'Text Field 1059': '03/02/2026', // Next appointment date
    'Text Field 1064': '17/02/2026', // Next review date

    // Estimated return time
    'Text Field 3037': '6-8 weeks', // Estimated time to return

    // Comments
    'Text Field 3043': 'Workplace rehabilitation recommended. Patient motivated for return to work.', // Workplace rehab comments
    'Text Field 3044': 'Good prognosis with modified duties and gradual progression.', // Additional comments

    // Position description
    'Radio Button 7': 'Yes', // Position description required

    // ============================================
    // PAGE 3 - Practitioner Details (CORRECTED)
    // ============================================

    // Practitioner name fields
    'FN2': 'Dr. Maria',     // Practitioner First Name
    'LN2': 'Santos',        // Practitioner Last Name
    'CN2': '2345678A',      // Provider number (CN2)

    // CORRECTED: Practice details
    'Text Field 3045': 'Dr. Maria Santos', // Practitioner Full Name (printed)
    'Text Field 3048': '456 Medical Centre, Health Street', // Practice Address
    'Text Field 3047': 'Parramatta', // Practice Suburb
    'Combo Box 43': 'NSW', // Practice state
    'Text Field 3046': '2150', // Practice postcode
    'Text Field 10-1922295912': '(02) 9123 4567', // Practice Phone

    // CORRECTED: Additional fields on Page 3
    'Text Field 1060': '1234567B', // Additional Provider Number
    'Check Box 220': true, // I agree to be nominated treating doctor
    'Text Field 321': '18/01/2026', // Practitioner signature date

    // ============================================
    // PAGE 3 - Employment Declaration Section
    // ============================================
    'Text Field 1046': 'John', // Declaration First Name
    'Text Field 1045': 'Smith', // Declaration Last Name
    'Text Field 1061': 'HR Manager, ABC Logistics Pty Ltd, 5 years with company', // Employment details
    'Radio Button 8': 'I have', // Position description viewed
    'Text Field 329': '18/01/2026', // Declaration date
  };

  // Fill each field
  for (const field of fields) {
    const name = field.getName();
    const type = field.constructor.name;
    const value = testData[name];

    // Skip buttons and signatures
    if (type === 'PDFButton' || type === 'PDFSignature') {
      console.log(`⏭️  SKIP: ${name} (${type})`);
      skipped++;
      continue;
    }

    if (value === undefined) {
      console.log(`⚠️  NO DATA: ${name} (${type})`);
      skipped++;
      continue;
    }

    try {
      if (type === 'PDFTextField') {
        (field as any).setText(String(value));
        console.log(`✅ TEXT: ${name} = "${value}"`);
        filled++;
      } else if (type === 'PDFCheckBox') {
        if (value === true) {
          (field as any).check();
          console.log(`✅ CHECK: ${name} = ☑`);
        } else {
          (field as any).uncheck();
          console.log(`✅ CHECK: ${name} = ☐`);
        }
        filled++;
      } else if (type === 'PDFDropdown') {
        const dropdown = field as any;
        const options = dropdown.getOptions();
        if (options.includes(value)) {
          dropdown.select(value);
          console.log(`✅ DROP: ${name} = "${value}"`);
          filled++;
        } else {
          console.log(`❌ DROP: ${name} - option "${value}" not found in [${options.join(', ')}]`);
          errors.push(`${name}: option not found`);
        }
      } else if (type === 'PDFRadioGroup') {
        const radio = field as any;
        const options = radio.getOptions();
        if (options.includes(value)) {
          radio.select(value);
          console.log(`✅ RADIO: ${name} = "${value}"`);
          filled++;
        } else {
          console.log(`❌ RADIO: ${name} - option "${value}" not found in [${options.join(', ')}]`);
          errors.push(`${name}: option not found`);
        }
      } else {
        console.log(`⚠️  UNKNOWN: ${name} (${type})`);
        skipped++;
      }
    } catch (error: any) {
      console.log(`❌ ERROR: ${name} - ${error.message}`);
      errors.push(`${name}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Filled: ${filled}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Save the filled PDF
  const outputPath = path.join(__dirname, '../public/templates/certificate-of-capacity-nsw-TEST-FILLED.pdf');

  // Don't flatten - keep editable for verification
  const filledBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, filledBytes);

  console.log(`\n📁 Test PDF saved to: ${outputPath}`);
  console.log('\n🔍 Open this PDF to verify all fields are filled correctly!');
  console.log('\nVerification checklist:');
  console.log('  Page 1: Check injured person details and medical certification');
  console.log('  Page 2: Verify capacity dates, physical restrictions, treatment info');
  console.log('  Page 3: Confirm practitioner details and employment declaration');
}

testFillAllFields().catch(console.error);
