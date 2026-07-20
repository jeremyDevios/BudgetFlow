"use client";

import { useAuth } from "@/context/AuthContext";
import { useAnonymousMode } from "@/context/AnonymousModeContext";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, orderBy, query, limit, where, getDoc } from "firebase/firestore";
import { MoveLeft, ArrowDown, ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee, Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer, TrendingUp, LucideIcon, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TransactionModal from "@/components/dashboard/TransactionModal";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer
};

export default function HistoryPage() {
  const { user } = useAuth();
  const { anonymousMode } = useAnonymousMode();
  const { formatAmount, symbol, currency } = useCurrencyFormatting();
  const router = useRouter();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [envelopes, setEnvelopes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // État pour la modification
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    if (!user) return;
    try {
      // 1. Charger les enveloppes pour avoir les icônes/couleurs en cache
      const envRef = collection(db, "users", user.uid, "envelopes");
      const envSnap = await getDocs(envRef);
      const envMap: Record<string, any> = {};
      
      // Stocker l'ID aussi ! C'est crucial pour le mapping
      // On va transformer ça en array pour le passer à la modale
      envSnap.forEach(doc => {
        envMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setEnvelopes(envMap);

      // 2. Charger TOUTES les transactions (limité à 100 pour l'exemple)
      const txRef = collection(db, "users", user.uid, "transactions");
      const q = query(
        txRef, 
        orderBy("date", "desc"),
        limit(100)
      );
      const txSnap = await getDocs(q);
      const txList: any[] = [];
      txSnap.forEach(doc => {
        txList.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(txList);

    } catch (error) {
      logger.error("Error fetching transactions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Normalize for accent-insensitive search
  const normalize = (str: string) =>
    str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const filteredTransactions = searchQuery.trim()
    ? transactions.filter((tx) => {
        const desc = normalize(tx.description || "");
        const envName = normalize(envelopes[tx.envelopeId]?.name || "");
        const sourceName = normalize(tx.source || "");
        const q = normalize(searchQuery);
        // Amount matching
        const amountStr = tx.amount.toFixed(2).replace(".", ",");
        const amountStrDot = tx.amount.toFixed(2);
        const amountInt = Math.floor(tx.amount).toString();
        const amountMatch = amountStr.includes(searchQuery.trim()) || amountStrDot.includes(searchQuery.trim()) || amountInt.includes(searchQuery.trim());
        return desc.includes(q) || envName.includes(q) || sourceName.includes(q) || amountMatch;
      })
    : transactions;

  const handleEditClick = (tx: any) => {
    setTransactionToEdit(tx);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setTransactionToEdit(null);
  };

  if (loading) return <div className="min-h-screen bg-app-bg text-app-text p-8">Chargement...</div>;

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 pb-20">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-app-bg/80 backdrop-blur-md py-4 z-10 border-b border-app-border">
        <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-app-surface rounded-full hover:bg-app-surface transition-colors">
                <MoveLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold">Historique Global</h1>
        </div>
      </header>

      {/* Barre de recherche */}
      <div className="mb-6 max-w-xl mx-auto">
        <div className={`flex items-center gap-2 bg-app-surface border rounded-xl px-4 py-2.5 transition-all duration-200 ${searchQuery ? "border-amber-500 ring-1 ring-amber-500/50" : "border-app-border"}`}>
          <Search className="h-4 w-4 text-app-text-secondary flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une dépense..."
            className="flex-1 bg-transparent text-sm text-app-text placeholder:text-app-text-secondary focus:outline-none"
            aria-label="Rechercher une dépense dans l'historique"
          />
          <AnimatePresence>
            {searchQuery.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSearchQuery("")}
                className="p-0.5 text-app-text-secondary hover:text-app-text rounded-full transition-colors"
                aria-label="Effacer la recherche"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {filteredTransactions.length === 0 && searchQuery.trim() ? (
        <div className="text-center py-12 text-app-text-secondary">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucun résultat</p>
          <p className="text-sm mt-1">Aucune dépense ne correspond à « {searchQuery} »</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-12 text-app-text-secondary">
          <p className="font-medium">Aucune transaction pour le moment</p>
        </div>
      ) : (
        <motion.div
          role="list"
          className="max-w-3xl mx-auto relative border-l border-app-border ml-4 sm:ml-8 space-y-8 pl-8 sm:pl-12 my-8"
          initial="hidden"
          animate="visible"
          key={searchQuery}
          variants={{
            visible: { transition: { staggerChildren: 0.045 } }
          }}
        >
          <AnimatePresence>
            {filteredTransactions.map((tx, index) => {
              const isIncome = tx.type === "income";
              const env = isIncome ? {} : (envelopes[tx.envelopeId] || {});
              const Icon = isIncome ? TrendingUp : (ICON_MAP[env.icon] || ShoppingCart);
              const dateObj = new Date(tx.date);

              // Afficher le mois si c'est le premier item ou si le mois change par rapport au précédent
              const showMonthDivider = index === 0 || 
                new Date(filteredTransactions[index - 1].date).getMonth() !== dateObj.getMonth();

              return (
                <motion.div
                  key={tx.id}
                  className="relative"
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 28,
                        delay: Math.min(index, 18) * 0.045
                      }
                    }
                  }}
                  exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
                >
                  {/* Month Divider */}
                  {showMonthDivider && (
                    <div className="absolute -left-[54px] sm:-left-[70px] -top-10 flex items-center mb-6 mt-2">
                      <span className="text-app-text-secondary text-xs font-bold uppercase tracking-widest bg-app-bg py-1 pr-2">
                        {dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  {/* Timeline Dot */}
                  <div className={`absolute -left-[42px] sm:-left-[58px] top-4 w-5 h-5 rounded-full border-4 border-black ${isIncome ? 'bg-emerald-500' : (env.color || 'bg-zinc-500')}`}></div>

                  <div 
                    onClick={() => handleEditClick(tx)}
                    className="bg-app-surface/40 border border-app-border hover:border-app-border hover:bg-app-surface/60 p-4 rounded-xl transition-all transition-transform duration-100 active:scale-[0.995] flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${isIncome ? 'bg-emerald-500/20' : (env.color || 'bg-app-surface')} text-app-text`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-app-text">{tx.description || (isIncome ? "Revenu" : env.name || "Dépense")}</p>
                        <p className="text-xs text-app-text-secondary flex items-center gap-1">
                          {dateObj.toLocaleDateString()}
                          <span className="text-zinc-600">•</span>
                          {isIncome ? (tx.source || "Revenu") : env.name}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold text-lg ${isIncome || tx.isReimbursement ? "text-emerald-400" : "text-red-500"}`}>
                      {isIncome || tx.isReimbursement ? "+" : "-"}{formatAmount(tx.amount)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <TransactionModal 
        isOpen={isEditModalOpen}
        onClose={closeModal}
        envelopes={Object.values(envelopes)} 
        refreshData={fetchData} 
        transactionToEdit={transactionToEdit}
      />
    </div>
  );
}
