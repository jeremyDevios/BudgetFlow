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
├── context/            # Cross-cutting React context (auth)
├── hooks/              # Data-loading and UI hooks
├── lib/                # Pure logic and shared utilities
└── __tests__/          # Jest suites for pure logic, hooks, and selected UI flows
```

At a high level:

- `src/app/(protected)/dashboard/page.tsx` is the main orchestration screen for the web app.
- `src/components/dashboard/TransactionModal.tsx` handles the add/edit/delete transaction flow.
- `src/hooks/` contains stateful client logic such as forecast and heatmap loading.
- `src/lib/` contains the most testable business logic: validation, dates, logger behavior, forecasting, and spending insight detection.

### Install Dependencies

Before running tests for the first time, install the test dependencies:

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run with coverage report
npm run test:coverage

# Install Playwright Chromium browser (first time only)
npm run test:e2e:install

# Run end-to-end smoke tests
npm run test:e2e

# Run browser tests with visible UI
npm run test:e2e:headed
```

### Coverage Report

Coverage is currently collected for `src/lib/**/*.ts` (excluding Firebase adapters). A minimum of **80% line coverage** is enforced.

After running `npm run test:coverage`, a detailed report is printed to the terminal. An HTML report is generated in the `coverage/` directory — open `coverage/lcov-report/index.html` in a browser for a line-by-line view.

**Couverture actuelle** : 94.54 % statements · 85.71 % branches · 100 % fonctions · 94.37 % lignes — **17 suites · 209 tests**.

Current tested web suites:

```text
src/__tests__/
├── app/
│   ├── api.notifications.trigger.test.ts
│   ├── cashflow.filtering.test.ts
│   ├── dashboard.budgetTotal.test.ts
│   ├── dashboard.filtering.test.ts
│   ├── dashboard.page.test.tsx
│   └── login.page.test.tsx
├── components/
│   ├── RotatingSmartInsight.test.tsx
│   └── TransactionModal.test.tsx
├── hooks/
│   ├── useCalendarHeatmap.test.ts
│   └── useSpendingForecast.test.ts
├── lib/
│   ├── dateUtils.test.ts
│   ├── forecasting.test.ts
│   ├── loadEnvScript.test.ts
│   ├── logger.test.ts
│   ├── spendingInsights.test.ts
│   └── validation.test.ts
└── types/
    └── envelope.test.ts

tests/e2e/
└── public-smoke.spec.ts
```

### Test File Locations

| Test file | Scope |
|-----------|-------|
| `src/__tests__/lib/validation.test.ts` | Input validation rules |
| `src/__tests__/lib/dateUtils.test.ts` | Month bounds and date formatting |
| `src/__tests__/lib/logger.test.ts` | Logger behavior in dev/prod |
| `src/__tests__/lib/forecasting.test.ts` | Forecast algorithm and budget projections |
| `src/__tests__/lib/spendingInsights.test.ts` | Exceptional spending and smart notification detection |
| `src/__tests__/lib/loadEnvScript.test.ts` | `scripts/load-env.js` — env file loading and precedence |
| `src/__tests__/hooks/useSpendingForecast.test.ts` | Hook recomputation when monthly transactions change |
| `src/__tests__/hooks/useCalendarHeatmap.test.ts` | Streak computation, heatmap filtering, full-month progress |
| `src/__tests__/components/RotatingSmartInsight.test.tsx` | 4-second smart notification rotation and reset behavior |
| `src/__tests__/app/dashboard.page.test.tsx` | Dashboard rendering states and forecast/warning UI |
| `src/__tests__/app/dashboard.filtering.test.ts` | Temporary-envelope filtering per selected month |
| `src/__tests__/app/dashboard.budgetTotal.test.ts` | Available-total calculation with active temporary envelopes |
| `src/__tests__/app/cashflow.filtering.test.ts` | Cash flow Sankey — temporary envelopes excluded from totals |
| `src/__tests__/app/login.page.test.tsx` | Login page rendering and validation feedback |
| `src/__tests__/app/api.notifications.trigger.test.ts` | Notification trigger API — auth, filtering, FCM dispatch |
| `src/__tests__/components/TransactionModal.test.tsx` | Create/edit/delete transaction flows |
| `src/__tests__/types/envelope.test.ts` | `isEnvelopeActiveForMonth` — permanent and temporary envelope rules |
| `tests/e2e/public-smoke.spec.ts` | Public smoke flow: home page and login screen availability |

### What Is Covered

#### Covered on the Web App

