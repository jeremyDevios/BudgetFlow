import { isEnvelopeActiveForMonth, Envelope } from '@/types/envelope';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Envelope stub; only the fields under test are required. */
function makeEnvelope(
  overrides: Partial<Pick<Envelope, 'isTemporary' | 'activeMonths'>>,
): Pick<Envelope, 'isTemporary' | 'activeMonths'> {
  return { ...overrides };
}

// ---------------------------------------------------------------------------
// isEnvelopeActiveForMonth
// ---------------------------------------------------------------------------

describe('isEnvelopeActiveForMonth', () => {
  // -------------------------------------------------------------------------
  // Permanent envelopes — always active regardless of month or activeMonths
  // -------------------------------------------------------------------------

  describe('permanent envelopes (isTemporary absent or false)', () => {
    it('returns true when isTemporary is absent', () => {
      const env = makeEnvelope({});
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(true);
    });

    it('returns true when isTemporary is false', () => {
      const env = makeEnvelope({ isTemporary: false });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(true);
    });

    it('returns true even when activeMonths is defined on a permanent envelope', () => {
      // activeMonths is ignored for non-temporary envelopes
      const env = makeEnvelope({ isTemporary: false, activeMonths: ['2025-01'] });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(true);
    });

    it('returns true for a permanent envelope with an empty activeMonths array', () => {
      const env = makeEnvelope({ isTemporary: false, activeMonths: [] });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(true);
    });

    it('returns true across multiple distinct months', () => {
      const env = makeEnvelope({ isTemporary: false });
      for (const month of ['2024-01', '2024-06', '2024-12', '2025-03']) {
        expect(isEnvelopeActiveForMonth(env, month)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Active temporary envelopes — selectedMonth is present in activeMonths
  // -------------------------------------------------------------------------

  describe('active temporary envelopes (selectedMonth in activeMonths)', () => {
    it('returns true when selectedMonth exactly matches the only entry', () => {
      const env = makeEnvelope({ isTemporary: true, activeMonths: ['2025-03'] });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(true);
    });

    it('returns true when selectedMonth is the first entry in a multi-month list', () => {
      const env = makeEnvelope({
        isTemporary: true,
        activeMonths: ['2025-01', '2025-02', '2025-03'],
      });
      expect(isEnvelopeActiveForMonth(env, '2025-01')).toBe(true);
    });

    it('returns true when selectedMonth is a middle entry', () => {
      const env = makeEnvelope({
        isTemporary: true,
        activeMonths: ['2025-01', '2025-02', '2025-03'],
      });
      expect(isEnvelopeActiveForMonth(env, '2025-02')).toBe(true);
    });

    it('returns true when selectedMonth is the last entry', () => {
      const env = makeEnvelope({
        isTemporary: true,
        activeMonths: ['2025-01', '2025-02', '2025-03'],
      });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(true);
    });

    it('returns true for a year-boundary month (December → January span)', () => {
      const env = makeEnvelope({
        isTemporary: true,
        activeMonths: ['2024-11', '2024-12', '2025-01'],
      });
      expect(isEnvelopeActiveForMonth(env, '2024-12')).toBe(true);
      expect(isEnvelopeActiveForMonth(env, '2025-01')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Inactive temporary envelopes — selectedMonth is NOT in activeMonths
  // -------------------------------------------------------------------------

  describe('inactive temporary envelopes (selectedMonth NOT in activeMonths)', () => {
    it('returns false when selectedMonth is not in a single-entry list', () => {
      const env = makeEnvelope({ isTemporary: true, activeMonths: ['2025-01'] });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(false);
    });

    it('returns false when selectedMonth is not in a multi-entry list', () => {
      const env = makeEnvelope({
        isTemporary: true,
        activeMonths: ['2025-01', '2025-02'],
      });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(false);
    });

    it('returns false for a past month not in the list', () => {
      const env = makeEnvelope({ isTemporary: true, activeMonths: ['2025-06'] });
      expect(isEnvelopeActiveForMonth(env, '2024-06')).toBe(false);
    });

    it('returns false when selectedMonth is a prefix of a listed month (no partial matching)', () => {
      // "2025-1" must NOT match "2025-10" or "2025-11"
      const env = makeEnvelope({ isTemporary: true, activeMonths: ['2025-10', '2025-11'] });
      expect(isEnvelopeActiveForMonth(env, '2025-1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Missing or empty activeMonths — temporary envelope not yet assigned
  // -------------------------------------------------------------------------

  describe('temporary envelopes with missing or empty activeMonths', () => {
    it('returns false when activeMonths is undefined', () => {
      const env = makeEnvelope({ isTemporary: true });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(false);
    });

    it('returns false when activeMonths is an empty array', () => {
      const env = makeEnvelope({ isTemporary: true, activeMonths: [] });
      expect(isEnvelopeActiveForMonth(env, '2025-03')).toBe(false);
    });

    it('returns false regardless of the selectedMonth when activeMonths is empty', () => {
      const env = makeEnvelope({ isTemporary: true, activeMonths: [] });
      for (const month of ['2024-01', '2025-06', '2025-12']) {
        expect(isEnvelopeActiveForMonth(env, month)).toBe(false);
      }
    });
  });
});
