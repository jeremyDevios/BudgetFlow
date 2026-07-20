# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Web app (Next.js)

```bash
npm install              # Install dependencies
npm run dev              # Dev server on 0.0.0.0:8091
npm run build            # Production build
npm start                # Production server on 0.0.0.0:8095
npm test                 # Full Jest suite
npm run test:coverage    # Jest with coverage (≥80% line coverage enforced)
npm test -- --runInBand src/__tests__/lib/forecasting.test.ts   # Single test file
npm test -- --runInBand --testNamePattern="validateAmount"      # Single test by name
npm run lint             # ESLint (currently broken on Next 16 — "Invalid project directory" error)
npm run test:e2e         # Playwright E2E tests (legacy config)
npm run test:e2e:headed  # Playwright with visible browser (legacy)
npm run test:e2e:install # Install Chromium for Playwright
npm run test:e2e:new     # Full E2E suite (58 tests, new config in playwrightTest/)
npm run test:e2e:new:headed  # Full E2E with visible browser
npm run test:e2e:auth    # Generate test auth session (run once)
npm run test:e2e:seed    # Force re-seed test data
```

### iOS

- Open `iOS/BudgetFlowIOS/BudgetFlow.xcodeproj` in Xcode
- Run tests with **⌘U**

### Firebase

```bash
firebase deploy --only firestore:rules   # Deploy Firestore security rules
```

## High-level architecture

### Web app

- **Next.js 16 App Router** project. Most feature pages are **client components** under `src/app/(protected)` and talk directly to Firebase with the client SDK. Server-only code is in API routes (`src/app/api/`) using `src/lib/firebaseAdmin.ts`.
- **Auth flow**: `src/app/layout.tsx` wraps everything in `AuthProvider`. `src/context/AuthContext.tsx` owns Firebase auth state, persistence, and 30-minute inactivity auto-sign-out. `src/app/(protected)/layout.tsx` gatekeeps authenticated routes: redirects unauthenticated users to `/login`, enforces onboarding via `isOnboarded` field, and writes a `dailyActivity/{YYYY-MM-DD}` document per day for the heatmap.
- **Budget architecture**: Transaction writes update both the `transactions` collection and the related envelope's `spent` field. Dashboard and envelope detail views recompute **monthly** spent totals from the selected month's transactions at render time.
- **Forecasting pattern**: Pure logic (`src/lib/forecasting.ts`) → data-loading hook (`src/hooks/useSpendingForecast.ts`) → UI. The calendar loyalty/streak feature follows the same pattern: `src/hooks/useCalendarHeatmap.ts` + `dailyActivity` documents.
- **Styling**: Semantic Tailwind tokens from CSS variables defined in `src/app/globals.css`. Theme-aware classes: `bg-app-bg`, `bg-app-surface`, `text-app-text`, `border-app-border`, etc. Dark mode via the `dark` class on `<html>`.

### Shared Firestore data model (Web + iOS)

All data is scoped under `users/{userId}`:

| Collection | Purpose |
|---|---|
| `users/{userId}` | Profile doc (displayName, email, fcmToken, notificationsEnabled) |
| `settings/general` | Single doc: income, fixed costs, savings, bentoPreset, anonymousMode, detailed breakdowns |
| `envelopes/{envelopeId}` | Budget envelopes with optional `isTemporary` + `activeMonths` for month-scoped visibility |
| `transactions/{transactionId}` | Transactions linked to envelopes, with `isReimbursement` flag |
| `dailyActivity/{YYYY-MM-DD}` | One doc per active login day, used by heatmap/streak calculations |

The iOS app mirrors this schema locally with SwiftData and syncs via `SyncCoordinator.swift` / `SyncService.swift`. See `DATABASE_STRUCTURE.md` for full details including conflict resolution, soft-delete, and offline queue.

### Temporary envelopes

An envelope marked `isTemporary: true` only appears in months listed in its `activeMonths` array (YYYY-MM strings). The pure function `isEnvelopeActiveForMonth()` in `src/types/envelope.ts` is the single source of truth — dashboard totals, cash flow, and available-budget calculations all route through it.

### Anonymous mode

A display-only privacy feature that masks currency amounts in the web UI. Toggled in Settings, persisted in Firestore `settings/general.anonymousMode`, hydrates via `src/context/AnonymousModeContext.tsx`. Masking is done by `src/lib/maskAmount.ts`.

## Database changes & backward compatibility

**The app is in production** with active users on both web and iOS. Any change to the Firestore data structure, security rules, or document shape **must** be backward-compatible with the previous production version of the iOS app and web app.

- **Firestore rules**: When adding/removing fields or changing validation, old clients writing the old set of fields must still pass all new rules. New fields should always be optional (`!('newField' in data) || ...`). A required field that old clients don't send will break them.
- **Document shape**: Adding a field is safe if old clients gracefully ignore unknown fields. Removing or renaming a field requires a migration plan. Changing a field's type or meaning is a breaking change.
- **Validation alignment**: Keep constraints aligned across `src/lib/validation.ts`, API routes, and `firestore.rules` — a change in one must be reflected in the others, and all three must accept the old format.
- **Unit tests are mandatory**: Every data-structure change must include regression tests proving that payloads matching the old client format still pass validation. Test specifically: old field sets with `hasOnly`, old value ranges, and old required-vs-optional constraints.

## Key conventions

- **`@/` alias** maps to `src/` (configured in tsconfig.json paths).
- **French is the default UI language** — keep copy and route-facing text in French unless a file already uses another language.
- **Google and Apple sign-in**: Firestore rules accept `sign_in_provider == 'google.com'` OR `'apple.com'`. When adding a new auth provider, update the login flow, `firestore.rules`, iOS `FirebaseManager`, and documentation together.
- **String dates everywhere**: Date filtering uses ISO string comparisons (`YYYY-MM-DD`, `YYYY-MM-DDT23:59:59`), not Firestore `Timestamp`s. Daily activity doc IDs are local `YYYY-MM-DD` keys. Preserve this format unless migrating all related queries, rules, and iOS sync code together.
- **Validation in three layers**: Client helpers in `src/lib/validation.ts`, server checks in `src/app/api/validate/transaction/route.ts`, and Firestore enforcement in `firestore.rules`. Keep constraints aligned across all three when changing data rules.
- **Use the shared `logger`** from `src/lib/logger.ts` for application errors (especially Firebase/auth flows) — it sanitizes sensitive data in production.
- **Transaction writes must update both** the transaction document and the envelope's `spent` aggregate.
- **Detailed mode invariants**: `fixedCostsDetailedEnabled`/`savingsDetailedEnabled` are auto-set to `false` when their items arrays are empty. Items are preserved when disabled (no data loss on toggle). Enforced at both read time (`loadSettings`) and write time (`normalizeSettingsPayload`).

## Testing strategy

- Pure logic in `src/lib/**` is tested first and has ≥80% line coverage (currently 94%+).
- Hooks are tested for state correctness, not implementation internals.
- Dashboard and critical UI flows have screen-level tests.
- Transaction create/edit/delete flows are tested at the component level.
- When fixing a bug, add a regression test proving the failure case.
- Firebase adapters (`src/lib/firebase.ts`, `firebaseAdmin.ts`) are excluded from coverage — they require live credentials.
