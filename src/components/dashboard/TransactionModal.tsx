"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Loader2,
  RefreshCw
} from "lucide-react";
import { collection, addDoc, doc, updateDoc, deleteDoc, deleteField, increment, setDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { type Envelope, isEnvelopeActiveForMonth } from "@/types/envelope";
import { type Transaction, INCOME_SOURCES } from "@/types/transaction";
import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";
import {
  validateAmountWithMessage,
  validateDescriptionWithMessage,
  checkTransactionQuota,
  getMonthKey,
} from "@/lib/validation";
import {
  MATERIALIZED_MONTHS_AHEAD,
  monthKey,
  previousMonthKey,
  nextMonthKeys,
  nominalAnchorDay,
  occurrenceDate,
  endOfMonthIso,
  firestoreDocumentId,
  missingMonthKeys,
  requiresDeletionConfirmation,
} from "@/lib/recurrence";

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

/** Impact d'une transaction sur le `spent` de son enveloppe. */
function transactionImpact(amount: number, isReimbursement?: boolean): number {
  return isReimbursement ? -amount : amount;
}

/** Toutes les occurrences de la série partageant le même recurrenceId. */
async function fetchSeries(userId: string, recurrenceId: string): Promise<Transaction[]> {
  const q = query(
    collection(db, "users", userId, "transactions"),
    where("recurrenceId", "==", recurrenceId),
  );
  const snap = await getDocs(q);
  const list: Transaction[] = [];
  snap.forEach((docSnap) => {
    list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Transaction, "id">) });
  });
  return list;
}

/**
 * Incrémente/décrémente les compteurs mensuels tx_YYYY_MM (quota web) en un
 * seul update. Si le document compteur n'existe pas encore (création), on le
 * crée en mode merge.
 */
async function updateCounters(userId: string, deltas: Record<string, number>): Promise<void> {
  if (Object.keys(deltas).length === 0) return;
  const counterRef = doc(db, "counters", userId);
  try {
    await updateDoc(counterRef, Object.fromEntries(
      Object.entries(deltas).map(([key, delta]) => [key, increment(delta)]),
    ));
  } catch {
    // Le document compteur n'existe pas encore — création en mode merge.
    await setDoc(counterRef, deltas, { merge: true }).catch(() => {
      // Ignorer silencieusement — quota non critique.
    });
  }
}

// ── Séries récurrentes ───────────────────────────────────────────────

/**
 * Matérialise les occurrences futures d'une série dans les documents
 * déterministes "<recurrenceId>_<YYYY-MM>" (les mêmes id que l'iOS →
 * convergence last-write-wins entre les deux apps). Incrémente `spent` de
 * l'enveloppe et le compteur mensuel pour chaque occurrence créée.
 */
async function materializeSeries(
  userId: string,
  opts: {
    recurrenceId: string;
    anchorDay: number;
    amount: number;
    description: string;
    envelopeId: string;
    isReimbursement?: boolean;
    /** Mois de l'occurrence initiale — les mois strictement après sont créés. */
    tailMonth: string;
  },
): Promise<void> {
  const upTo = nextMonthKeys(monthKey(new Date()), MATERIALIZED_MONTHS_AHEAD).at(-1)!;
  const missing = missingMonthKeys(opts.tailMonth, upTo);
  const counterDeltas: Record<string, number> = {};
  const nowISO = new Date().toISOString();
  for (const m of missing) {
    await setDoc(doc(db, "users", userId, "transactions", firestoreDocumentId(opts.recurrenceId, m)), {
      amount: opts.amount,
      description: opts.description,
      date: occurrenceDate(opts.anchorDay, m),
      createdAt: nowISO,
      updatedAt: nowISO,
      type: "expense",
      envelopeId: opts.envelopeId,
      isReimbursement: opts.isReimbursement ?? false,
      recurrenceId: opts.recurrenceId,
      recurrenceAnchorDay: opts.anchorDay,
    });
    await updateDoc(doc(db, "users", userId, "envelopes", opts.envelopeId), {
      spent: increment(transactionImpact(opts.amount, opts.isReimbursement)),
    });
    counterDeltas[m] = (counterDeltas[m] ?? 0) + 1;
  }
  await updateCounters(userId, counterDeltas);
}

