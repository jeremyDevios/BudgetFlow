"use client";

import { RefreshCw } from "lucide-react";

/**
 * Petite pastille « roue récurrente » identifiant les dépenses récurrentes
 * (séries créées par la récurrence mensuelle, iOS ou web).
 * Discret : icône dans un cercle au fond du thème.
 */
export default function RecurrenceBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Dépense récurrente"
      aria-label="Dépense récurrente"
      className={`inline-flex items-center justify-center rounded-full bg-app-bg border border-app-border text-app-text-secondary ${className}`}
    >
      <RefreshCw className="h-3 w-3" />
    </span>
  );
}
