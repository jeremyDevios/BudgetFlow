# BudgetFlow — Database Structure

## Overview

BudgetFlow uses **SwiftData as the single source of truth** on iOS. **Firebase Firestore** is an optional sync mirror — when a user connects a Google or Apple account, SwiftData pushes changes to Firestore and pulls remote changes on a configurable interval (default 5 minutes). Users who never connect an account keep all data local and offline-capable.

Sync is orchestrated by `SyncCoordinator.swift`, which wraps `SyncService.swift` and manages:
- Immediate push on every local mutation (add/edit/delete)
- Periodic background pull (`mergeFromFirestore`, default every 5 minutes)
- Offline operation queue (`PendingSyncOperation` SwiftData model) — operations are retried automatically when connectivity returns
- **Conflict resolution**: last-write-wins based on `updatedAt` timestamp
- **Soft delete detection**: Firestore documents with a `deletedAt` field are removed locally on next merge
- **Hard delete detection**: local items with a non-empty `firestoreId` that are absent from Firestore results are deleted locally

---

## Firestore Structure

All data is scoped per user under `users/{userId}`.

```
users/
  {userId}/
    (document fields)
    settings/
      general        ← single document
    monthlyIncomes/
      {YYYY-MM}      ← one doc per month with income override
    envelopes/
      {envelopeId}   ← one doc per envelope
    transactions/
      {transactionId} ← one doc per transaction
    dailyActivity/
      {YYYY-MM-DD}   ← one doc per active login day
    feedback/
      boards/         ← feedback boards (feature-requests, bugs, etc.)
      posts/          ← individual feedback posts + comments + votes
```

---

## `users/{userId}` — User Profile Document

Populated on sign-in (Google, Apple, or email). Not synced to SwiftData — read directly from FirebaseAuth on iOS.

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Full name |
| `email` | string | Email address |
| `photoURL` | string | Profile photo URL |
| `fcmToken` | string | Firebase Cloud Messaging push token |
| `notificationsEnabled` | boolean | Whether push notifications are enabled |
| `lastLogin` | string (ISO 8601) | Timestamp of last login |
| `lastTokenUpdate` | string (ISO 8601) | Timestamp of last FCM token update |

---

## `users/{userId}/settings/general` — App Settings

Single document with fixed ID `general`.

