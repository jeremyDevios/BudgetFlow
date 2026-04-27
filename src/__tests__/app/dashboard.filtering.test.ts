/**
 * Tests for the dashboard's temporary-envelope filtering behaviour.
 *
 * The dashboard computes `visibleEnvelopes` with:
 *
 *   envelopes.filter((env) => isEnvelopeActiveForMonth(env, selectedMonth))
 *
 * This file exercises that filtering pattern against representative mixed
 * arrays of permanent and temporary envelopes — matching what `useMemo`
 * would return for different `currentDate` values.
 */

import { isEnvelopeActiveForMonth, Envelope } from '@/types/envelope';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FilterableEnvelope = Pick<
  Envelope,
  'id' | 'name' | 'isTemporary' | 'activeMonths'
>;

/** Derive the YYYY-MM selectedMonth string from a Date, identical to the
 *  dashboard's own derivation. */
function toSelectedMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Apply the same filter the dashboard useMemo uses. */
function filterEnvelopesForMonth(
  envelopes: FilterableEnvelope[],
  selectedMonth: string,
): FilterableEnvelope[] {
  return envelopes.filter((env) => isEnvelopeActiveForMonth(env, selectedMonth));
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const PERMANENT_GROCERIES: FilterableEnvelope = {
  id: 'perm-1',
  name: 'Courses',
  isTemporary: false,
};

const PERMANENT_TRANSPORT: FilterableEnvelope = {
  id: 'perm-2',
  name: 'Transport',
  // isTemporary intentionally omitted — treated as permanent
};

const TEMP_ACTIVE_MARCH: FilterableEnvelope = {
  id: 'temp-1',
  name: 'Vacances hiver',
  isTemporary: true,
  activeMonths: ['2025-02', '2025-03'],
};

const TEMP_INACTIVE_MARCH: FilterableEnvelope = {
  id: 'temp-2',
  name: 'Noël',
  isTemporary: true,
  activeMonths: ['2024-12'],
};

const TEMP_NO_MONTHS: FilterableEnvelope = {
  id: 'temp-3',
  name: 'Projet futur',
  isTemporary: true,
  activeMonths: [],
};

const TEMP_UNDEFINED_MONTHS: FilterableEnvelope = {
  id: 'temp-4',
  name: 'Sans mois',
  isTemporary: true,
  // activeMonths intentionally absent
};

const ALL_ENVELOPES: FilterableEnvelope[] = [
  PERMANENT_GROCERIES,
  PERMANENT_TRANSPORT,
  TEMP_ACTIVE_MARCH,
  TEMP_INACTIVE_MARCH,
  TEMP_NO_MONTHS,
  TEMP_UNDEFINED_MONTHS,
];

// ---------------------------------------------------------------------------
// Dashboard filtering behaviour
// ---------------------------------------------------------------------------

describe('Dashboard envelope filtering for a selected month', () => {
  // -------------------------------------------------------------------------
  // Only permanent envelopes in the list
  // -------------------------------------------------------------------------

  describe('when all envelopes are permanent', () => {
    const permanents = [PERMANENT_GROCERIES, PERMANENT_TRANSPORT];

    it('returns all envelopes for any month', () => {
      for (const month of ['2025-01', '2025-06', '2025-12']) {
        expect(filterEnvelopesForMonth(permanents, month)).toHaveLength(2);
      }
    });

    it('includes every permanent envelope by id', () => {
      const result = filterEnvelopesForMonth(permanents, '2025-03');
      const ids = result.map((e) => e.id);
      expect(ids).toContain('perm-1');
      expect(ids).toContain('perm-2');
    });
  });

  // -------------------------------------------------------------------------
  // Mixed list — March 2025
  // -------------------------------------------------------------------------

  describe('when the selected month is 2025-03', () => {
    const selectedMonth = '2025-03';

    it('includes both permanent envelopes', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).toContain('perm-1');
      expect(result.map((e) => e.id)).toContain('perm-2');
    });

    it('includes the temporary envelope whose activeMonths contains 2025-03', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).toContain('temp-1');
    });

    it('excludes the temporary envelope whose activeMonths does not contain 2025-03', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).not.toContain('temp-2');
    });

    it('excludes temporary envelopes with an empty activeMonths', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).not.toContain('temp-3');
    });

    it('excludes temporary envelopes with no activeMonths property', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).not.toContain('temp-4');
    });

    it('returns exactly 3 envelopes (2 permanent + 1 active temporary)', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed list — December 2024
  // -------------------------------------------------------------------------

  describe('when the selected month is 2024-12', () => {
    const selectedMonth = '2024-12';

    it('includes the temporary envelope active in December', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).toContain('temp-2');
    });

    it('excludes the temporary envelope only active in Feb–Mar 2025', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).not.toContain('temp-1');
    });

    it('still includes all permanent envelopes', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result.map((e) => e.id)).toContain('perm-1');
      expect(result.map((e) => e.id)).toContain('perm-2');
    });

    it('returns exactly 3 envelopes (2 permanent + 1 active temporary)', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Month with no active temporary envelopes
  // -------------------------------------------------------------------------

  describe('when no temporary envelope is active for the selected month', () => {
    const selectedMonth = '2025-07';

    it('returns only permanent envelopes', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(
        expect.arrayContaining(['perm-1', 'perm-2']),
      );
    });

    it('excludes every temporary envelope', () => {
      const result = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
      const ids = result.map((e) => e.id);
      expect(ids).not.toContain('temp-1');
      expect(ids).not.toContain('temp-2');
      expect(ids).not.toContain('temp-3');
      expect(ids).not.toContain('temp-4');
    });
  });

  // -------------------------------------------------------------------------
  // Empty envelope list
  // -------------------------------------------------------------------------

  describe('when the envelope list is empty', () => {
    it('returns an empty array', () => {
      expect(filterEnvelopesForMonth([], '2025-03')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // selectedMonth derivation — mirrors the dashboard formula
  // -------------------------------------------------------------------------

  describe('selectedMonth string derivation', () => {
    it('pads single-digit months with a leading zero', () => {
      expect(toSelectedMonth(new Date(2025, 2, 15))).toBe('2025-03'); // March
      expect(toSelectedMonth(new Date(2025, 0, 1))).toBe('2025-01');  // January
      expect(toSelectedMonth(new Date(2025, 8, 30))).toBe('2025-09'); // September
    });

    it('does not pad double-digit months', () => {
      expect(toSelectedMonth(new Date(2025, 9, 1))).toBe('2025-10');  // October
      expect(toSelectedMonth(new Date(2025, 11, 31))).toBe('2025-12'); // December
    });

    it('correctly filters when selectedMonth is derived from a Date', () => {
      const march2025 = toSelectedMonth(new Date(2025, 2, 10));
      const result = filterEnvelopesForMonth([TEMP_ACTIVE_MARCH], march2025);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('temp-1');
    });
  });
});
