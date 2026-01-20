"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, orderBy, query, limit, where, getDoc } from "firebase/firestore";
import { MoveLeft, ArrowDown, ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee, Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer, LucideIcon, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TransactionModal from "@/components/dashboard/TransactionModal";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer
};

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [envelopes, setEnvelopes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // État pour la modification
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      // 1. Charger les enveloppes pour avoir les icônes/couleurs en cache
      const envRef = collection(db, "users", user.uid, "envelopes");
      const envSnap = await getDocs(envRef);
      const envMap: Record<string, any> = {};
      
      // Stocker l'ID aussi ! C'est crucial pour le mapping
      // On va transformer ça en array pour le passer à la modale
      envSnap.forEach(doc => {
        envMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setEnvelopes(envMap);

      // 2. Charger TOUTES les transactions (limité à 100 pour l'exemple)
      const txRef = collection(db, "users", user.uid, "transactions");
      const q = query(
        txRef, 
        orderBy("date", "desc"),
        limit(100)
      );
      const txSnap = await getDocs(q);
      const txList: any[] = [];
      txSnap.forEach(doc => {
        txList.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(txList);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleEditClick = (tx: any) => {
    setTransactionToEdit(tx);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setTransactionToEdit(null);
  };

  if (loading) return <div className="min-h-screen bg-black text-white p-8">Chargement...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-black/80 backdrop-blur-md py-4 z-10 border-b border-zinc-800">
        <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
                <MoveLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold">Historique Global</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto relative border-l border-zinc-800 ml-4 sm:ml-8 space-y-8 pl-8 sm:pl-12 my-8">
        {transactions.map((tx, index) => {
            const env = envelopes[tx.envelopeId] || {};
            const Icon = ICON_MAP[env.icon] || ShoppingCart;
            const dateObj = new Date(tx.date);
            
            // Afficher le mois si c'est le premier item ou si le mois change par rapport au précédent
            const showMonthDivider = index === 0 || 
                new Date(transactions[index - 1].date).getMonth() !== dateObj.getMonth();

            return (
                <div key={tx.id} className="relative">
                    {/* Month Divider */}
                    {showMonthDivider && (
                        <div className="absolute -left-[54px] sm:-left-[70px] -top-10 flex items-center mb-6 mt-2">
                             <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest bg-black py-1 pr-2">
                                {dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                             </span>
                        </div>
                    )}

                    {/* Timeline Dot */}
                    <div className={`absolute -left-[42px] sm:-left-[58px] top-4 w-5 h-5 rounded-full border-4 border-black ${env.color || 'bg-zinc-500'}`}></div>

                    <div 
                        onClick={() => handleEditClick(tx)}
                        className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 p-4 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                    >
                         <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl bg-zinc-950/50 ${env.color ? env.color.replace('bg-', 'text-') : 'text-zinc-500'}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-white">{tx.description || env.name || "Dépense"}</p>
                                <p className="text-xs text-zinc-500 flex items-center gap-1">
                                    {dateObj.toLocaleDateString()}
                                    <span className="text-zinc-600">•</span>
                                    {env.name}
                                </p>
                            </div>
                        </div>
                        <span className="font-bold text-red-500 text-lg">-{tx.amount} €</span>
                    </div>
                </div>
            );
        })}
      </div>

      <TransactionModal 
        isOpen={isEditModalOpen}
        onClose={closeModal}
        envelopes={Object.values(envelopes)} 
        refreshData={fetchData} 
        transactionToEdit={transactionToEdit}
      />
    </div>
  );
}
