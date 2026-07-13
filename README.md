# BudgetFlow

> Maîtrisez votre budget mensuel grâce à la méthode des enveloppes. Simple, visuel et efficace.

**BudgetFlow** est une application multi-plateforme (Web + iOS native) conçue pour vous aider à reprendre le contrôle de vos finances personnelles. Basée sur la **méthode des enveloppes virtuelles**, elle vous permet d'allouer un budget précis à chaque catégorie de dépense et de suivre votre consommation en temps réel.

## Fonctionnalités

- **Gestion par Enveloppes** : Créez des catégories personnalisées (Courses, Loisirs, Shopping, etc.) et allouez-y un budget mensuel.
- **Enveloppes Temporaires** : Marquez une enveloppe comme temporaire et sélectionnez les mois actifs — elle disparaît automatiquement du dashboard les autres mois.
- **Dashboard Visuel** :
  - Vue d'ensemble avec solde disponible.
  - Barres de progression par enveloppe avec indicateur de dépassement.
  - Solde restant affiché en temps réel lors de la saisie d'une dépense.
  - Mise en page Bento Grid avec tailles de tuiles configurables (`small` / `wide`).
  - Présets de densité : `compact`, `balanced`, `airy`.
- **Thème clair / sombre** : Bascule adaptative sur Web et iOS, respectant les préférences système.
- **Mobile First** : Interface pensée pour l'usage quotidien sur smartphone.
- **Companion Apple Watch** :
  - Consultation rapide du restant du mois et des enveloppes principales.
  - Ajout rapide d'une dépense depuis la montre, relayée vers l'iPhone via `WatchConnectivityManager`.
- **Historique & Suivi** :
  - Historique global des transactions avec regroupement mensuel.
  - Vue détaillée par enveloppe.
  - Graphique d'évolution de l'épargne (avec cumul salaire).
  - Diagramme Cash Flow (Sankey).
- **Configuration complète** :
  - Revenus (fixes ou variables par mois), charges fixes, épargne cible.
  - Décomposition détaillée des charges fixes (ex: Loyer, Électricité, Internet).
  - Décomposition détaillée de l'épargne (ex: Livret A, PEA, Assurance-vie).
  - Indicateurs d'équilibre budgétaire.
- **Revenu variable** : Désactivez le revenu fixe et définissez un revenu différent chaque mois — les calculs de capacité budgétaire suivent automatiquement.
- **Support multi-devises** : EUR, USD, CHF, GBP et BTC — affichage seulement, pas de conversion. Disponible sur **Web et iOS**.
- **Mode Anonyme** : Floutage des montants pour consulter son budget en public. Un toggle rapide dans la navbar (Web) ou secouez le téléphone (iOS). Données intactes, purement visuel.
- **Prévisions & Insights** :
  - Projection à 90 jours par enveloppe (score de confiance, alertes de dépassement prévisible).
  - Détection de dépenses exceptionnelles.
  - Carousel de notifications intelligentes (`RotatingSmartInsight` / `SmartInsightsCarouselView`).
  - Disponible sur **Web et iOS** (`SpendingForecastEngine.swift`).
- **Parcours Fidélité (Gamification)** :
  - Grille heatmap d'activité mensuelle avec code couleur par intensité de dépense.
  - Badges jalons 7 jours, 14 jours et mois complet via un système SVG en anneau de points.
  - Tuile dashboard unifiée avec la carte "Reste disponible" (responsive, dégradés clair/sombre).
- **Widget iOS (WidgetKit)** : Solde disponible et enveloppe la plus dépensée sur l'écran d'accueil.
- **Retours haptiques iOS** : Vibrations distinctes à la confirmation et en cas d'alerte budgétaire.
- **Export PDF (iOS)** : Générez un rapport PDF mensuel de vos transactions et enveloppes via `PDFExportService.swift`.
- **Système de Feedback** : Roadmap publique et votes sur les suggestions (API REST + interface Web et iOS).
- **Demande d'avis in-app (iOS)** : `SKStoreReviewController` intégré, déclenché après 3 transactions.
- **Tests unitaires** : 27 suites · ~485 tests · 94 %+ de couverture sur la logique métier Web (Jest) ; 49 fichiers XCTest sur iOS.

## Aperçu de l'interface

<p align="center">

