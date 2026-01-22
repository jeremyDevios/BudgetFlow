import { useState, useEffect } from "react";
import { messaging } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Écoute des messages au premier plan (Foreground)
  useEffect(() => {
      if (typeof window !== 'undefined' && permission === 'granted' && messaging) {
          const unsubscribe = onMessage(messaging, (payload) => {
              console.log("Message reçu au premier plan : ", payload);
              // Optionnel : Afficher un toast ou une notification UI custom
              // Sinon, déclencher manuellement une notif système
              if (payload.notification) {
                  new Notification(payload.notification.title || "Notification", {
                      body: payload.notification.body,
                      icon: '/icon.png'
                  });
              }
          });
          return () => unsubscribe();
      }
  }, [permission]);

  const requestPermission = async () => {
    if (!messaging || !user) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "granted") {
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY // Nécessaire de générer une paire de clés dans la console Firebase
        });
        setFcmToken(token);
        
        // Sauvegarder le token dans Firestore
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
            fcmToken: token,
            notificationsEnabled: true,
            lastTokenUpdate: new Date().toISOString()
        }, { merge: true });
        
        console.log("Notification Token:", token);
      }
    } catch (error) {
      console.error("Erreur lors de la demande de permission push:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (permission === 'granted') {
          // Si déjà activé, on demande de désactiver
          // On ne peut pas "révoquer" la permission navigateur par code, 
          // mais on peut supprimer le token ou mettre un flag en base.
          // Ici on va juste basculer un flag dans Firestore.
          
          // Vérifier l'état actuel (si on avait stocké un state local, ce serait mieux, mais pour l'instant on suppose qu'on veut désactiver)
          // Idéalement il faudrait lire le doc user pour savoir si c'est true ou false, 
          // ou gérer un state local `enabled` synchronisé avec la DB.
          // Pour faire simple : Si permission granted, on considère que le bouton sert à désactiver/réactiver le flag
          
          // Cependant, l'UX standard : 
          // 1. Bouton "Activer" -> Demande permission + Save Token
          // 2. Bouton "Désactiver" -> Update Firestore { notificationsEnabled: false }
          
          // Pour simplifier l'usage dans le composant, on va exposer une méthode explicite disable et enable
      }
    } catch (e) {
        console.error(e);
    }
  }
  
  const disableNotifications = async () => {
      if (!user) return;
      setLoading(true);
      try {
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
              notificationsEnabled: false
          }, { merge: true });
          // On ne change pas 'permission' car c'est celle du navigateur
      } catch (error) {
          console.error("Erreur désactivation:", error);
      } finally {
          setLoading(false);
      }
  };

  return { permission, requestPermission, disableNotifications, loading, fcmToken };
}
