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

export const ApplicationSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(100),
  workEmail: emailSchema,
  phone: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  companyName: z.string().min(1, 'Company/project name is required').max(200),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  description: z.string().min(20, 'Please provide a description (min 20 characters)').max(1000),
  stage: z.enum([
    'Idea',
    'Prototype',
    'Pre-revenue',
    'Early revenue',
    'Growth',
    'Established business',
    'Personal project',
    'Other',
  ]),
  githubUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  productUrl: z.string().url().optional().or(z.literal('')),
  demoUrl: z.string().url().optional().or(z.literal('')),
  whyLioranDB: z
    .string()
    .min(50, 'Please provide more detail (min 50 characters)')
    .max(2000),
  appDescription: z
    .string()
    .min(50, 'Please describe your application in detail (min 50 characters)')
    .max(2000),
  expectedDocumentCount: z.string().min(1, 'Required'),
  expectedMonthlyUsers: z.string().min(1, 'Required'),
  readTrafficLevel: z.string().min(1, 'Required'),
  writeTrafficLevel: z.string().min(1, 'Required'),
  estimatedStorage: z.string().min(1, 'Required'),
  isProduction: z.boolean(),
  pricingResponse: z.enum(['yes', 'discuss', 'no']),
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
export type ApplicationInput = z.infer<typeof ApplicationSchema>;
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
