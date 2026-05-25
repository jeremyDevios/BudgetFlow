"use client";

import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc, where, writeBatch, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getMonthBounds, formatMonthYear } from "@/lib/dateUtils";
import {
  LogOut, 
  Settings, 
  Plus, 
  ChevronLeft,
  ChevronRight,
  TrendingUp, 
  AlertTriangle,
  Wallet,
  ShoppingCart,
  Fuel,
  Utensils,
  Plane,
  Heart,
  Gamepad2,
  Bus,
  Shirt,
  Music,
  Coffee,
  Briefcase,
  GraduationCap,
  Baby,
  PawPrint,
  Gift,
  Smartphone,
  Wifi,
  Zap,
  Droplets,
  Hammer,
  MoreHorizontal,
  LucideIcon,
  Bell,
  Share,
  List,
  Workflow,
  GripVertical,
  Maximize2,
  Minimize2,
  Clock,
} from "lucide-react";
import { isEnvelopeActiveForMonth } from "@/types/envelope";
import TransactionModal from "@/components/dashboard/TransactionModal";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";
import SearchDropdown from "@/components/dashboard/SearchDropdown";
import CalendarHeatmap from "@/components/dashboard/CalendarHeatmap";
import RotatingSmartInsight from "@/components/dashboard/RotatingSmartInsight";
import { useCalendarHeatmap } from "@/hooks/useCalendarHeatmap";
import { useSpendingForecast } from "@/hooks/useSpendingForecast";
import { useSmartSpendingInsights } from "@/hooks/useSmartSpendingInsights";
import { EnvelopeForecast, ForecastTransaction } from "@/lib/forecasting";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Types ---
type IconName = "ShoppingCart" | "Fuel" | "Utensils" | "Plane" | "Heart" | "Gamepad2" | "Bus" | "Shirt" | "Music" | "Coffee" | "Briefcase" | "GraduationCap" | "Baby" | "PawPrint" | "Gift" | "Smartphone" | "Wifi" | "Zap" | "Droplets" | "Hammer";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer
};

interface UserSettings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
  bentoPreset?: BentoPreset;
}

interface Envelope {
  id: string;
  name: string;
  budget: number;
  spent: number;
  icon: string;
  color: string;
  order?: number;
  tileSize?: TileSize | null;
  /** Mirrors the canonical field: true = only active in `activeMonths`. */
  isTemporary?: boolean;
  /** YYYY-MM months in which a temporary envelope is visible. */
  activeMonths?: string[];
}

type TileSize = "small" | "wide";
type BentoPreset = "compact" | "balanced" | "airy";

function resolveBentoPreset(value: string | undefined): BentoPreset {
  if (value === "compact" || value === "balanced" || value === "airy") {
    return value;
  }
  return "balanced";
}

function getBentoPresetConfig(preset: BentoPreset) {
  switch (preset) {
    case "compact":
      return {
        baseThreshold: 360,
        multiplier: 1.35,
        maxWideRatio: 0.35,
        fallbackWideRatio: 0.2,
      };
    case "airy":
      return {
        baseThreshold: 220,
        multiplier: 1.05,
        maxWideRatio: 0.7,
        fallbackWideRatio: 0.7,
      };
    case "balanced":
    default:
      return {
        baseThreshold: 280,
        multiplier: 1.2,
        maxWideRatio: 0.5,
        fallbackWideRatio: 0.34,
      };
  }
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  envelopeId: string;
  date: string;
  isReimbursement?: boolean;
}

function getTransactionImpact(tx: { amount: number; isReimbursement?: boolean }) {
  return tx.isReimbursement ? -tx.amount : tx.amount;
}

function getBentoTileSize(isWide: boolean) {
  if (isWide) {
    return "col-span-2";
  }
  return "col-span-1";
}

function formatEurosNoDecimals(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
}

