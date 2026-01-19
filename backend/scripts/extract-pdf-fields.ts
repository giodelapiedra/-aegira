/**
 * Script to extract form field names from a fillable PDF
 * Run: npx tsx scripts/extract-pdf-fields.ts
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function extractPdfFields(pdfPath: string) {
  console.log(`\n📄 Loading PDF: ${pdfPath}\n`);

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  console.log(`📊 PDF Info:`);
  console.log(`   - Pages: ${pdfDoc.getPageCount()}`);
  console.log(`   - Title: ${pdfDoc.getTitle() || 'N/A'}`);

  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`\n📝 Form Fields Found: ${fields.length}\n`);

    if (fields.length === 0) {
      console.log('⚠️  No form fields detected. This PDF might not be a fillable form.');
      console.log('   You may need to use coordinate-based positioning instead.');
      return;
    }

    console.log('=' .repeat(80));
    console.log('Field Name'.padEnd(40) + 'Type'.padEnd(20) + 'Value');
    console.log('=' .repeat(80));

    const fieldData: any[] = [];

    for (const field of fields) {
      const name = field.getName();
      const type = field.constructor.name;
      let value = '';

      try {
        if (type === 'PDFTextField') {
          value = (field as any).getText() || '';
        } else if (type === 'PDFCheckBox') {
          value = (field as any).isChecked() ? '☑' : '☐';
        } else if (type === 'PDFDropdown') {
          value = (field as any).getSelected()?.join(', ') || '';
        } else if (type === 'PDFRadioGroup') {
          value = (field as any).getSelected() || '';
        }
      } catch (e) {
        value = '(error reading)';
      }

      console.log(name.padEnd(40) + type.padEnd(20) + value);

      fieldData.push({
        name,
        type: type.replace('PDF', '').replace('Field', ''),
        value
      });
    }

    console.log('=' .repeat(80));

    // Output as JSON for easy copy-paste
    console.log('\n📋 JSON Format (copy this for template definition):\n');
    console.log(JSON.stringify(fieldData, null, 2));

    // Save to file
    const outputPath = pdfPath.replace('.pdf', '-fields.json');
    fs.writeFileSync(outputPath, JSON.stringify(fieldData, null, 2));
    console.log(`\n✅ Field data saved to: ${outputPath}`);

  } catch (error) {
    console.log('\n⚠️  Could not read form fields:', error);
    console.log('   This PDF might not have AcroForm fields.');
    console.log('   Alternative: Use coordinate-based positioning.');
  }
}

// Run
const pdfPath = path.join(__dirname, '../public/templates/certificate-of-capacity-nsw.pdf');
extractPdfFields(pdfPath);
