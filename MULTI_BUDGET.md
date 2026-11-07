# MULTI_BUDGET — Budgets multiples par compte

**Étude de faisabilité + spécification** — Web + iOS — 2026-11-03

> Statut : étude validée par l'utilisateur sur les 4 décisions produit (§2).
> Les références `fichier:ligne` proviennent d'une cartographie exhaustive des accès Firestore (web `src/` + iOS `iOS/BudgetFlowIOS/`).

---

## 1. Résumé exécutif

Fonctionnalité : jusqu'à **5 budgets totalement indépendants** par compte — chacun avec son salaire/revenus, charges fixes, épargne, enveloppes et transactions. Sélecteur sur le dashboard, gestion (nom / icône / couleur) depuis les Paramètres. **Payant sur iOS** (achat in-app), **gratuit sur le web**. Isolation stricte : progression, analyses, historique et prévisions ne se calculent que sur le budget sélectionné.

**Approche retenue — l'isolation par sous-collections dédiées :**

- Les données actuelles du compte forment le **« budget par défaut »** : elles restent dans les collections existantes (`settings/general`, `envelopes`, `transactions`, `monthlyIncomes`) **sans aucun changement de forme**.
- Les budgets 2 à 5 vivent dans de **nouvelles sous-collections** `users/{uid}/budgets/{budgetId}/…` que les anciens clients web et iOS **ne voient physiquement pas** : zéro mélange de données, zéro risque d'écrasement de champs par la sync d'une ancienne version, zéro migration.
- La limite de 5 est imposée **côté serveur** par des IDs de slots fixes (`budget-1` … `budget-5`) : impossible de créer un 6ᵉ budget, même avec un client modifié.
- **Aucun champ n'est ajouté aux documents existants** → les payloads des anciens clients continuent de passer les validateurs `hasOnly` des règles Firestore. C'est la garantie anti-régression structurelle.

**Coût/risque principal** : tous les points de lecture/écriture des deux apps doivent devenir « budget-aware » (résolution de chemin + scoping des requêtes). La cartographie les a tous identifiés (§7, §8).

---

## 2. Décisions produit actées (2026-11-03)

| Décision | Choix retenu |
|---|---|
| Partage entre comptes | **Mono-utilisateur** — un budget n'appartient qu'à un compte (« compte joint » = simple exemple de budget). Architecture laissant la porte ouverte (champ `owner` implicite = `userId` du chemin), sans l'implémenter. |
| Contournement du paywall via le web | **Vérification StoreKit locale** sur iOS (pattern widgets) : sans achat, l'iOS masque le multi-budget ; les budgets créés sur le web restent intacts et réapparaissent après l'achat. Pas de flag Firebase (spoofable sans validation serveur des reçus App Store). |
| Limite de 5 budgets | **Budget par défaut inclus** : 5 au total = défaut + 4 créations. |
| Quota d'enveloppes | **50 par budget** (acté 2026-11-03) — compteurs dédiés par slot dans `counters/{userId}` (§5.2) |
| Streak fidélité (Parcours Fidélité) | **Par budget** (acté 2026-11-03) — série et badges calculés avec les transactions du budget affiché (+ jours de connexion globaux) |
| Suppression d'un budget | ~~Soft-delete~~ → **Suppression DÉFINITIVE (hard delete)** — révisée le 2026-11-07 à la demande de l'utilisateur : confirmation explicite puis suppression irréversible en base et localement, via la route API admin `/api/budgets/delete` (recursiveDelete) ; le slot est libéré (la limite de 5 ne compte que les budgets existants). Le budget par défaut est non supprimable. |

---

## 3. Architecture cible

### 3.1 Principe d'isolation

```
users/{uid}/
  (doc profil)                    ← INCHANGÉ (pas de nouveau champ : les anciens
                                     clients réécrivent ce doc en entier)
  settings/general                ← budget DÉFAUT (réglages financiers) + préférences
                                     globales (bentoPreset, anonymousMode, currency,
                                     isOnboarded) — INCHANGÉ
  envelopes/                      ← enveloppes du budget DÉFAUT — INCHANGÉ
  transactions/                   ← transactions du budget DÉFAUT — INCHANGÉ
  monthlyIncomes/                 ← revenus variables du budget DÉFAUT — INCHANGÉ
  dailyActivity/                  ← global (activité de connexion) — INCHANGÉ
  feedback/                       ← INCHANGÉ
  state/currentBudget             ← NOUVEAU doc {budgetId, updatedAt} (absent = défaut)
  budgets/                        ← NOUVEAU (sous-collections par budget 2 à 5)
    budget-1/
      (doc)                       ← méta : name, icon, color, createdAt, updatedAt, deletedAt
      settings/general            ← réglages financiers du budget (réutilise le validateur
                                     de settings existant ; les champs globaux
                                     bentoPreset/anonymousMode/currency/isOnboarded
                                     ne sont pas écrits ici)
      envelopes/
      transactions/
      monthlyIncomes/             ← revenus variables par budget
    budget-2/ … budget-5/         ← idem (slots fixes)
```

**Pourquoi pas un simple champ `budgetId` sur les docs existants ?** Parce que l'ancienne app iOS sync **toutes** les transactions/enveloppes du compte (`SyncService.swift:314-317`), les mapperait sans `budgetId` dans SwiftData, les **afficherait mélangées** au budget par défaut, et la détection hard-delete (`mergeFromFirestore`) pourrait même les supprimer localement. Les sous-collections dédiées rendent les budgets 2-5 **invisibles** pour les anciennes versions : c'est la seule option qui garantit l'isolation sans pouvoir modifier les clients déjà publiés.

### 3.2 Document budget (méta)

| Champ | Type | Contraintes |
|---|---|---|
| `name` | string | 1–50 caractères (miroir des enveloppes) |
| `icon` | string | ≤ 100 — clé d'icône partagée : Lucide côté web (`ICON_MAP`, `src/app/(protected)/dashboard/page.tsx:100`), SF Symbol côté iOS (même mécanisme que `Envelope.icon`) |
| `color` | string | ≤ 100 — classe Tailwind de la palette existante (`"bg-amber-500"`…), identique aux enveloppes |
| `createdAt` / `updatedAt` | string ISO | comme les autres collections |
| `deletedAt` | string ISO, optionnel | soft-delete ; **présent dans le validateur dès le départ** (nouvelle collection, pas de contrainte legacy — cf. §4.4) |

