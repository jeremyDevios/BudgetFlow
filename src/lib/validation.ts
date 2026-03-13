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
