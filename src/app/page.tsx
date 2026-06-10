"use client";

import Link from "next/link";
import { 
  ArrowRight, 
  Loader2, 
  Dog, 
  Utensils, 
  ShoppingBag, 
  Car, 
  Music, 
  Coffee, 
  Plane,
  Gamepad2,
  Gift,
  Home as HomeIcon,
  Droplets,
  Zap,
  Shirt,
  Flower2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCurrencySymbol, DEFAULT_CURRENCY } from "@/types/currency";

export default function Home() {
  const symbol = getCurrencySymbol(DEFAULT_CURRENCY);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </main>
    );
  }

  // Configuration des bulles flottantes
  const bubbles = [
    // Premier plan (légèrement flou)
    { 
      icon: Dog, 
      label: "Vétérinaire", 
      price: `-49${symbol}`, 
      color: "bg-purple-500", 
      position: "top-[15%] left-[5%] md:left-[15%]", 
      rotate: "-rotate-6",
      delay: "0s",
      duration: "5s",
      blur: "backdrop-blur-sm blur-[1px]" 
    },
    { 
      icon: Utensils, 
      label: "Macdo", 
      price: `-18${symbol}`, 
      color: "bg-yellow-500 text-black", 
      position: "top-[25%] right-[5%] md:right-[15%]", 
      rotate: "rotate-12",
      delay: "1s",
      duration: "6s",
      blur: "backdrop-blur-sm blur-[1px]"
    },
    { 
      icon: ShoppingBag, 
      label: "Shopping", 
      price: `-89${symbol}`, 
      color: "bg-orange-500", 
      position: "bottom-[30%] left-[5%] md:left-[10%]", 
      rotate: "-rotate-12",
      delay: "2s",
      duration: "7s",
      blur: "backdrop-blur-sm blur-[1px]"
    },
    { 
      icon: Coffee, 
      label: "Café", 
      price: `-4.50${symbol}`, 
      color: "bg-emerald-500", 
      position: "bottom-[20%] right-[10%] md:right-[20%]", 
      rotate: "rotate-6",
      delay: "0.5s",
      duration: "5.5s",
      blur: "backdrop-blur-sm blur-[0.5px]"
    },
    // Nouvelles bulles pour enrichir le fond (Plan intermédiaire)
    { 
        icon: Plane, 
        label: "Séville", 
        price: `-120${symbol}`, 
        color: "bg-sky-500", 
        position: "top-[10%] right-[30%]", 
        rotate: "rotate-3",
        delay: "4s",
        duration: "8s",
        blur: "blur-[2px] opacity-80"
      },
      { 
        icon: Gift, 
        label: "Anniv", 
        price: `-35${symbol}`, 
        color: "bg-red-500", 
        position: "bottom-[15%] left-[30%]", 
        rotate: "-rotate-3",
        delay: "2.5s",
        duration: "6.5s",
        blur: "blur-[1.5px] opacity-90"
      },
    // Arrière plan (très flou)
    { 
      icon: Car, 
      label: "", 
      price: "", 
      color: "bg-blue-600/30", 
      position: "top-[40%] left-[30%]", 
      rotate: "rotate-45",
      delay: "3s",
      duration: "8s",
      blur: "blur-sm scale-75 opacity-50"
    },
    { 
      icon: Gamepad2, 
      label: "", 
      price: "", 
      color: "bg-pink-600/30", 
      position: "bottom-[40%] right-[35%]", 
      rotate: "-rotate-12",
      delay: "1.5s",
      duration: "9s",
      blur: "blur-md scale-50 opacity-50"
    },
    { 
        icon: HomeIcon, 
        label: "", 
        price: "", 
        color: "bg-indigo-600/30", 
        position: "top-[60%] right-[10%]", 
        rotate: "rotate-12",
        delay: "5s",
        duration: "10s",
        blur: "blur-md scale-90 opacity-40"
    },
    { 
        icon: Flower2, 
        label: "", 
        price: "", 
        color: "bg-rose-600/30", 
        position: "top-[20%] left-[40%]", 
        rotate: "-rotate-45",
        delay: "2s",
        duration: "12s",
        blur: "blur-lg scale-110 opacity-30"
    },
    { 
        icon: Shirt, 
        label: "", 
        price: "", 
        color: "bg-teal-600/30", 
        position: "bottom-[50%] left-[0%]", 
        rotate: "rotate-90",
        delay: "1s",
        duration: "15s",
        blur: "blur-xl scale-125 opacity-20"
    }
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white p-4 overflow-hidden selection:bg-amber-500/30">
        
      {/* Background Bubbles Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         {bubbles.map((bubble, i) => (
             <div 
                key={i}
                className={`absolute flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10 ${bubble.position} ${bubble.rotate} ${bubble.blur || ''} animate-float`}
                style={{ 
                    backgroundColor: bubble.blur ? 'transparent' : 'rgba(24, 24, 27, 0.4)',
                    animationDuration: bubble.duration,
                    animationDelay: bubble.delay
                }}
             >
                 <div className={`p-2 rounded-xl ${bubble.color} ${bubble.color.includes('text-black') ? 'text-black' : 'text-white'}`}>
                     <bubble.icon className="w-5 h-5" />
                 </div>
                 {bubble.label && (
                    <div className="flex flex-col">
                        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{bubble.label}</span>
                        <span className="text-lg font-bold text-white leading-none">{bubble.price}</span>
                    </div>
                 )}
             </div>
         ))}
      </div>

      {/* Background Progress Bar (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-48 z-0 pointer-events-none opacity-40 blur-2xl select-none">
          <div className="absolute inset-x-0 bottom-[-50px] flex h-24 gap-1 animate-pulse" style={{ animationDuration: '4s' }}>
              <div className="w-[30%] h-full bg-purple-600 rounded-t-full opacity-60"></div>
              <div className="w-[15%] h-full bg-yellow-500 rounded-t-full opacity-60"></div>
              <div className="w-[20%] h-full bg-orange-500 rounded-t-full opacity-60"></div>
              <div className="w-[10%] h-full bg-blue-500 rounded-t-full opacity-60"></div>
              <div className="w-[25%] h-full bg-emerald-500 rounded-t-full opacity-60"></div>
          </div>
      </div>

      <div className="max-w-3xl text-center space-y-8 z-10 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Nouvelle version disponible
        </div>

        <h1 className="text-6xl font-extrabold tracking-tighter sm:text-8xl drop-shadow-2xl">
          Maîtrisez votre <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600">
             Budget
          </span>
        </h1>
        
        <p className="mt-6 text-xl leading-relaxed text-zinc-300 max-w-2xl mx-auto drop-shadow-lg bg-black/30 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
          La méthode des enveloppes, <span className="text-white font-semibold">revisitée</span>. 
          Calculez le montant idéal de vos enveloppes selon vos revenus, charges et objectifs d'épargne. Un budget sur-mesure pour maîtriser vos dépenses et réaliser vos rêves.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="group relative flex items-center justify-center gap-3 rounded-full bg-amber-500 px-8 py-4 text-lg font-bold text-white transition-all hover:bg-amber-400 hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)]"
          >
            Commencer
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(var(--tw-rotate)); }
          50% { transform: translateY(-20px) rotate(var(--tw-rotate)); }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>

    </main>
  );
}