### 3.3 Le budget courant

- Doc **`users/{uid}/state/currentBudget`** : `{budgetId: 'default' | 'budget-1'…'budget-5', updatedAt}`. **Absent = budget par défaut.**
- Synchronisé entre appareils (web ↔ iOS) par construction. Conflit éventuel = last-write-wins sur `updatedAt` (sans conséquence métier : c'est une préférence d'affichage).
- **Pourquoi un doc séparé et pas un champ dans `users/{uid}` ou `settings/general` ?** Les anciens clients réécrivent le profil utilisateur en entier (`setDoc` complet, login) et `saveSettings` fait un overwrite canonique (`src/lib/settingsService.ts:441-461`) — un champ ajouté y serait **effacé** par la première écriture d'une ancienne version. `state/currentBudget` est un chemin inconnu des anciens clients : ils ne peuvent pas le toucher. Même pattern que les compteurs `counters/{userId}` (« iOS n'écrit jamais les compteurs — zéro régression », `firestore.rules`).

### 3.4 Limite de 5 budgets — slots fixes côté règles

- IDs de budget fixes : `budget-1` … `budget-5`. La règle `create` n'accepte que ces 5 IDs → **la limite est imposée côté serveur**, sans compteur, sans course (deux appareils qui créent en parallèle : un seul gagne le slot, l'autre reçoit « déjà existant » et passe au slot suivant).
- **Suppression définitive (hard delete, révisé 2026-11-07)** : le doc budget est supprimé via la route API admin → **le slot est libéré** et peut être réutilisé. La limite de 5 compte uniquement les budgets existants.

### 3.5 Suppression définitive & confirmation

