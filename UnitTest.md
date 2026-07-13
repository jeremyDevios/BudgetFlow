# Unit Tests

This document explains how to install dependencies and run unit tests for both the **Web App** (Next.js) and the **iOS App** (SwiftUI/XCTest).

---

## Web App (Jest)

### Code Structure Summary

The web app is organized around a standard Next.js App Router layout:

```text
src/
├── app/                # Next.js routes and screens
│   ├── (auth)/         # Public auth pages
│   ├── (protected)/    # Authenticated product screens
│   └── api/            # Server-side route handlers
├── components/         # Reusable UI, especially dashboard widgets
├── context/            # Cross-cutting React context (auth, anonymousMode, currency)
├── hooks/              # Data-loading and UI hooks
├── lib/                # Pure logic and shared utilities
└── __tests__/          # Jest suites for pure logic, hooks, and selected UI flows
```

At a high level:

- `src/app/(protected)/dashboard/page.tsx` is the main orchestration screen for the web app.
- `src/components/dashboard/TransactionModal.tsx` handles the add/edit/delete transaction flow.
- `src/hooks/` contains stateful client logic such as forecast, heatmap, smart insights, and currency formatting.
- `src/lib/` contains the most testable business logic: validation, dates, logger behavior, forecasting, spending insight detection, calendar severity, mask amount, envelope service, and settings service.

### Install Dependencies

Before running tests for the first time, install the test dependencies:

```bash
npm install
```

### Run Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run with coverage report
npm run test:coverage
```

### End-to-End Tests (Playwright)

La suite E2E complète (58 tests, 9 pages) est dans `playwrightTest/`.  
Configuration et rapport détaillé : [playwrightWorkspace/playwrightReport.md](../playwrightWorkspace/playwrightReport.md).

```bash
# First-time setup
npm run test:e2e:install     # Install Chromium browser
npm run test:e2e:auth        # Generate test session (requires E2E env vars)

# Running tests
npm run test:e2e:new         # Full E2E suite (58 tests)
npm run test:e2e:new:headed  # With visible browser
npm run test:e2e:seed        # Force re-seed test data

# Targeted runs
npx playwright test --config=playwrightTest/playwright.config.ts --grep="dashboard"
npx playwright test --config=playwrightTest/playwright.config.ts --project=unauthenticated
```

**Prérequis** (`.env.local`) :

```bash
NEXT_PUBLIC_E2E_AUTH_BYPASS=true
E2E_TEST_USER_UID=<uid_firebase>
E2E_ANCHOR_DATE=2026-06-01
```

**Résultats** dans `playwrightWorkspace/` : `reports/`, `test-results/`, `traces/`, `screenshots/`, `videos/`.

**Structure des tests** :

```text
playwrightTest/
├── specs/          # 9 suites de test (58 tests)
├── page-objects/   # 9 Page Objects (design pattern)
├── playwright.config.ts
├── global-setup.ts # Seed automatique des données
└── global-teardown.ts
```

### Coverage Report

Coverage is currently collected for `src/lib/**/*.ts` (excluding Firebase adapters). A minimum of **80% line coverage** is enforced.

After running `npm run test:coverage`, a detailed report is printed to the terminal. An HTML report is generated in the `coverage/` directory — open `coverage/lcov-report/index.html` in a browser for a line-by-line view.

**Couverture actuelle** : 94 %+ statements · 85 %+ branches · 100 % fonctions · 94 %+ lignes — **27 suites · ~485 tests**.

Current tested web suites:

```text
src/__tests__/
├── app/
│   ├── api.notifications.trigger.test.ts
│   ├── cashflow.filtering.test.ts
│   ├── dashboard.budgetTotal.test.ts
│   ├── dashboard.filtering.test.ts
│   ├── dashboard.page.test.tsx
│   ├── envelopeDetailClient.test.tsx
│   ├── login.page.test.tsx
│   └── settings.page.test.tsx
├── components/
│   ├── BudgetDetailEditor.test.tsx
│   ├── DeleteEnvelopeModal.test.tsx
│   ├── RotatingSmartInsight.test.tsx
│   └── TransactionModal.test.tsx
├── hooks/
│   ├── useCalendarHeatmap.test.ts
│   ├── useSmartSpendingInsights.test.ts
│   └── useSpendingForecast.test.ts
├── lib/
│   ├── calendarSeverity.test.ts
│   ├── dateUtils.test.ts
│   ├── envelopeService.test.ts
│   ├── forecasting.test.ts
│   ├── loadEnvScript.test.ts
│   ├── logger.test.ts
│   ├── maskAmount.test.ts
│   ├── settingsService.firestore.test.ts
│   ├── settingsService.test.ts
│   ├── spendingInsights.test.ts
│   └── validation.test.ts
└── types/
    └── envelope.test.ts
