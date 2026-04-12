# BudgetFlow

> Maîtrisez votre budget mensuel grâce à la méthode des enveloppes. Simple, visuel et efficace.

**BudgetFlow** est une application multi-plateforme (Web + iOS native) conçue pour vous aider à reprendre le contrôle de vos finances personnelles. Basée sur la **méthode des enveloppes virtuelles**, elle vous permet d'allouer un budget précis à chaque catégorie de dépense et de suivre votre consommation en temps réel.

## Fonctionnalités

- **Gestion par Enveloppes** : Créez des catégories personnalisées (Courses, Loisirs, Shopping, etc.) et allouez-y un budget mensuel.
- **Dashboard Visuel** :
  - Vue d'ensemble avec solde disponible.
  - Barres de progression par enveloppe avec indicateur de dépassement.
  - Solde restant affiché en temps réel lors de la saisie d'une dépense.
- **Thème clair / sombre** : Bascule adaptative sur Web et iOS, respectant les préférences système.
- **Mobile First** : Interface pensée pour l'usage quotidien sur smartphone.
- **Historique & Suivi** :
  - Historique global des transactions avec regroupement mensuel.
  - Vue détaillée par enveloppe.
  - Graphique d'évolution de l'épargne.
  - Diagramme Cash Flow (Sankey).
- **Configuration complète** :
  - Revenus, charges fixes, épargne cible.
  - Indicateurs d'équilibre budgétaire.
- **Parcours Fidélité (Gamification)** :
  - Grille heatmap d'activité (Transactions = orange, Connexions = jaune).
  - Badges jalons 7 jours, 14 jours et mois complet via un système SVG en anneau de points.
  - Tuile dashboard unifiée avec la carte "Reste disponible" (responsive, dégradés clair/sombre).
- **Tests unitaires** : Couverture ≥ 80 % sur la logique métier (Jest sur Web, XCTest sur iOS).

## Aperçu de l'interface

<p align="center">

### Mobile

#### iOS SwiftUI
  <img src="Screenshots/BudgetFow-iOS-Dark.png" width="1000" alt="BudgetFlow Mobile Dark" style="margin: 5px;" />
  <img src="Screenshots/BudgetFow-iOS-Ligth.png" width="1000" alt="BudgetFlow Mobile Ligth" style="margin: 5px;" />

#### iOS WebApp
  <img src="Screenshots/BudgetFlow.png" width="1000" alt="BudgetFlow Mobile Web" style="margin: 5px;" />

### Web
  <img src="Screenshots/HomePage.png" width="600" alt="Page d'accueil" style="margin: 5px;" />
  <img src="Screenshots/Dasboard-WebApp-Dark.png" width="600" alt="Dashboard" style="margin: 5px;" />
  <img src="Screenshots/Dashboard-WepApp-Light.png" width="600" alt="Dashboard" style="margin: 5px;" />
  <img src="Screenshots/EvolutionView-WebApp.png" width="600" alt="Évolution Économie" style="margin: 5px;" />
  <img src="Screenshots/CashFlowView.png" width="600" alt="Cash Flow" style="margin: 5px;" />
  <img src="Screenshots/HistoryView-WebApp.png" width="600" alt="Historique" style="margin: 5px;" />
  <img src="Screenshots/NewExpense-WebApp.png" width="600" alt="Nouvelle Dépense" style="margin: 5px;" />
</p>

## Stack Technique

### Web App

