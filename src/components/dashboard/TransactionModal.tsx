"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  X, 
  Trash2,
  Calendar as CalendarIcon, 
  Loader2 
} from "lucide-react";
import { collection, addDoc, doc, updateDoc, deleteDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";

type Envelope = {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  spent: number;
};

type Transaction = {
  id: string;
  amount: number;
  description: string;
  envelopeId: string;
  date: string;
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
  
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Initialisation à l'ouverture ou au changement de transactionToEdit
  useEffect(() => {
    if (isOpen) {
        if (transactionToEdit) {
            setAmount(transactionToEdit.amount.toString());
            setDescription(transactionToEdit.description);
            setSelectedEnvelopeId(transactionToEdit.envelopeId);
            setDate(transactionToEdit.date.split('T')[0]);
        } else {
            setAmount("");
            setDescription("");
            setSelectedEnvelopeId(defaultEnvelopeId || envelopes[0]?.id || "");
            setDate(new Date().toISOString().split('T')[0]);
        }
    }
  }, [isOpen, transactionToEdit, envelopes, defaultEnvelopeId]);

  const selectedEnv = envelopes.find((e) => e.id === selectedEnvelopeId);
  const envRemaining = selectedEnv
    ? selectedEnv.budget - selectedEnv.spent + (transactionToEdit?.envelopeId === selectedEnvelopeId ? (transactionToEdit?.amount ?? 0) : 0)
    : null;
  const remainingRatio = selectedEnv && selectedEnv.budget > 0 && envRemaining !== null
    ? envRemaining / selectedEnv.budget
    : null;
  const remainingToneClass = envRemaining === null
    ? "border-app-border bg-app-bg text-app-text-secondary"
    : envRemaining < 0
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : remainingRatio !== null && remainingRatio <= 0.2
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !selectedEnvelopeId) return;

    setLoading(true);
    try {
      const numAmount = parseFloat(amount);
      const isEditing = !!transactionToEdit;
      
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
        });

        // 2. Update Envelopes Spent (Legacy support + consistency)
        if (oldEnvelopeId === selectedEnvelopeId) {
            // Même enveloppe -> on ajuste la différence
            if (oldAmount !== numAmount) {
                await updateDoc(doc(db, "users", user.uid, "envelopes", selectedEnvelopeId), {
                    spent: increment(numAmount - oldAmount)
                });
            }
        } else {
            // Changement d'enveloppe -> on retire de l'ancienne et ajoute à la nouvelle
            await updateDoc(doc(db, "users", user.uid, "envelopes", oldEnvelopeId), {
                spent: increment(-oldAmount)
            });
            await updateDoc(doc(db, "users", user.uid, "envelopes", selectedEnvelopeId), {
                spent: increment(numAmount)
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
            createdAt: new Date().toISOString()
        });

        // 2. Mettre à jour le 'spent' de l'enveloppe
        const envRef = doc(db, "users", user.uid, "envelopes", selectedEnvelopeId);
        await updateDoc(envRef, {
            spent: increment(numAmount)
        });
      }

      refreshData();
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
        await updateDoc(envRef, {
            spent: increment(-transactionToEdit.amount)
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
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
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
                    className="w-full bg-app-bg border border-app-border rounded-xl py-4 pl-10 pr-4 text-2xl font-bold text-app-text focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="0.00"
                    autoFocus
                />
            </div>
          </div>

          {/* Enveloppe */}
          <div>
             <label className="block text-sm font-medium text-app-text-secondary mb-1">Enveloppe</label>
             <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                {envelopes.map(env => (
                    <button
                        key={env.id}
                        type="button"
                        onClick={() => setSelectedEnvelopeId(env.id)}
                        className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-all ${selectedEnvelopeId === env.id ? 'bg-app-surface border-amber-500 ring-1 ring-amber-500' : 'bg-app-bg border-app-border hover:bg-app-surface'}`}
                    >
                        <div className={`w-3 h-3 rounded-full ${env.color}`} />
                        <span className={`truncate text-sm ${selectedEnvelopeId === env.id ? 'text-app-text font-medium' : 'text-app-text-secondary'}`}>{env.name}</span>
                    </button>
                ))}
            </div>

            {selectedEnv && envRemaining !== null && (
              <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${remainingToneClass}`}>
                Reste disponible : {envRemaining.toFixed(2)} €
              </div>
            )}
          </div>

          {/* Description & Date */}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-app-text font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ajouter"}
          </button>
        </form>
      </div>
    </div>
  );
}
