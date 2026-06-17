# Scripts BudgetFlow

---

## Installation des dépendances (serveur de production)

Les scripts s'exécutent directement sur le host (hors Docker). Installer les dépendances
une seule fois dans le dossier `scripts/` :

```bash
cd scripts && npm install
```

> `firebase-admin` est la seule dépendance externe requise.

---

## Backup & Restore Firestore

### `backup-firestore.js`

Exporte **toute la base Firestore** dans un fichier JSON local.  
**Lecture seule** — aucune écriture sur la base de données.

#### Prérequis : Clé de service Firebase

1. Ouvrir la [Firebase Console](https://console.firebase.google.com) → projet **budgetflow-86842**
2. **Paramètres du projet** (icône ⚙️) → onglet **Comptes de service**
3. Cliquer **Générer une nouvelle clé privée** → télécharger le fichier JSON
4. Le renommer `service-account.json` et le placer dans `scripts/`

> ⚠️ Ce fichier est dans `.gitignore`. Ne le commitez jamais.

#### Usage

```bash
# Backup complet (tous les utilisateurs)
node scripts/backup-firestore.js

# Backup complet prod/dev via clé dédiée
node scripts/backup-firestore.js --env prod

# Backup d'un utilisateur précis
node scripts/backup-firestore.js --user <userId>

# Chemin de sortie personnalisé
node scripts/backup-firestore.js --output ./backups/mon-backup.json

# Forcer explicitement le projet Firebase cible
node scripts/backup-firestore.js --env prod --project budgetflow-vizualy
```

Le fichier est créé dans `backups/backup-YYYY-MM-DDTHH-MM-SS_full.json`  
(dossier `backups/` créé automatiquement, ignoré par git).

---

### `restore-firestore.js`

Réimporte un backup JSON dans Firestore.  
**Par défaut : mode `--dry-run`** (simulation pure, aucune écriture).

#### Usage

```bash
# Simuler la restauration (sans écrire)
node scripts/restore-firestore.js --input ./backups/backup-xxx.json

# Simuler en choisissant la clé prod/dev
node scripts/restore-firestore.js --input ./backups/backup-xxx.json --env prod

# Restauration réelle — écrasement complet des documents existants
node scripts/restore-firestore.js --input ./backups/backup-xxx.json --confirm --overwrite

# Restauration réelle — fusion (préserve les champs non présents dans le backup)
node scripts/restore-firestore.js --input ./backups/backup-xxx.json --confirm --merge

# Restaurer uniquement un utilisateur
node scripts/restore-firestore.js --input ./backups/backup-xxx.json --user <userId> --confirm --overwrite

# Restaurer vers un autre projet (ex : staging)
node scripts/restore-firestore.js --input ./backups/backup-xxx.json --project mon-projet-staging --confirm --overwrite
```

#### Sécurités intégrées

- Sans `--confirm` → **aucune écriture**, affichage des opérations prévues uniquement
- Si la cible est le **même projet** que la source → demande de confirmation interactive (`RESTAURER`)
- `--overwrite` et `--merge` sont mutuellement exclusifs
- Utilise des **batches Firestore** (rotation automatique à 490 ops/batch)
- Si `FIREBASE_PROJECT_ID` ne correspond pas au `project_id` du compte de service, le `project_id` du compte de service est prioritaire

---

### `backup-firestore-daily.sh`

Wrapper **cron-friendly** pour exécuter un backup Firestore quotidien complet.

#### Comportement

- crée un backup horodaté dans `backups/daily/<env>/`
- écrit aussi un log dédié dans `backups/daily/<env>/logs/`
- purge automatiquement les backups plus vieux que la rétention choisie
- retourne un code d'erreur non nul si le backup échoue, ce qui est adapté à `crontab`

#### Usage

```bash
# Backup quotidien prod avec rétention 30 jours
bash scripts/backup-firestore-daily.sh --env prod

# Changer le dossier de sortie et la rétention
bash scripts/backup-firestore-daily.sh --env prod --output-dir /var/backups/budgetflow --retention-days 14
```

#### Exemple crontab

```bash
# Tous les jours à 02:15
15 2 * * * cd /chemin/vers/BudgetFlow && /usr/bin/env bash scripts/backup-firestore-daily.sh --env prod >> /var/log/budgetflow-firestore-backup.log 2>&1
```

Variables utiles côté serveur :

```ini
BACKUP_ENV=prod
BACKUP_OUTPUT_DIR=/var/backups/budgetflow
BACKUP_RETENTION_DAYS=30
FIREBASE_BACKUP_PROJECT_ID=budgetflow-vizualy
```

---

### `trigger-notifications-cron.sh`

Wrapper **cron-friendly** pour déclencher `trigger-notifications.js`.

#### Pourquoi ce wrapper ?

`crontab` n'hérite pas du même environnement qu'un terminal interactif :

- le `PATH` est souvent minimal
- `node` n'est pas toujours trouvé
- le répertoire courant n'est pas la racine du projet

Ce wrapper :

- force un `PATH` explicite
- se place à la racine du repo
- tente de charger `nvm` si disponible
- exécute ensuite `scripts/trigger-notifications.js`

#### Usage

```bash
# Utiliser Node trouvé dans PATH / nvm
bash scripts/trigger-notifications-cron.sh

# Forcer un binaire Node précis
bash scripts/trigger-notifications-cron.sh --node /opt/homebrew/bin/node
```

#### Exemple crontab

```bash
# Toutes les 15 minutes
*/15 * * * * cd /Users/jeremy/Dev/git/BudgetFlow && /usr/bin/env bash scripts/trigger-notifications-cron.sh >> /var/log/budgetflow-notifications.log 2>&1
```

Variables utiles côté serveur :

```ini
CRON_SECRET=your-secret
NOTIFICATION_TRIGGER_URL=http://127.0.0.1:8095/api/notifications/trigger
NOTIFICATION_TRIGGER_TIMEOUT_MS=30000
NODE_BIN=/opt/homebrew/bin/node
```

> L'application web doit être démarrée côté serveur pour que l'endpoint `/api/notifications/trigger` réponde.

---

### `restore-firestore-full.sh`

Wrapper pour restaurer **toute la base** depuis un backup JSON.

#### Usage

```bash
# Dry-run complet
bash scripts/restore-firestore-full.sh --env prod --input ./backups/daily/prod/backup-2026-05-09T02-15-00_full.json

# Restauration réelle complète avec écrasement
bash scripts/restore-firestore-full.sh --env prod --input ./backups/daily/prod/backup-2026-05-09T02-15-00_full.json --confirm --overwrite
```

Par défaut, ce wrapper reste en **dry-run** tant que `--confirm` n'est pas fourni.

---

### `migrate-user-from-backup-to-prod.js`

Copie les donnees d'un utilisateur source present dans un backup JSON (dev)
vers un utilisateur cible en **production**.

Le script utilise explicitement `scripts/service-account-prod.json`.

#### Usage

```bash
# Mode interactif (demande source userId et target userId)
node scripts/migrate-user-from-backup-to-prod.js --input ./backups/backup-2026-03-26T16-56-45_full.json

# Sans prompt userId (tout en arguments)
node scripts/migrate-user-from-backup-to-prod.js \
   --input ./backups/backup-2026-03-26T16-56-45_full.json \
   --source-user <devUserId> \
   --target-user <prodUserId>

# Executer sans confirmation interactive finale
node scripts/migrate-user-from-backup-to-prod.js \
   --input ./backups/backup-2026-03-26T16-56-45_full.json \
   --source-user <devUserId> \
   --target-user <prodUserId> \
   --yes

# Copier aussi les champs profil (email, displayName, photoURL, etc.)
node scripts/migrate-user-from-backup-to-prod.js --include-profile
```

#### Comportement

- Par defaut, le document `users/{targetUserId}` conserve les champs profil de la cible.
- Les sous-collections de la source (settings, envelopes, transactions, etc.) sont ecrites dans la cible.
- Les champs de date (`date`, `createdAt`, etc.) sont conserves en **string** comme dans le backup.
- Les documents deja presents dans la cible mais absents du backup **ne sont pas supprimes**.

---

### `copy-user-data.js`

Copie **toutes les données** d'un utilisateur Firestore source directement vers un
utilisateur cible, **sans fichier backup intermédiaire**. Les données existantes du
compte cible sont supprimées avant la copie pour obtenir un **miroir strict**.

#### Usage

```bash
# Simuler la copie (sans rien écrire)
node scripts/copy-user-data.js --source-user <sourceUid> --target-user <targetUid>

# Copie réelle avec suppression préalable de la cible
node scripts/copy-user-data.js --source-user <sourceUid> --target-user <targetUid> --confirm

# Copier en environnement dev
node scripts/copy-user-data.js --source-user <sourceUid> --target-user <targetUid> --env dev --confirm

# Copier aussi les champs profil (email, displayName, photoURL...)
node scripts/copy-user-data.js --source-user <sourceUid> --target-user <targetUid> --include-profile --confirm

# Via npm
npm run copy:user-data -- --source-user <sourceUid> --target-user <targetUid> --confirm
```

#### Options

| Option | Description |
|---|---|
| `--source-user <uid>` | UID Firebase de l'utilisateur à copier (obligatoire) |
| `--target-user <uid>` | UID Firebase de l'utilisateur cible (obligatoire) |
| `--env prod\|dev` | Environnement cible — sélectionne `service-account-{env}.json` (défaut: `prod`) |
| `--project <projectId>` | Override explicite du projectId Firebase |
| `--confirm` | Écrit réellement en base (sans ce flag → dry-run) |
| `--dry-run` | Force le mode simulation |
| `--include-profile` | Copie aussi les champs identité (email, displayName, photoURL…) depuis la source. Par défaut, ces champs sont préservés depuis la cible. |

#### Comportement

1. **Lecture** du compte source : document `users/{sourceUid}`, `settings/general`, toutes les enveloppes, transactions et dailyActivity.
2. **Suppression** de toutes les données du compte cible (enveloppes, transactions, dailyActivity, settings).
3. **Réécriture** des données source dans le compte cible.
4. **Vérification** post-copie : contrôle que le nombre de documents correspond.

#### Profil utilisateur

Par défaut, les champs d'identité de la cible sont **préservés** :

- `email`, `displayName`, `photoURL`
- `fcmToken`, `notificationsEnabled`
- `lastLogin`, `lastTokenUpdate`

Ajoutez `--include-profile` pour écraser ces champs avec ceux de la source.

Si la cible n'existe pas encore, des valeurs par défaut sont générées automatiquement.

#### Sécurités intégrées

- Sans `--confirm` → **aucune écriture**, affichage du récapitulatif uniquement
- Refuse de copier un utilisateur sur lui-même
- Vérifie que la source existe avant toute opération
- Utilise des **batches Firestore** (rotation automatique à 400 ops/batch)
- Suppression **avant** écriture : la cible est toujours dans un état cohérent

---

## Procédure de Disaster Recovery

En cas de compromission de la base :

1. **Identifier le dernier backup sain** dans `backups/`
2. **Vérifier** avec un dry-run :
   ```bash
   node scripts/restore-firestore.js --input ./backups/backup-SAIN.json
   ```
3. **Si nécessaire, créer un nouveau projet Firebase** et pointer `--project` dessus
4. **Restaurer** :
   ```bash
   node scripts/restore-firestore.js --input ./backups/backup-SAIN.json --confirm --overwrite
   ```

---

# Service Worker Generation

## Overview

The Firebase Cloud Messaging service worker (`firebase-messaging-sw.js`) is automatically generated at build time from environment variables.

## Why?

This approach prevents hardcoding sensitive Firebase API keys in the source code. Instead, the configuration is injected from environment variables at build time.

## How it works

The `generate-sw.js` script:
1. Reads environment variables from `.env` or `.env.local`
2. Injects them into the service worker template
3. Generates `public/firebase-messaging-sw.js`

This script runs automatically:
- `npm run dev` - generates before starting development server
- `npm run build` - generates before building for production
- `npm start` - regenerates before starting the production server

## Required Environment Variables

Your `.env.local` or `.env` file must include:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Important

- ⚠️ **Never commit `firebase-messaging-sw.js`** - It's in `.gitignore` to prevent accidentally exposing API keys
- 🔒 Always ensure `.env.local` is in `.gitignore` (it already is)
- ✅ Only commit `.env.example` with empty values
