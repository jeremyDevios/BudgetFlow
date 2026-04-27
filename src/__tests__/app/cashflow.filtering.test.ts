/**
 * Regression tests for the Cash Flow view's temporary-envelope filtering.
 *
 * Bug: temporary envelopes must NOT appear in or affect the Cash Flow
 * Sankey chart or its derived totals (totalAllocated, unallocated).
 *
 * The production code in src/app/(protected)/cashflow/page.tsx applies:
 *
 *   const envList = rawEnvelopes.filter(env => !env.isTemporary);
 *
 * and then builds:
 *   • Sankey nodes  (index 0–2 are fixed; 3+ are envelope nodes)
 *   • Sankey links  (source 0 → target 3+index for every envelope with budget > 0)
 *   • totalAllocated = savings + fixedCosts + Σ envelope.budget
 *   • unallocated    = monthlyIncome - totalAllocated
 *
 * These tests duplicate that logic as pure functions so they run without
 * Firebase / Next.js at all.
 */

// ---------------------------------------------------------------------------
// Types — mirrors the local interface in cashflow/page.tsx
// ---------------------------------------------------------------------------

interface CashFlowEnvelope {
  id: string;
  name: string;
  budget: number;
  color: string;
  isTemporary?: boolean;
}

interface UserSettings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
}

// ---------------------------------------------------------------------------
// Pure helpers — exact replicas of the logic in cashflow/page.tsx
// ---------------------------------------------------------------------------

/**
 * Applies the Cash Flow filter: keeps only non-temporary envelopes.
 * Mirrors: envSnap.docs.map(...).filter(env => !env.isTemporary)
 */
function filterForCashFlow(envelopes: CashFlowEnvelope[]): CashFlowEnvelope[] {
  return envelopes.filter(env => !env.isTemporary);
}

