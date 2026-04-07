# Scripts BudgetFlow

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

# Backup d'un utilisateur précis
node scripts/backup-firestore.js --user <userId>

# Chemin de sortie personnalisé
node scripts/backup-firestore.js --output ./backups/mon-backup.json
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
