# BudgetFlow — Comparatif Web vs iOS

> Généré le 8 mars 2026 — Parité globale : ~80%

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
| Thème sombre | ✅ | ✅ |

---

## Ce que le Web a en plus (absent sur iOS)

| Fonctionnalité | Détail |
|---|---|
| **Authentification** | Login email/mot de passe + OAuth Google (Firebase Auth) |
| **Cloud sync** | Données stockées sur Firestore — accessibles partout |
| **Push notifications** | Firebase Cloud Messaging, déclenchement cron automatique |
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
| **Accessibilité** | Labels VoiceOver sur les éléments interactifs |

---

## Architecture

| | Web | iOS |
|---|---|---|
| **Framework** | Next.js (React) | SwiftUI |
| **Stockage** | Firestore (cloud) | SwiftData (local) |
| **Auth** | Firebase Auth | ⚠️ Absent (W.I.P.) |
| **Charts** | Recharts | Apple Charts |
| **Icônes** | Lucide React | SF Symbols |
| **Styling** | Tailwind CSS | SwiftUI modifiers |
| **Notifications** | Firebase Cloud Messaging | ❌ Non disponible |
| **Offline** | Browser cache + service worker | ✅ Natif (offline-first) |
| **Synchro multi-plateforme** | ✅ Oui | ❌ Non |

---

## Point de friction principal

Les deux apps **ne partagent pas leurs données** — l'iOS est entièrement local (SwiftData), sans lien avec le backend Firebase du Web. Un utilisateur qui saisit des transactions sur iOS ne les verra pas sur le Web, et vice versa.
