"use client";

import { useAuth } from "@/context/AuthContext";
import { useAnonymousMode } from "@/context/AnonymousModeContext";
import { useCurrency } from "@/context/CurrencyContext";
import { SUPPORTED_CURRENCIES, CurrencyCode, getCurrencySymbol } from "@/types/currency";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  writeBatch,
  increment,
} from "firebase/firestore";
import {
  validateEnvelopeNameWithMessage,
  checkEnvelopeQuota,
} from "@/lib/validation";
import {
  loadSettings,
  saveSettings,
  resolveDetailedEnabled,
  computeDetailedTotal,
  createEmptyBudgetSubItem,
} from "@/lib/settingsService";
import {
  fetchLinkedTransactions,
  migrateTransactionsToExisting,
  createEnvelopeAndMigrate,
  deleteEnvelopeAndTransactions,
} from "@/lib/envelopeService";
import { type Transaction } from "@/types/transaction";
import { UserSettings, DEFAULT_USER_SETTINGS, BudgetSubItem } from "@/types/settings";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MoveLeft,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Bell,
  Loader2,
  Check,
  GripVertical,
  Briefcase,
  Clock,
  Coffee,
} from "lucide-react";

const DONATION_URL = "https://ko-fi.com/vizualy";
import { useNotifications } from "@/hooks/useNotifications";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { logger } from "@/lib/logger";
import ThemeToggle from "@/components/ThemeToggle";
import BudgetDetailEditor from "@/components/settings/BudgetDetailEditor";
import { Envelope } from "@/types/envelope";
import TemporaryEnvelopeForm, {
  ICON_MAP,
  COLORS,
  EnvelopeFormValues,
} from "@/components/settings/TemporaryEnvelopeForm";
import DeleteEnvelopeModal from "@/components/settings/DeleteEnvelopeModal";

// ---------------------------------------------------------------------------
// Types  (imported from @/types/settings)
// ---------------------------------------------------------------------------
// BentoPreset, UserSettings, and DEFAULT_USER_SETTINGS are defined in
// src/types/settings.ts and imported above. The local type declarations
// and resolveBentoPreset helper that used to live here have been removed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0].toUpperCase()).join("");
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

/**
 * Formats a YYYY-MM string into a short French label, e.g. "janv. 25".
 * Used inside the temporary envelope row to display active-month chips.
 */
function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

// ---------------------------------------------------------------------------
// SortableEnvelopeRow — permanent envelopes with drag-and-drop
// ---------------------------------------------------------------------------

function SortableEnvelopeRow({
  env,
  openModal,
  handleDeleteEnvelope,
  symbol,
}: {
  env: Envelope;
  openModal: (env?: Envelope) => void;
  handleDeleteEnvelope: (id: string, name: string) => void;
  symbol: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: env.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
  };

  const Icon = ICON_MAP[env.icon] || ICON_MAP["ShoppingCart"];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center justify-between group mb-3"
    >
      <div className="flex items-center gap-4">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-app-text-secondary hover:text-app-text p-1 -ml-2 touch-none"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Icon badge */}
        <div className={`p-2 rounded-lg ${env.color} text-app-text`}>
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h3 className="font-bold">{env.name}</h3>
          <p className="text-sm text-app-text-secondary">
            {Number(env.budget).toFixed(2)} {symbol} / mois
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => openModal(env)}
          className="p-2 text-app-text-secondary hover:text-app-text hover:bg-app-surface rounded-lg"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDeleteEnvelope(env.id, env.name)}
          className="p-2 text-app-text-secondary hover:text-red-500 hover:bg-red-900/20 rounded-lg"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemporaryEnvelopeRow — read-only row for the temporary section (no DnD)
// ---------------------------------------------------------------------------

