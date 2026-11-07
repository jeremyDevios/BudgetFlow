/**
 * Canonical web types for the multi-budget feature.
 *
 * Firestore paths (voir MULTI_BUDGET.md) :
 *  - users/{uid}/budgets/{budgetId}   — méta des budgets 2-5 (slots fixes)
 *  - users/{uid}/state/currentBudget  — budget sélectionné (absent = défaut)
 *
 * Le « budget par défaut » (id 'default') n'a pas de document : ses données
 * vivent dans les collections legacy (settings/general, envelopes,
 * transactions, monthlyIncomes).
 */

/** Id du budget par défaut — données dans les collections legacy. */
export const DEFAULT_BUDGET_ID = "default";

/**
 * Slots de budget disponibles. La limite de 5 budgets est imposée par cette
 * liste fermée, reflétée dans firestore.rules (isValidBudgetId) : impossible
 * de créer un 6ᵉ budget, même avec un client modifié.
 */
export const BUDGET_SLOT_IDS = [
  "budget-1",
  "budget-2",
  "budget-3",
  "budget-4",
  "budget-5",
] as const;

export type BudgetSlotId = (typeof BUDGET_SLOT_IDS)[number];

/** 'default' (budget par défaut) ou l'un des 5 slots. */
export type BudgetId = typeof DEFAULT_BUDGET_ID | BudgetSlotId;

/** Nombre maximal de budgets par compte (défaut inclus). */
export const MAX_BUDGETS = 5;

/** Méta d'un budget (doc users/{uid}/budgets/{budgetId}). */
export interface Budget {
  /** Slot id (e.g. "budget-1"). */
  id: BudgetSlotId;
  /** Nom affiché (1-50 caractères). */
  name: string;
  /** Clé d'icône partagée : Lucide côté web, SF Symbol côté iOS. */
  icon: string;
  /** Classe Tailwind de la palette existante (e.g. "bg-amber-500"). */
  color: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 — résolution de conflit last-write-wins. */
  updatedAt: string;
  /** Soft-delete : présent = budget supprimé (restaurable, le slot reste occupé). */
  deletedAt?: string;
}

/** Vrai si l'id est l'un des 5 slots (même liste que les règles Firestore). */
export function isValidBudgetId(value: unknown): value is BudgetSlotId {
  return (
    typeof value === "string" &&
    (BUDGET_SLOT_IDS as readonly string[]).includes(value)
  );
}

/** Vrai si le budget est vivant (pas soft-deleté). */
export function isBudgetActive(budget: Budget): boolean {
  return !budget.deletedAt;
}

/**
 * Premier slot jamais utilisé — même un budget soft-deleté occupe son slot
 * (il doit rester restaurable). null = les 5 slots sont occupés : la création
 * passe par la restauration d'un budget existant.
 */
export function findAvailableSlotId(budgets: Budget[]): BudgetSlotId | null {
  const used = new Set(budgets.map((budget) => budget.id));
  return BUDGET_SLOT_IDS.find((id) => !used.has(id)) ?? null;
}

/**
 * Résout le budget courant avec repli sûr sur le budget par défaut : le doc
 * state peut pointer vers un budget supprimé depuis un autre appareil, ou
 * contenir une valeur inconnue/invalide.
 */
export function resolveCurrentBudgetId(
  requested: unknown,
  budgets: Budget[]
): BudgetId {
  if (requested === DEFAULT_BUDGET_ID) return DEFAULT_BUDGET_ID;
  if (!isValidBudgetId(requested)) return DEFAULT_BUDGET_ID;
  const budget = budgets.find((candidate) => candidate.id === requested);
  return budget && isBudgetActive(budget) ? budget.id : DEFAULT_BUDGET_ID;
}
