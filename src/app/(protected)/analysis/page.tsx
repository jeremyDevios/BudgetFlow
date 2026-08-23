"use client";

import { useAuth } from "@/context/AuthContext";
import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";
import { useAnalysis } from "@/hooks/useAnalysis";
import { formatMonthYear } from "@/lib/dateUtils";
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisPeriod } from "@/lib/analysisEngine";

// ── Constantes (alignées sur la vue Analyse iOS) ──────────────────────

const PERIODS: { key: AnalysisPeriod; label: string }[] = [
  { key: "month", label: "Mois" },
  { key: "last7Days", label: "7J" },
  { key: "last30Days", label: "30J" },
  { key: "last3Months", label: "3M" },
  { key: "last6Months", label: "6M" },
];

const PERIOD_DESC: Record<AnalysisPeriod, string> = {
  month: "",
  last7Days: "7 derniers jours",
  last30Days: "30 derniers jours",
  last3Months: "3 derniers mois",
  last6Months: "6 derniers mois",
};

type SignalKey =
  | "depensesVsRevenus"
  | "evolutionStable"
  | "budgetRespecte"
  | "regulariteDepenses"
  | "sansDepensesImpulsives";

const SIGNALS: { key: SignalKey; label: string; max: number }[] = [
  { key: "depensesVsRevenus", label: "Équilibre du budget", max: 30 },
  { key: "evolutionStable", label: "Variation du rythme de dépense", max: 20 },
  { key: "budgetRespecte", label: "Enveloppes dans les clous", max: 20 },
  { key: "regulariteDepenses", label: "Rythme sans écart", max: 20 },
  { key: "sansDepensesImpulsives", label: "Peu d'achat démesuré", max: 10 },
];

// ── Sous-composants ───────────────────────────────────────────────────