function TemporaryEnvelopeRow({
  env,
  openModal,
  handleDeleteEnvelope,
  symbol,
}: {
  env: Envelope;
  openModal: (env?: Envelope) => void;
  handleDeleteEnvelope: (id: string, name: string) => void;
  symbol: string;
}) {
  const Icon = ICON_MAP[env.icon] || ICON_MAP["ShoppingCart"];
  const months = env.activeMonths ?? [];
  const visibleMonths = months.slice(0, 4);
  const hiddenCount = months.length - visibleMonths.length;

  return (
    <div
      className="rounded-xl p-4 flex items-center justify-between group mb-3"
      style={{
        background: "var(--color-temporary-bg)",
        border: "1px solid var(--color-temporary)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon badge */}
        <div className={`p-2 rounded-lg shrink-0 ${env.color} text-app-text`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold truncate">{env.name}</h3>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                color: "var(--color-temporary)",
                background: "rgba(244,148,26,0.15)",
                border: "1px solid var(--color-temporary)",
              }}
            >
              <Clock className="h-3 w-3" />
              Temporaire
            </span>
          </div>

          <p className="text-sm text-app-text-secondary">
            {Number(env.budget).toFixed(2)} {symbol} / mois
          </p>

          {/* Active-month chips */}
          {visibleMonths.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {visibleMonths.map((m) => (
                <span
                  key={m}
                  className="text-xs px-1.5 py-0.5 rounded-md"
                  style={{
                    background: "var(--color-temporary-bg)",
                    color: "var(--color-temporary)",
                    border: "1px solid var(--color-temporary)",
                  }}
                >
                  {formatMonth(m)}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="text-xs text-app-text-secondary self-center">
                  +{hiddenCount}
                </span>
              )}
            </div>
          )}

          {months.length === 0 && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Aucun mois actif
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
        <button
          onClick={() => openModal(env)}
          className="p-2 text-app-text-secondary hover:text-app-text hover:bg-app-surface rounded-lg"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDeleteEnvelope(env.id, env.name)}
          className="p-2 text-app-text-secondary hover:text-red-500 hover:bg-red-900/20 rounded-lg"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { user } = useAuth();
  const { anonymousMode, anonymousModeReady, setAnonymousMode } = useAnonymousMode();
  const { currency, setCurrency } = useCurrency();
  const symbol = getCurrencySymbol(currency);
  const router = useRouter();
  const {
    permission,
    requestPermission,
    disableNotifications,
    loading: notifLoading,
  } = useNotifications();
  const [dbNotifEnabled, setDbNotifEnabled] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [anonymousModeSaving, setAnonymousModeSaving] = useState(false);

  // Account deletion state
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_USER_SETTINGS });
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const latestDetailedItemsRef = useRef({
    fixedCostsItems: DEFAULT_USER_SETTINGS.fixedCostsItems,
    savingsItems: DEFAULT_USER_SETTINGS.savingsItems,
  });

  // Modal state — individual form fields are managed inside TemporaryEnvelopeForm.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);

  // Delete-envelope modal state
  const [showDeleteEnvelopeModal, setShowDeleteEnvelopeModal] = useState(false);
  const [deletingEnvelope, setDeletingEnvelope] = useState<Envelope | null>(null);
  const [linkedTransactions, setLinkedTransactions] = useState<Transaction[]>([]);
  const [isLoadingLinkedTx, setIsLoadingLinkedTx] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ---------------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------------

  const permanentEnvelopes = useMemo(
    () => envelopes.filter((e) => !e.isTemporary),
    [envelopes],
  );

  const temporaryEnvelopes = useMemo(
    () => envelopes.filter((e) => e.isTemporary === true),
    [envelopes],
  );

  // Pre-computed budget headroom fed into the form for the availability indicator.
  // Temporary envelopes are intentionally excluded from this calculation.
  const budgetAvailable = useMemo(() => {
    const effectiveFixed = settings.fixedCostsDetailedEnabled
      ? computeDetailedTotal(settings.fixedCostsItems)
      : settings.fixedCosts;
    const effectiveSav = settings.savingsDetailedEnabled
      ? computeDetailedTotal(settings.savingsItems)
      : settings.monthlySavings;
    const otherTotal = permanentEnvelopes
      .filter((e) => !editingEnvelope || e.id !== editingEnvelope.id)
      .reduce((sum, e) => sum + e.budget, 0);
    return settings.monthlyIncome - effectiveFixed - effectiveSav - otherTotal;
  }, [editingEnvelope, permanentEnvelopes, settings]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = async () => {
    if (!user) return;
    try {
      // Settings — loadSettings handles defaults and new-field retrocompatibility.
      const loaded = await loadSettings(user.uid);
      setSettings(loaded);

      // Notification preference
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      setDbNotifEnabled(userSnap.exists() ? userSnap.data().notificationsEnabled === true : false);

      // Envelopes
      const envSnap = await getDocs(collection(db, "users", user.uid, "envelopes"));
      const list: Envelope[] = [];
      envSnap.forEach((d) => list.push({ id: d.id, ...d.data() } as Envelope));
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setEnvelopes(list);
    } catch (error) {
      logger.sanitizedError("Erreur chargement", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    latestDetailedItemsRef.current = {
      fixedCostsItems: settings.fixedCostsItems,
      savingsItems: settings.savingsItems,
    };
  }, [settings.fixedCostsItems, settings.savingsItems]);

  useEffect(() => {
    if (!anonymousModeReady) {
      return;
    }

    setSettings((current) =>
      current.anonymousMode === anonymousMode ? current : { ...current, anonymousMode },
    );
  }, [anonymousMode, anonymousModeReady]);

  // ---------------------------------------------------------------------------
  // Settings handlers
  // ---------------------------------------------------------------------------

  const handleUpdateNumericSetting = async (
    field: "monthlyIncome" | "fixedCosts" | "monthlySavings",
    value: string,
  ) => {
    const numValue = parseFloat(value) || 0;
    setSettings((s) => ({ ...s, [field]: numValue }));
    if (user) {
      await saveSettings(user.uid, { [field]: numValue });
    }
  };

  const handleToggleAnonymousMode = async () => {
    if (!user || anonymousModeSaving) {
      return;
    }

    const previousValue = settings.anonymousMode === true;
    const nextValue = !previousValue;

    setAnonymousModeSaving(true);
    setSettings((current) => ({ ...current, anonymousMode: nextValue }));
    setAnonymousMode(nextValue);

    try {
      await saveSettings(user.uid, { anonymousMode: nextValue });
      logger.info(`settings.handleToggleAnonymousMode: anonymousMode → ${nextValue}`);
    } catch (error) {
      setSettings((current) => ({ ...current, anonymousMode: previousValue }));
      setAnonymousMode(previousValue);
      logger.sanitizedError("Erreur mise à jour mode anonyme", error);
    } finally {
      setAnonymousModeSaving(false);
    }
  };

  const handleCurrencyChange = async (newCode: CurrencyCode) => {
    if (!user) return;
    setCurrency(newCode);
    await saveSettings(user.uid, { currency: newCode });
  };

  // ---------------------------------------------------------------------------
  // Entry points for future detailed-mode UI
  // (Phase 2 wiring — no UI yet, handlers are ready for Phase 3+)
  // ---------------------------------------------------------------------------

  /**
   * Toggles a detailed-mode flag.
   *
   * The invariant "flag is false when items list is empty" is enforced locally
   * via `resolveDetailedEnabled` (mirrors the write-time rule in saveSettings).
   * This prevents the UI from briefly showing an inconsistent state before the
   * Firestore write completes.
   */
  const handleUpdateDetailedEnabled = async (
    field: "fixedCostsDetailedEnabled" | "savingsDetailedEnabled",
    value: boolean,
  ) => {
    const itemsField =
      field === "fixedCostsDetailedEnabled" ? "fixedCostsItems" : "savingsItems";
    const latestItems = latestDetailedItemsRef.current[itemsField];
    const resolvedValue = resolveDetailedEnabled(value, latestItems);
    logger.info(`settings.handleUpdateDetailedEnabled: ${field} → ${resolvedValue}`);
    setSettings((s) => ({ ...s, [field]: resolvedValue }));
    if (user) {
      const payload: Partial<UserSettings> = resolvedValue
        ? ({ [field]: resolvedValue, [itemsField]: latestItems } as Partial<UserSettings>)
        : ({ [field]: resolvedValue } as Partial<UserSettings>);
      await saveSettings(user.uid, payload);
    }
  };

  const handleToggleDetailedBudget = async (
    field: "fixedCostsDetailedEnabled" | "savingsDetailedEnabled",
  ) => {
    const itemsField =
      field === "fixedCostsDetailedEnabled" ? "fixedCostsItems" : "savingsItems";
    const latestItems = latestDetailedItemsRef.current[itemsField];

    if (settings[field]) {
      await handleUpdateDetailedEnabled(field, false);
      return;
    }

    const nextItems = latestItems.length > 0 ? latestItems : [createEmptyBudgetSubItem()];
    const nextEnabled = resolveDetailedEnabled(true, nextItems);

    latestDetailedItemsRef.current = {
      ...latestDetailedItemsRef.current,
      [itemsField]: nextItems,
    };

    setSettings((current) => ({
      ...current,
      [itemsField]: nextItems,
      [field]: nextEnabled,
    }));

    if (user) {
      await saveSettings(user.uid, {
        [itemsField]: nextItems,
        [field]: nextEnabled,
      } as Partial<UserSettings>);
    }
  };

  /**
   * Replaces a sub-items list and persists it.
   *
   * Saving an empty list automatically forces the corresponding flag to `false`
   * (enforced by `saveSettings` → `normalizeSettingsPayload`). The local state
   * is updated optimistically with the same invariant so the UI stays consistent.
   */
  const handleUpdateSubItems = async (
    field: "fixedCostsItems" | "savingsItems",
    items: BudgetSubItem[],
  ) => {
    const flagField =
      field === "fixedCostsItems" ? "fixedCostsDetailedEnabled" : "savingsDetailedEnabled";
    latestDetailedItemsRef.current = {
      ...latestDetailedItemsRef.current,
      [field]: items,
    };
    logger.info(
      `settings.handleUpdateSubItems: ${field} updated (${items.length} items)`,
    );
    setSettings((s) => ({
      ...s,
      [field]: items,
      // Mirror the write-time invariant locally.
      [flagField]: items.length > 0 ? s[flagField] : false,
    }));
    if (user) {
      const payload: Partial<UserSettings> = items.length === 0
        ? ({ [field]: items, [flagField]: false } as Partial<UserSettings>)
        : ({ [field]: items } as Partial<UserSettings>);
      await saveSettings(user.uid, payload);
    }
  };



  // ---------------------------------------------------------------------------
  // Envelope handlers
  // ---------------------------------------------------------------------------

  const openModal = (env?: Envelope) => {
    setEditingEnvelope(env ?? null);
    setIsModalOpen(true);
  };

  const handleSaveEnvelope = async (values: EnvelopeFormValues) => {
    if (!user) return;
    const numBudget = parseFloat(values.budget);

    // --- Validation côté client ---
    const nameCheck = validateEnvelopeNameWithMessage(values.name);
    if (!nameCheck.valid) {
      alert(nameCheck.message);
      return;
    }

    if (!editingEnvelope) {
      const quotaCheck = checkEnvelopeQuota(envelopes.length);
      if (!quotaCheck.allowed) {
        alert(quotaCheck.message);
        return;
      }
    }

    try {
      if (editingEnvelope) {
        // Update — always persist isTemporary + activeMonths explicitly.
        await updateDoc(doc(db, "users", user.uid, "envelopes", editingEnvelope.id), {
          name: values.name,
          budget: numBudget,
          icon: values.icon,
          color: values.color,
          isTemporary: values.isTemporary,
          activeMonths: values.activeMonths,
          updatedAt: new Date().toISOString(),
        });
        setEnvelopes((prev) =>
          prev.map((e) =>
            e.id === editingEnvelope.id
              ? {
                  ...e,
                  name: values.name,
                  budget: numBudget,
                  icon: values.icon,
                  color: values.color,
                  isTemporary: values.isTemporary,
                  activeMonths: values.activeMonths,
                }
              : e,
          ),
        );
      } else {
        // Create — isTemporary and activeMonths are written from the form.
        const newOrder = envelopes.length;
        const nowISO = new Date().toISOString();
        const docRef = await addDoc(collection(db, "users", user.uid, "envelopes"), {
          name: values.name,
          budget: numBudget,
          icon: values.icon,
          color: values.color,
          isTemporary: values.isTemporary,
          activeMonths: values.activeMonths,
          spent: 0,
          order: newOrder,
          createdAt: nowISO,
          updatedAt: nowISO,
        });

        // Incrémenter le compteur d'enveloppes
        const counterRef = doc(db, "counters", user.uid);
        await updateDoc(counterRef, {
          envelopeCount: increment(1),
        }).catch(() => {/* compteur absent, ignoré */});

        setEnvelopes((prev) => [
          ...prev,
          {
            id: docRef.id,
            name: values.name,
            budget: numBudget,
            icon: values.icon,
            color: values.color,
            isTemporary: values.isTemporary,
            activeMonths: values.activeMonths,
            order: newOrder,
          },
        ]);
      }
      setIsModalOpen(false);
    } catch (error) {
      logger.sanitizedError("Erreur sauvegarde enveloppe", error);
    }
  };

  const handleDeleteEnvelope = async (id: string, _name: string) => {
    if (!user) return;
    const env = envelopes.find((e) => e.id === id);
    if (!env) return;

    setDeletingEnvelope(env);
    setIsLoadingLinkedTx(true);
    setShowDeleteEnvelopeModal(true);

    try {
      const txs = await fetchLinkedTransactions(user.uid, id);
      setLinkedTransactions(txs);
    } catch (error) {
      logger.sanitizedError("Erreur chargement transactions", error);
      setLinkedTransactions([]);
    } finally {
      setIsLoadingLinkedTx(false);
    }
  };

  const handleMigrateToExisting = async (targetEnvelopeId: string) => {
    if (!user || !deletingEnvelope) return;
    await migrateTransactionsToExisting(user.uid, deletingEnvelope.id, targetEnvelopeId);
    setEnvelopes((prev) => prev.filter((e) => e.id !== deletingEnvelope.id));
    setShowDeleteEnvelopeModal(false);
    setDeletingEnvelope(null);
  };

  const handleCreateAndMigrate = async (name: string, budget: number) => {
    if (!user || !deletingEnvelope) return;
    const newId = await createEnvelopeAndMigrate(user.uid, deletingEnvelope.id, {
      name,
      budget,
      icon: deletingEnvelope.icon,
      color: deletingEnvelope.color,
    });
    // Add the new envelope to local state
    setEnvelopes((prev) => {
      const filtered = prev.filter((e) => e.id !== deletingEnvelope.id);
      return [
        ...filtered,
        {
          id: newId,
          name,
          budget,
          icon: deletingEnvelope.icon,
          color: deletingEnvelope.color,
          order: Date.now(),
        } as Envelope,
      ];
    });
    setShowDeleteEnvelopeModal(false);
    setDeletingEnvelope(null);
  };

  const handleDeleteAllTransactions = async () => {
    if (!user || !deletingEnvelope) return;
    await deleteEnvelopeAndTransactions(user.uid, deletingEnvelope.id, linkedTransactions);
    setEnvelopes((prev) => prev.filter((e) => e.id !== deletingEnvelope.id));
    setShowDeleteEnvelopeModal(false);
    setDeletingEnvelope(null);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    setDeleteAccountError("");
    try {
      // Récupérer le token AVANT de sign out (le token JWT reste valide 1h)
      const token = await user.getIdToken();

      // Sign out en local d'abord — tant que le compte existe encore côté Auth,
      // cette opération réussit sans erreur.
      await signOut(auth);

      // Maintenant que l'état local est nettoyé, supprimer le compte côté serveur.
      // Le token JWT est encore valide même après le signOut local.
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Échec de la suppression du compte.");
      }

      // Rediriger vers l'accueil — le ProtectedLayout verra user=null
      // et redirigera automatiquement vers /login.
      router.push("/");
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error ? error.message : "Erreur lors de la suppression."
      );
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
      setDeleteConfirmText("");
    }
  };

  // DnD reordering — operates only on permanent envelopes.
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id === over?.id) return;

    setEnvelopes((items) => {
      const permanent = items.filter((e) => !e.isTemporary);
      const temporary = items.filter((e) => e.isTemporary === true);

      const oldIndex = permanent.findIndex((i) => i.id === active.id);
      const newIndex = permanent.findIndex((i) => i.id === over?.id);
      const reordered = arrayMove(permanent, oldIndex, newIndex);
      reordered.forEach((item, idx) => { item.order = idx; });

      // Persist the new order
      const batch = writeBatch(db);
      reordered.forEach((env) => {
        if (user) {
          batch.update(doc(db, "users", user.uid, "envelopes", env.id), { order: env.order });
        }
      });
      batch.commit().catch((err) => logger.sanitizedError("Erreur ordre enveloppes", err));

      return [...reordered, ...temporary];
    });
  };

  // ---------------------------------------------------------------------------
  // Budget calculations for the overview section
  // ---------------------------------------------------------------------------

  const effectiveFixedCosts = settings.fixedCostsDetailedEnabled
    ? computeDetailedTotal(settings.fixedCostsItems)
    : settings.fixedCosts;
  const effectiveSavings = settings.savingsDetailedEnabled
    ? computeDetailedTotal(settings.savingsItems)
    : settings.monthlySavings;
  const totalEnvelopes = permanentEnvelopes.reduce((acc, e) => acc + e.budget, 0);
  const remainingBudget =
    settings.monthlyIncome - effectiveFixedCosts - effectiveSavings - totalEnvelopes;
  const isOverBudget = remainingBudget < 0;

  // ---------------------------------------------------------------------------
  // Form initial values (re-computed each time the modal opens)
  // ---------------------------------------------------------------------------

  const formInitialValues: EnvelopeFormValues = editingEnvelope
    ? {
        name: editingEnvelope.name,
        budget: editingEnvelope.budget.toString(),
        icon: editingEnvelope.icon,
        color: editingEnvelope.color,
        isTemporary: editingEnvelope.isTemporary ?? false,
        activeMonths: editingEnvelope.activeMonths ?? [],
      }
    : {
        name: "",
        budget: "",
        icon: "ShoppingCart",
        color: COLORS[0],
        isTemporary: false,
        activeMonths: [],
      };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return <div className="min-h-screen bg-app-bg text-app-text p-8">Chargement...</div>;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 pb-20">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 bg-app-surface rounded-full hover:bg-app-surface transition-colors"
        >
          <MoveLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold">Paramètres</h1>
      </header>

      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Profil ── */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Profil</h2>
          <div className="flex items-center gap-4">
            {user?.photoURL && !imgError ? (
              <img
                src={user.photoURL}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover"
                alt="avatar"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-lg">
                {getInitials(user?.displayName ?? null, user?.email ?? null)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-app-text truncate">
                {user?.displayName || "Utilisateur"}
              </p>
              <p className="text-sm text-app-text-secondary truncate">
                {user?.email || "Aucun email"}
              </p>
            </div>
          </div>
        </section>

        {/* ── Soutenir le développeur ── */}
        <section className="bg-app-surface/50 border border-amber-500/30 rounded-2xl p-6 bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-950/20 dark:to-transparent">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-2xl shrink-0">
              ☕️
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-app-text mb-1">
                Soutenir le développeur
              </h2>
              <p className="text-sm text-app-text-secondary mb-4 leading-relaxed">
                Chaque café offert m&apos;aide à rester éveillé pour traquer les bugs et améliorer l&apos;application. Merci pour votre soutien ! 🚀
              </p>
              <a
                href={DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95"
              >
                <Coffee className="w-4 h-4" />
                Offrez-moi un café
              </a>
            </div>
          </div>
        </section>

        {/* ── Apparence ── */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Apparence</h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-app-text">Thème</h3>
              <p className="text-sm text-app-text-secondary">
                Basculer entre mode clair et mode sombre.
              </p>
            </div>
            <ThemeToggle />
          </div>


        </section>

        {/* ── Monnaie ── */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Monnaie</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-app-text whitespace-nowrap">Devise d&apos;affichage</h3>
              <p className="text-sm text-app-text-secondary whitespace-nowrap">
                Les montants sont affichés dans cette devise (sans conversion).
              </p>
            </div>
            <div className="relative shrink-0">
              <select
                value={currency}
                onChange={(e) => {
                  void handleCurrencyChange(e.target.value as CurrencyCode);
                }}
                className="appearance-none bg-app-bg border border-app-border rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} - {c.name}
                  </option>
                ))}
              </select>
              {/* Chevron personnalisé */}
              <svg
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-secondary"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </section>

        {/* ── Confidentialité ── */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Confidentialité</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-app-text">Mode anonyme</h3>
              <p className="text-sm text-app-text-secondary">
                Masque les montants affichés dans l&apos;interface web pour protéger la
                confidentialité visuelle. Cette option ne modifie jamais les calculs.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-app-text-secondary">
                {settings.anonymousMode ? "Activé" : "Désactivé"}
              </span>
              <button
                type="button"
                role="switch"
                aria-label="Mode anonyme"
                aria-checked={settings.anonymousMode}
                onClick={() => {
                  void handleToggleAnonymousMode();
                }}
                disabled={!anonymousModeReady || anonymousModeSaving}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  settings.anonymousMode ? "bg-amber-500" : "bg-zinc-700"
                } ${
                  !anonymousModeReady || anonymousModeSaving
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                    settings.anonymousMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-app-text-secondary">
            Le masquage complet des surfaces d&apos;affichage sera branché dans une phase suivante.
          </p>
        </section>

        {/* ── Suppression du compte ── */}
        <section className="bg-app-surface/50 border border-red-900/30 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 text-red-500">Zone dangereuse</h2>
          <div>
            <h3 className="font-medium text-app-text">Supprimer mon compte</h3>
            <p className="text-sm text-app-text-secondary mt-1 mb-4">
              Supprimez définitivement votre compte et toutes les données associées
              (enveloppes, transactions, paramètres). Cette action est irréversible.
            </p>
            <button
              onClick={() => setShowDeleteAccountConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "Suppression en cours..." : "Supprimer mon compte"}
            </button>
            {deleteAccountError && (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {deleteAccountError}
              </p>
            )}
          </div>
        </section>

        {/* ── Notifications ── */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Notifications
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-app-text">Rappel quotidien</h3>
              <p className="text-sm text-app-text-secondary">
                Recevez un rappel à 19h pour saisir vos dépenses.
              </p>
            </div>
            {permission === "granted" && dbNotifEnabled ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-green-500 text-sm font-medium bg-green-900/20 px-3 py-1.5 rounded-full border border-green-900/50">
                  <Check className="h-4 w-4" /> Activées
                </span>
                <button
                  onClick={async () => {
                    await disableNotifications();
                    setDbNotifEnabled(false);
                  }}
                  disabled={notifLoading}
                  className="text-app-text bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-lg text-sm transition-colors"
                >
                  Désactiver
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  await requestPermission();
                  if (Notification.permission === "granted") setDbNotifEnabled(true);
                }}
                disabled={notifLoading || permission === "denied"}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-app-text rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {notifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activer"}
              </button>
            )}
          </div>
          {permission === "denied" && (
            <p className="text-xs text-red-400 mt-2">
              Les notifications sont bloquées dans votre navigateur. Veuillez les autoriser dans
              les paramètres du navigateur pour activer cette fonctionnalité.
            </p>
          )}
        </section>

        {/* ── Budget Global ── */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-amber-500" />
            Budget Global
          </h2>
          <div className="space-y-4">

            {/* Revenus mensuels — inchangé */}
            <div>
              <label className="block text-sm text-app-text-secondary mb-1">
                Revenus (Salaire)
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={settings.monthlyIncome}
                  onChange={(e) => handleUpdateNumericSetting("monthlyIncome", e.target.value)}
                  className="no-spinner w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <span className="absolute right-3 top-2 text-app-text-secondary">{symbol}</span>
              </div>
            </div>

            {/* Frais Fixes — montant global + mode détaillé */}
            <div>
              <label className="block text-sm text-app-text-secondary mb-1">Frais Fixes</label>
              <div className="flex items-stretch gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={effectiveFixedCosts}
                    onChange={(e) => handleUpdateNumericSetting("fixedCosts", e.target.value)}
                    disabled={settings.fixedCostsDetailedEnabled}
                    readOnly={settings.fixedCostsDetailedEnabled}
                    className={`no-spinner w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none transition-opacity ${
                      settings.fixedCostsDetailedEnabled ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  />
                  <span className="absolute right-3 top-2 text-app-text-secondary">{symbol}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleDetailedBudget("fixedCostsDetailedEnabled")}
                  aria-label="Détails des frais fixes"
                  aria-pressed={settings.fixedCostsDetailedEnabled}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    settings.fixedCostsDetailedEnabled
                      ? "bg-amber-700 text-amber-50 hover:bg-amber-800"
                      : "bg-amber-400 text-black hover:bg-amber-500"
                  }`}
                >
                  Détails
                </button>
              </div>
              {settings.fixedCostsDetailedEnabled && (
                <p className="text-xs text-amber-400 mt-1">
                  Montant calculé automatiquement depuis les lignes détaillées.
                </p>
              )}
            </div>

            <BudgetDetailEditor
              label="Charges fixes détaillées"
              category="fixedCosts"
              enabled={settings.fixedCostsDetailedEnabled}
              items={settings.fixedCostsItems}
              aggregateAmount={settings.fixedCosts}
              variant="inline"
              onEnabledChange={(v) =>
                handleUpdateDetailedEnabled("fixedCostsDetailedEnabled", v)
              }
              onItemsChange={(items) =>
                handleUpdateSubItems("fixedCostsItems", items)
              }
            />

            {/* Épargne Souhaitée — montant global + mode détaillé */}
            <div>
              <label className="block text-sm text-app-text-secondary mb-1">
                Épargne Souhaitée
              </label>
              <div className="flex items-stretch gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={effectiveSavings}
                    onChange={(e) => handleUpdateNumericSetting("monthlySavings", e.target.value)}
                    disabled={settings.savingsDetailedEnabled}
                    readOnly={settings.savingsDetailedEnabled}
                    className={`no-spinner w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none transition-opacity ${
                      settings.savingsDetailedEnabled ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  />
                  <span className="absolute right-3 top-2 text-app-text-secondary">{symbol}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleDetailedBudget("savingsDetailedEnabled")}
                  aria-label="Détails de l'épargne souhaitée"
                  aria-pressed={settings.savingsDetailedEnabled}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    settings.savingsDetailedEnabled
                      ? "bg-amber-700 text-amber-50 hover:bg-amber-800"
                      : "bg-amber-400 text-black hover:bg-amber-500"
                  }`}
                >
                  Détails
                </button>
              </div>
              {settings.savingsDetailedEnabled && (
                <p className="text-xs text-amber-400 mt-1">
                  Montant calculé automatiquement depuis les lignes détaillées.
                </p>
              )}
            </div>

            <BudgetDetailEditor
              label="Épargne détaillée"
              category="savings"
              enabled={settings.savingsDetailedEnabled}
              items={settings.savingsItems}
              aggregateAmount={settings.monthlySavings}
              variant="inline"
              onEnabledChange={(v) =>
                handleUpdateDetailedEnabled("savingsDetailedEnabled", v)
              }
              onItemsChange={(items) =>
                handleUpdateSubItems("savingsItems", items)
              }
            />

            {/* Balance indicator */}
            <div
              className={`mt-6 p-4 rounded-xl border ${
                isOverBudget
                  ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  : "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-app-text">Total Enveloppes</span>
                <span className="font-bold text-app-text">{totalEnvelopes.toFixed(2)} {symbol}</span>
              </div>
              <div className="flex justify-between items-center mb-2 text-amber-600 dark:text-amber-500/80">
                <span className="text-sm font-medium">Épargne visée</span>
                <span className="font-bold">{effectiveSavings.toFixed(2)} {symbol}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-dashed border-app-border">
                <span className="text-sm font-medium text-app-text">
                  Équilibre (Reste à allouer)
                </span>
                <div className="flex items-center gap-2">
                  {isOverBudget && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  <span
                    className={`font-bold text-lg ${
                      isOverBudget ? "text-red-600 dark:text-red-500" : "text-green-700 dark:text-green-500"
                    }`}
                  >
                    {remainingBudget.toFixed(2)} {symbol}
                  </span>
                </div>
              </div>
              {isOverBudget && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Attention : Vos dépenses (Enveloppes + Épargne + Frais) dépassent vos revenus.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Enveloppes ── */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Enveloppes</h2>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-sm font-bold hover:bg-zinc-200 transition-colors"
            >
              <Plus className="h-4 w-4" /> Nouvelle
            </button>
          </div>

          {/* Permanent envelopes — drag-and-drop sortable */}
          {permanentEnvelopes.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={permanentEnvelopes.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                {permanentEnvelopes.map((env) => (
                  <SortableEnvelopeRow
                    key={env.id}
                    env={env}
                    openModal={openModal}
                    handleDeleteEnvelope={handleDeleteEnvelope}
                    symbol={symbol}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-sm text-app-text-secondary mb-4">
              Aucune enveloppe permanente. Créez-en une ci-dessus.
            </p>
          )}

          {/* ── Temporary envelopes section ── */}
          <div className="mt-6">
            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1" style={{ background: "var(--color-temporary)" }} />
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  color: "var(--color-temporary)",
                  background: "var(--color-temporary-bg)",
                  border: "1px solid var(--color-temporary)",
                }}
              >
                <Clock className="h-3.5 w-3.5" />
                Temporaires
              </span>
              <div className="h-px flex-1" style={{ background: "var(--color-temporary)" }} />
            </div>

            {temporaryEnvelopes.length > 0 ? (
              temporaryEnvelopes.map((env) => (
                <TemporaryEnvelopeRow
                  key={env.id}
                  env={env}
                  openModal={openModal}
                  handleDeleteEnvelope={handleDeleteEnvelope}
                  symbol={symbol}
                />
              ))
            ) : (
              <p className="text-sm text-center py-4" style={{ color: "var(--color-temporary)" }}>
                Aucune enveloppe temporaire.{" "}
                <button
                  onClick={() => openModal()}
                  className="underline hover:no-underline"
                >
                  Créer une enveloppe
                </button>{" "}
                et activez le mode temporaire.
              </p>
            )}
          </div>
        </section>

      </div>

      {/* ── Modal: confirmation suppression compte ── */}
      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-2 text-red-500">Supprimer mon compte</h2>
            <p className="text-sm text-app-text-secondary mb-6">
              Cette action est <strong className="text-red-400">irréversible</strong>. Toutes vos données seront définitivement supprimées : compte Firebase, enveloppes, transactions, paramètres et activité quotidienne.
            </p>
            <p className="text-sm text-app-text-secondary mb-4">
              Pour confirmer, tapez <code className="bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded text-xs font-bold">DELETE</code> ci-dessous :
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteAccountConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 text-sm text-app-text-secondary hover:text-app-text transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
              >
                {isDeletingAccount ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: create / edit envelope ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-xl font-bold flex-1">
                {editingEnvelope ? "Modifier l'enveloppe" : "Nouvelle Enveloppe"}
              </h2>
              {editingEnvelope?.isTemporary && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    color: "var(--color-temporary)",
                    background: "var(--color-temporary-bg)",
                    border: "1px solid var(--color-temporary)",
                  }}
                >
                  <Clock className="h-3 w-3" />
                  Temporaire
                </span>
              )}
            </div>

            {/*
             * Key forces a full remount whenever the target envelope changes,
             * so the form's internal state always starts fresh from initialValues.
             */}
            <TemporaryEnvelopeForm
              key={editingEnvelope?.id ?? "new"}
              initialValues={formInitialValues}
              budgetAvailable={budgetAvailable}
              isEditing={editingEnvelope !== null}
              onSave={handleSaveEnvelope}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Modal: delete envelope ── */}
      {deletingEnvelope && (
        <DeleteEnvelopeModal
          isOpen={showDeleteEnvelopeModal}
          onClose={() => {
            setShowDeleteEnvelopeModal(false);
            setDeletingEnvelope(null);
          }}
          envelope={deletingEnvelope}
          envelopes={envelopes}
          linkedTransactions={isLoadingLinkedTx ? [] : linkedTransactions}
          onMigrateToExisting={handleMigrateToExisting}
          onCreateAndMigrate={handleCreateAndMigrate}
          onDeleteAll={handleDeleteAllTransactions}
        />
      )}
    </div>
  );
}