/**
 * Propagation d'une édition à la série (règle 4) : l'occurrence éditée
 * porte déjà les nouvelles valeurs ; les occurrences des mois strictement
 * après le nouveau mois reçoivent le nouveau montant/note et une date
 * re-clampsée sur le nouveau jour d'ancrage ; une collision dans le mois
 * cible est dédupliquée (l'éditée gagne). Les mois passés ne sont jamais
 * modifiés. `spent` est ajusté par delta par enveloppe concernée.
 */
async function propagateSeriesEdit(
  userId: string,
  edited: Transaction,
  opts: { newDateISO: string; newAmount: number; newDescription: string },
): Promise<void> {
  const rid = edited.recurrenceId!;
  const newMonth = monthKey(opts.newDateISO);
  const newAnchorDay = nominalAnchorDay(opts.newDateISO);
  const series = await fetchSeries(userId, rid);
  const counterDeltas: Record<string, number> = {};
  const nowISO = new Date().toISOString();

  for (const tx of series) {
    if (tx.id === edited.id) continue;
    const txMonth = monthKey(tx.date);
    if (txMonth === newMonth) {
      // Collision : l'occurrence de la série occupant déjà le mois cible.
      if (tx.envelopeId) {
        await updateDoc(doc(db, "users", userId, "envelopes", tx.envelopeId), {
          spent: increment(-transactionImpact(tx.amount, tx.isReimbursement)),
        });
      }
      await deleteDoc(doc(db, "users", userId, "transactions", tx.id));
      counterDeltas[txMonth] = (counterDeltas[txMonth] ?? 0) - 1;
    } else if (txMonth > newMonth) {
      // Mois suivants : nouveau montant/note, date re-clampsée sur le nouvel
      // ancrage. L'enveloppe de l'occurrence garde la sienne (non propagée).
      if (tx.envelopeId) {
        const delta =
          transactionImpact(opts.newAmount, tx.isReimbursement) -
          transactionImpact(tx.amount, tx.isReimbursement);
        if (delta !== 0) {
          await updateDoc(doc(db, "users", userId, "envelopes", tx.envelopeId), {
            spent: increment(delta),
          });
        }
      }
      await updateDoc(doc(db, "users", userId, "transactions", tx.id), {
        amount: opts.newAmount,
        description: opts.newDescription,
        date: occurrenceDate(newAnchorDay, txMonth),
        recurrenceAnchorDay: newAnchorDay,
        updatedAt: nowISO,
      });
    }
  }
  await updateCounters(userId, counterDeltas);
}

/**
 * Arrêt de la série (règle 5) : l'occurrence éditée devient simple
 * (champs récurrence supprimés), les occurrences strictement après le mois
 * d'arrêt sont supprimées (durablement — même doc id que l'iOS), les
 * occurrences passées sont marquées avec `recurrenceEndDate` à la fin du
 * mois précédent.
 */
async function stopSeriesAt(userId: string, edited: Transaction, newDateISO: string): Promise<void> {
  const rid = edited.recurrenceId!;
  const stopMonth = monthKey(newDateISO);
  const series = await fetchSeries(userId, rid);
  const counterDeltas: Record<string, number> = {};
  const nowISO = new Date().toISOString();
  const endDate = endOfMonthIso(previousMonthKey(stopMonth));

  for (const tx of series) {
    if (tx.id === edited.id) continue;
    const txMonth = monthKey(tx.date);
    if (txMonth > stopMonth) {
      if (tx.envelopeId) {
        await updateDoc(doc(db, "users", userId, "envelopes", tx.envelopeId), {
          spent: increment(-transactionImpact(tx.amount, tx.isReimbursement)),
        });
      }
      await deleteDoc(doc(db, "users", userId, "transactions", tx.id));
      counterDeltas[txMonth] = (counterDeltas[txMonth] ?? 0) - 1;
    } else if (txMonth < stopMonth) {
      await updateDoc(doc(db, "users", userId, "transactions", tx.id), {
        recurrenceEndDate: endDate,
        updatedAt: nowISO,
      });
    }
  }

  // L'occurrence éditée devient une transaction simple.
  await updateDoc(doc(db, "users", userId, "transactions", edited.id), {
    recurrenceId: deleteField(),
    recurrenceAnchorDay: deleteField(),
    recurrenceEndDate: deleteField(),
    updatedAt: nowISO,
  });
  await updateCounters(userId, counterDeltas);
}

