const fs = require('fs');
const path = require('path');
const { loadEnvFiles } = require('./load-env');

// Charger les variables d'environnement - priorité à .env.local
loadEnvFiles('.env.local', '.env');

const swTemplate = `// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}",
  authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// v1.1 - Fix duplicate notifications
// Note: If the payload has a 'notification' property, Firebase SDK automatically
// handles directly displaying the notification.

// We only need this if we want to handle data-only messages.
// OR customize the behavior (but that often leads to duplicates if not careful).

// messaging.onBackgroundMessage((payload) => {
//   console.log('[firebase-messaging-sw.js] Received background message ', payload);
//   // Customize notification here
//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: '/icon.png'
//   };
//
//   self.registration.showNotification(notificationTitle, notificationOptions);
// });
`;

const swPath = path.join(__dirname, '../public/firebase-messaging-sw.js');

try {
  fs.writeFileSync(swPath, swTemplate, 'utf-8');
  console.log('✅ Service Worker généré avec succès:', swPath);
} catch (error) {
  console.error('❌ Erreur lors de la génération du Service Worker:', error);
  process.exit(1);
}
