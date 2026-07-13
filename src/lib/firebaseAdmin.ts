import "server-only";
import * as admin from "firebase-admin";

function ensureInitialized() {
  if (admin.apps.length > 0) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // During build time, env vars may not be set.
    // The app will fail at request time with a clear error.
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return true;
}

// Lazy-initialized exports — init fires on first property access at runtime.
const _db = {
  _get(): admin.firestore.Firestore {
    ensureInitialized();
    return admin.firestore();
  },
  get collection() { return this._get().collection.bind(this._get()); },
  get doc() { return this._get().doc.bind(this._get()); },
  get recursiveDelete() { return this._get().recursiveDelete.bind(this._get()); },
  get runTransaction() { return this._get().runTransaction.bind(this._get()); },
  get batch() { return this._get().batch.bind(this._get()); },
};

const _auth = {
  _get(): admin.auth.Auth {
    ensureInitialized();
    return admin.auth();
  },
  get verifyIdToken() { return this._get().verifyIdToken.bind(this._get()); },
  get deleteUser() { return this._get().deleteUser.bind(this._get()); },
  get getUser() { return this._get().getUser.bind(this._get()); },
  get createCustomToken() { return this._get().createCustomToken.bind(this._get()); },
};

const _messaging = {
  _get(): admin.messaging.Messaging {
    ensureInitialized();
    return admin.messaging();
  },
  get send() { return this._get().send.bind(this._get()); },
};

export const adminDb = _db as unknown as admin.firestore.Firestore;
export const adminAuth = _auth as unknown as admin.auth.Auth;
export const adminMessaging = _messaging as unknown as admin.messaging.Messaging;