/**
 * Suppression durable d'une série à partir du mois de l'occurrence éditée
 * (règle 6) : l'éditée et toutes les occurrences des mois ≥ sont supprimées
 * (mêmes doc ids que l'iOS), les occurrences passées sont marquées avec
 * `recurrenceEndDate` à la fin du mois précédent. `spent` et les compteurs
 * mensuels sont ajustés. Appelée après la popup de confirmation — les
 * occurrences passées n'atteignent jamais ce chemin.
 */
async function deleteSeriesFromMonth(userId: string, edited: Transaction): Promise<void> {
  const rid = edited.recurrenceId!;
  const deleteKey = monthKey(edited.date);
  const series = await fetchSeries(userId, rid);
  const counterDeltas: Record<string, number> = {};
  const nowISO = new Date().toISOString();
  const endDate = endOfMonthIso(previousMonthKey(deleteKey));

  for (const tx of series) {
    const txMonth = monthKey(tx.date);
    if (txMonth >= deleteKey) {
      if (tx.envelopeId) {
        await updateDoc(doc(db, "users", userId, "envelopes", tx.envelopeId), {
          spent: increment(-transactionImpact(tx.amount, tx.isReimbursement)),
        });
      }
      await deleteDoc(doc(db, "users", userId, "transactions", tx.id));
      counterDeltas[txMonth] = (counterDeltas[txMonth] ?? 0) - 1;
    } else {
      await updateDoc(doc(db, "users", userId, "transactions", tx.id), {
        recurrenceEndDate: endDate,
        updatedAt: nowISO,
      });
    }
  }
  await updateCounters(userId, counterDeltas);
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelopes: Envelope[];
  refreshData: () => void;
  transactionToEdit?: Transaction | null;
  defaultEnvelopeId?: string;
  /** Nombre de transactions déjà créées ce mois (pour vérification du quota). */
  currentMonthTransactionCount?: number;
}

