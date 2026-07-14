"use client";

import { useAuth } from "@/context/AuthContext";
import { useAnonymousMode } from "@/context/AnonymousModeContext";
import { db } from "@/lib/firebase";

import { collection, query, getDocs, where, doc, getDoc, limit } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, TrendingUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { useCurrencyFormatting } from "@/hooks/useCurrencyFormatting";
import { motion, AnimatePresence } from "framer-motion";
import { resolveMonthlyIncome } from "@/lib/settingsService";
import { getMonthlyIncomes } from "@/lib/monthlyIncomeService";

const MASK_WITH_DECIMALS = "****,**";

interface UserSettings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
  isFixedIncome?: boolean;
}

interface MonthlyData {
  date: Date;
  totalSpent: number;
  income: number;
  fixedCosts: number;
  savingsObjective: number;
  remaining: number; // calculated: income - fixed - spent
  transactionCount: number;
}

export default function EvolutionPage() {
  const { user } = useAuth();
  const { anonymousMode } = useAnonymousMode();
  const { formatAmount, symbol, currency } = useCurrencyFormatting();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlyData[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // 1. Get Settings
        let income = 0;
        let fixedCosts = 0;
        let savingsObjective = 0;
        let isFixedIncome = true;
        let monthlyIncomes: Record<string, number> = {};

        const settingsRef = doc(db, "users", user.uid, "settings", "general");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            const s = settingsSnap.data() as UserSettings;
            income = s.monthlyIncome || 0;
            fixedCosts = s.fixedCosts || 0;
            savingsObjective = s.monthlySavings || 0;
            isFixedIncome = s.isFixedIncome !== false;
        }

        // 1b. If variable income, fetch per-month overrides.
        if (!isFixedIncome) {
          try {
            monthlyIncomes = await getMonthlyIncomes(user.uid);
          } catch (e) {
            logger.warn("Monthly incomes read failed, using fallback income");
          }
        }

        // 2. Determine Date Range (Last 6 months)
        const today = new Date();
        const end = endOfMonth(today);
        const start = startOfMonth(subMonths(today, 5));

        // 3. Get Transactions (date-filtered, last 6 months)
        const txRef = collection(db, "users", user.uid, "transactions");
        const fmt = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };
        const startStr = fmt(start);
        const endStr = `${fmt(end)}T23:59:59`;
        const q = query(
          txRef,
          where("date", ">=", startStr),
          where("date", "<=", endStr),
          limit(5000)
        );
        const querySnapshot = await getDocs(q);

        // 4. Aggregate by Month
        const months = eachMonthOfInterval({ start, end });

        const monthlyData = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            let totalSpent = 0;
            let transactionCount = 0;

            querySnapshot.forEach((doc) => {
                const tx = doc.data();
                // Handle Firestore Timestamp or ISO string
                let txDate: Date;
                if (tx.date && typeof tx.date.toDate === 'function') {
                     txDate = tx.date.toDate();
                } else {
                     txDate = new Date(tx.date);
                }

                if (txDate >= monthStart && txDate <= monthEnd) {
                    const amount = parseFloat(tx.amount);
                    totalSpent += tx.isReimbursement ? -amount : amount;
                    transactionCount++;
                }
            });

            // Resolve the effective income for this specific month.
            const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
            const resolvedIncome = isFixedIncome
              ? income
              : resolveMonthlyIncome(monthStr, monthlyIncomes, income);

            // Logic: Remaining = (Income - FixedCosts - Savings) - Spent
            // Correspond au "Reste disponible" du Dashboard
            const remaining = (resolvedIncome - fixedCosts - savingsObjective) - totalSpent;

            return {
                date: month,
                totalSpent,
                income: resolvedIncome,
                fixedCosts,
                savingsObjective,
                remaining,
                transactionCount,
            };
        });

        // Filter out months with no transactions so we don't show flat lines.
        // Use transactionCount instead of totalSpent > 0 because reimbursements
        // can make totalSpent negative even when transactions exist.
        const filteredData = monthlyData.filter(d => d.transactionCount > 0);
        setData(filteredData);

      } catch (error) {
        logger.error("Error fetching evolution data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // --- Graph Logic ---
  
  // Max / Min for scaling
  const maxVal = Math.max(...data.map(d => d.remaining), 100); // Au moins 100 pour pas div/0
  const minVal = Math.min(...data.map(d => d.remaining), 0);
  
  // Amplitude totale
  const range = maxVal - minVal;
  // Marge de 20% en haut et en bas pour que la courbe ne touche pas les bords
  const paddedRange = range === 0 ? 100 : range * 1.4; 
  const yBase = minVal - (range * 0.2); // Point le plus bas affichable (zéro visuel du graph = bas du svg)
  
  // Fonction pour convertir une valeur en coordonnée Y (0 = haut, height = bas /!\ SVG)
  const height = 250;
  const getY = (val: number) => {
      // Inverser car Y=0 est en haut en SVG
      return height - ((val - yBase) / paddedRange) * height;
  };
  
  // Position de la ligne 0 (Axe X)
  const zeroY = getY(0);

  // Génération du Path Courbe (Smooth Bezier)
  // Fonction simple de lissage Catmull-Rom ou Bezier cubique simplifié
  const getPath = (points: {x: number, y: number}[], closeToZero: boolean = false) => {
      if (points.length === 0) return "";
      if (points.length === 1) return `M ${points[0].x},${points[0].y} Z`;

      let d = `M ${points[0].x},${points[0].y}`;
      
      for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];
          
          // Control points pour adoucir (basic smoothing)
          const cpx1 = current.x + (next.x - current.x) * 0.5;
          const cpy1 = current.y;
          const cpx2 = current.x + (next.x - current.x) * 0.5;
          const cpy2 = next.y;
          
          d += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${next.x},${next.y}`;
      }
      
      if (closeToZero) {
          // Fermer vers la ligne zéro (zeroY) pour créer un remplissage correct
          // On trace une ligne vers le dernier X à hauteur zéro
          d += ` L ${points[points.length-1].x},${zeroY}`;
          // On retourne au début à hauteur zéro
          d += ` L ${points[0].x},${zeroY}`;
          // On ferme la forme
          d += ` Z`;
      }
      
      return d;
  };

  const points = data.map((d, i) => ({
      xInt: i, // Index simple pour calcul
      xPct: data.length > 1 ? (i / (data.length - 1)) * 100 : 50, // Pourcentage width
      val: d.remaining
  }));

  // On calcule les coordonnées absolues (en % pour x, en user units pour y) n'est pas idéal dans d.
  // Astuce : On travaille en viewBox 0 0 1000 height.
  const chartWidth = 1000;
  const svgPoints = points.map(p => ({
      x: data.length > 1 ? (p.xInt / (data.length - 1)) * chartWidth : chartWidth / 2,
      y: getY(p.val)
  }));

  // Cumulés pour la période affichée
  const totalSaisie = data.reduce((sum, d) => sum + d.income, 0);
  const totalDepenses = data.reduce((sum, d) => sum + d.totalSpent, 0);
  const totalEconomies = data.reduce((sum, d) => sum + d.remaining, 0);
  const totalEpargneRealisee = data.reduce((sum, d) => sum + d.savingsObjective, 0);

  if (loading) {
     return <div className="min-h-screen bg-app-bg flex items-center justify-center text-amber-500"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 pb-20">
      <header className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full bg-app-surface border border-app-border hover:bg-app-surface transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="text-amber-500" />
            Évolution Économie
        </h1>
      </header>

      {/* Graphique Container */}
      <div className="bg-app-surface/50 border border-app-border rounded-3xl p-6 relative overflow-hidden">
        
        {data.length === 0 ? (
            <div className="text-center text-app-text-secondary py-10">Pas assez de données pour afficher l'évolution.</div>
        ) : (
            <div className="relative w-full mt-4 select-none" style={{ height: height }}>
                
                {/* Lignes horizontales (Grid Y) & Labels */}
                {/* On affiche quelques lignes repères */}
                <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
                    <div className="absolute w-full border-t border-zinc-100/30" style={{ top: zeroY }}></div> {/* Ligne Zéro */}
                </div>

                {/* SVG Curve et remplissage */}
                <svg className="absolute inset-0 h-full w-full overflow-visible z-10" viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gradientCurve" x1="0" y1="0" x2="0" y2="1">
                            {/* Dégradé du Orange vers transparent */}
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    
                    {/* Area path (Remplissage) */}
                    <motion.path 
                        d={getPath(svgPoints, true)}
                        fill="url(#gradientCurve)"
                        className="transition-all duration-1000 ease-out"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                    />

                    {/* Line path (Contour) */}
                    <motion.path 
                        d={getPath(svgPoints, false)}
                        fill="none"
                        stroke="#f59e0b" // Amber-500
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                            pathLength: { duration: 1.5, ease: "easeInOut" },
                            opacity: { duration: 0.3 }
                        }}
                    />
                    
                    {/* Ligne Zéro visuelle dans le SVG pour référence claire */}
                    <line x1="0" y1={zeroY} x2={chartWidth} y2={zeroY} stroke="#ffffff" strokeOpacity="0.1" strokeDasharray="5,5" />
                </svg>

                {/* Points et Tooltips (Overlay HTML pour accessibilité et facilité) */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                     {data.map((d, i) => {
                         const y = getY(d.remaining);
                         // Position X en pourcentage
                         const leftPct = data.length > 1 ? (i / (data.length - 1)) * 100 : 50; 
                         
                         const isFirst = i === 0;
                         const isLast = i === data.length - 1;

                         // Classes de positionnement conditionnelles
                         let tooltipPositionClass = "bottom-full mb-3 left-1/2 -translate-x-1/2"; // Défaut : Au-dessus centré
                         let tooltipTransformStart = "translate-y-2"; // Animation start
                         let tooltipTransformEnd = "translate-y-0"; // Animation end

                         if (isFirst) {
                             tooltipPositionClass = "left-full ml-4 top-1/2 -translate-y-1/2"; // À droite
                             tooltipTransformStart = "-translate-x-2";
                             tooltipTransformEnd = "translate-x-0";
                         } else if (isLast) {
                             tooltipPositionClass = "right-full mr-4 top-1/2 -translate-y-1/2"; // À gauche
                             tooltipTransformStart = "translate-x-2";
                             tooltipTransformEnd = "translate-x-0";
                         }

                         return (
                            <div 
                                key={i} 
                                className="absolute flex flex-col items-center group w-10 -ml-5 pointer-events-auto"
                                style={{ 
                                    top: y, // Position exacte
                                    left: `${leftPct}%`,
                                    transform: 'translateY(-50%)' // Centrer verticalement sur le point
                                }}
                            >
                                {/* Tooltip */}
                                <AnimatePresence>
                                    {hoveredIndex === i && (
                                        <motion.div
                                            className={`absolute ${tooltipPositionClass} bg-app-surface/90 border border-amber-500/30 px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md text-center transform pointer-events-none whitespace-nowrap z-30`}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <span className="block text-xs text-app-text-secondary capitalize mb-1">{format(d.date, "MMMM yyyy", { locale: fr })}</span>
                                            <motion.span
                                                className={`block text-lg font-bold tabular-nums ${d.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.05 }}
                                            >
                                                {d.remaining > 0 ? "+" : ""}{formatAmount(d.remaining)}
                                            </motion.span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                
                                {/* Point */}
                                <motion.div
                                    className={`w-3 h-3 rounded-full border-2 ${d.remaining >= 0 ? 'border-emerald-500 bg-emerald-950' : 'border-red-500 bg-red-950'} group-hover:bg-white group-hover:scale-150 transition-all cursor-pointer shadow-lg`}
                                    onMouseEnter={() => setHoveredIndex(i)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    onClick={() => setHoveredIndex(i)}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: i * 0.08 + 0.8 }}
                                />
                                
                                {/* Label Axe X (Mois) */}
                                <div 
                                    className="absolute top-6 text-xs font-medium text-app-text-secondary transition-colors group-hover:text-app-text"
                                    style={{ marginTop: '10px' }} // Décalage pour ne pas coller au point
                                >
                                    {format(d.date, "MMM", { locale: fr })}
                                </div>
                            </div>
                         );
                     })}
                </div>
            </div>
        )}
      </div>
      
      {/* Résumé cumulés */}
      {data.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-app-surface/30 border border-app-border rounded-2xl text-center">
            <div className="text-xs text-app-text-secondary">Total dépenses</div>
            <div className="text-lg font-bold text-amber-500 tabular-nums">{formatAmount(totalDepenses)}</div>
          </div>

          <div className="p-4 bg-app-surface/30 border border-app-border rounded-2xl text-center">
            <div className="text-xs text-app-text-secondary">Total économies</div>
            <div className={`text-lg font-bold tabular-nums ${totalEconomies >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalEconomies > 0 ? "+" : ""}{formatAmount(totalEconomies)}</div>
          </div>
        </div>
      )}

      {/* Liste détaillée en dessous */}
      <div className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-app-text px-2">Détails mensuels</h3>
          <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
              className="space-y-3"
          >
          {data.slice().reverse().map((d, i) => (
              <motion.div
                  key={i}
                  variants={{
                      hidden: { opacity: 0, y: 16 },
                      visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } }
                  }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-app-surface/30 border border-app-border hover:border-app-border hover:bg-app-surface/60 transition-all rounded-2xl group gap-4"
              >
                  
                  {/* Mois (Gauche) */}
                  <div className="flex items-center gap-3">
                      <div className={`w-1 h-8 rounded-full ${d.remaining >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <span className="capitalize font-medium text-app-text text-lg">{format(d.date, "MMMM yyyy", { locale: fr })}</span>
                  </div>

                  {/* Groupe Dépenses + Économie (Droite) */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-12 w-full sm:w-auto mt-2 sm:mt-0">
                      
                      {/* Dépenses */}
                      <div className="flex justify-between sm:flex-col sm:items-end sm:text-right">
                           <span className="text-xs text-app-text-secondary uppercase tracking-wider block mb-1">Dépenses</span>
                           <motion.span
                               className="font-bold font-mono text-amber-500 text-lg leading-none tabular-nums"
                               initial={{ opacity: 0, scale: 0.9 }}
                               animate={{ opacity: 1, scale: 1 }}
                               transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 + i * 0.04 }}
                           >
                               {formatAmount(d.totalSpent)}
                           </motion.span>
                      </div>

                      {/* Économie */}
                      <div className="flex justify-between sm:flex-col sm:items-end sm:text-right">
                           <span className="text-xs text-app-text-secondary uppercase tracking-wider block mb-1">Économie</span>
                           <motion.span
                               className={`font-bold font-mono text-lg leading-none tabular-nums ${d.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                               initial={{ opacity: 0, scale: 0.9 }}
                               animate={{ opacity: 1, scale: 1 }}
                               transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.35 + i * 0.04 }}
                           >
                               {d.remaining > 0 ? "+" : ""}{formatAmount(d.remaining)}
                           </motion.span>
                      </div>
                  </div>
              </motion.div>
          ))}
          </motion.div>
      </div>
    </div>
  );
}
