import api from './api';

export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'date' | 'signature';
  page: number;
  required: boolean;
  options?: string[];
  defaultValue?: string;
  maxLength?: number;
  rect?: FieldRect;
}

export interface PageSize {
  width: number;
  height: number;
}

export interface PDFTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  category?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fields: string; // JSON string of DetectedField[]
  pageCount: number;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count?: {
    filledForms: number;
  };
}

export interface FilledPDFForm {
  id: string;
  templateId: string;
  companyId: string;
  incidentId?: string;
  values: string; // JSON string
  generatedUrl?: string;
  filledById: string;
  filledAt: string;
  template?: {
    id: string;
    name: string;
    category?: string;
  };
  filledBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  incident?: {
    id: string;
    caseNumber: string;
    title: string;
  };
}


export interface UpdatePDFTemplateData {
  name?: string;
  description?: string;
  category?: string;
  fields?: DetectedField[];
  isActive?: boolean;
}

export interface FillPDFData {
  values: Record<string, any>;
  incidentId?: string;
  pdfBase64: string;
  saveUrl?: string;
}

export interface TemplateField {
  name: string;
  type: 'text' | 'checkbox' | 'date';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  category?: string;
  pdfBase64: string;
  fileName?: string;
  fields: TemplateField[];
  pageSizes: PageSize[];
}

export interface GeneratePDFData {
  values: Record<string, any>;
  incidentId?: string;
}

export interface IncidentOption {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  reporter: { firstName: string; lastName: string };
  rtwCertificateUrl?: string;
}

export const pdfTemplateService = {
  // Get all templates
  async getAll(category?: string): Promise<PDFTemplate[]> {
    const params = category ? { category } : undefined;
    const response = await api.get<PDFTemplate[]>('/pdf-templates', { params });
    return response.data;
  },

  // Get template by ID
  async getById(id: string): Promise<PDFTemplate> {
    const response = await api.get<PDFTemplate>(`/pdf-templates/${id}`);
    return response.data;
  },


  // Update template
  async update(id: string, data: UpdatePDFTemplateData): Promise<PDFTemplate> {
    const response = await api.put<PDFTemplate>(`/pdf-templates/${id}`, data);
    return response.data;
  },

  // Delete template (soft delete)
  async delete(id: string): Promise<void> {
    await api.delete(`/pdf-templates/${id}`);
  },


  // Fill template and generate PDF
  async fillTemplate(id: string, data: FillPDFData): Promise<{ filledForm: FilledPDFForm; pdfBase64: string }> {
    const response = await api.post<{ filledForm: FilledPDFForm; pdfBase64: string }>(
      `/pdf-templates/${id}/fill`,
      data
    );
    return response.data;
  },

  // Get filled forms list
  async getFilledForms(params?: {
    incidentId?: string;
    templateId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: FilledPDFForm[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get('/pdf-templates/filled/list', { params });
    return response.data;
  },

  // Get filled form by ID
  async getFilledFormById(id: string): Promise<FilledPDFForm> {
    const response = await api.get<FilledPDFForm>(`/pdf-templates/filled/${id}`);
    return response.data;
  },

  // Helper: Convert File to Base64
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:application/pdf;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  },

  // Helper: Download base64 PDF
  downloadPDF(base64: string, fileName: string) {
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

  // ========================================
  // ADMIN: Create template with fields
  // ========================================
  async createTemplateWithFields(data: CreateTemplateData): Promise<PDFTemplate> {
    const response = await api.post<PDFTemplate>('/pdf-templates/admin/create', data);
    return response.data;
  },

  async updateTemplateFields(id: string, fields: TemplateField[], pageSizes: PageSize[]): Promise<PDFTemplate> {
    const response = await api.put<PDFTemplate>(`/pdf-templates/admin/${id}/fields`, { fields, pageSizes });
    return response.data;
  },

  // ========================================
  // WHS: Generate filled PDF and link to incident
  // ========================================
  async generateFilledPDF(id: string, data: GeneratePDFData): Promise<{
    filledForm: FilledPDFForm;
    generatedUrl: string;
    pdfBase64: string;
  }> {
    const response = await api.post(`/pdf-templates/${id}/generate`, data);
    return response.data;
  },

  async getIncidentsForTemplate(id: string): Promise<IncidentOption[]> {
    const response = await api.get<IncidentOption[]>(`/pdf-templates/${id}/incidents`);
    return response.data;
  },
};
