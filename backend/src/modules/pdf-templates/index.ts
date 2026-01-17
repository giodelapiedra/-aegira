import { Hono } from 'hono';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFName, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '../../config/prisma.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireWHSControl, requireSystemAdmin } from '../../middlewares/role.middleware.js';
import { createSystemLog } from '../system-logs/index.js';
import { uploadToR2 } from '../../utils/upload.js';

const pdfTemplatesRoutes = new Hono();

// Apply auth to all routes
pdfTemplatesRoutes.use('*', authMiddleware);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectedField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'date' | 'signature';
  page: number;
  required: boolean;
  options?: string[]; // For dropdown/radio
  defaultValue?: string;
  maxLength?: number;
  rect?: FieldRect; // Position on page
}

// Detect form fields from PDF buffer with positions
async function detectPDFFields(pdfBuffer: ArrayBuffer): Promise<{
  fields: DetectedField[];
  pageCount: number;
  pageSizes: { width: number; height: number }[];
}> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const form = pdfDoc.getForm();
  const fields: DetectedField[] = [];
  const pageCount = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();

  // Get page sizes
  const pageSizes = pages.map(page => ({
    width: page.getWidth(),
    height: page.getHeight(),
  }));

  const formFields = form.getFields();

  for (const field of formFields) {
    const name = field.getName();
    let type: DetectedField['type'] = 'text';
    let options: string[] | undefined;
    let defaultValue: string | undefined;
    let maxLength: number | undefined;

    // Determine field type first
    if (field instanceof PDFTextField) {
      type = 'text';
      defaultValue = field.getText() || undefined;
      maxLength = field.getMaxLength() || undefined;

      // Check if field name suggests it's a date field
      if (name.toLowerCase().includes('date') ||
          name.toLowerCase().includes('dob') ||
          name.toLowerCase().includes('birth')) {
        type = 'date';
      }

      // Check if field name suggests it's a signature
      if (name.toLowerCase().includes('sign') ||
          name.toLowerCase().includes('signature')) {
        type = 'signature';
      }
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox';
      defaultValue = field.isChecked() ? 'true' : 'false';
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown';
      options = field.getOptions();
      const selected = field.getSelected();
      defaultValue = selected.length > 0 ? selected[0] : undefined;
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio';
      options = field.getOptions();
      defaultValue = field.getSelected() || undefined;
    }

    // Get ALL widget annotations for this field (checkboxes/radios may have multiple)
    const widgets = field.acroField.getWidgets();

    if (widgets.length === 0) {
      // Field without widgets - add with no position
      fields.push({
        name,
        type,
        page: 1,
        required: false,
        options,
        defaultValue,
        maxLength,
        rect: undefined,
      });
    } else if (type === 'radio' && widgets.length > 1) {
      // For radio groups with multiple options, add each widget separately
      for (let widgetIdx = 0; widgetIdx < widgets.length; widgetIdx++) {
        const widget = widgets[widgetIdx];
        let pageIndex = 0;
        let rect: FieldRect | undefined;

        try {
          const rectArray = widget.getRectangle();
          const widgetPage = widget.P();
          if (widgetPage) {
            for (let i = 0; i < pages.length; i++) {
              if (pages[i].ref === widgetPage) {
                pageIndex = i;
                break;
              }
            }
          }
          rect = {
            x: rectArray.x,
            y: rectArray.y,
            width: rectArray.width,
            height: rectArray.height,
          };
        } catch (e) {
          console.warn(`Could not get rect for widget ${widgetIdx} of ${name}`);
        }

        fields.push({
          name: `${name}`, // Same name for all radio options
          type: 'checkbox', // Render as checkbox, will behave as radio
          page: pageIndex + 1,
          required: false,
          options: options ? [options[widgetIdx] || `Option ${widgetIdx + 1}`] : undefined,
          defaultValue: options && options[widgetIdx] === defaultValue ? 'true' : 'false',
          maxLength,
          rect,
        });
      }
    } else {
      // Single widget or checkbox - add first widget
      const widget = widgets[0];
      let pageIndex = 0;
      let rect: FieldRect | undefined;

      try {
        const rectArray = widget.getRectangle();
        const widgetPage = widget.P();
        if (widgetPage) {
          for (let i = 0; i < pages.length; i++) {
            if (pages[i].ref === widgetPage) {
              pageIndex = i;
              break;
            }
          }
        }
        rect = {
          x: rectArray.x,
          y: rectArray.y,
          width: rectArray.width,
          height: rectArray.height,
        };
      } catch (e) {
        console.warn(`Could not get rect for ${name}`);
      }

      fields.push({
        name,
        type,
        page: pageIndex + 1,
        required: false,
        options,
        defaultValue,
        maxLength,
        rect,
      });
    }
  }

  return { fields, pageCount, pageSizes };
}

