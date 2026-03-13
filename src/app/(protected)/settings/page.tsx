"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MoveLeft, Plus, Trash2, Save, ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee, Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer, LucideIcon, Edit2, AlertTriangle, Bell, Loader2, Check, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { logger } from "@/lib/logger";
import ThemeToggle from "@/components/ThemeToggle";

// --- Icons List ---
const ICONS_LIST = [
  "ShoppingCart", "Fuel", "Utensils", "Plane", "Heart", "Gamepad2", "Bus", "Shirt", "Music", "Coffee",
  "Briefcase", "GraduationCap", "Baby", "PawPrint", "Gift", "Smartphone", "Wifi", "Zap", "Droplets", "Hammer"
];

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer
};

const COLORS = [
  "bg-amber-500", "bg-blue-500", "bg-green-500", "bg-red-500", "bg-purple-500", 
  "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500"
];

interface UserSettings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
}

interface Envelope {
  id: string;
  name: string;
  budget: number;
  icon: string;
  color: string;
  spent?: number;
  order?: number;
}


function SortableEnvelopeRow({ 
  env, 
  openModal,
  handleDeleteEnvelope
}: { 
  env: Envelope, 
  openModal: any,
  handleDeleteEnvelope: any
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: env.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as 'relative', // Cast to valid specific string literal type
  };

  const Icon = ICON_MAP[env.icon] || ShoppingCart;

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center justify-between group mb-3"
    >
        <div className="flex items-center gap-4">
            {/* Drag Handle */}
            <div 
                {...attributes} 
                {...listeners} 
                className="cursor-grab active:cursor-grabbing text-app-text-secondary hover:text-app-text p-1 -ml-2 touch-none"
            >
                <GripVertical className="w-5 h-5" />
            </div>

            {/* Icone blanche sur fond couleur */}
            <div className={`p-2 rounded-lg ${env.color} text-app-text`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <h3 className="font-bold">{env.name}</h3>
                <p className="text-sm text-app-text-secondary">{Number(env.budget).toFixed(2)} € / mois</p>
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

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { permission, requestPermission, disableNotifications, loading: notifLoading } = useNotifications();
  const [dbNotifEnabled, setDbNotifEnabled] = useState(false); // État en base de données

  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<UserSettings>({
    monthlyIncome: 0,
    fixedCosts: 0,
    monthlySavings: 0
  });
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);

  // Fn DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
        setEnvelopes((items) => {
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over?.id);
            
            const newOrder = arrayMove(items, oldIndex, newIndex);
            
            // Re-index locally
            newOrder.forEach((item, idx) => { item.order = idx; });
            
            // Persist order
            const batch = writeBatch(db);
            newOrder.forEach((env) => {
               if (user) {
                   const ref = doc(db, "users", user.uid, "envelopes", env.id);
                   batch.update(ref, { order: env.order });
               }
            });
            batch.commit().catch((error) => logger.sanitizedError("Error order save", error));

            return newOrder;
        });
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  
  // Form State for Modal
  const [modalName, setModalName] = useState("");
  const [modalBudget, setModalBudget] = useState("");
  const [modalIcon, setModalIcon] = useState("ShoppingCart");
  const [modalColor, setModalColor] = useState(COLORS[0]);

  // --- Fetch Data ---
  const fetchData = async () => {
    if (!user) return;
    try {
      // 1. Settings
      const settingsRef = doc(db, "users", user.uid, "settings", "general");
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as UserSettings);
      }
      
      // 1.5 User Profile (pour notif enabled)
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
          setDbNotifEnabled(userSnap.data().notificationsEnabled === true);
      } else {
          setDbNotifEnabled(false);
      }

      // 2. Envelopes
      const envRef = collection(db, "users", user.uid, "envelopes");
      const envSnap = await getDocs(envRef);
      const list: Envelope[] = [];
      envSnap.forEach((d) => list.push({ id: d.id, ...d.data() } as Envelope));
      
      // Tri par ordre
      list.sort((a, b) => (a.order || 0) - (b.order || 0));

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

  // --- Handlers ---

  const handleUpdateSettings = async (field: keyof UserSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newSettings = { ...settings, [field]: numValue };
    setSettings(newSettings);
    
    // Save directly (auto-save)
    if (user) {
        await updateDoc(doc(db, "users", user.uid, "settings", "general"), {
            [field]: numValue
        });
    }
  };

  const openModal = (env?: Envelope) => {
    if (env) {
        setEditingEnvelope(env);
        setModalName(env.name);
        setModalBudget(env.budget.toString());
        setModalIcon(env.icon);
        setModalColor(env.color);
    } else {
        setEditingEnvelope(null);
        setModalName("");
        setModalBudget("");
        setModalIcon("ShoppingCart");
        setModalColor(COLORS[0]);
    }
    setIsModalOpen(true);
  };

  const handleSaveEnvelope = async () => {
    if (!user || !modalName || !modalBudget) return;
    const numBudget = parseFloat(modalBudget);

    try {
        if (editingEnvelope) {
            // Update
            const envRef = doc(db, "users", user.uid, "envelopes", editingEnvelope.id);
            await updateDoc(envRef, {
                name: modalName,
                budget: numBudget,
                icon: modalIcon,
                color: modalColor
            });
            // Update local
            setEnvelopes(envelopes.map(e => e.id === editingEnvelope.id ? { ...e, name: modalName, budget: numBudget, icon: modalIcon, color: modalColor } : e));
        } else {
            // Create
            const newOrder = envelopes.length;
            const docRef = await addDoc(collection(db, "users", user.uid, "envelopes"), {
                name: modalName,
                budget: numBudget,
                icon: modalIcon,
                color: modalColor,
                spent: 0,
                order: newOrder
            });
            setEnvelopes([...envelopes, { 
                id: docRef.id, 
                name: modalName, 
                budget: numBudget, 
                icon: modalIcon, 
                color: modalColor,
                order: newOrder
            }]);
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
        setEnvelopes(envelopes.filter(e => e.id !== id));
    } catch (error) {
        logger.sanitizedError("Erreur suppression", error);
    }
  };


  // --- Calculations ---
  const totalEnvelopes = envelopes.reduce((acc, env) => acc + env.budget, 0);
  const remainingBudget = settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings - totalEnvelopes;
  const isOverBudget = remainingBudget < 0;

  if (loading) return <div className="min-h-screen bg-app-bg text-app-text p-8">Chargement...</div>;

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 pb-20">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-app-surface rounded-full hover:bg-app-surface transition-colors">
            <MoveLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold">Paramètres</h1>
      </header>

      <div className="max-w-3xl mx-auto space-y-8">

        {/* Section Apparence */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Apparence</h2>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-app-text">Thème</h3>
                    <p className="text-sm text-app-text-secondary">Basculer entre mode clair et mode sombre.</p>
                </div>
                <ThemeToggle />
            </div>
        </section>
        
        {/* Section Notifications */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                Notifications
            </h2>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-app-text">Rappel quotidien</h3>
                    <p className="text-sm text-app-text-secondary">Recevez un rappel à 19h pour saisir vos dépenses.</p>
                </div>
                
                {permission === 'granted' && dbNotifEnabled ? (
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
                            if (Notification.permission === 'granted') {
                                setDbNotifEnabled(true);
                            }
                        }}
                        disabled={notifLoading || permission === 'denied'}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-app-text rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {notifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activer"}
                    </button>
                )}
            </div>
            {permission === 'denied' && (
                <p className="text-xs text-red-400 mt-2">
                    Les notifications sont bloquées dans votre navigateur. Veuillez les autoriser dans les paramètres du navigateur pour activer cette fonctionnalité.
                </p>
            )}
        </section>

        {/* Section 1: Budget Global */}
        <section className="bg-app-surface/50 border border-app-border rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-500" />
                Budget Global
            </h2>

            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-app-text-secondary mb-1">Revenus (Salaire)</label>
                        <div className="relative">
                            <input 
                                type="number"
                                inputMode="decimal"
                                value={settings.monthlyIncome} 
                                onChange={(e) => handleUpdateSettings('monthlyIncome', e.target.value)}
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
                                onChange={(e) => handleUpdateSettings('fixedCosts', e.target.value)}
                                className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none" 
                            />
                            <span className="absolute right-3 top-2 text-app-text-secondary">€</span>
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm text-app-text-secondary mb-1">Épargne Souhaitée</label>
                        <div className="relative">
                            <input 
                                type="number"
                                inputMode="decimal" 
                                value={settings.monthlySavings} 
                                onChange={(e) => handleUpdateSettings('monthlySavings', e.target.value)}
                                className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none" 
                            />
                            <span className="absolute right-3 top-2 text-app-text-secondary">€</span>
                        </div>
                    </div>
                </div>

                {/* Balance Indicator */}
                <div className={`mt-6 p-4 rounded-xl border ${isOverBudget ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-app-text">Total Enveloppes</span>
                        <span className="font-bold text-app-text">{totalEnvelopes.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center mb-2 text-amber-600 dark:text-amber-500/80">
                        <span className="text-sm font-medium">Épargne visée</span>
                        <span className="font-bold">{Number(settings.monthlySavings).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-app-border">
                        <span className="text-sm font-medium text-app-text">Équilibre (Reste à allouer)</span>
                        <div className="flex items-center gap-2">
                            {isOverBudget && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            <span className={`font-bold text-lg ${isOverBudget ? 'text-red-600 dark:text-red-500' : 'text-green-700 dark:text-green-500'}`}>
                                {remainingBudget.toFixed(2)} €
                            </span>
                        </div>
                    </div>
                    {isOverBudget && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">Attention : Vos dépenses (Enveloppes + Épargne + Frais) dépassent vos revenus.</p>
                    )}
                </div>
            </div>
        </section>

        {/* Section 2: Gestion des Enveloppes */}
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

            <div className="flex flex-col">
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={envelopes.map(e => e.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {envelopes.map((env) => (
                            <SortableEnvelopeRow 
                                key={env.id} 
                                env={env} 
                                openModal={openModal} 
                                handleDeleteEnvelope={handleDeleteEnvelope}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </section>

      </div>

      {/* Modal Edit/Create */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold mb-6">
                    {editingEnvelope ? "Modifier l'enveloppe" : "Nouvelle Enveloppe"}
                </h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-app-text-secondary mb-1">Nom</label>
                        <input 
                            type="text" 
                            value={modalName}
                            onChange={(e) => setModalName(e.target.value)}
                            className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="Ex: Courses"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-app-text-secondary mb-1">Budget Mensuel</label>
                        <div className="relative">
                            <input 
                                type="number"
                                inputMode="decimal"
                                value={modalBudget}
                                onChange={(e) => setModalBudget(e.target.value)}
                                className="w-full bg-app-bg border border-app-border rounded-lg py-2 px-3 focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-2 text-app-text-secondary">€</span>
                        </div>
                        {(() => {
                            const currentBudget = parseFloat(modalBudget) || 0;
                            const otherEnvelopesTotal = envelopes
                                .filter((e) => !editingEnvelope || e.id !== editingEnvelope.id)
                                .reduce((sum, e) => sum + e.budget, 0);
                            const budgetAvailable = settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings - otherEnvelopesTotal;
                            const afterAllocation = budgetAvailable - currentBudget;

                            return (
                                <div className={`mt-2 rounded-lg border p-3 ${afterAllocation < 0 ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
                                    <p className="text-xs text-app-text-secondary">
                                        Budget disponible : <span className="font-semibold text-app-text">{budgetAvailable.toFixed(2)} €</span>
                                    </p>
                                    <p className="text-xs mt-1">
                                        Après allocation : <span className={`font-semibold ${afterAllocation >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{afterAllocation.toFixed(2)} €</span>
                                    </p>
                                    {afterAllocation < 0 && (
                                        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            <span>⚠ Ce budget dépasse le solde disponible</span>
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Icon Picker */}
                    <div>
                         <label className="block text-sm text-app-text-secondary mb-2">Icône</label>
                         <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-1">
                            {ICONS_LIST.map(iconName => {
                                const Icon = ICON_MAP[iconName];
                                return (
                                    <button 
                                        key={iconName}
                                        onClick={() => setModalIcon(iconName)}
                                        className={`p-2 rounded-lg flex items-center justify-center transition-colors ${modalIcon === iconName ? 'bg-amber-500 text-black' : 'bg-app-bg text-app-text-secondary hover:bg-app-surface'}`}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </button>
                                );
                            })}
                         </div>
                    </div>

                    {/* Color Picker */}
                     <div>
                         <label className="block text-sm text-app-text-secondary mb-2">Couleur</label>
                         <div className="flex flex-wrap gap-2">
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setModalColor(color)}
                                    className={`w-8 h-8 rounded-full ${color} ${modalColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-50 hover:opacity-100'}`}
                                ></button>
                            ))}
                         </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 py-3 rounded-xl bg-app-surface font-bold hover:bg-app-surface transition-colors"
                    >
                        Annuler
                    </button>
                     <button 
                        onClick={handleSaveEnvelope}
                        disabled={!modalName || !modalBudget}
                        className="flex-1 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Sauvegarder
                    </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
}
