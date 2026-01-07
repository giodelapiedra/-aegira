import { z } from 'zod';
import type { Context } from 'hono';

export const emailSchema = z.string().email('Invalid email format');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const dateSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format' }
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================
// QUERY PARAMETER HELPERS
// ============================================

/**
 * Parse and validate pagination query params with safe defaults
 */
export function parsePagination(c: Context): { page: number; limit: number; skip: number } {
  const pageStr = c.req.query('page') || '1';
  const limitStr = c.req.query('limit') || '20';

  // Parse with validation
  let page = parseInt(pageStr, 10);
  let limit = parseInt(limitStr, 10);

  // Ensure valid positive integers with sensible defaults
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100; // Cap at 100 to prevent abuse

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Parse and validate optional UUID param, returns null if invalid
 */
export function parseOptionalUUID(value: string | undefined): string | null {
  if (!value) return null;
  return isValidUUID(value) ? value : null;
}

// ============================================
// CHECKIN SCHEMAS
// ============================================

export const createCheckinSchema = z.object({
  mood: z.number().int().min(1).max(10),
  stress: z.number().int().min(1).max(10),
  sleep: z.number().int().min(1).max(10),
  physicalHealth: z.number().int().min(1).max(10),
  notes: z.string().max(1000).optional(),
});

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>;

// ============================================
// INCIDENT SCHEMAS
// ============================================

const incidentTypeEnum = z.enum(['INJURY', 'ILLNESS', 'MENTAL_HEALTH', 'EQUIPMENT', 'ENVIRONMENTAL', 'OTHER']);
const incidentSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const createIncidentSchema = z.object({
  type: incidentTypeEnum.default('OTHER'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  severity: incidentSeverityEnum,
  location: z.string().max(500).optional(),
  incidentDate: dateSchema.optional(),
  attachments: z.array(z.string().url()).max(10).optional(),
  requestException: z.boolean().optional(), // Worker can request exception along with incident
});

export const updateIncidentSchema = z.object({
  type: incidentTypeEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  severity: incidentSeverityEnum.optional(),
  location: z.string().max(500).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

// ============================================
// EXCEPTION SCHEMAS
// ============================================

const exceptionTypeEnum = z.enum(['SICK_LEAVE', 'PERSONAL_LEAVE', 'MEDICAL_APPOINTMENT', 'FAMILY_EMERGENCY', 'OTHER']);

export const createExceptionSchema = z.object({
  type: exceptionTypeEnum,
  reason: z.string().min(1, 'Reason is required').max(1000),
  startDate: dateSchema,
  endDate: dateSchema,
  notes: z.string().max(2000).optional(),
  attachments: z.array(z.string().url()).max(5).optional(),
  linkedIncidentId: z.string().uuid().optional(), // Optional link to an existing incident
});

export const updateExceptionSchema = z.object({
  type: exceptionTypeEnum.optional(),
  reason: z.string().min(1).max(1000).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;
export type UpdateExceptionInput = z.infer<typeof updateExceptionSchema>;