- Supprimer = **confirmation explicite** (nom du budget affiché), puis appel de la route API admin **`POST /api/budgets/delete`** (`{budgetId}` + token Bearer) : `recursiveDelete` de `users/{uid}/budgets/{budgetId}` (settings, enveloppes, transactions, revenus mensuels), libération du compteur `envelopeCounts.<slot>`, repli du `state/currentBudget` sur `'default'` si nécessaire.
- Côté clients : **l'API d'abord** (en cas d'échec réseau, rien n'est supprimé localement — sinon un pull ultérieur ressusciterait le budget depuis Firestore), puis nettoyage local (Budget, BudgetSettings, enveloppes/transactions/revenus `budgetId == slot`) et repli du sélecteur.
- **Irréversible** — toutes les données du budget (transactions, analyses, historique) sont perdues. Le slot redevient disponible.
- Le budget par défaut est **non supprimable** : il héberge les données des anciens clients et `settings/general` (référencé par l'onboarding et le gate `isOnboarded`).

### 3.6 Réglages financiers par budget

- Budget défaut → `settings/general` existant (inchangé).
- Budgets 2-5 → `budgets/{budgetId}/settings/general`, **mêmes champs financiers** (`monthlyIncome`, `isFixedIncome`, `fixedCosts`+items, `monthlySavings`+items, `incomeHistory`/`fixedCostsHistory`/`savingsHistory`, `customMonthEnabled`/`customMonthStartDay`/`customMonthStartOverrides`). Le validateur `isValidSettingsData` est **réutilisé tel quel** dans les règles.
- Conséquences par budget : jour de début de mois (`customMonth*`), historiques versionnés, mode détaillé — tout est indépendant par budget, conformément à « chaque budget a son propre salaire, ses propres charges fixes et son épargne ».
- Les préférences d'affichage restent **globales** : `bentoPreset`, `anonymousMode`, `currency` (lues dans `settings/general` ; `CurrencyContext` inchangé).

### 3.7 Revenus variables par budget

`isFixedIncome === false` → surcharges mensuelles dans `budgets/{budgetId}/monthlyIncomes/{YYYY-MM}` (validateur `isValidMonthlyIncomeData` réutilisé). Résolution identique à `resolveMonthlyIncome()` (`src/lib/settingsService.ts:102`), appliquée au doc settings du budget courant.

---

## 4. Rétrocompatibilité & anti-régression (exigence principale)

### 4.1 Ce qui ne change pas

| Élément | Statut |
|---|---|
| `users/{uid}` (profil) | **Aucun champ ajouté** (les anciens clients le réécrivent en entier : login web `setDoc merge:true` `login/page.tsx:65`, `useNotifications.ts:53-58` ; iOS `lastLogin`) |
| `settings/general` | **Aucun champ ajouté** — `hasOnly` inchangé dans les règles, `saveSettings` et `buildSettingsPayload` inchangés |
| `envelopes/`, `transactions/`, `monthlyIncomes/` (legacy) | **Aucun champ ajouté, aucun changement de règles** |
| `dailyActivity/` | Inchangé — global (jours de connexion, `layout.tsx:59-71`) |
| `counters/{userId}` | Inchangé (quota enveloppes partagé, §5.2) |
| Règles des collections existantes | Inchangées |

### 4.2 Pourquoi les anciens clients ne peuvent rien casser

1. **Ancien iOS** : ses queries sont codées sur les chemins legacy (`SyncService.swift:314-317`, 1016-1019) → il ne télécharge, n'affiche et n'écrit que le budget par défaut. Il ignore totalement `budgets/**` et `state/**`.
2. **Anciennes écritures** : toutes les écritures iOS de docs existants sont `merge: true` avec payload explicite (`SyncService.swift:679, 749, 688-709, 712-733, 878-889, 946` — contrat documenté dans le code : « les anciens clients ignorent les clés inconnues, et `merge: true` garantit qu'ils ne les écrasent jamais ») → aucun risque d'effacement de champ, et de toute façon **aucun champ n'est ajouté aux docs legacy**.
3. **Ancien web** (onglet resté ouvert sur une vieille version) : n'écrit que les chemins legacy → pas d'écriture croisée possible.
4. **Suppression de compte** : `recursiveDelete` (`api/account/delete/route.ts:65`) supprime `budgets/**` et `state/**` automatiquement — rien à faire.
5. **Index Firestore** : les index composites sont définis **par nom de collection** (pas par chemin) — les sous-collections `envelopes`/`transactions` de `budgets/{id}` réutilisent les index existants déclarés dans la console Firebase (`firestore.indexes.json` est vide). Aucune déclaration d'index nécessaire (à confirmer côté console).

### 4.3 Points de vigilance iOS (vérifiés dans le code)

| Mécanisme | Risque | Atténuation |
|---|---|---|
| `loadFromFirestore` (`SyncService.swift:301-435`) : `deleteAll` + réimport **destructif** (utilisé à la connexion de compte / onboarding) | Réimport non budget-scopé effacerait les données locales des budgets 2-5 | Scoper le réimport par budget (défaut toujours ; budgets 2-5 seulement si entitlement présent) |
| Balayage **hard-delete** du merge (`1062-1066, 1120-1124, 1151-1155`) : local `firestoreId` absent du snapshot distant → suppression locale | Les limites de lecture (100 enveloppes / 5000 transactions / 100 monthlyIncomes, `314-317, 1016-1019`) font passer les docs au-delà de la limite pour « manquants » | Le sync budget-scopé **réduit** ce risque (limites appliquées par budget et non plus globalement) ; conserver les limites par budget |
| Mappers à liste de champs fixe (`makeEnvelope 1174-1190`, `applyEnvelopeData 1192-1203`, `makeTransactionFromData 68-91`, `applyTransactionData 1210-1234`) | Un nouveau champ ne serait pas hydraté localement | Les nouveaux modèles SwiftData (`Budget`, `budgetId` sur Envelope/Transaction/MonthlyIncome) sont ajoutés aux mappers dans la **nouvelle** version uniquement — les anciennes ne voient que le legacy |
| `PendingSyncOperation` sans dimension budget (`PendingSyncOperation.swift:16-52`) | Une opération offline ne saurait pas vers quel chemin pousser | Ajouter `budgetId: String?` (nil = défaut) au modèle + aux fonctions d'enqueue (`SyncCoordinator.swift:87-173`) |
| Précision `updatedAt` : iOS écrit sans fraction de seconde, web avec (`SyncService.swift:6-23`) | LWW indécis sur deux écritures dans la même seconde | Préexistant, inchangé — à surveiller sur les nouveaux docs (budgets/state) |

### 4.4 Constat annexe — `deletedAt` incohérent dans l'existant

`DATABASE_STRUCTURE.md` documente la soft-delete Firestore via `deletedAt`, mais :
- les validateurs `hasOnly` actuels **n'acceptent pas** `deletedAt` (`firestore.rules:136-139, 165-168`) ;
- le web supprime en **dur** (`batch.delete` / `deleteDoc` : `envelopeService.ts:160, 236, 265, 281-295`, `EnvelopeDetailClient.tsx:283`, `TransactionModal.tsx:170, 221, 265, 620`) ;
- l'iOS **lit** `deletedAt` entrant (`SyncService.swift:1042-1045, 1092-1095`) mais ne l'écrit jamais (suppressions dures `955-982, 984-996`).

→ La soft-delete Firestore documentée n'est actuellement **écrivable par aucun client**. Pour les budgets (nouvelle collection), `deletedAt` est inclus dans le validateur dès le départ (§5) ; pour les collections legacy, ce constat est hors périmètre de cette feature mais mérite une correction documentaire ultérieure.

### 4.5 Tests de régression imposés (exigence CLAUDE.md)

Toute évolution de règles/validation doit prouver que les payloads des anciens clients passent toujours :
- payloads enveloppe/transaction/settings **au format legacy** (sans les champs nouveaux) → `validation.ts` + règles ;
- tests web existants exécutés **en mode 1 budget** (comportement strictement identique à aujourd'hui : le sélecteur est masqué, les chemins legacy sont utilisés) ;
- tests iOS : mappers legacy inchangés (les anciens payloads parsés par la nouvelle version tombent dans le budget par défaut, `budgetId` = nil).

---

## 5. Sécurité — firestore.rules

### 5.1 Nouvelles branches de règles (draft)

```rules
    // ── Budgets (multi-budget) ─────────────────────────────────────────────
    // /users/{userId}/budgets/{budgetId}
    // La limite de 5 budgets est imposée par la liste fermée d'IDs de slots :
    // impossible de créer un 6e budget, sans document compteur (SEC-23).
    // Aucun champ budgetId n'est ajouté aux collections legacy : les payloads
    // des anciens clients passent toujours les validateurs hasOnly existants.

    function isValidBudgetId(budgetId) {
      return budgetId in ['budget-1', 'budget-2', 'budget-3', 'budget-4', 'budget-5'];
    }

    function isValidBudgetData(data) {
      return data.keys().hasOnly(['name', 'icon', 'color', 'createdAt', 'updatedAt', 'deletedAt'])
        && data.name      is string && data.name.size()  >= 1 && data.name.size()  <= 50
        && data.icon      is string && data.icon.size()  >= 1 && data.icon.size()  <= 100
        && data.color     is string && data.color.size() >= 1 && data.color.size() <= 100
        && data.createdAt is string && data.createdAt.size() >= 1 && data.createdAt.size() <= 30
        && data.updatedAt is string && data.updatedAt.size() >= 1 && data.updatedAt.size() <= 30
        && (!('deletedAt' in data) || (data.deletedAt is string && data.deletedAt.size() >= 1 && data.deletedAt.size() <= 30));
    }

    // Budget existant et non supprimé (soft-delete : les sous-collections
    // restent lisibles mais ne sont plus écrivables).
    function budgetIsLive(userId, budgetId) {
      return exists(/databases/$(database)/documents/users/$(userId)/budgets/$(budgetId))
        && !('deletedAt' in get(/databases/$(database)/documents/users/$(userId)/budgets/$(budgetId)).data);
    }

    match /users/{userId}/budgets/{budgetId} {
      allow read: if isAuthenticated() && isOwner(userId);
      allow create: if isAuthenticated() && isOwner(userId)
                       && isValidBudgetId(budgetId)
                       && isValidBudgetData(request.resource.data);
      allow update: if isAuthenticated() && isOwner(userId)
                       && isValidBudgetData(request.resource.data)
                       // createdAt immuable (même règle que les transactions)
                       && request.resource.data.createdAt == resource.data.createdAt;
      // delete volontairement absent : soft-delete uniquement (deletedAt),
      // même logique que settings/general.

      // ── Réglages financiers du budget ────────────────────────────────────
      // Réutilise isValidSettingsData tel quel. Les champs globaux
      // (bentoPreset, anonymousMode, currency, isOnboarded) sont acceptés
      // par le validateur mais jamais écrits par les clients dans ce chemin.
      match /settings/{document} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow create: if isAuthenticated() && isOwner(userId)
                         && isValidSettingsData(request.resource.data)
                         && budgetIsLive(userId, budgetId);
        allow update: if isAuthenticated() && isOwner(userId)
                         && isValidSettingsData(request.resource.data)
                         && budgetIsLive(userId, budgetId);
      }

      // ── Revenus variables du budget ──────────────────────────────────────
      match /monthlyIncomes/{month} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow create: if isAuthenticated() && isOwner(userId)
                         && isValidMonthlyIncomeData(request.resource.data)
                         && budgetIsLive(userId, budgetId);
        allow update: if isAuthenticated() && isOwner(userId)
                         && isValidMonthlyIncomeData(request.resource.data)
                         && budgetIsLive(userId, budgetId);
        allow delete: if isAuthenticated() && isOwner(userId);
      }

      // ── Enveloppes du budget ─────────────────────────────────────────────
      // Miroir du bloc legacy, plus budgetIsLive et le quota de 50 enveloppes
      // PAR budget (décision actée) : compteurs par slot dans
      // counters/{userId}.envelopeCounts (map "budget-N" → nombre).
      match /envelopes/{envelopeId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow create: if isAuthenticated() && isOwner(userId)
                         && isValidEnvelopeData(request.resource.data)
                         && budgetIsLive(userId, budgetId)
                         && (!existsAfter(
                               /databases/$(database)/documents/counters/$(userId)
                             )
                             || !('envelopeCounts' in getAfter(
                               /databases/$(database)/documents/counters/$(userId)
                             ).data)
                             || !(budgetId in getAfter(
                               /databases/$(database)/documents/counters/$(userId)
                             ).data.envelopeCounts)
                             || getAfter(
                               /databases/$(database)/documents/counters/$(userId)
                             ).data.envelopeCounts[budgetId] <= 50);
        allow update: if isAuthenticated() && isOwner(userId)
                         && isValidEnvelopeData(request.resource.data)
                         && budgetIsLive(userId, budgetId);
        allow delete: if isAuthenticated() && isOwner(userId);
      }

      // ── Transactions du budget ───────────────────────────────────────────
      // Miroir du bloc legacy, plus :
      //   - budgetIsLive ;
      //   - intégrité référentielle : une dépense ne peut référencer qu'une
      //     enveloppe du MÊME budget (le legacy ne peut pas le vérifier sans
      //     casser les anciens clients ; ici la collection est neuve, donc
      //     on peut l'exiger dès le départ).
      match /transactions/{transactionId} {
        allow read: if isAuthenticated() && isOwner(userId);
        allow create: if isAuthenticated() && isOwner(userId)
                         && isValidTransactionData(request.resource.data)
                         && budgetIsLive(userId, budgetId)
                         && (request.resource.data.type == 'income'
                             || exists(/databases/$(database)/documents/users/$(userId)/budgets/$(budgetId)/envelopes/$(request.resource.data.envelopeId)));
        allow update: if isAuthenticated() && isOwner(userId)
                         && isValidTransactionData(request.resource.data)
                         && budgetIsLive(userId, budgetId)
                         && request.resource.data.createdAt == resource.data.createdAt
                         && (request.resource.data.type == 'income'
                             || exists(/databases/$(database)/documents/users/$(userId)/budgets/$(budgetId)/envelopes/$(request.resource.data.envelopeId)));
        allow delete: if isAuthenticated() && isOwner(userId);
      }
    }

    // ── État du budget courant ─────────────────────────────────────────────
    // Doc séparé (pas un champ de users/{uid} ni de settings/general) :
    // les anciens clients réécrivent ces deux docs en entier et effaceraient
    // un champ ajouté. Ce chemin leur est inconnu → intouchable.
    match /users/{userId}/state/currentBudget {
      allow read: if isAuthenticated() && isOwner(userId);
      allow create: if isAuthenticated() && isOwner(userId)
                       && isValidCurrentBudget(request.resource.data, userId);
      allow update: if isAuthenticated() && isOwner(userId)
                       && isValidCurrentBudget(request.resource.data, userId);
      allow delete: if isAuthenticated() && isOwner(userId);
    }

    function isValidCurrentBudget(data, userId) {
      return data.keys().hasOnly(['budgetId', 'updatedAt'])
        && data.budgetId is string
        && data.budgetId.size() >= 1 && data.budgetId.size() <= 40
        && (data.budgetId == 'default'
            || (isValidBudgetId(data.budgetId) && budgetIsLive(userId, data.budgetId)))
        && data.updatedAt is string && data.updatedAt.size() >= 1 && data.updatedAt.size() <= 30;
    }
```

### 5.2 Quotas

- **Enveloppes — 50 par budget** (décision actée 2026-11-03) :
  - budget défaut : compteur legacy `counters/{userId}.envelopeCount` (**inchangé, zéro régression**) ;
  - budgets 2-5 : map `counters/{userId}.envelopeCounts`, une entrée par slot (`"budget-1": n`…) — le client incrémente le bon slot dans le même batch que la création/suppression d'enveloppe (pattern legacy `getAfter`).
  - SEC-23 (doc compteur ≤ 40 clés) : `envelopeCount` + map `envelopeCounts` + jusqu'à 24 `tx_YYYY_MM` = 27 clés → OK **sans toucher la règle du compteur**. Les anciens clients n'écrivent jamais `envelopeCounts` (écritures en `increment`/merge) → zéro régression.
- **Transactions mensuelles** : le compteur `tx_YYYY_MM` est écrit mais non enforce par les règles aujourd'hui ; le multi-budget conserve le même comportement (les écritures budget l'incrémentent aussi).

### 5.3 Intégrité référentielle (durcie par rapport au legacy)

- Une transaction d'un budget ne peut référencer qu'une **enveloppe du même budget** (`exists()` sur `budgets/{budgetId}/envelopes/{envelopeId}`) — bloque les références croisées entre budgets (le legacy ne peut pas l'exiger sans casser les anciens clients qui ne connaissent pas les chemins de budgets ; pour la nouvelle collection, on l'exige dès le départ).
- `budgetIsLive` : un budget soft-deleté n'accepte plus d'écritures dans ses sous-collections (mais reste lisible et restaurable).
- Le `state/currentBudget` ne peut pointer que vers un budget existant et vivant (ou `'default'`).

### 5.4 Alignement 3 couches (convention du projet)

| Couche | Changements |
|---|---|
| `src/lib/validation.ts` | + `validateBudgetName`, `validateBudgetIcon`, `validateBudgetColor`, `validateBudgetId` (slots) — miroirs des contraintes règles |
| Routes API | `api/validate/transaction` : inchangée (validation pré-vol, `envelopeId` reste une string — le budget n'y entre pas) |
| `firestore.rules` | blocs ci-dessus + `scripts/dev/firestore.prod.rules` synchronisé (déploiement **manuel par l'utilisateur**) |
| Nouveau `src/lib/budgetService.ts` | sanitize/normalize du payload budget + résolution des chemins (miroir de `settingsService`) |

### 5.5 Hors portée des règles (documenté, comme l'existant)

- Forme profonde des historiques versionnés, items détaillés, `activeMonths` (YYYY-MM), override custom month : validés côté client (pattern `isValidBudgetVersionHistory` / SEC-24, inchangé).
- Limites de taille : payloads bornés comme l'existant (`hasOnly` + longueurs max + listes ≤ 100).
- App Check : inchangé (web uniquement — décision actée précédemment, mémoire projet).

---

## 6. Paywall iOS (StoreKit)

**Réutilisation intégrale du pattern widgets existant** (`StoreKitManager.swift`) :

1. **Nouveau produit non-consommable** `app.budgetflow.multi_budget` (**4,99 €** — acté 2026-11-03) : `multiBudgetProductID` + `isMultiBudgetPurchased` + flag de chargement dédié + clé Keychain `storekit.multi_budget_purchased` — miroir de `widgetsProductID` (`StoreKitManager.swift:27-35, 104-107`).
2. **Achat/restauration** : `purchaseMultiBudget()` / intégration à `restorePurchases()` et `checkEntitlements()` — miroir de `purchaseWidgets()` (`253-321`) ; restauration automatique après réinstallation via `currentEntitlements` (`172-191`) et achats cross-appareils via `Transaction.updates` (`136-144`).
3. **Écran de déblocage** : vue calquée sur `WidgetsUnlockView.swift` (gate `isMultiBudgetPurchased`, prix promo optionnel, bouton achat, restauration, messages d'erreur), intégrée dans la même scroll des Réglages (`SettingsView.swift:1137-1138`).
4. **Gating fonctionnel** (décision produit §2) : sans achat, l'iOS **masque** l'écran de gestion des budgets, le sélecteur du dashboard, et **ne sync pas** les sous-collections `budgets/**` (les données créées sur le web restent dans Firestore, intactes ; elles réapparaissent à l'achat). Si `currentBudget` pointe vers un budget 2-5 sans entitlement → repli silencieux sur le budget par défaut (aucune suppression locale).
5. **Remboursement** : StoreKit retire l'entitlement → `checkEntitlements` repasse à faux → masquage à nouveau, données intactes (même comportement que les widgets).
6. **Pas de vérification serveur** : assumé (décision §2). Un client modifié peut tricher — acceptable pour cette feature, cohérent avec l'existant (PDF/widgets fonctionnent déjà ainsi).

---

## 7. Impact Web (par fichier — cartographie exhaustive)

### 7.1 Nouveaux fichiers

- `src/lib/budgetService.ts` — résolution de chemins (`budgetEnvelopesRef/budgetTransactionsRef/budgetSettingsRef/budgetMonthlyIncomesRef(uid, budgetId)`, `'default'` → chemins legacy), `loadBudgets(uid)` (getDocs ≤ 5), `saveBudget`, `softDeleteBudget`, `restoreBudget`, `loadCurrentBudgetId`, `switchBudget`, sanitize/normalize payload budget. + TU.
- `src/context/BudgetContext.tsx` — fournit `{budgets, currentBudgetId, switchBudget}` ; hydraté dans `(protected)/layout.tsx` (lecture de `state/currentBudget` + `budgets/**`) ; repli défaut si le doc state pointe vers un budget inconnu/supprimé.
- `src/types/budget.ts` — types + `isValidBudgetId` + fonctions pures (`isBudgetActive`, résolution de repli). + TU.

### 7.2 Fichiers modifiés (scoping des requêtes)

| Fichier | Changement |
|---|---|
| `src/app/(protected)/layout.tsx` | Hydratation `BudgetContext` (en plus du gate `isOnboarded` `:34-37` et de l'écriture `dailyActivity` `:59-71`, inchangés) |
| `src/app/(protected)/dashboard/page.tsx` | Sélecteur de budget (header) ; `fetchData` `:704-788` → chemins résolus par `currentBudgetId` (settings, monthlyIncomes, enveloppes, transactions) ; re-run de `fetchData` sur changement de budget ; hooks inchangés (ils reçoivent déjà les données filtrées `:432, :645, :654`) |
| `src/app/(protected)/settings/page.tsx` | Nouvelle section « Mes budgets » (liste, création, édition nom/icône/couleur, soft-delete, restauration, compteur x/5) ; les réglages financiers existants `:478-619` restent scopés au budget **courant** (ou au défaut ? — décision UX §9) |
| `src/app/(protected)/envelopes/[id]/EnvelopeDetailClient.tsx` | Reads `:94-180` → chemins budget ; `deleteDoc` `:283` inchangé (doc déjà résolu) |
| `src/app/(protected)/analysis/page.tsx` | `useAnalysis` `:87-91` → hook rendu budget-aware (paramètre `budgetId`) |
| `src/app/(protected)/history/page.tsx` | Reads `:53-80` → chemins budget |
| `src/app/(protected)/evolution/page.tsx` | Reads `:85-148` → chemins budget |
| `src/app/(protected)/cashflow/page.tsx` | Reads `:90-111` → chemins budget |
| `src/hooks/useAnalysis.ts` | `:87-88, :101, :134-158` → refs paramétrées par `budgetId` |
| `src/hooks/useSpendingForecast.ts` | `:112-120` → ref transactions paramétrée |
| `src/hooks/useSmartSpendingInsights.ts` | `:130-138` → ref transactions paramétrée |
| `src/lib/envelopeService.ts` | `fetchLinkedTransactions :59-61`, migrations `:122-243`, suppressions `:253-310` → refs paramétrées (les mises à jour de compteurs restent globales) |
| `src/lib/settingsService.ts` | `settingsDocRef :374-376` + `loadSettings/saveSettings` → variantes par budget (`budgetSettingsRef`) ; `resolveMonthlyIncome :102` sur le doc du budget courant |
| `src/lib/monthlyIncomeService.ts` | Refs `:20-27` → paramétrées |
| `src/components/dashboard/TransactionModal.tsx` | Refs transactions/enveloppes `:61-66, :120-640` → paramétrées (écritures compteurs inchangées) |
| `src/hooks/useCalendarHeatmap.ts` | Inchangé (jours de connexion globaux). Le Parcours Fidélité étant **par budget** (décision §10), `dailySpend`/`monthlyBudget` viennent déjà des transactions du budget courant — aucune agrégation multi-budget nécessaire |
| `src/app/api/notifications/trigger/route.ts` | `:120-126` : comptage des transactions du jour étendu aux budgets (proposition : `collectionGroup('transactions')` filtré par date, Admin SDK) |

### 7.3 Inchangés

`useNotifications.ts` (profil user), `CurrencyContext` (settings/general global), onboarding (batch `:193-249` — crée le budget par défaut comme aujourd'hui), login, feedback, `dailyActivity`.

---

## 8. Impact iOS (par fichier — cartographie exhaustive)

### 8.1 Nouveaux fichiers

- `Budget.swift` — modèle SwiftData : `id` (slot `budget-N`), `firestoreId`, `name`, `icon`, `color`, `deletedAt`, `createdAt/updatedAt` + `budgetSettings` (modèle `BudgetSettings` calqué sur les champs financiers de `UserSettings`, sans les préférences globales). **À enregistrer dans le schéma** `BudgetFlowApp.swift:81-89` (sinon crash au démarrage).
- `BudgetSyncService.swift` (ou extension) — sync des sous-collections `budgets/**` : pull (merge LWW par budget), push (mêmes patterns `merge: true`), gating par `StoreKitManager.isMultiBudgetPurchased`.
- `BudgetPathResolver` — centralisation des ~20 constructions inline de chemins (`SyncService.swift` : liste complète en §8.2), retournant le chemin legacy pour le défaut et `budgets/{id}/…` sinon.
- Vues : `BudgetsSettingsView` (liste + éditeur + paywall), `BudgetSwitcherView` (sélecteur dashboard), sheet d'achat (clone `WidgetsUnlockView`).

### 8.2 `SyncService.swift` / `SyncCoordinator.swift`

- **Résolution de chemins** : remplacer les constructions inline par le resolver — call-sites `SyncService.swift:280, 283, 290, 305-310, 664-668, 746, 758-759, 775-778, 789-791, 855-857, 900-902, 956-957, 962-963, 986-989, 1014-1019` (+ `transactionDocumentRef :638-647`, balayage enveloppes `:962-965`). `FirebaseManager.swift` est auth-only : rien à changer.
- **Mappers** : ajouter `budgetId` (défaut nil) à `makeEnvelope :1174-1190`, `applyEnvelopeData :1192-1203`, `makeTransactionFromData :68-91`, `applyTransactionData :1210-1234`, `applySettingsData :445-499` (settings de budget), `buildSettingsPayload :550-623` (variante budget).
- **`loadFromFirestore :301-435`** (remplacement destructif `deleteAll :333-335`) : scoper par budget — remplacement du seul budget par défaut ; budgets 2-5 importés séparément (et seulement si entitlement).
- **`mergeFromFirestore :1010-1170`** : boucle par budget (défaut + budgets vivants si entitlement) ; balayages hard-delete (`1062-1066, 1120-1124, 1151-1155`) faits **par budget** sur le snapshot du budget concerné (limites 100/5000/100 par budget — voir §4.3).
- **`PendingSyncOperation`** : + `budgetId: String?` ; les `queueOrSync*` (`SyncCoordinator.swift:87-173`) propagent le budget de l'entité.
- **Gating** : si `!isMultiBudgetPurchased` → les boucles budget 2-5 sont ignorées (pas de pull, pas de push), les `@Query` masquent leurs entités (filtre en mémoire), `currentBudget` lu mais replié sur défaut.

### 8.3 Modèles SwiftData

| Modèle | Changement |
|---|---|
| `Envelope.swift` | + `budgetId: String?` (nil = défaut). Attention collision de nommage : `Envelope.budget` `:16` est le **montant** alloué — le nouveau champ s'appelle `budgetId` |
| `Transaction.swift` | + `budgetId: String?` |
| `MonthlyIncome.swift` | + `budgetId: String?` |
| `UserSettings.swift` | **Inchangé** — reste le singleton du budget défaut + préférences globales. Les champs financiers des budgets 2-5 vivent dans `BudgetSettings` (helper de résolution « settings du budget courant » consommé par les vues) |
| Schéma `BudgetFlowApp.swift:81-89` | + `Budget`, `BudgetSettings` (et migration SwiftData éventuelle — l'ajout de modèles est une migration légère, `@Attribute(originalName:)` uniquement pour renommages) |

### 8.4 Vues (tous les `@Query` sont sans prédicat = lecture globale, filtrage en mémoire)

| Vue | Changement |
|---|---|
| `DashboardView.swift` | Sélecteur de budget (header) ; `visibleEnvelopes :79-81` et `monthlySpent :91-103` filtrés par budget ; `@Query`s `:15-18` complétés d'un filtre en mémoire par `budgetId` ; Parcours Fidélité : `transactionDates` du budget affiché (par budget, §10) |
| `SettingsView.swift` | Section « Budgets » (liste/éditeur/achat/restauration/soft-delete) ; `queueOrSyncSettings :683, 976, 1075, 1383, 1490` → budget courant |
| `EnvelopeDetailView.swift` | Reçoit l'enveloppe déjà scoped (les transactions via la relation `:35-114` sont celles du budget par construction) |
| `ManageEnvelopesView`, `AddEnvelopeView`, `AddTransactionView`, `EnvelopeEditSheet`, `TransactionEditSheet`, `EnvelopePickerSheet`, `HistoryView`, `AnalysisView`, `EvolutionView`, `CashFlowSheet`, `EnvelopeGridSection`, `BudgetTimelineChartView` | Filtre en mémoire par `budgetId` sur leurs `@Query` (listés §3 du rapport de cartographie) |
| `RecurrenceService.swift:14` | Séries récurrentes scoping par budget |
| `PDFExportView.swift` | Reçoit déjà ses données en paramètres (`:13-18`) → export du budget sélectionné uniquement (scoping en amont) |
| `OnboardingView` / `ContentView` | Inchangés (onboarding = budget défaut) |

### 8.5 Widgets & Watch

- Le widget lit uniquement le snapshot UserDefaults partagé (`WidgetSnapshotLoader.load()` — pas de SwiftData/Firestore dans la cible widget). Le producteur `WidgetSnapshotStore.publish` (`BudgetFlow/WidgetSnapshotStore.swift:17-201`) calcule depuis SwiftData → **v1 : snapshot du budget courant** (celui sélectionné au moment de la publication ; repli défaut si non débloqué).
- « Un widget par budget » (sélection par widget) exigerait la migration `StaticConfiguration` → `AppIntentConfiguration` (`BudgetFlowWidgets.swift:728-814`) + clés de snapshot par budget : **hors périmètre v1**, noté en piste v2.
- Watch : consomme le même snapshot poussé (`WatchConnectivityManager.swift:43-71`) — suit automatiquement le budget courant.

---

## 9. UX/UI (thème & design existants)

- **Sélecteur dashboard** (web + iOS) : rangée de puces horizontale au-dessus du bento — icône + nom + pastille de couleur ; surbrillance du budget actif avec sa couleur. **Masqué tant qu'un seul budget existe** (web) ou tant que non débloqué (iOS) → l'UI mono-budget reste strictement identique à aujourd'hui.
- **Écran de gestion** (Paramètres > « Mes budgets », web et iOS) : liste de cartes (icône, nom, couleur, nombre d'enveloppes, badge « Budget par défaut »), bouton « + Nouveau budget » (iOS : gate paywall — clone `WidgetsUnlockView`), éditeur nom + palette de couleurs existante + picker d'icônes (même mécanique que les enveloppes : Lucide web / SF Symbols iOS), suppression = soft-delete avec confirmation explicite, restauration, compteur « 3/5 ».
- **Réglages financiers** : les écrans existants (salaire, charges, épargne, jour de début de mois, détail des charges) s'appliquent au **budget sélectionné dans le sélecteur**, pas seulement au défaut — le sélecteur doit donc rester visible/accessible depuis les Paramètres (affiché en haut de l'écran quand ≥ 2 budgets). Les préférences d'affichage (mode anonyme, densité bento, devise) restent globales.
- **États vides** : budget neuf → dashboard vide (0 enveloppe), CTA « Ajouter une enveloppe » ; analyses/historique vides par construction.
- **Couleurs** : classes Tailwind existantes (`bg-amber-500`…, déjà dynamiques côté dashboard `page.tsx:271, 285, 320`) ; **icônes** : clé string partagée — `ICON_MAP` Lucide web (`page.tsx:100, 236`) / SF Symbols iOS (mécanique des enveloppes).

---

## 10. Cas limites & décisions associées

| Cas | Comportement |
|---|---|
| `currentBudget` pointe vers un budget supprimé/inconnu | Repli silencieux sur le défaut à la lecture (web `BudgetContext`, iOS au merge) ; le doc state sera corrigé au prochain switch |
| Switch pendant un chargement | `fetchData` re-run (dashboard déjà structuré ainsi `:833-835`) ; pas d'écriture croisée possible (les refs sont résolues au moment de l'écriture) |
| 5 budgets atteints | Bouton création désactivé + message « Limite de 5 budgets atteinte » |
| Supprimer le budget courant | Hard delete autorisé (sauf défaut) : confirmation, route API, nettoyage local, repli immédiat du sélecteur sur le défaut |
| Slot libéré après suppression | Le doc budget disparaît de Firestore → le slot redevient disponible pour une nouvelle création |
| iOS non payant + budgets créés sur web | Masqués partout sur iOS, **non sync** ; après achat (ou restauration) ils apparaissent |
| Remboursement StoreKit | Re-masquage, données locales et Firestore intactes |
| Enveloppes temporaires (`activeMonths`) | Par budget, sans changement de logique (`isEnvelopeActiveForMonth` appelé avec les enveloppes du budget) |
| Heatmap & streak fidélité | **Par budget (acté 2026-11-03).** Les jours de connexion (`dailyActivity`) restent globaux ; la série, les badges et la sévérité se calculent avec les transactions du budget affiché → le Parcours Fidélité change avec le budget sélectionné. Implémentation sans requête supplémentaire : le dashboard passe déjà au composant les transactions du budget courant (`CalendarHeatmap.tsx` reçoit `dailySpend`/`monthlyBudget` ; iOS : `transactionDates` filtrées par budget dans `CalendarStreakCalculator`) |
| Compteurs `tx_YYYY_MM` | Incrémentés par les écritures budget aussi (même doc `counters/{userId}`) |
| Quota 50 enveloppes par budget | Le client incrémente `envelopeCount` (défaut) ou `envelopeCounts[slot]` (budgets) dans le batch de création/suppression d'enveloppe — même mécanique qu'aujourd'hui (`settings/page.tsx:805-824`, `envelopeService.ts:299-305`) |
| Widgets / Watch | Suivent le budget courant (v1) ; sélection par widget = v2 |
| Export PDF | Budget sélectionné uniquement |
| Onglet web sur une ancienne version | Continue sur le défaut, aucune écriture des nouveaux chemins — sans risque |
| `loadFromFirestore` (connexion de compte) | Réimport scoped : défaut toujours, budgets 2-5 seulement si entitlement |

---

## 11. Stratégie de tests

**Web (Jest — exigence ≥ 80 % sur `src/lib`)** :
- Nouveaux TU : `budgetService.test.ts` (résolution de chemins legacy/budget, sanitize payload, slots), `types/budget.test.ts` (repli, isValidBudgetId), `BudgetContext` (état + repli).
- Non-régression : tous les tests existants (dashboard, settings, history, cashflow, analysis, hooks — liste complète en §8 de la cartographie web) doivent passer **en mode 1 budget** sans modification de comportement.
- Streak par budget : TU `CalendarHeatmap.test.tsx` — les badges et la série changent avec le `dailySpend` du budget affiché ; jours de connexion globaux inchangés.
- Tests de payloads legacy (exigence CLAUDE.md) : anciens formats enveloppe/transaction/settings acceptés par `validation.ts` et par les règles.

**Règles Firestore** : harnais écrit — `scripts/test-firestore-rules.js`, lancé par `npm run test:rules` (émulateur `firebase-tools` ; nécessite **Java**, absent de cette machine → exécution non vérifiée). Couvre : création du 6ᵉ budget refusée, slot hors liste refusé, transaction référençant une enveloppe d'un autre budget refusée, écriture dans un budget soft-deleté refusée, 51ᵉ enveloppe refusée dans un budget mais autorisée dans un autre (quota 50 par slot), payload legacy toujours accepté, accès croisé `uid` refusé. *(Déploiement des règles : manuel, par l'utilisateur.)*

**E2E Playwright** : nouvelle suite `multi-budget.spec.ts` (création → switch → isolation des données → limite → soft-delete → restauration) ; suites existantes inchangées (mode défaut). Outils à étendre : `scripts/seed-test-data.js`, `playwrightTest/mcp-server.js` (+ `copy-user-data.js`, `backup-firestore.js` — stats `:263` — et `restore-firestore.js` pour inclure `budgets/**` et `state/**`). ⚠️ Mémoire projet : les outils E2E visent la prod par défaut (SEC-33) — prudence dans les seed.

**iOS** :
- TU sur fonctions libres (mémoire projet : **jamais de vrai `SyncService` dans un TU** — crash SIGABRT au deinit) : parsing budget, resolver de chemins, repli entitlement.
- `SyncServiceMockTests` / `SyncCoordinatorTests` étendus : merge par budget, sweep par budget, gating entitlement, `PendingSyncOperation.budgetId`.
- `StoreKitManagerTests` : 3ᵉ produit (pattern widgets existant).
- XCUITest : switch de budget sur dashboard, création/édition dans Réglages, paywall (mémoire : destination simulateur iPhone, gestes mesurés via sonde in-app).

---

## 12. Documentation à mettre à jour

| Doc | Changement |
|---|---|
| `MULTI_BUDGET.md` (ce doc) | Référence de la feature |
| `DATABASE_STRUCTURE.md` | Schéma Firestore (`budgets/**`, `state/currentBudget`), modèles SwiftData (Budget, BudgetSettings, budgetId), stratégie de sync budget-scopée, soft-delete budgets |
| `firestore.rules` + `scripts/dev/firestore.prod.rules` | Blocs §5.1 |
| `CLAUDE.md` | Architecture : isolation par sous-collections, résolution de chemins, gating StoreKit |
| `PLATFORM_COMPARISON.md` | Feature multi-budget (web gratuit / iOS payant) |
| `ROADMAP.md` | Feature implémentée + v2 widgets par budget |
| `SECURITY.md` | Section règles multi-budget (limite par slots, intégrité référentielle) |
| `NOTIFICATION.md` | Adaptation du trigger aux budgets |

---

## 13. Risques & questions ouvertes

1. ~~Prix du produit IAP~~ → ✅ **4,99 €** (acté 2026-11-03).
2. ~~Quota enveloppes~~ → ✅ **50 par budget** (acté 2026-11-03) — compteurs par slot, §5.2.
3. ~~Streak fidélité~~ → ✅ **Par budget** (acté 2026-11-03) — §10.
4. **Widgets par budget** : v2 `AppIntentConfiguration` — hors périmètre v1, à planifier dans la roadmap.
5. **Incohérence `deletedAt` legacy** (§4.4) : correction documentaire à prévoir (hors périmètre feature).
6. **Précision `updatedAt`** (iOS sans ms vs web avec ms) : préexistant ; surveiller sur les nouveaux docs.
7. **E2E/seed visant la prod** (SEC-33) : extension des outils avec la même prudence qu'aujourd'hui.
8. **iOS = repo git séparé** : deux working trees, commits séparés (par l'utilisateur).
9. **Déploiement des règles** : manuel, par l'utilisateur (mémoire projet).
10. **Migration SwiftData** : ajout de modèles = migration de schéma légère ; vérifier le parcours des versions existantes (y compris `@Attribute(originalName:)`).

---

## 14. Découpage en phases

| Phase | Contenu | Livrables |
|---|---|---|
| **0** | Ce document (décisions + spec) | ✅ `MULTI_BUDGET.md` |
| **1 — Fondations web** | `budgetService.ts`, `types/budget.ts`, `validation.ts`, règles Firestore + script de test émulateur | ✅ Fait (2026-11-03) — TU 167/167, couverture `budgetService.ts` 100 % lignes, suite complète 726/726 ; règles non déployées ; `npm run test:rules` prêt (nécessite Java) |
| **2 — Web UI** | `BudgetContext`, sélecteur dashboard, écran « Mes budgets », scoping de toutes les pages/hooks | ✅ Fait (2026-11-03) — 743 TU verts, couverture globale 95 %, tsc 0 erreur ; **E2E multi-budget à écrire après déploiement des règles** (les écritures `budgets/**` seraient refusées par les règles actuellement déployées) |
| **3 — iOS** | Modèles `Budget`/`BudgetSettings`, sync scoped + gating, 3ᵉ produit StoreKit, écran d'achat, sélecteur + gestion | 🔄 En cours (2026-11-07) — ✅ fait : modèles, `BudgetParsing` (12 TU), `BudgetSyncService` (**sync complète par budget** : pull LWW + sweeps par budget, push enveloppes/transactions/revenus, suppressions, gating Keychain), routage dans `SyncCoordinator` (push/delete/revenus des entités budgetées + pull dans `performSync`), guards anti-fuite, 3ᵉ produit StoreKit (4,99 €), UI paywall/gestion/sélecteur, **filtrage du DashboardView par budget courant**, build vert, bundle TU 1439/1439 (avant cet incrément — revalidation en cours) ; ⏳ reste : réglages financiers par budget côté iOS, filtrage des autres vues (History/Analysis/Evolution/CashFlow/AddTransaction), file offline avec dimension budget, XCUITest |
| **4 — Ops & docs** | Outils (seed, backup, copy, restore, notifications trigger), toutes les docs §12, ROADMAP | Backups incluant `budgets/**` |
| **5 — Déploiement** | Règles déployées **par l'utilisateur**, publication web, release iOS (produit IAP actif dans App Store Connect) | — |

---

*Références de cartographie : rapports « Firestore Collection Access Map (Web) » et « Multi-Budget Feasibility Map (iOS) » du 2026-11-03 — toutes les lignes citées ont été vérifiées dans les sources.*
