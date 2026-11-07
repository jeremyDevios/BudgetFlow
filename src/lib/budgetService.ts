/**
 * Accès Firestore et normalisation pour le multi-budget.
 *
 * Résolution de chemins : le budget par défaut ('default') vit dans les
 * collections legacy (settings/general, envelopes, transactions,
 * monthlyIncomes) — les budgets 2-5 dans users/{uid}/budgets/{budgetId}/…
 * Les anciens clients ne connaissent que les chemins legacy : ils ne voient
 * physiquement pas les sous-collections de budgets (zéro régression).
 *
 * Voir MULTI_BUDGET.md.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import {
  BUDGET_SLOT_IDS,
  DEFAULT_BUDGET_ID,
  isValidBudgetId,
  resolveCurrentBudgetId,
  type Budget,
  type BudgetId,
  type BudgetSlotId,
} from "@/types/budget";
import {
  validateBudgetColor,
  validateBudgetIcon,
  validateBudgetName,
} from "@/lib/validation";

// ── Résolution de chemins ────────────────────────────────────────────────────

/** Collection des budgets (méta) : users/{uid}/budgets. */
export function budgetsCollectionRef(userId: string) {
  return collection(db, "users", userId, "budgets");
}

/** Doc budget : users/{uid}/budgets/{budgetId}. */
export function budgetDocRef(userId: string, budgetId: BudgetSlotId) {
  return doc(db, "users", userId, "budgets", budgetId);
}

/** Collection des enveloppes du budget (legacy pour le défaut). */
export function envelopesCollectionRef(userId: string, budgetId: BudgetId) {
  return budgetId === DEFAULT_BUDGET_ID
    ? collection(db, "users", userId, "envelopes")
    : collection(db, "users", userId, "budgets", budgetId, "envelopes");
}

/** Collection des transactions du budget (legacy pour le défaut). */
export function transactionsCollectionRef(userId: string, budgetId: BudgetId) {
  return budgetId === DEFAULT_BUDGET_ID
    ? collection(db, "users", userId, "transactions")
    : collection(db, "users", userId, "budgets", budgetId, "transactions");
}

/** Doc des réglages financiers du budget (settings/general pour le défaut). */
export function budgetSettingsDocRef(userId: string, budgetId: BudgetId) {
  return budgetId === DEFAULT_BUDGET_ID
    ? doc(db, "users", userId, "settings", "general")
    : doc(db, "users", userId, "budgets", budgetId, "settings", "general");
}

/** Collection des revenus variables du budget (legacy pour le défaut). */
export function monthlyIncomesCollectionRef(userId: string, budgetId: BudgetId) {
  return budgetId === DEFAULT_BUDGET_ID
    ? collection(db, "users", userId, "monthlyIncomes")
    : collection(db, "users", userId, "budgets", budgetId, "monthlyIncomes");
}

/** Doc enveloppe du budget (legacy pour le défaut). */
export function envelopeDocRef(
  userId: string,
  budgetId: BudgetId,
  envelopeId: string,
) {
  return budgetId === DEFAULT_BUDGET_ID
    ? doc(db, "users", userId, "envelopes", envelopeId)
    : doc(db, "users", userId, "budgets", budgetId, "envelopes", envelopeId);
}

/** Doc transaction du budget (legacy pour le défaut). */
export function transactionDocRef(
  userId: string,
  budgetId: BudgetId,
  transactionId: string,
) {
  return budgetId === DEFAULT_BUDGET_ID
    ? doc(db, "users", userId, "transactions", transactionId)
    : doc(db, "users", userId, "budgets", budgetId, "transactions", transactionId);
}

/** Doc revenu mensuel du budget (legacy pour le défaut). */
export function monthlyIncomeDocRef(
  userId: string,
  budgetId: BudgetId,
  month: string,
) {
  return budgetId === DEFAULT_BUDGET_ID
    ? doc(db, "users", userId, "monthlyIncomes", month)
    : doc(db, "users", userId, "budgets", budgetId, "monthlyIncomes", month);
}

/** Doc de l'état du budget courant : users/{uid}/state/currentBudget. */
export function currentBudgetStateRef(userId: string) {
  return doc(db, "users", userId, "state", "currentBudget");
}

/**
 * Clé du compteur d'enveloppes dans counters/{userId} — quota de 50
 * enveloppes PAR budget (décision actée) : champ legacy `envelopeCount` pour
 * le budget par défaut, chemin pointé `envelopeCounts.<slot>` sinon.
 * Usage : updateDoc(counterRef, { [envelopeCountField(budgetId)]: increment(±1) }).
 */
export function envelopeCountField(budgetId: BudgetId): string {
  return budgetId === DEFAULT_BUDGET_ID
    ? "envelopeCount"
    : `envelopeCounts.${budgetId}`;
}

// ── Lecture ───────────────────────────────────────────────────────────────────

/** Icône/couleur de repli pour un doc budget malformé (jamais écrits). */
const DEFAULT_BUDGET_ICON = "Wallet";
const DEFAULT_BUDGET_COLOR = "bg-slate-500";

/**
 * Sanitizer de lecture d'un doc budget (même philosophie que
 * sanitizeStoredSettingsDocument) : champs manquants/invalides remplacés par
 * des valeurs sûres ; retourne null si le doc est inexploitable.
 */
