# BudgetFlow Copilot Instructions

Use this repository as the quality reference for future apps that should feel like BudgetFlow. Match its level of structure, UI consistency, testing discipline, and documentation quality instead of producing the smallest possible implementation.

## Build, test, and lint commands

### Web app (Next.js)

- Install dependencies: `npm install`
- Dev server: `npm run dev` (binds `0.0.0.0:8091`)
- Production build: `npm run build`
- Production server: `npm start` (binds `0.0.0.0:8095`)
- Full web test suite: `npm test`
- Coverage: `npm run test:coverage`
- Run one test file: `npm test -- --runInBand src/__tests__/lib/logger.test.ts`
- Run one named Jest test: `npm test -- --runInBand --testNamePattern="validateAmount"`
- Lint: `npm run lint`

`npm run lint` exists in `package.json`, but it currently fails in this repo/toolchain with `Invalid project directory .../lint` because the script is `next lint` on Next 16. Treat linting as needing script repair before relying on it.

### iOS app

- Open `iOS/BudgetFlow/BudgetFlow.xcodeproj` in Xcode
- Run tests with **Cmd+U**

## High-level architecture

- The web app is a **Next.js App Router** project, but most feature pages are **client components** under `src/app/(protected)` and talk directly to Firebase with the client SDK. The main server-only code is limited to API routes such as `src/app/api/validate/transaction/route.ts` and `src/app/api/notifications/trigger/route.ts`, which use `src/lib/firebaseAdmin.ts`.
- `src/app/layout.tsx` wraps the entire app in `AuthProvider` and injects the initial dark-mode script. `src/context/AuthContext.tsx` owns Firebase auth state, persistence, and inactivity sign-out. `src/app/(protected)/layout.tsx` is the gatekeeper for authenticated routes: it redirects unauthenticated users to `/login`, enforces onboarding via `users/{uid}/settings/general.isOnboarded`, and writes one `dailyActivity/{YYYY-MM-DD}` document per day.
- Firestore is the main shared backend model for both web and iOS. Everything is scoped under `users/{userId}` with four important branches: the user profile document, `settings/general`, `envelopes/{envelopeId}`, `transactions/{transactionId}`, and `dailyActivity/{YYYY-MM-DD}`. The iOS app mirrors this schema locally with SwiftData and syncs it through `iOS/BudgetFlow/BudgetFlow/SyncService.swift`.
- Budget calculations are split between stored data and derived data. Transaction writes update both `transactions` and the related envelope's `spent` field, but dashboard and envelope detail views recompute **monthly** spent totals from the selected month's transactions before rendering.
- Forecasting is intentionally separated into pure logic plus data-loading hooks: `src/lib/forecasting.ts` contains the pure projection algorithm, while `src/hooks/useSpendingForecast.ts` loads historical Firestore data and feeds the UI. The calendar loyalty/streak feature follows the same pattern with `src/hooks/useCalendarHeatmap.ts` plus `dailyActivity` documents.
- Styling is based on **semantic Tailwind tokens**, not raw page-by-page palettes. `tailwind.config.ts` defines `app.*` colors from CSS variables in `src/app/globals.css`, and components use classes like `bg-app-bg`, `bg-app-surface`, `text-app-text`, and `border-app-border`.

## Reference quality bar for future apps

When asked to build a new app in the spirit of BudgetFlow, preserve these characteristics by default.

### Product and UX expectations

- Build a polished, production-style app, not a demo shell.
- Favor **mobile-first** layouts that also scale cleanly to desktop.
- Use a dashboard-oriented information architecture with strong visual hierarchy, concise cards, and clear status states.
- Support **light and dark mode** from the beginning.
- Keep copy user-facing, direct, and consistent. In this repo, default copy is **French**.
- Prefer calm motion, clear feedback, and visible empty/loading/error states.

### Preferred project structure

For web projects, prefer this layout:

```text
src/
├── app/                # Routes, layouts, screen entry points
│   ├── (auth)/
│   ├── (protected)/
│   └── api/
├── components/         # Reusable UI by feature
├── context/            # Cross-cutting providers
├── hooks/              # Stateful client logic and data loading
├── lib/                # Pure business logic and shared utilities
└── __tests__/          # Tests grouped by app/components/hooks/lib
```

For iOS projects, prefer this layout:

```text
iOS/AppName/
├── AppName/
│   ├── Models/
│   ├── Views/
│   ├── Services/
│   ├── DesignSystem.swift
│   └── Extensions.swift
└── AppNameTests/
```