| Area | Covered behavior |
|------|------------------|
| `src/lib/validation.ts` | `validateAmount`, `validateDescription`, `validateEnvelopeName`, `validateEnvelopeId`, `validateDate`, `validateEmail`, `validatePassword` |
| `src/lib/dateUtils.ts` | `getMonthBounds`, `formatMonthYear` |
| `src/lib/logger.ts` | `info`, `warn`, `error`, `sanitizedError` (dev + prod behaviour) |
| `src/lib/forecasting.ts` | `computeForecast` — empty state, no-history fallback, multi-envelope projection, confidence score, overruns, zero-budget handling |
| `src/lib/spendingInsights.ts` | exceptional spending detection, rapid-spend alerts, repeated over/under budget detection, recurring-expense alerts |
| `scripts/load-env.js` | env file loading, variable precedence, quoted values, commented lines |
| `src/types/envelope.ts` | `isEnvelopeActiveForMonth` — permanent envelopes always active, temporary envelopes gated by `activeMonths` |
| `src/hooks/useSpendingForecast.ts` | reruns forecast when current-month data changes |
| `src/hooks/useCalendarHeatmap.ts` | `computeCurrentStreak`, `computeMaxStreak`, `computeFullMonthProgress` — perfect runs, missing days, empty months, mixed tx/login |
| `src/app/(protected)/dashboard/page.tsx` | empty forecast state, normal estimate state, overrun state, rotating smart notifications, temporary envelope filtering per month, available-total with temporary budgets |
| `src/app/(protected)/cashflow/page.tsx` | temporary envelopes excluded from Sankey links and `totalAllocated` |
| `src/app/(auth)/login/page.tsx` | login form rendering, validation feedback display |
| `src/app/api/notifications/trigger/route.ts` | secret auth, user filtering, FCM dispatch, error handling |
| `src/components/dashboard/TransactionModal.tsx` | create, edit, delete flows and aggregate `spent` updates |
| `tests/e2e/public-smoke.spec.ts` | public landing page rendering, CTA navigation, and login page availability |

#### Not Covered or Only Partially Covered on the Web App

| Area | Status |
|------|--------|
| `src/lib/firebase.ts`, `src/lib/firebaseAdmin.ts` | not unit tested; requires Firebase runtime/credentials |
| `src/app/(protected)/evolution/`, `settings/`, `history/`, `envelopes/`, `onboarding/` | not unit tested |
| `src/components/settings/TemporaryEnvelopeForm.tsx` | not unit tested |
| `src/hooks/useNotifications.ts` | no dedicated unit tests |
| authenticated browser flows (Google login popup, onboarding, dashboard navigation) | not covered by Playwright smoke tests yet |
| visual rendering, responsive layout, and animation behavior | only indirectly covered |

---

## iOS App (XCTest)

### Code Structure Summary

The iOS app lives under `iOS/` and is organized around native SwiftUI + SwiftData layers:

```text
iOS/BudgetFlowIOS/
├── BudgetFlow/                        # Application source
│   ├── BudgetFlowApp.swift
│   ├── BudgetFlowAppDelegate.swift
│   ├── ContentView.swift / MainTabView.swift
│   ├── Envelope.swift / Transaction.swift / UserSettings.swift / DailyActivity.swift
│   ├── Views/                         # SwiftUI screens (Dashboard, History, Evolution…)
│   ├── BudgetCalculations.swift       # Pure budget arithmetic
│   ├── SpendingForecastEngine.swift   # 90-day projection engine (iOS parity with Web)
│   ├── SpendingInsightsEngine.swift   # Exceptional spending + smart notification detection
│   ├── HapticsManager.swift           # Haptic feedback
│   ├── NotificationService.swift      # Local weekly notifications
│   ├── SyncService.swift              # Firestore bidirectional sync
│   ├── WatchConnectivityManager.swift # Apple Watch quick-add relay
│   ├── Localization.swift             # i18n helpers
│   ├── DesignSystem.swift             # Semantic color tokens
│   └── Extensions.swift
├── BudgetFlowWidgets/                 # WidgetKit extension
│   └── BudgetFlowWidgets.swift        # Home-screen widget
├── BudgetFlowAppleWatch Watch App/    # watchOS companion
│   ├── BudgetFlowAppleWatchApp.swift
│   ├── CompanionSharedModels.swift
│   └── ContentView.swift
└── BudgetFlowTests/                   # XCTest suites (25 files)
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
├── BudgetFlowTests.swift                         — Core model & utility tests
├── ActivityDayTests.swift                         — DailyActivity date logic
├── BudgetCalculationTests.swift                   — Budget arithmetic helpers
├── CashFlowRegressionTests.swift                  — Cash Flow Sankey regressions
├── CompanionSharedModelsTests.swift               — Watch shared model parsing
├── DashboardAvailableTotalRegressionTests.swift   — Available-total with temp envelopes
├── DesignSystemTests.swift                        — Color token resolution
├── EnvelopeMutationServiceTests.swift             — Envelope create service (offline/online/coordinator)
├── FirebaseAuthMockTests.swift                    — Firebase auth mock flows
├── HapticsManagerTests.swift                      — Haptic manager API
├── LocalizationTests.swift                        — i18n string resolution
├── NotificationServiceTests.swift                 — Notification scheduling & permissions
├── OfflineAccountFlowTests.swift                  — Local offline flows
├── OnboardingHelpersTests.swift                   — Onboarding step helpers
├── OnlineAccountFlowTests.swift                   — Online Firebase account flows
├── SpendingForecastEngineTests.swift              — 90-day projection algorithm
├── SpendingInsightsEngineTests.swift              — Exceptional spending + smart notification detection
├── SwiftDataOfflineTests.swift                    — SwiftData persistence & migrations
├── SyncServiceDataParsingTests.swift              — Firestore document parsing
├── SyncServiceMockTests.swift                     — MockSyncService + MockSyncCoordinator + integration tests
├── TemporaryEnvelopeDateValidationRegressionTests.swift — Date validation regressions
├── TemporaryEnvelopeTests.swift                   — Temporary envelope activation logic
├── TransactionMutationServiceTests.swift          — Transaction create service (offline/online/coordinator)
├── WatchConnectivityManagerTests.swift            — WatchConnectivity quick-add relay
├── WidgetSnapshotSignatureTests.swift             — Widget snapshot signature
└── WidgetSnapshotStoreTests.swift                 — Widget snapshot persistence
```

