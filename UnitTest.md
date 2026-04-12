# Unit Tests

This document explains how to install dependencies and run unit tests for both the **Web App** (Next.js) and the **iOS App** (SwiftUI/XCTest).

---

## Web App (Jest)

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

Coverage is collected for `src/lib/**/*.ts` and `src/hooks/**/*.ts` (excluding Firebase adapters). A minimum of **80% line coverage** is enforced.

After running `npm run test:coverage`, a detailed report is printed to the terminal. An HTML report is generated in the `coverage/` directory — open `coverage/lcov-report/index.html` in a browser for a line-by-line view.

### Test File Locations

```
src/__tests__/
└── lib/
    ├── validation.test.ts   — All input validation functions
    ├── dateUtils.test.ts    — getMonthBounds, formatMonthYear
    └── logger.test.ts       — logger.info / warn / error / sanitizedError
```

### What Is Covered

| File | Functions Tested |
|------|-----------------|
| `src/lib/validation.ts` | `validateAmount`, `validateDescription`, `validateEnvelopeName`, `validateEnvelopeId`, `validateDate`, `validateEmail`, `validatePassword` |
| `src/lib/dateUtils.ts` | `getMonthBounds`, `formatMonthYear` |
| `src/lib/logger.ts` | `info`, `warn`, `error`, `sanitizedError` (dev + prod behaviour) |
| `src/components/dashboard/CalendarHeatmap.tsx` | `computeCurrentStreak`, `computeMaxStreak`, `computeFullMonthProgress`, rendu SVG de `DotRingBadge` |

### Exigences de couverture supplémentaires (Parcours Fidélité)

- Vérifier `computeCurrentStreak` sur les cas: continuité parfaite, jour manquant, mois vide, mélange transaction/login.
- Vérifier `computeMaxStreak` sur les cas: plusieurs séries, égalités de longueurs, données non triées.
- Vérifier `computeFullMonthProgress` sur les cas: mois complet, mois partiel, aucun jour actif.
- Vérifier le composant `DotRingBadge`: nombre de points rendus, nombre de points remplis, état visuel (`locked`, `in-progress`, `unlocked`) et présence des attributs SVG attendus.

---

## iOS App (XCTest)

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
| Next.js page components | Deeply coupled to Firebase, router, and server context |
| SwiftUI views | Require live rendering environment; tested via manual UI tests |
| `SyncService.swift` | Requires authenticated Firebase session |
