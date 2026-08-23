"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";
import RecurrenceBadge from "@/components/dashboard/RecurrenceBadge";
import { type Transaction } from "@/types/transaction";

type Envelope = {
  id: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  spent: number;
};

interface SearchDropdownProps {
  transactions: Transaction[];
  envelopes: Envelope[];
  currentDate: Date;
}

// Normalize text for accent-insensitive search
function normalize(str: string) {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function SearchDropdown({ transactions, envelopes, currentDate }: SearchDropdownProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { formatAmount } = useCurrencyFormatting();
  const envelopeMap = Object.fromEntries(envelopes.map((e) => [e.id, e]));

  const results = query.trim().length > 0
    ? transactions
        .filter((tx) => {
          const desc = normalize(tx.description || "");
          const envOrSource = tx.type === "income"
            ? normalize(tx.source || "")
            : normalize(envelopeMap[tx.envelopeId ?? ""]?.name || "");
          const q = normalize(query);
          // Amount matching: if query is a number (possibly partial), match against formatted amount
          const amountStr = tx.amount.toFixed(2).replace(".", ",");
          const amountStrDot = tx.amount.toFixed(2);
          const amountInt = Math.floor(tx.amount).toString();
          const amountMatch = amountStr.includes(query.trim()) || amountStrDot.includes(query.trim()) || amountInt.includes(query.trim());
          return desc.includes(q) || envOrSource.includes(q) || amountMatch;
        })
        .slice(0, 6)
    : [];

  const showDropdown = isFocused && query.trim().length > 0;

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setIsFocused(false); setQuery(""); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleResultClick = (tx: Transaction) => {
    setQuery("");
    setIsFocused(false);
    router.push(`/envelopes/${tx.envelopeId}?date=${currentDate.toISOString()}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* Search input */}
      <div className={`flex items-center gap-2 bg-app-surface border rounded-xl px-4 py-2.5 transition-all duration-200 ${isFocused ? "border-amber-500 ring-1 ring-amber-500/50 shadow-lg shadow-amber-900/10" : "border-app-border"}`}>
        <Search className="h-4 w-4 text-app-text-secondary flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Rechercher ce mois..."
          className="flex-1 bg-transparent text-sm text-app-text placeholder:text-app-text-secondary focus:outline-none"
          aria-label="Rechercher une dépense ce mois"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          role="combobox"
        />
        <AnimatePresence>
          {query.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              onClick={() => { setQuery(""); setIsFocused(false); }}
              className="p-0.5 text-app-text-secondary hover:text-app-text rounded-full transition-colors"
              aria-label="Effacer la recherche"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute top-full left-0 right-0 mt-2 bg-app-surface border border-app-border rounded-xl shadow-2xl z-50 overflow-hidden"
            role="listbox"
            aria-label="Résultats de recherche"
          >
            {results.length === 0 ? (
              <div className="px-4 py-4 text-sm text-app-text-secondary text-center">
                Aucun résultat
              </div>
            ) : (
              <ul className="divide-y divide-app-border/50">
                {results.map((tx, index) => {
                  const env = tx.envelopeId ? envelopeMap[tx.envelopeId] : undefined;
                  const isIncome = tx.type === "income";
                  return (
                    <motion.li
                      key={tx.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                    >
                      <button
                        onClick={() => handleResultClick(tx)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-bg/60 active:scale-[0.99] transition-all text-left group"
                        role="option"
                      >
                        {isIncome ? (
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-500" />
                        ) : env ? (
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${env.color}`} />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-app-text truncate">
                              {tx.description || (isIncome ? "Revenu" : "Dépense")}
                            </p>
                            {tx.recurrenceId && <RecurrenceBadge className="h-4 w-4 p-0.5 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-app-text-secondary truncate">
                            {isIncome
                              ? tx.source || "Revenu"
                              : `dans ${env?.name ?? "Enveloppe supprimée"}`
                            }
                          </p>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${isIncome || tx.isReimbursement ? "text-emerald-400" : "text-red-400"}`}>
                          {isIncome || tx.isReimbursement ? "+" : "-"}{formatAmount(tx.amount)}
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
