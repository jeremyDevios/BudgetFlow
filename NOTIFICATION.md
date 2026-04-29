# 🔔 Guide de Configuration des Notifications Push (Sans Frais)

Ce guide explique comment mettre en place les notifications push quotidiennes ("Bilan Quotidien") en utilisant les **API Routes Next.js** au lieu de Firebase Cloud Functions (payant).

Cette méthode est 100% gratuite et s'exécute directement sur votre serveur Next.js.

---

## 🚀 1. Configuration Préalable

### A. Générer une Clé Privée (Service Account)
Pour que votre serveur puisse envoyer des notifications, il doit s'authentifier comme "Admin" auprès de Firebase.

1. Allez sur la [Console Firebase](https://console.firebase.google.com/).
2. Ouvrez votre projet > **Paramètres du projet** (roue dentée) > onglet **Comptes de service**.
3. Cliquez sur **Générer une nouvelle clé privée**.
4. Un fichier `.json` va se télécharger. Gardez-le précieusement (ne jamais le commiter !).

### B. Configurer les Variables d'Environnement
Ouvrez (ou créez) votre fichier `.env.local` à la racine du projet et ajoutez les clés suivantes en utilisant les informations du fichier JSON téléchargé :

```ini
# --- Firebase Admin SDK (Pour le serveur) ---
# Copiez ces valeurs depuis votre fichier JSON téléchargé
FIREBASE_PROJECT_ID="votre-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@votre-projet.iam.gserviceaccount.com"
# ATTENTION : Copiez TOUT le contenu de la clé privée, y compris les sauts de ligne (\n)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBbql...etc..."

# --- Sécurité ---
# Choisissez un mot de passe complexe pour protéger votre URL de déclenchement
CRON_SECRET="votre_mot_de_passe_tres_securise_ici"
```

---

## 🛠️ 2. Comment ça marche ?

Le système repose sur une API Route de votre site qui, lorsqu'elle est appelée, déclenche l'envoi des notifications.

- **Le fichier magique** : `src/app/api/notifications/trigger/route.ts`
- **Le script cron recommandé** : `scripts/trigger-notifications.js`
- **L'URL de déclenchement** : `https://votre-site.com/api/notifications/trigger`

### Logique du Script
1. Il vérifie que le secret fourni correspond à votre `CRON_SECRET`.
2. Il récupère tous les utilisateurs ayant activé les notifications dans Firestore.
3. Pour chaque utilisateur, il regarde s'il a saisi des dépenses **aujourd'hui** (depuis minuit).
4. Il envoie un message personnalisé :
   - ✅ Si dépenses saisies : *"Vous avez déjà saisi XX€ aujourd'hui..."*
   - ❌ Si rien saisi : *"Avez-vous pensé à saisir vos dépenses ?"*

---

## ⏰ 3. Automatiser l'envoi (Cron Job)

Pour que les notifications partent tous les jours automatiquement (ex: à 19h00), vous devez appeler cette URL périodiquement.

### Option A : Vous hébergez sur Vercel
Vercel propose des Cron Jobs gratuits.
Ajoutez ce fichier `vercel.json` à la racine :
```json
{
  "crons": [
    {
      "path": "/api/notifications/trigger?key=votre_mot_de_passe_tres_securise_ici",
      "schedule": "0 19 * * *"
    }
  ]
}
```
Vercel ne permet pas d'ajouter des en-têtes personnalisés sur ses crons. L'endpoint accepte donc aussi temporairement le mode legacy `?key=` pour rester compatible avec ce cas et avec un test manuel dans le navigateur.

> Recommandation : sur votre propre serveur, préférez le script Node ci-dessous. Il envoie un `POST` avec l'en-tête `x-cron-secret`, ce qui évite d'exposer le secret dans l'URL.

### Option B : Vous hébergez sur votre propre serveur (VPS, Coolify, etc.)
Utilisez l'outil `crontab` de votre serveur Linux.

1. Ajoutez ces variables sur le serveur (dans votre `.env.local` ou votre environnement système) :

```ini
CRON_SECRET="votre_mot_de_passe_tres_securise_ici"
NOTIFICATION_TRIGGER_URL="http://127.0.0.1:8095/api/notifications/trigger"
```

Si votre application n'écoute pas sur `8095`, remplacez l'URL par votre vraie URL interne ou publique.

2. Ouvrez l'éditeur cron :
```bash
crontab -e
```

3. Ajoutez la ligne suivante :
```bash
# Tous les jours à 19h00 (heure du serveur)
0 19 * * * cd /chemin/vers/BudgetFlow && /usr/bin/env node scripts/trigger-notifications.js >> /var/log/budgetflow-notifications.log 2>&1
```

Ce script :

- charge automatiquement `.env.local`,
- appelle l'API en `POST`,
- envoie `CRON_SECRET` dans l'en-tête `x-cron-secret`,
- retourne un code d'erreur non nul si l'appel échoue (important pour diagnostiquer un cron).

### Option B bis : cron avec curl

Si vous préférez rester sur `curl`, utilisez un `POST` avec en-tête :

```bash
curl -X POST \
  -H "x-cron-secret: votre_mot_de_passe_tres_securise_ici" \
  "https://votre-domaine.com/api/notifications/trigger"
```

### Option C : Service externe gratuit
Utilisez un service comme **cron-job.org** (gratuit).
1. Créez un compte.
2. Ajoutez un nouveau "Cron Job".
3. URL : `https://votre-site.com/api/notifications/trigger?key=...`
4. Planning : "Every day at 19:00".

---

## 🧪 4. Tester manuellement

Vous pouvez tester l'envoi immédiat des notifications :

```bash
# Recommande : via le script Node (charge .env.local automatiquement)
npm run notifications:trigger

# Ou en local avec curl
curl -X POST \
  -H "x-cron-secret: votre_mot_de_passe_tres_securise_ici" \
  "http://127.0.0.1:8095/api/notifications/trigger"

# Compatibilite legacy / test navigateur
curl "http://127.0.0.1:8095/api/notifications/trigger?key=votre_mot_de_passe_tres_securise_ici"
```

Si tout fonctionne, vous recevrez une réponse JSON :
```json
{
  "success": true,
  "date": "2026-04-29",
  "totalUsers": 12,
  "eligibleUsers": 9,
  "skippedDisabled": 2,
  "skippedWithoutToken": 1,
  "sent": 12
}
```
