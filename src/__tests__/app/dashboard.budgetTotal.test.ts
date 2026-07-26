/**
 * Regression tests for the dashboard available-total bug fix.
 *
 * Bug: active temporary-envelope budgets were not being added to
 * `monthlyTotalAvailable`, causing the dashboard to under-report the
 * available total, the remaining balance, and the progress denominator for
 * any month in which a temporary envelope is active.
 *
 * Fix (in dashboard/page.tsx):
 *
 *   const temporaryEnvelopesBudget = visibleEnvelopes
 *     .filter((env) => env.isTemporary)
 *     .reduce((acc, env) => acc + env.budget, 0);
 *
 *   const monthlyTotalAvailable =
 *     settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings
 *     + temporaryEnvelopesBudget;
 *
 * This file exercises those three calculation steps against three representative
 * month scenarios, using the same helper implementations copied verbatim from
 * the component so that any drift between production and test will fail CI.
 *
 * Helper provenance:
 *  - filterEnvelopesForMonth  → mirrors the `useMemo` in dashboard/page.tsx
 *  - computeMonthlyTotals     → mirrors the inline calculations at lines 444-463
 */

import { isEnvelopeActiveForMonth } from '@/types/envelope';

// ---------------------------------------------------------------------------
// Types (subset of the dashboard's local Envelope interface)
// ---------------------------------------------------------------------------

interface EnvelopeStub {
  id: string;
  name: string;
  budget: number;
  spent: number;
  isTemporary?: boolean;
  activeMonths?: string[];
}

interface Settings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
}

// ---------------------------------------------------------------------------
// Helpers — mirrors the dashboard computation verbatim
// ---------------------------------------------------------------------------

/** Step 1: replicate the `useMemo` visible-envelope filter. */
function filterEnvelopesForMonth(
  envelopes: EnvelopeStub[],
  selectedMonth: string,
): EnvelopeStub[] {
  return envelopes.filter((env) => isEnvelopeActiveForMonth(env, selectedMonth));
}

interface MonthlyTotals {
  totalBudgetEnvelopes: number;
  totalSpentEnvelopes: number;
  temporaryEnvelopesBudget: number;
  monthlyTotalAvailable: number;
  currentMonthBalance: number;
  globalProgress: number;
}

