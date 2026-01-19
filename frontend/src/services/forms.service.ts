/**
 * Forms Service
 *
 * API calls for hardcoded form templates
 */

import api from './api';

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  pageCount: number;
  fieldCount: number;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'date' | 'textarea';
  required?: boolean;
  section: number;
  page: number;
  options?: string[];
  autoFillFrom?: string;
}

export interface FormTemplateDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: FormField[];
}

export interface IncidentForForm {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  incidentDate: string;
  description?: string;
  reporter: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
  };
  company: {
    name: string;
    address?: string;
    phone?: string;
  };
}

export interface GenerateFormResponse {
  success: boolean;
  pdfBase64: string;
  templateName: string;
  filledFields: string[];
  skippedFields: string[];
  attachedUrl?: string;
}

export const formsService = {
  /**
   * Get all available form templates
   */
  async getTemplates(): Promise<FormTemplate[]> {
    const response = await api.get<FormTemplate[]>('/forms/templates');
    return response.data;
  },

  /**
   * Get template details with all fields
   */
  async getTemplateDetails(id: string): Promise<FormTemplateDetails> {
    const response = await api.get<FormTemplateDetails>(`/forms/templates/${id}`);
    return response.data;
  },

  /**
   * Get incidents for auto-fill
   */
  async getIncidentsForForm(templateId: string): Promise<IncidentForForm[]> {
    const response = await api.get<IncidentForForm[]>(`/forms/templates/${templateId}/incidents`);
    return response.data;
  },

  /**
   * Generate a filled PDF
   */
  async generateForm(
    templateId: string,
    values: Record<string, any>,
    options?: {
      incidentId?: string;
      flatten?: boolean;
    }
  ): Promise<GenerateFormResponse> {
    const response = await api.post<GenerateFormResponse>('/forms/generate', {
      templateId,
      values,
      incidentId: options?.incidentId,
      flatten: options?.flatten ?? true,
    });
    return response.data;
  },

  /**
   * Download PDF from base64
   */
  downloadPdf(base64: string, fileName: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  /**
   * Open PDF in new tab for preview/print
   */
  openPdfInNewTab(base64: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
};
