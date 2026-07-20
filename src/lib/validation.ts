// Utility functions for validation across the app
import { INCOME_SOURCES, type IncomeSource } from "@/types/transaction";

export { INCOME_SOURCES };
export type { IncomeSource };

export const VALIDATION_CONSTRAINTS = {
  AMOUNT_MIN: 0.01,
  AMOUNT_MAX: 1000000,
  DESCRIPTION_MAX_LENGTH: 255,
  ENVELOPE_NAME_MAX_LENGTH: 100,
  ENVELOPE_BUDGET_MAX: 1000000,
  MONTHLY_INCOME_MAX: 10000000,
};

export function validateAmount(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    amount > VALIDATION_CONSTRAINTS.AMOUNT_MIN &&
    amount <= VALIDATION_CONSTRAINTS.AMOUNT_MAX &&
    !isNaN(amount)
  );
}

export function validateDescription(desc: unknown): desc is string {
  return (
    typeof desc === "string" &&
    desc.trim().length > 0 &&
    desc.length <= VALIDATION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH
  );
}

export function validateEnvelopeName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    name.length <= VALIDATION_CONSTRAINTS.ENVELOPE_NAME_MAX_LENGTH
  );
}

export function validateEnvelopeId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

/**
 * Valide qu'une date est au format ISO YYYY-MM-DD, que les composants
 * sont valides (mois 01-12, jour correct pour le mois), et qu'elle est
 * dans une plage raisonnable (±5 ans par rapport à aujourd'hui).
 *
 * Rejette les formats permissifs comme "2024-02-30" (propagation au 1er mars),
 * "2024-13-01" (mois 13 → janvier 2025), "tomorrow", "01/01/2024", timestamps.
 */
export function validateDate(date: unknown): boolean {
  if (typeof date !== "string") return false;

  // Format YYYY-MM-DD strict — rejette tout ce qui n'est pas exactement
  // 10 caractères avec des traits d'union aux bonnes positions.
  const isoRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!isoRegex.test(date)) return false;

  // Vérifier que le jour est valide pour le mois (ex: 31 février → invalide).
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const daysInMonth = new Date(year, month, 0).getDate(); // month 0-based → jour 0 = dernier jour du mois précédent
  if (day > daysInMonth) return false;

  // Borne temporelle : ±5 ans par rapport à aujourd'hui.
  const now = new Date();
  const parsed = new Date(date + "T00:00:00"); // forcer l'interprétation en heure locale
  const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
  const minDate = new Date(now.getTime() - fiveYearsMs);
  const maxDate = new Date(now.getTime() + fiveYearsMs);

  return parsed >= minDate && parsed <= maxDate;
}

export function validateEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function validatePassword(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

// ── Quota limits ──

export const QUOTA_CONSTRAINTS = {
  MAX_ENVELOPES: 50,
  MAX_TRANSACTIONS_PER_MONTH: 500,
} as const;

export function checkEnvelopeQuota(currentEnvelopeCount: number): {
  allowed: boolean;
  message: string;
} {
  if (currentEnvelopeCount >= QUOTA_CONSTRAINTS.MAX_ENVELOPES) {
    return {
      allowed: false,
      message: `Limite atteinte : maximum ${QUOTA_CONSTRAINTS.MAX_ENVELOPES} enveloppes autorisées. Supprimez une enveloppe existante pour en créer une nouvelle.`,
    };
  }
  return { allowed: true, message: "" };
}

export function checkTransactionQuota(
  currentMonthlyTransactionCount: number
): {
  allowed: boolean;
  message: string;
} {
  if (currentMonthlyTransactionCount >= QUOTA_CONSTRAINTS.MAX_TRANSACTIONS_PER_MONTH) {
    return {
      allowed: false,
      message: `Limite atteinte : maximum ${QUOTA_CONSTRAINTS.MAX_TRANSACTIONS_PER_MONTH} transactions par mois.`,
    };
  }
  return { allowed: true, message: "" };
}

// ── Validation avec messages d'erreur en français ──

export function validateAmountWithMessage(
  amount: unknown
): { valid: boolean; message: string } {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, message: "Le montant doit être un nombre valide." };
  }
  if (amount <= 0) {
    return {
      valid: false,
      message: "Le montant doit être supérieur à 0.",
    };
  }
  if (amount > VALIDATION_CONSTRAINTS.AMOUNT_MAX) {
    return {
      valid: false,
      message: `Le montant ne peut pas dépasser ${VALIDATION_CONSTRAINTS.AMOUNT_MAX.toLocaleString("fr-FR")}.`,
    };
  }
  return { valid: true, message: "" };
}

export function validateDescriptionWithMessage(
  desc: unknown
): { valid: boolean; message: string } {
  if (typeof desc !== "string" || desc.trim().length === 0) {
    return { valid: false, message: "La description ne peut pas être vide." };
  }
  if (desc.length > VALIDATION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      message: `La description ne peut pas dépasser ${VALIDATION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH} caractères.`,
    };
  }
  return { valid: true, message: "" };
}

export function validateEnvelopeNameWithMessage(
  name: unknown
): { valid: boolean; message: string } {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, message: "Le nom de l'enveloppe ne peut pas être vide." };
  }
  if (name.length > VALIDATION_CONSTRAINTS.ENVELOPE_NAME_MAX_LENGTH) {
    return {
      valid: false,
      message: `Le nom ne peut pas dépasser ${VALIDATION_CONSTRAINTS.ENVELOPE_NAME_MAX_LENGTH} caractères.`,
    };
  }
  return { valid: true, message: "" };
}

/** Construit la clé de mois utilisée dans le document compteur (ex: "tx_2026_06"). */
export function getMonthKey(dateStr: string): string {
  return "tx_" + dateStr.slice(0, 7).replace("-", "_");
}

// ── Validation des revenus supplémentaires ──

/**
 * Valide que la source de revenu fait partie de la liste autorisée.
 */
export function validateSource(source: unknown): source is IncomeSource {
  return (
    typeof source === "string" &&
    (INCOME_SOURCES as readonly string[]).includes(source)
  );
}

/**
 * Valide que le type de transaction est "expense" ou "income".
 * Retourne aussi true pour undefined/null (backward compat).
 */
export function validateTransactionType(
  type: unknown
): type is "expense" | "income" | undefined {
  if (type === undefined || type === null) return true;
  return type === "expense" || type === "income";
}

/**
 * Version avec message d'erreur en français pour la source.
 */
export function validateSourceWithMessage(
  source: unknown
): { valid: boolean; message: string } {
  if (!validateSource(source)) {
    return {
      valid: false,
      message: `La source doit être l'une des valeurs suivantes : ${INCOME_SOURCES.join(", ")}.`,
    };
  }
  return { valid: true, message: "" };
}

/**
 * Version avec message d'erreur en français pour le type.
 */
export function validateTransactionTypeWithMessage(
  type: unknown
): { valid: boolean; message: string } {
  if (type !== undefined && type !== null && type !== "expense" && type !== "income") {
    return {
      valid: false,
      message: "Le type doit être 'expense' ou 'income'.",
    };
  }
  return { valid: true, message: "" };
}
