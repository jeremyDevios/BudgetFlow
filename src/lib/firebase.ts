import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

// ── Lazy Firebase initialization ──────────────────────────────────
// Firebase is NOT initialized at module evaluation time.
// This prevents build-time crashes when NEXT_PUBLIC_FIREBASE_* env
// vars are not set (e.g. during Docker builds or SSR prerendering).

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _messaging: any = null;

function getOrInitApp(): FirebaseApp {
  if (_app) return _app;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  _app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return _app;
}

// Lazy getters that only init Firebase when actually accessed.
export const app: FirebaseApp = new Proxy({} as FirebaseApp, {
  get(_, prop) { return (getOrInitApp() as any)[prop]; },
});

export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) _auth = getAuth(getOrInitApp());
    return (_auth as any)[prop];
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_db) _db = getFirestore(getOrInitApp());
    return (_db as any)[prop];
  },
});

export const messaging: any = new Proxy({} as any, {
  get(_, prop) {
    if (typeof window === "undefined") return undefined;
    if (!_messaging) {
      // isSupported is async; try sync init for the common case
      _messaging = getMessaging(getOrInitApp());
    }
    return _messaging?.[prop as string | symbol];
  },
});
