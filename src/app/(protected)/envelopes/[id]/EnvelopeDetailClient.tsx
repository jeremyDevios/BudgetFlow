"use client";

import { useAuth } from "@/context/AuthContext";
import { useAnonymousMode } from "@/context/AnonymousModeContext";
import { db } from "@/lib/firebase";
import { getMonthBounds, formatMonthYear } from "@/lib/dateUtils";
import { useSpendingForecast } from "@/hooks/useSpendingForecast";
import { useSmartSpendingInsights } from "@/hooks/useSmartSpendingInsights";
import { ForecastTransaction } from "@/lib/forecasting";
import { collection, doc, getDoc, getDocs, orderBy, query, where, deleteDoc, limit } from "firebase/firestore";
import { MoveLeft, Trash2, Calendar, Plus, ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee, Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer, LucideIcon, AlertTriangle, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, use } from "react";
import TransactionModal from "@/components/dashboard/TransactionModal";
import RotatingSmartInsight from "@/components/dashboard/RotatingSmartInsight";
import { logger } from "@/lib/logger";
import { maskAmount } from "@/lib/maskAmount";
import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrencySymbol, getCurrencyLocale } from "@/types/currency";
import { type Envelope } from "@/types/envelope";
import { type Transaction } from "@/types/transaction";

function maskCurrencyText(text: string, currency: string) {
  const symbol = getCurrencySymbol(currency as import("@/types/currency").CurrencyCode);
  const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`([+-]?)(\\d[\\d\\s.,]*)\\s*${escapedSymbol}`, "gu");
  return text.replace(regex, (_match: string, sign: string) => {
    const locale = getCurrencyLocale(currency as import("@/types/currency").CurrencyCode);
    const masked = maskAmount({
      amount: sign === "-" ? -1 : 1,
      currency,
      locale,
      anonymousMode: true,
    });
    return sign === "+"
      ? `+${masked}`
      : sign === "-"
        ? masked
        : masked;
  });
}

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer
};