```

### Test File Locations

| Test file | Scope |
|-----------|-------|
| `src/__tests__/lib/validation.test.ts` | Input validation rules |
| `src/__tests__/lib/dateUtils.test.ts` | Month bounds and date formatting |
| `src/__tests__/lib/logger.test.ts` | Logger behavior in dev/prod |
| `src/__tests__/lib/forecasting.test.ts` | Forecast algorithm and budget projections |
| `src/__tests__/lib/spendingInsights.test.ts` | Exceptional spending and smart notification detection |
| `src/__tests__/lib/calendarSeverity.test.ts` | Calendar heatmap color severity calculation |
| `src/__tests__/lib/maskAmount.test.ts` | Anonymous mode amount masking |
| `src/__tests__/lib/envelopeService.test.ts` | Envelope CRUD service (temporary envelope filtering, spent aggregation) |
| `src/__tests__/lib/settingsService.test.ts` | Settings normalization, detailed mode invariants, currency defaults |
| `src/__tests__/lib/settingsService.firestore.test.ts` | Settings Firestore integration (read/write with detailed mode) |
| `src/__tests__/lib/loadEnvScript.test.ts` | `scripts/load-env.js` — env file loading and precedence |
| `src/__tests__/hooks/useSpendingForecast.test.ts` | Hook recomputation when monthly transactions change |
| `src/__tests__/hooks/useCalendarHeatmap.test.ts` | Streak computation, heatmap filtering, full-month progress |
| `src/__tests__/hooks/useSmartSpendingInsights.test.ts` | Smart notification rotation and insight detection |
| `src/__tests__/components/RotatingSmartInsight.test.tsx` | 4-second smart notification rotation and reset behavior |
| `src/__tests__/components/BudgetDetailEditor.test.tsx` | Detailed budget sub-item editor (add/remove/validate items) |
| `src/__tests__/components/DeleteEnvelopeModal.test.tsx` | Envelope deletion with confirmation and spent data warning |
| `src/__tests__/app/dashboard.page.test.tsx` | Dashboard rendering states and forecast/warning UI |
| `src/__tests__/app/dashboard.filtering.test.ts` | Temporary-envelope filtering per selected month |
| `src/__tests__/app/dashboard.budgetTotal.test.ts` | Available-total calculation with active temporary envelopes |
| `src/__tests__/app/cashflow.filtering.test.ts` | Cash flow Sankey — temporary envelopes excluded from totals |
| `src/__tests__/app/login.page.test.tsx` | Login page rendering and validation feedback |
| `src/__tests__/app/settings.page.test.tsx` | Settings page rendering, delete account flow |
| `src/__tests__/app/envelopeDetailClient.test.tsx` | Envelope detail view with transaction list |
| `src/__tests__/app/api.notifications.trigger.test.ts` | Notification trigger API — auth, filtering, FCM dispatch |
| `src/__tests__/components/TransactionModal.test.tsx` | Create/edit/delete transaction flows |
| `src/__tests__/types/envelope.test.ts` | `isEnvelopeActiveForMonth` — permanent and temporary envelope rules |

### What Is Covered

#### Covered on the Web App

| Area | Covered behavior |
|------|------------------|
| `src/lib/validation.ts` | `validateAmount`, `validateDescription`, `validateEnvelopeName`, `validateEnvelopeId`, `validateDate`, `validateEmail`, `validatePassword` |
| `src/lib/dateUtils.ts` | `getMonthBounds`, `formatMonthYear` |
| `src/lib/logger.ts` | `info`, `warn`, `error`, `sanitizedError` (dev + prod behaviour) |
| `src/lib/forecasting.ts` | `computeForecast` — empty state, no-history fallback, multi-envelope projection, confidence score, overruns, zero-budget handling |
| `src/lib/spendingInsights.ts` | exceptional spending detection, rapid-spend alerts, repeated over/under budget detection, recurring-expense alerts |
| `src/lib/calendarSeverity.ts` | color severity calculation from daily-spend / monthly-budget ratio |
| `src/lib/maskAmount.ts` | amount masking for anonymous mode |
| `src/lib/envelopeService.ts` | envelope CRUD with temporary envelope filtering, spent aggregation, reimbursement handling |
| `src/lib/settingsService.ts` | `loadSettings` with detailed-mode invariant enforcement, `normalizeSettingsPayload` write-time normalization, `resolveMonthlyIncome` fallback chain |
| `scripts/load-env.js` | env file loading, variable precedence, quoted values, commented lines |
| `src/types/envelope.ts` | `isEnvelopeActiveForMonth` — permanent envelopes always active, temporary envelopes gated by `activeMonths` |
| `src/hooks/useSpendingForecast.ts` | reruns forecast when current-month data changes |
| `src/hooks/useCalendarHeatmap.ts` | `computeCurrentStreak`, `computeMaxStreak`, `computeFullMonthProgress` — perfect runs, missing days, empty months, mixed tx/login |
| `src/hooks/useSmartSpendingInsights.ts` | smart notification rotation logic |
| `src/app/(protected)/dashboard/page.tsx` | empty forecast state, normal estimate state, overrun state, rotating smart notifications, temporary envelope filtering per month, available-total with temporary budgets |
| `src/app/(protected)/cashflow/page.tsx` | temporary envelopes excluded from Sankey links and `totalAllocated` |
| `src/app/(auth)/login/page.tsx` | login form rendering, validation feedback display |
| `src/app/(protected)/settings/page.tsx` | settings page rendering, delete account confirmation |
| `src/app/(protected)/envelopes/[id]/EnvelopeDetailClient.tsx` | envelope detail with transaction list |
| `src/app/api/notifications/trigger/route.ts` | secret auth, user filtering, FCM dispatch, error handling |
| `src/components/dashboard/TransactionModal.tsx` | create, edit, delete flows and aggregate `spent` updates |
| `src/components/dashboard/RotatingSmartInsight.tsx` | 4-second rotation and reset behavior |
| `src/components/settings/BudgetDetailEditor.tsx` | sub-item add/remove/validate in detailed budget mode |
| `src/components/settings/DeleteEnvelopeModal.tsx` | envelope deletion with confirmation dialog |

#### Not Covered or Only Partially Covered on the Web App

| Area | Status |
|------|--------|
| `src/lib/firebase.ts`, `src/lib/firebaseAdmin.ts` | not unit tested; requires Firebase runtime/credentials |
| `src/lib/monthlyIncomeService.ts` | tested indirectly via `settingsService.test.ts` |
| `src/app/(protected)/evolution/`, `history/`, `onboarding/` | covered by E2E tests (Playwright) |
| `src/app/api/feedback/` | not unit tested; covered by manual QA |
| `src/app/api/account/delete/` | not unit tested; requires Firebase Admin credentials |
| `src/components/settings/TemporaryEnvelopeForm.tsx` | not unit tested |
| `src/hooks/useNotifications.ts` | no dedicated unit tests |
| `src/hooks/useCurrencyFormatting.ts` | no dedicated unit tests |
| `src/context/AnonymousModeContext.tsx` | no dedicated unit tests |
| `src/context/CurrencyContext.tsx` | no dedicated unit tests |
| authenticated browser flows (login, onboarding, dashboard, CRUD, analytics) | covered by 58 E2E Playwright tests |
| visual rendering, responsive layout, and animation behavior | only indirectly covered |

---

## iOS App (XCTest)

### Code Structure Summary

The iOS app lives under `iOS/BudgetFlowIOS/` and is organized around native SwiftUI + SwiftData layers (80+ source files):

```text
iOS/BudgetFlowIOS/
├── BudgetFlow/                        # Application source (80+ Swift files)
│   ├── BudgetFlowApp.swift
│   ├── BudgetFlowAppDelegate.swift
│   ├── ContentView.swift / MainTabView.swift
│   ├── Models/
│   │   ├── Envelope.swift / Transaction.swift / UserSettings.swift
│   │   ├── DailyActivity.swift / BudgetSubItem.swift
│   │   ├── MonthlyIncome.swift / PendingSyncOperation.swift
│   │   └── Item.swift
│   ├── Views/                         # SwiftUI screens (Dashboard, History, Evolution…)
│   ├── Services/
│   │   ├── SyncService.swift / SyncCoordinator.swift
│   │   ├── SpendingForecastEngine.swift / SpendingInsightsEngine.swift
│   │   ├── CalendarDaySeverity.swift / CalendarStreakCalculator.swift
│   │   ├── NotificationService.swift / HapticsManager.swift
│   │   ├── WatchConnectivityManager.swift
│   │   ├── PDFExportService.swift / FeedbackService.swift
│   │   ├── AppReviewManager.swift / StoreKitManager.swift
│   │   ├── ToastManager.swift / AnonymousModeManager.swift
│   │   └── WidgetSnapshotStore.swift / WidgetSnapshotSignature.swift
│   ├── FirebaseManager.swift / FirebaseBootstrap.swift
│   ├── FirebaseAccountHelpers.swift / AppleSignInHelpers.swift
│   ├── DesignSystem.swift / Localization.swift / Extensions.swift
│   ├── BentoLayoutEngine.swift / BudgetCalculations.swift
│   ├── EvolutionCalculator.swift / CalendarDateFormatting.swift
│   ├── EnvelopeMutationService.swift / TransactionMutationService.swift
│   └── DeviceCapability.swift
├── BudgetFlowWidgets/                 # WidgetKit extension
│   ├── BudgetFlowWidgets.swift
│   └── WidgetSnapshotPayload.swift
├── BudgetFlowAppleWatch Watch App/    # watchOS companion
│   ├── BudgetFlowAppleWatchApp.swift
│   ├── CompanionSharedModels.swift
│   └── ContentView.swift
├── BudgetFlowTests/                   # XCTest suites (49 files)
├── BudgetFlowUITests/                 # UI tests
└── BudgetFlowWatchApp Watch AppTests/ # watchOS tests
```

### Run Tests in Xcode

1. Open `iOS/BudgetFlowIOS/BudgetFlow.xcodeproj` in Xcode.
2. Select the **BudgetFlow** scheme and a simulator target (e.g. iPhone 16).
3. Press **⌘U** (or go to **Product → Test**) to run the full test suite.

### View Coverage in Xcode

1. After running tests, open the **Report Navigator** (⌘9) and select the latest test run.
2. Click the **Coverage** tab to see per-file and per-function coverage percentages.
3. To enable coverage collection: **Product → Scheme → Edit Scheme → Test → Options → Code Coverage → Gather coverage for all targets**.

### Test Files

```
iOS/BudgetFlowIOS/BudgetFlowTests/
├── ActivityDayTests.swift                         — DailyActivity date logic
├── AnonymousModeTests.swift                       — Anonymous mode toggle and masking
├── AppLayoutMetricsTests.swift                    — Layout metrics for adaptive UI
├── AppleAuthHelpersTests.swift                    — Sign in with Apple helpers
├── AppReviewManagerTests.swift                    — StoreKit review request logic
├── BentoLayoutEngineTests.swift                   — Bento grid layout computation
├── BudgetCalculationTests.swift                   — Budget arithmetic helpers
├── BudgetFlowTests.swift                          — Core model & utility tests
├── BudgetSubItemTests.swift                       — FixedCostItem / SavingsItem model
├── CalendarStreakCalculatorTests.swift            — Streak computation (parity with Web)
├── CashFlowRegressionTests.swift                  — Cash Flow Sankey regressions
├── CompanionSharedModelsTests.swift               — Watch shared model parsing
├── CurrencyAndMaskingTests.swift                  — Currency codes + amount masking
├── DashboardAvailableTotalRegressionTests.swift   — Available-total with temp envelopes
├── DesignSystemTests.swift                        — Color token resolution
├── DetailedBudgetModeTests.swift                  — Detailed budget mode invariants
├── EnvelopeMutationServiceTests.swift             — Envelope create service (offline/online/coordinator)
├── EvolutionCalculatorTests.swift                 — 12-month evolution calculation
├── FeedbackViewTests.swift                        — Feedback views and service
├── FirebaseAccountHelpersTests.swift              — Account deletion helpers
├── FirebaseAuthMockTests.swift                    — Firebase auth mock flows
├── HapticsManagerTests.swift                      — Haptic manager API
├── LocalizationTests.swift                        — i18n string resolution
├── ManageEnvelopesViewDeletionTests.swift         — Envelope deletion from manage view
├── ModelContextDeleteAllTests.swift               — SwiftData batch delete
├── MonthlyIncomeTests.swift                       — Per-month income override logic
├── NotificationServiceTests.swift                 — Notification scheduling & permissions
├── OfflineAccountFlowTests.swift                  — Local offline flows
├── OnboardingBudgetCalculatorTests.swift          — Onboarding budget calculator
├── OnboardingHelpersTests.swift                   — Onboarding step helpers
├── OnlineAccountFlowTests.swift                   — Online Firebase account flows
├── PDFExportServiceTests.swift                    — PDF export generation
├── SettingsBudgetCalculatorTests.swift            — Settings budget calculator
├── SpendingForecastEngineTests.swift              — 90-day projection algorithm
├── SpendingInsightsEngineTests.swift              — Exceptional spending + smart notification detection
├── StoreKitManagerTests.swift                     — StoreKit purchase management
├── SwiftDataOfflineTests.swift                    — SwiftData persistence & migrations
├── SyncCoordinatorTests.swift                     — Sync coordinator orchestration
├── SyncServiceDataParsingTests.swift              — Firestore document parsing
├── SyncServiceDeleteTests.swift                   — Soft/hard delete propagation
├── SyncServiceMockTests.swift                     — MockSyncService + MockSyncCoordinator + integration tests
├── TemporaryEnvelopeDateValidationRegressionTests.swift — Date validation regressions
├── TemporaryEnvelopeTests.swift                   — Temporary envelope activation logic
├── ToastManagerTests.swift                        — Toast notification manager
├── TransactionHistoryHelpersTests.swift           — Transaction history grouping
├── TransactionMutationServiceTests.swift          — Transaction create service (offline/online/coordinator)
├── WatchConnectivityManagerTests.swift            — WatchConnectivity quick-add relay
├── WidgetSnapshotSignatureTests.swift             — Widget snapshot signature hashing
└── WidgetSnapshotStoreTests.swift                 — Widget snapshot persistence
```

### What Is Covered

| Test File | Tested Components |
|-----------|------------------|
| `BudgetFlowTests.swift` | `Color(hex:)` parsing, `toHex()` round-trip, `Color.fromString(_:)` Tailwind mapping, `Calendar.startOfMonth/endOfMonth`, `monthlySpent(for:in:)`, `Envelope` model, `Transaction` model, `UserSettings` model & budget calculation |
| `ActivityDayTests.swift` | `DailyActivity` date key generation and lookup |
| `AnonymousModeTests.swift` | Anonymous mode toggle, amount masking, shake gesture detection |
| `AppLayoutMetricsTests.swift` | Adaptive layout metrics for different device sizes |
| `AppleAuthHelpersTests.swift` | Sign in with Apple helpers |
| `AppReviewManagerTests.swift` | StoreKit review request criteria and timing |
| `BentoLayoutEngineTests.swift` | Bento grid layout computation from `tileSize` and `bentoPreset` |
| `BudgetCalculationTests.swift` | `BudgetCalculations` pure budget arithmetic |
| `BudgetSubItemTests.swift` | `FixedCostItem` / `SavingsItem` model validation |
| `CalendarStreakCalculatorTests.swift` | Streak computation parity with Web `useCalendarHeatmap.ts` |
| `CashFlowRegressionTests.swift` | temporary envelopes excluded from Cash Flow Sankey |
| `CompanionSharedModelsTests.swift` | Watch `WatchEnvelope` / `WatchQuickAddExpenseRequest` serialization |
| `CurrencyAndMaskingTests.swift` | Currency code handling and amount masking integration |
| `DashboardAvailableTotalRegressionTests.swift` | available total includes active temporary envelope budgets |
| `DesignSystemTests.swift` | semantic color token resolution in light/dark |
| `DetailedBudgetModeTests.swift` | detailed budget mode invariants (enable/disable preserves data) |
| `EnvelopeMutationServiceTests.swift` | offline persist without sync, online mode queues via `MockSyncCoordinator`, missing userId persists locally without sync, `updatedAt` stamped |
| `EvolutionCalculatorTests.swift` | 12-month evolution balance calculation |
| `FeedbackViewTests.swift` | Feedback views and service integration |
| `FirebaseAccountHelpersTests.swift` | Account deletion helpers and data cleanup |
| `FirebaseAuthMockTests.swift` | mock Firebase auth flows |
| `HapticsManagerTests.swift` | haptic feedback API |
| `LocalizationTests.swift` | French / English string resolution |
| `ManageEnvelopesViewDeletionTests.swift` | Envelope deletion from manage view with confirmation |
| `ModelContextDeleteAllTests.swift` | SwiftData batch delete operations |
| `MonthlyIncomeTests.swift` | Per-month income override creation and resolution |
| `NotificationServiceTests.swift` | singleton identity, `scheduleWeeklyNotifications`, `cancelAllNotifications`, `requestPermission`, `currentAuthorizationStatus` |
| `OfflineAccountFlowTests.swift` | offline-only account creation and data persistence |
| `OnboardingBudgetCalculatorTests.swift` | Onboarding budget calculation |
| `OnboardingHelpersTests.swift` | onboarding step validation helpers |
| `OnlineAccountFlowTests.swift` | online Firebase sync account flows |
| `PDFExportServiceTests.swift` | PDF report generation with transactions and envelopes |
| `SettingsBudgetCalculatorTests.swift` | Settings budget calculator |
| `SpendingForecastEngineTests.swift` | `computeForecast` — empty state, no-history fallback, multi-envelope projection, confidence score, overruns |
| `SpendingInsightsEngineTests.swift` | exceptional spending, rapid-spend alerts, repeated over/under budget detection, recurring-expense alerts |
| `StoreKitManagerTests.swift` | StoreKit purchase and product management |
| `SwiftDataOfflineTests.swift` | SwiftData offline persistence and model migrations |
| `SyncCoordinatorTests.swift` | Sync coordinator orchestration and queue management |
| `SyncServiceDataParsingTests.swift` | Firestore document-to-SwiftData conversion |
| `SyncServiceDeleteTests.swift` | Soft delete and hard delete propagation during merge |
| `SyncServiceMockTests.swift` | `MockSyncService` (with `mergeFromFirestore`), `MockSyncCoordinator` (call tracking, expectation hooks), `checkDataExists`, `loadFromFirestore`, `saveToFirestore`, `syncSettings`, `syncEnvelope`, `deleteEnvelope`, `deleteTransaction` |
| `TemporaryEnvelopeDateValidationRegressionTests.swift` | date validation edge cases for temporary envelopes |
| `TemporaryEnvelopeTests.swift` | `Envelope.isActive(in:)` — permanent always active, temporary gated by `activeMonths` |
| `ToastManagerTests.swift` | Toast notification queue and display |
| `TransactionHistoryHelpersTests.swift` | Transaction grouping by month for history view |
| `TransactionMutationServiceTests.swift` | transaction created and `spent` updated, offline no-sync, online queues via `MockSyncCoordinator`, reimbursement decreases `spent`, `updatedAt` stamped on transaction and envelope |
| `WatchConnectivityManagerTests.swift` | quick-add relay from Watch uses `MockSyncCoordinator`, success/missing-envelope responses |
| `WidgetSnapshotSignatureTests.swift` | widget snapshot signature hashing |
| `WidgetSnapshotStoreTests.swift` | widget snapshot persistence and retrieval |

### Coverage Target

The test suite targets **≥ 80% coverage** of pure-logic files. Firebase-calling and UI-rendering code is excluded from the coverage target because it requires a live Firebase project or a device/simulator with real user interaction.

---

## What Is Not Tested (and Why)

| Component | Reason |
|-----------|--------|
| `src/lib/firebase.ts`, `firebaseAdmin.ts` | Firebase SDK initialisation — requires live credentials |
| `src/app/api/feedback/` | API routes — not yet tested; covered by manual QA |
| `src/app/api/account/delete/` | Requires Firebase Admin credentials |
| `src/app/(protected)/evolution/`, `history/`, `onboarding/` | deeply coupled to Firebase, router, and client context; covered by E2E |
| `src/components/settings/TemporaryEnvelopeForm.tsx` | UI-level component; no unit tests yet |
| `src/hooks/useNotifications.ts` | no dedicated unit tests |
| `src/hooks/useCurrencyFormatting.ts` | no dedicated unit tests |
| `src/context/AnonymousModeContext.tsx` | no dedicated unit tests |
| `src/context/CurrencyContext.tsx` | no dedicated unit tests |
| SwiftUI views | Require live rendering environment; covered by manual UI tests and `BudgetFlowUITests` |
| `SyncService.swift` (live path) | Requires authenticated Firebase session |
