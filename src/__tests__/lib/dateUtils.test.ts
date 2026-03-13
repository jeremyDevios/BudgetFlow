import { getMonthBounds, formatMonthYear } from '@/lib/dateUtils';

describe('getMonthBounds', () => {
  it('returns correct start for a mid-month date', () => {
    const result = getMonthBounds(new Date(2026, 2, 13)); // March 13
    expect(result.start).toBe('2026-03-01');
  });

  it('returns correct end for March (31 days)', () => {
    const result = getMonthBounds(new Date(2026, 2, 13));
    expect(result.end).toBe('2026-03-31T23:59:59');
  });

  it('returns correct end for February (28 days in non-leap year)', () => {
    const result = getMonthBounds(new Date(2026, 1, 1));
    expect(result.end).toBe('2026-02-28T23:59:59');
  });

  it('returns correct end for February in a leap year (29 days)', () => {
    const result = getMonthBounds(new Date(2024, 1, 1));
    expect(result.end).toBe('2024-02-29T23:59:59');
  });

  it('returns correct bounds for January', () => {
    const result = getMonthBounds(new Date(2026, 0, 15));
    expect(result.start).toBe('2026-01-01');
    expect(result.end).toBe('2026-01-31T23:59:59');
  });

  it('returns correct bounds for December', () => {
    const result = getMonthBounds(new Date(2026, 11, 31));
    expect(result.start).toBe('2026-12-01');
    expect(result.end).toBe('2026-12-31T23:59:59');
  });

  it('pads single-digit months with leading zero', () => {
    const result = getMonthBounds(new Date(2026, 8, 1)); // September
    expect(result.start).toBe('2026-09-01');
  });

  it('pads single-digit days with leading zero', () => {
    const result = getMonthBounds(new Date(2026, 3, 5)); // April
    expect(result.start).toBe('2026-04-01');
  });

  it('returns strings (not Date objects)', () => {
    const result = getMonthBounds(new Date(2026, 2, 13));
    expect(typeof result.start).toBe('string');
    expect(typeof result.end).toBe('string');
  });
});

describe('formatMonthYear', () => {
  it('formats a date in French locale', () => {
    const result = formatMonthYear(new Date(2026, 2, 13));
    // Accepts "mars 2026" or "mars 2026" — check it contains the year
    expect(result).toContain('2026');
    expect(result.toLowerCase()).toContain('mars');
  });

  it('formats January correctly', () => {
    const result = formatMonthYear(new Date(2026, 0, 1));
    expect(result).toContain('2026');
    expect(result.toLowerCase()).toContain('janvier');
  });

  it('formats December correctly', () => {
    const result = formatMonthYear(new Date(2025, 11, 1));
    expect(result).toContain('2025');
    expect(result.toLowerCase()).toContain('décembre');
  });

  it('returns a non-empty string', () => {
    const result = formatMonthYear(new Date());
    expect(result.length).toBeGreaterThan(0);
  });
});
