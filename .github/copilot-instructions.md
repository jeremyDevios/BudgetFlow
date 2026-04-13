# BudgetFlow Copilot Instructions

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

## Key conventions

- Use the `@/` alias for imports from `src`.
- Keep UI copy and route-facing text in **French** unless the surrounding file already uses another language.
- Firestore rules currently require **Google sign-in only** (`request.auth.token.firebase.sign_in_provider == 'google.com'`), which matches the web login flow in `src/app/(auth)/login/page.tsx`. Do not add other auth providers without updating both the login flow and `firestore.rules`.
- Date filtering relies on **string dates**, not Firestore `Timestamp`s. Monthly queries compare ISO-like strings such as `YYYY-MM-DD` and `YYYY-MM-DDT23:59:59`, and `dailyActivity` document IDs also use local `YYYY-MM-DD` keys. Preserve that format unless you are migrating all related queries, rules, and iOS sync code together.
- Validation rules are duplicated across layers on purpose: reusable client helpers in `src/lib/validation.ts`, server checks in `src/app/api/validate/transaction/route.ts`, and Firestore enforcement in `firestore.rules`. Keep constraints aligned across all three when changing data rules.
- Prefer the shared `logger` from `src/lib/logger.ts` for application errors, especially around Firebase/auth flows, so production logs stay sanitized.
- When changing transaction write flows, preserve the repo's current behavior of updating both the transaction document and the envelope's `spent` aggregate for compatibility with existing clients and data.