Rules behind that structure:

- Keep screen entry points obvious.
- Keep reusable pure logic in `lib/` or equivalent, not embedded inside views.
- Group UI by feature when possible; avoid large global component buckets.
- Put design tokens in one shared place per platform.
- Mirror important business entities across platforms with consistent naming and data shape.

### Design system expectations

- Use **semantic tokens** instead of hard-coded colors in feature components.
- Keep platform themes aligned: web tokens in CSS/Tailwind, iOS tokens in `DesignSystem.swift`.
- Reuse a consistent vocabulary for background, surface, text, secondary text, border, accent, positive, and negative states.
- Prefer rounded card surfaces, soft borders, restrained shadows, and strong typography contrast.
- Use tabular numbers for key financial values when alignment matters.
- Avoid one-off visual styles that bypass the design system unless there is a documented product reason.

### Architecture and implementation expectations

- Separate **pure business logic** from data access and rendering.
- Put calculations, projections, validation, and selection logic in testable helpers first.
- Use hooks/services/view models to load data and feed screens.
- Keep write paths explicit, especially when one action updates multiple persisted records.
- Preserve cross-platform compatibility in shared backend models and field formats.
- Prefer simple, explicit flows over abstract frameworks or deep indirection.

### Testing expectations

The testing strategy is part of the repo identity and should be preserved in future apps.

#### Web

- Use **Jest + Testing Library**.
- Cover pure logic in `src/lib/**` first.
- Add tests for important hooks when bugs can come from stale state or dependency issues.
- Add screen-level tests for critical dashboard states and high-value user-visible conditions.
- Add component tests for important mutation flows such as create, edit, and delete.
- Keep tests focused on observable behavior, not implementation internals.
- Maintain at least **80% line coverage** on the pure-logic target, and aim higher when practical.
- When fixing a bug, add a regression test that proves the exact failure no longer happens.

#### iOS

- Use **XCTest**.
- Cover models, extensions, date logic, formatting, and service logic with deterministic tests.
- Prefer testing pure Swift logic over fragile UI-level assertions.
- Keep SwiftUI rendering validation lightweight unless there is a strong reason for more.
- Match web parity on important business rules whenever both apps share the same behavior.

### Documentation expectations

Documentation quality should match the code quality.

- Keep `README.md` useful for a new developer: purpose, core features, stack, setup, tests, deployment, and project structure.
- Keep `UnitTest.md` accurate about test commands, coverage scope, current suites, and what is or is not covered.
- Add focused docs for important subsystems when needed, such as forecasting, notifications, security, or database structure.
- Update documentation whenever commands, architecture, feature behavior, or test scope changes.
- Prefer documentation that reflects the real repo state over aspirational documentation.

### Delivery checklist for future features

When implementing a new feature or a new app in this style, aim to leave all of the following true:

1. The structure follows the same feature-oriented layout.
2. The UI uses shared semantic design tokens and supports light/dark mode.
3. Business logic is extracted into testable modules.
4. Critical user flows have web tests and, when applicable, iOS tests.
5. Regressions discovered during development are captured by new tests.
6. README and any relevant subsystem docs are updated.
7. Commands and coverage expectations still reflect reality.

## Key conventions

- Use the `@/` alias for imports from `src`.
- Keep UI copy and route-facing text in **French** unless the surrounding file already uses another language.
- Firestore rules currently require **Google sign-in only** (`request.auth.token.firebase.sign_in_provider == 'google.com'`), which matches the web login flow in `src/app/(auth)/login/page.tsx`. Do not add other auth providers without updating both the login flow and `firestore.rules`.
- Date filtering relies on **string dates**, not Firestore `Timestamp`s. Monthly queries compare ISO-like strings such as `YYYY-MM-DD` and `YYYY-MM-DDT23:59:59`, and `dailyActivity` document IDs also use local `YYYY-MM-DD` keys. Preserve that format unless you are migrating all related queries, rules, and iOS sync code together.
- Validation rules are duplicated across layers on purpose: reusable client helpers in `src/lib/validation.ts`, server checks in `src/app/api/validate/transaction/route.ts`, and Firestore enforcement in `firestore.rules`. Keep constraints aligned across all three when changing data rules.
- Prefer the shared `logger` from `src/lib/logger.ts` for application errors, especially around Firebase/auth flows, so production logs stay sanitized.
- When changing transaction write flows, preserve the repo's current behavior of updating both the transaction document and the envelope's `spent` aggregate for compatibility with existing clients and data.