// Fill PDF with values
async function fillPDF(pdfBuffer: ArrayBuffer, values: Record<string, any>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const form = pdfDoc.getForm();

  for (const [fieldName, value] of Object.entries(values)) {
    try {
      const field = form.getField(fieldName);

      if (field instanceof PDFTextField) {
        field.setText(String(value || ''));
      } else if (field instanceof PDFCheckBox) {
        if (value === true || value === 'true' || value === '1') {
          field.check();
        } else {
          field.uncheck();
        }
      } else if (field instanceof PDFDropdown) {
        if (value) {
          field.select(String(value));
        }
      } else if (field instanceof PDFRadioGroup) {
        if (value) {
          field.select(String(value));
        }
      }
    } catch (err) {
      console.warn(`Failed to set field ${fieldName}:`, err);
    }
  }

  // Flatten form to make it non-editable (optional)
  // form.flatten();

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// ===========================================
// PDF TEMPLATE OVERLAY HELPERS
// ===========================================

interface TemplateField {
  name: string;
  type: 'text' | 'checkbox' | 'date';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

interface PageSize {
  width: number;
  height: number;
}

// Generate filled PDF by overlaying text on template PDF
async function generateFilledPDFFromTemplate(
  templatePdfBuffer: ArrayBuffer,
  fields: TemplateField[],
  values: Record<string, any>,
  pageSizes: PageSize[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templatePdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const pageNumber = pageIndex + 1;
    const pageSize = pageSizes[pageIndex] || { width: page.getWidth(), height: page.getHeight() };

    // Get fields for this page
    const pageFields = fields.filter(f => f.page === pageNumber);

    for (const field of pageFields) {
      const value = values[field.name];
      if (value === undefined || value === null || value === '') continue;

      // Convert from top-left origin (coordinate picker) to bottom-left origin (PDF)
      const pdfY = pageSize.height - field.y - field.height;
      const fontSize = field.fontSize || Math.min(field.height * 0.7, 12);

      if (field.type === 'checkbox') {
        // Draw checkmark (✓) if checked
        if (value === true || value === 'true' || value === '1' || value === 'on') {
          const checkSize = Math.min(field.width, field.height) * 0.6;
          const centerX = field.x + field.width / 2;
          const centerY = pdfY + field.height / 2;

          // Draw checkmark as two lines forming a ✓ shape
          // Short line going down-right
          page.drawLine({
            start: { x: centerX - checkSize * 0.4, y: centerY },
            end: { x: centerX - checkSize * 0.1, y: centerY - checkSize * 0.3 },
            thickness: 2,
            color: rgb(0, 0, 0),
          });
          // Long line going up-right
          page.drawLine({
            start: { x: centerX - checkSize * 0.1, y: centerY - checkSize * 0.3 },
            end: { x: centerX + checkSize * 0.4, y: centerY + checkSize * 0.4 },
            thickness: 2,
            color: rgb(0, 0, 0),
          });
        }
      } else {
        // Draw text
        page.drawText(String(value), {
          x: field.x + 2,
          y: pdfY + (field.height - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  return await pdfDoc.save();
}

// ===========================================
// API ROUTES - IMPORTANT: Specific routes MUST come before dynamic :id routes!
// ===========================================

// GET /pdf-templates - List all templates (GLOBAL - no company filtering)
pdfTemplatesRoutes.get('/', async (c) => {
  try {
    const category = c.req.query('category');

    // Templates are global - all active templates visible to all users
    const where: any = { isActive: true };
    
    if (category) where.category = category;

    const templates = await prisma.pDFTemplate.findMany({
      where,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { filledForms: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[PDF Templates] Found ${templates.length} global templates${category ? ` in category ${category}` : ''}`);
    
    return c.json(templates);
  } catch (error: any) {
    console.error('[PDF Templates] Error fetching templates:', error);
    console.error('[PDF Templates] Error stack:', error.stack);
    return c.json(
      { error: 'Failed to fetch templates', details: error.message },
      500
    );
  }
});

// ===========================================
// ADMIN ROUTES - Must be before /:id routes!
// ===========================================

// POST /pdf-templates/admin/create - Create template with PDF and field coordinates (ADMIN only)
pdfTemplatesRoutes.post('/admin/create', requireSystemAdmin(), async (c) => {
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const { name, description, category, pdfBase64, fileName, fields, pageSizes } = body;

  if (!name || !pdfBase64) {
    return c.json({ error: 'Name and pdfBase64 are required' }, 400);
  }

  // Check for duplicate name globally (templates are global, not company-specific)
  const existing = await prisma.pDFTemplate.findFirst({
    where: { name, isActive: true },
  });

  if (existing) {
    return c.json({ error: 'A template with this name already exists' }, 400);
  }

  try {
    // Upload PDF to R2
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    console.log(`Uploading PDF to R2: ${pdfBuffer.length} bytes`);

    let fileUrl: string;
    try {
      const result = await uploadToR2(
        pdfBuffer,
        fileName || `${name}.pdf`,
        'application/pdf',
        'templates'
      );
      fileUrl = result.url;
      console.log(`PDF uploaded successfully: ${fileUrl}`);
    } catch (uploadErr: any) {
      console.error('R2 upload failed:', uploadErr);
      return c.json({ error: `R2 upload failed: ${uploadErr.message}` }, 500);
    }

    // Get page count from PDF
    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      pageCount = pdfDoc.getPageCount();
    } catch (pdfErr: any) {
      console.error('PDF parsing failed:', pdfErr);
      // Continue with default page count
    }

    // Create template
    const template = await prisma.pDFTemplate.create({
      data: {
        companyId,
        name,
        description,
        category: category || 'General',
        fileUrl,
        fileName: fileName || `${name}.pdf`,
        fileSize: pdfBuffer.length,
        fields: JSON.stringify({ fields: fields || [], pageSizes: pageSizes || [] }),
        pageCount,
        isActive: true, // Explicitly set to true
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    console.log(`[PDF Templates] Created template "${name}" (ID: ${template.id}) for company ${companyId}, isActive: ${template.isActive}`);

    await createSystemLog({
      companyId,
      userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'pdf_template',
      entityId: template.id,
      description: `PDF template "${name}" created by admin with ${(fields || []).length} fields`,
      metadata: { templateName: name, fieldCount: (fields || []).length },
    });

    return c.json(template, 201);
  } catch (err: any) {
    console.error('Failed to create template:', err);
    return c.json({ error: `Failed to create template: ${err.message}` }, 500);
  }
});

// PUT /pdf-templates/admin/:id/fields - Update template fields (ADMIN only)
pdfTemplatesRoutes.put('/admin/:id/fields', requireSystemAdmin(), async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const existing = await prisma.pDFTemplate.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const { fields, pageSizes } = body;

  const template = await prisma.pDFTemplate.update({
    where: { id },
    data: {
      fields: JSON.stringify({ fields: fields || [], pageSizes: pageSizes || [] }),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await createSystemLog({
    companyId,
    userId,
    action: 'SETTINGS_UPDATED',
    entityType: 'pdf_template',
    entityId: template.id,
    description: `PDF template "${template.name}" fields updated`,
    metadata: { templateName: template.name, fieldCount: (fields || []).length },
  });

  return c.json(template);
});

// ===========================================
// FILLED FORMS ROUTES - Must be before /:id routes!
// ===========================================

// GET /pdf-templates/filled/list - List filled forms
pdfTemplatesRoutes.get('/filled/list', async (c) => {
  const companyId = c.get('companyId');
  const incidentId = c.req.query('incidentId');
  const templateId = c.req.query('templateId');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);

  const where: any = { companyId };
  if (incidentId) where.incidentId = incidentId;
  if (templateId) where.templateId = templateId;

  const [forms, total] = await Promise.all([
    prisma.filledPDFForm.findMany({
      where,
      include: {
        template: { select: { id: true, name: true, category: true } },
        filledBy: { select: { id: true, firstName: true, lastName: true } },
        incident: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { filledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.filledPDFForm.count({ where }),
  ]);

  return c.json({
    data: forms,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /pdf-templates/filled/:id - Get filled form by ID
pdfTemplatesRoutes.get('/filled/:id', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');

  const form = await prisma.filledPDFForm.findFirst({
    where: { id, companyId },
    include: {
      template: true,
      filledBy: { select: { id: true, firstName: true, lastName: true } },
      incident: { select: { id: true, caseNumber: true, title: true, reporter: { select: { firstName: true, lastName: true } } } },
    },
  });

  if (!form) {
    return c.json({ error: 'Filled form not found' }, 404);
  }

  return c.json(form);
});

// ===========================================
// DYNAMIC :id ROUTES - Must come after specific routes!
// ===========================================

// GET /pdf-templates/:id - Get template by ID (GLOBAL - no company filtering)
pdfTemplatesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const template = await prisma.pDFTemplate.findFirst({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      filledForms: {
        take: 10,
        orderBy: { filledAt: 'desc' },
        include: {
          filledBy: { select: { id: true, firstName: true, lastName: true } },
          incident: { select: { id: true, caseNumber: true, title: true } },
        },
      },
    },
  });

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  return c.json(template);
});

// GET /pdf-templates/:id/file - Proxy PDF file from R2 or custom domain (GLOBAL - no company filtering)
pdfTemplatesRoutes.get('/:id/file', async (c) => {
  const id = c.req.param('id');
  console.log(`[PDF Proxy] Request for template: ${id}`);

  const template = await prisma.pDFTemplate.findFirst({
    where: { id },
    select: { fileUrl: true, fileName: true },
  });

  if (!template) {
    console.error(`[PDF Proxy] Template not found: ${id}`);
    return c.json({ error: 'Template not found' }, 404);
  }

  console.log(`[PDF Proxy] Fetching from: ${template.fileUrl}`);

  try {
    // Try to fetch PDF from custom domain or R2 URL
    const pdfResponse = await fetch(template.fileUrl, {
      headers: {
        'User-Agent': 'Aegira-Backend/1.0',
      },
    });

    console.log(`[PDF Proxy] Response status: ${pdfResponse.status}`);

    if (!pdfResponse.ok) {
      console.error(`[PDF Proxy] Failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
      return c.json({ error: `Failed to fetch PDF: ${pdfResponse.status}` }, 500);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log(`[PDF Proxy] Success, size: ${pdfBuffer.byteLength} bytes`);
    
    // Return PDF with proper headers
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${template.fileName || 'template.pdf'}"`,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*', // Allow CORS for custom domain
      },
    });
  } catch (error: any) {
    console.error('Error proxying PDF:', error);
    return c.json({ error: 'Failed to load PDF file', details: error.message }, 500);
  }
});

// NOTE: Template creation is now only via /admin/create (admin only)
// WHS users can only view and fill templates created by admin

// PUT /pdf-templates/:id - Update template (admin only, GLOBAL)
pdfTemplatesRoutes.put('/:id', requireSystemAdmin(), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const body = await c.req.json();

  const existing = await prisma.pDFTemplate.findFirst({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const { name, description, category, fields, isActive } = body;

  const template = await prisma.pDFTemplate.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      description: description ?? existing.description,
      category: category ?? existing.category,
      fields: fields ? JSON.stringify(fields) : (existing.fields ?? undefined),
      isActive: isActive ?? existing.isActive,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return c.json(template);
});

// DELETE /pdf-templates/:id - Delete template (admin only, GLOBAL)
pdfTemplatesRoutes.delete('/:id', requireSystemAdmin(), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');

  const existing = await prisma.pDFTemplate.findFirst({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: 'Template not found' }, 404);
  }

  // Soft delete by setting isActive to false
  await prisma.pDFTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  await createSystemLog({
    companyId: existing.companyId, // Use template's companyId for logging
    userId,
    action: 'SETTINGS_UPDATED',
    entityType: 'pdf_template',
    entityId: id,
    description: `PDF template "${existing.name}" deleted`,
    metadata: { templateName: existing.name },
  });

  return c.json({ success: true });
});

// NOTE: detect-fields removed - admin uses Template Builder with coordinate picker instead

// POST /pdf-templates/:id/fill - Fill template and generate PDF (GLOBAL template)
pdfTemplatesRoutes.post('/:id/fill', async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const template = await prisma.pDFTemplate.findFirst({
    where: { id, isActive: true },
  });

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const { values, incidentId, pdfBase64, saveUrl } = body;

  if (!values || Object.keys(values).length === 0) {
    return c.json({ error: 'Values are required' }, 400);
  }

  if (!pdfBase64) {
    return c.json({ error: 'PDF base64 data is required' }, 400);
  }

  try {
    // Fill the PDF
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const filledPdfBytes = await fillPDF(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength), values);

    // Create filled form record
    const filledForm = await prisma.filledPDFForm.create({
      data: {
        templateId: id,
        companyId,
        incidentId: incidentId || null,
        values: JSON.stringify(values),
        generatedUrl: saveUrl || null,
        filledById: userId,
      },
      include: {
        template: { select: { id: true, name: true } },
        filledBy: { select: { id: true, firstName: true, lastName: true } },
        incident: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    // If linked to incident, update incident RTW fields
    if (incidentId) {
      await prisma.incident.update({
        where: { id: incidentId },
        data: {
          rtwCertificateUrl: saveUrl,
          rtwUploadedAt: new Date(),
          rtwUploadedBy: userId,
          rtwNotes: `Generated from template: ${template.name}`,
        },
      });
    }

    await createSystemLog({
      companyId,
      userId,
      action: 'INCIDENT_UPDATED',
      entityType: 'filled_pdf_form',
      entityId: filledForm.id,
      description: `PDF form "${template.name}" filled${incidentId ? ` for incident` : ''}`,
      metadata: { templateName: template.name, incidentId },
    });

    // Return the filled PDF as base64
    const filledPdfBase64 = Buffer.from(filledPdfBytes).toString('base64');

    return c.json({
      filledForm,
      pdfBase64: filledPdfBase64,
    }, 201);
  } catch (err) {
    console.error('Failed to fill PDF:', err);
    return c.json({ error: 'Failed to fill PDF' }, 500);
  }
});

// ===========================================
// WHS GENERATE & FILL (with R2 upload and incident linking)
// ===========================================

// POST /pdf-templates/:id/generate - Generate filled PDF, upload to R2, link to incident
pdfTemplatesRoutes.post('/:id/generate', requireWHSControl(), async (c) => {
  const id = c.req.param('id');
  const companyId = c.get('companyId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const { values, incidentId } = body;

  if (!values || Object.keys(values).length === 0) {
    return c.json({ error: 'Values are required' }, 400);
  }

  // Get template (GLOBAL - no company filtering)
  const template = await prisma.pDFTemplate.findFirst({
    where: { id, isActive: true },
  });

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  // Validate incident if provided
  if (incidentId) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, companyId },
    });
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
  }

  try {
    // Parse template fields
    const fieldsStr = typeof template.fields === 'string' ? template.fields : JSON.stringify(template.fields || {});
    const fieldsData = JSON.parse(fieldsStr);
    const fields: TemplateField[] = fieldsData.fields || [];
    const pageSizes: PageSize[] = fieldsData.pageSizes || [];

    // Fetch template PDF from R2
    const pdfResponse = await fetch(template.fileUrl);
    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch template PDF');
    }
    const templatePdfBuffer = await pdfResponse.arrayBuffer();

    // Generate filled PDF
    const filledPdfBytes = await generateFilledPDFFromTemplate(
      templatePdfBuffer,
      fields,
      values,
      pageSizes
    );

    // Upload filled PDF to R2
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filledFileName = `${template.name}_filled_${timestamp}.pdf`;
    const { url: generatedUrl } = await uploadToR2(
      Buffer.from(filledPdfBytes),
      filledFileName,
      'application/pdf',
      'filled-forms'
    );

    // Create filled form record
    const filledForm = await prisma.filledPDFForm.create({
      data: {
        templateId: id,
        companyId,
        incidentId: incidentId || null,
        values: JSON.stringify(values),
        generatedUrl,
        filledById: userId,
      },
      include: {
        template: { select: { id: true, name: true } },
        filledBy: { select: { id: true, firstName: true, lastName: true } },
        incident: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    // If linked to incident, update incident RTW fields
    if (incidentId) {
      await prisma.incident.update({
        where: { id: incidentId },
        data: {
          rtwCertificateUrl: generatedUrl,
          rtwUploadedAt: new Date(),
          rtwUploadedBy: userId,
          rtwNotes: `Generated from template: ${template.name}`,
        },
      });
    }

    await createSystemLog({
      companyId,
      userId,
      action: 'INCIDENT_UPDATED',
      entityType: 'filled_pdf_form',
      entityId: filledForm.id,
      description: `PDF form "${template.name}" generated${incidentId ? ` and linked to incident` : ''}`,
      metadata: { templateName: template.name, incidentId, generatedUrl },
    });

    return c.json({
      filledForm,
      generatedUrl,
      pdfBase64: Buffer.from(filledPdfBytes).toString('base64'),
    }, 201);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    return c.json({ error: 'Failed to generate PDF' }, 500);
  }
});

// GET /pdf-templates/:id/incidents - Get incidents for case selection dropdown
pdfTemplatesRoutes.get('/:id/incidents', requireWHSControl(), async (c) => {
  const companyId = c.get('companyId');

  // Only get incidents that DON'T have RTW certificate yet
  const incidents = await prisma.incident.findMany({
    where: {
      companyId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      rtwCertificateUrl: null, // Only cases without RTW certificate
    },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      reporter: { select: { firstName: true, lastName: true } },
      rtwCertificateUrl: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return c.json(incidents);
});

export { pdfTemplatesRoutes };
