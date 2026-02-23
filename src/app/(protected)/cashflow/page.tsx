"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { ChevronLeft, Workflow, Loader2 } from "lucide-react";
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { logger } from "@/lib/logger";

interface UserSettings {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
}

interface Envelope {
  id: string;
  name: string;
  budget: number;
  color: string;
}

const TAILWIND_COLORS_MAP: Record<string, string> = {
  "bg-amber-500": "#f59e0b",
  "bg-blue-500": "#3b82f6",
  "bg-green-500": "#22c55e",
  "bg-red-500": "#ef4444",
  "bg-purple-500": "#a855f7",
  "bg-pink-500": "#ec4899",
  "bg-indigo-500": "#6366f1",
  "bg-teal-500": "#14b8a6",
  "bg-orange-500": "#f97316",
  "bg-cyan-500": "#06b6d4",
};

const resolveColor = (value?: string) => {
  if (!value) return "#f59e0b";
  if (value.startsWith("#")) return value;

  // Accept Tailwind class strings like "bg-amber-500", "text-blue-500", "blue-500" or "bg-amber-500/80"
  const parts = value.split(" ");
  const token =
    parts.find((part) => part.startsWith("bg-")) ||
    parts.find((part) => part.startsWith("text-")) ||
    parts.find((part) => part.startsWith("border-")) ||
    value;

  const normalized = token
    .replace("bg-", "")
    .replace("text-", "")
    .replace("border-", "")
    .split("/")[0];

  const baseClass = normalized.startsWith("bg-") ? normalized : `bg-${normalized}`;
  const base = baseClass.split("/")[0];
  return TAILWIND_COLORS_MAP[base] || "#f59e0b";
};

export default function CashFlowPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch Settings
        const settingsRef = doc(db, "users", user.uid, "settings", "general");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data() as UserSettings);
        }

        // Fetch Envelopes
        const envCol = collection(db, "users", user.uid, "envelopes");
        const envSnap = await getDocs(envCol);
        const envList = envSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Envelope));
        setEnvelopes(envList);

      } catch (error) {
        logger.error("Error fetching cashflow data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-amber-500"><Loader2 className="animate-spin" /></div>;
  }

  if (!settings) {
      return (
          <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center">
              <p className="mb-4">Veuillez configurer vos paramètres (Revenu, Frais fixes) pour voir le diagramme.</p>
              <button onClick={() => router.push('/settings')} className="text-amber-500 underline">Aller aux paramètres</button>
          </div>
      )
  }

  // --- Sankey Data Construction ---
  // Nodes: 0=Revenu, 1=Epargne, 2=Frais Fixes, 3...=Enveloppes
  const nodes = [
      { name: "Revenu", color: "#10b981" }, // Emerald 500
      { name: "Épargne", color: "#3b82f6" }, // Blue 500
      { name: "Frais Fixes", color: "#ef4444" }, // Red 500
      ...envelopes.map(e => ({ 
          name: e.name, 
        color: resolveColor(e.color)
      }))
  ];

  const links = [];
  
  // Link: Revenu -> Epargne
  if (settings.monthlySavings > 0) {
      links.push({ source: 0, target: 1, value: settings.monthlySavings });
  }

  // Link: Revenu -> Frais Fixes
  if (settings.fixedCosts > 0) {
      links.push({ source: 0, target: 2, value: settings.fixedCosts });
  }

  // Links: Revenu -> Envelopes
  envelopes.forEach((env, index) => {
      if (env.budget > 0) {
          // Target index starts at 3
          links.push({ source: 0, target: 3 + index, value: env.budget });
      }
  });

  // Calculate Unallocated
  const totalAllocated = (settings.monthlySavings || 0) + (settings.fixedCosts || 0) + envelopes.reduce((acc, curr) => acc + curr.budget, 0);
  const unallocated = settings.monthlyIncome - totalAllocated;

  if (unallocated > 0) {
      nodes.push({ name: "Reste", color: "#71717a" }); // Zinc 500
      links.push({ source: 0, target: nodes.length - 1, value: unallocated });
  }

  const data = { nodes, links };


  // Custom Node Component
  const MyCustomNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
      const isOut = x + width + 6 > containerWidth;
      // Define color styles based on payload color (user defined or default)
      const color = payload.color || "#8884d8";
      
      return (
        <Layer key={`CustomNode${index}`}>
          {/* Main Node Rectangle */}
          <Rectangle 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            fill={color} 
            fillOpacity="1" 
            radius={[4, 4, 4, 4]} 
          />
          
          {/* External Label */}
           <text
            x={isOut ? x - 6 : x + width + 6}
            y={y + height / 2 - 6} // Adjusted for tighter grouping
            textAnchor={isOut ? 'end' : 'start'}
            alignmentBaseline="middle"
            fill={color} // Use the node color for the text as well
            fontSize="12"
            fontWeight="bold"
            style={{ textShadow: "0px 0px 10px rgba(0,0,0,0.5)" }}
          >
            {payload.name}
          </text>
           <text
            x={isOut ? x - 6 : x + width + 6}
            y={y + height / 2 + 8} // Adjusted for tighter grouping
            textAnchor={isOut ? 'end' : 'start'}
            alignmentBaseline="middle"
            fill="#a1a1aa" // zinc-400
            fontSize="10"
          >
            {payload.value?.toFixed(0)} €
          </text>
        </Layer>
      );
    };

  const MyCustomLink = (props: any) => {
    const {
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourceControlX,
      targetControlX,
      linkWidth,
      payload
    } = props;

    const strokeColor = payload?.target?.color || payload?.target?.payload?.color || "#3f3f46";
    const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;

    return (
      <path
        d={d}
        stroke={strokeColor}
        strokeOpacity={0.35}
        strokeWidth={Math.max(1, linkWidth)}
        fill="none"
      />
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <header className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="text-emerald-500" />
            Cash Flow
        </h1>
      </header>
      
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-2 sm:p-6 h-[75vh] w-full overflow-hidden flex flex-col">
         {settings.monthlyIncome > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
                <Sankey
                    data={data}
                    node={<MyCustomNode />}
                    nodePadding={20}
                  link={<MyCustomLink />}
                    margin={{
                        left: 20,
                        right: 120, // Space for labels
                        top: 20,
                        bottom: 20,
                    }}
                >
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: any, name: any, props: any) => {
                             if (props && props.payload && props.payload.target && props.payload.source) {
                                 return [`${value} €`, `${props.payload.source.name} → ${props.payload.target.name}`];
                             }
                             return [`${value} €`, name];
                        }}
                    />
                </Sankey>
             </ResponsiveContainer>
         ) : (
             <div className="flex h-full items-center justify-center text-zinc-500">
                 Aucun revenu configuré.
             </div>
         )}
      </div>

       {/* Legend / Summary */}
       <div className="mt-8 grid grid-cols-2 gap-4 text-center">
             <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                 <span className="block text-zinc-400 text-xs uppercase mb-1">Revenu Total</span>
                 <span className="text-2xl font-bold text-emerald-400">{settings.monthlyIncome} €</span>
             </div>
             <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                 <span className="block text-zinc-400 text-xs uppercase mb-1">Total Alloué</span>
                 <span className="text-2xl font-bold text-amber-500">{totalAllocated} €</span>
             </div>
       </div>

    </div>
  );
}
