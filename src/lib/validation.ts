// Utility functions for validation across the app
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

export function validateDate(date: unknown): boolean {
  if (typeof date !== "string") return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
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
