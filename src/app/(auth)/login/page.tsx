"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { validateEmail } from "@/lib/validation";
import { logger } from "@/lib/logger";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const router = useRouter();

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      // Assurer que le document utilisateur existe
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLogin: new Date().toISOString()
      }, { merge: true });
      
      // Initialiser les settings si nécessaire (ne pas écraser s'ils existent)
      await setDoc(doc(db, "users", user.uid, "settings", "general"), {
          // On met juste un champ dummy pour s'assurer que le doc existe, 
          // sans écraser les vrais settings s'ils sont là (merge: true)
          updatedAt: new Date().toISOString()
      }, { merge: true });

      router.push("/dashboard");
    } catch (err: any) {
      logger.sanitizedError("Google authentication error", err);
      setError("Erreur lors de la connexion avec Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin) {
      setError("L'inscription est disponible uniquement via Google.");
      return;
    }

    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / (60 * 1000));
      setError(`Trop de tentatives. Reessayez dans ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}.`);
      return;
    }

    // Validation côté client
    if (!validateEmail(email)) {
      setError("Email invalide.");
      return;
    }

    setLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Assurer que le document utilisateur existe
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          lastLogin: new Date().toISOString()
      }, { merge: true });
      
      // Initialiser les settings par défaut (surtout important pour la création de compte)
      // Utilisation de merge: true pour éviter d'écraser si le compte existait déjà (cas Login)
      await setDoc(doc(db, "users", user.uid, "settings", "general"), {
           // Valeurs par défaut uniquement si le doc est créé ?
           // Avec merge: true, ça ajoute/écrase ces champs. On veut éviter d'écraser isOnboarded si existe.
           // Firestore ne permet pas "create if missing" atomique simple sans transaction ou read.
           // Mais pour un MVP, on peut supposer que login = merge simple, signup = defaults.
           updatedAt: new Date().toISOString()
      }, { merge: true });

      setLoginAttempts(0);
      setLockoutUntil(null);

      router.push("/dashboard");
    } catch (err: any) {
      logger.sanitizedError("Authentication error", err);
      const nextAttempts = loginAttempts + 1;
      if (nextAttempts >= 5) {
        setLockoutUntil(Date.now() + 5 * 60 * 1000);
        setLoginAttempts(0);
        setError("Trop de tentatives. Reessayez dans 5 minutes.");
        return;
      }

      setLoginAttempts(nextAttempts);

      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
         setError("Email ou mot de passe incorrect.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Cet email est déjà utilisé.");
      } else if (err.code === "auth/weak-password") {
        setError("Le mot de passe doit contenir au moins 8 caracteres, avec majuscule, minuscule et chiffre.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Erreur de connexion réseau. Vérifiez votre connexion internet ou les paramètres de votre pare-feu.");
      } else {
        setError("Une erreur est survenue. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-app-surface p-8 shadow-xl border border-app-border">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-app-text">BudgetFlow</h1>
          <p className="mt-2 text-sm text-app-text-secondary">
            {isLogin
              ? "Bon retour parmi nous"
              : "Inscription via Google uniquement"}
          </p>
        </div>

        {isLogin && (
          <form onSubmit={handleAuth} className="mt-8 space-y-6" aria-label="Formulaire de connexion">
            <div className="space-y-4">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-app-text-secondary" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  aria-label="Adresse email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-app-border bg-app-surface py-3 pl-10 text-app-text placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:text-sm"
                  placeholder="Ex: jeremy@exemple.com"
                />
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-app-text-secondary" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  aria-label="Mot de passe"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-app-border bg-app-surface py-3 pl-10 text-app-text placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:text-sm"
                  placeholder="Mot de passe"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-900/50 p-3 text-sm text-red-200 border border-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-app-text transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Se connecter
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <ArrowRight className="h-5 w-5 text-app-text/50 group-hover:text-app-text" />
                  </span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-app-border"></div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-app-border bg-app-surface px-4 py-3 text-sm font-medium text-app-text transition-colors hover:bg-app-surface focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isLogin ? "Continuer avec Google" : "S'inscrire avec Google"}
        </button>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-sm font-medium text-amber-500 hover:text-amber-400"
          >
            {isLogin
              ? "Pas encore de compte ? Inscription Google uniquement"
              : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