/** Barres de signal à la iOS (SignalStrengthBars) : 4 barres allumées selon le ratio. */
function SignalBars({ value, max }: { value: number; max: number }) {
  const active = value > 0 ? Math.max(1, Math.round((value / max) * 4)) : 0;
  const heights = [6, 10, 14, 18];
  return (
    <div className="flex items-end gap-0.5" aria-label={`${value} sur ${max}`}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 400, damping: 25 }}
          style={{ height: h, transformOrigin: "bottom" }}
          className={`w-1 rounded-sm ${i < active ? "bg-amber-500" : "bg-app-border"}`}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { user } = useAuth();
  const { formatAmount } = useCurrencyFormatting();
  const router = useRouter();

  const [period, setPeriod] = useState<AnalysisPeriod>("month");
  const [monthDate, setMonthDate] = useState(() => new Date());

  const { result, spendByEnvelope, monthlyIncome, loading } = useAnalysis({
    userId: user?.uid ?? null,
    period,
    monthDate,
  });

  // Chevron droit limité au mois courant.
  const now = new Date();
  const isCurrentMonth =
    monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();

  const changeMonth = (dir: 1 | -1) => {
    setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + dir, 1));
  };

  // Tendance du rythme de dépense vs période précédente.
  const trend = useMemo(() => {
    if (!result || result.previousDayCount <= 0) return null;
    const prevRate = result.previousPeriodSpend / result.previousDayCount;
    if (prevRate <= 0) return null;
    const currentRate = result.totalDepenses / Math.max(result.dayCount, 1);
    return {
      pct: (currentRate / prevRate - 1) * 100,
      rising: currentRate > prevRate,
    };
  }, [result]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center text-amber-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!result || monthlyIncome <= 0) {
    return (
      <div className="min-h-screen bg-app-bg text-app-text p-4">
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-app-surface border border-app-border hover:bg-app-surface transition-colors"
            aria-label="Retour"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="text-amber-500" />
            Analyse
          </h1>
        </header>
        <div className="bg-app-surface/50 border border-app-border rounded-3xl p-8 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-app-text-secondary max-w-sm mx-auto">
            Renseignez vos revenus dans l&apos;onboarding ou les réglages pour accéder aux analyses.
          </p>
          <button
            onClick={() => router.push("/settings")}
            className="mt-6 px-5 py-2.5 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors active:scale-95"
          >
            Aller aux réglages
          </button>
        </div>
      </div>
    );
  }

  const s = result.scoreDetails;
  const scoreColor =
    s.total >= 80 ? "text-emerald-400" : s.total >= 60 ? "text-amber-500" : "text-red-400";

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 pb-20">
      {/* ── Header ── */}
      <header className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-app-surface border border-app-border hover:bg-app-surface transition-colors"
          aria-label="Retour"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="text-amber-500" />
          Analyse
        </h1>
      </header>

      {/* ── Sélecteur de période ── */}
      <div className="glass-panel flex items-center gap-1 rounded-full p-1 w-fit mx-auto mb-3">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              period === p.key
                ? "bg-amber-500 text-white shadow-lg shadow-amber-900/20"
                : "text-app-text-secondary hover:text-app-text"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Sous-titre : mois sélectionnable (mode Mois) ou description de période */}
      {period === "month" ? (
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => changeMonth(-1)}
            className="p-1.5 rounded-full text-app-text-secondary hover:text-app-text hover:bg-app-surface active:scale-75 transition-all"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold capitalize w-32 text-center select-none">
            {formatMonthYear(monthDate)}
          </span>
          <button
            onClick={() => changeMonth(1)}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-full text-app-text-secondary hover:text-app-text hover:bg-app-surface active:scale-75 transition-all disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="text-center text-sm text-app-text-secondary mb-6">
          {PERIOD_DESC[period]}
        </p>
      )}

      {/* ── Score du budget ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="bg-app-surface/50 border border-app-border rounded-3xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Score du budget
          </h2>
          <motion.span
            key={s.total}
            initial={{ scale: 1.4, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className={`text-3xl font-bold tabular-nums ${scoreColor}`}
          >
            {s.total}
            <span className="text-sm text-app-text-secondary font-medium">/100</span>
          </motion.span>
        </div>

        {/* Barre de progression */}
        <div className="h-2.5 bg-app-bg rounded-full overflow-hidden mb-5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${s.total}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className={`h-full rounded-full ${s.total >= 60 ? "bg-gradient-to-r from-amber-500 to-emerald-500" : "bg-gradient-to-r from-red-500 to-amber-500"}`}
          />
        </div>

        {/* 5 signaux */}
        <div className="space-y-3">
          {SIGNALS.map((sig) => {
            const value = s[sig.key];
            return (
              <div key={sig.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-app-text-secondary flex-1">{sig.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold tabular-nums w-8 text-right">
                    {value}
                    <span className="text-app-text-secondary font-normal">/{sig.max}</span>
                  </span>
                  <SignalBars value={value} max={sig.max} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Tendance vs période précédente */}
        {trend && (
          <div className="mt-5 pt-4 border-t border-app-border flex items-center justify-between">
            <span className="text-xs text-app-text-secondary">
              Rythme de dépense vs période précédente
            </span>
            <span
              className={`text-sm font-bold tabular-nums ${trend.rising ? "text-red-400" : "text-emerald-400"}`}
            >
              {trend.rising ? "▲" : "▼"} {Math.abs(trend.pct).toFixed(1)} %
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Métriques clés ── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="mt-6 grid grid-cols-2 gap-3"
      >
        {[
          { label: "Dépenses", value: formatAmount(result.totalDepenses), tone: "text-red-400" },
          { label: "Revenus supplémentaires", value: `+${formatAmount(result.totalRevenus)}`, tone: "text-emerald-400" },
          { label: "Moy. / jour", value: formatAmount(result.moyenneJourDepense), tone: "" },
          { label: "Médiane / jour", value: formatAmount(result.medianeJourDepense), tone: "" },
          { label: "Nb dépenses", value: String(result.nombreDepenses), tone: "" },
          { label: "Nb transac revenus", value: String(result.nombreRevenus), tone: "" },
          {
            label: "Taux d'épargne",
            value: `${result.tauxEpargne.toFixed(1)} %`,
            tone: result.tauxEpargne >= 0 ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "Jours sans dépense",
            value: `${result.joursSansDepense} j`,
            sub: `sur ${result.dayCount} jours`,
            tone: "",
          },
        ].map((m) => (
          <motion.div
            key={m.label}
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
            }}
            className="bg-app-surface/50 border border-app-border rounded-2xl p-4"
          >
            <div className="text-xs text-app-text-secondary mb-1">{m.label}</div>
            <div className={`text-lg font-bold tabular-nums truncate ${m.tone || "text-app-text"}`}>
              {m.value}
            </div>
            {m.sub && <div className="text-xs text-app-text-secondary mt-0.5">{m.sub}</div>}
          </motion.div>
        ))}
      </motion.div>

      {/* ── Enveloppes en tête ── */}
      {(result.enveloppePlusDepenses || result.enveloppePlusFrequente) && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.enveloppePlusDepenses && (
            <div className="bg-app-surface/50 border border-app-border rounded-2xl p-4">
              <div className="text-xs text-app-text-secondary mb-2">Enveloppe la plus dépensée</div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold truncate">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${result.enveloppePlusDepenses.color || "bg-amber-500"}`} />
                  <span className="truncate">{result.enveloppePlusDepenses.name}</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-red-400 ml-3 flex-shrink-0">
                  {formatAmount(result.enveloppePlusDepenses.value)}
                </span>
              </div>
            </div>
          )}
          {result.enveloppePlusFrequente && (
            <div className="bg-app-surface/50 border border-app-border rounded-2xl p-4">
              <div className="text-xs text-app-text-secondary mb-2">Enveloppe la plus utilisée</div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold truncate">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${result.enveloppePlusFrequente.color || "bg-amber-500"}`} />
                  <span className="truncate">{result.enveloppePlusFrequente.name}</span>
                </span>
                <span className="text-sm font-bold tabular-nums ml-3 flex-shrink-0">
                  × {result.enveloppePlusFrequente.value}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Répartition par enveloppe ── */}
      {spendByEnvelope.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 24 }}
          className="mt-6 bg-app-surface/50 border border-app-border rounded-3xl p-6"
        >
          <h3 className="font-semibold mb-1">Répartition par enveloppe</h3>
          <p className="text-xs text-app-text-secondary mb-4">
            Dépenses nettes (remboursements déduits) sur la période
          </p>

          <div className="w-full" style={{ height: Math.max(160, Math.min(spendByEnvelope.length, 8) * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendByEnvelope.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-border)" }}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatAmount(Number(value)), "Dépensé"]}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chips détaillées (avec les vraies couleurs d'enveloppe) */}
          {spendByEnvelope.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {spendByEnvelope.map((e) => (
                <span
                  key={e.envelopeId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-app-bg border border-app-border text-xs"
                >
                  <span className={`w-2 h-2 rounded-full ${e.color || "bg-amber-500"}`} />
                  <span className="font-medium max-w-[10rem] truncate">{e.name}</span>
                  <span className="text-app-text-secondary tabular-nums">{formatAmount(e.value)}</span>
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