function SortableEnvelopeTile({
  env,
  transactions,
  openMenuId,
  setOpenMenuId,
  onOpenTxModal,
  onNavigateDetails,
  forecast,
  isCurrentMonth,
  tileSize,
  onToggleTileSize,
  isResizing,
  isTemporary,
}: {
  env: Envelope;
  transactions: Transaction[];
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onOpenTxModal: (envelopeId: string) => void;
  onNavigateDetails: (envelopeId: string) => void;
  forecast?: EnvelopeForecast;
  isCurrentMonth: boolean;
  tileSize: TileSize;
  onToggleTileSize: (envelopeId: string, nextSize: TileSize) => void;
  isResizing: boolean;
  /** When true, renders the temporary-envelope visual cue on the tile. */
  isTemporary?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: env.id });
  const Icon = ICON_MAP[env.icon] || ShoppingCart;
  const remaining = env.budget - env.spent;
  const isWide = tileSize === "wide";
  const envTransactions = transactions.filter((t) => t.envelopeId === env.id);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : "auto",
  };
  const tileStateClassName = isDragging
    ? "ring-2 ring-amber-400/80 shadow-[0_14px_34px_rgba(245,158,11,0.32)]"
    : isResizing
      ? "scale-[1.02] ring-2 ring-cyan-400/65 shadow-[0_14px_34px_rgba(34,211,238,0.24)]"
      : "";

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={() => onNavigateDetails(env.id)}
        className={`bento-tile relative h-[172px] sm:h-[186px] p-3 sm:p-4 group cursor-pointer active:scale-[0.99] transition-all duration-300 ${tileStateClassName}`}
      >
        <div className={`absolute inset-0 rounded-xl ${env.color} opacity-[0.14] dark:opacity-[0.16] pointer-events-none`} />

        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-2 flex min-h-[2.4rem] items-start">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-1">
              <button
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing rounded-md p-1 text-app-text-secondary hover:bg-white/20 hover:text-app-text"
                title="Réorganiser"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className={`p-2 rounded-lg border border-app-border/80 ${env.color} text-app-text`}> 
                <Icon className="h-5 w-5" />
              </div>
              <h4 className="min-w-0 flex-1 text-sm font-semibold leading-tight text-app-text whitespace-normal break-words">{env.name}</h4>
              {isTemporary && (
                <span
                  className="ml-1 flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                  style={{
                    background: "var(--color-temporary-bg)",
                    border: "1px solid var(--color-temporary)",
                    color: "var(--color-temporary)",
                  }}
                  title="Enveloppe temporaire"
                >
                  <Clock className="h-2.5 w-2.5" />
                  Temporaire
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xl sm:text-2xl font-bold tabular-nums ${remaining < 0 ? "text-red-500" : "text-app-text"}`}>
                {remaining.toFixed(2)}€
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-app-text-secondary tabular-nums">sur {formatEurosNoDecimals(env.budget)}€</span>
            </div>
          </div>

          <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            {envTransactions.map((tx) => (
              (() => {
                const txAmount = getTransactionImpact(tx);
                return (
              <div
                key={tx.id}
                className={`h-full ${env.color} border-r border-white/25 dark:border-zinc-900/80 box-border`}
                style={{ width: `${env.budget > 0 ? (Math.abs(txAmount) / env.budget) * 100 : 0}%` }}
                title={`${tx.description || "Dépense"}: ${Number(txAmount).toFixed(2)}€`}
              />
                );
              })()
            ))}
          </div>

          {isCurrentMonth && forecast && forecast.hasData && (
            <div className={`mt-1.5 flex items-start gap-1 text-xs ${forecast.willExceed ? "text-red-400" : "text-emerald-400"}`}>
              {forecast.willExceed ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <TrendingUp className="h-3 w-3 shrink-0" />}
              <span className="leading-snug">
                {forecast.willExceed
                  ? `Surcoût est.: ${forecast.excessAmount.toFixed(0)}€`
                  : `Rest est.: ${forecast.projectedRemaining.toFixed(0)}€`}
              </span>
            </div>
          )}

          <div className="mt-auto flex items-end justify-between pt-1">
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === env.id ? null : env.id);
                }}
                className={`rounded-lg p-1.5 transition-colors ${
                  openMenuId === env.id
                    ? "bg-app-surface/80 text-app-text"
                    : "text-app-text-secondary hover:bg-app-surface/60 hover:text-app-text"
                }`}
                title="Options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              {openMenuId === env.id && (
                <div className="glass-panel-strong absolute bottom-full left-0 z-50 mb-2 flex w-56 flex-col overflow-hidden rounded-xl p-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTxModal(env.id);
                      setOpenMenuId(null);
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-amber-500 transition-colors hover:bg-app-surface/70"
                  >
                    <Plus className="h-4 w-4" /> Nouvelle Dépense
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateDetails(env.id);
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-app-text-secondary transition-colors hover:bg-app-surface/70 hover:text-app-text"
                  >
                    <TrendingUp className="h-4 w-4" /> Détails & Historique
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleTileSize(env.id, isWide ? "small" : "wide");
              }}
              className="z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-app-border/70 bg-app-surface/80 text-app-text-secondary shadow-sm backdrop-blur-md transition-all hover:border-app-border hover:text-app-text"
              title={isWide ? "Réduire la tuile" : "Agrandir la tuile"}
              aria-label={isWide ? `Réduire ${env.name}` : `Agrandir ${env.name}`}
            >
              {isWide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [defaultEnvelopeId, setDefaultEnvelopeId] = useState<string | undefined>(undefined);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
  const [resizingEnvelopeId, setResizingEnvelopeId] = useState<string | null>(null);
  
  // Gestion de la date sélectionnée (Mois)
  const [currentDate, setCurrentDate] = useState(new Date());
    const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { loginDates, loading: heatmapLoading } = useCalendarHeatmap(
    user?.uid ?? null,
    currentDate
  );

  // Sum all transaction amounts per calendar day ("YYYY-MM-DD") for heatmap severity.
  const dailySpend = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      const day = tx.date?.split("T")[0];
      if (day) map.set(day, (map.get(day) ?? 0) + getTransactionImpact(tx));
    });
    return map;
  }, [transactions]);

  // YYYY-MM string for the currently viewed month — used by the temporary-envelope filter.
  const selectedMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  // Envelopes visible for the selected month:
  //  - All permanent envelopes are always included.
  //  - Temporary envelopes are included only when selectedMonth is in their activeMonths list.
  const visibleEnvelopes = useMemo(
    () => envelopes.filter((env) => isEnvelopeActiveForMonth(env, selectedMonth)),
    [envelopes, selectedMonth],
  );

  const envelopeBudgetById = useMemo(() => {
    const m = new Map<string, number>();
    visibleEnvelopes.forEach(env => m.set(env.id, env.budget));
    return m;
  }, [visibleEnvelopes]);

  const perEnvelopeSpendPerDay = useMemo(() => {
    const raw = new Map<string, Map<string, number>>();
    transactions.forEach(tx => {
      const day = tx.date?.split("T")[0];
      if (!day || !envelopeBudgetById.has(tx.envelopeId)) return;
      if (!raw.has(day)) raw.set(day, new Map());
      const dayMap = raw.get(day)!;
      dayMap.set(tx.envelopeId, (dayMap.get(tx.envelopeId) ?? 0) + getTransactionImpact(tx));
    });

    const result = new Map<string, import("@/lib/calendarSeverity").EnvelopeSpendEntry[]>();
    raw.forEach((envelopeMap, day) => {
      const entries: import("@/lib/calendarSeverity").EnvelopeSpendEntry[] = [];
      envelopeMap.forEach((spend, envelopeId) => {
        entries.push({ spend, budget: envelopeBudgetById.get(envelopeId) ?? 0 });
      });
      result.set(day, entries);
    });
    return result;
  }, [transactions, envelopeBudgetById]);

  const autoWideEnvelopeIds = useMemo(() => {
    if (!visibleEnvelopes.length) return new Set<string>();
    const preset = resolveBentoPreset(settings?.bentoPreset);
    const presetConfig = getBentoPresetConfig(preset);

    const positiveBudgets = visibleEnvelopes.filter((env) => env.budget > 0);
    if (!positiveBudgets.length) return new Set<string>();

    const sortedBudgets = positiveBudgets
      .map((env) => env.budget)
      .sort((a, b) => a - b);
    const medianBudget = sortedBudgets[Math.floor(sortedBudgets.length / 2)] ?? 0;
    const dynamicThreshold = Math.max(presetConfig.baseThreshold, medianBudget * presetConfig.multiplier);

    const rankedBudgetIds = [...positiveBudgets]
      .sort((a, b) => b.budget - a.budget)
      .map((env) => env.id);

    const wideIdSet = new Set(
      positiveBudgets
      .filter((env) => env.budget >= dynamicThreshold)
      .map((env) => env.id)
    );

    const fallbackWideTiles = Math.max(1, Math.round(visibleEnvelopes.length * presetConfig.fallbackWideRatio));
    if (wideIdSet.size < fallbackWideTiles) {
      for (const id of rankedBudgetIds) {
        if (wideIdSet.size >= fallbackWideTiles) break;
        wideIdSet.add(id);
      }
    }

    let wideIds = rankedBudgetIds.filter((id) => wideIdSet.has(id));

    const maxWideTiles = Math.max(1, Math.round(visibleEnvelopes.length * presetConfig.maxWideRatio));
    if (wideIds.length > maxWideTiles) {
      wideIds = wideIds.slice(0, maxWideTiles);
    }

    return new Set(wideIds);
  }, [visibleEnvelopes, settings?.bentoPreset]);

  const resolvedTileSizes = useMemo(() => {
    const map = new Map<string, TileSize>();

    visibleEnvelopes.forEach((env) => {
      if (env.tileSize === "small" || env.tileSize === "wide") {
        map.set(env.id, env.tileSize);
        return;
      }

      map.set(env.id, autoWideEnvelopeIds.has(env.id) ? "wide" : "small");
    });

    return map;
  }, [autoWideEnvelopeIds, visibleEnvelopes]);

  // --- Calculs globaux (restricted to visible envelopes for the selected month) ---
  const totalBudgetEnvelopes = visibleEnvelopes.reduce((acc, env) => acc + env.budget, 0);
  const totalSpentEnvelopes = visibleEnvelopes.reduce((acc, env) => acc + env.spent, 0);

  // Temporary envelopes that are active for the selected month contribute their own
  // budget on top of the base monthly pool (income - fixedCosts - savings).
  // visibleEnvelopes already contains only month-active envelopes, so filtering by
  // isTemporary here is sufficient — no extra date check is needed.
  const temporaryEnvelopesBudget = visibleEnvelopes
    .filter((env) => env.isTemporary)
    .reduce((acc, env) => acc + env.budget, 0);

  // Reste à vivre réel (ce qu'il reste dans les enveloppes + surplus non alloué)
  // Logic: (Income - Fixed - Savings) + active-temporary-envelope budgets = Total Available for Month
  // Current Balance = Total Available - Total Spent
  const monthlyTotalAvailable = settings
    ? settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings + temporaryEnvelopesBudget
    : 0;
  const currentMonthBalance = monthlyTotalAvailable - totalSpentEnvelopes;
  
  const globalProgress = monthlyTotalAvailable > 0 ? (totalSpentEnvelopes / monthlyTotalAvailable) * 100 : 0;

  const today = new Date();
  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  const forecastTransactions: ForecastTransaction[] = transactions.map(tx => ({
    envelopeId: tx.envelopeId || '',
    amount: tx.amount || 0,
    date: tx.date || '',
    isReimbursement: tx.isReimbursement ?? false,
  }));

  const { globalForecast, envelopeForecasts, loading: forecastLoading } = useSpendingForecast({
    userId: user?.uid ?? null,
    envelopes: visibleEnvelopes.map(e => ({ id: e.id, budget: e.budget, name: e.name })),
    currentMonthTransactions: forecastTransactions,
    monthlyBudget: monthlyTotalAvailable,
    isCurrentMonth,
  });

  const { globalNotifications, loading: smartInsightsLoading } =
    useSmartSpendingInsights({
      userId: user?.uid ?? null,
      envelopes: visibleEnvelopes.map((envelope) => ({
        id: envelope.id,
        name: envelope.name,
        budget: envelope.budget,
      })),
      currentMonthTransactions: transactions.map((transaction) => ({
        id: transaction.id,
        envelopeId: transaction.envelopeId,
        amount: transaction.amount,
        date: transaction.date,
        description: transaction.description,
        isReimbursement: transaction.isReimbursement ?? false,
      })),
      envelopeForecasts,
      isCurrentMonth,
    });

  // --- Chargement des données ---
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 0. Check Notifications (Une seule fois au chargement)
      try {
          // Utilisation de try/catch individuel pour éviter que tout plante si une permission manque
          let notifTriggered = false;
          const notifKey = `notif_popup_seen_${user.uid}`;
          // ... rest of notification logic ...
      } catch(e) { logger.warn("Notif check failed"); }     
      
      const notifKey = `notif_popup_seen_${user.uid}`;

      if (!sessionStorage.getItem(notifKey)) {
          // On wrap la lecture user
          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
               const data = userSnap.data();
               if (!data.notificationsEnabled) {
                   setShowNotifPopup(true);
                   sessionStorage.setItem(notifKey, 'true');
               }
            } else {
               // Si le doc user n'existe pas encore
               setShowNotifPopup(true);
               sessionStorage.setItem(notifKey, 'true');
            }
          } catch(e) {
             logger.warn("User doc read failed");
             // Fallback: montrer la popup quand même si on ne sait pas
             if (!sessionStorage.getItem(notifKey)) {
                setShowNotifPopup(true);
                sessionStorage.setItem(notifKey, 'true');
             }
          }
      }
      
      // 0.5. Check iOS Install
      // ... (local storage sync, pas d'appel firestore) ...

      // 1. Settings (Statique)
      try {
          const settingsRef = doc(db, "users", user.uid, "settings", "general");
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists()) {
              setSettings(settingsSnap.data() as UserSettings);
          }
      } catch(e) { logger.warn("Settings read failed"); }

      // 2. Enveloppes
      let envList: Envelope[] = [];
      try {
          const envRef = collection(db, "users", user.uid, "envelopes");
          const envSnap = await getDocs(envRef);
          envSnap.forEach((doc) => {
            const data = doc.data();
            envList.push({ 
                id: doc.id, 
                ...data, 
                spent: 0,
                order: data.order,
                tileSize: data.tileSize === "small" || data.tileSize === "wide" ? data.tileSize : null,
            } as unknown as Envelope); 
          });
          // Tri par ordre
          envList.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      } catch(e) { logger.warn("Envelopes read failed"); }

      // 3. Transactions du mois sélectionné
      const { start, end } = getMonthBounds(currentDate);
      const txList: Transaction[] = [];
      
      try {
          const txRef = collection(db, "users", user.uid, "transactions");
          const q = query(
            txRef, 
            where("date", ">=", start),
            where("date", "<=", end)
          );
          
          const txSnap = await getDocs(q);
          
          txSnap.forEach((doc) => {
            const data = doc.data();
            txList.push({
                id: doc.id,
                amount: Number(data.amount || 0),
                description: typeof data.description === "string" ? data.description : "",
                envelopeId: typeof data.envelopeId === "string" ? data.envelopeId : "",
                date: typeof data.date === "string" ? data.date : "",
                isReimbursement: data.isReimbursement ?? false,
            });
            
            // Ajouter au 'spent' de l'enveloppe correspondante
            const envIndex = envList.findIndex(e => e.id === data.envelopeId);
            if (envIndex !== -1) {
                envList[envIndex].spent += getTransactionImpact({
                  amount: Number(data.amount || 0),
                  isReimbursement: data.isReimbursement ?? false,
                });
            }
          });
      } catch(e) { logger.warn("Transactions read failed"); }
      
      setTransactions(txList);
      setEnvelopes(envList);
      
    } catch (error) {
      logger.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, currentDate]); // Recharger quand l'utilisateur OU la date change

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleEnvelopeReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setEnvelopes((items) => {
      // The DnD context only contains visibleEnvelopes (filtered by selectedMonth).
      // Operating on the full `items` array would compute wrong indices when hidden
      // temporary envelopes occupy positions between visible ones, corrupting their
      // stored `order` as collateral damage.  Reorder only within the visible subset
      // and merge hidden envelopes back without touching their order values.
      const visible = items.filter((e) => isEnvelopeActiveForMonth(e, selectedMonth));
      const hidden  = items.filter((e) => !isEnvelopeActiveForMonth(e, selectedMonth));

      const oldIndex = visible.findIndex((i) => i.id === active.id);
      const newIndex = visible.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;

      const reordered = arrayMove(visible, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx,
      }));

      if (user) {
        const batch = writeBatch(db);
        reordered.forEach((env) => {
          batch.update(doc(db, "users", user.uid, "envelopes", env.id), { order: env.order });
        });
        batch.commit().catch(() => logger.warn("Envelope order save failed"));
      }

      return [...reordered, ...hidden];
    });
  };

  const handleEnvelopeTileSizeToggle = async (envelopeId: string, nextSize: TileSize) => {
    if (!user) return;
    setResizingEnvelopeId(envelopeId);

    setEnvelopes((items) =>
      items.map((item) =>
        item.id === envelopeId
          ? {
              ...item,
              tileSize: nextSize,
            }
          : item
      )
    );

    try {
      await updateDoc(doc(db, "users", user.uid, "envelopes", envelopeId), { tileSize: nextSize });
    } catch {
      logger.warn("Envelope tile size save failed");
    } finally {
      setTimeout(() => {
        setResizingEnvelopeId((current) => (current === envelopeId ? null : current));
      }, 260);
    }
  };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login"); // Force redirect
  };

  if (loading) {
    return <div className="min-h-screen bg-app-bg flex items-center justify-center text-app-text">Chargement...</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-app-bg text-app-text pb-20 sm:pb-8">
      <div className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-900/20" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-800/20" />
        
      {/* Header Mobile / Desktop */}
            <header className="glass-panel sticky top-0 z-30 border-b border-app-border/60 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="glass-panel flex items-center gap-2 rounded-full p-1">
                        <button
                            onClick={() => changeMonth(-1)}
                            className="p-1 rounded-full text-app-text-secondary hover:text-app-text hover:bg-app-surface active:scale-75"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="text-sm font-semibold capitalize w-28 sm:w-32 text-center select-none">
                            {formatMonthYear(currentDate)}
                        </span>
                        <button
                            onClick={() => changeMonth(1)}
                            className="p-1 rounded-full text-app-text-secondary hover:text-app-text hover:bg-app-surface active:scale-75"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    {/* Desktop-only secondary icons */}
                    <button
                        onClick={() => router.push('/evolution')}
                        className="hidden sm:flex p-2 rounded-full hover:bg-app-surface text-app-text-secondary hover:text-amber-500 transition-colors active:scale-90"
                        title="Évolution des dépenses"
                    >
                        <TrendingUp className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => router.push('/history')}
                        className="hidden sm:flex p-2 rounded-full hover:bg-app-surface text-app-text-secondary hover:text-app-text transition-colors active:scale-90"
                        title="Historique Global"
                    >
                        <List className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => router.push('/cashflow')}
                        className="hidden sm:flex p-2 rounded-full hover:bg-app-surface text-app-text-secondary hover:text-emerald-500 transition-colors active:scale-90"
                        title="Cash Flow"
                    >
                        <Workflow className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => router.push('/settings')}
                        className="hidden sm:flex p-2 rounded-full hover:bg-app-surface text-app-text-secondary hover:text-app-text transition-colors active:scale-90"
                        title="Paramètres"
                    >
                        <Settings className="h-5 w-5" />
                    </button>

                    {/* Mobile-only: "More" dropdown */}
                    <div className="relative sm:hidden" ref={moreMenuRef}>
                        <button
                            onClick={() => setShowMoreMenu(prev => !prev)}
                            className="p-2 rounded-full hover:bg-app-surface text-app-text-secondary hover:text-app-text transition-colors active:scale-90"
                            title="Plus d'options"
                            aria-expanded={showMoreMenu}
                            aria-haspopup="true"
                        >
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {showMoreMenu && (
                            <div className="glass-panel-strong absolute right-0 top-full mt-2 w-52 rounded-xl z-50 overflow-hidden p-1">
                                <button
                                    onClick={() => { router.push('/evolution'); setShowMoreMenu(false); }}
                                    className="flex items-center gap-3 w-full px-3 py-3 text-sm text-app-text-secondary hover:text-amber-500 hover:bg-app-bg rounded-lg transition-colors text-left"
                                >
                                    <TrendingUp className="h-4 w-4 shrink-0" /> Évolution
                                </button>
                                <button
                                    onClick={() => { router.push('/history'); setShowMoreMenu(false); }}
                                    className="flex items-center gap-3 w-full px-3 py-3 text-sm text-app-text-secondary hover:text-app-text hover:bg-app-bg rounded-lg transition-colors text-left"
                                >
                                    <List className="h-4 w-4 shrink-0" /> Historique
                                </button>
                                <button
                                    onClick={() => { router.push('/cashflow'); setShowMoreMenu(false); }}
                                    className="flex items-center gap-3 w-full px-3 py-3 text-sm text-app-text-secondary hover:text-emerald-500 hover:bg-app-bg rounded-lg transition-colors text-left"
                                >
                                    <Workflow className="h-4 w-4 shrink-0" /> Cash Flow
                                </button>
                                <div className="h-px bg-app-border my-1" />
                                <button
                                    onClick={() => { router.push('/settings'); setShowMoreMenu(false); }}
                                    className="flex items-center gap-3 w-full px-3 py-3 text-sm text-app-text-secondary hover:text-app-text hover:bg-app-bg rounded-lg transition-colors text-left"
                                >
                                    <Settings className="h-4 w-4 shrink-0" /> Paramètres
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Logout: always visible */}
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-full hover:bg-app-surface text-app-text-secondary hover:text-red-500 transition-colors active:scale-90"
                        title="Se déconnecter"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </header>

      <main className="relative z-10 max-w-5xl mx-auto p-4 space-y-8">
        
        {/* Résumé du Mois (Card Principale) */}
        <section className="glass-panel-strong rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-1 py-3" aria-live="polite">
                <span className="text-app-text-secondary text-xs font-medium tracking-wide uppercase">Reste disponible</span>
                <h2 className={`text-4xl font-extrabold tracking-tighter ${currentMonthBalance < 0 ? 'text-red-500' : 'text-app-text'}`}>
                    {currentMonthBalance.toFixed(2)} <span className="text-2xl text-app-text-secondary">€</span>
                </h2>
                <div className="text-xs text-app-text-secondary">
                    Sur {monthlyTotalAvailable.toFixed(0)} € prévus
                </div>
            </div>

            {/* Global Progress Bar */}
            <div className="mt-6 space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-app-text-secondary">
                    <span>Dépenses : {totalSpentEnvelopes.toFixed(2)} €</span>
                    <span>{globalProgress.toFixed(0)}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${globalProgress > 100 ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-orange-600'}`}
                        style={{ width: `${Math.min(globalProgress, 100)}%` }}
                    ></div>
                </div>
                {/* Visualisation des segments (Optionnel, simplifié ici) */}
                <div className="flex h-1 mt-1 gap-1">
                    {visibleEnvelopes.map((env) => (
                        <div 
                            key={env.id} 
                            className={`h-full rounded-full ${env.color} opacity-80`}
                            style={{ 
                                width: `${monthlyTotalAvailable > 0 ? (env.spent / monthlyTotalAvailable) * 100 : 0}%`,
                                display: env.spent > 0 ? 'block' : 'none'
                             }}
                        />
                    ))}
                </div>
            </div>
                        <div className="my-6 border-t border-black/10 dark:border-white/10 opacity-60" />

                        <CalendarHeatmap
                            month={currentDate}
                            dailySpend={dailySpend}
                          perEnvelopeSpendPerDay={perEnvelopeSpendPerDay}
                            loginDates={loginDates}
                            monthlyBudget={totalBudgetEnvelopes}
                            loading={heatmapLoading}
                            embedded
                        />
                        {/* Forecast Estimation */}
                        {isCurrentMonth && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="mt-4 pt-4 border-t border-black/10 dark:border-white/10"
                          >
                            {forecastLoading ? (
                              <div className="animate-pulse h-8 bg-black/10 dark:bg-white/10 rounded-lg w-3/4 mx-auto" />
                            ) : !globalForecast || !globalForecast.hasEnoughData ? (
                              <div className="flex items-center justify-center gap-2 text-app-text-secondary text-xs">
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span>Pas assez de données pour une estimation (premier mois d&apos;utilisation)</span>
                              </div>
                            ) : globalForecast.willExceed ? (
                              <div className="flex w-full flex-col items-center gap-3">
                                <div className="flex w-full max-w-md flex-col items-center gap-1 text-center">
                                  <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Surcoût est.: {globalForecast.excessAmount.toFixed(2)} €</span>
                                  </div>
                                  <div className="text-xs text-app-text-secondary">
                                    Projection fin de mois : {globalForecast.projectedTotal.toFixed(2)} € de dépenses
                                  </div>
                                </div>
                                {smartInsightsLoading ? (
                                  <div className="h-16 w-full max-w-[28rem] animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
                                ) : (
                                  <RotatingSmartInsight
                                    notifications={globalNotifications}
                                    className="mx-auto w-full max-w-[28rem]"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="flex w-full flex-col items-center gap-3">
                                <div className="flex w-full max-w-md flex-col items-center gap-1 text-center">
                                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                                    <TrendingUp className="h-4 w-4" />
                                    <span>Rest est.: {globalForecast.projectedRemaining.toFixed(2)} €</span>
                                  </div>
                                  <div className="text-xs text-app-text-secondary">
                                    Projection dépenses totales : {globalForecast.projectedTotal.toFixed(2)} €
                                  </div>
                                </div>
                                {smartInsightsLoading ? (
                                  <div className="h-16 w-full max-w-[28rem] animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
                                ) : (
                                  <RotatingSmartInsight
                                    notifications={globalNotifications}
                                    className="mx-auto w-full max-w-[28rem]"
                                  />
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                </section>

        {/* Recherche */}
        <section aria-label="Rechercher une dépense">
          <SearchDropdown 
            transactions={transactions}
            envelopes={envelopes}
            currentDate={currentDate}
          />
        </section>

        {/* Grille des Enveloppes */}
        <section>
            <div className="mb-4 px-2">
                <h3 className="text-lg font-bold text-app-text">Mes Enveloppes</h3>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnvelopeReorder}>
              <SortableContext items={visibleEnvelopes.map((env) => env.id)} strategy={rectSortingStrategy}>
                <motion.div
                    className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                >
                    {visibleEnvelopes.map((env) => {
                      const tileSize = resolvedTileSizes.get(env.id) ?? "small";
                      const isWide = tileSize === "wide";

                      return (
                      <motion.div
                        key={env.id}
                        className={getBentoTileSize(isWide)}
                        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } } }}
                      >
                        <SortableEnvelopeTile
                          env={env}
                          transactions={transactions}
                          openMenuId={openMenuId}
                          setOpenMenuId={setOpenMenuId}
                          onOpenTxModal={(envelopeId) => {
                            setDefaultEnvelopeId(envelopeId);
                            setIsTxModalOpen(true);
                          }}
                          onNavigateDetails={(envelopeId) =>
                            router.push(`/envelopes/${envelopeId}?date=${currentDate.toISOString()}`)
                          }
                          forecast={envelopeForecasts[env.id]}
                          isCurrentMonth={isCurrentMonth}
                          tileSize={tileSize}
                          onToggleTileSize={handleEnvelopeTileSizeToggle}
                          isResizing={resizingEnvelopeId === env.id}
                          isTemporary={!!env.isTemporary}
                        />
                      </motion.div>
                      );
                    })}
                </motion.div>
              </SortableContext>
            </DndContext>
        </section>

      </main>

      {/* Floating Action Button (FAB) - Quick Add */}
      <button 
        onClick={() => setIsTxModalOpen(true)}
                aria-label="Ajouter une transaction"
                className="fixed bottom-6 right-6 p-4 bg-amber-500 text-app-text rounded-full shadow-lg shadow-amber-900/20 transition-transform active:scale-95 z-40 animate-fab-pulse"
      >
        <Plus className="h-8 w-8" />
      </button>
      
      {/* Popup Notification */}
      {showNotifPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-6 relative overflow-hidden">
             
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Bell className="w-24 h-24 text-amber-500 -rotate-12 transform translate-x-4 -translate-y-4" />
              </div>

              <div className="relative z-10 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mb-2">
                     <Bell className="w-6 h-6" />
                  </div>
                  
                  <h2 className="text-xl font-bold text-app-text">Ne loupez aucune dépense !</h2>
                  
                  <p className="text-app-text-secondary text-sm">
                     Activez le rappel quotidien de 19h pour garder votre budget à jour. 
                     C'est le meilleur moyen de tenir ses objectifs ! 🎯
                  </p>

                  <div className="flex flex-col gap-3 pt-4">
                      <button 
                          onClick={() => router.push('/settings')}
                          className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-app-text font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/20"
                      >
                          Aller activer les notifications
                      </button>
                      <button 
                          onClick={() => setShowNotifPopup(false)}
                          className="w-full py-2 px-4 text-app-text-secondary hover:text-app-text text-sm font-medium transition-colors"
                      >
                          Peut-être plus tard
                      </button>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Install App Popup (iOS) */}
      {showInstallPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-6 relative overflow-hidden">
             
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Share className="w-24 h-24 text-blue-500 -rotate-12 transform translate-x-4 -translate-y-4" />
              </div>

              <div className="relative z-10 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-2">
                     <Share className="w-6 h-6" />
                  </div>
                  
                  <h2 className="text-xl font-bold text-app-text">Installez l'application</h2>
                  
                  <p className="text-app-text-secondary text-sm">
                     Pour une meilleure expérience, ajoutez BudgetFlow à votre écran d'accueil.
                  </p>
                  
                  <div className="bg-app-surface/50 rounded-lg p-4 text-left text-sm text-zinc-300 space-y-2">
                      <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-700 text-xs font-bold">1</span>
                          <span>Touchez le bouton <span className="font-bold text-blue-400">Partager</span> <Share className="w-3 h-3 inline" /></span>
                      </div>
                      <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-700 text-xs font-bold">2</span>
                          <span>Sélectionnez <span className="font-bold">Sur l'écran d'accueil</span> <Plus className="w-3 h-3 inline border border-current rounded-[2px]" /></span>
                      </div>
                  </div>

                  <div className="pt-2">
                      <button 
                          onClick={() => setShowInstallPopup(false)}
                          className="w-full py-3 px-4 bg-app-surface hover:bg-app-surface text-app-text font-medium rounded-xl transition-colors"
                      >
                          Compris
                      </button>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Modale d'ajout transaction */}
      <TransactionModal 
        isOpen={isTxModalOpen} 
        onClose={() => {
            setIsTxModalOpen(false);
            setDefaultEnvelopeId(undefined);
        }}
        envelopes={envelopes}
                refreshData={() => { fetchData(); showToast("Dépense ajoutée !"); }}
        defaultEnvelopeId={defaultEnvelopeId}
      />

            {/* Toast notification */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -60, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -60, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-xl shadow-emerald-900/30 flex items-center gap-2"
                        role="status"
                        aria-live="polite"
                    >
                        ✓ {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>

    </div>
  );
}
