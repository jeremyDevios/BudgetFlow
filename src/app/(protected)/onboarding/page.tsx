"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, collection, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  Wallet, 
  Landmark, 
  PiggyBank, 
  HelpCircle, 
  Plus, 
  Trash2,
  CheckCircle2,
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
  LucideIcon,
  Pencil,
  X,
  Check,
  Briefcase,
  GraduationCap,
  Baby,
  PawPrint,
  Gift,
  Smartphone,
  Wifi,
  Zap,
  Droplets,
  Hammer
} from "lucide-react";

// Types pour les enveloppes
type IconName = "ShoppingCart" | "Fuel" | "Utensils" | "Plane" | "Heart" | "Gamepad2" | "Bus" | "Shirt" | "Music" | "Coffee" | "Briefcase" | "GraduationCap" | "Baby" | "PawPrint" | "Gift" | "Smartphone" | "Wifi" | "Zap" | "Droplets" | "Hammer";

interface EnvelopeDraft {
  id: string;
  name: string;
  amount: string;
  icon: IconName;
  color: string;
}

const PREDEFINED_ICONS: { name: IconName; icon: LucideIcon; label: string }[] = [
  { name: "ShoppingCart", icon: ShoppingCart, label: "Courses" },
  { name: "Fuel", icon: Fuel, label: "Essence" },
  { name: "Utensils", icon: Utensils, label: "Resto" },
  { name: "Plane", icon: Plane, label: "Voyage" },
  { name: "Heart", icon: Heart, label: "Santé" },
  { name: "Gamepad2", icon: Gamepad2, label: "Loisirs" },
  { name: "Bus", icon: Bus, label: "Transport" },
  { name: "Shirt", icon: Shirt, label: "Shopping" },
  { name: "Music", icon: Music, label: "Abonnements" },
  { name: "Coffee", icon: Coffee, label: "Sorties" },
  { name: "Briefcase", icon: Briefcase, label: "Travail" },
  { name: "GraduationCap", icon: GraduationCap, label: "Études" },
  { name: "Baby", icon: Baby, label: "Enfants" },
  { name: "PawPrint", icon: PawPrint, label: "Animaux" },
  { name: "Gift", icon: Gift, label: "Cadeaux" },
  { name: "Smartphone", icon: Smartphone, label: "Mobile" },
  { name: "Wifi", icon: Wifi, label: "Internet" },
  { name: "Zap", icon: Zap, label: "Électricité" },
  { name: "Droplets", icon: Droplets, label: "Eau" },
  { name: "Hammer", icon: Hammer, label: "Travaux" },
];

