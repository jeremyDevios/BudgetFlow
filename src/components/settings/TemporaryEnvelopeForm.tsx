"use client";

/**
 * TemporaryEnvelopeForm
 *
 * Self-contained form for creating or editing an envelope.
 * Manages its own field state (initialized from `initialValues`) and calls
 * `onSave` with the collected values when the user confirms.
 *
 * Exported constants (ICON_MAP, ICONS_LIST, COLORS) are re-used by
 * settings/page.tsx so the two files share a single source of truth.
 */

import { useState } from "react";
import { getCurrencySymbol } from "@/types/currency";
import { useCurrency } from "@/context/CurrencyContext";
import { validateEnvelopeNameWithMessage } from "@/lib/validation";
import {
  AlertTriangle,
  Clock,
  ShoppingCart,
  Fuel,
  Utensils,
  Plane,
  Heart,
  Gamepad2,
  Bus,
  Shirt,
  Music,
  Coffee,
  Briefcase,
  GraduationCap,
  Baby,
  PawPrint,
  Gift,
  Smartphone,
  Wifi,
  Zap,
  Droplets,
  Hammer,
  LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Shared constants (also exported for settings/page.tsx)
// ---------------------------------------------------------------------------

export const ICONS_LIST = [
  "ShoppingCart", "Fuel", "Utensils", "Plane", "Heart", "Gamepad2",
  "Bus", "Shirt", "Music", "Coffee", "Briefcase", "GraduationCap",
  "Baby", "PawPrint", "Gift", "Smartphone", "Wifi", "Zap", "Droplets", "Hammer",
];

export const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer,
};

export const COLORS = [
  "bg-amber-500", "bg-blue-500", "bg-green-500", "bg-red-500", "bg-purple-500",
  "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All values the form collects and hands back to the parent. */
export interface EnvelopeFormValues {
  name: string;
  budget: string;
  icon: string;
  color: string;
  isTemporary: boolean;
  /** YYYY-MM strings for every month the envelope should be visible. */
  activeMonths: string[];
}

interface Props {
  initialValues: EnvelopeFormValues;
  /**
   * Pre-computed budget headroom:
   *   income − fixed-costs − savings − (all other envelopes except the one being edited)
   * The form uses this to render the "après allocation" indicator.
   */
  budgetAvailable: number;
  /** true when editing an existing envelope, false when creating a new one. */
  isEditing: boolean;
  onSave: (values: EnvelopeFormValues) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Month-option helpers
// ---------------------------------------------------------------------------

/** Returns 12 months: 2 past + current + 9 future (YYYY-MM, French short label). */
function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let offset = -2; offset < 10; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    options.push({ value, label });
  }
  return options;
}

