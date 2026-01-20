"use client";

import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc, orderBy, limit, where } from "firebase/firestore";
import { useEffect, useState } from "react";
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
  LucideIcon
} from "lucide-react";
import TransactionModal from "@/components/dashboard/TransactionModal";

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
}

interface Envelope {
  id: string;
  name: string;
  budget: number;
  spent: number;
  icon: string;
  color: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [defaultEnvelopeId, setDefaultEnvelopeId] = useState<string | undefined>(undefined);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // Gestion de la date sélectionnée (Mois)
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Chargement des données ---
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Settings (Statique)
      if (!settings) {
        const settingsRef = doc(db, "users", user.uid, "settings", "general");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            setSettings(settingsSnap.data() as UserSettings);
        }
      }

      // 2. Enveloppes (Structure)
      // Note: On ne se fie plus au champ 'spent' de l'enveloppe car il est global.
      // On va le recalculer en fonction des transactions du mois.
      let envList: Envelope[] = [];
      const envRef = collection(db, "users", user.uid, "envelopes");
      const envSnap = await getDocs(envRef);
      envSnap.forEach((doc) => {
        envList.push({ id: doc.id, ...doc.data(), spent: 0 } as Envelope); // Reset spent à 0 pour le calcul local
      });

      // 3. Transactions du mois sélectionné
      const { start, end } = getMonthBounds(currentDate);
      
      const txRef = collection(db, "users", user.uid, "transactions");
      const q = query(
        txRef, 
        where("date", ">=", start),
        where("date", "<=", end)
      );
      
      const txSnap = await getDocs(q);
      const txList: any[] = [];
      
      txSnap.forEach((doc) => {
        const data = doc.data();
        txList.push({ id: doc.id, ...data });
        
        // Ajouter au 'spent' de l'enveloppe correspondante
        const envIndex = envList.findIndex(e => e.id === data.envelopeId);
        if (envIndex !== -1) {
            envList[envIndex].spent += (data.amount || 0);
        }
      });
      
      setTransactions(txList);
      setEnvelopes(envList);
      
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, currentDate]); // Recharger quand l'utilisateur OU la date change

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  // --- Calculs globaux ---
  const totalBudgetEnvelopes = envelopes.reduce((acc, env) => acc + env.budget, 0);
  const totalSpentEnvelopes = envelopes.reduce((acc, env) => acc + env.spent, 0);
  
  // Reste à vivre réel (ce qu'il reste dans les enveloppes + surplus non alloué)
  // Logic: Income - Fixed - Savings = Total Available for Month
  // Current Balance = Total Available - Total Spent
  const monthlyTotalAvailable = settings ? (settings.monthlyIncome - settings.fixedCosts - settings.monthlySavings) : 0;
  const currentMonthBalance = monthlyTotalAvailable - totalSpentEnvelopes;
  
  const globalProgress = monthlyTotalAvailable > 0 ? (totalSpentEnvelopes / monthlyTotalAvailable) * 100 : 0;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login"); // Force redirect
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20 sm:pb-8">
        
      {/* Header Mobile / Desktop */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
           {/* Navigation Mois */}
           <div className="flex items-center gap-2 bg-zinc-900 rounded-full p-1 border border-zinc-800">
              <button 
                  onClick={() => changeMonth(-1)} 
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                  <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold capitalize w-32 text-center select-none">
                  {formatMonthYear(currentDate)}
              </span>
              <button 
                  onClick={() => changeMonth(1)}
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                  <ChevronRight className="h-5 w-5" />
              </button>
           </div>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={() => router.push('/history')}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Historique Global"
            >
                <TrendingUp className="h-5 w-5" />
            </button>
            <button 
                onClick={() => router.push('/settings')}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
                <Settings className="h-5 w-5" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors">
                <LogOut className="h-5 w-5" />
            </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-8">
        
        {/* Résumé du Mois (Card Principale) */}
        <section className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-2 py-4">
                <span className="text-zinc-400 text-sm font-medium tracking-wide uppercase">Reste disponible</span>
                <h2 className={`text-5xl font-extrabold tracking-tighter ${currentMonthBalance < 0 ? 'text-red-500' : 'text-white'}`}>
                    {currentMonthBalance.toFixed(2)} <span className="text-2xl text-zinc-500">€</span>
                </h2>
                <div className="text-sm text-zinc-500">
                    Sur {monthlyTotalAvailable.toFixed(0)} € prévus
                </div>
            </div>

            {/* Global Progress Bar */}
            <div className="mt-8 space-y-2">
                <div className="flex justify-between text-xs font-medium text-zinc-400">
                    <span>Dépenses : {totalSpentEnvelopes.toFixed(2)} €</span>
                    <span>{globalProgress.toFixed(0)}%</span>
                </div>
                <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${globalProgress > 100 ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-orange-600'}`}
                        style={{ width: `${Math.min(globalProgress, 100)}%` }}
                    ></div>
                </div>
                {/* Visualisation des segments (Optionnel, simplifié ici) */}
                <div className="flex h-1 mt-1 gap-1">
                    {envelopes.map((env) => (
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
        </section>

        {/* Grille des Enveloppes */}
        <section>
            <div className="flex justify-between items-end mb-4 px-2">
                <h3 className="text-lg font-bold text-zinc-200">Mes Enveloppes</h3>
                <span className="text-xs text-zinc-500">{envelopes.length} catégories</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {envelopes.map((env) => {
                    const progress = env.budget > 0 ? (env.spent / env.budget) * 100 : 0;
                    const remaining = env.budget - env.spent;
                    const Icon = ICON_MAP[env.icon] || ShoppingCart;

                    return (
                        <div 
                            key={env.id} 
                            onClick={() => router.push(`/envelopes/${env.id}?date=${currentDate.toISOString()}`)}
                            className="bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 p-5 rounded-2xl transition-all group relative cursor-pointer active:scale-95 z-0"
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl border border-zinc-800 ${env.color} text-white`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    
                                    {/* Menu des enveloppes */}
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === env.id ? null : env.id);
                                            }}
                                            className={`p-2 rounded-lg transition-colors ${openMenuId === env.id ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-white hover:bg-zinc-800/50'}`}
                                            title="Options"
                                        >
                                            <MoreHorizontal className="h-5 w-5" />
                                        </button>

                                        {openMenuId === env.id && (
                                            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col p-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDefaultEnvelopeId(env.id);
                                                        setIsTxModalOpen(true);
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="flex items-center gap-3 px-3 py-3 text-sm font-bold text-amber-500 hover:bg-zinc-800 rounded-lg transition-colors text-left"
                                                >
                                                    <Plus className="h-4 w-4" /> Nouvelle Dépense
                                                </button>
                                                <button 
                                                     onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/envelopes/${env.id}?date=${currentDate.toISOString()}`);
                                                     }}
                                                    className="flex items-center gap-3 px-3 py-3 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-left"
                                                >
                                                    <TrendingUp className="h-4 w-4" /> Détails & Historique
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="font-semibold text-lg">{env.name}</h4>
                                    <div className="flex justify-between items-baseline">
                                        <span className={`text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-zinc-200'}`}>
                                            {remaining.toFixed(2)}€
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            sur {env.budget.toFixed(2)}€
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Mini Progress Bar interne */}
                                <div className="mt-3 flex h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                     {transactions
                                        .filter(t => t.envelopeId === env.id)
                                        .map((tx) => (
                                            <div 
                                                key={tx.id}
                                                className={`h-full ${env.color} border-r-2 border-zinc-900/80 box-border`}
                                                style={{ width: `${(tx.amount / env.budget) * 100}%` }}
                                                title={`${tx.description || 'Dépense'}: ${Number(tx.amount).toFixed(2)}€`}
                                            />
                                        ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>

      </main>

      {/* Floating Action Button (FAB) - Quick Add */}
      <button 
        onClick={() => setIsTxModalOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg shadow-amber-900/20 transition-transform hover:scale-105 active:scale-95 z-40"
      >
        <Plus className="h-8 w-8" />
      </button>

      {/* Modale d'ajout transaction */}
      <TransactionModal 
        isOpen={isTxModalOpen} 
        onClose={() => {
            setIsTxModalOpen(false);
            setDefaultEnvelopeId(undefined);
        }}
        envelopes={envelopes}
        refreshData={fetchData}
        defaultEnvelopeId={defaultEnvelopeId}
      />

    </div>
  );
}
