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
  LucideIcon,
  Bell,
  Share,
  List,
  Workflow
} from "lucide-react";
import TransactionModal from "@/components/dashboard/TransactionModal";
import { logger } from "@/lib/logger";

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
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  
  // Gestion de la date sélectionnée (Mois)
  const [currentDate, setCurrentDate] = useState(new Date());

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
      if (!settings) {
        try {
            const settingsRef = doc(db, "users", user.uid, "settings", "general");
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                setSettings(settingsSnap.data() as UserSettings);
            }
        } catch(e) { logger.warn("Settings read failed"); }
      }

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
                order: data.order
            } as unknown as Envelope); 
          });
          // Tri par ordre
          envList.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      } catch(e) { logger.warn("Envelopes read failed"); }

      // 3. Transactions du mois sélectionné
      const { start, end } = getMonthBounds(currentDate);
      const txList: any[] = [];
      
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
            txList.push({ id: doc.id, ...data });
            
            // Ajouter au 'spent' de l'enveloppe correspondante
            const envIndex = envList.findIndex(e => e.id === data.envelopeId);
            if (envIndex !== -1) {
                envList[envIndex].spent += (data.amount || 0);
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
            {/* 1. Évolution (Graphique) */}
            <button 
                onClick={() => router.push('/evolution')}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-amber-500 transition-colors"
                title="Évolution des dépenses"
            >
                <TrendingUp className="h-5 w-5" />
            </button>
            
            {/* 2. Historique (Liste) */}
            <button 
                onClick={() => router.push('/history')}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Historique Global"
            >
                <List className="h-5 w-5" />
            </button>

            {/* 5. Cash Flow (Sankey) */}
            <button 
                onClick={() => router.push('/cashflow')}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500 transition-colors"
                title="Cash Flow"
            >
                <Workflow className="h-5 w-5" />
            </button>

            {/* 3. Paramètres */}
            <button 
                onClick={() => router.push('/settings')}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Paramètres"
            >
                <Settings className="h-5 w-5" />
            </button>

            {/* 4. Déconnexion */}
            <button 
                onClick={handleLogout} 
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                title="Se déconnecter"
            >
                <LogOut className="h-5 w-5" />
            </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-8">
        
        {/* Résumé du Mois (Card Principale) */}
        <section className="bg-gradient-to-br from-zinc-900 to-amber-950/30 border border-zinc-800/80 rounded-3xl p-5 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-1 py-3">
                <span className="text-zinc-400 text-xs font-medium tracking-wide uppercase">Reste disponible</span>
                <h2 className={`text-4xl font-extrabold tracking-tighter ${currentMonthBalance < 0 ? 'text-red-500' : 'text-white'}`}>
                    {currentMonthBalance.toFixed(2)} <span className="text-2xl text-zinc-500">€</span>
                </h2>
                <div className="text-xs text-zinc-500">
                    Sur {monthlyTotalAvailable.toFixed(0)} € prévus
                </div>
            </div>

            {/* Global Progress Bar */}
            <div className="mt-6 space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-zinc-400">
                    <span>Dépenses : {totalSpentEnvelopes.toFixed(2)} €</span>
                    <span>{globalProgress.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
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
                            className="bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 p-4 rounded-xl transition-all group relative cursor-pointer active:scale-95 z-0"
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg border border-zinc-800 ${env.color} text-white`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h4 className="font-semibold text-base text-zinc-100 truncate max-w-[140px]">{env.name}</h4>
                                    </div>
                                    
                                    {/* Menu des enveloppes */}
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === env.id ? null : env.id);
                                            }}
                                            className={`p-1.5 rounded-lg transition-colors ${openMenuId === env.id ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-white hover:bg-zinc-800/50'}`}
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

                                <div className="space-y-0.5">
                                    <div className="flex justify-between items-baseline">
                                        <span className={`text-xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-zinc-200'}`}>
                                            {remaining.toFixed(2)}€
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            sur {env.budget.toFixed(2)}€
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Mini Progress Bar interne */}
                                <div className="mt-2 flex h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
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
      
      {/* Popup Notification */}
      {showNotifPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
             
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Bell className="w-24 h-24 text-amber-500 -rotate-12 transform translate-x-4 -translate-y-4" />
              </div>

              <div className="relative z-10 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mb-2">
                     <Bell className="w-6 h-6" />
                  </div>
                  
                  <h2 className="text-xl font-bold text-white">Ne loupez aucune dépense !</h2>
                  
                  <p className="text-zinc-400 text-sm">
                     Activez le rappel quotidien de 19h pour garder votre budget à jour. 
                     C'est le meilleur moyen de tenir ses objectifs ! 🎯
                  </p>

                  <div className="flex flex-col gap-3 pt-4">
                      <button 
                          onClick={() => router.push('/settings')}
                          className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/20"
                      >
                          Aller activer les notifications
                      </button>
                      <button 
                          onClick={() => setShowNotifPopup(false)}
                          className="w-full py-2 px-4 text-zinc-500 hover:text-white text-sm font-medium transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
             
              <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Share className="w-24 h-24 text-blue-500 -rotate-12 transform translate-x-4 -translate-y-4" />
              </div>

              <div className="relative z-10 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-2">
                     <Share className="w-6 h-6" />
                  </div>
                  
                  <h2 className="text-xl font-bold text-white">Installez l'application</h2>
                  
                  <p className="text-zinc-400 text-sm">
                     Pour une meilleure expérience, ajoutez BudgetFlow à votre écran d'accueil.
                  </p>
                  
                  <div className="bg-zinc-800/50 rounded-lg p-4 text-left text-sm text-zinc-300 space-y-2">
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
                          className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
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
        refreshData={fetchData}
        defaultEnvelopeId={defaultEnvelopeId}
      />

    </div>
  );
}