export default function TransactionModal({ isOpen, onClose, envelopes, refreshData, transactionToEdit, defaultEnvelopeId, currentMonthTransactionCount = 0 }: TransactionModalProps) {
  const { user } = useAuth();
  const { formatAmount, symbol } = useCurrencyFormatting();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    amount?: string;
    description?: string;
    quota?: string;
  }>({});
  
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isReimbursement, setIsReimbursement] = useState(false);
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [selectedSource, setSelectedSource] = useState<string>("Prime");
  const [isRecurring, setIsRecurring] = useState(false);

  // Initialisation à l'ouverture ou au changement de transactionToEdit
  useEffect(() => {
    if (isOpen) {
        if (transactionToEdit) {
            setAmount(transactionToEdit.amount.toString());
            setDescription(transactionToEdit.description);
            setSelectedEnvelopeId(transactionToEdit.envelopeId || "");
            setDate(transactionToEdit.date.split('T')[0]);
            setIsReimbursement(transactionToEdit.isReimbursement ?? false);
            setTransactionType(transactionToEdit.type ?? "expense");
            setSelectedSource(transactionToEdit.source ?? "Prime");
            setIsRecurring(!!transactionToEdit.recurrenceId);
        } else {
            setAmount("");
            setDescription("");
            setSelectedEnvelopeId(defaultEnvelopeId || envelopes[0]?.id || "");
            setDate(new Date().toISOString().split('T')[0]);
            setIsReimbursement(false);
            setTransactionType("expense");
            setSelectedSource("Prime");
            setIsRecurring(false);
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

    // Guard: user + amount required for all; envelopeId required only for expenses
    const needsEnvelope = transactionType === "expense";
    if (!user || !amount || isDateInvalidForTemp) return;
    if (needsEnvelope && !selectedEnvelopeId) return;
    if (!needsEnvelope && !selectedSource) return;

    // --- Validation côté client ---
    const errors: { amount?: string; description?: string; quota?: string } = {};

    const numAmount = parseFloat(amount);
    const amountCheck = validateAmountWithMessage(numAmount);
    if (!amountCheck.valid) errors.amount = amountCheck.message;

    const descCheck = validateDescriptionWithMessage(description);
    if (!descCheck.valid) errors.description = descCheck.message;

    // Vérification du quota uniquement en création
    if (!transactionToEdit) {
      const quotaCheck = checkTransactionQuota(currentMonthTransactionCount);
      if (!quotaCheck.allowed) errors.quota = quotaCheck.message;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setLoading(true);
    try {
      const isEditing = !!transactionToEdit;
      const txImpact = (tx: { amount: number; isReimbursement?: boolean }) =>
        tx.isReimbursement ? -tx.amount : tx.amount;

      if (isEditing) {
        // --- MODE EDITION ---
        const oldTx = transactionToEdit!;
        const oldType = oldTx.type ?? "expense";
        const newType = transactionType;
        const wasExpense = oldType === "expense";
        const isExpense = newType === "expense";
        const wasRecurring = !!oldTx.recurrenceId;
        const newDateISO = new Date(date).toISOString();
        const newAnchorDay = nominalAnchorDay(newDateISO);

        // 1. Update Transaction
        const txRef = doc(db, "users", user.uid, "transactions", oldTx.id);
        const updateData: Record<string, unknown> = {
          amount: numAmount,
          description,
          date: newDateISO,
          updatedAt: new Date().toISOString(),
          type: newType,
        };

        if (isExpense) {
          updateData.envelopeId = selectedEnvelopeId;
          updateData.isReimbursement = isReimbursement;
          // Nettoyer les champs income si on passe de income à expense
          updateData.source = deleteField();
          if (isRecurring) {
            // Série active : le nouveau jour d'ancrage s'applique à la série.
            updateData.recurrenceAnchorDay = newAnchorDay;
          }
        } else {
          updateData.source = selectedSource;
          // Nettoyer les champs expense si on passe de expense à income
          updateData.envelopeId = deleteField();
          updateData.isReimbursement = deleteField();
        }

        await updateDoc(txRef, updateData);

        // 2. Update Envelopes Spent — only for expenses
        // Reverse old impact if was an expense
        if (wasExpense) {
          const oldImpact = txImpact({
            amount: oldTx.amount,
            isReimbursement: oldTx.isReimbursement,
          });
          await updateDoc(
            doc(db, "users", user.uid, "envelopes", oldTx.envelopeId!),
            { spent: increment(-oldImpact) }
          );
        }

        // Apply new impact if now an expense
        if (isExpense) {
          const newImpact = txImpact({
            amount: numAmount,
            isReimbursement,
          });
          await updateDoc(
            doc(db, "users", user.uid, "envelopes", selectedEnvelopeId),
            { spent: increment(newImpact) }
          );
        }

        // 3. Série récurrente : propagation, arrêt ou activation.
        if (wasRecurring && isExpense) {
          if (isRecurring) {
            // L'utilisateur garde la récurrence → propagation aux mois suivants.
            await propagateSeriesEdit(user.uid, oldTx, {
              newDateISO,
              newAmount: numAmount,
              newDescription: description,
            });
          } else {
            // Décocher → la série s'arrête à ce mois (règle 5).
            await stopSeriesAt(user.uid, oldTx, newDateISO);
          }
        } else if (wasRecurring && !isExpense) {
          // Passage à un revenu → la série s'arrête proprement.
          await stopSeriesAt(user.uid, oldTx, newDateISO);
        } else if (!wasRecurring && isExpense && isRecurring) {
          // Activation de la récurrence en édition → démarrage de la série.
          const recurrenceId = crypto.randomUUID();
          await updateDoc(txRef, {
            recurrenceId,
            recurrenceAnchorDay: newAnchorDay,
            recurrenceEndDate: deleteField(),
            updatedAt: new Date().toISOString(),
          });
          await materializeSeries(user.uid, {
            recurrenceId,
            anchorDay: newAnchorDay,
            amount: numAmount,
            description,
            envelopeId: selectedEnvelopeId,
            isReimbursement,
            tailMonth: monthKey(newDateISO),
          });
        }

      } else {
        // --- MODE CREATION ---

        // 1. Ajouter la transaction
        const nowISO = new Date().toISOString();
        const isIncome = transactionType === "income";
        const isSeries = isRecurring && !isIncome;
        const recurrenceId = isSeries ? crypto.randomUUID() : undefined;
        const txData: Record<string, unknown> = {
          amount: numAmount,
          description,
          date: new Date(date).toISOString(),
          createdAt: nowISO,
          updatedAt: nowISO,
          type: transactionType,
        };

        if (isIncome) {
          txData.source = selectedSource;
          // Pas de envelopeId pour les revenus
        } else {
          txData.envelopeId = selectedEnvelopeId;
          txData.isReimbursement = isReimbursement;
          if (isSeries) {
            // Série récurrente : id + jour d'ancrage de la première dépense.
            txData.recurrenceId = recurrenceId;
            txData.recurrenceAnchorDay = nominalAnchorDay(date);
          }
        }

        await addDoc(collection(db, "users", user.uid, "transactions"), txData);

        // 2. Mettre à jour le 'spent' de l'enveloppe (dépenses uniquement)
        if (!isIncome) {
          const envRef = doc(db, "users", user.uid, "envelopes", selectedEnvelopeId);
          const spentImpact = isReimbursement ? -numAmount : numAmount;
          await updateDoc(envRef, {
            spent: increment(spentImpact)
          });
        }

        // 3. Incrémenter le compteur de transactions du mois
        const initialMonth = getMonthKey(date);
        const counterRef = doc(db, "counters", user.uid);
        try {
          await updateDoc(counterRef, {
            [initialMonth]: increment(1),
          });
        } catch {
          // Le document compteur n'existe pas encore, on le crée en mode merge.
          const { setDoc } = await import("firebase/firestore");
          await setDoc(counterRef, { [initialMonth]: 1 }, { merge: true }).catch(() => {
            // Ignorer silencieusement — quota non critique.
          });
        }

        // 4. Matérialiser les occurrences futures de la série (mois courant + 3)
        if (isSeries && recurrenceId) {
          await materializeSeries(user.uid, {
            recurrenceId,
            anchorDay: nominalAnchorDay(date),
            amount: numAmount,
            description,
            envelopeId: selectedEnvelopeId,
            isReimbursement,
            tailMonth: initialMonth,
          });
        }
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

    const isIncome = (transactionToEdit.type ?? "expense") === "income";
    const deletingSeries =
      !isIncome &&
      !!transactionToEdit.recurrenceId &&
      requiresDeletionConfirmation(transactionToEdit.date, true);

    if (deletingSeries) {
      if (!confirm("Cette dépense est récurrente. Supprimer toute la série à partir de ce mois ? Les occurrences passées seront conservées.")) {
        return;
      }
    } else if (!confirm(isIncome
      ? "Voulez-vous vraiment supprimer ce revenu ?"
      : "Voulez-vous vraiment supprimer cette dépense ?"
    )) {
        return;
    }

    setLoading(true);
    try {
        if (deletingSeries) {
          // Suppression de la série entière à partir de ce mois.
          await deleteSeriesFromMonth(user.uid, transactionToEdit);
        } else {
          // 1. Supprimer la transaction
          await deleteDoc(doc(db, "users", user.uid, "transactions", transactionToEdit.id));

          // 2. Mettre à jour l'enveloppe (dépenses uniquement)
          if (!isIncome && transactionToEdit.envelopeId) {
            const envRef = doc(db, "users", user.uid, "envelopes", transactionToEdit.envelopeId);
            const impactToReverse = transactionToEdit.isReimbursement
              ? transactionToEdit.amount
              : -transactionToEdit.amount;
            await updateDoc(envRef, {
                spent: increment(impactToReverse)
            });
          }

          // 3. Décrémenter le compteur de transactions du mois
          const delMonth = getMonthKey(transactionToEdit.date);
          const counterRef = doc(db, "counters", user.uid);
          await updateDoc(counterRef, {
            [delMonth]: increment(-1),
          }).catch(() => {/* compteur absent, ignoré */});
        }

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
          <h2 id="modal-title" className="text-xl font-bold text-app-text">
            {transactionToEdit
              ? (transactionType === "income" ? "Modifier Revenu" : "Modifier Dépense")
              : (transactionType === "income" ? "Nouveau Revenu" : "Nouvelle Dépense")
            }
          </h2>
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-secondary font-bold text-xl">{symbol}</span>
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
            {validationErrors.amount && (
              <p className="mt-1 text-xs text-red-400" role="alert">{validationErrors.amount}</p>
            )}
          </div>

          {/* Type de transaction */}
          <div>
            <label className="block text-sm font-medium text-app-text-secondary mb-2">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTransactionType("expense")}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                  transactionType === "expense"
                    ? "bg-amber-500 text-app-text"
                    : "bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text"
                }`}
              >
                Dépense
              </button>
              <button
                type="button"
                onClick={() => setTransactionType("income")}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                  transactionType === "income"
                    ? "bg-emerald-500 text-white"
                    : "bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text"
                }`}
              >
                Revenu
              </button>
            </div>
          </div>

          {/* Enveloppe (dépenses) ou Source (revenus) */}
          {transactionType === "expense" ? (
            <div>
               <label className="block text-sm font-medium text-app-text-secondary mb-1">Enveloppe</label>
               <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                   {envelopes.map(env => {
                     const isSelected = selectedEnvelopeId === env.id;
                     const isTemp = !!env.isTemporary;
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
                    Reste disponible : {envRemaining.toFixed(2)} {symbol}
                  </motion.div>
                )}
              </AnimatePresence>

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
          ) : (
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">Source</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                {INCOME_SOURCES.map(source => {
                  const isSelected = selectedSource === source;
                  return (
                    <motion.button
                      key={source}
                      type="button"
                      onClick={() => setSelectedSource(source)}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                        isSelected
                          ? "bg-app-surface border-emerald-500 ring-1 ring-emerald-500"
                          : "bg-app-bg border-app-border hover:bg-app-surface"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isSelected ? "bg-emerald-500" : "bg-emerald-500/30"}`} />
                      <span className={`truncate text-sm ${isSelected ? "text-app-text font-medium" : "text-app-text-secondary"}`}>
                        {source}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Remboursement (dépenses uniquement) */}
          {transactionType === "expense" && (
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
          )}

          {/* Récurrente (dépenses uniquement, hors enveloppes temporaires) */}
          {transactionType === "expense" && !selectedEnv?.isTemporary && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-app-bg border border-app-border">
            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 text-app-text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-app-text">Récurrente</p>
                <p className="text-xs text-app-text-secondary">
                  {isRecurring
                    ? "Cette dépense se répète chaque mois. Les mois suivants seront mis à jour automatiquement."
                    : "Cette dépense se répétera chaque mois à la même date"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isRecurring}
              aria-label="Dépense récurrente"
              onClick={() => setIsRecurring(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isRecurring ? "bg-amber-500" : "bg-app-border"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isRecurring ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          )}

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
                {validationErrors.description && (
                  <p className="mt-1 text-xs text-red-400" role="alert">{validationErrors.description}</p>
                )}
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

          {validationErrors.quota && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400" role="alert">
              {validationErrors.quota}
            </p>
          )}

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
