"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Trash2,
  Loader2 
} from "lucide-react";
import { collection, addDoc, doc, updateDoc, deleteDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { type Envelope, isEnvelopeActiveForMonth } from "@/types/envelope";

// French month names indexed 1-based (index 0 unused).
const FRENCH_MONTHS = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/** Converts a YYYY-MM string into a French month label, e.g. "2026-07" → "Juillet 2026". */
function formatMonthFr(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const label = FRENCH_MONTHS[parseInt(month, 10)] ?? month;
  return `${label} ${year}`;
}

type Transaction = {
  id: string;
  amount: number;
  description: string;
  envelopeId: string;
  date: string;
  isReimbursement?: boolean;
};

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelopes: Envelope[];
  refreshData: () => void;
  transactionToEdit?: Transaction | null;
  defaultEnvelopeId?: string;
}

export default function TransactionModal({ isOpen, onClose, envelopes, refreshData, transactionToEdit, defaultEnvelopeId }: TransactionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isReimbursement, setIsReimbursement] = useState(false);

  // Initialisation à l'ouverture ou au changement de transactionToEdit
  useEffect(() => {
    if (isOpen) {
        if (transactionToEdit) {
            setAmount(transactionToEdit.amount.toString());
            setDescription(transactionToEdit.description);
            setSelectedEnvelopeId(transactionToEdit.envelopeId);
            setDate(transactionToEdit.date.split('T')[0]);
            setIsReimbursement(transactionToEdit.isReimbursement ?? false);
        } else {
            setAmount("");
            setDescription("");
            setSelectedEnvelopeId(defaultEnvelopeId || envelopes[0]?.id || "");
            setDate(new Date().toISOString().split('T')[0]);
            setIsReimbursement(false);
        }
    } else {
      setSaveSuccess(false);
    }
  }, [isOpen, transactionToEdit, envelopes, defaultEnvelopeId]);

  const selectedEnv = envelopes.find((e) => e.id === selectedEnvelopeId);
  const existingImpact = transactionToEdit?.envelopeId === selectedEnvelopeId
    ? (transactionToEdit?.isReimbursement ? -(transactionToEdit?.amount ?? 0) : (transactionToEdit?.amount ?? 0))
    : 0;
  const envRemaining = selectedEnv
    ? (selectedEnv.budget ?? 0) - (selectedEnv.spent ?? 0) + existingImpact
    : null;
  const remainingRatio = selectedEnv && (selectedEnv.budget ?? 0) > 0 && envRemaining !== null
    ? envRemaining / selectedEnv.budget
    : null;
  const remainingToneClass = envRemaining === null
    ? "border-app-border bg-app-bg text-app-text-secondary"
    : envRemaining < 0
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : remainingRatio !== null && remainingRatio <= 0.2
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";

  // Derive the YYYY-MM month of the currently selected expense date.
  const selectedDateMonth = date ? date.substring(0, 7) : "";

  // Validation: temporary envelopes only accept dates within their activeMonths.
  const isDateInvalidForTemp =
    !!selectedEnv?.isTemporary &&
    !!selectedDateMonth &&
    !isEnvelopeActiveForMonth(selectedEnv, selectedDateMonth);

  // Human-readable list of valid months for the error message.
  const validMonthLabels =
    selectedEnv?.isTemporary && Array.isArray(selectedEnv.activeMonths)
      ? selectedEnv.activeMonths.map(formatMonthFr).join(" / ")
      : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !selectedEnvelopeId || isDateInvalidForTemp) return;

    setLoading(true);
    try {
      const numAmount = parseFloat(amount);
      const isEditing = !!transactionToEdit;
      const txImpact = (tx: { amount: number; isReimbursement?: boolean }) =>
        tx.isReimbursement ? -tx.amount : tx.amount;
      
      if (isEditing) {
        // --- MODE EDITION ---
        const oldTx = transactionToEdit!; // on sait qu'elle existe ici
        const oldAmount = oldTx.amount;
        const oldEnvelopeId = oldTx.envelopeId;

        // 1. Update Transaction
        const txRef = doc(db, "users", user.uid, "transactions", oldTx.id);
        await updateDoc(txRef, {
            amount: numAmount,
            description,
            envelopeId: selectedEnvelopeId,
            date: new Date(date).toISOString(),
          isReimbursement,
        });

        // 2. Update Envelopes Spent (Legacy support + consistency)
        const oldImpact = txImpact({ amount: oldAmount, isReimbursement: oldTx.isReimbursement });
        const newImpact = txImpact({ amount: numAmount, isReimbursement });

        if (oldEnvelopeId === selectedEnvelopeId) {
            // Même enveloppe -> on ajuste la différence
          if (oldImpact !== newImpact) {
                await updateDoc(doc(db, "users", user.uid, "envelopes", selectedEnvelopeId), {
              spent: increment(newImpact - oldImpact)
                });
            }
        } else {
            // Changement d'enveloppe -> on retire de l'ancienne et ajoute à la nouvelle
            await updateDoc(doc(db, "users", user.uid, "envelopes", oldEnvelopeId), {
            spent: increment(-oldImpact)
            });
            await updateDoc(doc(db, "users", user.uid, "envelopes", selectedEnvelopeId), {
            spent: increment(newImpact)
            });
        }

      } else {
        // --- MODE CREATION ---
        
        // 1. Ajouter la transaction
        await addDoc(collection(db, "users", user.uid, "transactions"), {
            amount: numAmount,
            description,
            envelopeId: selectedEnvelopeId,
            date: new Date(date).toISOString(),
          createdAt: new Date().toISOString(),
          isReimbursement,
        });

        // 2. Mettre à jour le 'spent' de l'enveloppe
        const envRef = doc(db, "users", user.uid, "envelopes", selectedEnvelopeId);
        const spentImpact = isReimbursement ? -numAmount : numAmount;
        await updateDoc(envRef, {
          spent: increment(spentImpact)
        });
      }

      refreshData();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
      onClose();
    } catch (error) {
      logger.sanitizedError("Transaction operation failed", error);
      alert("Erreur lors de l'opération");
    } finally {
      setLoading(false);
    }
  };