interface SankeyNode {
  name: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Builds the Sankey { nodes, links } structure.
 * Mirrors the node/link construction block in cashflow/page.tsx.
 * Receives the ALREADY-FILTERED envelope list.
 */
function buildSankeyData(
  envelopes: CashFlowEnvelope[],
  settings: UserSettings,
): SankeyData {
  const nodes: SankeyNode[] = [
    { name: 'Revenu' },      // index 0
    { name: 'Épargne' },     // index 1
    { name: 'Frais Fixes' }, // index 2
    ...envelopes.map(e => ({ name: e.name })),
  ];

  const links: SankeyLink[] = [];

  if (settings.monthlySavings > 0) {
    links.push({ source: 0, target: 1, value: settings.monthlySavings });
  }

  if (settings.fixedCosts > 0) {
    links.push({ source: 0, target: 2, value: settings.fixedCosts });
  }

  envelopes.forEach((env, index) => {
    if (env.budget > 0) {
      links.push({ source: 0, target: 3 + index, value: env.budget });
    }
  });

  return { nodes, links };
}

/**
 * Computes totalAllocated and unallocated.
 * Mirrors the calculation block in cashflow/page.tsx.
 * Receives the ALREADY-FILTERED envelope list.
 */
function computeAllocation(
  envelopes: CashFlowEnvelope[],
  settings: UserSettings,
): { totalAllocated: number; unallocated: number } {
  const totalAllocated =
    (settings.monthlySavings || 0) +
    (settings.fixedCosts || 0) +
    envelopes.reduce((acc, curr) => acc + curr.budget, 0);
  const unallocated = settings.monthlyIncome - totalAllocated;
  return { totalAllocated, unallocated };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PERM_GROCERIES: CashFlowEnvelope = {
  id: 'perm-1',
  name: 'Courses',
  budget: 400,
  color: 'bg-amber-500',
  isTemporary: false,
};

const PERM_TRANSPORT: CashFlowEnvelope = {
  id: 'perm-2',
  name: 'Transport',
  budget: 150,
  color: 'bg-blue-500',
  // isTemporary intentionally absent → treated as permanent
};

const PERM_ZERO_BUDGET: CashFlowEnvelope = {
  id: 'perm-3',
  name: 'Divers',
  budget: 0,
  color: 'bg-zinc-500',
  isTemporary: false,
};

const TEMP_HOLIDAY: CashFlowEnvelope = {
  id: 'temp-1',
  name: 'Vacances',
  budget: 800,
  color: 'bg-green-500',
  isTemporary: true,
};

const TEMP_CHRISTMAS: CashFlowEnvelope = {
  id: 'temp-2',
  name: 'Noël',
  budget: 300,
  color: 'bg-red-500',
  isTemporary: true,
};

const TEMP_ZERO_BUDGET: CashFlowEnvelope = {
  id: 'temp-3',
  name: 'Projet zéro',
  budget: 0,
  color: 'bg-purple-500',
  isTemporary: true,
};

const ALL_ENVELOPES: CashFlowEnvelope[] = [
  PERM_GROCERIES,
  PERM_TRANSPORT,
  PERM_ZERO_BUDGET,
  TEMP_HOLIDAY,
  TEMP_CHRISTMAS,
  TEMP_ZERO_BUDGET,
];

const BASE_SETTINGS: UserSettings = {
  monthlyIncome: 3000,
  fixedCosts: 900,
  monthlySavings: 200,
};

// ---------------------------------------------------------------------------
// 1. filterForCashFlow — the core regression guard
// ---------------------------------------------------------------------------

describe('Cash Flow: filterForCashFlow', () => {
  describe('excludes temporary envelopes', () => {
    it('removes an envelope with isTemporary: true', () => {
      const result = filterForCashFlow([TEMP_HOLIDAY]);
      expect(result).toHaveLength(0);
    });

    it('removes all temporary envelopes from a mixed list', () => {
      const result = filterForCashFlow(ALL_ENVELOPES);
      const ids = result.map(e => e.id);
      expect(ids).not.toContain('temp-1');
      expect(ids).not.toContain('temp-2');
      expect(ids).not.toContain('temp-3');
    });

    it('removes a temporary envelope with a zero budget', () => {
      const result = filterForCashFlow([TEMP_ZERO_BUDGET]);
      expect(result).toHaveLength(0);
    });
  });

  describe('retains permanent envelopes', () => {
    it('keeps an envelope with isTemporary: false', () => {
      const result = filterForCashFlow([PERM_GROCERIES]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('perm-1');
    });

    it('keeps an envelope where isTemporary is absent (undefined)', () => {
      const result = filterForCashFlow([PERM_TRANSPORT]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('perm-2');
    });

    it('keeps a permanent envelope with a zero budget', () => {
      const result = filterForCashFlow([PERM_ZERO_BUDGET]);
      expect(result).toHaveLength(1);
    });

    it('keeps all permanent envelopes from a mixed list', () => {
      const result = filterForCashFlow(ALL_ENVELOPES);
      const ids = result.map(e => e.id);
      expect(ids).toContain('perm-1');
      expect(ids).toContain('perm-2');
      expect(ids).toContain('perm-3');
    });
  });

  describe('edge cases', () => {
    it('returns an empty array when all envelopes are temporary', () => {
      expect(filterForCashFlow([TEMP_HOLIDAY, TEMP_CHRISTMAS])).toHaveLength(0);
    });

    it('returns the full list when no envelopes are temporary', () => {
      const permanents = [PERM_GROCERIES, PERM_TRANSPORT];
      expect(filterForCashFlow(permanents)).toHaveLength(2);
    });

    it('returns an empty array for an empty input', () => {
      expect(filterForCashFlow([])).toHaveLength(0);
    });

    it('returns exactly 3 entries from a 6-envelope mixed list (3 perm + 3 temp)', () => {
      expect(filterForCashFlow(ALL_ENVELOPES)).toHaveLength(3);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Sankey nodes — temporary envelopes must not appear as nodes
// ---------------------------------------------------------------------------

describe('Cash Flow: Sankey nodes', () => {
  it('includes exactly 3 fixed header nodes when there are no envelopes', () => {
    const { nodes } = buildSankeyData([], BASE_SETTINGS);
    expect(nodes).toHaveLength(3);
    expect(nodes[0].name).toBe('Revenu');
    expect(nodes[1].name).toBe('Épargne');
    expect(nodes[2].name).toBe('Frais Fixes');
  });

  it('adds one node per permanent envelope after the 3 fixed nodes', () => {
    const filtered = filterForCashFlow(ALL_ENVELOPES); // 3 permanent
    const { nodes } = buildSankeyData(filtered, BASE_SETTINGS);
    // 3 fixed + 3 permanent = 6
    expect(nodes).toHaveLength(6);
  });

  it('does not include temporary envelope names in the node list', () => {
    const filtered = filterForCashFlow(ALL_ENVELOPES);
    const { nodes } = buildSankeyData(filtered, BASE_SETTINGS);
    const names = nodes.map(n => n.name);
    expect(names).not.toContain('Vacances');
    expect(names).not.toContain('Noël');
    expect(names).not.toContain('Projet zéro');
  });

  it('includes permanent envelope names in the node list', () => {
    const filtered = filterForCashFlow(ALL_ENVELOPES);
    const { nodes } = buildSankeyData(filtered, BASE_SETTINGS);
    const names = nodes.map(n => n.name);
    expect(names).toContain('Courses');
    expect(names).toContain('Transport');
    expect(names).toContain('Divers');
  });

  it('produces only 3 nodes when the entire unfiltered list is temporary', () => {
    const filtered = filterForCashFlow([TEMP_HOLIDAY, TEMP_CHRISTMAS]);
    const { nodes } = buildSankeyData(filtered, BASE_SETTINGS);
    expect(nodes).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 3. Sankey links — temporary envelope budgets must not become links
// ---------------------------------------------------------------------------

describe('Cash Flow: Sankey links', () => {
  it('creates no envelope links when the filtered list is empty', () => {
    const filtered = filterForCashFlow([TEMP_HOLIDAY, TEMP_CHRISTMAS]);
    const { links } = buildSankeyData(filtered, BASE_SETTINGS);
    // Only savings and fixed-costs links remain
    const envelopeLinks = links.filter(l => l.target >= 3);
    expect(envelopeLinks).toHaveLength(0);
  });

  it('creates one link per permanent envelope that has a budget > 0', () => {
    const filtered = filterForCashFlow([PERM_GROCERIES, PERM_TRANSPORT, PERM_ZERO_BUDGET]);
    const { links } = buildSankeyData(filtered, BASE_SETTINGS);
    // PERM_ZERO_BUDGET has budget 0 → no link; 2 links expected
    const envelopeLinks = links.filter(l => l.target >= 3);
    expect(envelopeLinks).toHaveLength(2);
  });

  it('link values match the permanent envelope budgets', () => {
    const filtered = filterForCashFlow([PERM_GROCERIES, PERM_TRANSPORT]);
    const { links } = buildSankeyData(filtered, BASE_SETTINGS);
    const envelopeLinks = links.filter(l => l.target >= 3);
    const values = envelopeLinks.map(l => l.value);
    expect(values).toContain(400); // Courses
    expect(values).toContain(150); // Transport
  });

  it('does not include a link with the value of a temporary envelope budget', () => {
    const filtered = filterForCashFlow(ALL_ENVELOPES);
    const { links } = buildSankeyData(filtered, BASE_SETTINGS);
    const envelopeLinks = links.filter(l => l.target >= 3);
    const values = envelopeLinks.map(l => l.value);
    expect(values).not.toContain(800); // Vacances (temp)
    expect(values).not.toContain(300); // Noël (temp)
  });

  it('includes savings and fixed-cost links regardless of envelopes', () => {
    const filtered = filterForCashFlow([]);
    const { links } = buildSankeyData(filtered, BASE_SETTINGS);
    expect(links.some(l => l.target === 1 && l.value === 200)).toBe(true); // savings
    expect(links.some(l => l.target === 2 && l.value === 900)).toBe(true); // fixed costs
  });
});

// ---------------------------------------------------------------------------
// 4. totalAllocated — temporary budgets must not inflate the total
// ---------------------------------------------------------------------------

describe('Cash Flow: totalAllocated', () => {
  it('equals savings + fixedCosts + permanent budgets only', () => {
    const filtered = filterForCashFlow(ALL_ENVELOPES);
    const { totalAllocated } = computeAllocation(filtered, BASE_SETTINGS);
    // savings(200) + fixedCosts(900) + Courses(400) + Transport(150) + Divers(0)
    expect(totalAllocated).toBe(1650);
  });

  it('does not include TEMP_HOLIDAY budget (800) in the total', () => {
    const withTemp = [PERM_GROCERIES, TEMP_HOLIDAY];
    const withoutTemp = [PERM_GROCERIES];

    const { totalAllocated: withTempTotal } = computeAllocation(
      filterForCashFlow(withTemp),
      BASE_SETTINGS,
    );
    const { totalAllocated: withoutTempTotal } = computeAllocation(
      filterForCashFlow(withoutTemp),
      BASE_SETTINGS,
    );
    expect(withTempTotal).toBe(withoutTempTotal);
  });

  it('does not include TEMP_CHRISTMAS budget (300) in the total', () => {
    const filtered = filterForCashFlow([PERM_GROCERIES, TEMP_CHRISTMAS]);
    const { totalAllocated } = computeAllocation(filtered, BASE_SETTINGS);
    // savings(200) + fixed(900) + Courses(400) — Noël(300) excluded
    expect(totalAllocated).toBe(1500);
  });

  it('equals savings + fixedCosts when the envelope list is entirely temporary', () => {
    const filtered = filterForCashFlow([TEMP_HOLIDAY, TEMP_CHRISTMAS]);
    const { totalAllocated } = computeAllocation(filtered, BASE_SETTINGS);
    expect(totalAllocated).toBe(200 + 900);
  });

  it('equals savings + fixedCosts when there are no envelopes at all', () => {
    const { totalAllocated } = computeAllocation([], BASE_SETTINGS);
    expect(totalAllocated).toBe(1100);
  });
});

// ---------------------------------------------------------------------------
// 5. unallocated — must not be reduced by temporary envelope budgets
// ---------------------------------------------------------------------------

describe('Cash Flow: unallocated remainder', () => {
  it('is not reduced when a temporary envelope is present', () => {
    const withTemp = filterForCashFlow([PERM_GROCERIES, TEMP_HOLIDAY]);
    const withoutTemp = filterForCashFlow([PERM_GROCERIES]);

    const { unallocated: u1 } = computeAllocation(withTemp, BASE_SETTINGS);
    const { unallocated: u2 } = computeAllocation(withoutTemp, BASE_SETTINGS);
    expect(u1).toBe(u2);
  });

  it('is income minus (savings + fixedCosts + permanent budgets)', () => {
    const filtered = filterForCashFlow(ALL_ENVELOPES);
    const { unallocated } = computeAllocation(filtered, BASE_SETTINGS);
    // income(3000) - totalAllocated(1650)
    expect(unallocated).toBe(1350);
  });

  it('is maximised when all envelopes are temporary (only fixed overheads deducted)', () => {
    const filtered = filterForCashFlow([TEMP_HOLIDAY, TEMP_CHRISTMAS]);
    const { unallocated } = computeAllocation(filtered, BASE_SETTINGS);
    // income(3000) - savings(200) - fixed(900) = 1900
    expect(unallocated).toBe(1900);
  });

  it('can be negative when permanent allocations exceed income', () => {
    const over = computeAllocation(
      [{ id: 'x', name: 'X', budget: 5000, color: '#fff' }],
      { monthlyIncome: 1000, fixedCosts: 0, monthlySavings: 0 },
    );
    expect(over.unallocated).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. End-to-end pipeline — filter → build → compute
// ---------------------------------------------------------------------------

describe('Cash Flow: end-to-end pipeline with mixed envelopes', () => {
  const filtered = filterForCashFlow(ALL_ENVELOPES);
  const { nodes, links } = buildSankeyData(filtered, BASE_SETTINGS);
  const { totalAllocated, unallocated } = computeAllocation(filtered, BASE_SETTINGS);

  it('produces 6 nodes total (3 fixed + 3 permanent)', () => {
    expect(nodes).toHaveLength(6);
  });

  it('produces 4 links (savings + fixedCosts + Courses + Transport; Divers has budget 0)', () => {
    expect(links).toHaveLength(4);
  });

  it('totalAllocated is 1650', () => {
    expect(totalAllocated).toBe(1650);
  });

  it('unallocated is 1350', () => {
    expect(unallocated).toBe(1350);
  });

  it('no node name belongs to a temporary envelope', () => {
    const tempNames = ['Vacances', 'Noël', 'Projet zéro'];
    const nodeNames = nodes.map(n => n.name);
    tempNames.forEach(name => expect(nodeNames).not.toContain(name));
  });

  it('no link value matches a temporary budget', () => {
    const tempBudgets = [800, 300]; // Vacances, Noël
    const linkValues = links.map(l => l.value);
    tempBudgets.forEach(v => expect(linkValues).not.toContain(v));
  });
});
