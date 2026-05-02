"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
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
import { Envelope } from "@/types/envelope";
import TemporaryEnvelopeForm, {
  ICON_MAP,
  COLORS,
  EnvelopeFormValues,
} from "@/components/settings/TemporaryEnvelopeForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BentoPreset = "compact" | "balanced" | "airy";

interface UserSettings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
  bentoPreset: BentoPreset;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveBentoPreset(value: string | undefined): BentoPreset {
  if (value === "compact" || value === "balanced" || value === "airy") return value;
  return "balanced";
}

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
}: {
  env: Envelope;
  openModal: (env?: Envelope) => void;
  handleDeleteEnvelope: (id: string, name: string) => void;
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
            {Number(env.budget).toFixed(2)} € / mois
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
}: {
  env: Envelope;
  openModal: (env?: Envelope) => void;
  handleDeleteEnvelope: (id: string, name: string) => void;
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
            {Number(env.budget).toFixed(2)} € / mois
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

  const [settings, setSettings] = useState<UserSettings>({
    monthlyIncome: 0,
    fixedCosts: 0,
    monthlySavings: 0,
  });
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);

  // Modal state — individual form fields are managed inside TemporaryEnvelopeForm.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);

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
  const budgetAvailable = useMemo(() => {
    const otherTotal = envelopes
      .filter((e) => !editingEnvelope || e.id !== editingEnvelope.id)
      .reduce((sum, e) => sum + e.budget, 0);
    return settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings - otherTotal;
  }, [envelopes, editingEnvelope, settings]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = async () => {
    if (!user) return;
    try {
      // Settings
      const settingsRef = doc(db, "users", user.uid, "settings", "general");
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const raw = settingsSnap.data() as Partial<UserSettings>;
        setSettings({
          monthlyIncome: Number(raw.monthlyIncome ?? 0),
          fixedCosts: Number(raw.fixedCosts ?? 0),
          monthlySavings: Number(raw.monthlySavings ?? 0),
        });
      }

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
      await updateDoc(doc(db, "users", user.uid, "settings", "general"), {
        [field]: numValue,
      });
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
        const docRef = await addDoc(collection(db, "users", user.uid, "envelopes"), {
          name: values.name,
          budget: numBudget,
          icon: values.icon,
          color: values.color,
          isTemporary: values.isTemporary,
          activeMonths: values.activeMonths,
          spent: 0,
          order: newOrder,
        });
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

  const handleDeleteEnvelope = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'enveloppe "${name}" ?\nCette action est irréversible.`)) return;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "envelopes", id));
      setEnvelopes((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      logger.sanitizedError("Erreur suppression", error);
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

  const totalEnvelopes = permanentEnvelopes.reduce((acc, e) => acc + e.budget, 0);
  const remainingBudget =
    settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings - totalEnvelopes;
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-app-text-secondary">€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-app-text-secondary mb-1">Frais Fixes</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={settings.fixedCosts}
                    onChange={(e) => handleUpdateNumericSetting("fixedCosts", e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-app-text-secondary">€</span>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-app-text-secondary mb-1">
                  Épargne Souhaitée
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={settings.monthlySavings}
                    onChange={(e) => handleUpdateNumericSetting("monthlySavings", e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-app-text-secondary">€</span>
                </div>
              </div>
            </div>

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
                <span className="font-bold text-app-text">{totalEnvelopes.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between items-center mb-2 text-amber-600 dark:text-amber-500/80">
                <span className="text-sm font-medium">Épargne visée</span>
                <span className="font-bold">{Number(settings.monthlySavings).toFixed(2)} €</span>
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
                    {remainingBudget.toFixed(2)} €
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
    </div>
  );
}
