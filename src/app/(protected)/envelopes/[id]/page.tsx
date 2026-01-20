"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getMonthBounds, formatMonthYear } from "@/lib/dateUtils";
import { collection, doc, getDoc, getDocs, orderBy, query, where, deleteDoc } from "firebase/firestore";
import { MoveLeft, Trash2, Calendar, Plus, ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee, Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer, LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, use } from "react";
import TransactionModal from "@/components/dashboard/TransactionModal";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Fuel, Utensils, Plane, Heart, Gamepad2, Bus, Shirt, Music, Coffee,
  Briefcase, GraduationCap, Baby, PawPrint, Gift, Smartphone, Wifi, Zap, Droplets, Hammer
};

export default function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);

  const [envelope, setEnvelope] = useState<any>(null);
  const [allEnvelopes, setAllEnvelopes] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);

  // Date context
  const dateParam = searchParams.get('date');
  const contextDate = dateParam ? new Date(dateParam) : null;

  const fetchData = async () => {
    if (!user || !id) return;
    try {
      // 1. Info Enveloppe Courante
      const envRef = doc(db, "users", user.uid, "envelopes", id);
      const envSnap = await getDoc(envRef);
      if (envSnap.exists()) {
        setEnvelope({ id: envSnap.id, ...envSnap.data() });
      } else {
        router.push("/dashboard"); // Enveloppe introuvable
        return;
      }

      // 1b. Charger TOUTES les enveloppes (pour la modale d'édition)
      const allEnvRef = collection(db, "users", user.uid, "envelopes");
      const allEnvSnap = await getDocs(allEnvRef);
      const allEnvList: any[] = [];
      allEnvSnap.forEach(doc => {
        allEnvList.push({ id: doc.id, ...doc.data() });
      });
      setAllEnvelopes(allEnvList);

      // 2. Transactions
      const txRef = collection(db, "users", user.uid, "transactions");
      let q;
      let dateFilter: { start: string, end: string } | null = null;

      if (contextDate) {
        // Filtrage par mois
        const { start, end } = getMonthBounds(contextDate);
        // On ajuste la fin pour inclure toute la journée
        const endOfDay = end + "T23:59:59";
        dateFilter = { start, end: endOfDay };
        
        // On récupère TOUT pour cette enveloppe et on filtre en JS pour éviter 
        // l'erreur d'index Firestore (where envelopeId + where date requires composite index)
        q = query(
            txRef, 
            where("envelopeId", "==", id)
        );
      } else {
        // Historique global (fallback)
        // Note: Si une erreur d'index survient ici aussi, il faudrait enlever le orderBy
        q = query(
            txRef, 
            where("envelopeId", "==", id),
            orderBy("date", "desc"),
            limit(50)
        );
      }
      
      const txSnap = await getDocs(q);
      const txList: any[] = [];
      txSnap.forEach(doc => {
        const data = doc.data();
        // Filtrage manuel si nécessaire
        if (dateFilter) {
            if (data.date >= dateFilter.start && data.date <= dateFilter.end) {
                txList.push({ id: doc.id, ...data });
            }
        } else {
            txList.push({ id: doc.id, ...data });
        }
      });
      
      // Tri manuel pour éviter les problèmes d'index Firestore combinant where() et orderBy()
      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTransactions(txList);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Si l'ID change ou la date change, on recharge
    fetchData();
  }, [user, id, dateParam]); // dateParam dépend de searchParams

  const handleDeleteTransaction = async (txId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher l'ouverture de la modale d'édition
    if (!confirm("Supprimer cette dépense ?")) return;
    if (!user) return;
    try {
        await deleteDoc(doc(db, "users", user.uid, "transactions", txId));
        setTransactions(transactions.filter(t => t.id !== txId));
    } catch (error) {
        console.error("Erreur suppression", error);
    }
  };

  const handleEditClick = (tx: any) => {
    setTransactionToEdit(tx);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setTransactionToEdit(null);
  };

  const handleOpenCreateModal = () => {
    setTransactionToEdit(null);
    setIsEditModalOpen(true);
  };

  if (loading) return <div className="min-h-screen bg-black text-white p-8">Chargement...</div>;
  if (!envelope) return null;

  const Icon = ICON_MAP[envelope.icon] || ShoppingCart;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
                <MoveLeft className="h-6 w-6" />
            </button>
            <div className={`p-3 rounded-xl ${envelope.color} text-white border border-zinc-800`}>
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-2xl font-bold">{envelope.name}</h1>
                <p className="text-zinc-500">
                    {contextDate ? `Dépenses de ${formatMonthYear(contextDate)}` : "Historique récent"}
                </p>
            </div>
        </div>
        
        <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-5 rounded-xl transition-transform active:scale-95 shadow-lg shadow-amber-900/20"
        >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Nouvelle Dépense</span>
        </button>
      </header>
      
      <div className="space-y-4 max-w-3xl mx-auto">
        {transactions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Aucune dépense pour le moment.
            </div>
        ) : (
            transactions.map((tx) => (
                <div 
                    key={tx.id} 
                    onClick={() => handleEditClick(tx)}
                    className="flex justify-between items-center bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl cursor-pointer hover:bg-zinc-900 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-zinc-950 rounded-full text-zinc-500 group-hover:bg-black transition-colors">
                             <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="font-medium text-white">{tx.description || "Dépense"}</p>
                            <p className="text-xs text-zinc-500">{new Date(tx.date).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-red-400">-{tx.amount} €</span>
                        <button 
                            onClick={(e) => handleDeleteTransaction(tx.id, e)}
                            className="p-2 text-zinc-600 hover:text-red-500 transition-colors z-10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      <TransactionModal 
        isOpen={isEditModalOpen}
        onClose={closeModal}
        envelopes={allEnvelopes}
        refreshData={fetchData} 
        transactionToEdit={transactionToEdit}
        defaultEnvelopeId={envelope.id}
      />
    </div>
  );
}