export function sanitizeBudgetDocument(
  data: Record<string, unknown>,
  slotId: BudgetSlotId
): Budget | null {
  if (typeof data !== "object" || data === null) return null;

  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim().slice(0, 50)
      : `Budget ${slotId.replace("budget-", "")}`;

  const icon =
    typeof data.icon === "string" && data.icon.length > 0
      ? data.icon.slice(0, 100)
      : DEFAULT_BUDGET_ICON;

  const color =
    typeof data.color === "string" && data.color.length > 0
      ? data.color.slice(0, 100)
      : DEFAULT_BUDGET_COLOR;

  const createdAt =
    typeof data.createdAt === "string" && data.createdAt.length > 0
      ? data.createdAt
      : new Date(0).toISOString();

  const updatedAt =
    typeof data.updatedAt === "string" && data.updatedAt.length > 0
      ? data.updatedAt
      : new Date(0).toISOString();

  const deletedAt =
    typeof data.deletedAt === "string" && data.deletedAt.length > 0
      ? data.deletedAt
      : undefined;

  return { id: slotId, name, icon, color, createdAt, updatedAt, deletedAt };
}

/**
 * Charge tous les budgets (≤ 5 docs) triés par ordre de slot.
 * Les docs malformés ou d'ids inconnus sont ignorés — jamais de crash de
 * lecture ; un échec de lecture retourne [].
 */
export async function loadBudgets(userId: string): Promise<Budget[]> {
  try {
    const snapshot = await getDocs(budgetsCollectionRef(userId));
    const budgets: Budget[] = [];
    for (const slotId of BUDGET_SLOT_IDS) {
      const docSnap = snapshot.docs.find((candidate) => candidate.id === slotId);
      if (!docSnap) continue;
      const sanitized = sanitizeBudgetDocument(docSnap.data(), slotId);
      if (sanitized) budgets.push(sanitized);
    }
    return budgets;
  } catch (error) {
    logger.sanitizedError("Failed to load budgets", error);
    return [];
  }
}

/**
 * Lit le budget courant : doc state absent, invalide ou pointant vers un
 * budget soft-deleté → 'default'. Ne lève jamais.
 */
export async function loadCurrentBudgetId(
  userId: string,
  budgets: Budget[]
): Promise<BudgetId> {
  try {
    const snapshot = await getDoc(currentBudgetStateRef(userId));
    if (!snapshot.exists()) return DEFAULT_BUDGET_ID;
    return resolveCurrentBudgetId(snapshot.data().budgetId, budgets);
  } catch (error) {
    logger.sanitizedError("Failed to load current budget state", error);
    return DEFAULT_BUDGET_ID;
  }
}

// ── Écriture ──────────────────────────────────────────────────────────────────

export interface BudgetPayload {
  name: string;
  icon: string;
  color: string;
}

/**
 * Normalise un payload budget (write-time) : trim du nom, validation des
 * trois champs. null si le payload est invalide (le caller gère le message).
 */
export function normalizeBudgetPayload(
  partial: Partial<BudgetPayload>
): BudgetPayload | null {
  if (
    !validateBudgetName(partial.name) ||
    !validateBudgetIcon(partial.icon) ||
    !validateBudgetColor(partial.color)
  ) {
    return null;
  }
  return {
    name: (partial.name as string).trim(),
    icon: partial.icon as string,
    color: partial.color as string,
  };
}

/**
 * Crée ou met à jour un budget sur un slot donné (payload complet).
 * createdAt est préservé si le doc existe (immuable dans les règles) ;
 * updatedAt est estampillé à chaque écriture (last-write-wins).
 * Retourne le budget normalisé, ou null si le payload est invalide.
 */
export async function saveBudget(
  userId: string,
  slotId: BudgetSlotId,
  partial: Partial<BudgetPayload>
): Promise<Budget | null> {
  const normalized = normalizeBudgetPayload(partial);
  if (!normalized) return null;

  const now = new Date().toISOString();

  let createdAt = now;
  try {
    const existing = await getDoc(budgetDocRef(userId, slotId));
    if (existing.exists()) {
      const data = existing.data();
      if (typeof data.createdAt === "string" && data.createdAt.length > 0) {
        createdAt = data.createdAt;
      }
    }
  } catch (error) {
    // Échec de lecture → on crée comme un doc neuf (createdAt du jour).
    logger.sanitizedError("Failed to read budget before save", error);
  }

  await setDoc(budgetDocRef(userId, slotId), {
    ...normalized,
    createdAt,
    updatedAt: now,
  });

  return { id: slotId, ...normalized, createdAt, updatedAt: now };
}

/**
 * Suppression DÉFINITIVE d'un budget (décision actée 2026-11-07) : route API
 * admin (recursiveDelete de toutes les sous-collections + libération du
 * compteur de quota + repli du budget courant). Irréversible.
 *
 * @param getIdToken - Fournit le token Firebase courant (le caller détient l'objet user).
 * @param budgetId   - Slot à supprimer.
 * @throws Re-throws l'erreur serveur (message localisé) si l'appel échoue.
 */
export async function deleteBudgetPermanently(
  getIdToken: () => Promise<string>,
  budgetId: BudgetSlotId,
): Promise<void> {
  const token = await getIdToken();
  const response = await fetch("/api/budgets/delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ budgetId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      (data as { error?: string } | null)?.error ??
        `Budget deletion failed (${response.status})`,
    );
  }
}

/**
 * Persiste le budget courant dans users/{uid}/state/currentBudget.
 * Doc dédié : les anciens clients ne connaissent pas ce chemin (un champ
 * ajouté à users/{uid} ou settings/general serait effacé par leurs écritures
 * complètes). 'default' = budget par défaut.
 */
export async function switchBudget(
  userId: string,
  budgetId: BudgetId
): Promise<void> {
  if (budgetId !== DEFAULT_BUDGET_ID && !isValidBudgetId(budgetId)) {
    throw new Error(`Invalid budget id: ${String(budgetId)}`);
  }
  await setDoc(currentBudgetStateRef(userId), {
    budgetId,
    updatedAt: new Date().toISOString(),
  });
}
