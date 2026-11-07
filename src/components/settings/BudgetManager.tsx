"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useBudget } from "@/context/BudgetContext";
import { deleteBudgetPermanently, saveBudget } from "@/lib/budgetService";
import { logger } from "@/lib/logger";
import {
  validateBudgetNameWithMessage,
  validateBudgetIconWithMessage,
  validateBudgetColorWithMessage,
} from "@/lib/validation";
import {
  BUDGET_COLORS,
  BUDGET_ICONS_LIST,
  DEFAULT_BUDGET_ICON_KEY,
  DEFAULT_BUDGET_LABEL,
  budgetIconFor,
} from "@/lib/budgetPresentation";
import {
  findAvailableSlotId,
  MAX_BUDGETS,
  type Budget,
  type BudgetSlotId,
} from "@/types/budget";

interface BudgetFormState {
  name: string;
  icon: string;
  color: string;
}

const EMPTY_FORM: BudgetFormState = {
  name: "",
  icon: DEFAULT_BUDGET_ICON_KEY,
  color: BUDGET_COLORS[0],
};

/**
 * Écran de gestion des budgets (section des Paramètres) : liste, création
 * (limite de 5 via slots fixes), édition nom/icône/couleur, soft-delete et
 * restauration. Le budget par défaut est affiché mais non modifiable.
 *
 * Voir MULTI_BUDGET.md §9 (UX) et §3.4 (slots).
 */
