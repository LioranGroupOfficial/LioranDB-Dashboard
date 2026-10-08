import {
  emailSchema,
  passwordSchema,
  VerifyOTPSchema,
  CreateInstanceSchema,
  CreateDatabaseUserSchema,
  CouponValidationSchema,
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

  test('CreateInstanceSchema validates name format and planId', () => {
    expect(
      CreateInstanceSchema.safeParse({
        name: 'prod-analytics-01',
        planId: 'shared',
        backupEnabled: true,
      }).success
    ).toBe(true);

    expect(
      CreateInstanceSchema.safeParse({
        name: 'Invalid Name With Spaces',
        planId: 'shared',
      }).success
    ).toBe(false);

    expect(
      CreateInstanceSchema.safeParse({
        name: 'valid-name',
        planId: 'unknown-plan',
      }).success
    ).toBe(false);
  });

  test('CreateDatabaseUserSchema validates username format and role', () => {
    expect(
      CreateDatabaseUserSchema.safeParse({
        username: 'app_service',
        role: 'read_write',
      }).success
    ).toBe(true);

    expect(
      CreateDatabaseUserSchema.safeParse({
        username: 'app_service',
        role: 'readWrite',
      }).success
    ).toBe(true);

    expect(
      CreateDatabaseUserSchema.safeParse({
        username: 'ab', // too short (< 3)
      }).success
    ).toBe(false);
  });

  test('CouponValidationSchema validates coupon code', () => {
    expect(
      CouponValidationSchema.safeParse({
        code: 'PROMO50',
      }).success
    ).toBe(true);

    expect(
      CouponValidationSchema.safeParse({
        code: '',
      }).success
    ).toBe(false);
  });
});
