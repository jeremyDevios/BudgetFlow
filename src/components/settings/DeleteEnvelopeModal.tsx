"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { type Envelope } from "@/types/envelope";
import { type Transaction } from "@/types/transaction";
import { groupTransactionsByMonth } from "@/lib/envelopeService";
import {
  validateEnvelopeNameWithMessage,
  validateAmountWithMessage,
} from "@/lib/validation";

// ── Types ────────────────────────────────────────────────────────────

type DeleteOption = "migrate-existing" | "create-new" | "delete-all";

interface DeleteEnvelopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelope: Envelope;
  envelopes: Envelope[];
  linkedTransactions: Transaction[];
  onMigrateToExisting: (targetEnvelopeId: string) => Promise<void>;
  onCreateAndMigrate: (name: string, budget: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** French month labels indexed 1-based. */
const FRENCH_MONTHS = [
  "",
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function formatMonthFr(yyyyMm: string): string {
  const [, month] = yyyyMm.split("-");
  const label = FRENCH_MONTHS[parseInt(month, 10)] ?? month;
  return label;
}

// ── Component ────────────────────────────────────────────────────────

export default function DeleteEnvelopeModal({
  isOpen,
  onClose,
  envelope,
  envelopes,
  linkedTransactions,
  onMigrateToExisting,
  onCreateAndMigrate,
  onDeleteAll,
}: DeleteEnvelopeModalProps) {
  const [selectedOption, setSelectedOption] =
    useState<DeleteOption>("migrate-existing");
  const [targetEnvelopeId, setTargetEnvelopeId] = useState("");
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Validation state for Option B
  const [nameError, setNameError] = useState("");
  const [budgetError, setBudgetError] = useState("");

  const transactionCount = linkedTransactions.length;
  const monthGroups = groupTransactionsByMonth(linkedTransactions);
  const monthCount = monthGroups.length;

  // Available envelopes = all envelopes EXCEPT the one being deleted
  const availableEnvelopes = envelopes.filter((e) => e.id !== envelope.id);

  // Reset state when modal opens for a new envelope
  useEffect(() => {
    if (isOpen) {
      setSelectedOption(
        availableEnvelopes.length > 0 ? "migrate-existing" : "create-new",
      );
      setTargetEnvelopeId(availableEnvelopes[0]?.id ?? "");
      // Pre-fill new envelope with the deleted envelope's icon/color but
      // NOT the name — the user should choose a distinct name.
      setNewName("");
      setNewBudget(String(envelope.budget ?? ""));
      setLoading(false);
      setError("");
      setNameError("");
      setBudgetError("");
    }
  }, [isOpen, envelope.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation on change ──────────────────────────────────────

  const handleNameChange = (value: string) => {
    setNewName(value);
    const result = validateEnvelopeNameWithMessage(value);
    setNameError(result.valid ? "" : result.message);
  };

  const handleBudgetChange = (value: string) => {
    setNewBudget(value);
    const num = parseFloat(value);
    if (value.trim() === "") {
      setBudgetError("Le budget est requis.");
    } else if (isNaN(num)) {
      setBudgetError("Le budget doit être un nombre valide.");
    } else {
      const result = validateAmountWithMessage(num);
      setBudgetError(result.valid ? "" : result.message);
    }
  };

  // ── Submit ────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setError("");
    setLoading(true);

    try {
      if (selectedOption === "migrate-existing") {
        if (!targetEnvelopeId) {
          setError("Veuillez sélectionner une enveloppe de destination.");
          setLoading(false);
          return;
        }
        await onMigrateToExisting(targetEnvelopeId);
      } else if (selectedOption === "create-new") {
        // Validate before submitting
        const nameResult = validateEnvelopeNameWithMessage(newName);
        const budgetNum = parseFloat(newBudget);
        const amountResult = validateAmountWithMessage(budgetNum);

        if (!nameResult.valid || !amountResult.valid) {
          setNameError(nameResult.valid ? "" : nameResult.message);
          setBudgetError(amountResult.valid ? "" : amountResult.message);
          setLoading(false);
          return;
        }

        await onCreateAndMigrate(newName.trim(), budgetNum);
      } else {
        await onDeleteAll();
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'opération.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Derived button label ──────────────────────────────────────

  const confirmLabel = (() => {
    switch (selectedOption) {
      case "migrate-existing":
        return "Migrer et supprimer";
      case "create-new":
        return "Créer et migrer";
      case "delete-all":
        return "Tout supprimer";
    }
  })();

  const isConfirmDisabled = (() => {
    if (loading) return true;
    if (selectedOption === "migrate-existing" && !targetEnvelopeId) return true;
    if (selectedOption === "create-new") {
      return (
        !validateEnvelopeNameWithMessage(newName).valid ||
        !validateAmountWithMessage(parseFloat(newBudget)).valid
      );
    }
    return false;
  })();

  // ── Render ────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${envelope.color} text-app-text`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Supprimer l&apos;enveloppe</h2>
                  <p className="text-sm text-app-text-secondary">
                    {envelope.name}
                  </p>
                </div>
              </div>
              {!loading && (
                <button
                  onClick={onClose}
                  className="p-1.5 text-app-text-secondary hover:text-app-text hover:bg-app-bg rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ── Loading state ── */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <p className="text-sm text-app-text-secondary">
                  {selectedOption === "delete-all"
                    ? "Suppression en cours..."
                    : "Migration en cours..."}
                </p>
              </div>
            )}

            {/* ── Content (when not loading) ── */}
            {!loading && (
              <>
                {/* ── Transaction summary ── */}
                {transactionCount === 0 ? (
                  <div className="mb-6 p-4 rounded-xl bg-app-bg border border-app-border">
                    <p className="text-sm text-app-text-secondary">
                      Cette enveloppe ne contient aucune transaction. Elle sera
                      définitivement supprimée.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <p className="text-sm font-medium text-amber-400">
                        Cette enveloppe contient{" "}
                        <strong>{transactionCount}</strong> transaction
                        {transactionCount > 1 ? "s" : ""} répartie
                        {transactionCount > 1 ? "s" : ""} sur{" "}
                        <strong>{monthCount}</strong> mois.
                      </p>
                      {monthGroups.length > 0 && (
                        <ul className="mt-2 text-xs text-amber-400/80 space-y-0.5">
                          {monthGroups.map((g) => (
                            <li key={g.month}>
                              {formatMonthFr(g.month)} : {g.count} transaction
                              {g.count > 1 ? "s" : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <p className="text-sm text-app-text-secondary mb-4">
                      Que souhaitez-vous faire des transactions associées ?
                    </p>

                    {/* ── Option A: Migrate to existing ── */}
                    <label
                      className={`block p-4 rounded-xl border mb-3 cursor-pointer transition-colors ${
                        selectedOption === "migrate-existing"
                          ? "border-amber-500 bg-amber-500/5"
                          : "border-app-border hover:bg-app-bg"
                      } ${
                        availableEnvelopes.length === 0
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="migrate-existing"
                          checked={selectedOption === "migrate-existing"}
                          onChange={() =>
                            setSelectedOption("migrate-existing")
                          }
                          disabled={availableEnvelopes.length === 0}
                          className="mt-0.5 accent-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            Migrer vers une enveloppe existante
                          </p>
                          <p className="text-xs text-app-text-secondary mt-0.5">
                            Toutes les transactions seront transférées dans
                            l&apos;enveloppe choisie.
                          </p>

                          {selectedOption === "migrate-existing" &&
                            availableEnvelopes.length > 0 && (
                              <select
                                value={targetEnvelopeId}
                                onChange={(e) =>
                                  setTargetEnvelopeId(e.target.value)
                                }
                                className="mt-3 w-full rounded-lg bg-app-bg border border-app-border text-app-text text-sm px-3 py-2 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                {availableEnvelopes.map((env) => (
                                  <option key={env.id} value={env.id}>
                                    {env.name} — {env.budget.toFixed(2)}/mois
                                  </option>
                                ))}
                              </select>
                            )}

                          {availableEnvelopes.length === 0 && (
                            <p className="mt-2 text-xs text-amber-400">
                              Aucune autre enveloppe disponible.
                            </p>
                          )}
                        </div>
                      </div>
                    </label>

                    {/* ── Option B: Create new and migrate ── */}
                    <label
                      className={`block p-4 rounded-xl border mb-3 cursor-pointer transition-colors ${
                        selectedOption === "create-new"
                          ? "border-amber-500 bg-amber-500/5"
                          : "border-app-border hover:bg-app-bg"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="create-new"
                          checked={selectedOption === "create-new"}
                          onChange={() => setSelectedOption("create-new")}
                          className="mt-0.5 accent-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            Créer une nouvelle enveloppe et migrer
                          </p>
                          <p className="text-xs text-app-text-secondary mt-0.5">
                            Une nouvelle enveloppe sera créée avec les
                            transactions.
                          </p>

                          {selectedOption === "create-new" && (
                            <div className="mt-3 space-y-2">
                              <div>
                                <input
                                  type="text"
                                  value={newName}
                                  onChange={(e) =>
                                    handleNameChange(e.target.value)
                                  }
                                  placeholder="Nom de la nouvelle enveloppe"
                                  className={`w-full rounded-lg bg-app-bg border px-3 py-2 text-sm text-app-text placeholder:text-app-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                                    nameError
                                      ? "border-red-500"
                                      : "border-app-border"
                                  }`}
                                />
                                {nameError && (
                                  <p className="mt-1 text-xs text-red-400">
                                    {nameError}
                                  </p>
                                )}
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={newBudget}
                                  onChange={(e) =>
                                    handleBudgetChange(e.target.value)
                                  }
                                  placeholder="Budget mensuel"
                                  step="0.01"
                                  min="0.01"
                                  className={`w-full rounded-lg bg-app-bg border px-3 py-2 text-sm text-app-text placeholder:text-app-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                                    budgetError
                                      ? "border-red-500"
                                      : "border-app-border"
                                  }`}
                                />
                                {budgetError && (
                                  <p className="mt-1 text-xs text-red-400">
                                    {budgetError}
                                  </p>
                                )}
                              </div>
                              <p className="text-[10px] text-app-text-secondary/60">
                                L&apos;icône et la couleur de l&apos;enveloppe
                                supprimée seront conservées.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>

                    {/* ── Option C: Delete all ── */}
                    <label
                      className={`block p-4 rounded-xl border mb-3 cursor-pointer transition-colors ${
                        selectedOption === "delete-all"
                          ? "border-red-500 bg-red-500/5"
                          : "border-app-border hover:bg-app-bg"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="delete-all"
                          checked={selectedOption === "delete-all"}
                          onChange={() => setSelectedOption("delete-all")}
                          className="mt-0.5 accent-red-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-red-400">
                            Tout supprimer
                          </p>
                          <p className="text-xs text-red-400/70 mt-0.5">
                            Les <strong>{transactionCount}</strong> transactions
                            seront définitivement supprimées. Cette action est
                            irréversible.
                          </p>
                        </div>
                      </div>
                    </label>
                  </>
                )}

                {/* ── Error banner ── */}
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-app-bg hover:bg-app-bg/80 border border-app-border text-app-text-secondary hover:text-app-text rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirmDisabled}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedOption === "delete-all"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-black"
                    }`}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
