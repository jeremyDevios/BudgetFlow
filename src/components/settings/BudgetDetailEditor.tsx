"use client";

/**
 * BudgetDetailEditor
 *
 * Composant réutilisable pour éditer un budget par sous-catégories détaillées.
 * Utilisable dans l'onboarding et dans les paramètres.
 *
 * Règles métier enforced ici :
 *  - Le mode détaillé ne peut être activé que s'il existe au moins une ligne.
 *  - Si la dernière ligne est supprimée, `onEnabledChange(false)` est émis.
 *  - Les lignes existantes sont conservées lorsque le mode est désactivé
 *    (pas de destruction de données).
 *  - Les montants sont validés : ≥ 0, nombre valide.
 *  - Le total affiché est calculé en temps réel depuis les lignes.
 */

import { useId, useRef } from "react";
import { Plus, Trash2, Info } from "lucide-react";

import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";
import { BudgetSubItem } from "@/types/settings";
import { computeDetailedTotal, createEmptyBudgetSubItem } from "@/lib/settingsService";


// ---------------------------------------------------------------------------
// Placeholders pédagogiques par catégorie
// ---------------------------------------------------------------------------

const PLACEHOLDERS: Record<Category, { names: string[]; amountHint: string }> = {
  fixedCosts: {
    names: ["Loyer", "Électricité", "Assurance", "Internet", "Eau", "Téléphone"],
    amountHint: "0",
  },
  savings: {
    names: ["Livret A", "PEA", "Assurance vie", "LDDS", "Épargne retraite"],
    amountHint: "0",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Category = "fixedCosts" | "savings";

export interface BudgetDetailEditorProps {
  /**
   * Libellé affiché comme titre de la section (ex. "Charges fixes", "Épargne").
   */
  label: string;

  /**
   * Clé de catégorie permettant d'afficher des placeholders adaptés.
   */
  category: Category;

  /**
   * Indique si le mode détaillé est activé.
   * Invariant externe : doit être `false` quand `items` est vide.
   */
  enabled: boolean;

  /**
   * Liste des sous-catégories actuelles.
   */
  items: BudgetSubItem[];

  /**
   * Montant agrégé (source de vérité quand `enabled` est `false`).
   * Affiché à titre informatif en mode désactivé.
   */
  aggregateAmount: number;

  /**
   * Appelé quand l'utilisateur bascule le mode détaillé ou quand la
   * suppression de la dernière ligne force la désactivation.
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Appelé à chaque modification de la liste des lignes.
   */
  onItemsChange: (items: BudgetSubItem[]) => void;

  /**
   * Variante d'affichage :
   * - `card`   : carte autonome avec titre + switch (par défaut)
   * - `inline` : panneau de détail uniquement, le contrôle externe étant rendu ailleurs
   */
  variant?: "card" | "inline";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Sous-composant : une ligne éditable
// ---------------------------------------------------------------------------

interface LineRowProps {
  item: BudgetSubItem;
  namePlaceholder: string;
  nameInputId: string;
  amountInputId: string;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDelete: () => void;
  /** Numéro de ligne visible (1-based) pour aria-label. */
  lineNumber: number;
  currencySymbol: string;
}

function LineRow({
  item,
  namePlaceholder,
  nameInputId,
  amountInputId,
  onNameChange,
  onAmountChange,
  onDelete,
  lineNumber,
  currencySymbol,
}: LineRowProps) {
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={`Ligne ${lineNumber}`}
    >
      {/* Nom */}
      <div className="flex-1 min-w-0">
        <label htmlFor={nameInputId} className="sr-only">
          Nom de la ligne {lineNumber}
        </label>
        <input
          id={nameInputId}
          type="text"
          value={item.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-shadow"
          aria-required="true"
        />
      </div>

      {/* Montant */}
      <div className="relative w-32 shrink-0">
        <label htmlFor={amountInputId} className="sr-only">
          Montant de la ligne {lineNumber}
        </label>
        <input
          id={amountInputId}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={item.amount === 0 ? "" : item.amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
          className="no-spinner w-full bg-app-bg border border-app-border rounded-lg py-2 pl-3 pr-7 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-shadow"
        />
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-secondary text-xs pointer-events-none"
          aria-hidden="true"
        >
          {currencySymbol}
        </span>
      </div>

      {/* Suppression */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Supprimer la ligne ${lineNumber}`}
        className="shrink-0 p-2 rounded-lg text-app-text-secondary hover:text-red-400 hover:bg-red-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function BudgetDetailEditor({
  label,
  category,
  enabled,
  items,
  aggregateAmount,
  onEnabledChange,
  onItemsChange,
  variant = "card",
}: BudgetDetailEditorProps) {
  const uid = useId();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { formatAmount, symbol } = useCurrencyFormatting();

  const placeholders = PLACEHOLDERS[category];
  const detailedTotal = computeDetailedTotal(items);
  const aggregateAmountDisplay = formatAmount(aggregateAmount);
  const detailedTotalDisplay = formatAmount(detailedTotal);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Active/désactive le mode détaillé. */
  const handleToggle = () => {
    if (enabled) {
      // Désactivation : on conserve les items (pas de destruction).
      onEnabledChange(false);
    } else {
      // Activation : on ajoute une première ligne vide si la liste est vide.
      if (items.length === 0) {
        onItemsChange([createEmptyBudgetSubItem()]);
      }
      onEnabledChange(true);
    }
  };

  /** Ajoute une nouvelle ligne vide à la fin de la liste. */
  const handleAddLine = () => {
    onItemsChange([...items, createEmptyBudgetSubItem()]);
  };

  /** Met à jour le nom d'une ligne. */
  const handleNameChange = (id: string, value: string) => {
    onItemsChange(items.map((it) => (it.id === id ? { ...it, name: value } : it)));
  };

  /**
   * Met à jour le montant d'une ligne.
   * Les valeurs négatives ou non numériques sont ramenées à 0.
   */
  const handleAmountChange = (id: string, raw: string) => {
    const parsed = parseFloat(raw);
    const amount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onItemsChange(items.map((it) => (it.id === id ? { ...it, amount } : it)));
  };

  /**
   * Supprime une ligne.
   * Si c'était la dernière, désactive automatiquement le mode détaillé.
   */
  const handleDeleteLine = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    onItemsChange(next);
    if (next.length === 0) {
      // Invariant : mode désactivé quand aucune ligne n'existe.
      onEnabledChange(false);
    }
  };

  // ── Identifiants ARIA ──────────────────────────────────────────────────────
  const toggleId = `${uid}-toggle`;
  const panelId = `${uid}-panel`;
  const totalId = `${uid}-total`;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (variant === "inline" && !enabled) {
    return null;
  }

  const detailPanel = enabled ? (
    <div
      id={panelId}
      role="region"
      aria-label={`Détail des lignes — ${label}`}
      className={
        variant === "inline"
          ? "rounded-xl border border-app-border bg-app-surface/60 p-4 space-y-3"
          : "px-4 pb-4 space-y-3 border-t border-app-border"
      }
    >
          {/* Explication contextuelle */}
          <div className={`flex items-start gap-2 ${variant === "inline" ? "" : "pt-3"}`}>
            <Info
              className="h-4 w-4 shrink-0 text-amber-400 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-xs text-app-text-secondary leading-relaxed">
              {category === "fixedCosts"
                ? "Décomposez vos charges fixes en lignes distinctes. Le total sera utilisé comme montant global."
                : "Décomposez votre épargne par enveloppe (livrets, placements…). Le total sera utilisé comme objectif mensuel."}
            </p>
          </div>

          {/* Liste des lignes */}
          {items.length > 0 && (
            <ul
              aria-label={`Lignes détaillées — ${label}`}
              className="space-y-2"
            >
              {items.map((item, index) => {
                const namePlaceholder =
                  placeholders.names[index % placeholders.names.length];
                return (
                  <li key={item.id}>
                    <LineRow
                      item={item}
                      namePlaceholder={namePlaceholder}
                      nameInputId={`${uid}-name-${item.id}`}
                      amountInputId={`${uid}-amount-${item.id}`}
                      lineNumber={index + 1}
                      onNameChange={(v) => handleNameChange(item.id, v)}
                      onAmountChange={(v) => handleAmountChange(item.id, v)}
                      onDelete={() => handleDeleteLine(item.id)}
                      currencySymbol={symbol}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {/* Séparateur + total */}
          {items.length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-app-border/60">
              <span className="text-xs text-app-text-secondary">Total</span>
              <span
                className="text-sm font-semibold tabular-nums text-app-text"
                aria-live="polite"
              >
                {detailedTotalDisplay}
              </span>
            </div>
          )}

          {/* Bouton d'ajout */}
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAddLine}
            className="
              w-full flex items-center justify-center gap-2 py-2 rounded-lg
              border border-dashed border-app-border text-app-text-secondary text-sm
              hover:border-amber-500/60 hover:text-amber-400
              transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500
            "
            aria-label={`Ajouter une ligne à ${label}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter une ligne
          </button>
    </div>
  ) : null;

  if (variant === "inline") {
    return detailPanel;
  }

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      className="rounded-xl border border-app-border bg-app-surface overflow-hidden"
    >
      {/* ── En-tête : titre + toggle ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            id={`${uid}-heading`}
            className="font-semibold text-sm text-app-text truncate"
          >
            {label}
          </span>

          {/* Montant agrégé en mode simple (informatif) */}
          {!enabled && (
            <span
              className="text-xs text-app-text-secondary tabular-nums"
              aria-label={`Montant global : ${aggregateAmountDisplay}`}
            >
              — {aggregateAmountDisplay}
            </span>
          )}

          {/* Total calculé en mode détaillé */}
          {enabled && items.length > 0 && (
            <span
              id={totalId}
              className="text-xs text-amber-400 font-medium tabular-nums"
              aria-live="polite"
              aria-label={`Total détaillé : ${detailedTotalDisplay}`}
            >
              — {detailedTotalDisplay}
            </span>
          )}
        </div>

        {/* Bouton d'expansion / toggle mode détaillé */}
        <button
          id={toggleId}
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-controls={panelId}
          onClick={handleToggle}
          className={`
            relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
            transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500
            focus:ring-offset-2 focus:ring-offset-app-surface
            ${enabled ? "bg-amber-500" : "bg-app-border"}
          `}
          aria-label={`Mode détaillé pour ${label}`}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow
              transition-transform
              ${enabled ? "translate-x-6" : "translate-x-1"}
            `}
          />
        </button>
      </div>

      {/* ── Corps : affiché uniquement en mode détaillé ─────────────────── */}
      {detailPanel}
    </section>
  );
}