// Stable reference — options never change during a browser session.
const MONTH_OPTIONS = buildMonthOptions();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemporaryEnvelopeForm({
  initialValues,
  budgetAvailable,
  isEditing,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialValues.name);
  const [budget, setBudget] = useState(initialValues.budget);
  const [icon, setIcon] = useState(initialValues.icon);
  const [color, setColor] = useState(initialValues.color);
  const [isTemporary, setIsTemporary] = useState(initialValues.isTemporary);
  const [activeMonths, setActiveMonths] = useState<string[]>(initialValues.activeMonths);
  const [nameError, setNameError] = useState<string | null>(null);

  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);

  const currentBudget = parseFloat(budget) || 0;
  const afterAllocation = budgetAvailable - currentBudget;

  const handleNameChange = (value: string) => {
    setName(value);
    const check = validateEnvelopeNameWithMessage(value);
    setNameError(check.valid ? null : check.message);
  };

  // Save is blocked when: name/budget empty, validation error, or temporary with no months.
  const canSave =
    name.trim().length > 0 &&
    !nameError &&
    budget.trim().length > 0 &&
    parseFloat(budget) > 0 &&
    (!isTemporary || activeMonths.length > 0);

  const toggleMonth = (month: string) => {
    setActiveMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month],
    );
  };

  const handleToggleTemporary = () => {
    // Preserve month selection when toggling off so re-enabling feels non-destructive.
    setIsTemporary((prev) => !prev);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      budget,
      icon,
      color,
      isTemporary,
      activeMonths: isTemporary ? activeMonths : [],
    });
  };

  const IconComp = ICON_MAP[icon] || ShoppingCart;

  return (
    <div className="space-y-4">

      {/* ── Name ── */}
      <div>
        <label className="block text-sm text-app-text-secondary mb-1">Nom</label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
          placeholder="Ex : Vacances"
          autoFocus
        />
        {nameError && (
          <p className="mt-1 text-xs text-red-400" role="alert">{nameError}</p>
        )}
      </div>

      {/* ── Budget ── */}
      <div>
        <label className="block text-sm text-app-text-secondary mb-1">Budget mensuel</label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
            placeholder="0"
          />
          <span className="absolute right-3 top-2 text-app-text-secondary">{symbol}</span>
        </div>

        {/* Availability indicator */}
        <div
          className={`mt-2 rounded-lg border p-3 ${
            afterAllocation < 0
              ? "bg-red-900/20 border-red-800"
              : "bg-green-900/20 border-green-800"
          }`}
        >
          <p className="text-xs text-app-text-secondary">
            Budget disponible :{" "}
            <span className="font-semibold text-app-text">{budgetAvailable.toFixed(2)} {symbol}</span>
          </p>
          <p className="text-xs mt-1">
            Après allocation :{" "}
            <span
              className={`font-semibold ${
                afterAllocation >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {afterAllocation.toFixed(2)} {symbol}
            </span>
          </p>
          {afterAllocation < 0 && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Ce budget dépasse le solde disponible.
            </p>
          )}
        </div>
      </div>

      {/* ── Icon picker ── */}
      <div>
        <label className="block text-sm text-app-text-secondary mb-2">Icône</label>
        <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-1">
          {ICONS_LIST.map((iconName) => {
            const I = ICON_MAP[iconName];
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => setIcon(iconName)}
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                  icon === iconName
                    ? "bg-amber-500 text-black"
                    : "bg-app-bg text-app-text-secondary hover:bg-app-surface"
                }`}
              >
                <I className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Color picker ── */}
      <div>
        <label className="block text-sm text-app-text-secondary mb-2">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full ${c} ${
                color === c
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "opacity-50 hover:opacity-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Temporary toggle block ── */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--color-temporary-bg)",
          border: "1px solid var(--color-temporary)",
        }}
      >
        {/* Toggle row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--color-temporary)" }} />
            <span className="font-medium text-sm">Enveloppe temporaire</span>
          </div>

          {/* Accessible toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={isTemporary}
            onClick={handleToggleTemporary}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-app-surface ${
              isTemporary ? "bg-amber-500" : "bg-app-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isTemporary ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <p className="mt-1 text-xs text-app-text-secondary">
          N&apos;apparaît que pendant les mois sélectionnés.
        </p>

        {/* ── Month multi-select (shown only when temporary is on) ── */}
        {isTemporary && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">
              Mois actifs
              <span className="ml-2 text-xs text-app-text-secondary">
                ({activeMonths.length} sélectionné{activeMonths.length !== 1 ? "s" : ""})
              </span>
            </p>

            <div className="flex flex-wrap gap-2">
              {MONTH_OPTIONS.map(({ value, label }) => {
                const selected = activeMonths.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleMonth(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selected
                        ? "bg-amber-500 text-black"
                        : "bg-app-bg border border-app-border text-app-text-secondary hover:border-amber-500/60"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Guard message — mirrors the save-block logic */}
            {activeMonths.length === 0 && (
              <p className="text-xs text-red-400 flex items-center gap-1 pt-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Sélectionnez au moins un mois actif.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-app-surface font-bold hover:opacity-80 transition-opacity"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? "Mettre à jour" : "Créer"}
        </button>
      </div>
    </div>
  );
}
