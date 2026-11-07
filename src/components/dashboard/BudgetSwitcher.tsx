"use client";

import { Check, Home } from "lucide-react";

import { useBudget } from "@/context/BudgetContext";
import {
  DEFAULT_BUDGET_LABEL,
  budgetIconFor,
} from "@/lib/budgetPresentation";
import { DEFAULT_BUDGET_ID, type Budget } from "@/types/budget";

interface BudgetChipProps {
  label: string;
  iconKey: string;
  colorClass: string;
  active: boolean;
  onSelect: () => void;
  testId: string;
}

function BudgetChip({
  label,
  iconKey,
  colorClass,
  active,
  onSelect,
  testId,
}: BudgetChipProps) {
  const Icon = iconKey === "home" ? Home : budgetIconFor(iconKey);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={testId}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-amber-500/60 bg-amber-500/10 text-app-text"
          : "border-app-border bg-app-surface/60 text-app-text-secondary hover:text-app-text hover:bg-app-surface"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} aria-hidden="true" />
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="max-w-28 truncate">{label}</span>
      {active && <Check className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />}
    </button>
  );
}

/**
 * Sélecteur de budget du dashboard : puces horizontales (pastille de couleur
 * + icône + nom). Le budget par défaut (« Principal ») est toujours le
 * premier.
 *
 * Masqué tant qu'aucun budget supplémentaire n'existe : l'UI mono-budget
 * reste strictement identique à aujourd'hui (décision MULTI_BUDGET.md §9).
 */
export default function BudgetSwitcher({ className = "" }: { className?: string }) {
  const { budgets, currentBudgetId, switchBudget } = useBudget();

  if (budgets.length === 0) return null;

  const defaultColor = "bg-amber-500";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      data-testid="budget-switcher"
      role="group"
      aria-label="Sélection du budget"
    >
      <BudgetChip
        label={DEFAULT_BUDGET_LABEL}
        iconKey="home"
        colorClass={defaultColor}
        active={currentBudgetId === DEFAULT_BUDGET_ID}
        onSelect={() => void switchBudget(DEFAULT_BUDGET_ID)}
        testId="budget-chip-default"
      />
      {budgets.map((budget: Budget) => (
        <BudgetChip
          key={budget.id}
          label={budget.name}
          iconKey={budget.icon}
          colorClass={budget.color}
          active={currentBudgetId === budget.id}
          onSelect={() => void switchBudget(budget.id)}
          testId={`budget-chip-${budget.id}`}
        />
      ))}
    </div>
  );
}
