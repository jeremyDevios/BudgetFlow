# BudgetFlow — Comparatif Web vs iOS

> Mis à jour le 13 juillet 2026 — Parité globale : ~97%

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
| Sélection icône + couleur | ✅ 20+ icônes | ✅ 15+ icônes |
| Onboarding | ✅ 2 étapes | ✅ 3 étapes |
| Détail enveloppe | ✅ | ✅ |
| Paramètres (revenus, charges fixes, épargne) | ✅ | ✅ |
| Revenu variable par mois (`isFixedIncome` + `monthlyIncomes`) | ✅ | ✅ |
| Décomposition détaillée charges fixes / épargne | ✅ | ✅ |
| Support multi-devises (EUR, USD, CHF, GBP, BTC) | ✅ | ✅ |
| Thème sombre / clair (adaptatif) | ✅ | ✅ |
| Bordures colorées sur les enveloppes | ✅ | ✅ |
| Solde restant dans la modal transaction | ✅ | ✅ |
| Parcours Fidélité (Heatmap & Streaks) | ✅ | ✅ |
| Tuile unifiée Dashboard (Reste disponible + Heatmap) | ✅ | ✅ |
| Prévisions dépenses à 90 jours | ✅ | ✅ |
| Détection dépenses exceptionnelles | ✅ | ✅ |
| Carousel de notifications intelligentes | ✅ | ✅ |
| Mode Anonyme (floutage des montants) | ✅ Toggle navbar | ✅ Shake-to-toggle + Settings |
| Système de Feedback (feature requests, bugs) | ✅ API + UI | ✅ `FeedbackService` + vues |
| Bento Grid layout configurable | ✅ `tileSize` + `bentoPreset` | ✅ `BentoLayoutEngine` |
| Suppression de compte avec effacement Firebase | ✅ | ✅ |
| Tests unitaires | ✅ Jest (27 suites) | ✅ XCTest (49 fichiers) |
| Tests E2E | ✅ Playwright (9 suites · 58 tests) | ❌ Non disponible |

---

## Ce que le Web a en plus (absent sur iOS)

| Fonctionnalité | Détail |
|---|---|
| **Push notifications FCM** | Firebase Cloud Messaging, déclenchement cron automatique |
| **Validation serveur** | Endpoint API `/api/validate/transaction` |
| **PWA** | Service worker pour une expérience app-like dans le navigateur |
| **Recherche globale** | Barre de recherche dans la navbar (top 6 résultats, accent-insensible) |
| **Tests E2E Playwright** | 58 tests automatisés sur 9 pages |

---

## Ce que l'iOS a en plus (absent sur Web)

| Fonctionnalité | Détail |
|---|---|
| **Offline-first** | SwiftData local, fonctionne sans réseau |
| **12 mois d'historique** | Évolution sur 12 mois vs 6 sur le web |
| **Gestures natives** | Swipe-to-delete, drag-and-drop natifs |
| **Retours haptiques** | `HapticsManager.swift` — vibrations à la confirmation et en cas d'alerte |
| **Barre de progression** | Affichée sur le détail d'enveloppe |
| **Warnings budgétaires** | Mise en rouge en temps réel si le budget est dépassé |
| **Notifications locales** | Rappels hebdomadaires programmés via `NotificationService` |
| **Widget WidgetKit** | Solde disponible + enveloppe la plus dépensée sur l'écran d'accueil |
| **App compagnon Apple Watch** | Consultation rapide + quick-add relay via `WatchConnectivityManager` |
| **Localisation FR/EN** | `Localization.swift` — sélection de langue dans les paramètres |
| **Accessibilité** | Labels VoiceOver, Dynamic Type, reduceMotion sur tous les éléments interactifs |
| **Export PDF** | `PDFExportService.swift` — rapport mensuel des transactions et enveloppes |
| **Demande d'avis in-app** | `StoreKitManager` + `AppReviewManager` — déclenché après 3 transactions |
| **Toasts natifs** | `ToastManager` + `DynamicIslandToastView` |
| **FAB animé** | Bouton flottant avec animation pulse pour saisie rapide |

---

## Architecture

| | Web | iOS |
|---|---|---|
| **Framework** | Next.js 16 (React) | SwiftUI |
| **Stockage** | Firestore (cloud) | SwiftData (local, offline-first) |
| **Auth** | Firebase Auth (Google + Apple + email) | ✅ Firebase Auth via `FirebaseManager` + `AuthView` |
| **Charts** | Recharts | Swift Charts (natif) |
| **Icônes** | Lucide React | SF Symbols |
| **Styling** | Tailwind CSS (tokens adaptatifs) | DesignSystem.swift (UIColor adaptatif) |
| **Bento Layout** | CSS Grid + `tileSize` + `bentoPreset` | `BentoLayoutEngine.swift` |
| **Notifications** | Firebase Cloud Messaging | Notifications locales (UNUserNotificationCenter) |
| **Export** | — | PDFKit natif |
| **Avis in-app** | — | StoreKit (`SKStoreReviewController`) |
| **Offline** | Browser cache + service worker | ✅ Natif (offline-first) |
| **Synchro multi-plateforme** | ✅ Oui | ✅ Disponible en mode en ligne (`SyncService`) |
| **Tests unitaires** | Jest + @testing-library/react (27 suites) | XCTest (49 fichiers) |
| **Tests E2E** | Playwright (Chromium, 58 tests) | Non disponible |

---

## Synchronisation Web ↔ iOS

L'iOS fonctionne en **deux modes** :
- **Mode local** (par défaut) : données stockées uniquement dans SwiftData, aucune connexion requise
- **Mode en ligne** : `SyncService.swift` synchronise avec Firestore — les données sont alors partagées avec la Web App

En mode local, les données d'un utilisateur iOS ne sont pas visibles sur le Web, et vice versa. En mode en ligne, la parité des données est assurée via le schéma Firestore partagé.