### iOS

  <img src="Screenshots/iOS-App.png" width="600" alt="BudgetFlow iOS App" style="margin: 5px;" />
  <img src="Screenshots/iOS-Dashboard.png" width="600" alt="Dashboard iOS" style="margin: 5px;" />
  <img src="Screenshots/iOS-Dasboard-Dark-Light.png" width="600" alt="Dashboard Dark & Light" style="margin: 5px;" />
  <img src="Screenshots/iOS-Onboarding.png" width="600" alt="Onboarding iOS" style="margin: 5px;" />
  <img src="Screenshots/iOS-Evolution.png" width="600" alt="Évolution iOS" style="margin: 5px;" />
  <img src="Screenshots/iOS-Flux.png" width="600" alt="Cash Flow iOS" style="margin: 5px;" />

### Web

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
  - **Authentication** : Email/Password, Google Auth & Sign in with Apple
  - **Firestore** : Base de données NoSQL temps réel
  - **Cloud Messaging** : Notifications push
- **Icônes** : [Lucide React](https://lucide.dev/)
- **Graphiques** : [Recharts](https://recharts.org/) (Sankey Diagram)
- **Gestion de dates** : [date-fns](https://date-fns.org/)
- **Drag & Drop** : [@dnd-kit](https://dndkit.com/)
- **Tests** : [Jest](https://jestjs.io/) + [@testing-library/react](https://testing-library.com/) + [Playwright](https://playwright.dev/)

### iOS App

- **Framework** : SwiftUI
- **Stockage local** : SwiftData (offline-first)
- **Synchronisation** : Firebase Firestore (mode en ligne optionnel)
- **Charts** : Swift Charts (natif)
- **Icônes** : SF Symbols
- **Notifications** : UNUserNotificationCenter (notifications locales)
- **Companion watchOS** : app compagnon via WatchConnectivity
- **Export** : PDFKit natif
- **Avis in-app** : StoreKit (`SKStoreReviewController`)
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

L'application sera accessible sur `http://0.0.0.0:8091`.

## Tests

### Tests unitaires (Jest)

Voir [UnitTest.md](UnitTest.md) pour les instructions complètes.

```bash
npm test                    # Lancer les tests unitaires
npm run test:coverage       # Avec rapport de couverture
```

### Tests E2E (Playwright)

La suite complète couvre **58 tests** répartis sur 9 pages : flux public, onboarding, dashboard, enveloppes, transactions, paramètres, cashflow, évolution et historique.

Voir [playwrightWorkspace/playwrightReport.md](playwrightWorkspace/playwrightReport.md) pour le rapport détaillé.

```bash
npm run test:e2e:install    # Installer Chromium (une seule fois)
npm run test:e2e:auth       # Générer la session de test (une seule fois)
npm run test:e2e:new        # Lancer toute la suite E2E
npm run test:e2e:new:headed # Avec navigateur visible
```

Configuration requise dans `.env.local` :

```bash
NEXT_PUBLIC_E2E_AUTH_BYPASS=true
E2E_TEST_USER_UID=<uid_firebase>
E2E_ANCHOR_DATE=2026-06-01
```

Les résultats sont générés dans `playwrightWorkspace/` :
- `reports/` — rapport HTML
- `test-results/` — résultats JSON
- `traces/` / `screenshots/` / `videos/` — débogage

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

## Calcul de la couleur des cellules du calendrier

Chaque cellule du calendrier représente un jour passé. Sa couleur est déterminée par le **ratio** entre le total des dépenses du jour et le **budget mensuel total** (somme de tous les budgets d'enveloppes visibles).

| Condition | Couleur | Signification |
|---|---|---|
| Aucune dépense, connexion enregistrée | Gris | Connexion |
| `dépenses du jour / budget mensuel` ≤ 20 % | Jaune | Dépense faible |
| `dépenses du jour / budget mensuel` ≤ 50 % | Orange | Dépense modérée |
| `dépenses du jour / budget mensuel` > 50 % | Rouge | Dépense élevée |
| Aucune dépense, aucune connexion | Gris clair / vide | Jour inactif |
| Jour futur | Transparent | Non applicable |

**Exemple :**

- Budget mensuel total : 1 000 €
- Dépenses le 15 mai : 150 € → ratio = 15 % → 🟡 Jaune
- Dépenses le 20 mai : 350 € → ratio = 35 % → 🟠 Orange
- Dépenses le 25 mai : 600 € → ratio = 60 % → 🔴 Rouge

Le calcul est implémenté dans `src/lib/calendarSeverity.ts` (Web) et `iOS/BudgetFlowIOS/BudgetFlow/CalendarDaySeverity.swift` (iOS), et les deux restent strictement synchronisés.

## Notifications

Voir [NOTIFICATION.md](NOTIFICATION.md) pour la configuration de Firebase Cloud Messaging et des crons de notifications.

## Structure du Projet

```
src/
├── app/                      # Pages et Routing (Next.js App Router)
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (protected)/          # Pages nécessitant authentification
│   │   ├── dashboard/        # Tableau de bord principal (bento grid)
│   │   ├── evolution/        # Graphique d'évolution des économies
│   │   ├── cashflow/         # Diagramme Sankey des flux financiers
│   │   ├── history/          # Historique global des transactions
│   │   ├── settings/         # Paramètres et gestion des enveloppes
│   │   ├── envelopes/[id]/   # Détail d'une enveloppe
│   │   └── onboarding/       # Configuration initiale
│   ├── api/
│   │   ├── account/delete/   # Suppression de compte (Admin SDK)
│   │   ├── feedback/         # API REST feedback (boards, posts, comments, votes)
│   │   ├── notifications/trigger/  # Endpoint cron notifications
│   │   └── validate/transaction/   # Validation serveur
│   └── layout.tsx
├── components/
│   ├── ThemeToggle.tsx
│   ├── dashboard/
│   │   ├── CalendarHeatmap.tsx
│   │   ├── RotatingSmartInsight.tsx
│   │   ├── SearchDropdown.tsx
│   │   └── TransactionModal.tsx
│   └── settings/
│       ├── BudgetDetailEditor.tsx
│       ├── DeleteEnvelopeModal.tsx
│       └── TemporaryEnvelopeForm.tsx
├── context/
│   ├── AnonymousModeContext.tsx
│   ├── AuthContext.tsx
│   └── CurrencyContext.tsx
├── hooks/
│   ├── useCalendarHeatmap.ts
│   ├── useCurrencyFormatting.ts
│   ├── useNotifications.ts
│   ├── useSmartSpendingInsights.ts
│   └── useSpendingForecast.ts
├── lib/
│   ├── firebase.ts           # Configuration Firebase Client
│   ├── firebaseAdmin.ts      # Configuration Firebase Admin (SSR)
│   ├── forecasting.ts        # Algorithme de projection 90 jours
│   ├── spendingInsights.ts   # Détection de dépenses exceptionnelles
│   ├── calendarSeverity.ts   # Calcul de couleur des cellules du calendrier
│   ├── validation.ts         # Validateurs réutilisables
│   ├── maskAmount.ts         # Floutage des montants (mode anonyme)
│   ├── envelopeService.ts    # Service CRUD enveloppes (temporaires, dépenses)
│   ├── settingsService.ts    # Service CRUD paramètres (detailed mode, revenu variable)
│   ├── monthlyIncomeService.ts # Résolution du revenu mensuel effectif
│   ├── logger.ts             # Logger sanitisé (prod/dev)
│   └── dateUtils.ts          # Utilitaires de dates
├── types/
│   ├── currency.ts           # Codes devises supportés (EUR, USD, CHF, GBP, BTC)
│   ├── envelope.ts           # Type Envelope + isEnvelopeActiveForMonth
│   ├── settings.ts           # Type UserSettings + BudgetSubItem + BentoPreset
│   └── transaction.ts        # Type Transaction
└── __tests__/
    ├── app/                  # Tests API, dashboard, cashflow, login, settings, envelopeDetail
    ├── components/           # Tests TransactionModal, RotatingSmartInsight, BudgetDetailEditor, DeleteEnvelopeModal
    ├── hooks/                # Tests useSpendingForecast, useCalendarHeatmap, useSmartSpendingInsights
    ├── lib/                  # Tests validation, dateUtils, logger, forecasting, spendingInsights, calendarSeverity, maskAmount, envelopeService, settingsService, loadEnvScript
    └── types/                # Tests isEnvelopeActiveForMonth

iOS/BudgetFlowIOS/
├── BudgetFlow/               # Code source Swift (80+ fichiers)
│   ├── Models/               # Envelope, Transaction, UserSettings, DailyActivity, BudgetSubItem, MonthlyIncome, PendingSyncOperation
│   ├── Views/                # Toutes les vues SwiftUI
│   ├── Services/
│   │   ├── SyncService.swift           # Synchronisation Firestore
│   │   ├── SyncCoordinator.swift       # Orchestrateur de synchronisation
│   │   ├── SpendingForecastEngine.swift   # Prévisions 90 jours (parité Web)
│   │   ├── SpendingInsightsEngine.swift   # Dépenses exceptionnelles
│   │   ├── CalendarDaySeverity.swift      # Couleur heatmap (parité Web)
│   │   ├── CalendarStreakCalculator.swift # Calcul des streaks
│   │   ├── NotificationService.swift      # Notifications locales
│   │   ├── HapticsManager.swift           # Retours haptiques
│   │   ├── WatchConnectivityManager.swift # Quick-add Apple Watch
│   │   ├── PDFExportService.swift         # Export PDF mensuel
│   │   ├── FeedbackService.swift          # API feedback
│   │   ├── AppReviewManager.swift         # Demande d'avis StoreKit
│   │   ├── StoreKitManager.swift          # Gestion StoreKit
│   │   ├── ToastManager.swift             # Toasts natifs
│   │   ├── AnonymousModeManager.swift     # Mode anonyme (shake-to-toggle)
│   │   └── WidgetSnapshotStore.swift      # Persistance widget
│   ├── FirebaseManager.swift        # Authentification Firebase
│   ├── DesignSystem.swift           # Tokens de design adaptatifs (clair/sombre)
│   ├── Localization.swift           # i18n FR/EN
│   ├── Extensions.swift             # Extensions Color, Calendar
│   ├── BentoLayoutEngine.swift      # Moteur de layout Bento Grid
│   ├── BudgetCalculations.swift     # Arithmétique budgétaire
│   ├── EvolutionCalculator.swift    # Calculs d'évolution 12 mois
│   ├── EnvelopeMutationService.swift   # CRUD enveloppes (offline/online)
│   ├── TransactionMutationService.swift # CRUD transactions (offline/online)
│   └── CalendarDateFormatting.swift    # Formatage localisé des dates
├── BudgetFlowWidgets/        # Widget WidgetKit
├── BudgetFlowAppleWatch Watch App/  # Companion watchOS
├── BudgetFlowTests/          # 49 fichiers XCTest
├── BudgetFlowUITests/        # Tests UI
└── BudgetFlowWatchApp Watch AppTests/  # Tests watchOS
```

## iOS App

L'application iOS native est **fonctionnelle** et disponible via le dossier `iOS/BudgetFlowIOS/` du projet.

### Fonctionnalités disponibles

- ✅ Toutes les fonctionnalités de base (enveloppes, transactions, historique, évolution, cash flow)
- ✅ Enveloppes temporaires avec filtrage automatique par mois
- ✅ Prévisions à 90 jours (`SpendingForecastEngine.swift`) — parité algorithmique avec le Web
- ✅ Détection de dépenses exceptionnelles (`SpendingInsightsEngine.swift`)
- ✅ Carousel de notifications intelligentes (`SmartInsightsCarouselView`)
- ✅ Mode hors-ligne (SwiftData, aucune connexion requise)
- ✅ Mode en ligne avec synchronisation Firestore
- ✅ Authentification Firebase (`FirebaseManager` + `AuthView`)
- ✅ Thème clair / sombre adaptatif
- ✅ Notifications locales hebdomadaires
- ✅ Gestures natives (swipe-to-delete, drag & drop)
- ✅ Retours haptiques (`HapticsManager.swift`)
- ✅ Widget WidgetKit (écran d'accueil iOS)
- ✅ Companion Apple Watch avec quick-add relay
- ✅ Localisation FR/EN (`Localization.swift`)
- ✅ Accessibilité VoiceOver, Dynamic Type, reduceMotion
- ✅ Support multi-devises (EUR, USD, CHF, GBP, BTC)
- ✅ Mode Anonyme (shake-to-toggle, `AnonymousModeManager`)
- ✅ Revenu variable par mois (`MonthlyIncome`)
- ✅ Décomposition détaillée charges fixes / épargne (`BudgetSubItem`)
- ✅ Bento Grid layout engine (`BentoLayoutEngine.swift`)
- ✅ Export PDF mensuel (`PDFExportService.swift`)
- ✅ Système de feedback & feature requests (`FeedbackService.swift`)
- ✅ Demande d'avis in-app (`AppReviewManager` + `StoreKitManager`)
- ✅ Toasts natifs (`ToastManager` + `DynamicIslandToastView`)
- ✅ Suppression de compte avec effacement Firebase (`FirebaseAccountHelpers.swift`)

## Sécurité

Voir [SECURITY.md](SECURITY.md) pour les détails des mesures de sécurité implémentées (règles Firestore, headers HTTP, validation, logs sanitisés).

## Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.
