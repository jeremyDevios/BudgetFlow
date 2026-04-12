# 🔒 Sécurité & Gestion des Secrets

## 🔴 Vulnérabilités Corrigées

### 1. **API Keys Exposées** ✅
**Problème** : Les clés Firebase étaient en dur dans `firebase-messaging-sw.js`  
**Solution** : Génération dynamique au build depuis les variables d'environnement

### 2. **Pas de Règles Firestore** ✅
**Problème** : Aucune protection sur la base de données Firestore  
**Solution** : Implémentation de [firestore.rules](firestore.rules) avec validation stricte
- Chaque utilisateur ne peut lire/écrire que ses propres données
- Validation des montants (min/max)
- Validation des formats (email, longueur des chaînes)
- Validation des dates

### 3. **Logs exposant des infos sensibles** ✅
**Problème** : Tokens Firebase, IDs utilisateurs, erreurs complètes exposés  
**Solution** : Implémentation d'un logger sanitisé [src/lib/logger.ts](src/lib/logger.ts)
- Les logs sensibles sont filtrés en production
- Seuls les messages génériques sont exposés au client
- Détails complets en développement seulement

### 4. **Validation insuffisante** ✅
**Problème** : Pas de validation des montants, formats, longueurs  
**Solution** : 
- [src/lib/validation.ts](src/lib/validation.ts) - Fonctions de validation réutilisables
- [src/app/api/validate/transaction/route.ts](src/app/api/validate/transaction/route.ts) - Validation serveur
- Validation côté client dans les composants
- Contraintes strictes : `AMOUNT_MIN: 0.01`, `AMOUNT_MAX: 1000000`, etc.

### 5. **TypeScript non-strict** ✅
**Problème** : `strict: false` permet les erreurs de type  
**Solution** : Activation de `strict: true` dans [tsconfig.json](tsconfig.json)

### 6. **Pas de Headers de Sécurité HTTP** ✅
**Problème** : Pas de protection contre XSS, clickjacking, etc.  
**Solution** : Ajout dans [next.config.ts](next.config.ts) :
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000
```

---

## 📋 Fichiers de Sécurité

### Nouvelles Implémentations

| Fichier | Rôle |
|---------|------|
| [firestore.rules](firestore.rules) | Règles de sécurité Firestore |
| [src/lib/validation.ts](src/lib/validation.ts) | Validateurs réutilisables |
| [src/lib/logger.ts](src/lib/logger.ts) | Logger sanitisé |
| [src/app/api/validate/transaction/route.ts](src/app/api/validate/transaction/route.ts) | Validation serveur |

### Fichiers Modifiés

| Fichier | Changements |
|---------|------------|
| tsconfig.json | `strict: true` |
| next.config.ts | Headers de sécurité HTTP |
| src/app/(auth)/login/page.tsx | Validation entrées, logs sanitisés |
| src/app/api/notifications/trigger/route.ts | Logs sanitisés |
| src/components/dashboard/TransactionModal.tsx | Validation contraintes |
| src/context/AuthContext.tsx | Logs sanitisés |

---

## ✅ Bonnes pratiques de sécurité

### 1. Variables d'environnement
- ✅ Utilisez toujours des variables d'env pour les clés sensibles
- ✅ Commettez `.env.example` (avec valeurs vides)
- ❌ Ne commitez JAMAIS `.env.local` ou d'autres fichiers `.env`

### 2. Logs
- ✅ Utilisez `logger` de [src/lib/logger.ts](src/lib/logger.ts)
- ✅ Les logs sensibles sont filtrés en production
- ❌ N'appelez pas directement `console.error()` avec des erreurs Firebase

### 3. Validation
- ✅ Validez côté client avec [src/lib/validation.ts](src/lib/validation.ts)
- ✅ Validez côté serveur avant d'écrire en base
- ✅ Respectez les contraintes `VALIDATION_CONSTRAINTS`

### 4. Réponses d'erreur
- ✅ Retournez des messages génériques au client
- ✅ Loggez les détails complets serveur-side
- ❌ N'exposez jamais les détails d'erreur techniques au client

### 5. Firestore Rules
- ✅ Toujours définir des règles explicites
- ✅ Vérifier l'authentification et l'ownership
- ✅ Valider les types et les contraintes
- ❌ Ne jamais utiliser `allow read, write: if true;`

### 6. Parcours Fidélité (calcul des streaks)
- ✅ Le calcul des streaks est réalisé côté client pour une réactivité temps réel (UI heatmap et badges)
- ✅ Les dates utilisées (`transactionDates`, `loginDates`) doivent rester validées côté règles Firestore et côté serveur quand applicable
- ✅ En cas d'incohérence de fuseau horaire, normaliser les clés de date (`YYYY-MM-DD`) avant calcul

---

## 🚀 Déploiement en Production

### Vercel / Services d'hébergement

1. **Configurez les variables d'environnement** :
   - `NEXT_PUBLIC_FIREBASE_*` (publiques)
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (sensibles)
   - `CRON_SECRET` (très sensible)

2. **Déployez les Firestore Rules** :
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Vérifiez les headers de sécurité** en production :
   ```bash
   curl -I https://your-domain.com | grep -i "X-Content-Type-Options"
   ```

### Avant de déployer

```bash
# Vérifier qu'aucun fichier sensible n'est commité
git status

# Valider la syntaxe TypeScript
npm run build

# Tester les règles Firestore localement
firebase emulators:start
```

---

## 🔑 Rotation des Secrets

Si une clé est exposée :

1. **Révoquez la clé immédiatement**
   - Console Firebase pour les clés API
   - Firebase Auth pour les mots de passe
   - Système d'admin pour `CRON_SECRET`

2. **Générez une nouvelle clé**

3. **Mettez à jour les variables d'environnement** en production

4. **Redéployez** : Les nouvelles clés seront utilisées au prochain build

---

## 🛡️ Checklist de Sécurité

- [ ] Firestore Rules déployées
- [ ] Variables d'env configurées en production
- [ ] Aucun fichier `.env*` commité
- [ ] TypeScript strict validé
- [ ] Headers de sécurité présents
- [ ] Logs sanitisés en production
- [ ] Validations côté client implémentées
- [ ] Validations côté serveur implémentées

