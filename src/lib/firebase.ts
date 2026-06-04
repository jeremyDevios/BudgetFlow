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

/** Create a lazy proxy that delegates all operations (including
 *  instanceof) to the real instance, initializing on first access. */
function lazyProxy<T>(
  key: { current: T | null },
  factory: () => T,
): T {
  return new Proxy(
    // Use a function target so `instanceof` walks up to the real
    // instance via getPrototypeOf, not Object.prototype.
    function () {} as unknown as T,
    {
      get(_, prop, receiver) {
        let inst = key.current;
        if (!inst) {
          inst = factory();
          key.current = inst;
        }
        return Reflect.get(inst as object, prop, inst as object);
      },
      getPrototypeOf() {
        let inst = key.current;
        if (!inst) {
          inst = factory();
          key.current = inst;
        }
        return Object.getPrototypeOf(inst);
      },
      set(_, prop, value) {
        let inst = key.current;
        if (!inst) {
          inst = factory();
          key.current = inst;
        }
        return Reflect.set(inst as object, prop, value, inst as object);
      },
    } as ProxyHandler<object>,
  ) as T;
}

// ── Lazy exports ──────────────────────────────────────────────────
const _appRef = { current: _app };
const _authRef = { current: _auth };
const _dbRef = { current: _db };
const _messagingRef = { current: _messaging };

export const app: FirebaseApp = lazyProxy(_appRef, () => getOrInitApp());

export const auth: Auth = lazyProxy(_authRef, () => {
  const a = getOrInitApp();
  return getAuth(a);
});

export const db: Firestore = lazyProxy(_dbRef, () => {
  const a = getOrInitApp();
  return getFirestore(a);
});

export const messaging: any = lazyProxy(_messagingRef, () => {
  if (typeof window === "undefined") {
    // On SSR return a stub — messaging is browser-only.
    return { getToken: () => Promise.resolve(null) } as any;
  }
  return getMessaging(getOrInitApp());
});
