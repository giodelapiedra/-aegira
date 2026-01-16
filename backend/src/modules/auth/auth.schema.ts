import { z } from 'zod';
import { emailSchema, passwordSchema } from '../../utils/validator.js';
import { isValidTimezone } from '../../utils/date-helpers.js';

// Executive registration - creates company
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().min(1, 'Company name is required'),
  timezone: z
    .string()
    .min(1, 'Timezone is required')
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Invalid timezone. Please select a valid timezone from the list.' }
    ),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
