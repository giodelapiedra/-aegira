/**
 * Form Templates Registry
 *
 * All available hardcoded form templates for PDF generation
 */

import { certificateOfCapacityNSW, type FormTemplate } from './certificate-of-capacity-nsw.js';

// Export all templates
export const formTemplates: Record<string, FormTemplate> = {
  'certificate-of-capacity-nsw': certificateOfCapacityNSW,
};

// Export types
export type { FormTemplate, FormField } from './certificate-of-capacity-nsw.js';

// Helper to get template by ID
export function getFormTemplate(id: string): FormTemplate | undefined {
  return formTemplates[id];
}

// Get all available templates
export function getAllFormTemplates(): FormTemplate[] {
  return Object.values(formTemplates);
}
