import {
  validateAmount,
  validateDescription,
  validateEnvelopeName,
  validateEnvelopeId,
  validateDate,
  validateEmail,
  validatePassword,
  VALIDATION_CONSTRAINTS,
  QUOTA_CONSTRAINTS,
  checkEnvelopeQuota,
  checkTransactionQuota,
  validateAmountWithMessage,
  validateDescriptionWithMessage,
  validateEnvelopeNameWithMessage,
  getMonthKey,
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
  it('returns true for a valid ISO date string (YYYY-MM-DD)', () => {
    expect(validateDate('2026-03-13')).toBe(true);
  });
  it('returns true for today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(validateDate(today)).toBe(true);
  });
  it('returns false for a datetime string (only YYYY-MM-DD accepted)', () => {
    expect(validateDate('2026-03-13T10:00:00.000Z')).toBe(false);
  });
  it('returns false for invalid month (13)', () => {
    expect(validateDate('2026-13-01')).toBe(false);
  });
  it('returns false for invalid day (Feb 30)', () => {
    expect(validateDate('2026-02-30')).toBe(false);
  });
  it('returns false for non-ISO format (DD/MM/YYYY)', () => {
    expect(validateDate('01/01/2026')).toBe(false);
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

// ── Quota checkers ──

describe('checkEnvelopeQuota', () => {
  it('allows when count is under limit', () => {
    expect(checkEnvelopeQuota(0).allowed).toBe(true);
    expect(checkEnvelopeQuota(10).allowed).toBe(true);
    expect(checkEnvelopeQuota(49).allowed).toBe(true);
  });
  it('blocks when count is at limit', () => {
    const result = checkEnvelopeQuota(QUOTA_CONSTRAINTS.MAX_ENVELOPES);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Limite atteinte');
    expect(result.message).toContain(String(QUOTA_CONSTRAINTS.MAX_ENVELOPES));
  });
  it('blocks when count is over limit', () => {
    const result = checkEnvelopeQuota(QUOTA_CONSTRAINTS.MAX_ENVELOPES + 1);
    expect(result.allowed).toBe(false);
  });
  it('returns empty message when allowed', () => {
    const result = checkEnvelopeQuota(5);
    expect(result.allowed).toBe(true);
    expect(result.message).toBe('');
  });
});

describe('checkTransactionQuota', () => {
  it('allows when count is under limit', () => {
    expect(checkTransactionQuota(0).allowed).toBe(true);
    expect(checkTransactionQuota(100).allowed).toBe(true);
    expect(checkTransactionQuota(499).allowed).toBe(true);
  });
  it('blocks when count is at limit', () => {
    const result = checkTransactionQuota(QUOTA_CONSTRAINTS.MAX_TRANSACTIONS_PER_MONTH);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Limite atteinte');
    expect(result.message).toContain(String(QUOTA_CONSTRAINTS.MAX_TRANSACTIONS_PER_MONTH));
  });
  it('blocks when count is over limit', () => {
    const result = checkTransactionQuota(QUOTA_CONSTRAINTS.MAX_TRANSACTIONS_PER_MONTH + 1);
    expect(result.allowed).toBe(false);
  });
  it('returns empty message when allowed', () => {
    const result = checkTransactionQuota(5);
    expect(result.allowed).toBe(true);
    expect(result.message).toBe('');
  });
});

// ── Validation with French messages ──

describe('validateAmountWithMessage', () => {
  it('returns valid for a good amount', () => {
    const result = validateAmountWithMessage(50);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });
  it('rejects NaN with French error', () => {
    const result = validateAmountWithMessage(NaN);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('nombre valide');
  });
  it('rejects zero with French error', () => {
    const result = validateAmountWithMessage(0);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('supérieur à 0');
  });
  it('rejects negative with French error', () => {
    const result = validateAmountWithMessage(-5);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('supérieur à 0');
  });
  it('rejects amount over max', () => {
    const result = validateAmountWithMessage(VALIDATION_CONSTRAINTS.AMOUNT_MAX + 1);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ne peut pas dépasser');
  });
  it('rejects string', () => {
    const result = validateAmountWithMessage('abc');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('nombre valide');
  });
  it('rejects null', () => {
    const result = validateAmountWithMessage(null);
    expect(result.valid).toBe(false);
  });
  it('accepts amount at max', () => {
    const result = validateAmountWithMessage(VALIDATION_CONSTRAINTS.AMOUNT_MAX);
    expect(result.valid).toBe(true);
  });
  it('accepts amount just above zero', () => {
    const result = validateAmountWithMessage(0.01);
    expect(result.valid).toBe(true);
  });
});

describe('validateDescriptionWithMessage', () => {
  it('accepts a valid description', () => {
    const result = validateDescriptionWithMessage('Courses');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });
  it('rejects empty string with French error', () => {
    const result = validateDescriptionWithMessage('');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ne peut pas être vide');
  });
  it('rejects whitespace-only with French error', () => {
    const result = validateDescriptionWithMessage('   ');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ne peut pas être vide');
  });
  it('rejects over max length with French error', () => {
    const result = validateDescriptionWithMessage('a'.repeat(256));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ne peut pas dépasser');
    expect(result.message).toContain('255');
  });
  it('accepts at max length', () => {
    const result = validateDescriptionWithMessage('a'.repeat(255));
    expect(result.valid).toBe(true);
  });
  it('rejects non-string', () => {
    const result = validateDescriptionWithMessage(42 as unknown as string);
    expect(result.valid).toBe(false);
  });
});

describe('validateEnvelopeNameWithMessage', () => {
  it('accepts a valid name', () => {
    const result = validateEnvelopeNameWithMessage('Courses');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });
  it('rejects empty with French error', () => {
    const result = validateEnvelopeNameWithMessage('');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ne peut pas être vide');
  });
  it('rejects whitespace-only', () => {
    const result = validateEnvelopeNameWithMessage('  ');
    expect(result.valid).toBe(false);
  });
  it('rejects over max length with French error', () => {
    const result = validateEnvelopeNameWithMessage('a'.repeat(101));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ne peut pas dépasser');
  });
  it('accepts at max length', () => {
    const result = validateEnvelopeNameWithMessage('a'.repeat(100));
    expect(result.valid).toBe(true);
  });
});

describe('getMonthKey', () => {
  it('extracts YYYY-MM from ISO date and formats as tx_YYYY_MM', () => {
    expect(getMonthKey('2026-06-15')).toBe('tx_2026_06');
  });
  it('works with date-only string', () => {
    expect(getMonthKey('2025-01-01')).toBe('tx_2025_01');
  });
  it('works with datetime string', () => {
    expect(getMonthKey('2026-12-31T23:59:59')).toBe('tx_2026_12');
  });
});