const COLORS = [
  "bg-blue-500", "bg-blue-600", "bg-indigo-500", "bg-indigo-600", 
  "bg-purple-500", "bg-purple-600", "bg-fuchsia-500", "bg-pink-500", 
  "bg-rose-500", "bg-red-500", "bg-orange-500", "bg-amber-500", 
  "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-emerald-500", 
  "bg-teal-500", "bg-cyan-500", "bg-sky-500", "bg-zinc-500"
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Étape 1 : Revenus et Charges Fixes
  const [income, setIncome] = useState("");
  const [fixedCosts, setFixedCosts] = useState("");
  const [savings, setSavings] = useState("");

  // Étape 2 : Enveloppes (Charges variables)
  const [envelopes, setEnvelopes] = useState<EnvelopeDraft[]>([
    { id: "1", name: "Courses", amount: "300", icon: "ShoppingCart", color: "bg-blue-500" },
    { id: "2", name: "Essence", amount: "150", icon: "Fuel", color: "bg-orange-500" },
    { id: "3", name: "Loisirs", amount: "100", icon: "Gamepad2", color: "bg-purple-500" },
  ]);

  const [newEnvelopeName, setNewEnvelopeName] = useState("");
  const [newEnvelopeIcon, setNewEnvelopeIcon] = useState<IconName>("ShoppingCart");
  const [newEnvelopeColor, setNewEnvelopeColor] = useState("bg-blue-500");
  const [isAddingEnvelope, setIsAddingEnvelope] = useState(false);

  // État pour l'édition d'une enveloppe
  const [editingEnvelopeId, setEditingEnvelopeId] = useState<string | null>(null);
  const [editEnvelopeName, setEditEnvelopeName] = useState("");
  const [editEnvelopeIcon, setEditEnvelopeIcon] = useState<IconName>("ShoppingCart");
  const [editEnvelopeColor, setEditEnvelopeColor] = useState("bg-blue-500");
  const [editEnvelopeAmount, setEditEnvelopeAmount] = useState("0");

  // Calcul du reste à vivre (Somme Disponible pour les enveloppes)
  const calculateAvailableAmount = () => {
    const inc = parseFloat(income) || 0;
    const fix = parseFloat(fixedCosts) || 0;
    const sav = parseFloat(savings) || 0;
    
    // Si on est à l'étape 2, on soustrait aussi le total des enveloppes DÉJÀ définies
    let envelopesTotal = 0;
    if (step === 2) {
        envelopesTotal = envelopes.reduce((acc, env) => acc + (parseFloat(env.amount) || 0), 0);
    }

    return inc - fix - sav - envelopesTotal;
  };

  const availableAmount = calculateAvailableAmount();
  const isBudgetValid = availableAmount >= 0;

  const handleStepChange = () => {
    // Vérification avant de passer à l'étape 2
    const inc = parseFloat(income) || 0;
    const fix = parseFloat(fixedCosts) || 0;
    const sav = parseFloat(savings) || 0;
    const baseAvailable = inc - fix - sav;

    if (baseAvailable < 0) {
        alert("Attention : Vos charges fixes et épargne dépassent déjà vos revenus ! Veuillez vérifier votre saisie.");
        return;
    }
    setStep(2);
  };
  
  // Sauvegarde finale
  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);
      
      // 1. Sauvegarder les settings utilisateur
      const settingsRef = doc(db, "users", user.uid, "settings", "general");
      batch.set(settingsRef, {
        monthlyIncome: parseFloat(income) || 0,
        fixedCosts: parseFloat(fixedCosts) || 0,
        monthlySavings: parseFloat(savings) || 0,
        currency: "EUR", // Par défaut
        isOnboarded: true,
        createdAt: new Date().toISOString()
      });

      // 2. Créer les enveloppes
      envelopes.forEach(env => {
        const envRef = doc(collection(db, "users", user.uid, "envelopes"));
        batch.set(envRef, {
            name: env.name,
            budget: parseFloat(env.amount) || 0,
            icon: env.icon,
            color: env.color,
            spent: 0,
            createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      router.push("/dashboard");

    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      alert("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const addEnvelope = () => {
    if (!newEnvelopeName) return;
    const newEnv: EnvelopeDraft = {
      id: Date.now().toString(),
      name: newEnvelopeName,
      amount: "0",
      icon: newEnvelopeIcon,
      color: newEnvelopeColor
    };
    setEnvelopes([...envelopes, newEnv]);
    setNewEnvelopeName("");
    setIsAddingEnvelope(false);
  };

  const removeEnvelope = (id: string) => {
    setEnvelopes(envelopes.filter(e => e.id !== id));
  };

  const updateEnvelopeAmount = (id: string, amount: string) => {
    setEnvelopes(envelopes.map(e => e.id === id ? { ...e, amount } : e));
  };

  const startEditingEnvelope = (env: EnvelopeDraft) => {
    setEditingEnvelopeId(env.id);
    setEditEnvelopeName(env.name);
    setEditEnvelopeIcon(env.icon);
    setEditEnvelopeColor(env.color);
    setEditEnvelopeAmount(env.amount);
    setIsAddingEnvelope(false); // fermer l'ajout si ouvert
  };

  const cancelEditing = () => {
    setEditingEnvelopeId(null);
  };

  const saveEditedEnvelope = () => {
    if (!editingEnvelopeId || !editEnvelopeName) return;
    
    setEnvelopes(envelopes.map(e => e.id === editingEnvelopeId ? {
        ...e,
        name: editEnvelopeName,
        icon: editEnvelopeIcon,
        color: editEnvelopeColor,
        amount: editEnvelopeAmount
    } : e));
    
    setEditingEnvelopeId(null);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-12">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-amber-500" : "bg-zinc-800"}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-amber-500" : "bg-zinc-800"}`} />
        </div>

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Commençons par les bases</h1>
              <p className="mt-2 text-zinc-400">Pour établir votre budget, nous avons besoin de connaître vos flux mensuels fixes.</p>
            </div>
            
            {/* Affichage Somme Disponible (Prévisionnel) */}
            <div className={`p-4 rounded-xl border ${availableAmount >= 0 ? 'bg-green-950/30 border-green-900' : 'bg-red-950/30 border-red-900'} transition-colors`}>
                <p className="text-sm text-zinc-400">Capacité pour vos enveloppes :</p>
                <p className={`text-3xl font-bold ${availableAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {availableAmount.toFixed(2)} €
                </p>
            </div>

            <div className="space-y-6">
              {/* Le Salaire */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Wallet className="h-4 w-4 text-green-500" />
                  Salaire Mensuel Net
                </label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">€</span>
                    <input 
                        type="number" 
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-10 pr-4 text-xl focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                        placeholder="2500"
                    />
                </div>
              </div>

              {/* Charges Incompressibles */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Landmark className="h-4 w-4 text-red-500" />
                  Charges Incompressibles
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 hidden group-hover:block z-10 shadow-xl">
                      Cumul des charges fixes : Loyer, Électricité, Internet, Assurances, Abonnements Netflix/Spotify, etc.
                    </div>
                  </div>
                </label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">€</span>
                    <input 
                        type="number" 
                        value={fixedCosts}
                        onChange={(e) => setFixedCosts(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-10 pr-4 text-xl focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                        placeholder="1200"
                    />
                </div>
              </div>

              {/* Épargne */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <PiggyBank className="h-4 w-4 text-blue-500" />
                  Objectif d'Épargne Mensuelle
                  <span className="text-xs text-zinc-600 font-normal">(Crypto, Immo, Livret A...)</span>
                </label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">€</span>
                    <input 
                        type="number" 
                        value={savings}
                        onChange={(e) => setSavings(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-10 pr-4 text-xl focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                        placeholder="300"
                    />
                </div>
              </div>
            </div>

            <button 
                onClick={handleStepChange}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors mt-8"
            >
                Continuer <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Vos Enveloppes</h1>
              <p className="mt-2 text-zinc-400">Définissez vos budgets pour les dépenses du quotidien (courses, sorties...).</p>
            </div>

            {/* Affichage Somme Disponible Dynamique */}
            <div className={`sticky top-4 z-20 p-4 rounded-xl border backdrop-blur-md shadow-lg ${availableAmount >= 0 ? 'bg-green-950/80 border-green-900' : 'bg-red-950/80 border-red-900'} transition-all`}>
                <div className="flex justify-between items-center">
                    <p className="text-sm text-zinc-300">Reste à attribuer :</p>
                    <p className={`text-2xl font-bold ${availableAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {availableAmount.toFixed(2)} €
                    </p>
                </div>
                {availableAmount < 0 && (
                    <p className="text-xs text-red-300 mt-1">
                        Attention : Vous avez dépassé votre budget disponible !
                    </p>
                )}
            </div>

            <div className="space-y-4">
              {envelopes.map((env) => {
                const isEditing = editingEnvelopeId === env.id;
                
                if (isEditing) {
                    return (
                        <div key={env.id} className="bg-zinc-900 border border-amber-500 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
                             <input 
                                type="text" 
                                placeholder="Nom"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 focus:border-amber-500 focus:outline-none"
                                value={editEnvelopeName}
                                onChange={(e) => setEditEnvelopeName(e.target.value)}
                                autoFocus
                            />
                            
                            <div className="flex gap-2 text-sm text-zinc-400">Montant (€)</div>
                            <input 
                                type="number" 
                                value={editEnvelopeAmount}
                                onChange={(e) => setEditEnvelopeAmount(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-right focus:border-amber-500 focus:outline-none"
                            />

                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700">
                                {PREDEFINED_ICONS.map(({ name, icon: Icon }) => (
                                    <button
                                        key={name}
                                        onClick={() => setEditEnvelopeIcon(name)}
                                        className={`p-2 rounded-lg border flex-shrink-0 ${editEnvelopeIcon === name ? "bg-zinc-800 border-amber-500 text-amber-500" : "border-zinc-800 text-zinc-500 hover:bg-zinc-800"}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700">
                                 {COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setEditEnvelopeColor(color)}
                                        className={`w-6 h-6 rounded-full flex-shrink-0 ${color} ${editEnvelopeColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'opacity-50 hover:opacity-100'}`}
                                    />
                                 ))}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button 
                                    onClick={saveEditedEnvelope}
                                    className="flex-1 bg-amber-500 text-white py-2 rounded-lg font-semibold hover:bg-amber-600 flex justify-center items-center gap-2"
                                >
                                    <Check className="h-4 w-4" /> Sauvegarder
                                </button>
                                 <button 
                                    onClick={cancelEditing}
                                    className="px-4 bg-transparent border border-zinc-700 text-white py-2 rounded-lg hover:bg-zinc-800"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    );
                }

                return (
                <div key={env.id} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl group hover:border-zinc-700 transition-all">
                  <div className={`w-12 h-12 rounded-full ${env.color} flex items-center justify-center shrink-0`}>
                    {(() => {
                        const IconComponent = PREDEFINED_ICONS.find(i => i.name === env.icon)?.icon || ShoppingCart;
                        return <IconComponent className="h-6 w-6 text-white" />;
                    })()}
                  </div>
                  <div className="flex-1 cursor-pointer" onClick={() => startEditingEnvelope(env)}>
                    <h3 className="font-semibold">{env.name}</h3>
                    <p className="text-xs text-zinc-500">Budget mensuel</p>
                  </div>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">€</span>
                    <input 
                        type="number" 
                        value={env.amount}
                        onChange={(e) => updateEnvelopeAmount(env.id, e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-8 pr-2 text-right focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEditingEnvelope(env)}
                        className="p-1 text-zinc-600 hover:text-amber-500"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => removeEnvelope(env.id)}
                        className="p-1 text-zinc-600 hover:text-red-500"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                  </div>
                </div>
              );
             })}

                {/* Formulaire ajout enveloppe */}
                {isAddingEnvelope ? (
                    <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl space-y-4 animate-in zoom-in-95 duration-200">
                        <input 
                            type="text" 
                            placeholder="Nom (ex: Cadeaux)"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 focus:border-amber-500 focus:outline-none"
                            value={newEnvelopeName}
                            onChange={(e) => setNewEnvelopeName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700">
                            {PREDEFINED_ICONS.map(({ name, icon: Icon }) => (
                                <button
                                    key={name}
                                    onClick={() => setNewEnvelopeIcon(name)}
                                    className={`p-2 rounded-lg border ${newEnvelopeIcon === name ? "bg-zinc-800 border-amber-500 text-amber-500" : "border-zinc-800 text-zinc-500 hover:bg-zinc-800"}`}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                             {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setNewEnvelopeColor(color)}
                                    className={`w-6 h-6 rounded-full ${color} ${newEnvelopeColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'opacity-50 hover:opacity-100'}`}
                                />
                             ))}
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={addEnvelope}
                                className="flex-1 bg-white text-black py-2 rounded-lg font-semibold hover:bg-zinc-200"
                            >
                                Ajouter
                            </button>
                             <button 
                                onClick={() => setIsAddingEnvelope(false)}
                                className="flex-1 bg-transparent border border-zinc-700 text-white py-2 rounded-lg hover:bg-zinc-800"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsAddingEnvelope(true)}
                        className="w-full py-4 border border-dashed border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-zinc-500 hover:text-white hover:border-zinc-600 transition-all hover:bg-zinc-900/50"
                    >
                        <Plus className="h-5 w-5" />
                        Créer une enveloppe
                     </button>
                )}
            </div>

            <div className="flex gap-4 pt-8">
                <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-bold text-zinc-400 hover:text-white transition-colors"
                >
                    Retour
                </button>
                <button 
                    onClick={handleFinish}
                    disabled={loading || !isBudgetValid}
                    className="flex-[2] py-4 bg-amber-500 hover:bg-amber-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                    {loading ? "Configuration..." : "Terminer"} <CheckCircle2 className="h-5 w-5" />
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
