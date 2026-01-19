/**
 * PDF Form Filler Utility
 *
 * Uses pdf-lib to fill official fillable PDFs by field name
 * No manual coordinates needed - just map field names
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { getFormTemplate, getAllFormTemplates, type FormTemplate } from '../config/form-templates/index.js';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');

export interface FillPdfOptions {
  templateId: string;
  values: Record<string, any>;
  flatten?: boolean; // Make form non-editable after filling
}

export interface FillPdfResult {
  pdfBytes: Uint8Array;
  pdfBase64: string;
  template: FormTemplate;
  filledFields: string[];
  skippedFields: string[];
}

/**
 * Fill a PDF form with provided values
 */
export async function fillPdfForm(options: FillPdfOptions): Promise<FillPdfResult> {
  const { templateId, values, flatten = true } = options;

  // Get template definition
  const template = getFormTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Load the blank PDF
  const pdfPath = path.join(TEMPLATES_DIR, template.pdfFileName);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Get the form
  const form = pdfDoc.getForm();

  const filledFields: string[] = [];
  const skippedFields: string[] = [];

  // Fill each field
  for (const fieldDef of template.fields) {
    const value = values[fieldDef.key];

    // Skip if no value provided
    if (value === undefined || value === null || value === '') {
      skippedFields.push(fieldDef.key);
      continue;
    }

    try {
      const pdfFieldName = fieldDef.pdfField;

      switch (fieldDef.type) {
        case 'text':
        case 'textarea':
        case 'date': {
          const textField = form.getTextField(pdfFieldName);
          const textValue = fieldDef.type === 'date' ? formatDate(value) : String(value);
          textField.setText(textValue);
          filledFields.push(fieldDef.key);
          break;
        }

        case 'checkbox': {
          const checkBox = form.getCheckBox(pdfFieldName);
          if (value === true || value === 'true' || value === '1') {
            checkBox.check();
          } else {
            checkBox.uncheck();
          }
          filledFields.push(fieldDef.key);
          break;
        }

        case 'dropdown': {
          const dropdown = form.getDropdown(pdfFieldName);
          const options = dropdown.getOptions();
          // Find matching option (case-insensitive)
          const matchedOption = options.find(
            (opt) => opt.toLowerCase() === String(value).toLowerCase()
          );
          if (matchedOption) {
            dropdown.select(matchedOption);
            filledFields.push(fieldDef.key);
          } else {
            console.warn(`Dropdown option not found for ${fieldDef.key}: ${value}`);
            skippedFields.push(fieldDef.key);
          }
          break;
        }

        case 'radio': {
          const radioGroup = form.getRadioGroup(pdfFieldName);
          const options = radioGroup.getOptions();
          // Find matching option
          const matchedOption = options.find(
            (opt) => opt.toLowerCase() === String(value).toLowerCase()
          );
          if (matchedOption) {
            radioGroup.select(matchedOption);
            filledFields.push(fieldDef.key);
          } else {
            console.warn(`Radio option not found for ${fieldDef.key}: ${value}`);
            skippedFields.push(fieldDef.key);
          }
          break;
        }

        default:
          console.warn(`Unknown field type: ${fieldDef.type}`);
          skippedFields.push(fieldDef.key);
      }
    } catch (error) {
      console.error(`Error filling field ${fieldDef.key}:`, error);
      skippedFields.push(fieldDef.key);
    }
  }

  // Flatten the form (make non-editable)
  if (flatten) {
    form.flatten();
  }

  // Save the filled PDF
  const filledPdfBytes = await pdfDoc.save();
  const pdfBase64 = Buffer.from(filledPdfBytes).toString('base64');

  return {
    pdfBytes: filledPdfBytes,
    pdfBase64,
    template,
    filledFields,
    skippedFields,
  };
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDate(value: any): string {
  if (!value) return '';

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return String(value);
  }
}

/**
 * Get available templates list
 */
export function getAvailableTemplates() {
  return getAllFormTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    pageCount: t.pageCount,
    fieldCount: t.fields.length,
  }));
}

/**
 * Get template fields for form rendering
 */
export function getTemplateFields(templateId: string) {
  const template = getFormTemplate(templateId);
  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    fields: template.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      section: f.section,
      page: f.page,
      options: f.options,
      autoFillFrom: f.autoFillFrom,
    })),
  };
}