### What Is Covered

| Test File | Tested Components |
|-----------|------------------|
| `BudgetFlowTests.swift` | `Color(hex:)` parsing, `toHex()` round-trip, `Color.fromString(_:)` Tailwind mapping, `Calendar.startOfMonth/endOfMonth`, `monthlySpent(for:in:)`, `Envelope` model, `Transaction` model, `UserSettings` model & budget calculation |
| `ActivityDayTests.swift` | `DailyActivity` date key generation and lookup |
| `BudgetCalculationTests.swift` | `BudgetCalculations` pure budget arithmetic |
| `CashFlowRegressionTests.swift` | temporary envelopes excluded from Cash Flow Sankey |
| `CompanionSharedModelsTests.swift` | Watch `WatchEnvelope` / `WatchQuickAddExpenseRequest` serialization |
| `DashboardAvailableTotalRegressionTests.swift` | available total includes active temporary envelope budgets |
| `DesignSystemTests.swift` | semantic color token resolution in light/dark |
| `EnvelopeMutationServiceTests.swift` | offline persist without sync, online mode queues via `MockSyncCoordinator`, missing userId persists locally without sync, `updatedAt` stamped |
| `FirebaseAuthMockTests.swift` | mock Firebase auth flows |
| `HapticsManagerTests.swift` | haptic feedback API |
| `LocalizationTests.swift` | French / English string resolution |
| `NotificationServiceTests.swift` | singleton identity, `scheduleWeeklyNotifications`, `cancelAllNotifications`, `requestPermission`, `currentAuthorizationStatus` |
| `OfflineAccountFlowTests.swift` | offline-only account creation and data persistence |
| `OnboardingHelpersTests.swift` | onboarding step validation helpers |
| `OnlineAccountFlowTests.swift` | online Firebase sync account flows |
| `SpendingForecastEngineTests.swift` | `computeForecast` — empty state, no-history fallback, multi-envelope projection, confidence score, overruns |
| `SpendingInsightsEngineTests.swift` | exceptional spending, rapid-spend alerts, repeated over/under budget detection, recurring-expense alerts |
| `SwiftDataOfflineTests.swift` | SwiftData offline persistence and model migrations |
| `SyncServiceDataParsingTests.swift` | Firestore document-to-SwiftData conversion |
| `SyncServiceMockTests.swift` | `MockSyncService` (with `mergeFromFirestore`), `MockSyncCoordinator` (call tracking, expectation hooks), `checkDataExists`, `loadFromFirestore`, `saveToFirestore`, `syncSettings`, `syncEnvelope`, `deleteEnvelope`, `deleteTransaction` |
| `TemporaryEnvelopeDateValidationRegressionTests.swift` | date validation edge cases for temporary envelopes |
| `TemporaryEnvelopeTests.swift` | `Envelope.isActive(in:)` — permanent always active, temporary gated by `activeMonths` |
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
| `src/app/(protected)/evolution/`, `settings/`, `history/`, `envelopes/`, `onboarding/` | deeply coupled to Firebase, router, and client context |
| `src/components/settings/TemporaryEnvelopeForm.tsx` | UI-level component; no unit tests yet |
| `src/hooks/useNotifications.ts` | no dedicated unit tests |
| SwiftUI views | Require live rendering environment; covered by manual UI tests |
| `SyncService.swift` (live path) | Requires authenticated Firebase session |
