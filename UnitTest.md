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
```

### Coverage Report

Coverage is currently collected for `src/lib/**/*.ts` (excluding Firebase adapters). A minimum of **80% line coverage** is enforced.

After running `npm run test:coverage`, a detailed report is printed to the terminal. An HTML report is generated in the `coverage/` directory — open `coverage/lcov-report/index.html` in a browser for a line-by-line view.

Current tested web suites:

```text
src/__tests__/
├── app/
│   └── dashboard.page.test.tsx
├── components/
│   └── TransactionModal.test.tsx
├── hooks/
│   └── useSpendingForecast.test.ts
└── lib/
    ├── dateUtils.test.ts
    ├── forecasting.test.ts
    ├── logger.test.ts
    ├── spendingInsights.test.ts
    └── validation.test.ts
```

### Test File Locations

| Test file | Scope |
|-----------|-------|
| `src/__tests__/lib/validation.test.ts` | Input validation rules |
| `src/__tests__/lib/dateUtils.test.ts` | Month bounds and date formatting |
| `src/__tests__/lib/logger.test.ts` | Logger behavior in dev/prod |
| `src/__tests__/lib/forecasting.test.ts` | Forecast algorithm and budget projections |
| `src/__tests__/lib/spendingInsights.test.ts` | Exceptional spending detection |
| `src/__tests__/hooks/useSpendingForecast.test.ts` | Hook recomputation when monthly transactions change |
| `src/__tests__/app/dashboard.page.test.tsx` | Dashboard rendering states and forecast/warning UI |
| `src/__tests__/components/TransactionModal.test.tsx` | Create/edit/delete transaction flows |

### What Is Covered

#### Covered on the Web App

| Area | Covered behavior |
|------|------------------|
| `src/lib/validation.ts` | `validateAmount`, `validateDescription`, `validateEnvelopeName`, `validateEnvelopeId`, `validateDate`, `validateEmail`, `validatePassword` |
| `src/lib/dateUtils.ts` | `getMonthBounds`, `formatMonthYear` |
| `src/lib/logger.ts` | `info`, `warn`, `error`, `sanitizedError` (dev + prod behaviour) |
| `src/lib/forecasting.ts` | `computeForecast` — empty state, no-history fallback, multi-envelope projection, confidence score, overruns, zero-budget handling |
| `src/lib/spendingInsights.ts` | exceptional spending detection and selection of the strongest warning |
| `src/hooks/useSpendingForecast.ts` | reruns forecast when current-month data changes |
| `src/app/(protected)/dashboard/page.tsx` | empty forecast state, normal estimate state, overrun state, exceptional spending warning |
| `src/components/dashboard/TransactionModal.tsx` | create, edit, delete flows and aggregate `spent` updates |

#### Not Covered or Only Partially Covered on the Web App

| Area | Status |
|------|--------|
| `src/lib/firebase.ts`, `src/lib/firebaseAdmin.ts` | not unit tested; requires Firebase runtime/credentials |
| most `src/app/**/page.tsx` screens besides dashboard | not unit tested |
| most UI components in `src/components/` | not unit tested |
| `src/hooks/useCalendarHeatmap.ts`, `src/hooks/useNotifications.ts` | not unit tested |
| `src/app/api/**/route.ts` handlers | not unit tested |
| full browser flows (login, onboarding, navigation, Firebase integration) | not covered by Jest unit tests |
| visual rendering, responsive layout, and animation behavior | only indirectly covered |

### Exigences de couverture supplémentaires (Parcours Fidélité)

- Vérifier `computeCurrentStreak` sur les cas: continuité parfaite, jour manquant, mois vide, mélange transaction/login.
- Vérifier `computeMaxStreak` sur les cas: plusieurs séries, égalités de longueurs, données non triées.
- Vérifier `computeFullMonthProgress` sur les cas: mois complet, mois partiel, aucun jour actif.
- Vérifier le composant `DotRingBadge`: nombre de points rendus, nombre de points remplis, état visuel (`locked`, `in-progress`, `unlocked`) et présence des attributs SVG attendus.

---

## iOS App (XCTest)

### Code Structure Summary

The iOS app lives under `iOS/` and is organized around native SwiftUI + SwiftData layers:

```text
iOS/
└── BudgetFlow/
    ├── BudgetFlow/        # Application source
    │   ├── Models/        # Envelope, Transaction, UserSettings
    │   ├── Views/         # SwiftUI screens
    │   ├── Extensions.swift
    │   ├── DesignSystem.swift
    │   ├── NotificationService.swift
    │   └── SyncService.swift
    └── BudgetFlowTests/   # XCTest suite
```

### Run Tests in Xcode

1. Open `iOS/BudgetFlow/BudgetFlow.xcodeproj` (or the `.xcworkspace` if it exists) in Xcode.
2. Select the **BudgetFlow** scheme and a simulator target (e.g. iPhone 16).
3. Press **⌘U** (or go to **Product → Test**) to run the full test suite.

### View Coverage in Xcode

1. After running tests, open the **Report Navigator** (⌘9) and select the latest test run.
2. Click the **Coverage** tab to see per-file and per-function coverage percentages.
3. To enable coverage collection: **Product → Scheme → Edit Scheme → Test → Options → Code Coverage → Gather coverage for all targets**.

### Test File Location

```
iOS/BudgetFlow/BudgetFlowTests/
└── BudgetFlowTests.swift   — All XCTest test classes
```

### What Is Covered

| Test Class | Tested Components |
|------------|------------------|
| `ColorHexTests` | `Color(hex:)` 3/6-digit parsing, `#` prefix, white/black/amber; `toHex()` round-trip |
| `ColorFromStringTests` | `Color.fromString(_:)` Tailwind name mapping, opacity, unknown colours |
| `CalendarMonthTests` | `Calendar.startOfMonth(for:)`, `Calendar.endOfMonth(for:)` — all months, leap year |
| `MonthlySpentTests` | `monthlySpent(for:in:)` — single tx, multiple tx, no tx, out-of-range tx, boundary dates |
| `EnvelopeModelTests` | `Envelope` initialiser, default values, unique IDs, budget arithmetic |
| `TransactionModelTests` | `Transaction` initialiser, envelope relationship, `envelopeId` propagation |
| `UserSettingsModelTests` | `UserSettings` defaults, custom init, `available` budget calculation |
| `NotificationServiceTests` | Singleton identity, `scheduleWeeklyNotifications`, `cancelAllNotifications`, `requestPermission`, `currentAuthorizationStatus` |

### Coverage Target

The test suite targets **≥ 80% coverage** of pure-logic files. Firebase-calling and UI-rendering code is excluded from the coverage target because it requires a live Firebase project or a device/simulator with real user interaction.

---

## What Is Not Tested (and Why)

| Component | Reason |
|-----------|--------|
| `src/lib/firebase.ts`, `firebaseAdmin.ts` | Firebase SDK initialisation — requires live credentials |
| Most Next.js page components | Deeply coupled to Firebase, router, and client/server context |
| Most dashboard UI rendering details | Current tests focus on visible states, not pixel/visual output |
| API routes in `src/app/api/**` | Not covered by Jest today |
| `useCalendarHeatmap`, `useNotifications` | No dedicated unit tests yet |
| SwiftUI views | Require live rendering environment; tested via manual UI tests |
| `SyncService.swift` | Requires authenticated Firebase session |