| Field | Type | iOS Model | Default |
|-------|------|-----------|---------|
| `monthlyIncome` | number | `UserSettings.monthlyIncome` | `0` |
| `isFixedIncome` | boolean | `UserSettings.isFixedIncome` | `true` |
| `fixedCosts` | number | `UserSettings.fixedCosts` | `0` |
| `monthlySavings` | number | `UserSettings.monthlySavings` | `0` |
| `currency` | string | `UserSettings.currency` | `"EUR"` |
| `anonymousMode` | boolean | `UserSettings.anonymousMode` | `false` |
| `bentoPreset` | string | `UserSettings.bentoPreset` | `"balanced"` |
| `isOnboarded` | boolean | `UserSettings.isOnboarded` | `false` |
| `createdAt` | string (ISO 8601) | `UserSettings.createdAt` | Creation date |
| `updatedAt` | string (ISO 8601) | `UserSettings.updatedAt` | Last update date |
| `fixedCostsDetailedEnabled` | boolean | `UserSettings.fixedCostsDetailedEnabled` | `false` |
| `savingsDetailedEnabled` | boolean | `UserSettings.savingsDetailedEnabled` | `false` |
| `fixedCostsItems` | array\<[FixedCostItem](#fixedcostitem--savingsitem-sub-document-shape)\> | `UserSettings.fixedCostsItems` (SwiftData relational — see below) | `[]` |
| `savingsItems` | array\<[SavingsItem](#fixedcostitem--savingsitem-sub-document-shape)\> | `UserSettings.savingsItems` (SwiftData relational — see below) | `[]` |

### `FixedCostItem` / `SavingsItem` — Sub-document shape

Both `fixedCostsItems` and `savingsItems` store an array of objects with the following fields. In Firestore these are **embedded arrays**; on iOS they are persisted as a **separate SwiftData model** with a `@Relationship` to `UserSettings` (see [iOS SwiftData Models](#ios-swiftdata-models)).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Stable identifier for the line item |
| `name` | string | User-defined label (e.g. `"Loyer"`, `"Livret A"`) |
| `amount` | number | Amount for this line item |

### Detailed mode business rules

- When `fixedCostsDetailedEnabled` is `true`, the sum of `fixedCostsItems[].amount` is used as the effective fixed-costs total; the global `fixedCosts` field is ignored.
- When `savingsDetailedEnabled` is `true`, the sum of `savingsItems[].amount` is used as the effective savings total; the global `monthlySavings` field is ignored.
- **Disabling** detailed mode does **not** delete the items — they are preserved so that re-enabling the mode restores the previous breakdown without data loss.
- If `fixedCostsItems` (resp. `savingsItems`) is empty, the corresponding `*DetailedEnabled` flag **must** be `false`; the global manual amount is then used instead.

### `isFixedIncome` behaviour

- When `true` (default), the global `monthlyIncome` is used for every month.
- When `false`, the user can set a per-month income override via the `monthlyIncomes` subcollection.
- For any given month, the effective income is resolved by `resolveMonthlyIncome()` in `src/lib/monthlyIncomeService.ts`:
  1. Explicit entry for that month in `monthlyIncomes` (if exists).
  2. Most recent past month with an entry (if any).
  3. Global `monthlyIncome` fallback.
- Switching from variable back to fixed does **not** delete the per-month entries — they are preserved but ignored until the user switches back.
- On iOS, the same logic is handled by the `MonthlyIncome` SwiftData model and resolved in `BudgetCalculations.swift`.

### `currency` behaviour

- `currency` is a display-only field controlling how amounts are rendered (EUR, USD, CHF, GBP, BTC).
- No conversion is performed — stored amounts are always raw numbers in the user's configured currency.
- Legacy documents without this field default to `"EUR"`.
- The `CurrencyContext.tsx` (Web) and `UserSettings.currency` (iOS) hydrate this value at app startup.

### `anonymousMode` behaviour

- Display-only privacy toggle that masks all currency amounts in the UI.
- Pure visual masking — no data is modified.
- Web: toggle in navbar via `AnonymousModeContext.tsx`, masking by `src/lib/maskAmount.ts`.
- iOS: shake-to-toggle gesture via `AnonymousModeManager.swift`, plus Settings toggle.

### `bentoPreset` behaviour

- Controls dashboard grid density. Values: `"compact"`, `"balanced"`, `"airy"`.
- Affects spacing and tile sizes in the Bento Grid layout.
- Web: used by the dashboard bento grid component.
- iOS: consumed by `BentoLayoutEngine.swift`.

---

## `users/{userId}/monthlyIncomes/{YYYY-MM}` — Per-Month Income Overrides

One document per month where the user has set a specific income override. Document ID is `YYYY-MM` format (e.g. `"2026-07"`). This subcollection is **only** used when `isFixedIncome === false`.

| Field | Type | Description |
|-------|------|-------------|
| `amount` | number | Income amount for this specific month (≥ 0, ≤ 100000000) |

### Business rules

- Each document represents an explicit override for that month.
- Documents are created/updated from the dashboard when the user edits their income for a given month.
- Deleting a document reverts that month to the resolution fallback (most recent past entry or global `monthlyIncome`).
- The resolution is handled client-side by `resolveMonthlyIncome()` (`src/lib/monthlyIncomeService.ts`) — Firestore does not perform fallback logic.

---

## `users/{userId}/envelopes/{envelopeId}` — Envelopes

One document per budget envelope. Document ID is auto-generated by Firestore and stored as `firestoreId` on iOS.

| Field | Type | iOS Model | Description |
|-------|------|-----------|-------------|
| `name` | string | `Envelope.name` | Envelope label |
| `icon` | string | `Envelope.icon` | Icon name (e.g. `"ShoppingCart"`) |
| `color` | string | `Envelope.color` | Tailwind color class (e.g. `"bg-purple-500"`) |
| `budget` | number | `Envelope.budget` | Monthly budget amount |
| `spent` | number | `Envelope.spent` | Total amount spent |
| `order` | number | `Envelope.order` | Display order index |
| `tileSize` | string (optional) | `Envelope.tileSize` | Bento grid size override: `"small"`, `"wide"`, or absent/`null` for default. Supports bento grid layout on both Web and iOS. |
| `isTemporary` | boolean (optional) | `Envelope.isTemporary` | When `true`, the envelope is month-scoped (see below). Absent or `false` = always active. |
| `activeMonths` | array\<string\> (optional) | `Envelope.activeMonths` | List of `YYYY-MM` strings that define which months the envelope is active. Ignored when `isTemporary` is falsy. |
| `createdAt` | string (ISO 8601) | `Envelope.createdAt` | Creation date |
| `updatedAt` | string (ISO 8601) | `Envelope.updatedAt` | Last mutation timestamp — used for last-write-wins conflict resolution |
| `deletedAt` | string (ISO 8601, optional) | `Envelope.deletedAt` | When present, the envelope is soft-deleted; iOS removes it locally on next merge |

### Temporary envelope behaviour

An envelope is **permanent** (default) when `isTemporary` is absent or `false` — it is included in every month's dashboard calculations regardless of `activeMonths`.

An envelope is **temporary** when `isTemporary === true`. In that case:

- It appears in dashboard totals and budget calculations **only for months whose `YYYY-MM` string is present in `activeMonths`**.
- A temporary envelope with an empty or absent `activeMonths` array is effectively inactive in every month.
- `activeMonths` entries are `YYYY-MM` strings (e.g. `"2025-03"`). The UI writes one entry per selected calendar month.

The helper `isEnvelopeActiveForMonth(envelope, "YYYY-MM")` (defined in `src/types/envelope.ts`) encodes this logic and is the single source of truth used by the dashboard and all budget calculations.

---

## `users/{userId}/transactions/{transactionId}` — Transactions

One document per transaction. Document ID is auto-generated by Firestore and stored as `firestoreId` on iOS.

| Field | Type | iOS Model | Description |
|-------|------|-----------|-------------|
| `amount` | number | `Transaction.amount` | Transaction amount |
| `description` | string | `Transaction.note` | User note / label |
| `envelopeId` | string | `Transaction.envelopeId` | Firestore document ID of the linked envelope |
| `date` | string (ISO 8601) | `Transaction.date` | Transaction date |
| `isReimbursement` | boolean | `Transaction.isReimbursement` | `true` when the transaction reduces `spent` (refund/reimbursement) |
| `createdAt` | string (ISO 8601) | `Transaction.createdAt` | Creation date |
| `updatedAt` | string (ISO 8601) | `Transaction.updatedAt` | Last mutation timestamp — used for last-write-wins conflict resolution |
| `deletedAt` | string (ISO 8601, optional) | `Transaction.deletedAt` | When present, the transaction is soft-deleted; iOS removes it locally on next merge |

---

## `users/{userId}/dailyActivity/{YYYY-MM-DD}` — Activité quotidienne

One document per day (document ID = `YYYY-MM-DD`) used by the dashboard heatmap.

| Field | Type | Description |
|-------|------|-------------|
| `loggedIn` | boolean | `true` when user logged in that day |
| `date` | string (`YYYY-MM-DD`) | Local date key used for monthly filtering |

### Note métier — Parcours Fidélité

La logique de streak du Parcours Fidélité est actuellement calculée à la volée côté client à partir de deux ensembles de dates :
- `transactionDates` : jours ayant au moins une transaction
- `loginDates` : jours avec connexion utilisateur

Les fonctions de calcul (`computeCurrentStreak`, `computeMaxStreak`, `computeFullMonthProgress`) ne reposent donc pas sur un compteur persistant en base à ce stade.

Sur iOS, le calcul est implémenté dans `CalendarStreakCalculator.swift` (parité avec le Web `useCalendarHeatmap.ts`).

---

## `users/{userId}/feedback/` — Feedback System

The feedback system allows users to submit feature requests, bug reports, and other suggestions. It is organized as a public roadmap with voting.

### `feedback/boards/{boardId}` — Feedback Boards

Top-level categorization for feedback items (e.g. "Feature Requests", "Bugs", "Improvements").

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Board display name |
| `description` | string | Board purpose |
| `color` | string | Accent color for the board |
| `order` | number | Display order |
| `createdAt` | string (ISO 8601) | Creation date |

### `feedback/posts/{postId}` — Individual Feedback Posts

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Post title |
| `description` | string | Detailed description |
| `boardId` | string | Reference to parent board |
| `statusId` | string | Current status (e.g. "under-review", "planned", "completed") |
| `authorId` | string | Firebase Auth UID of the author |
| `authorName` | string | Display name of the author |
| `voteCount` | number | Net vote count (upvotes - downvotes) |
| `commentCount` | number | Number of comments |
| `createdAt` | string (ISO 8601) | Creation date |
| `updatedAt` | string (ISO 8601) | Last update date |

### `feedback/posts/{postId}/comments/{commentId}` — Comments

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Comment text |
| `authorId` | string | Firebase Auth UID |
| `authorName` | string | Display name |
| `createdAt` | string (ISO 8601) | Creation date |

### `feedback/posts/{postId}/votes/{userId}` — Votes

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | `1` for upvote, `-1` for downvote |
| `userId` | string | Firebase Auth UID |
| `createdAt` | string (ISO 8601) | Vote date |

The feedback API is served by routes under `src/app/api/feedback/`:
- `GET/POST /api/feedback/boards`
- `GET/POST /api/feedback/posts`
- `GET/PATCH/DELETE /api/feedback/posts/[id]`
- `POST /api/feedback/posts/[id]/vote`
- `GET/POST /api/feedback/posts/[id]/comments`
- `GET /api/feedback/statuses`

On iOS, the service is implemented in `FeedbackService.swift` with corresponding views: `FeedbackListView`, `FeedbackDetailView`, `FeedbackCreateView`.

---

## iOS SwiftData Models

SwiftData mirrors the Firestore schema locally for offline mode. Key mapping notes:

- `Envelope.firestoreId` — Firestore document ID (empty string when offline-only)
- `Transaction.firestoreId` — Firestore document ID (empty string when offline-only)
- `Envelope.updatedAt` / `Transaction.updatedAt` — stamped on every local mutation; compared against Firestore during merge for last-write-wins resolution
- `Envelope.deletedAt` / `Transaction.deletedAt` — set remotely via Firestore soft delete; iOS removes the local record on next merge
- `Envelope.tileSize` — synced to Firestore; consumed by `BentoLayoutEngine.swift` for dashboard grid layout
- `UserSettings.isOnlineMode` — local flag to determine sync mode (not stored in Firestore)
- `UserSettings.firebaseUserId` — UID from FirebaseAuth, used as Firestore user document ID
- `UserSettings.isFixedIncome` — controls whether the dashboard shows per-month income editing
- `UserSettings.currency` — display-only currency code (EUR, USD, CHF, GBP, BTC); no conversion
- `UserSettings.anonymousMode` — display-only privacy masking; toggled via shake gesture or Settings
- `UserSettings.bentoPreset` — dashboard density: `compact`, `balanced`, `airy`

### `PendingSyncOperation` — Offline queue model

Operations queued while the device is offline (or while a sync is in flight) are persisted as `PendingSyncOperation` records in SwiftData. The coordinator processes and clears them automatically when connectivity returns.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Stable identifier |
| `entityType` | string (`"envelope"`, `"transaction"`, `"settings"`) | Type of the entity being synced |
| `entityLocalId` | string | SwiftData UUID string of the entity (used for upsert lookups) |
| `entityFirestoreId` | string | Firestore document ID (used for hard deletes) |
| `operationType` | string (`"upsert"`, `"delete"`) | Operation to perform |
| `createdAt` | Date | When the operation was enqueued |
| `retryCount` | Int | Number of failed attempts so far (max `SyncCoordinator.maxRetryCount = 3`) |

Upsert operations for the same entity are **coalesced**: a newer upsert replaces any older pending upsert for the same `entityLocalId`, so only the latest state is pushed to Firebase.

### `MonthlyIncome` — Per-month income overrides

When `isFixedIncome` is `false`, per-month overrides are stored as individual `MonthlyIncome` records in SwiftData:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Stable identifier |
| `month` | string | `YYYY-MM` key |
| `amount` | number | Income amount for this month |
| `firestoreId` | string | Firestore document ID (empty when offline-only) |
| `updatedAt` | Date | Last mutation timestamp |

### Detailed-mode sub-categories (iOS relational structure)

The Firestore embedded arrays `fixedCostsItems` and `savingsItems` are modelled on iOS as **dedicated SwiftData models** linked via `@Relationship`:

```
UserSettings  1 ──────────────────── * FixedCostItem
                @Relationship(.cascade)   id: String
                fixedCostsItems            name: String
                                           amount: Double

UserSettings  1 ──────────────────── * SavingsItem
                @Relationship(.cascade)   id: String
                savingsItems               name: String
                                           amount: Double
```

`deleteRule: .cascade` ensures sub-items are removed when the parent `UserSettings` record is deleted. During a Firestore → SwiftData sync, the arrays are diffed by `id` to avoid unnecessary deletes and re-inserts.

### Additional iOS-specific models

| Model | Purpose |
|-------|---------|
| `BudgetSubItem.swift` | Shared model for `FixedCostItem` / `SavingsItem` |
| `BentoLayoutEngine.swift` | Computes grid layouts from `tileSize` and `bentoPreset` |
| `WidgetSnapshotStore.swift` | Persists widget snapshot data for WidgetKit |
| `WidgetSnapshotSignature.swift` | Hashing for widget data integrity |
| `DailyActivity.swift` | Mirrors Firestore `dailyActivity` documents |
| `CalendarStreakCalculator.swift` | Pure-logic streak computation (parity with Web `useCalendarHeatmap.ts`) |

### Migration Notes

SwiftData uses `@Attribute(originalName:)` for backward-compatible field renames:
- `Transaction.description` ← was `note`
- `Envelope.order` ← was `orderIndex`
- `UserSettings.isOnboarded` ← was `isOnboardingCompleted`

---

## Sync Strategy

| Event | Action |
|-------|--------|
| App launch (online mode) | `SyncCoordinator.start()` → process pending queue → `mergeFromFirestore` |
| Add/edit/delete envelope | `SyncCoordinator.queueOrSyncEnvelope/queueOrDeleteEnvelope` — immediate push if online, else enqueue |
| Add/edit/delete transaction | `SyncCoordinator.queueOrSyncTransaction/queueOrDeleteTransaction` — immediate push if online, else enqueue |
| Settings change | `SyncCoordinator.queueOrSyncSettings` — immediate push if online, else enqueue |
| Monthly income change | `SyncCoordinator.queueOrSyncMonthlyIncome` — immediate push if online, else enqueue |
| Pull-to-refresh (Dashboard) | `SyncCoordinator.manualSync` → process pending queue → `mergeFromFirestore` |
| Periodic background sync | Every 5 minutes (`SyncCoordinator.syncIntervalSeconds`) → process pending queue → `mergeFromFirestore` |
| Connectivity restored | `NWPathMonitor` notifies coordinator → process pending queue |
| App foreground | `ContentView.scenePhase` active → `recordDailyLoginIfNeeded` |
| First online sign-in | `SyncService.loadFromFirestore` (full import) → coordinator started |
| Connect account from Settings | `SyncService.checkDataExists` → import if exists → coordinator started |
| Account deletion | `FirebaseAccountHelpers.deleteAccount()` → `POST /api/account/delete` → `adminDb.recursiveDelete()` → clear local SwiftData |

`SyncService.mergeFromFirestore` performs a **bidirectional merge**:
1. Fetch all remote envelopes, transactions, monthly incomes, and settings
2. For each remote doc: if `deletedAt` is set → delete local record; else compare `updatedAt` → keep newer version
3. For each local record with a non-empty `firestoreId` missing from remote results → delete locally (hard delete propagation)

Sync is implemented in `SyncCoordinator.swift` (orchestration) and `SyncService.swift` (Firebase I/O).

---

## Firestore Security Rules

See [`firestore.rules`](firestore.rules) — users can only read/write their own data (`/users/{userId}/**`).
