# BudgetFlow — Comparatif Web vs iOS

> Mis à jour le 13 mars 2026 — Parité globale : ~90%

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
| Sélection icône + couleur | ✅ 20 icônes | ✅ 15 icônes |
| Onboarding | ✅ 2 étapes | ✅ 3 étapes |
| Détail enveloppe | ✅ | ✅ |
| Paramètres (revenus, charges fixes, épargne) | ✅ | ✅ |
| Thème sombre / clair (adaptatif) | ✅ | ✅ |
| Bordures colorées sur les enveloppes | ✅ | ✅ |
| Solde restant dans la modal transaction | ✅ | ✅ |
| Tests unitaires | ✅ Jest | ✅ XCTest |

---

## Ce que le Web a en plus (absent sur iOS)

| Fonctionnalité | Détail |
|---|---|
| **Authentification cloud** | Login email/mot de passe + OAuth Google (Firebase Auth) — iOS en cours |
| **Push notifications FCM** | Firebase Cloud Messaging, déclenchement cron automatique |
| **Validation serveur** | Endpoint API `/api/validate/transaction` |
| **PWA** | Service worker pour une expérience app-like dans le navigateur |

---

## Ce que l'iOS a en plus (absent sur Web)

| Fonctionnalité | Détail |
|---|---|
| **Offline-first** | SwiftData local, fonctionne sans réseau |
| **12 mois d'historique** | Évolution sur 12 mois vs 6 sur le web |
| **Gestures natives** | Swipe-to-delete, drag-and-drop, retours haptiques |
| **Barre de progression** | Affichée sur le détail d'enveloppe |
| **Warnings budgétaires** | Mise en rouge en temps réel si le budget est dépassé |
| **Notifications locales** | Rappels hebdomadaires programmés via `NotificationService` |
| **Accessibilité** | Labels VoiceOver sur les éléments interactifs |

---

## Architecture

| | Web | iOS |
|---|---|---|
| **Framework** | Next.js 16 (React) | SwiftUI |
| **Stockage** | Firestore (cloud) | SwiftData (local, offline-first) |
| **Auth** | Firebase Auth | ⚠️ En cours (AuthView + FirebaseManager) |
| **Charts** | Recharts | Apple Charts |
| **Icônes** | Lucide React | SF Symbols |
| **Styling** | Tailwind CSS (tokens adaptatifs) | DesignSystem.swift (UIColor adaptatif) |
| **Notifications** | Firebase Cloud Messaging | Notifications locales (UNUserNotificationCenter) |
| **Offline** | Browser cache + service worker | ✅ Natif (offline-first) |
| **Synchro multi-plateforme** | ✅ Oui | ⚠️ Disponible en mode en ligne (SyncService) |
| **Tests** | Jest + @testing-library | XCTest |

---

## Synchronisation Web ↔ iOS

L'iOS fonctionne en **deux modes** :
- **Mode local** (par défaut) : données stockées uniquement dans SwiftData, aucune connexion requise
- **Mode en ligne** : `SyncService.swift` synchronise avec Firestore — les données sont alors partagées avec la Web App

En mode local, les données d'un utilisateur iOS ne sont pas visibles sur le Web, et vice versa. En mode en ligne, la parité des données est assurée via le schéma Firestore partagé.
