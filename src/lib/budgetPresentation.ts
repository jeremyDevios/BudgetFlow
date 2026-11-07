/**
 * Présentation des budgets (icônes, couleurs, libellés) — partagée entre le
 * sélecteur du dashboard et l'écran de gestion des Paramètres.
 *
 * Les palettes d'icônes (Lucide) et de couleurs (Tailwind) sont les MÊMES que
 * celles des enveloppes (exportées par TemporaryEnvelopeForm) pour rester dans
 * le thème de l'application.
 */
import { Wallet, type LucideIcon } from "lucide-react";

import {
  COLORS as ENVELOPE_COLORS,
  ICON_MAP as ENVELOPE_ICON_MAP,
  ICONS_LIST as ENVELOPE_ICONS_LIST,
} from "@/components/settings/TemporaryEnvelopeForm";

export const BUDGET_COLORS = ENVELOPE_COLORS;
export const BUDGET_ICON_MAP = ENVELOPE_ICON_MAP;
export const BUDGET_ICONS_LIST = ENVELOPE_ICONS_LIST;

/** Icône de repli pour une clé inconnue ou manquante. */
export const DEFAULT_BUDGET_ICON_KEY = "Wallet";

/** Libellé du budget par défaut (pas de document, donc pas de nom stocké). */
export const DEFAULT_BUDGET_LABEL = "Principal";

/** Résout la clé d'icône stockée vers un composant Lucide (repli Wallet). */
export function budgetIconFor(icon: string): LucideIcon {
  return BUDGET_ICON_MAP[icon] ?? Wallet;
}
