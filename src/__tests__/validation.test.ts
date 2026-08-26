import {
  emailSchema,
  passwordSchema,
  VerifyOTPSchema,
  ApplicationSchema,
} from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  test('emailSchema rejects invalid emails and trims/lowercases valid ones', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('  TEST@Example.Com  ').data).toBe('test@example.com');
    expect(emailSchema.safeParse('invalid-email').success).toBe(false);
  });

  test('passwordSchema enforces length and complexity', () => {
    expect(passwordSchema.safeParse('StrongPass123!').success).toBe(true);
    expect(passwordSchema.safeParse('Short1!').success).toBe(false);
    expect(passwordSchema.safeParse('lowercase123!').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHere!').success).toBe(false);
    expect(passwordSchema.safeParse('NoSpecialChars123').success).toBe(false);
  });

  test('VerifyOTPSchema only accepts exact 6 digits', () => {
    expect(VerifyOTPSchema.safeParse({ otp: '123456' }).success).toBe(true);
    expect(VerifyOTPSchema.safeParse({ otp: '12345' }).success).toBe(false);
    expect(VerifyOTPSchema.safeParse({ otp: '1234567' }).success).toBe(false);
    expect(VerifyOTPSchema.safeParse({ otp: 'abcdef' }).success).toBe(false);
  });

  test('ApplicationSchema validates mandatory fields', () => {
    const validApp = {
      fullName: 'Jane Doe',
      workEmail: 'jane@company.com',
      country: 'India',
      companyName: 'TechCorp',
      description: 'We build enterprise scale document workflows across industries.',
      stage: 'Growth',
      whyLioranDB: 'We need high performance document database storage with predictable latency and managed support.',
      appDescription: 'Our application processes invoice records and PDF metadata across multiple microservices.',
      expectedDocumentCount: '100,000 – 500,000',
      expectedMonthlyUsers: '10,000',
      readTrafficLevel: 'Moderate (100–1,000 req/s)',
      writeTrafficLevel: 'Light (under 100 req/s)',
      estimatedStorage: '5–10 GB',
      isProduction: true,
      pricingResponse: 'yes',
    };

    expect(ApplicationSchema.safeParse(validApp).success).toBe(true);
  });
});

