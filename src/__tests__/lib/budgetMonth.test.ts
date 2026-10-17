import { getMonthBounds } from '@/lib/dateUtils';
import {
  DEFAULT_CUSTOM_MONTH_CONFIG,
  addBudgetPeriods,
  addMonthsToKey,
  budgetMonthKeyForDate,
  budgetPeriod,
  budgetPeriodForDate,
  daysInBudgetPeriod,
  displayDayKeys,
  effectiveStartDay,
  elapsedAndRemainingInBudgetPeriod,
  getCustomMonthConfig,
  isCustomMonthActive,
  sanitizeCustomMonthConfig,
} from '@/lib/budgetMonth';

const custom25 = (): Parameters<typeof budgetPeriod>[1] => ({
  enabled: true,
  startDay: 25,
  overrides: {},
});

// ---------------------------------------------------------------------------
// Identité calendaire : aucune régression quand l'option est inactive
// ---------------------------------------------------------------------------

describe('identité avec le comportement historique (option désactivée)', () => {
  it('budgetPeriod(disabled) === getMonthBounds à la chaîne près, tous mois', () => {
    // 2000-01 → 2001-03 : couvre février (bissextile 2000) et le passage d'année.
    for (let y = 2000; y <= 2001; y++) {
      for (let m = 0; m < 12; m++) {
        const date = new Date(y, m, 15);
        const legacy = getMonthBounds(date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        expect(budgetPeriod(key, DEFAULT_CUSTOM_MONTH_CONFIG)).toEqual(legacy);
      }
    }
  });

  it('budgetPeriod(startDay 1, enabled) === getMonthBounds', () => {
    const config = { enabled: true, startDay: 1, overrides: {} };
    expect(budgetPeriod('2026-03', config)).toEqual(getMonthBounds(new Date(2026, 2, 13)));
    expect(budgetPeriod('2026-02', config)).toEqual(getMonthBounds(new Date(2026, 1, 5)));
  });

  it('budgetMonthKeyForDate(disabled) === slice(0,7) calendaire', () => {
    expect(budgetMonthKeyForDate('2026-10-05')).toBe('2026-10');
    expect(budgetMonthKeyForDate('2026-01-01')).toBe('2026-01');
    expect(budgetMonthKeyForDate('2025-12-31')).toBe('2025-12');
  });

  it('désactivé : jours de période = jours du mois calendaire', () => {
    expect(daysInBudgetPeriod('2026-02')).toBe(28);
    expect(daysInBudgetPeriod('2024-02')).toBe(29);
    expect(daysInBudgetPeriod('2026-03')).toBe(31);
    expect(daysInBudgetPeriod('2026-04')).toBe(30);
  });

  it('désactivé avec jour de paie résiduel : identité calendaire stricte', () => {
    // Régression : l'option décochée conservait le jour 5 stocké et découpait
    // quand même les périodes du 5 au 4 (heatmap grise + dépenses du 2-3 hors
    // dashboard après re-cochage).
    const config = { enabled: false, startDay: 5, overrides: {} };
    expect(budgetPeriod('2026-10', config)).toEqual(getMonthBounds(new Date(2026, 9, 15)));
    expect(budgetPeriod('2026-02', config)).toEqual(getMonthBounds(new Date(2026, 1, 10)));
    expect(budgetPeriod('2026-12', config)).toEqual(getMonthBounds(new Date(2026, 11, 20)));
    expect(effectiveStartDay('2026-10', config)).toBe(1);
    expect(budgetMonthKeyForDate('2026-10-02', config)).toBe('2026-10');
  });

  it('désactivé avec surcharge résiduelle : la surcharge aussi est inopérante', () => {
    const config = { enabled: false, startDay: 5, overrides: { '2026-10': 7 } };
    expect(effectiveStartDay('2026-10', config)).toBe(1);
    expect(budgetMonthKeyForDate('2026-10-02', config)).toBe('2026-10');
  });
});

// ---------------------------------------------------------------------------
// Grille d'affichage (heatmap dashboard + widget)
// ---------------------------------------------------------------------------

describe('displayDayKeys', () => {
  it('jour de paie au 5 : 05/09 → 01/10, période suivante exclue', () => {
    const config = { enabled: true, startDay: 2, overrides: { '2026-09': 5 } };
    const keys = displayDayKeys('2026-09', config);
    expect(keys).toHaveLength(27); // 26 jours de sept. + le 1er oct.
    expect(keys[0]).toBe('2026-09-05');
    expect(keys[keys.length - 1]).toBe('2026-10-01');
    expect(keys).not.toContain('2026-10-02'); // ouvre la grille d'octobre
    expect(keys).not.toContain('2026-09-04'); // veille du jour de paie
  });

  it('mois calendaire (jour global 1) : mois complet', () => {
    const config = { enabled: true, startDay: 1, overrides: { '2026-09': 5 } };
    const october = displayDayKeys('2026-10', config);
    expect(october).toHaveLength(31);
    expect(october[0]).toBe('2026-10-01');
    expect(october[october.length - 1]).toBe('2026-10-31');
    expect(displayDayKeys('2026-02', config)).toHaveLength(28);
  });

  it('option inactive ou jour 1 : [] (repli calendaire chez l’appelant)', () => {
    expect(displayDayKeys('2026-09')).toEqual([]);
    expect(displayDayKeys('2026-09', { enabled: false, startDay: 5, overrides: {} })).toEqual([]);
    expect(displayDayKeys('2026-09', { enabled: true, startDay: 1, overrides: {} })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bornes de période personnalisées
// ---------------------------------------------------------------------------

describe('budgetPeriod — mois démarrant le 25', () => {
  const config = custom25();

  it('octobre 2026 = 25/10 → 24/11 23:59:59', () => {
    expect(budgetPeriod('2026-10', config)).toEqual({
      start: '2026-10-25',
      end: '2026-11-24T23:59:59',
    });
  });

  it('janvier 2027 = 25/01 → 24/02 (pas de décalage d’année côté bornes)', () => {
    expect(budgetPeriod('2027-01', config)).toEqual({
      start: '2027-01-25',
      end: '2027-02-24T23:59:59',
    });
  });

  it('décembre 2026 = 25/12 → 24/01/2027 (fin de période l’année suivante)', () => {
    expect(budgetPeriod('2026-12', config)).toEqual({
      start: '2026-12-25',
      end: '2027-01-24T23:59:59',
    });
  });

  it('février 2026 = 25/02 → 24/03', () => {
    expect(budgetPeriod('2026-02', config)).toEqual({
      start: '2026-02-25',
      end: '2026-03-24T23:59:59',
    });
  });

  it('clamp défensif : startDay 28 en février → 28', () => {
    const config28 = { enabled: true, startDay: 28, overrides: {} };
    expect(budgetPeriod('2024-02', config28)).toEqual({
      start: '2024-02-28',
      end: '2024-03-27T23:59:59',
    });
  });
});

describe('effectiveStartDay', () => {
  it('priorité à la surcharge du mois', () => {
    const config = {
      enabled: true,
      startDay: 25,
      overrides: { '2026-10': 5 },
    };
    expect(effectiveStartDay('2026-10', config)).toBe(5);
    expect(effectiveStartDay('2026-11', config)).toBe(25);
  });

  it('clamp au dernier jour du mois', () => {
    const config = { enabled: true, startDay: 28, overrides: { '2026-02': 31 } };
    // 31 n'est jamais valide en saisie, mais un payload corrompu est clampé.
    expect(effectiveStartDay('2026-02', config)).toBe(28);
  });
});

// ---------------------------------------------------------------------------
// Dérivation date → mois budgétaire
// ---------------------------------------------------------------------------

describe('budgetMonthKeyForDate — jour de paie le 25', () => {
  const config = custom25();

  it('avant le jour de paie → mois budgétaire précédent', () => {
    expect(budgetMonthKeyForDate('2026-10-24', config)).toBe('2026-09');
    expect(budgetMonthKeyForDate('2026-10-01', config)).toBe('2026-09');
  });

  it('à partir du jour de paie → mois budgétaire courant', () => {
    expect(budgetMonthKeyForDate('2026-10-25', config)).toBe('2026-10');
    expect(budgetMonthKeyForDate('2026-10-31', config)).toBe('2026-10');
  });

  it('janvier : avant le jour de paie → décembre de l’année précédente', () => {
    expect(budgetMonthKeyForDate('2026-01-05', config)).toBe('2025-12');
  });

  it('jour de paie le 1er (activé) = clé calendaire', () => {
    const config1 = { enabled: true, startDay: 1, overrides: {} };
    expect(budgetMonthKeyForDate('2026-10-05', config1)).toBe('2026-10');
  });

  it('surcharge mensuelle prise en compte', () => {
    const configOverride = {
      enabled: true,
      startDay: 25,
      overrides: { '2026-10': 5 },
    };
    expect(budgetMonthKeyForDate('2026-10-10', configOverride)).toBe('2026-10');
    expect(budgetMonthKeyForDate('2026-10-02', configOverride)).toBe('2026-09');
  });
});

describe('budgetPeriodForDate', () => {
  it('retourne clé + bornes cohérentes', () => {
    const result = budgetPeriodForDate('2026-10-05', custom25());
    expect(result.key).toBe('2026-09');
    expect(result).toEqual({
      key: '2026-09',
      start: '2026-09-25',
      end: '2026-10-24T23:59:59',
    });
  });
});

// ---------------------------------------------------------------------------
// Navigation et durées
// ---------------------------------------------------------------------------

describe('addBudgetPeriods / addMonthsToKey', () => {
  it('navigue ±1 sur les clés, passage d’année inclus', () => {
    expect(addBudgetPeriods('2026-10', 1)).toBe('2026-11');
    expect(addBudgetPeriods('2026-01', -1)).toBe('2025-12');
    expect(addBudgetPeriods('2025-12', 1)).toBe('2026-01');
    expect(addMonthsToKey('2026-10', 6)).toBe('2027-04');
  });
});

describe('daysInBudgetPeriod / elapsedAndRemainingInBudgetPeriod', () => {
  it('durées réelles de période', () => {
    // 25/10 → 24/11 = 31 jours ; 25/02 → 24/03 = 28 jours (février).
    expect(daysInBudgetPeriod('2026-10', custom25())).toBe(31);
    expect(daysInBudgetPeriod('2026-02', custom25())).toBe(28);
    expect(daysInBudgetPeriod('2026-03', { enabled: true, startDay: 1, overrides: {} })).toBe(31);
  });

  it('élapsé/restant identiques aux sémantiques calendaires quand désactivé', () => {
    // 2026-03-05 : 5 jours écoulés (inclus), 26 restants, total 31.
    expect(elapsedAndRemainingInBudgetPeriod('2026-03', '2026-03-05')).toEqual({
      elapsed: 5,
      remaining: 26,
      total: 31,
    });
  });

  it('élapsé/restant sur une période décalée', () => {
    // Période 25/09 → 24/10 (mois budgétaire 2026-09), le 05/10 :
    // 11 jours écoulés, 19 restants, total 30 (septembre = 30 jours).
    expect(
      elapsedAndRemainingInBudgetPeriod('2026-09', '2026-10-05', custom25()),
    ).toEqual({ elapsed: 11, remaining: 19, total: 30 });
  });
});

// ---------------------------------------------------------------------------
// Sanitization de payloads inconnus
// ---------------------------------------------------------------------------

describe('sanitizeCustomMonthConfig', () => {
  it('payload legacy (champs absents) → config par défaut', () => {
    expect(sanitizeCustomMonthConfig(undefined)).toEqual(DEFAULT_CUSTOM_MONTH_CONFIG);
    expect(sanitizeCustomMonthConfig({})).toEqual(DEFAULT_CUSTOM_MONTH_CONFIG);
  });

  it('payload valide conservé', () => {
    expect(
      sanitizeCustomMonthConfig({
        customMonthEnabled: true,
        customMonthStartDay: 25,
        customMonthStartOverrides: { '2026-10': 5 },
      }),
    ).toEqual({ enabled: true, startDay: 25, overrides: { '2026-10': 5 } });
  });

  it('valeurs malformées retombent sur les défauts', () => {
    const result = sanitizeCustomMonthConfig({
      customMonthEnabled: 'oui',
      customMonthStartDay: 31,
      customMonthStartOverrides: { '2026-10': 0, 'bad-key': 5, '2026-11': '25' },
    });
    expect(result).toEqual({ enabled: false, startDay: 1, overrides: {} });
  });

  it('overrides bornés à 100 entrées (SEC-24)', () => {
    const raw: Record<string, number> = {};
    for (let i = 0; i < 150; i++) {
      raw[`20${String(30 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, '0')}`] = (i % 28) + 1;
    }
    const result = sanitizeCustomMonthConfig({ customMonthStartOverrides: raw });
    expect(Object.keys(result.overrides).length).toBe(100);
  });

  it('getCustomMonthConfig depuis des réglages typés', () => {
    expect(
      getCustomMonthConfig({
        customMonthEnabled: true,
        customMonthStartDay: 28,
        customMonthStartOverrides: { '2026-02': 27 },
      }),
    ).toEqual({ enabled: true, startDay: 28, overrides: { '2026-02': 27 } });
  });
});

describe('isCustomMonthActive', () => {
  it('false : désactivé, ou activé sans effet', () => {
    expect(isCustomMonthActive(DEFAULT_CUSTOM_MONTH_CONFIG)).toBe(false);
    expect(isCustomMonthActive({ enabled: true, startDay: 1, overrides: {} })).toBe(false);
  });
  it('true : jour ≠ 1 ou surcharges présentes', () => {
    expect(isCustomMonthActive({ enabled: true, startDay: 25, overrides: {} })).toBe(true);
    expect(isCustomMonthActive({ enabled: true, startDay: 1, overrides: { '2026-10': 5 } })).toBe(true);
  });
});
