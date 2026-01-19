/**
 * Forms Module - Hardcoded PDF Form Templates
 *
 * Endpoints for filling official government forms
 */

import { Hono } from 'hono';
import type { AppContext } from '../../types/context.js';
import { prisma } from '../../config/prisma.js';
import {
  fillPdfForm,
  getAvailableTemplates,
  getTemplateFields,
} from '../../utils/pdf-form-filler.js';
import { getFormTemplate } from '../../config/form-templates/index.js';
import { uploadToR2 } from '../../utils/upload.js';
import { isValidUUID } from '../../utils/validator.js';

const formsRoutes = new Hono<AppContext>();

/**
 * GET /forms/templates
 * List all available form templates
 */
formsRoutes.get('/templates', async (c) => {
  try {
    const templates = getAvailableTemplates();
    return c.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    return c.json({ error: 'Failed to get templates' }, 500);
  }
});

/**
 * GET /forms/templates/:id
 * Get template details and fields
 */
formsRoutes.get('/templates/:id', async (c) => {
  const { id } = c.req.param();

  const template = getTemplateFields(id);
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  return c.json(template);
});

/**
 * GET /forms/templates/:id/incidents
 * Get incidents that can be linked to this form (for auto-fill)
 * Only returns resolved/closed cases for the user's company
 */
formsRoutes.get('/templates/:id/incidents', async (c) => {
  const user = c.get('user');
  const companyId = c.get('companyId');

  // Role check - only authorized roles can access
  const allowedRoles = ['WHS_CONTROL', 'SUPERVISOR', 'ADMIN', 'EXECUTIVE', 'TEAM_LEAD'];
  if (!allowedRoles.includes(user.role)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  try {
    const incidents = await prisma.incident.findMany({
      where: {
        companyId,
        status: { in: ['RESOLVED', 'CLOSED'] },
      },
      select: {
        id: true,
        caseNumber: true,
        title: true,
        status: true,
        incidentDate: true,
        description: true,
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        company: {
          select: {
            name: true,
            address: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return c.json(incidents);
  } catch (error) {
    console.error('Error getting incidents:', error);
    return c.json({ error: 'Failed to get incidents' }, 500);
  }
});

/**
 * POST /forms/generate
 * Generate a filled PDF from template
 */
formsRoutes.post('/generate', async (c) => {
  const user = c.get('user');
  const companyId = c.get('companyId');

  // Role check - only WHS, Supervisors, Admins, Executives can generate forms
  const allowedRoles = ['WHS_CONTROL', 'SUPERVISOR', 'ADMIN', 'EXECUTIVE'];
  if (!allowedRoles.includes(user.role)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  const body = await c.req.json();
  const { templateId, values, incidentId, flatten = true } = body;

  if (!templateId) {
    return c.json({ error: 'templateId is required' }, 400);
  }

  if (!values || typeof values !== 'object') {
    return c.json({ error: 'values object is required' }, 400);
  }

  // Incident is required - forms must be attached to an incident
  if (!incidentId) {
    return c.json({ error: 'incidentId is required - please select an incident' }, 400);
  }

  // Validate incidentId format
  if (!isValidUUID(incidentId)) {
    return c.json({ error: 'Invalid incident ID format' }, 400);
  }

  try {
    // Verify template exists
    const template = getFormTemplate(templateId);
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    let enrichedValues = { ...values };
    let incident: any = null;

    // If incident provided, fetch once with all needed data for auto-fill and attachment
    if (incidentId) {
      incident = await prisma.incident.findFirst({
        where: {
          id: incidentId,
          companyId,
        },
        select: {
          id: true,
          attachments: true,
          reporter: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          company: {
            select: {
              name: true,
              address: true,
              phone: true,
            },
          },
          description: true,
          incidentDate: true,
        },
      });

      if (incident) {
        enrichedValues = autoFillFromIncident(template, enrichedValues, incident);
      }
    }

    // Generate the filled PDF
    const result = await fillPdfForm({
      templateId,
      values: enrichedValues,
      flatten,
    });

    let attachedUrl: string | null = null;

    // If incident exists, upload PDF and attach to incident
    if (incident) {
      try {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${template.name.replace(/\s+/g, '_')}_${timestamp}.pdf`;

        const uploadResult = await uploadToR2(
          pdfBuffer,
          filename,
          'application/pdf',
          'forms'
        );

        attachedUrl = uploadResult.url;

        // Update incident with new attachment (reuse incident.attachments from first query)
        const updatedAttachments = [...(incident.attachments || []), attachedUrl];

        await prisma.incident.update({
          where: { id: incidentId },
          data: {
            attachments: updatedAttachments,
            // If Certificate of Capacity, also set as RTW certificate
            ...(template.id === 'certificate-of-capacity-nsw' && {
              rtwCertificateUrl: attachedUrl,
              rtwCertDate: new Date(),
              rtwUploadedAt: new Date(),
            }),
          },
        });
      } catch (uploadError) {
        console.error('Error uploading/attaching PDF:', uploadError);
      }
    }

    // Log the generation
    await prisma.systemLog.create({
      data: {
        userId: user.id,
        companyId,
        action: incident ? 'INCIDENT_UPDATED' : 'SETTINGS_UPDATED',
        entityType: 'form',
        entityId: incident?.id || templateId,
        description: `Generated ${template.name} form${incident ? ' and attached to incident' : ''}`,
        metadata: {
          templateId,
          templateName: template.name,
          incidentId: incident?.id,
          attachedUrl,
          filledFields: result.filledFields.length,
          skippedFields: result.skippedFields.length,
        },
      },
    });

    return c.json({
      success: true,
      pdfBase64: result.pdfBase64,
      templateName: result.template.name,
      filledFields: result.filledFields,
      skippedFields: result.skippedFields,
      attachedUrl,
    });
  } catch (error: any) {
    console.error('Error generating form:', error);
    return c.json({ error: error.message || 'Failed to generate form' }, 500);
  }
});

/**
 * Auto-fill form values from incident data
 */
function autoFillFromIncident(
  template: any,
  values: Record<string, any>,
  incident: any
): Record<string, any> {
  const enriched = { ...values };

  for (const field of template.fields) {
    // Skip if value already provided
    if (enriched[field.key]) continue;

    // Skip if no auto-fill mapping
    if (!field.autoFillFrom) continue;

    // Get value from incident based on path
    const value = getNestedValue(incident, field.autoFillFrom);
    if (value !== undefined && value !== null) {
      enriched[field.key] = value;
    }
  }

  return enriched;
}

/**
 * Get nested object value by dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
}

export { formsRoutes };