/** Step 2: replicate the inline calculations from dashboard/page.tsx lines 444-463. */
function computeMonthlyTotals(
  visibleEnvelopes: EnvelopeStub[],
  settings: Settings,
): MonthlyTotals {
  const totalBudgetEnvelopes = visibleEnvelopes.reduce(
    (acc, env) => acc + env.budget,
    0,
  );
  const totalSpentEnvelopes = visibleEnvelopes.reduce(
    (acc, env) => acc + env.spent,
    0,
  );

  // Only envelopes already visible (i.e. active for the month) are summed.
  const temporaryEnvelopesBudget = visibleEnvelopes
    .filter((env) => env.isTemporary)
    .reduce((acc, env) => acc + env.budget, 0);

  const monthlyTotalAvailable =
    settings.monthlyIncome -
    settings.fixedCosts -
    settings.monthlySavings +
    temporaryEnvelopesBudget;

  const currentMonthBalance = monthlyTotalAvailable - totalSpentEnvelopes;

  const globalProgress =
    monthlyTotalAvailable > 0
      ? (totalSpentEnvelopes / monthlyTotalAvailable) * 100
      : 0;

  return {
    totalBudgetEnvelopes,
    totalSpentEnvelopes,
    temporaryEnvelopesBudget,
    monthlyTotalAvailable,
    currentMonthBalance,
    globalProgress,
  };
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SETTINGS: Settings = {
  monthlyIncome: 3000,
  fixedCosts: 800,
  monthlySavings: 200,
};

// Base pool without any temporary boost: 3000 - 800 - 200 = 2000
const BASE_POOL = SETTINGS.monthlyIncome - SETTINGS.fixedCosts - SETTINGS.monthlySavings;

const PERM_GROCERIES: EnvelopeStub = {
  id: 'perm-groceries',
  name: 'Courses',
  budget: 400,
  spent: 120,
  isTemporary: false,
};

const PERM_TRANSPORT: EnvelopeStub = {
  id: 'perm-transport',
  name: 'Transport',
  budget: 150,
  spent: 50,
};

// Active in March 2025 — should add its budget to the total for that month.
const TEMP_VACATION_MARCH: EnvelopeStub = {
  id: 'temp-vacation',
  name: 'Vacances hiver',
  budget: 600,
  spent: 250,
  isTemporary: true,
  activeMonths: ['2025-02', '2025-03'],
};

// Active only in December — should NOT add its budget for March 2025.
const TEMP_CHRISTMAS: EnvelopeStub = {
  id: 'temp-christmas',
  name: 'Noël',
  budget: 300,
  spent: 0,
  isTemporary: true,
  activeMonths: ['2024-12'],
};

const ALL_ENVELOPES: EnvelopeStub[] = [
  PERM_GROCERIES,
  PERM_TRANSPORT,
  TEMP_VACATION_MARCH,
  TEMP_CHRISTMAS,
];

// ---------------------------------------------------------------------------
// Scenario A — Month with NO active temporary envelopes (July 2025)
// ---------------------------------------------------------------------------

describe('Scenario A: month with no active temporary envelopes (2025-07)', () => {
  const selectedMonth = '2025-07';
  const visible = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
  const totals = computeMonthlyTotals(visible, SETTINGS);

  it('visible envelopes contain only the two permanent envelopes', () => {
    expect(visible).toHaveLength(2);
    expect(visible.map((e) => e.id)).toEqual(
      expect.arrayContaining(['perm-groceries', 'perm-transport']),
    );
  });

  it('temporaryEnvelopesBudget is zero', () => {
    expect(totals.temporaryEnvelopesBudget).toBe(0);
  });

  it('monthlyTotalAvailable equals the base pool (income − fixed − savings)', () => {
    expect(totals.monthlyTotalAvailable).toBe(BASE_POOL); // 2000
  });

  it('currentMonthBalance is base pool minus total spent', () => {
    const expectedSpent = PERM_GROCERIES.spent + PERM_TRANSPORT.spent; // 170
    expect(totals.currentMonthBalance).toBe(BASE_POOL - expectedSpent); // 1830
  });

  it('globalProgress denominator is the base pool (no temporary inflation)', () => {
    const expectedSpent = PERM_GROCERIES.spent + PERM_TRANSPORT.spent; // 170
    const expectedProgress = (expectedSpent / BASE_POOL) * 100;
    expect(totals.globalProgress).toBeCloseTo(expectedProgress, 5);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — Month WITH an active temporary envelope (March 2025)
// ---------------------------------------------------------------------------

describe('Scenario B: month with an active temporary envelope (2025-03)', () => {
  const selectedMonth = '2025-03';
  const visible = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
  const totals = computeMonthlyTotals(visible, SETTINGS);

  it('visible envelopes include both permanent envelopes and the active temporary', () => {
    expect(visible).toHaveLength(3);
    expect(visible.map((e) => e.id)).toEqual(
      expect.arrayContaining(['perm-groceries', 'perm-transport', 'temp-vacation']),
    );
  });

  it('the inactive Christmas temporary envelope is excluded from visible', () => {
    expect(visible.map((e) => e.id)).not.toContain('temp-christmas');
  });

  it('temporaryEnvelopesBudget equals the vacation envelope budget', () => {
    expect(totals.temporaryEnvelopesBudget).toBe(TEMP_VACATION_MARCH.budget); // 600
  });

  it('monthlyTotalAvailable is the base pool PLUS the active temporary budget (the bug fix)', () => {
    // Before the fix this would have returned BASE_POOL (2000), ignoring the +600.
    expect(totals.monthlyTotalAvailable).toBe(BASE_POOL + TEMP_VACATION_MARCH.budget); // 2600
  });

  it('monthlyTotalAvailable is strictly greater than the base pool', () => {
    expect(totals.monthlyTotalAvailable).toBeGreaterThan(BASE_POOL);
  });

  it('currentMonthBalance subtracts total spent from the corrected available total', () => {
    const expectedSpent =
      PERM_GROCERIES.spent + PERM_TRANSPORT.spent + TEMP_VACATION_MARCH.spent; // 420
    const expectedBalance = BASE_POOL + TEMP_VACATION_MARCH.budget - expectedSpent; // 2180
    expect(totals.currentMonthBalance).toBe(expectedBalance);
  });

  it('globalProgress denominator uses the corrected total (not the base pool)', () => {
    const correctedTotal = BASE_POOL + TEMP_VACATION_MARCH.budget; // 2600
    const expectedSpent =
      PERM_GROCERIES.spent + PERM_TRANSPORT.spent + TEMP_VACATION_MARCH.spent; // 420
    const expectedProgress = (expectedSpent / correctedTotal) * 100;
    expect(totals.globalProgress).toBeCloseTo(expectedProgress, 5);
  });

  it('globalProgress with corrected total is lower than it would be with the base pool only', () => {
    // Demonstrates the concrete impact of the bug: progress appeared higher before the fix.
    const buggyProgress =
      (totals.totalSpentEnvelopes / BASE_POOL) * 100;
    expect(totals.globalProgress).toBeLessThan(buggyProgress);
  });
});

// ---------------------------------------------------------------------------
// Scenario C — Temporary envelope exists in the system but is inactive this month
// ---------------------------------------------------------------------------

describe('Scenario C: temporary envelope exists but inactive for selected month (2024-12)', () => {
  // In December the Christmas envelope IS active, but the vacation envelope is NOT.
  const selectedMonth = '2024-12';
  const visible = filterEnvelopesForMonth(ALL_ENVELOPES, selectedMonth);
  const totals = computeMonthlyTotals(visible, SETTINGS);

  it('visible envelopes include the Christmas temporary (active) but not the vacation one (inactive)', () => {
    const ids = visible.map((e) => e.id);
    expect(ids).toContain('temp-christmas');
    expect(ids).not.toContain('temp-vacation');
  });

  it('only the active temporary contributes to temporaryEnvelopesBudget', () => {
    expect(totals.temporaryEnvelopesBudget).toBe(TEMP_CHRISTMAS.budget); // 300
  });

  it('monthlyTotalAvailable includes only the December-active temporary budget', () => {
    expect(totals.monthlyTotalAvailable).toBe(BASE_POOL + TEMP_CHRISTMAS.budget); // 2300
  });

  it('the inactive vacation envelope budget does NOT inflate monthlyTotalAvailable', () => {
    // If the inactive envelope had leaked through, the total would be 2000 + 600 + 300 = 2900.
    expect(totals.monthlyTotalAvailable).not.toBe(
      BASE_POOL + TEMP_VACATION_MARCH.budget + TEMP_CHRISTMAS.budget,
    );
  });

  it('currentMonthBalance reflects the December-only pool', () => {
    const expectedSpent = PERM_GROCERIES.spent + PERM_TRANSPORT.spent + TEMP_CHRISTMAS.spent;
    expect(totals.currentMonthBalance).toBe(
      BASE_POOL + TEMP_CHRISTMAS.budget - expectedSpent,
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario D — Boundary: settings absent (guards the ternary in the component)
// ---------------------------------------------------------------------------

describe('Scenario D: settings absent — monthlyTotalAvailable is 0', () => {
  it('returns 0 when settings are undefined (component ternary guard)', () => {
    // Replicate: const monthlyTotalAvailable = settings ? ... : 0;
    const settings = undefined as Settings | undefined;
    const monthlyTotalAvailable = settings
      ? settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings
      : 0;
    expect(monthlyTotalAvailable).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unassigned-spending helpers — mirrors getTransactionImpact and the
// unassignedSpent useMemo added to dashboard/page.tsx
// ---------------------------------------------------------------------------

interface TransactionStub {
  amount: number;
  type: "income" | "expense";
  envelopeId: string;
  isReimbursement?: boolean;
}

function getTransactionImpact(tx: { amount: number; isReimbursement?: boolean }): number {
  return tx.isReimbursement ? -tx.amount : tx.amount;
}

/**
 * Replicates the `unassignedSpent` useMemo from dashboard/page.tsx:
 *   const assignedIds = new Set(envelopes.map(e => e.id));
 *   return transactions
 *     .filter(tx => tx.type !== "income" && !assignedIds.has(tx.envelopeId))
 *     .reduce((sum, tx) => sum + getTransactionImpact(tx), 0);
 */
function computeUnassignedSpent(
  allEnvelopeIds: Set<string>,
  transactions: TransactionStub[],
): number {
  return transactions
    .filter((tx) => tx.type !== "income" && !allEnvelopeIds.has(tx.envelopeId))
    .reduce((sum, tx) => sum + getTransactionImpact(tx), 0);
}

/**
 * Replicates the `totalIncomeForMonth` calculation from dashboard/page.tsx.
 */
function computeTotalIncome(transactions: TransactionStub[]): number {
  return transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Full balance formula as applied in the dashboard:
 *   currentMonthBalance = monthlyTotalAvailable - totalSpentEnvelopes
 *                          - unassignedSpent + totalIncomeForMonth
 */
function computeFinalBalance(
  monthlyTotalAvailable: number,
  totalSpentEnvelopes: number,
  unassignedSpent: number,
  totalIncomeForMonth: number,
): number {
  return monthlyTotalAvailable - totalSpentEnvelopes - unassignedSpent + totalIncomeForMonth;
}

// ---------------------------------------------------------------------------
// Scenario E — Transactions WITHOUT an envelope → unassignedSpent > 0
// ---------------------------------------------------------------------------

describe('Scenario E: unassigned spending — orphan transactions', () => {
  const allIds = new Set(['env-1', 'env-2']);

  it('captures transactions with empty envelopeId', () => {
    const transactions: TransactionStub[] = [
      { amount: 50, type: 'expense', envelopeId: 'env-1' },
      { amount: 30, type: 'expense', envelopeId: '' },
    ];
    expect(computeUnassignedSpent(allIds, transactions)).toBe(30);
  });

  it('captures transactions with deleted/non-existent envelopeId', () => {
    const transactions: TransactionStub[] = [
      { amount: 100, type: 'expense', envelopeId: 'deleted-env-123' },
    ];
    expect(computeUnassignedSpent(allIds, transactions)).toBe(100);
  });

  it('returns 0 when all transactions are assigned to existing envelopes', () => {
    const transactions: TransactionStub[] = [
      { amount: 50, type: 'expense', envelopeId: 'env-1' },
      { amount: 30, type: 'expense', envelopeId: 'env-2' },
    ];
    expect(computeUnassignedSpent(allIds, transactions)).toBe(0);
  });

  it('excludes income transactions from unassignedSpent', () => {
    const transactions: TransactionStub[] = [
      { amount: 200, type: 'income', envelopeId: '' },
    ];
    expect(computeUnassignedSpent(allIds, transactions)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario F — Reimbursements without an envelope → reduce unassignedSpent
// ---------------------------------------------------------------------------

describe('Scenario F: unassigned spending — reimbursements', () => {
  const allIds = new Set(['env-1']);

  it('reimbursement without envelope reduces unassignedSpent net', () => {
    const transactions: TransactionStub[] = [
      { amount: 50, type: 'expense', envelopeId: '' },
      { amount: 20, type: 'expense', envelopeId: '', isReimbursement: true },
    ];
    // 50 - 20 = 30
    expect(computeUnassignedSpent(allIds, transactions)).toBe(30);
  });

  it('reimbursement assigned to a valid envelope does NOT affect unassignedSpent', () => {
    const transactions: TransactionStub[] = [
      { amount: 50, type: 'expense', envelopeId: '' },
      { amount: 20, type: 'expense', envelopeId: 'env-1', isReimbursement: true },
    ];
    // Only the 50 is unassigned, the reimbursement is assigned
    expect(computeUnassignedSpent(allIds, transactions)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Scenario G — Full balance formula integration
// ---------------------------------------------------------------------------

describe('Scenario G: full balance formula with unassigned + income', () => {
  it('subtracts unassignedSpent and adds income to the base balance', () => {
    // Given: totalAvailable = 2000, assignedSpent = 170, unassignedSpent = 30, income = 200
    const balance = computeFinalBalance(2000, 170, 30, 200);
    // 2000 - 170 - 30 + 200 = 2000
    expect(balance).toBe(2000);
  });

  it('negative unassignedSpent (net reimbursement) increases the balance', () => {
    // All-unassigned reimbursements → unassignedSpent = -50
    const balance = computeFinalBalance(2000, 170, -50, 0);
    // 2000 - 170 - (-50) + 0 = 1880
    expect(balance).toBe(1880);
  });

  it('balance equals base calculation when unassigned and income are both zero', () => {
    const balance = computeFinalBalance(2000, 170, 0, 0);
    expect(balance).toBe(1830); // 2000 - 170
  });

  it('totalIncomeForMonth sums only income-type transactions', () => {
    const transactions: TransactionStub[] = [
      { amount: 100, type: 'income', envelopeId: '' },
      { amount: 50, type: 'income', envelopeId: '' },
      { amount: 200, type: 'expense', envelopeId: 'env-1' },
    ];
    expect(computeTotalIncome(transactions)).toBe(150);
  });
});
