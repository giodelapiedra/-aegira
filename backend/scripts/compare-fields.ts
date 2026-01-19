import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function compare() {
  // Get PDF fields
  const pdfBytes = fs.readFileSync(path.join(__dirname, '../public/templates/certificate-of-capacity-nsw.pdf'));
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  const pdfFields = new Set<string>();
  fields.forEach(f => {
    const type = f.constructor.name;
    if (type !== 'PDFButton' && type !== 'PDFSignature') {
      pdfFields.add(f.getName());
    }
  });
  
  // Get template fields
  const templateContent = fs.readFileSync(path.join(__dirname, '../src/config/form-templates/certificate-of-capacity-nsw.ts'), 'utf-8');
  const templateFields = new Set<string>();
  const regex = /pdfField: '([^']+)'/g;
  let match;
  while ((match = regex.exec(templateContent)) !== null) {
    templateFields.add(match[1]);
  }
  
  console.log('PDF fillable fields:', pdfFields.size);
  console.log('Template fields:', templateFields.size);
  console.log('');
  
  // Find fields in PDF but not in template
  const missingInTemplate: string[] = [];
  pdfFields.forEach(f => {
    if (!templateFields.has(f)) {
      missingInTemplate.push(f);
    }
  });
  
  // Find fields in template but not in PDF
  const extraInTemplate: string[] = [];
  templateFields.forEach(f => {
    if (!pdfFields.has(f)) {
      extraInTemplate.push(f);
    }
  });
  
  if (missingInTemplate.length > 0) {
    console.log('MISSING in template (exist in PDF):');
    missingInTemplate.forEach(f => console.log('  - ' + f));
  } else {
    console.log('All PDF fields are in template');
  }
  
  console.log('');
  
  if (extraInTemplate.length > 0) {
    console.log('EXTRA in template (NOT in PDF):');
    extraInTemplate.forEach(f => console.log('  - ' + f));
  } else {
    console.log('No extra fields in template');
  }
}

compare();
