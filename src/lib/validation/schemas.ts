import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email('Please enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Must include at least one uppercase letter')
  .regex(/[a-z]/, 'Must include at least one lowercase letter')
  .regex(/[0-9]/, 'Must include at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Must include at least one special character');

export const SignupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const VerifyOTPSchema = z.object({
  otp: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Only digits are allowed'),
});

export const ForgotPasswordSchema = z.object({ email: emailSchema });

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const CreateInstanceSchema = z.object({
  name: z
    .string()
    .min(3, 'Instance name must be at least 3 characters')
    .max(32, 'Instance name cannot exceed 32 characters')
    .regex(/^[a-z0-9-]+$/, 'Instance name can only contain lowercase letters, numbers, and hyphens'),
  planId: z.enum(['shared', 'dedicated']),
  backupEnabled: z.boolean().default(false),
  couponCode: z.string().optional(),
});

export const CreateDatabaseUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  role: z.enum(['readWrite', 'read', 'dbAdmin']).default('readWrite'),
});

export const CouponValidationSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  planId: z.string().optional(),
});

export const SupportTicketSchema = z.object({
  category: z.enum([
    'SUPPORT_REQUEST',
    'BUG_REPORT',
    'FEATURE_REQUEST',
    'BILLING_REQUEST',
    'OTHER',
  ]),
  subject: z.string().min(5, 'Subject is required').max(200),
  description: z.string().min(20, 'Please describe your issue in detail').max(5000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  url: z.string().url().optional().or(z.literal('')),
  environment: z.string().max(500).optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateInstanceInput = z.infer<typeof CreateInstanceSchema>;
export type SupportTicketInput = z.infer<typeof SupportTicketSchema>;

export function getZodErrorMessage(error: z.ZodError): string {
  if (error.issues && error.issues.length > 0) {
    return error.issues[0].message;
  }
  return 'Validation failed';
}

export function getZodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  if (error.issues) {
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
  }
  return fieldErrors;
}