- **Framework** : [Next.js 16](https://nextjs.org/) (App Router)
- **Langage** : [TypeScript](https://www.typescriptlang.org/) (mode strict)
- **Styles** : [Tailwind CSS](https://tailwindcss.com/) avec tokens sémantiques adaptatifs (clair/sombre)
- **Backend as a Service** : [Firebase](https://firebase.google.com/)
  - **Authentication** : Email/Password & Google Auth
  - **Firestore** : Base de données NoSQL temps réel
  - **Cloud Messaging** : Notifications push
- **Icônes** : [Lucide React](https://lucide.dev/)
- **Graphiques** : [Recharts](https://recharts.org/) (Sankey Diagram)
- **Gestion de dates** : [date-fns](https://date-fns.org/)
- **Drag & Drop** : [@dnd-kit](https://dndkit.com/)
- **Tests** : [Jest](https://jestjs.io/) + [@testing-library/react](https://testing-library.com/)

### iOS App

- **Framework** : SwiftUI
- **Stockage local** : SwiftData (offline-first)
- **Synchronisation** : Firebase Firestore (mode en ligne optionnel)
- **Charts** : Swift Charts (natif)
- **Icônes** : SF Symbols
- **Notifications** : UNUserNotificationCenter (notifications locales)
- **Tests** : XCTest

## Installation & Démarrage (Web)

### Prérequis

- Node.js (v18 ou supérieur)
- Un projet Firebase configuré (avec Auth et Firestore activés)

### 1. Cloner le projet

```bash
git clone https://github.com/votre-username/budget-flow.git
cd budget-flow
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration des variables d'environnement

Créez un fichier `.env.local` à la racine du projet en copiant l'exemple :

```bash
cp .env.example .env.local
```

Remplissez ensuite les valeurs avec vos identifiants Firebase (disponibles dans la console Firebase > Project Settings) :

```env
NEXT_PUBLIC_FIREBASE_API_KEY=votre_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=votre_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=votre_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=votre_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id
```

### 4. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`.

## Tests

Voir [UnitTest.md](UnitTest.md) pour les instructions complètes.

```bash
# Lancer les tests Web
npm test

# Avec rapport de couverture
npm run test:coverage
```

Pour les tests iOS : ouvrir le projet dans Xcode et appuyer sur **⌘U**.

## Déploiement en Production

### Déploiement sur Vercel (Recommandé)

1. **Connectez votre dépôt GitHub** à Vercel.
2. **Configurez les variables d'environnement** dans *Settings > Environment Variables*.
3. **Déployez** : Vercel détectera automatiquement Next.js.
4. **Configuration Firebase** : Ajoutez le domaine de production dans Firebase Console > Authentication > Authorized domains.

### Autres plateformes

- **Netlify** : Utilisez le plugin Next.js.
- **AWS Amplify** : Support natif de Next.js.
- **VPS/Docker** : `npm run build` puis `npm start`.

### Configuration Post-Déploiement

```bash
# Déployer les règles Firestore
firebase deploy --only firestore:rules
```

## Notifications

Voir [NOTIFICATION.md](NOTIFICATION.md) pour la configuration de Firebase Cloud Messaging et des crons de notifications.

## Structure du Projet

```
src/
├── app/                      # Pages et Routing (Next.js App Router)
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (protected)/          # Pages nécessitant authentification
│   │   ├── dashboard/        # Tableau de bord principal
│   │   ├── evolution/        # Graphique d'évolution des économies
│   │   ├── cashflow/         # Diagramme Sankey des flux financiers
│   │   ├── history/          # Historique global des transactions
│   │   ├── settings/         # Paramètres et gestion des enveloppes
│   │   ├── envelopes/[id]/   # Détail d'une enveloppe
│   │   └── onboarding/       # Configuration initiale
│   ├── api/
│   │   ├── notifications/trigger/  # Endpoint cron notifications
│   │   └── validate/transaction/   # Validation serveur
│   └── layout.tsx
├── components/
│   └── dashboard/
│       └── TransactionModal.tsx
├── context/
│   └── AuthContext.tsx
├── hooks/
│   └── useNotifications.ts
├── lib/
│   ├── firebase.ts           # Configuration Firebase Client
│   ├── firebaseAdmin.ts      # Configuration Firebase Admin (SSR)
│   ├── validation.ts         # Validateurs réutilisables
│   ├── logger.ts             # Logger sanitisé (prod/dev)
│   └── dateUtils.ts          # Utilitaires de dates
└── __tests__/
    └── lib/
        ├── validation.test.ts
        ├── dateUtils.test.ts
        └── logger.test.ts

iOS/BudgetFlow/
├── BudgetFlow/               # Code source Swift
│   ├── Models/               # Envelope, Transaction, UserSettings
│   ├── Views/                # Toutes les vues SwiftUI
│   ├── DesignSystem.swift    # Tokens de design adaptatifs (clair/sombre)
│   ├── Extensions.swift      # Extensions Color, Calendar
│   ├── NotificationService.swift
│   └── SyncService.swift     # Synchronisation Firestore
└── BudgetFlowTests/
    └── BudgetFlowTests.swift # Tests XCTest
```

## iOS App

L'application iOS native est **fonctionnelle** et disponible via le dossier `iOS/` du projet.

### Fonctionnalités disponibles

- ✅ Toutes les fonctionnalités de base (enveloppes, transactions, historique, évolution, cash flow)
- ✅ Mode hors-ligne (SwiftData, aucune connexion requise)
- ✅ Mode en ligne avec synchronisation Firestore
- ✅ Thème clair / sombre adaptatif
- ✅ Notifications locales hebdomadaires
- ✅ Gestures natives (swipe-to-delete, drag & drop, retours haptiques)
- ✅ Accessibilité VoiceOver
- ⚠️ Authentification Firebase (en cours d'intégration)

## Sécurité

Voir [SECURITY.md](SECURITY.md) pour les détails des mesures de sécurité implémentées (règles Firestore, headers HTTP, validation, logs sanitisés).

## Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.