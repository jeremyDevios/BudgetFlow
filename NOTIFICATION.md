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

Le système repose sur une simple page (API Route) de votre site qui, lorsqu'elle est visitée, déclenche l'envoi des notifications.

- **Le fichier magique** : `src/app/api/notifications/trigger/route.ts`
- **L'URL de déclenchement** : `https://votre-site.com/api/notifications/trigger?key=votre_mot_de_passe`

### Logique du Script
1. Il vérifie que le paramètre `?key=` correspond à votre `CRON_SECRET`.
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
*(Note : Vercel n'autorise les crons que sur les projets Pro ou Hobby avec limitations. Vérifiez leur doc).*

### Option B : Vous hébergez sur votre propre serveur (VPS, Coolify, etc.)
Utilisez l'outil `crontab` de votre serveur Linux.

1. Ouvrez l'éditeur cron :
```bash
crontab -e
```

2. Ajoutez la ligne suivante (remplacez l'URL et la clé) :
```bash
# Tous les jours à 19h00 (Heure du serveur)
0 19 * * * curl "https://votre-domaine.com/api/notifications/trigger?key=votre_mot_de_passe_tres_securise_ici" > /dev/null 2>&1
```

### Option C : Service externe gratuit
Utilisez un service comme **cron-job.org** (gratuit).
1. Créez un compte.
2. Ajoutez un nouveau "Cron Job".
3. URL : `https://votre-site.com/api/notifications/trigger?key=...`
4. Planning : "Every day at 19:00".

---

## 🧪 4. Tester manuellement

Vous pouvez tester l'envoi immédiat des notifications en ouvrant simplement l'URL dans votre navigateur ou via terminal :

```bash
# En local
curl "http://localhost:3000/api/notifications/trigger?key=votre_mot_de_passe_tres_securise_ici"
```

Si tout fonctionne, vous recevrez une réponse JSON :
```json
{
  "success": true,
  "processed": 12,
  "sent": 12
}
```
