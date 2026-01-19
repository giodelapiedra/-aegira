/**
 * Script to fill PDF fields with their own names for mapping
 * Run: npx tsx scripts/test-pdf-field-mapping.ts
 * Then open the output PDF to see which field is which
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function fillFieldsWithNames(pdfPath: string) {
  console.log(`\n📄 Loading PDF: ${pdfPath}\n`);

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const form = pdfDoc.getForm();
  const fields = form.getFields();

  console.log(`📝 Filling ${fields.length} fields with their names...\n`);

  for (const field of fields) {
    const name = field.getName();
    const type = field.constructor.name;

    try {
      if (type === 'PDFTextField') {
        // Fill text field with its own name (shortened if too long)
        const shortName = name.length > 20 ? name.substring(0, 20) : name;
        (field as any).setText(shortName);
        console.log(`✅ Text: ${name}`);
      } else if (type === 'PDFCheckBox') {
        // Check the checkbox
        (field as any).check();
        console.log(`✅ Checkbox: ${name}`);
      } else if (type === 'PDFDropdown') {
        // Try to select first option
        const options = (field as any).getOptions();
        if (options && options.length > 0) {
          (field as any).select(options[0]);
        }
        console.log(`✅ Dropdown: ${name}`);
      } else if (type === 'PDFRadioGroup') {
        // Try to select first option
        const options = (field as any).getOptions();
        if (options && options.length > 0) {
          (field as any).select(options[0]);
        }
        console.log(`✅ Radio: ${name}`);
      } else {
        console.log(`⏭️  Skipped: ${name} (${type})`);
      }
    } catch (e) {
      console.log(`❌ Error: ${name} - ${e}`);
    }
  }

  // Save the filled PDF
  const outputPath = pdfPath.replace('.pdf', '-field-mapping.pdf');
  const filledBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, filledBytes);

  console.log(`\n✅ Field mapping PDF saved to: ${outputPath}`);
  console.log(`\n📖 Open this PDF to see which field name corresponds to which form field!`);
}

// Run
const pdfPath = path.join(__dirname, '../public/templates/certificate-of-capacity-nsw.pdf');
fillFieldsWithNames(pdfPath);