const handleDelete = async () => {
    if (!user || !transactionToEdit) return;

    if (!confirm("Voulez-vous vraiment supprimer cette dépense ?")) {
        return;
    }

    setLoading(true);
    try {
        // 1. Supprimer la transaction
        await deleteDoc(doc(db, "users", user.uid, "transactions", transactionToEdit.id));

        // 2. Mettre à jour l'enveloppe (Rembourser le montant)
        // On utilise transactionToEdit.envelopeId et transactionToEdit.amount (valeurs originales)
        // Attention: Si l'enveloppe n'existe plus, ça peut planter, mais on suppose qu'elle existe.
        const envRef = doc(db, "users", user.uid, "envelopes", transactionToEdit.envelopeId);
        // On vérifie si l'enveloppe est toujours là pour éviter crash si user a supprimé l'enveloppe entre temps
        // Mais pour simplifier ici :
        const impactToReverse = transactionToEdit.isReimbursement
          ? transactionToEdit.amount
          : -transactionToEdit.amount;
        await updateDoc(envRef, {
            spent: increment(impactToReverse)
        });

        refreshData();
        onClose();
    } catch (error) {
        logger.sanitizedError("Transaction deletion failed", error);
        alert("Erreur lors de la suppression");
    } finally {
        setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4"
      >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="modal-title" className="text-xl font-bold text-app-text">{transactionToEdit ? "Modifier Dépense" : "Nouvelle Dépense"}</h2>
          <div className="flex gap-2">
            {transactionToEdit && (
                <button 
                    type="button"
                    onClick={handleDelete} 
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/30 bg-app-surface rounded-full transition-colors"
                    title="Supprimer la dépense"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            )}
            <button onClick={onClose} aria-label="Fermer la modale" className="p-2 text-app-text-secondary hover:text-app-text bg-app-surface rounded-full">
                <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-app-text-secondary mb-1">Montant</label>
            <div>
              <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-secondary font-bold text-xl">€</span>
                  <input
                      type="number"
                  aria-label="Montant de la transaction"
                      inputMode="decimal"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl py-4 pl-10 pr-4 text-2xl font-bold text-app-text focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 transition-all duration-200 focus:outline-none"
                      placeholder="0.00"
                      autoFocus
                  />
              </div>
            </div>
          </div>

          {/* Enveloppe */}
          <div>
             <label className="block text-sm font-medium text-app-text-secondary mb-1">Enveloppe</label>
             <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                 {envelopes.map(env => {
                   const isSelected = selectedEnvelopeId === env.id;
                   const isTemp = !!env.isTemporary;
                   // Build border/background classes based on selection state and temporality.
                   const baseClass = "p-3 rounded-lg border text-left flex items-center gap-2 transition-all";
                   const stateClass = isSelected
                     ? isTemp
                       ? "bg-app-surface border-dashed border-amber-500 ring-1 ring-amber-500"
                       : "bg-app-surface border-amber-500 ring-1 ring-amber-500"
                     : isTemp
                       ? "bg-amber-500/5 border-dashed border-amber-500/50 hover:bg-amber-500/10"
                       : "bg-app-bg border-app-border hover:bg-app-surface";
                   return (
                     <motion.button
                       key={env.id}
                       type="button"
                       onClick={() => setSelectedEnvelopeId(env.id)}
                       whileTap={{ scale: 0.95 }}
                       transition={{ type: "spring", stiffness: 400, damping: 25 }}
                       className={`${baseClass} ${stateClass}`}
                       title={isTemp ? "Enveloppe temporaire" : undefined}
                     >
                       <div className={`w-3 h-3 rounded-full flex-shrink-0 ${env.color}`} />
                       <span className={`truncate text-sm ${isSelected ? "text-app-text font-medium" : "text-app-text-secondary"}`}>
                         {env.name}
                       </span>
                       {/* Tiny temporary badge — dashed pill so it reads at a glance */}
                       {isTemp && (
                         <span className="ml-auto flex-shrink-0 rounded border border-dashed border-amber-500/60 px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-amber-500/80">
                           tmp
                         </span>
                       )}
                     </motion.button>
                   );
                 })}
            </div>

            <AnimatePresence>
              {selectedEnv && envRemaining !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${remainingToneClass}`}
                >
                  Reste disponible : {envRemaining.toFixed(2)} €
                </motion.div>
              )}
            </AnimatePresence>

            {/* Temporary-envelope date-validation error */}
            <AnimatePresence>
              {isDateInvalidForTemp && (
                <motion.p
                  key="temp-date-error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-400"
                  role="alert"
                >
                  Cette enveloppe temporaire n&apos;accepte pas de dépense pour cette date.
                  {validMonthLabels && (
                    <> Mois valides&nbsp;: <span className="font-semibold">{validMonthLabels}</span>.</>
                  )}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Description & Date */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-app-bg border border-app-border">
            <div>
              <p className="text-sm font-medium text-app-text">Remboursement</p>
              <p className="text-xs text-app-text-secondary">Ce montant sera déduit des dépenses de l&apos;enveloppe</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isReimbursement}
              onClick={() => setIsReimbursement(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isReimbursement ? "bg-emerald-500" : "bg-app-border"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isReimbursement ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-app-text-secondary mb-1">Note</label>
                <input
                    type="text"
                  aria-label="Description de la transaction"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-3 text-app-text focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    placeholder="Ex: Burger King"
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-app-text-secondary mb-1">Date</label>
                <input
                    type="date"
                  aria-label="Date de la transaction"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-3 text-app-text focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
             </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading || isDateInvalidForTemp}
            whileTap={!loading && !isDateInvalidForTemp ? { scale: 0.97 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`w-full mt-4 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors ${
              isDateInvalidForTemp
                ? "bg-amber-500/30 text-app-text/40 cursor-not-allowed"
                : saveSuccess
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-app-text"
            }`}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 className="h-5 w-5 animate-spin" />
                </motion.span>
              ) : saveSuccess ? (
                <motion.span
                  key="success"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  ✓ Ajouté !
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {transactionToEdit ? "Modifier" : "Ajouter"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