export default function BudgetManager() {
  const { user } = useAuth();
  const { budgets, refreshBudgets, loading } = useBudget();

  const [editingSlot, setEditingSlot] = useState<BudgetSlotId | "new" | null>(null);
  const [form, setForm] = useState<BudgetFormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<BudgetSlotId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const availableSlot = findAvailableSlotId(budgets);
  const atCapacity = availableSlot === null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setError(null);
  };

  const startCreate = () => {
    if (atCapacity) return;
    setConfirmDeleteId(null);
    setEditingSlot("new");
    resetForm();
  };

  const startEdit = (budget: Budget) => {
    setConfirmDeleteId(null);
    setEditingSlot(budget.id);
    setForm({ name: budget.name, icon: budget.icon, color: budget.color });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingSlot(null);
    setConfirmDeleteId(null);
    resetForm();
  };

  const submit = async () => {
    if (!user || saving) return;

    const nameError = validateBudgetNameWithMessage(form.name);
    if (nameError.valid === false) {
      setError(nameError.message);
      return;
    }
    const iconError = validateBudgetIconWithMessage(form.icon);
    if (iconError.valid === false) {
      setError(iconError.message);
      return;
    }
    const colorError = validateBudgetColorWithMessage(form.color);
    if (colorError.valid === false) {
      setError(colorError.message);
      return;
    }

    const slot: BudgetSlotId | null =
      editingSlot === "new" ? availableSlot : editingSlot;
    if (!slot) {
      setError(`Limite de ${MAX_BUDGETS} budgets atteinte.`);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveBudget(user.uid, slot, form);
      if (!saved) {
        setError("Impossible d'enregistrer ce budget.");
        return;
      }
      setEditingSlot(null);
      resetForm();
      await refreshBudgets();
    } catch (saveError) {
      logger.sanitizedError("BudgetManager: échec de l'enregistrement", saveError);
      setError("L'enregistrement a échoué. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budget: Budget) => {
    if (!user || saving) return;
    setSaving(true);
    try {
      // Suppression DÉFINITIVE via la route API admin (recursiveDelete) —
      // irréversible : toutes les données du budget sont supprimées.
      await deleteBudgetPermanently(() => user.getIdToken(), budget.id);
      setConfirmDeleteId(null);
      await refreshBudgets();
    } catch (deleteError) {
      logger.sanitizedError("BudgetManager: échec de la suppression", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "La suppression a échoué. Réessayez.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text placeholder:text-app-text-secondary/50 focus:outline-none focus:border-amber-500/60";

  return (
    <section
      className="bg-app-surface/50 border border-app-border rounded-2xl p-6"
      data-testid="budget-manager"
    >
      <h2 className="text-xl font-bold mb-2">Budgets</h2>
      <p className="text-sm text-app-text-secondary mb-5">
        Jusqu&apos;à {MAX_BUDGETS} budgets indépendants : chacun possède son propre
        salaire, ses charges fixes, son épargne et ses enveloppes.
      </p>

      <div className="space-y-2">
        {/* Budget par défaut — non modifiable */}
        <div className="flex items-center gap-3 rounded-xl border border-app-border/60 bg-app-bg/40 px-3 py-2.5">
          <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="text-sm font-medium text-app-text">
            {DEFAULT_BUDGET_LABEL}
          </span>
          <span className="ml-auto rounded-full bg-app-surface px-2 py-0.5 text-[10px] font-medium text-app-text-secondary">
            Budget par défaut
          </span>
        </div>

        {loading && (
          <p className="text-xs text-app-text-secondary">Chargement…</p>
        )}

        {budgets.map((budget) => {
          const Icon = budgetIconFor(budget.icon);
          return (
            <div
              key={budget.id}
              className="flex items-center gap-3 rounded-xl border border-app-border/60 bg-app-bg/40 px-3 py-2.5"
              data-testid={`budget-row-${budget.id}`}
            >
              <span
                className={`h-3 w-3 rounded-full ${budget.color}`}
                aria-hidden="true"
              />
              <Icon className="h-4 w-4 text-app-text-secondary" aria-hidden="true" />
              <span className="text-sm font-medium text-app-text">
                {budget.name}
              </span>

              <div className="ml-auto flex items-center gap-1">
                {confirmDeleteId === budget.id ? (
                  <>
                    <span className="text-[10px] font-medium text-red-500">
                      Supprimer définitivement ?
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(budget)}
                      disabled={saving}
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      data-testid={`budget-delete-confirm-${budget.id}`}
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-app-text-secondary hover:bg-app-surface transition-colors"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(budget)}
                      className="rounded-lg p-1.5 text-app-text-secondary hover:text-amber-500 hover:bg-app-surface transition-colors"
                      title="Modifier"
                      data-testid={`budget-edit-${budget.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(budget.id)}
                      className="rounded-lg p-1.5 text-app-text-secondary hover:text-red-500 hover:bg-app-surface transition-colors"
                      title="Supprimer"
                      data-testid={`budget-delete-${budget.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingSlot === null && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-app-text-secondary">
            {budgets.length}/{MAX_BUDGETS} budgets
          </span>
          <button
            type="button"
            onClick={startCreate}
            disabled={atCapacity}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="budget-create"
            title={atCapacity ? `Limite de ${MAX_BUDGETS} budgets atteinte` : undefined}
          >
            <Plus className="h-4 w-4" /> Nouveau budget
          </button>
        </div>
      )}

      {editingSlot !== null && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-app-bg/60 p-4" data-testid="budget-form">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-app-text">
              {editingSlot === "new" ? "Nouveau budget" : "Modifier le budget"}
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg p-1.5 text-app-text-secondary hover:text-app-text hover:bg-app-surface transition-colors"
              title="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block text-xs font-medium text-app-text-secondary mb-1">
            Nom
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ex. Compte joint"
            maxLength={50}
            className={inputClass}
            data-testid="budget-form-name"
          />

          <label className="block text-xs font-medium text-app-text-secondary mt-3 mb-1">
            Icône
          </label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icône">
            {BUDGET_ICONS_LIST.map((iconKey) => {
              const Icon = budgetIconFor(iconKey);
              return (
                <button
                  key={iconKey}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon: iconKey }))}
                  aria-pressed={form.icon === iconKey}
                  title={iconKey}
                  className={`rounded-lg border p-2 transition-colors ${
                    form.icon === iconKey
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-app-border text-app-text-secondary hover:text-app-text hover:bg-app-surface"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <label className="block text-xs font-medium text-app-text-secondary mt-3 mb-1">
            Couleur
          </label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Couleur">
            {BUDGET_COLORS.map((colorClass) => (
              <button
                key={colorClass}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, color: colorClass }))}
                aria-pressed={form.color === colorClass}
                aria-label={colorClass}
                className={`h-7 w-7 rounded-full ${colorClass} transition-transform ${
                  form.color === colorClass
                    ? "ring-2 ring-offset-2 ring-offset-app-bg ring-amber-500 scale-110"
                    : "hover:scale-110"
                }`}
              >
                {form.color === colorClass && (
                  <Check className="mx-auto h-4 w-4 text-white" />
                )}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-500" data-testid="budget-form-error">
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl px-4 py-2 text-sm font-medium text-app-text-secondary hover:bg-app-surface transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors disabled:opacity-50"
              data-testid="budget-form-save"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
