import {
  MAX_VERSION_COUNT,
  SENTINEL_START_DATE,
  applyBudgetOperation,
  applyBudgetOperationToTimeline,
  buildAmountChangePatch,
  dayBefore,
  dayFromTimestamp,
  flatBudgetStateFrom,
  isValidDayString,
  lastDayOfMonth,
  resolveBudgetValuesForMonth,
  resolveMonthlyIncomeFromHistory,
  resolveVersion,
  resolveVersionAmount,
  resolveVersionAmountOnDay,
  settingsPatchFromMutation,
  timelineFor,
  todayDayString,
  versionAmount,
} from '@/lib/budgetVersion';
import { sanitizeBudgetVersionHistory } from '@/lib/settingsService';
import { DEFAULT_USER_SETTINGS, type BudgetVersionEntry, type UserSettings } from '@/types/settings';

// ---------------------------------------------------------------------------
// Fabriques
// ---------------------------------------------------------------------------

function settingsWith(overrides: Partial<UserSettings> = {}): UserSettings {
  return { ...DEFAULT_USER_SETTINGS, ...overrides };
}

function version(overrides: Partial<BudgetVersionEntry> = {}): BudgetVersionEntry {
  return {
    id: overrides.id ?? `v-${Math.random().toString(36).slice(2)}`,
    startDate: '2026-10-01',
    endDate: null,
    // `total` prime sur le montant par défaut (histoires charges/épargne).
    ...(overrides.total === undefined ? { amount: 3100 } : {}),
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers de jours
// ---------------------------------------------------------------------------

describe('helpers de jours', () => {
  it('dayBefore franchit les mois et les années', () => {
    expect(dayBefore('2026-10-01')).toBe('2026-09-30');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
    expect(dayBefore('2024-03-01')).toBe('2024-02-29'); // bissextile
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
  });

  it('lastDayOfMonth gère février et les mois de 30/31 jours', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
    expect(lastDayOfMonth('2026-04')).toBe('2026-04-30');
    expect(lastDayOfMonth('2026-10')).toBe('2026-10-31');
    expect(lastDayOfMonth('bad-key')).toBeNull();
    expect(lastDayOfMonth('2026-13')).toBeNull();
  });

  it('isValidDayString rejette les dates impossibles', () => {
    expect(isValidDayString('2026-10-01')).toBe(true);
    expect(isValidDayString('0001-01-01')).toBe(true); // sentinelle
    expect(isValidDayString('2026-02-30')).toBe(false);
    expect(isValidDayString('2026-13-01')).toBe(false);
    expect(isValidDayString('2026-1-01')).toBe(false);
    expect(isValidDayString('')).toBe(false);
    expect(isValidDayString(undefined)).toBe(false);
  });

  it('todayDayString formate en jour local', () => {
    expect(todayDayString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('dayFromTimestamp convertit un createdAt ISO en jour local, sinon null', () => {
    // Ancre de la version initiale : même conversion que `dayString(from:)` iOS.
    expect(dayFromTimestamp('2026-01-10T10:00:00.000Z')).toBe(
      todayDayString(new Date('2026-01-10T10:00:00.000Z')),
    );
    expect(dayFromTimestamp(undefined)).toBeNull();
    expect(dayFromTimestamp(null)).toBeNull();
    expect(dayFromTimestamp('')).toBeNull();
    expect(dayFromTimestamp('pas une date')).toBeNull();
  });

  it('timelineFor lit l\'historique de la catégorie, tableau vide sinon', () => {
    const entry = version({ id: 'v1' });
    expect(timelineFor('income', settingsWith({ incomeHistory: [entry] }))).toEqual([entry]);
    expect(timelineFor('fixedCosts', settingsWith())).toEqual([]);
    expect(timelineFor('savings', settingsWith({ savingsHistory: [entry] }))).toEqual([entry]);
  });
});

// ---------------------------------------------------------------------------
// Lecture : résolution par mois (le bug « +155 € sur les mois passés »)
// ---------------------------------------------------------------------------

describe('resolveVersionAmount — valeur effective par mois', () => {
  it('timeline absente ou vide → repli sur la valeur globale', () => {
    expect(resolveVersionAmount(undefined, 155, '2026-09')).toBe(155);
    expect(resolveVersionAmount([], 155, '2026-09')).toBe(155);
  });

  it('PEA arrêté au 01/10 : septembre garde 155, octobre passe à 0,001', () => {
    // État réel après l\'édition iOS : version initiale (155) close la veille,
    // nouvelle version (0,001) ouverte à partir du 01/10.
    const history: BudgetVersionEntry[] = [
      version({ id: 'initial', startDate: SENTINEL_START_DATE, endDate: '2026-09-30', total: 155 }),
      version({ id: 'stop', startDate: '2026-10-01', endDate: null, total: 0.001 }),
    ];

    expect(resolveVersionAmount(history, 0.001, '2026-08')).toBe(155);
    expect(resolveVersionAmount(history, 0.001, '2026-09')).toBe(155);
    expect(resolveVersionAmount(history, 0.001, '2026-10')).toBe(0.001);
    expect(resolveVersionAmount(history, 0.001, '2026-11')).toBe(0.001);
  });

  it('la résolution se fait le dernier jour du mois', () => {
    const history: BudgetVersionEntry[] = [
      version({ id: 'a', startDate: '2026-10-01', endDate: '2026-10-29', amount: 100 }),
      version({ id: 'b', startDate: '2026-10-30', endDate: null, amount: 200 }),
    ];
    // Le 31/10 est couvert par « b » → la valeur du mois est 200.
    expect(resolveVersionAmount(history, 0, '2026-10')).toBe(200);

    const nextMonthOnly: BudgetVersionEntry[] = [
      version({ id: 'c', startDate: '2026-11-01', endDate: null, amount: 300 }),
    ];
    // Octobre n'est couvert par aucune version : il prend la version connue la
    // plus proche (la plus ancienne), pas le flat — celui-ci reflète la valeur
    // active aujourd'hui et projetterait le présent dans le passé.
    expect(resolveVersionAmount(nextMonthOnly, 42, '2026-10')).toBe(300);
  });

  it('trou dans la timeline → la version précédente pour ce mois', () => {
    const history: BudgetVersionEntry[] = [
      version({ id: 'a', startDate: '2026-01-01', endDate: '2026-05-31', total: 100 }),
      version({ id: 'b', startDate: '2026-07-01', endDate: null, total: 300 }),
    ];
    expect(resolveVersionAmount(history, 999, '2026-06')).toBe(100);
    expect(resolveVersionAmount(history, 999, '2026-07')).toBe(300);
  });

  it('resolveVersion choisit la version la plus récente qui couvre le jour', () => {
    const history: BudgetVersionEntry[] = [
      version({ id: 'ancienne', startDate: '2026-01-01', endDate: null, amount: 1 }),
      version({ id: 'recente', startDate: '2026-06-01', endDate: null, amount: 2 }),
    ];
    expect(resolveVersion(history, '2026-07-15')?.id).toBe('recente');
    expect(resolveVersion(history, '2025-12-31')).toBeNull();
    expect(resolveVersion(undefined, '2026-07-15')).toBeNull();
  });

  it('versionAmount lit amount puis total', () => {
    expect(versionAmount(version({ amount: 3100, total: undefined }))).toBe(3100);
    expect(versionAmount(version({ amount: undefined, total: 155 }))).toBe(155);
    expect(versionAmount(version({ amount: undefined, total: undefined }))).toBe(0);
  });

  it('resolveBudgetValuesForMonth résout charges fixes et épargne séparément', () => {
    const settings = settingsWith({
      fixedCosts: 900,
      monthlySavings: 0.001,
      monthlyIncome: 3100,
      savingsHistory: [
        version({ startDate: SENTINEL_START_DATE, endDate: '2026-09-30', total: 155 }),
        version({ startDate: '2026-10-01', endDate: null, total: 0.001 }),
      ],
    });

    expect(resolveBudgetValuesForMonth('2026-09', settings)).toEqual({
      fixedCosts: 900,
      monthlySavings: 155,
    });
    expect(resolveBudgetValuesForMonth('2026-10', settings).monthlySavings).toBe(0.001);
  });

  it('resolveMonthlyIncomeFromHistory ne s\'applique qu\'au revenu fixe', () => {
    const settings = settingsWith({
      monthlyIncome: 3100,
      incomeHistory: [
        version({ startDate: SENTINEL_START_DATE, endDate: '2026-10-09', amount: 3060 }),
        version({ startDate: '2026-10-10', endDate: null, amount: 3100 }),
      ],
    });
    expect(resolveMonthlyIncomeFromHistory('2026-09', settings)).toBe(3060);
    expect(resolveMonthlyIncomeFromHistory('2026-10', settings)).toBe(3100);
    expect(resolveMonthlyIncomeFromHistory('2026-11', settings)).toBe(3100);
  });
});

// ---------------------------------------------------------------------------
// Lecture au jour exact (période de mois budgétaire personnalisé)
// ---------------------------------------------------------------------------

describe('resolveVersionAmountOnDay — résolution au jour exact', () => {
  it('timeline absente ou vide → repli sur la valeur globale', () => {
    expect(resolveVersionAmountOnDay(undefined, 155, '2026-10-04')).toBe(155);
    expect(resolveVersionAmountOnDay([], 155, '2026-10-04')).toBe(155);
  });

  it('lacune → version précédente ; avant l\'historique → la plus ancienne', () => {
    const history: BudgetVersionEntry[] = [
      version({ id: 'a', startDate: '2026-01-01', endDate: '2026-03-31', total: 1000 }),
      version({ id: 'b', startDate: '2026-07-01', endDate: null, total: 1200 }),
    ];
    // Pendant la lacune (avril → juin) : la version précédente.
    expect(resolveVersionAmountOnDay(history, 999, '2026-05-15')).toBe(1000);
    // Avant toute version : la plus ancienne connue, jamais le flat.
    expect(resolveVersionAmountOnDay(history, 999, '2025-12-31')).toBe(1000);
    // Couvert.
    expect(resolveVersionAmountOnDay(history, 999, '2026-08-01')).toBe(1200);
  });

  it('mois budgétaire personnalisé : le 01/10 appartient encore à la période « 2026-09 »', () => {
    // Jour de paie au 5 : la période « 2026-09 » va du 05/09 au 04/10 inclus.
    // Le dernier jour calendaire (30/09) manquerait le changement du 01/10.
    const history: BudgetVersionEntry[] = [
      version({ id: 'plein', startDate: '2026-01-01', endDate: '2026-09-30', total: 155 }),
      version({ id: 'zero', startDate: '2026-10-01', endDate: null, total: 0 }),
    ];
    expect(resolveVersionAmountOnDay(history, 0, '2026-10-04')).toBe(0);
    expect(resolveVersionAmountOnDay(history, 0, '2026-10-05')).toBe(0);
    // Le 04/09 (fin de la période « 2026-08 ») est encore sur l'ancienne.
    expect(resolveVersionAmountOnDay(history, 0, '2026-09-04')).toBe(155);
  });

  it('historique ancré tard : les mois antérieurs gardent leur valeur, pas le flat', () => {
    // Cas constaté : une seule version [2026-09-28 → ∞] = 155 et un flat déjà
    // à 0 (valeur active aujourd'hui) affichaient 0 sur tous les mois passés.
    const history: BudgetVersionEntry[] = [
      version({ id: 'pea', startDate: '2026-09-28', endDate: null, total: 155 }),
    ];
    expect(resolveVersionAmountOnDay(history, 0, '2026-06-30')).toBe(155);
    expect(resolveVersionAmountOnDay(history, 0, '2026-09-27')).toBe(155);
    expect(resolveVersionAmountOnDay(history, 0, '2026-10-31')).toBe(155);
  });
});

// ---------------------------------------------------------------------------
// Écriture : application d'une opération (miroir du moteur iOS)
// ---------------------------------------------------------------------------

describe('applyBudgetOperation — setAmount', () => {
  it('première modification datée : matérialise la version « avant » + la nouvelle', () => {
    const settings = settingsWith({ monthlyIncome: 3060, incomeHistory: [] });
    const result = applyBudgetOperation(
      { kind: 'setAmount', value: 3100 },
      'income',
      '2026-10-10',
      settings,
      '2026-10-10',
    );

    expect(result.isNoOp).toBe(false);
    expect(result.flatAmount).toBe(3100);
    expect(result.history).toHaveLength(2);

    const [initial, changed] = result.history;
    expect(initial.startDate).toBe(SENTINEL_START_DATE);
    expect(initial.endDate).toBe('2026-10-09');
    expect(versionAmount(initial)).toBe(3060);
    expect(changed.startDate).toBe('2026-10-10');
    expect(changed.endDate).toBeNull();
    expect(versionAmount(changed)).toBe(3100);

    // Les mois passés conservent l'ancienne valeur.
    expect(resolveVersionAmount(result.history, 3100, '2026-09')).toBe(3060);
    expect(resolveVersionAmount(result.history, 3100, '2026-10')).toBe(3100);
  });

  it('ancre la version initiale sur la sentinelle « depuis le début »', () => {
    // Sans date de création connue côté web, l'état « avant » est ancré sur la
    // sentinelle (jour 0) — même repli que le moteur iOS quand createdAt est nil.
    const settings = settingsWith({ monthlySavings: 155, savingsHistory: [] });
    const flat = flatBudgetStateFrom(settings, '2026-03-15');
    expect(flat.earliestKnownDate).toBe('2026-03-15');
    expect(flatBudgetStateFrom(settings).earliestKnownDate).toBeNull();

    const result = applyBudgetOperation({ kind: 'setAmount', value: 0 }, 'savings', '2026-10-01', settings, '2026-10-01');
    expect(result.history[0].startDate).toBe(SENTINEL_START_DATE);
    expect(result.history[0].endDate).toBe('2026-09-30');
    expect(versionAmount(result.history[0])).toBe(155);
  });

  it('applyBudgetOperationToTimeline ancre la version initiale sur createdAt', () => {
    // Chemin des écritures Firestore (settingsService.saveBudgetOperation) :
    // la timeline et l'état plat sont fournis séparément, avec l'ancre
    // `createdAt` du document — contrat identique à
    // `BudgetVersionMutationService.flatState` côté iOS.
    const settings = settingsWith({ monthlySavings: 155, savingsHistory: [] });
    const result = applyBudgetOperationToTimeline(
      { kind: 'setAmount', value: 0 },
      'savings',
      '2026-10-01',
      timelineFor('savings', settings),
      flatBudgetStateFrom(settings, '2026-01-10'),
      '2026-10-01',
    );

    expect(result.history[0].startDate).toBe('2026-01-10');
    expect(result.history[0].endDate).toBe('2026-09-30');
    expect(result.flatAmount).toBe(0);
    // Les mois passés gardent 155 € — c'est le correctif du « +155 € partout ».
    expect(resolveVersionAmount(result.history, 0, '2026-09')).toBe(155);
    expect(resolveVersionAmount(result.history, 0, '2026-10')).toBe(0);
  });

  it('splice dans une timeline existante : clôt la version couvrante la veille', () => {
    const settings = settingsWith({
      monthlyIncome: 3060,
      incomeHistory: [version({ id: 'unique', startDate: SENTINEL_START_DATE, endDate: null, amount: 3060 })],
    });
    const result = applyBudgetOperation(
      { kind: 'setAmount', value: 3100 },
      'income',
      '2026-10-10',
      settings,
      '2026-10-10',
    );

    expect(result.history).toHaveLength(2);
    expect(result.history[0].id).toBe('unique');
    expect(result.history[0].endDate).toBe('2026-10-09');
    expect(result.history[1].startDate).toBe('2026-10-10');
    expect(result.history[1].endDate).toBeNull();
  });

  it('changement futur : les flats restent sur la valeur active aujourd\'hui', () => {
    const settings = settingsWith({
      monthlyIncome: 3060,
      incomeHistory: [version({ id: 'unique', startDate: SENTINEL_START_DATE, endDate: null, amount: 3060 })],
    });
    const result = applyBudgetOperation(
      { kind: 'setAmount', value: 3100 },
      'income',
      '2026-12-01', // dans le futur
      settings,
      '2026-10-11',
    );

    expect(result.flatAmount).toBe(3060); // la version active aujourd'hui
    expect(result.history).toHaveLength(2);
    expect(resolveVersionAmount(result.history, 3060, '2026-12')).toBe(3100);
  });

  it('no-op quand la valeur active est déjà la valeur voulue', () => {
    const settings = settingsWith({
      monthlyIncome: 3100,
      incomeHistory: [version({ startDate: SENTINEL_START_DATE, endDate: null, amount: 3100 })],
    });
    const result = applyBudgetOperation({ kind: 'setAmount', value: 3100 }, 'income', '2026-10-11', settings);
    expect(result.isNoOp).toBe(true);
    expect(result.history).toEqual(settings.incomeHistory);
  });

  it('sans historique, une saisie égale au flat est un no-op', () => {
    const settings = settingsWith({ fixedCosts: 900, fixedCostsHistory: [] });
    const result = applyBudgetOperation({ kind: 'setAmount', value: 900 }, 'fixedCosts', '2026-10-11', settings);
    expect(result.isNoOp).toBe(true);
    expect(result.history).toEqual([]);
  });

  it('charges fixes : monter la valeur globale sort du mode détaillé sans perdre les postes', () => {
    const settings = settingsWith({
      fixedCosts: 900,
      fixedCostsDetailedEnabled: true,
      fixedCostsItems: [
        { id: 'loyer', name: 'Loyer', amount: 700 },
        { id: 'net', name: 'Internet', amount: 200 },
      ],
      fixedCostsHistory: [],
    });
    const result = applyBudgetOperation({ kind: 'setAmount', value: 950 }, 'fixedCosts', '2026-10-11', settings);

    expect(result.flatAmount).toBe(950);
    expect(result.flatDetailedEnabled).toBe(false);
    expect(result.flatItems).toHaveLength(2); // invariant : aucune perte de données
  });

  it('revenu : les opérations de poste sont refusées (no-op)', () => {
    const settings = settingsWith({ monthlyIncome: 3060, incomeHistory: [] });
    const result = applyBudgetOperation(
      { kind: 'setDetailedEnabled', enabled: true },
      'income',
      '2026-10-11',
      settings,
    );
    expect(result.isNoOp).toBe(true);
  });

  it('jour d\'effet invalide → no-op', () => {
    const settings = settingsWith({ monthlyIncome: 3060, incomeHistory: [] });
    expect(applyBudgetOperation({ kind: 'setAmount', value: 1 }, 'income', '2026-02-30', settings).isNoOp).toBe(true);
  });
});

describe('applyBudgetOperation — mode détaillé et postes', () => {
  const detailedSettings = () =>
    settingsWith({
      savingsItems: [
        { id: 'pea', name: 'PEA', amount: 155 },
        { id: 'livret', name: 'Livret A', amount: 45 },
      ],
      savingsDetailedEnabled: false,
      monthlySavings: 200,
      savingsHistory: [],
    });

  it('activer le mode détaillé fige le total = somme des postes', () => {
    const result = applyBudgetOperation(
      { kind: 'setDetailedEnabled', enabled: true },
      'savings',
      '2026-10-11',
      detailedSettings(),
    );
    expect(result.isNoOp).toBe(false);
    expect(result.flatAmount).toBe(200);
    expect(result.flatDetailedEnabled).toBe(true);
    expect(result.flatItems).toHaveLength(2);
  });

  it('activer sans poste → no-op (invariant : pas de mode détaillé vide)', () => {
    const settings = settingsWith({ savingsItems: [], savingsHistory: [] });
    const result = applyBudgetOperation({ kind: 'setDetailedEnabled', enabled: true }, 'savings', '2026-10-11', settings);
    expect(result.isNoOp).toBe(true);
  });

  it('replaceContent remplace le snapshot et normalise l\'ordre', () => {
    const result = applyBudgetOperation(
      {
        kind: 'replaceContent',
        total: 155,
        detailedEnabled: true,
        items: [
          { id: 'pea', name: 'PEA', amount: 155 },
          { id: 'vide', name: 'Ancien PEA', amount: 0 },
        ],
      },
      'savings',
      '2026-10-01',
      detailedSettings(),
    );

    expect(result.flatAmount).toBe(155);
    expect(result.flatItems?.map((item) => item.order)).toEqual([0, 1]);
    expect(result.flatItems?.[1].amount).toBe(0); // un poste à 0 reste présent
  });
});

describe('applyBudgetOperation — bornes de la timeline', () => {
  it('fusionne deux versions adjacentes identiques (coalesce)', () => {
    const settings = settingsWith({
      monthlyIncome: 3060,
      incomeHistory: [
        version({ id: 'a', startDate: SENTINEL_START_DATE, endDate: '2026-10-09', amount: 3060 }),
        version({ id: 'b', startDate: '2026-10-10', endDate: null, amount: 3060 }),
      ],
    });
    // Re-saisir la même valeur depuis une date ultérieure fusionne au lieu d'empiler.
    const result = applyBudgetOperation({ kind: 'setAmount', value: 3060 }, 'income', '2026-10-11', settings, '2026-10-11');
    expect(result.history.length).toBeLessThanOrEqual(2);
    expect(resolveVersionAmount(result.history, 3060, '2026-09')).toBe(3060);
  });

  it('plafonne la timeline à MAX_VERSION_COUNT entrées', () => {
    const history: BudgetVersionEntry[] = Array.from({ length: MAX_VERSION_COUNT }, (_, index) =>
      version({
        id: `v${index}`,
        startDate: `20${String(20 + Math.floor(index / 12)).padStart(2, '0')}-${String((index % 12) + 1).padStart(2, '0')}-01`,
        endDate: null,
        amount: 1000 + index,
      }),
    );
    const settings = settingsWith({ monthlyIncome: 3060, incomeHistory: history });
    const result = applyBudgetOperation({ kind: 'setAmount', value: 3100 }, 'income', '2026-12-01', settings, '2026-12-01');
    expect(result.history.length).toBeLessThanOrEqual(MAX_VERSION_COUNT);
  });
});

describe('applyBudgetOperation — édition antidatée avant l\'historique', () => {
  const fixedCostsItems = [
    { id: 'loyer', name: 'Crédit', amount: 1650 },
    { id: 'assurance', name: 'Assurance', amount: 45 },
  ];

  it('reprend la version connue, pas les valeurs du jour', () => {
    // Compte créé la veille du premier changement : la timeline ne commence
    // qu'au 30/06 alors que l'édition est datée du 01/06. Les flats portent
    // les valeurs d'aujourd'hui (1 650 €) et ne doivent pas être injectés
    // dans le passé — l'historique se décalait alors d'une ligne.
    const settings = settingsWith({
      fixedCosts: 1695,
      fixedCostsDetailedEnabled: true,
      fixedCostsItems,
      fixedCostsHistory: [
        version({
          id: 'a',
          startDate: '2026-06-30',
          endDate: '2026-06-30',
          total: 1695,
          detailedEnabled: true,
          items: [
            { id: 'loyer', name: 'Crédit', amount: 650 },
            { id: 'assurance', name: 'Assurance', amount: 45 },
          ],
        }),
        version({
          id: 'b',
          startDate: '2026-07-01',
          endDate: null,
          total: 1695,
          detailedEnabled: true,
          items: fixedCostsItems,
        }),
      ],
    });

    const result = applyBudgetOperation(
      { kind: 'setAmount', value: 795 },
      'fixedCosts',
      '2026-06-01',
      settings,
      '2026-10-11',
    );

    const inserted = result.history.find((entry) => entry.startDate === '2026-06-01');
    expect(inserted?.items?.map((item) => item.amount)).toEqual([650, 45]);
  });

  it('lacune dans la timeline : reprend la version qui précède la lacune', () => {
    const settings = settingsWith({
      fixedCosts: 1695,
      fixedCostsDetailedEnabled: true,
      fixedCostsItems,
      fixedCostsHistory: [
        version({
          id: 'a',
          startDate: '2024-01-01',
          endDate: '2026-03-31',
          total: 695,
          detailedEnabled: true,
          items: [
            { id: 'loyer', name: 'Crédit', amount: 650 },
            { id: 'assurance', name: 'Assurance', amount: 45 },
          ],
        }),
        version({
          id: 'b',
          startDate: '2026-08-01',
          endDate: null,
          total: 1695,
          detailedEnabled: true,
          items: fixedCostsItems,
        }),
      ],
    });

    const result = applyBudgetOperation(
      { kind: 'setAmount', value: 795 },
      'fixedCosts',
      '2026-06-01',
      settings,
      '2026-10-11',
    );

    const inserted = result.history.find((entry) => entry.startDate === '2026-06-01');
    expect(inserted?.items?.map((item) => item.amount)).toEqual([650, 45]);
  });
});

// ---------------------------------------------------------------------------
// Patch Firestore
// ---------------------------------------------------------------------------

describe('settingsPatchFromMutation / buildAmountChangePatch', () => {
  it('revenu : historique + valeur globale seulement', () => {
    const settings = settingsWith({ monthlyIncome: 3060, incomeHistory: [] });
    const patch = buildAmountChangePatch('income', 3100, settings, '2026-10-10');
    expect(patch).not.toBeNull();
    expect(patch?.monthlyIncome).toBe(3100);
    expect(patch?.incomeHistory).toHaveLength(2);
    expect(patch?.fixedCostsHistory).toBeUndefined();
  });

  it('épargne : inclut le drapeau détaillé et les postes', () => {
    const settings = settingsWith({ monthlySavings: 155, savingsHistory: [] });
    const applied = applyBudgetOperation({ kind: 'setAmount', value: 0 }, 'savings', '2026-10-01', settings);
    const patch = settingsPatchFromMutation(applied, 'savings');
    expect(patch.monthlySavings).toBe(0);
    expect(patch.savingsDetailedEnabled).toBe(false);
    expect(patch.savingsItems).toEqual([]);
    expect(patch.savingsHistory).toHaveLength(2);
  });

  it('no-op → aucun patch (pas d\'écriture inutile)', () => {
    const settings = settingsWith({ monthlyIncome: 3100, incomeHistory: [] });
    expect(buildAmountChangePatch('income', 3100, settings, '2026-10-11')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rétrocompatibilité : ce que le web écrit doit être relisible (et passer les règles)
// ---------------------------------------------------------------------------

describe('les versions produites survivent à la sanitisation Firestore', () => {
  it('aller-retour applyBudgetOperation → sanitizeBudgetVersionHistory', () => {
    const settings = settingsWith({
      monthlyIncome: 3060,
      monthlySavings: 155,
      savingsHistory: [],
      incomeHistory: [],
    });

    const income = applyBudgetOperation({ kind: 'setAmount', value: 3100 }, 'income', '2026-10-10', settings);
    const savings = applyBudgetOperation({ kind: 'setAmount', value: 0 }, 'savings', '2026-10-01', settings);

    const sanitizedIncome = sanitizeBudgetVersionHistory(income.history);
    const sanitizedSavings = sanitizeBudgetVersionHistory(savings.history);

    expect(sanitizedIncome).toHaveLength(income.history.length);
    expect(sanitizedSavings).toHaveLength(savings.history.length);
    // La sentinelle et les montants nuls sont acceptés par la sanitisation.
    expect(sanitizedIncome[0].startDate).toBe(SENTINEL_START_DATE);
    expect(sanitizedSavings[0].total).toBe(155);
    expect(sanitizedSavings[1].total).toBe(0);
  });

  it('un document écrit par un ancien client reste lisible (aucun champ requis ajouté)', () => {
    // Le web n\'ajoute que des champs déjà optionnels : un doc sans historiques
    // continue de se charger et de se résoudre sur les valeurs globales.
    const legacy = settingsWith({ monthlyIncome: 3060, monthlySavings: 155 });
    expect(resolveBudgetValuesForMonth('2026-09', legacy).monthlySavings).toBe(155);
    expect(resolveMonthlyIncomeFromHistory('2026-09', legacy)).toBe(3060);
  });
});
