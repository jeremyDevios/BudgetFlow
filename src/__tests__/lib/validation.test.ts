import {
  validateAmount,
  validateDescription,
  validateEnvelopeName,
  validateEnvelopeId,
  validateDate,
  validateEmail,
  validatePassword,
  VALIDATION_CONSTRAINTS,
} from '@/lib/validation';

describe('validateAmount', () => {
  it('returns true for a valid positive amount', () => {
    expect(validateAmount(10.5)).toBe(true);
  });
  it('returns true for the maximum allowed amount', () => {
    expect(validateAmount(VALIDATION_CONSTRAINTS.AMOUNT_MAX)).toBe(true);
  });
  it('returns false for zero', () => {
    expect(validateAmount(0)).toBe(false);
  });
  it('returns false for AMOUNT_MIN (not strictly greater)', () => {
    expect(validateAmount(VALIDATION_CONSTRAINTS.AMOUNT_MIN)).toBe(false);
  });
  it('returns false for a value just above AMOUNT_MIN', () => {
    expect(validateAmount(0.011)).toBe(true);
  });
  it('returns false for a value exceeding AMOUNT_MAX', () => {
    expect(validateAmount(VALIDATION_CONSTRAINTS.AMOUNT_MAX + 1)).toBe(false);
  });
  it('returns false for NaN', () => {
    expect(validateAmount(NaN)).toBe(false);
  });
  it('returns false for a string', () => {
    expect(validateAmount('10')).toBe(false);
  });
  it('returns false for null', () => {
    expect(validateAmount(null)).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(validateAmount(undefined)).toBe(false);
  });
  it('returns false for negative number', () => {
    expect(validateAmount(-5)).toBe(false);
  });
});

describe('validateDescription', () => {
  it('returns true for a non-empty string', () => {
    expect(validateDescription('Cinéma')).toBe(true);
  });
  it('returns false for an empty string', () => {
    expect(validateDescription('')).toBe(false);
  });
  it('returns false for a whitespace-only string', () => {
    expect(validateDescription('   ')).toBe(false);
  });
  it('returns false for a string exceeding max length', () => {
    expect(validateDescription('a'.repeat(VALIDATION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH + 1))).toBe(false);
  });
  it('returns true for a string exactly at max length', () => {
    expect(validateDescription('a'.repeat(VALIDATION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH))).toBe(true);
  });
  it('returns false for a number', () => {
    expect(validateDescription(42)).toBe(false);
  });
  it('returns false for null', () => {
    expect(validateDescription(null)).toBe(false);
  });
});

describe('validateEnvelopeName', () => {
  it('returns true for a valid name', () => {
    expect(validateEnvelopeName('Courses')).toBe(true);
  });
  it('returns false for empty string', () => {
    expect(validateEnvelopeName('')).toBe(false);
  });
  it('returns false for whitespace-only', () => {
    expect(validateEnvelopeName('  ')).toBe(false);
  });
  it('returns false for name exceeding max length', () => {
    expect(validateEnvelopeName('a'.repeat(VALIDATION_CONSTRAINTS.ENVELOPE_NAME_MAX_LENGTH + 1))).toBe(false);
  });
  it('returns true at exactly max length', () => {
    expect(validateEnvelopeName('a'.repeat(VALIDATION_CONSTRAINTS.ENVELOPE_NAME_MAX_LENGTH))).toBe(true);
  });
  it('returns false for non-string', () => {
    expect(validateEnvelopeName(123)).toBe(false);
  });
});

describe('validateEnvelopeId', () => {
  it('returns true for a non-empty string id', () => {
    expect(validateEnvelopeId('abc123')).toBe(true);
  });
  it('returns false for an empty string', () => {
    expect(validateEnvelopeId('')).toBe(false);
  });
  it('returns false for a number', () => {
    expect(validateEnvelopeId(42)).toBe(false);
  });
  it('returns false for null', () => {
    expect(validateEnvelopeId(null)).toBe(false);
  });
});

describe('validateDate', () => {
  it('returns true for a valid ISO date string', () => {
    expect(validateDate('2026-03-13')).toBe(true);
  });
  it('returns true for a valid ISO datetime string', () => {
    expect(validateDate('2026-03-13T10:00:00.000Z')).toBe(true);
  });
  it('returns false for an impossible date string', () => {
    expect(validateDate('not-a-date')).toBe(false);
  });
  it('returns false for a number', () => {
    expect(validateDate(20260101)).toBe(false);
  });
  it('returns false for null', () => {
    expect(validateDate(null)).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(validateDate(undefined)).toBe(false);
  });
});

describe('validateEmail', () => {
  it('returns true for a valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  it('returns true for email with subdomain', () => {
    expect(validateEmail('user@mail.example.co.uk')).toBe(true);
  });
  it('returns false for missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });
  it('returns false for missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });
  it('returns false for missing TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
  it('returns false for non-string', () => {
    expect(validateEmail(null)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('returns true for a valid password', () => {
    expect(validatePassword('SecurePass1')).toBe(true);
  });
  it('returns false for too short password', () => {
    expect(validatePassword('Sh0rt')).toBe(false);
  });
  it('returns false for too long password', () => {
    expect(validatePassword('A1' + 'a'.repeat(127))).toBe(false);
  });
  it('returns false for password missing uppercase', () => {
    expect(validatePassword('secure123')).toBe(false);
  });
  it('returns false for password missing lowercase', () => {
    expect(validatePassword('SECURE123')).toBe(false);
  });
  it('returns false for password missing digit', () => {
    expect(validatePassword('SecurePass')).toBe(false);
  });
  it('returns false for non-string', () => {
    expect(validatePassword(null)).toBe(false);
  });
  it('returns true for password exactly 8 chars with all requirements', () => {
    expect(validatePassword('Secure1x')).toBe(true);
  });
});
