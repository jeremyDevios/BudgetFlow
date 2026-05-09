# BudgetFlow — Comparatif Web vs iOS

> Mis à jour le 9 mai 2026 — Parité globale : ~95%

Les deux apps partagent le même workflow de base (enveloppes budgétaires, suivi des dépenses, visualisations). Les différences sont surtout architecturales et sur quelques fonctionnalités périphériques.

---

## Fonctionnalités communes

| Fonctionnalité | Web | iOS |
|---|---|---|
| Dashboard + enveloppes | ✅ | ✅ |
| Transactions (créer / éditer / supprimer) | ✅ | ✅ |
| Historique groupé par mois | ✅ | ✅ |
| Navigation mois précédent/suivant | ✅ | ✅ |
| Graphique Évolution (balance) | ✅ 6 mois | ✅ 12 mois |
| Diagramme Cash Flow (Sankey) | ✅ | ✅ |
| Gestion des enveloppes (CRUD + réordonnancement) | ✅ | ✅ |
| Enveloppes temporaires (`isTemporary` + `activeMonths`) | ✅ | ✅ |
| Sélection icône + couleur | ✅ 20 icônes | ✅ 15 icônes |
| Onboarding | ✅ 2 étapes | ✅ 3 étapes |
| Détail enveloppe | ✅ | ✅ |
| Paramètres (revenus, charges fixes, épargne) | ✅ | ✅ |
| Thème sombre / clair (adaptatif) | ✅ | ✅ |
| Bordures colorées sur les enveloppes | ✅ | ✅ |
| Solde restant dans la modal transaction | ✅ | ✅ |
| Parcours Fidélité (Heatmap & Streaks) | ✅ | ✅ |
| Tuile unifiée Dashboard (Reste disponible + Heatmap) | ✅ | ✅ |
| Prévisions dépenses à 90 jours | ✅ | ✅ |
| Détection dépenses exceptionnelles | ✅ | ✅ |
| Tests unitaires | ✅ Jest (16 suites · 200 tests) | ✅ XCTest (25 fichiers) |

---

## Ce que le Web a en plus (absent sur iOS)

| Fonctionnalité | Détail |
|---|---|
| **Push notifications FCM** | Firebase Cloud Messaging, déclenchement cron automatique |
| **Validation serveur** | Endpoint API `/api/validate/transaction` |
| **PWA** | Service worker pour une expérience app-like dans le navigateur |
| **Bento Grid configurable** | `tileSize` par enveloppe (`small` / `wide`) avec présets |

---

## Ce que l'iOS a en plus (absent sur Web)

| Fonctionnalité | Détail |
|---|---|
| **Offline-first** | SwiftData local, fonctionne sans réseau |
| **12 mois d'historique** | Évolution sur 12 mois vs 6 sur le web |
| **Gestures natives** | Swipe-to-delete, drag-and-drop |
| **Retours haptiques** | `HapticsManager.swift` — vibrations à la confirmation et en cas d'alerte |
| **Barre de progression** | Affichée sur le détail d'enveloppe |
| **Warnings budgétaires** | Mise en rouge en temps réel si le budget est dépassé |
| **Notifications locales** | Rappels hebdomadaires programmés via `NotificationService` |
| **Widget WidgetKit** | Solde disponible + enveloppe la plus dépensée sur l'écran d'accueil |
| **App compagnon Apple Watch** | Consultation rapide + quick-add relay via `WatchConnectivityManager` |
| **Localisation FR/EN** | `Localization.swift` — sélection de langue dans les paramètres |
| **Accessibilité** | Labels VoiceOver sur les éléments interactifs |

---

## Architecture

| | Web | iOS |
|---|---|---|
| **Framework** | Next.js 16 (React) | SwiftUI |
| **Stockage** | Firestore (cloud) | SwiftData (local, offline-first) |
| **Auth** | Firebase Auth (Google + email) | ✅ Firebase Auth via `FirebaseManager` + `AuthView` |
| **Charts** | Recharts | Apple Charts |
| **Icônes** | Lucide React | SF Symbols |
| **Styling** | Tailwind CSS (tokens adaptatifs) | DesignSystem.swift (UIColor adaptatif) |
| **Notifications** | Firebase Cloud Messaging | Notifications locales (UNUserNotificationCenter) |
| **Offline** | Browser cache + service worker | ✅ Natif (offline-first) |
| **Synchro multi-plateforme** | ✅ Oui | ✅ Disponible en mode en ligne (`SyncService`) |
| **Tests** | Jest + @testing-library/react | XCTest |

---

## Synchronisation Web ↔ iOS

L'iOS fonctionne en **deux modes** :
- **Mode local** (par défaut) : données stockées uniquement dans SwiftData, aucune connexion requise
- **Mode en ligne** : `SyncService.swift` synchronise avec Firestore — les données sont alors partagées avec la Web App

En mode local, les données d'un utilisateur iOS ne sont pas visibles sur le Web, et vice versa. En mode en ligne, la parité des données est assurée via le schéma Firestore partagé.