export default function EnvelopeDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const { anonymousMode } = useAnonymousMode();
  const { formatAmount, symbol, currency } = useCurrencyFormatting();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);

  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [allEnvelopes, setAllEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

  const txImpact = (tx: { amount: number; isReimbursement?: boolean }) =>
    tx.isReimbursement ? -tx.amount : tx.amount;

  // Date context
  const dateParam = searchParams.get('date');
  const contextDate = dateParam ? new Date(dateParam) : null;

  const fetchData = async () => {
    if (!user || !id) return;
    try {
      // 1. Info Enveloppe Courante
      const envRef = doc(db, "users", user.uid, "envelopes", id);
      const envSnap = await getDoc(envRef);
      if (envSnap.exists()) {
        setEnvelope({ id: envSnap.id, ...envSnap.data() } as Envelope);
      } else {
        router.push("/dashboard"); // Enveloppe introuvable
        return;
      }

      // 1b. Charger TOUTES les enveloppes (pour la modale d'édition)
      const allEnvRef = collection(db, "users", user.uid, "envelopes");
      const allEnvSnap = await getDocs(allEnvRef);
      const allEnvList: Envelope[] = [];
      allEnvSnap.forEach(doc => {
        allEnvList.push({ id: doc.id, ...doc.data() } as Envelope);
      });

      // Aligner la modale avec le dashboard: le "spent" affiché doit être mensuel.
      if (contextDate) {
        const { start, end } = getMonthBounds(contextDate);
        const monthlyTxRef = collection(db, "users", user.uid, "transactions");
        const monthlyTxQuery = query(
          monthlyTxRef,
          where("date", ">=", start),
          where("date", "<=", end)
        );

        const monthlyTxSnap = await getDocs(monthlyTxQuery);
        const monthlySpentByEnvelope: Record<string, number> = {};

        monthlyTxSnap.forEach((txDoc) => {
          const txData = txDoc.data() as any;
          if (!txData.envelopeId) return;
          monthlySpentByEnvelope[txData.envelopeId] =
            (monthlySpentByEnvelope[txData.envelopeId] || 0) +
            txImpact({
              amount: Number(txData.amount || 0),
              isReimbursement: txData.isReimbursement ?? false,
            });
        });

        const allEnvWithMonthlySpent = allEnvList.map((env) => ({
          ...env,
          spent: monthlySpentByEnvelope[env.id] || 0,
        }));

        setAllEnvelopes(allEnvWithMonthlySpent);
      } else {
        setAllEnvelopes(allEnvList);
      }

      // 2. Transactions
      const txRef = collection(db, "users", user.uid, "transactions");
      let q;
      let dateFilter: { start: string, end: string } | null = null;

      if (contextDate) {
        const { start, end } = getMonthBounds(contextDate);
        dateFilter = { start, end };
        q = query(txRef, where("envelopeId", "==", id));
      } else {
        q = query(
          txRef,
          where("envelopeId", "==", id),
          orderBy("date", "desc"),
          limit(50)
        );
      }

      const txSnap = await getDocs(q);
      const txList: any[] = [];
      txSnap.forEach(doc => {
        const data = doc.data() as any;
        if (dateFilter) {
          if (data.date >= dateFilter.start && data.date <= dateFilter.end) {
            txList.push({ id: doc.id, ...data });
          }
        } else {
          txList.push({ id: doc.id, ...data });
        }
      });

      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txList);

    } catch (error) {
      logger.sanitizedError("Erreur chargement enveloppe", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, id, dateParam]);

  // Forecast computation
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = contextDate
    ? (contextDate.getFullYear() === today.getFullYear() && contextDate.getMonth() === today.getMonth())
    : true; // No date param = recent history view, show forecast

  const currentMonthOnlyTransactions = transactions.filter((transaction) =>
    typeof transaction.date === "string" && transaction.date.slice(0, 7) === currentMonthKey
  );
  const currentMonthSpent = currentMonthOnlyTransactions.reduce(
    (sum, transaction) =>
      sum + txImpact({ amount: Number(transaction.amount || 0), isReimbursement: transaction.isReimbursement ?? false }),
    0
  );
  const currentMonthPercentOfBudget =
    (envelope?.budget ?? 0) > 0 ? (currentMonthSpent / envelope!.budget) * 100 : 0;
  const currentMonthRemaining = (envelope?.budget || 0) - currentMonthSpent;

  const forecastTransactions: ForecastTransaction[] = currentMonthOnlyTransactions.map(tx => ({
    envelopeId: tx.envelopeId || '',
    amount: tx.amount || 0,
    date: tx.date || '',
    isReimbursement: tx.isReimbursement ?? false,
  }));

  const envelopeForForecast = envelope
    ? [{ id: envelope.id, budget: envelope.budget || 0, name: envelope.name || '' }]
    : [];

  const { envelopeForecasts, loading: forecastLoading } = useSpendingForecast({
    userId: user?.uid ?? null,
    envelopes: envelopeForForecast,
    currentMonthTransactions: forecastTransactions,
    monthlyBudget: envelope?.budget || 0,
    isCurrentMonth,
  });

  const forecast = envelope ? envelopeForecasts[envelope.id] : null;
  const { envelopeNotifications, loading: smartInsightsLoading } =
    useSmartSpendingInsights({
      userId: user?.uid ?? null,
      envelopes: envelope
        ? [{ id: envelope.id, name: envelope.name || "", budget: envelope.budget || 0 }]
        : [],
      currentMonthTransactions: currentMonthOnlyTransactions.map((transaction) => ({
        id: transaction.id,
        envelopeId: transaction.envelopeId || "",
        amount: transaction.amount || 0,
        date: transaction.date || "",
        description: transaction.description || "",
        isReimbursement: transaction.isReimbursement ?? false,
      })),
      envelopeForecasts,
      isCurrentMonth,
    });

  const envelopeInsightNotifications = envelope
    ? envelopeNotifications[envelope.id] ?? []
    : [];
  const visibleEnvelopeInsightNotifications = anonymousMode
    ? envelopeInsightNotifications.map((notification) => ({
        ...notification,
        title: maskCurrencyText(notification.title, currency),
        description: maskCurrencyText(notification.description, currency),
      }))
    : envelopeInsightNotifications;

  const handleDeleteTransaction = async (txId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette dépense ?")) return;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "transactions", txId));
      setTransactions(transactions.filter(t => t.id !== txId));
    } catch (error) {
      logger.sanitizedError("Erreur suppression", error);
    }
  };

  const handleEditClick = (tx: any) => {
    setTransactionToEdit(tx);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setTransactionToEdit(null);
  };

  const handleOpenCreateModal = () => {
    setTransactionToEdit(null);
    setIsEditModalOpen(true);
  };


  if (loading) return <div className="min-h-screen bg-app-bg text-app-text p-8">Chargement...</div>;
  if (!envelope) return null;

  const Icon = ICON_MAP[envelope.icon] || ShoppingCart;

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 pb-20">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => router.back()}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-2 bg-app-surface rounded-full hover:bg-app-surface transition-colors"
          >
            <MoveLeft className="h-6 w-6" />
          </motion.button>
          <div className={`p-3 rounded-xl ${envelope.color} text-app-text border border-app-border`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{envelope.name}</h1>
            <p className="text-app-text-secondary">
              {contextDate ? `Dépenses de ${formatMonthYear(contextDate)}` : "Historique récent"}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          aria-label="Nouvelle Dépense"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-5 rounded-xl transition-transform active:scale-95 animate-fab-pulse shadow-lg shadow-amber-900/20"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Nouvelle Dépense</span>
        </button>
      </header>

      {/* Forecast Card */}
      {isCurrentMonth && !loading && (
        <motion.div
          className="max-w-3xl mx-auto mb-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-app-surface border border-app-border rounded-xl p-4">
                {forecastLoading ? (
                  <div className="animate-pulse h-6 bg-app-bg rounded w-2/3" />
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-xs text-app-text-secondary">
                        <span className="font-medium text-app-text">
                          Progression réelle du mois
                        </span>
                        <span className="tabular-nums">
                          {formatAmount(currentMonthSpent)} / {formatAmount(envelope?.budget || 0)}
                        </span>
                      </div>

                      <div
                        className="h-1.5 bg-app-bg rounded-full overflow-hidden"
                        aria-label="Progression réelle du mois"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            currentMonthPercentOfBudget > 100
                              ? "bg-red-500"
                              : envelope?.color || "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(currentMonthPercentOfBudget, 100)}%` }}
                        />
                      </div>

                      <div className="flex justify-between gap-3 text-xs text-app-text-secondary">
                        <span>{currentMonthPercentOfBudget.toFixed(0)}% du budget consommé à date</span>
                        <span className="tabular-nums">
                          Reste réel : {formatAmount(currentMonthRemaining)}
                        </span>
                      </div>
                    </div>

                    {!forecast || !forecast.hasData ? (
                      <div className="flex items-center gap-2 border-t border-app-border pt-3 text-app-text-secondary text-sm">
                        <TrendingUp className="h-4 w-4 shrink-0" />
                        <span>Pas assez d&apos;historique pour estimer cette enveloppe</span>
                      </div>
                    ) : (
                      <div className="space-y-2 border-t border-app-border pt-3">
                        <div className={`flex items-center gap-2 text-sm font-semibold ${forecast.willExceed ? 'text-red-400' : 'text-emerald-400'}`}>
                          {forecast.willExceed ? (
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                          ) : (
                            <TrendingUp className="h-4 w-4 shrink-0" />
                          )}
                          <span>
                            {forecast.willExceed
                              ? `Risque de dépassement : +${formatAmount(forecast.excessAmount)}`
                              : `Projection fin de mois : ${formatAmount(forecast.projectedSpend)} / ${formatAmount(envelope?.budget || 0)}`
                            }
                          </span>
                        </div>

                        <div
                          className="h-1.5 bg-app-bg rounded-full overflow-hidden"
                          aria-label="Progression estimée fin de mois"
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              forecast.percentOfBudget > 100 ? 'bg-red-500' :
                              forecast.percentOfBudget > 80 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(forecast.percentOfBudget, 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs text-app-text-secondary">
                          <span>{forecast.percentOfBudget.toFixed(0)}% du budget estimé en fin de mois</span>
                          <span>Basé sur {forecast.monthsWithData} mois de données</span>
                        </div>
                      </div>
                    )}

                    {smartInsightsLoading ? (
                      <div className="mt-2 h-16 animate-pulse rounded-xl bg-app-bg" />
                    ) : (
                      <RotatingSmartInsight
                        notifications={visibleEnvelopeInsightNotifications}
                        className="mt-2"
                      />
                    )}
                  </div>
                )}
          </div>
        </motion.div>
      )}

      <motion.div
        className="space-y-4 max-w-3xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-app-text-secondary border border-dashed border-app-border rounded-xl">
            Aucune dépense pour le moment.
          </div>
        ) : (
          <AnimatePresence>
            {transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 28,
                      delay: Math.min(index, 18) * 0.05
                    }
                  }
                }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.1 }}
                exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
              >
                <div
                  onClick={() => handleEditClick(tx)}
                  className="flex justify-between items-center bg-app-surface/50 border border-app-border p-4 rounded-xl cursor-pointer hover:bg-app-surface transition-colors transition-all duration-150 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-app-bg rounded-full text-app-text-secondary group-hover:bg-app-bg transition-colors">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-app-text">{tx.description || "Dépense"}</p>
                      <p className="text-xs text-app-text-secondary">{new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${tx.isReimbursement ? "text-emerald-400" : "text-red-400"}`}>
                      {`${tx.isReimbursement ? "+" : "-"}${formatAmount(Number(tx.amount || 0))}`}
                    </span>
                    <button
                      onClick={(e) => handleDeleteTransaction(tx.id, e)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors z-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      <TransactionModal
        isOpen={isEditModalOpen}
        onClose={closeModal}
        envelopes={allEnvelopes}
        refreshData={fetchData}
        transactionToEdit={transactionToEdit}
        defaultEnvelopeId={envelope.id}
      />
    </div>
  );
}
