"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { usePathname } from "next/navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkOnboarding = async () => {
      if (user) {
        // Vérifier si l'utilisateur a déjà fait l'onboarding
        try {
          const settingsRef = doc(db, "users", user.uid, "settings", "general");
          const settingsSnap = await getDoc(settingsRef);

          if (settingsSnap.exists() && settingsSnap.data().isOnboarded) {
            // Si déjà onboardé et tente d'aller sur /onboarding -> redir vers dashboard
            if (pathname === "/onboarding") {
               router.push("/dashboard");
            }
          } else {
            // Si PAS onboardé -> redir vers onboarding (sauf si déjà dessus)
            if (pathname !== "/onboarding") {
              router.push("/onboarding");
            }
          }
        } catch (error) {
          // Ignorer les erreurs de permission ici pour éviter de spammer la console si le profile n'est pas encore prêt
          // console.warn("Onboarding check skipped:", error);
        }
      }
    };

    if (!loading) {
        if (!user) {
            router.push("/login");
        } else {
            checkOnboarding();
        }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
