# Marketing BudgetFlow — Plan de Publication App Store

> Document de référence pour la publication et la croissance de **BudgetFlow** sur l'App Store.
> Mis à jour : mars 2026 — Version 1.1

---

## Table des matières

1. [Checklist de validation App Store](#1-checklist-de-validation-app-store)
2. [Préparation App Store Connect](#2-préparation-app-store-connect)
3. [Métadonnées ASO](#3-métadonnées-aso)
4. [Plan Screenshots](#4-plan-screenshots)
5. [App Preview Video — Script 30 secondes](#5-app-preview-video--script-30-secondes)
6. [Stratégie de lancement](#6-stratégie-de-lancement)
7. [Stratégie de notation & avis (StoreKit)](#7-stratégie-de-notation--avis-storekit)
8. [Press Kit — contenu à préparer](#8-press-kit--contenu-à-préparer)
9. [Politique de confidentialité](#9-politique-de-confidentialité)
10. [KPIs & suivi post-lancement](#10-kpis--suivi-post-lancement)

---

## 1. Checklist de validation App Store

> Tout ce qui doit être vérifié et validé **avant** la soumission à Apple. Un seul point manquant peut entraîner un rejet.

### Conformité légale & technique

- [ ] **Politique de confidentialité** : URL live, accessible publiquement, non protégée par authentification
- [ ] **URL de politique de confidentialité** renseignée dans App Store Connect (champ "Privacy Policy URL")
- [ ] **URL de support** live et accessible (ex. page contact ou email dédié)
- [ ] **Suppression de compte** : l'utilisateur peut supprimer toutes ses données depuis Réglages → "Supprimer mes données" (obligation Apple depuis 2023)
- [ ] **Suppression de données** : la suppression efface bien toutes les données locales (SwiftData) ET les données distantes (compte Firebase Auth + documents Firestore associés)
- [ ] **Classification d'âge** : correctement définie à **4+** (application de gestion financière sans contenu sensible)
- [ ] Aucune référence aux applications concurrentes (YNAB, Linxo, Bankin') dans les métadonnées

### Qualité de l'application

- [ ] **Aucun crash** sur iPhone SE (écran 4.7"), iPhone 14/15/16 (6.1"), iPhone 16 Pro Max (6.9")
- [ ] **Aucun crash** à la première ouverture (cold launch) et après un retour en arrière-plan prolongé
- [ ] Orientation portrait testée sur toutes les tailles d'écran requises
- [ ] Aucune API privée utilisée (vérifiable via `nm -u BudgetFlow.app/BudgetFlow | grep _Private`)
- [ ] Aucune référence au simulateur ou au code de débogage dans le binaire de release
- [ ] Aucun contenu placeholder (texte "Lorem ipsum", données de test codées en dur)
- [ ] Icône de l'app : fichier PNG 1024×1024 px, sans canal alpha, sans coins arrondis (Apple les arrondit lui-même)
- [ ] Toutes les performances respectées : écrans < 2 s de chargement, transitions fluides 60 fps
- [ ] Accessibilité : labels VoiceOver ajoutés sur les éléments interactifs critiques
- [ ] Localisation : langue principale (Français) définie dans Xcode → Project → Localizations

### Cohérence des métadonnées

- [ ] Le titre de l'app dans les métadonnées correspond au nom affiché dans l'app
- [ ] La description ne fait pas de promesses que l'app ne tient pas
- [ ] Les screenshots correspondent aux vraies fonctionnalités de la version soumise
- [ ] Le champ "What's New" est renseigné pour toute mise à jour (inutile pour la v1.0)
- [ ] La catégorie principale sélectionnée : **Finance**
- [ ] La catégorie secondaire (optionnelle) : **Lifestyle** ou **Productivity**

### Achats intégrés & monétisation

- [ ] Si aucun achat in-app : confirmer que l'app ne contient aucune référence à une boutique externe ou un lien de paiement externe
- [ ] Si abonnement prévu : toutes les descriptions IAP sont renseignées en App Store Connect

### Assets requis

- [ ] Icône 1024×1024 px (App Store icon) — PNG sans alpha
- [ ] Au moins **3 screenshots** iPhone 6.7" (requis)
- [ ] Au moins **3 screenshots** iPhone 6.5" (requis)
- [ ] App Preview Video (optionnel mais fortement recommandé)

---

## 2. Préparation App Store Connect

### 2.1 Compte Apple Developer

- [ ] Créer ou vérifier le statut du compte sur [developer.apple.com](https://developer.apple.com) — abonnement **99 $/an**
- [ ] Vérifier que le contrat "Paid Applications Agreement" est signé dans App Store Connect (obligatoire pour toute app gratuite ou payante)
- [ ] Activer l'authentification à deux facteurs sur l'Apple ID propriétaire

### 2.2 Identifiants & provisioning

| Étape | Action | Localisation Xcode |
|---|---|---|
| Bundle ID | Enregistrer `com.votrecompte.BudgetFlow` | Apple Developer → Certificates, IDs & Profiles → Identifiers |
| Certificate | Créer un certificat **Distribution (App Store)** | Xcode → Settings → Accounts → Manage Certificates |
| Provisioning Profile | Créer un profil **App Store Distribution** lié au Bundle ID | Developer Portal → Profiles |
| App Record | Créer la fiche dans App Store Connect | appstoreconnect.apple.com → My Apps → + |

### 2.3 Création de la fiche dans App Store Connect

1. Aller dans **My Apps → +** → **New App**
2. Platform : **iOS**
3. Name : `BudgetFlow – Budget Enveloppes` *(voir section ASO)*
4. Primary Language : **French**
5. Bundle ID : sélectionner l'identifiant créé ci-dessus
6. SKU : `budgetflow-ios-v1` (identifiant interne, non visible)
7. User Access : **Full Access** (sauf si équipe multi-membres)

### 2.4 Configuration dans Xcode avant archive

```
Product → Scheme → Edit Scheme → Run → Build Configuration → Release
Product → Archive → Distribute App → App Store Connect → Upload
```

- Activer **Bitcode** : Non (déprécié iOS 16+)
- Activer **Strip Swift Symbols** : Oui
- Activer **Upload symbols** : Oui (pour Crashlytics / symbolication)

### 2.5 Assets visuels requis

| Asset | Dimensions | Format | Obligatoire |
|---|---|---|---|
| App Icon | 1024 × 1024 px | PNG sans alpha | ✅ |
| Screenshot iPhone 6.7" | 1290 × 2796 px | PNG ou JPEG | ✅ |
| Screenshot iPhone 6.5" | 1242 × 2688 px | PNG ou JPEG | ✅ |
| Screenshot iPhone 5.5" | 1242 × 2208 px | PNG ou JPEG | ⬜ recommandé |
| Screenshot iPad Pro 12.9" | 2048 × 2732 px | PNG ou JPEG | ⬜ recommandé |
| App Preview Video (6.7") | 886 × 1920 px ou 1290 × 2796 px | MOV/MP4, ≤ 500 MB, ≤ 30 s | ⬜ fortement recommandé |

---

## 3. Métadonnées ASO

> L'ASO (App Store Optimization) est la clé de la visibilité organique. Chaque caractère compte.

### 3.1 Analyse concurrentielle

Les apps ciblant les mêmes mots-clés :

| Concurrent | Mots-clés forts | Points faibles (à exploiter) |
|---|---|---|
| YNAB | budget,enveloppes,épargne | Payant (50 €/an), interface complexe |
| Wallet — Budget & Finance | gestion budget,suivi dépenses | Lourd, publicités, synchronisation cloud |
| Bankin' | compte bancaire,virements | Nécessite accès bancaire, pas de mode offline |
| Money Manager | finances personnelles,tracker | UX dépassée, pas de dark mode premium |

**Opportunité BudgetFlow** : beautiful dark UI premium, méthode enveloppes intuitive, synchronisation optionnelle via Firebase, design différenciant — aucun concurrent ne combine ces attributs avec une expérience aussi soignée.

---

### 3.2 Métadonnées en Français (locale principale : `fr-FR`)

#### Nom de l'app — *30 caractères max*

```
BudgetFlow – Budget Enveloppes
```
**Compte : 30 caractères** ✅

> Pourquoi : "Budget Enveloppes" est la requête exacte recherchée par les utilisateurs de la méthode. "BudgetFlow" ancre la marque. Le tiret assure la lisibilité dans les résultats de recherche.

#### Sous-titre — *30 caractères max*

```
Contrôle tes dépenses en 2 min
```
**Compte : 30 caractères** ✅

> Variante A/B à tester : `Finances perso, simple & beau` (29 caractères)

#### Mots-clés — *100 caractères max, virgule sans espace*

```
gestion,finances,dépenses,économies,épargne,argent,compte,mensuel,revenus,tracker,personal,finance
```
**Compte : 96 caractères** ✅

> Règles respectées :
> - Aucun doublon avec le titre ("budget", "enveloppes") ni le sous-titre ("contrôle", "dépenses")
> - Mélange français + anglais pour capter les bilingues
> - Termes haute intention : "épargne", "revenus", "tracker"

#### Texte promotionnel — *170 caractères max* (modifiable sans mise à jour)

```
🆕 Version 1.0 disponible ! Gérez vos finances avec la méthode enveloppes — simple, beau, synchronisé sur tous vos appareils. Téléchargement gratuit.
```
**Compte : 152 caractères** ✅

#### Description complète — *4 000 caractères max*

> Les 3 premières lignes (avant "Plus") sont les plus importantes — elles s'affichent sans que l'utilisateur ait à taper "Plus".

```
Reprenez le contrôle de votre argent avec la méthode des enveloppes budgétaires.
BudgetFlow divise votre revenu en catégories de dépenses — et suit chaque euro en temps réel.
Beau, simple et synchronisé : vos données accessibles sur tous vos appareils iOS.

─────────────────────────────

✦ LA MÉTHODE ENVELOPPES, RÉINVENTÉE

Chaque euro que vous gagnez a un but précis. Alimentez vos enveloppes (Courses, Essence, Loisirs…), dépensez-les au fur et à mesure, et visualisez instantanément ce qu'il vous reste. Fini les fins de mois surprises.

─────────────────────────────

✦ CE QUE VOUS POUVEZ FAIRE

• Créer vos enveloppes personnalisées avec icônes et couleurs
• Saisir vos revenus, charges fixes et objectif d'épargne en 2 minutes
• Enregistrer chaque dépense en quelques secondes
• Suivre votre budget mois par mois avec un graphique d'évolution sur 12 mois
• Visualiser vos flux financiers avec un diagramme de flux (Cash Flow)
• Consulter l'historique complet de toutes vos transactions

─────────────────────────────

✦ SÉCURISÉ ET SYNCHRONISÉ

BudgetFlow protège vos données avec Firebase Authentication. Vos enveloppes et transactions sont synchronisées via Firebase Firestore, chiffrées en transit et au repos. Votre compte vous appartient — supprimez-le à tout moment depuis l'application. Aucune publicité, aucune revente de données.

─────────────────────────────

✦ UN DESIGN QUI VOUS DONNE ENVIE D'OUVRIR L'APP

Interface sombre premium, accents ambrés, animations fluides. BudgetFlow a été pensé pour être l'app de finances la plus agréable visuellement sur iOS — parce qu'une belle app, c'est une app qu'on utilise vraiment.

─────────────────────────────

✦ DÉMARREZ EN 2 MINUTES

1. Entrez votre revenu mensuel, vos charges fixes et votre épargne cible
2. Créez ou personnalisez vos enveloppes de dépenses
3. C'est tout — votre tableau de bord est prêt

─────────────────────────────

Téléchargez BudgetFlow gratuitement et commencez à maîtriser vos finances dès aujourd'hui.
```

**Compte estimé : ~1 650 caractères** ✅ *(bien dans la limite de 4 000)*

---

### 3.3 Métadonnées en Anglais (locale secondaire : `en-US`)

#### App Name

```
BudgetFlow – Envelope Budget
```
**Compte : 28 caractères** ✅

#### Subtitle

```
Track every euro, privately
```
**Compte : 27 caractères** ✅

#### Keywords

```
budget,envelope,spending,tracker,money,savings,finance,personal,monthly,expenses,income,cash,flow
```
**Compte : 96 caractères** ✅

#### Promotional Text

```
🆕 Version 1.0 is live! Manage your money with the envelope method — beautiful, simple, synced across devices. Free download.
```
**Compte : 135 caractères** ✅

#### Description (English)

```
Take back control of your money with the envelope budgeting method.
BudgetFlow splits your income into spending categories — and tracks every euro in real time.
Beautiful, simple, and secure: your data synced across all your iOS devices.

─────────────────────────────

✦ THE ENVELOPE METHOD, REIMAGINED

Give every euro a job. Fill your envelopes (Groceries, Gas, Entertainment…), spend from them throughout the month, and instantly see what's left. No more end-of-month surprises.

─────────────────────────────

✦ WHAT YOU CAN DO

• Create custom envelopes with icons and colors
• Set up your income, fixed costs, and savings goal in 2 minutes
• Log expenses in seconds
• Track your budget month by month with a 12-month evolution chart
• Visualize your money flows with a Cash Flow diagram
• Browse your full transaction history

─────────────────────────────

✦ SECURE & SYNCED

BudgetFlow uses Firebase Authentication to protect your account and Firebase Firestore to sync your envelopes and transactions securely across devices. Data is encrypted in transit and at rest. No ads, no data selling. Delete your account anytime from the app.

─────────────────────────────

✦ A DESIGN THAT MAKES YOU WANT TO OPEN THE APP

Premium dark interface, amber accents, smooth animations. BudgetFlow is designed to be the most visually enjoyable finance app on iOS — because a beautiful app is an app you actually use.

─────────────────────────────

Download BudgetFlow for free and start mastering your finances today.
```

---

## 4. Plan Screenshots

> Minimum : **5 captures** pour iPhone 6.7" et iPhone 6.5". L'ordre est crucial — les 2 premières captures réalisent 80 % de la conversion.

### Outils recommandés

| Outil | Usage | Prix |
|---|---|---|
| **AppMockUp** (appmockup.com) | Déposer captures brutes → export avec device frame | Gratuit / Pro |
| **Previewed.app** | Templates premium + animations | Freemium |
| **Figma** | Composition texte + fond dégradé personnalisé | Gratuit |
| **Hotpot.ai / Screenshots.pro** | Génération assistée par IA | Payant |
| **Xcode Simulator** | Captures nettes aux résolutions exactes | Gratuit |

### Dimensions requises

| Device | Résolution | Obligatoire |
|---|---|---|
| iPhone 6.7" (iPhone 16 Pro Max) | 1290 × 2796 px | ✅ |
| iPhone 6.5" (iPhone 14 Plus) | 1242 × 2688 px | ✅ |
| iPhone 5.5" (iPhone 8 Plus) | 1242 × 2208 px | Recommandé |
| iPad Pro 12.9" (6e gen) | 2048 × 2732 px | Recommandé |

---

### Capture 1 — Hero Shot (Dashboard)

| Paramètre | Valeur |
|---|---|
| **Écran capturé** | DashboardView — enveloppes colorées toutes remplies (mois complet) |
| **Titre principal** (≤6 mots) | `Ton budget, enfin maîtrisé` |
| **Sous-titre** | Dépense par catégorie, en temps réel |
| **Mise en valeur visuelle** | Grille 2×3 d'enveloppes avec couleurs vives, BalanceSummaryCard verte |
| **Fond de la slide** | Dégradé noir #09090B → #1C1C1E, même teinte que l'app |
| **Objectif émotionnel** | Sécurité, clarté, envie d'essayer |
| **Note de production** | Capturer avec des vraies enveloppes nommées (Courses, Essence, Loisirs, Restauration, Sport, Sorties) — budgets presque atteints pour montrer l'utilisation |

---

### Capture 2 — Cash Flow (Diagramme Sankey)

| Paramètre | Valeur |
|---|---|
| **Écran capturé** | CashFlowView — diagramme flux complet avec revenus → charges → enveloppes |
| **Titre principal** | `Visualise chaque euro dépensé` |
| **Sous-titre** | Tes flux financiers en un coup d'œil |
| **Mise en valeur visuelle** | Flux animé ou freeze sur un mois bien rempli, couleurs ambrées + bleues |
| **Fond de la slide** | Fond noir pur avec halo ambré derrière le diagramme |
| **Objectif émotionnel** | Fascination, différenciation — "je n'ai jamais vu ça dans une app budget" |
| **Note de production** | S'assurer que les nœuds sont bien lisibles — zoom sur la partie centrale du Sankey si nécessaire |

---

### Capture 3 — Onboarding

| Paramètre | Valeur |
|---|---|
| **Écran capturé** | StepBasicsView (Étape 1) — champ revenu rempli, carte "Capacité disponible" verte |
| **Titre principal** | `Prêt en 2 minutes` |
| **Sous-titre** | Entre ton revenu, c'est tout |
| **Mise en valeur visuelle** | Carte verte animée avec le montant de capacité, clavier numérique visible |
| **Fond de la slide** | Fond dégradé vert très sombre → noir pour contraster |
| **Objectif émotionnel** | Facilité, accessibilité — "c'est vraiment simple" |
| **Note de production** | Utiliser des montants réalistes (ex: 2 500 € de revenu, 800 € de charges, 300 € d'épargne) |

---

### Capture 4 — Graphique d'évolution (12 mois)

| Paramètre | Valeur |
|---|---|
| **Écran capturé** | EvolutionView — graphique en aire sur 12 mois avec tendance à la baisse des dépenses |
| **Titre principal** | `Tes progrès mois par mois` |
| **Sous-titre** | 12 mois d'historique visuel |
| **Mise en valeur visuelle** | Highlight sur le dernier mois le plus bas — flèche ou annotation "✓ Meilleur mois" |
| **Fond de la slide** | Fond sombre avec halo ambré en bas du graphique |
| **Objectif émotionnel** | Progression, satisfaction, désir de suivre sur le long terme |
| **Note de production** | Préparer des données de test sur 12 mois avec une tendance positive (dépenses décroissantes) |

---

### Capture 5 — Historique des transactions

| Paramètre | Valeur |
|---|---|
| **Écran capturé** | HistoryView — liste de transactions du mois, bien remplie, icônes colorées par enveloppe |
| **Titre principal** | `Tout l'historique, zéro effort` |
| **Sous-titre** | Chaque dépense retrouvée en un instant |
| **Mise en valeur visuelle** | 6-8 transactions visibles, icônes SF Symbols diversifiées, montants variés |
| **Fond de la slide** | Fond neutre sombre |
| **Objectif émotionnel** | Confiance, rigueur, sentiment de contrôle total |

---

### Capture 6 (bonus) — Ajout d'une transaction

| Paramètre | Valeur |
|---|---|
| **Écran capturé** | AddTransactionView — sheet modale ouverte, montant saisi, enveloppe sélectionnée |
| **Titre principal** | `Saisi en 3 secondes` |
| **Sous-titre** | Enveloppe mise à jour instantanément |
| **Mise en valeur visuelle** | Clavier numérique + champ montant + picker enveloppe — fluidité visible |
| **Fond de la slide** | Fond sombre + surbrillance sur le champ actif |
| **Objectif émotionnel** | Vitesse, simplicité, habit-forming |

---

## 5. App Preview Video — Script 30 secondes

> Règles Apple : max 30 secondes, lecture automatique sans son (titre et légendes obligatoires), doit montrer uniquement la vraie interface de l'app.

### Specs techniques

| Paramètre | Valeur |
|---|---|
| Résolution (iPhone 6.7") | 886 × 1920 px ou 1290 × 2796 px |
| Format | MOV ou MP4, H.264 |
| Durée | 15 à 30 secondes |
| Taille max | 500 MB |
| Son | Optionnel (auto-play muet) |

### Outils de production

- **Xcode Simulator** : Enregistrement écran via `⌘ + R` dans le Simulator
- **Final Cut Pro / iMovie** : Montage + titres + étalonnage
- **CapCut** : Alternative rapide avec templates verticaux
- **Musique** : Pixabay Audio ou Epidemic Sound (licence commerciale) — ambiance calme/moderne

---

### Script scène par scène

| Temps | Écran | Action | Titre/Légende à l'écran |
|---|---|---|---|
| **0 – 3 s** | Écran d'accueil Onboarding | Ouverture de l'app — animation des pillules flottantes (dépenses) sur fond noir | *"BudgetFlow"* — tagline fade-in |
| **3 – 8 s** | StepBasicsView (Étape 1) | Saisie du revenu mensuel → carte "Capacité disponible" s'illumine en vert | *"Configure ton budget en 2 min"* |
| **8 – 14 s** | DashboardView | Grille d'enveloppes apparaît — 6 enveloppes colorées avec budgets | *"Ton argent organisé par enveloppe"* |
| **14 – 20 s** | AddTransactionView | Tap sur le bouton FAB → feuille modale → saisie montant → confirmation → l'enveloppe "Courses" diminue en temps réel | *"Saisis chaque dépense en 3 secondes"* |
| **20 – 25 s** | EvolutionView | Graphique 12 mois se dessine en animation — courbe descendante | *"Suis tes progrès mois par mois"* |
| **25 – 30 s** | CashFlowView | Diagramme Sankey s'anime — flux de revenus → dépenses → épargne | Icône app + *"BudgetFlow — Gratuit sur l'App Store"* |

---

## 6. Stratégie de lancement

### Phase 1 — Pré-lancement (J-14 à J-2)

**Objectif** : Construire une audience minimale avant le jour J, créer de l'anticipation.

- [ ] Créer un compte **Twitter/X** `@BudgetFlowApp` et **Instagram** `@budgetflow.app`
- [ ] Créer une page de présentation simple (Carrd, Linktree ou Notion public) avec :
  - Screenshots de l'app
  - Description en 3 lignes
  - Lien "Bientôt disponible sur l'App Store"
- [ ] Publier **3 posts teaser** échelonnés sur 2 semaines :
  - Post 1 : Mockup du Dashboard avec headline "Bientôt…" — Instagram + Twitter
  - Post 2 : Courte démo screen recording (15 s) montrant l'ajout d'une transaction
  - Post 3 : "J-2 avant le lancement" avec lien App Store pré-généré (App Store Connect → Pre-Order ou lien direct)
- [ ] Préparer la **fiche Product Hunt** (titre, tagline, galerie d'images, description, lien)
- [ ] Recruter **5 beta testeurs** via TestFlight — leur demander de noter l'app dès le jour du lancement
- [ ] Préparer les posts Reddit (texte + lien) pour les communautés cibles
- [ ] Vérifier que la **politique de confidentialité** est en ligne et accessible

---

### Phase 2 — Jour de lancement

**Objectif** : Maximiser le volume de téléchargements et de notes dans les 72 premières heures (signal fort pour l'algorithme App Store).

#### Product Hunt

- [ ] Soumettre entre **mardi et jeudi**, à **00h01 PT** (9h01 heure de Paris) pour maximiser l'exposition au classement du jour
- [ ] Tagline : *"L'app budget la plus belle sur iOS — méthode enveloppes, 100 % privée"*
- [ ] Galerie : 5 screenshots + App Preview Video
- [ ] Premier commentaire : message personnel du fondateur expliquant la genèse de l'app
- [ ] Répondre à chaque commentaire dans les 2 premières heures

#### Reddit — Communautés anglophones

- [ ] **r/personalfinance** — Post "I built an envelope budget app for iOS — here's what I learned"
- [ ] **r/iOSProgramming** — Post technique "I shipped my first SwiftUI app (envelope budgeting) — AMA"
- [ ] **r/SideProject** — Post "6 months of building → finally live on the App Store"
- [ ] **r/frugal** — Post axé sur la méthode enveloppes et les économies réalisées

#### Communautés francophones

- [ ] **r/france** et **r/finances** (Reddit FR) — Post en français : "J'ai créé une app iOS pour gérer son budget par enveloppes — disponible gratuitement"
- [ ] **forum.hardware.fr** (section Logiciels) — Présentation de l'app
- [ ] **Communautés Discord** : serveurs finance personnelle, développement iOS, indé hackers francophones
- [ ] **Hacker News** — "Show HN: BudgetFlow – envelope budget iOS app, offline-first, SwiftData"
- [ ] Contacter les **testeurs TestFlight** par email — demander une note et un avis dès aujourd'hui

---

### Phase 3 — Croissance (Semaines 1 à 4)

**Objectif** : Installer un flux constant de nouveaux utilisateurs et améliorer l'ASO en continu.

#### Contenu court-format (Reels/TikTok)

- [ ] **Vidéo 1** : "Mon budget du mois en 30 secondes avec BudgetFlow" — screen recording + voix off
- [ ] **Vidéo 2** : "La méthode enveloppes expliquée en 60 secondes" — contenu éducatif avec CTA téléchargement
- [ ] **Vidéo 3** : "J'ai dépensé 0 € de trop ce mois-ci — voilà comment" — storytelling finances perso + demo app
- [ ] **Vidéo 4** : "L'app que j'aurais voulu avoir il y a 2 ans" — point de vue fondateur

#### Influence & presse

- [ ] Identifier **5-10 créateurs YouTube/Instagram** francophones sur les finances personnelles (ex : Heu Reka, Finary, Épargne Facile)
- [ ] Envoyer un **email de pitch personnalisé** avec :
  - Accès TestFlight ou lien App Store
  - Press Kit attaché (screenshots + description)
  - Proposition de contenu (review, mention, partenariat)
- [ ] Contacter **3-5 blogs tech/finance** francophones pour un article de présentation :
  - iGeneration.fr, MacGeneration.com
  - Finary.com/blog, MoneyVox.fr (section outils)
  - Commentçamarche.net / 01net.com (section apps)

#### Optimisation ASO continue

- [ ] Contrôler les rangs de mots-clés chaque semaine dans App Store Connect → Analytics → Sources → App Store Search
- [ ] Remplacer les mots-clés sous-performants (< 5 impressions/semaine) après 3 semaines
- [ ] Tester variant de sous-titre avec **Product Page Optimization** (App Store Connect) dès 500 impressions/semaine atteintes
- [ ] Analyser les termes de recherche menant à la fiche dans les rapports Analytics

---

## 7. Stratégie de notation & avis (StoreKit)

> Utiliser `SKStoreReviewController.requestReview()` (ou l'API SwiftUI correspondante). Apple limite les demandes à **3 par an** — chaque déclenchement doit être au bon moment.

### ✅ Moments idéaux pour déclencher la demande

| Moment | Condition technique | Justification |
|---|---|---|
| Après la **3e transaction enregistrée** | `transactions.count == 3` | L'utilisateur a démontré un usage réel, pas juste un test |
| Après la **complétion de l'onboarding** + première consultation du dashboard | `isOnboardingCompleted == true && dashboardAppearanceCount == 1` | Moment d'enthousiasme — l'utilisateur voit son budget pour la première fois |
| Après **3 jours d'utilisation consécutifs** | Stocker `lastUsedDate` dans UserDefaults, vérifier streak ≥ 3 | L'app est devenue une habitude |
| Après la **fermeture d'un mois** sans dépassement de budget | Tous les enveloppes ≥ 0 en fin de mois | Moment de satisfaction maximale |

### ❌ Moments à éviter absolument

- Première ouverture de l'app (cold launch)
- Pendant l'onboarding (friction)
- Après un plantage ou une erreur
- Après une suppression de transaction (frustration potentielle)
- Si l'utilisateur vient de revenir d'un écran de paramètres (intent de sortie)

### Implémentation recommandée

```swift
// À appeler depuis DashboardView ou AddTransactionView
// après vérification des conditions
import StoreKit

func requestReviewIfAppropriate() {
    guard meetsReviewCriteria() else { return }
    if let windowScene = UIApplication.shared
        .connectedScenes
        .first as? UIWindowScene {
        SKStoreReviewController.requestReview(in: windowScene)
    }
    // Stocker la date de dernière demande pour ne pas re-déclencher
    UserDefaults.standard.set(Date(), forKey: "lastReviewRequestDate")
}

func meetsReviewCriteria() -> Bool {
    let transactionCount = // compter depuis SwiftData
    let lastRequest = UserDefaults.standard.object(forKey: "lastReviewRequestDate") as? Date
    let twoMonthsAgo = Calendar.current.date(byAdding: .month, value: -2, to: Date())!
    
    return transactionCount >= 3 &&
           (lastRequest == nil || lastRequest! < twoMonthsAgo)
}
```

### Objectif de notation

- **Cible 6 mois** : 4,5 étoiles minimum, 50+ avis
- Répondre **à chaque avis négatif** dans App Store Connect — Apple valorise les développeurs réactifs
- Pour les avis 1-2 étoiles : proposer un email de support direct pour résoudre le problème

---

## 8. Press Kit — contenu à préparer

> Créer un dossier `/press-kit/` (ou archive ZIP) à mettre à disposition sur demande ou via un lien public Dropbox/iCloud Drive.

### Assets visuels

- [ ] **Icône app** — 1024×1024 px PNG sans alpha (version claire + version sombre si applicable)
- [ ] **5 screenshots device-framed** — iPhone 16 Pro Max, fond transparent ou assorti au thème de l'app
- [ ] **1 bannière horizontale** — 1920×1080 px (hero image pour articles de blog et Product Hunt)
- [ ] **1 bannière carrée** — 1200×1200 px (pour posts Instagram/Twitter)
- [ ] **Logo BudgetFlow** — SVG + PNG (sur fond transparent, sur fond blanc, sur fond noir)
- [ ] **Palette de couleurs** — HEX + RGB pour : Noir (#09090B), Surface (#1C1C1E), Ambré (#F4941A), Blanc (#FFFFFF)

### Textes

#### Description courte (50 mots)
```
BudgetFlow est une app iOS de gestion de budget par la méthode enveloppes. 
Elle permet de diviser son revenu mensuel en catégories de dépenses, 
de suivre chaque euro en temps réel et de visualiser ses flux financiers. 
Synchronisée via Firebase, sécurisée, design premium dark mode.
```

#### Description moyenne (150 mots)
```
BudgetFlow réinvente la méthode des enveloppes budgétaires sur iOS.
Chaque mois, l'utilisateur répartit son revenu disponible entre des 
enveloppes personnalisées (Courses, Essence, Loisirs, etc.), puis saisit 
ses dépenses au fil de la journée. L'app met à jour ses enveloppes en 
temps réel et affiche des alertes visuelles dès qu'une catégorie approche 
de son plafond.

En plus du suivi mensuel, BudgetFlow propose un graphique d'évolution sur 
12 mois et un diagramme de flux financiers (Cash Flow) inédit dans les apps 
budget grand public.

Développée en SwiftUI avec Firebase en arrière-plan, l'app propose une 
authentification sécurisée et une synchronisation de vos données sur 
tous vos appareils iOS via Firebase Firestore. Les données sont chiffrées 
en transit et au repos. Aucune publicité, aucune revente de données.

Disponible gratuitement sur l'App Store.
```

#### Description longue (500 mots) — *pour articles de presse*

```
BudgetFlow est une application iOS de gestion de budget personnel 
fondée sur la méthode des enveloppes, une technique de gestion 
budgétaire éprouvée popularisée par des ouvrages comme "The Total 
Money Makeover". Contrairement aux applications bancaires ou aux 
agrégateurs de comptes, BudgetFlow ne se connecte à aucune institution 
financière — elle place l'utilisateur au volant de ses propres décisions.

Le principe est simple : chaque mois, l'utilisateur renseigne son revenu 
net, ses charges fixes (loyer, abonnements) et son objectif d'épargne. 
BudgetFlow calcule instantanément la capacité budgétaire disponible, que 
l'utilisateur répartit ensuite entre des enveloppes personnalisées. Chaque 
enveloppe représente une catégorie de dépenses — Courses, Restaurant, 
Transport, Loisirs — avec un budget mensuel alloué.

Au quotidien, saisir une dépense prend moins de 5 secondes. L'enveloppe 
correspondante se met à jour en temps réel, avec un indicateur visuel 
(vert → orange → rouge) qui reflète l'état du budget restant. Plus besoin 
de faire des calculs mentaux ou d'ouvrir un tableau de bord bancaire : 
l'information est là, claire et immédiate.

BudgetFlow se distingue par deux fonctionnalités visuelles inédites dans 
sa catégorie. Le graphique d'évolution présente les dépenses mois par mois 
sur 12 mois sous forme d'un graphique en aire animé, permettant d'identifier 
les tendances à long terme. Le diagramme Cash Flow affiche les flux 
financiers sous forme de Sankey diagram : revenus → catégories de dépenses 
→ épargne. Cette représentation, habituelle seulement dans les outils de 
gestion d'entreprise, est ramenée à l'échelle du budget personnel.

Sur le plan technique, l'application est développée en SwiftUI et s'appuie 
sur Firebase Authentication pour la gestion des comptes et Firebase Firestore 
pour la persistance et la synchronisation des données entre appareils. SwiftData 
est utilisé pour le cache local et le fonctionnement hors connexion temporaire. 
L'application n'intègre aucun SDK de tracking ou de publicité. Les données 
financières de l'utilisateur sont chiffrées en transit (HTTPS/TLS) et au repos 
via les garanties de sécurité de Firebase/Google Cloud. L'utilisateur peut 
supprimer intégralement son compte et ses données depuis l'application.

Le design a été pensé pour être à la fois premium et accessible. Un thème 
sombre intégral (fond #09090B) et des accents ambrés (#F4941A) donnent à 
l'app une identité visuelle forte, en rupture avec les interfaces blanches 
et "corporate" de ses concurrents directs. L'objectif : créer une app que 
l'utilisateur prend plaisir à ouvrir chaque jour, renforçant ainsi la 
régularité — clé du succès de tout système budgétaire.

BudgetFlow est disponible gratuitement sur l'App Store, sans publicité et 
sans achat intégré. L'application a été développée de manière indépendante 
et s'adresse en priorité aux utilisateurs iOS francophones désireux de 
reprendre le contrôle de leur argent sans compromis sur leur vie privée.
```

### Informations de contact

- [ ] **Email presse** : [à créer] press@budgetflow.app ou contact@budgetflow.app
- [ ] **Site web** / landing page (même simple) avec lien App Store
- [ ] **Lien App Store** disponible à J-0
- [ ] Bio du fondateur (2 phrases) : *"[Prénom NOM] est développeur iOS indépendant basé en France. Après des années à chercher l'app budget parfaite sans la trouver, il a décidé de la construire lui-même."*

---

## 9. Politique de confidentialité

> Obligatoire pour toute app sur l'App Store. Doit être en ligne à une URL publique **avant soumission**.

### Outil recommandé

**App Privacy Policy Generator** — [app-privacy-policy-generator.firebaseapp.com](https://app-privacy-policy-generator.firebaseapp.com)  
Sélectionner le template iOS, remplir les champs ci-dessous.

### Sections à inclure obligatoirement

#### 1. Données collectées

```
BudgetFlow collecte les données nécessaires au fonctionnement du compte et à la synchronisation :
- **Adresse e-mail** : utilisée pour l'authentification via Firebase Authentication
- **Données financières** : revenus, dépenses, enveloppes et transactions, stockées dans Firebase Firestore et associées au compte de l'utilisateur
- **Identifiant utilisateur (UID)** : généré par Firebase Authentication, non lié à l'identité civile

Ces données sont hébergées sur les serveurs Google (Firebase / Google Cloud Platform), soumis au RGPD pour les utilisateurs européens.
```

#### 2. Données non collectées

Mentionner explicitement l'absence de :
- Données de localisation
- Contacts, photos ou médias
- Identifiant publicitaire (IDFA)
- SDK de tracking ou analytics tiers
- Partage de données financières avec des tiers publicitaires

**Données collectées et hébergées** : e-mail (authentification Firebase), données financières (Firestore), UID Firebase.

#### 3. Services tiers

```
BudgetFlow utilise les services tiers suivants :

| Service | Éditeur | Usage | Politique de confidentialité |
|---|---|---|---|
| Firebase Authentication | Google LLC | Authentification des comptes utilisateurs | [firebase.google.com/support/privacy](https://firebase.google.com/support/privacy) |
| Firebase Firestore | Google LLC | Stockage et synchronisation des données financières | [firebase.google.com/support/privacy](https://firebase.google.com/support/privacy) |

Aucune donnée n'est partagée avec des partenaires publicitaires ou des agrégateurs de données.

#### 4. Sécurité des données

```
Les données sont protégées par les mécanismes de sécurité natifs d'iOS 
(sandbox applicatif, chiffrement du stockage via Data Protection). 
L'utilisateur contrôle intégralement ses données.
```

#### 5. Suppression des données

```
L'utilisateur peut supprimer l'intégralité de ses données à tout moment depuis Réglages → Supprimer mon compte. Cette action :
- Supprime le compte Firebase Authentication
- Supprime tous les documents Firestore associés (enveloppes, transactions, paramètres)
- Efface les données SwiftData locales sur l'appareil

La simple désinstallation de l'application supprime les données locales (SwiftData) mais ne supprime pas le compte Firebase ni les données distantes. Pour une suppression complète, utiliser la fonction “Supprimer mon compte” dans l'app.
```

#### 6. Contact

```
Pour toute question relative à la confidentialité, contactez-nous à :
[email@domaine.com]
```

#### 7. Modifications de la politique

```
En cas de mise à jour de cette politique (notamment si une fonctionnalité 
cloud est ajoutée), les utilisateurs seront informés lors de la prochaine 
mise à jour de l'application.
```

---

### Déclaration App Store Connect ("App Privacy")

Dans App Store Connect → App Privacy, déclarer :

| Catégorie | Collecté | Lié à l'utilisateur | Suivi publicitaire |
|---|---|---|---|
| Données financières (revenus, dépenses) | ✅ Oui | ✅ Oui | ❌ Non |
| Coordonnées (adresse e-mail) | ✅ Oui | ✅ Oui | ❌ Non |
| Identifiants (UID Firebase) | ✅ Oui | ✅ Oui | ❌ Non |
| Données de localisation | ❌ Non | — | — |
| Données d'utilisation / tracking | ❌ Non | — | — |
| Diagnostics | ❌ Non | — | — |

> **Important** : Dans App Store Connect → App Privacy, sélectionner “Yes, we collect data” et déclarer : données financières (liées à l'utilisateur, usage de l'app), adresse e-mail (liée à l'utilisateur, authentification), identifiants (UID, usage de l'app). Indiquer que ces données NE sont PAS utilisées pour le tracking publicitaire.

---

## 10. KPIs & suivi post-lancement

### Métriques clés à suivre

#### Acquisition

| KPI | Outil | Fréquence | Cible 30 jours |
|---|---|---|---|
| Impressions App Store | App Store Connect Analytics | Hebdomadaire | 5 000+ |
| Taux de conversion page → téléchargement | App Store Connect | Hebdomadaire | ≥ 35 % |
| Téléchargements totaux | App Store Connect | Quotidien | 500 en J+30 |
| Sources de téléchargement (Search vs Browse vs Referral) | App Store Connect → Acquisition | Hebdomadaire | Search > 60 % |

#### ASO (Visibilité organique)

| KPI | Outil | Action |
|---|---|---|
| Rang sur "budget enveloppes" | Xcode Instruments / Sensor Tower (free tier) | Optimiser si rang > 10 |
| Rang sur "gestion budget" | App Store Connect Search | Itérer les mots-clés |
| Impressions par mot-clé | App Store Connect → Analytics | Supprimer les mots-clés < 5 impressions/semaine après 3 semaines |

#### Engagement & Rétention

| KPI | Outil | Cible |
|---|---|---|
| Rétention J+1 | App Store Connect + Instruments | ≥ 40 % |
| Rétention J+7 | App Store Connect | ≥ 20 % |
| Sessions par utilisateur actif / mois | App Store Connect | ≥ 8 sessions/mois |
| Durée moyenne d'une session | App Store Connect | 2–5 minutes |

#### Qualité & Stabilité

| KPI | Outil | Seuil d'alerte |
|---|---|---|
| Taux de crash (crash-free sessions) | Xcode Organizer / Firebase Crashlytics | < 99 % → action immédiate |
| Rapports de crash par version | Xcode Organizer | 0 crash bloquant |
| Taille IPA / Performance mémoire | Instruments (Allocations) | < 50 MB IPA, < 100 MB RAM |

#### Notation & Réputation

| KPI | Outil | Cible 90 jours |
|---|---|---|
| Note moyenne | App Store Connect | ≥ 4,5 ⭐ |
| Nombre d'avis | App Store Connect | ≥ 50 avis |
| Temps de réponse aux avis négatifs | App Store Connect | < 48 heures |

---

### Tableau de bord de suivi (template hebdomadaire)

| Semaine | DL cumulés | Note moy. | Nb avis | Rang "budget enveloppes" | Crash-free % | Action prioritaire |
|---|---|---|---|---|---|---|
| S1 | — | — | — | — | — | Corriger crashs critiques |
| S2 | — | — | — | — | — | Optimiser sous-titre (A/B) |
| S3 | — | — | — | — | — | Publier 1ère vidéo Reels |
| S4 | — | — | — | — | — | Bilan mots-clés, rotation |

---

### Outils recommandés

| Outil | Usage | Prix |
|---|---|---|
| **App Store Connect Analytics** | Impressions, téléchargements, rétention, sources | Gratuit (inclus) |
| **Xcode Organizer** | Crashs, énergie, performances | Gratuit (inclus) |
| **Firebase Crashlytics** | Rapport de crashs détaillé avec stack traces | Gratuit |
| **Sensor Tower** (free tier) | Estimations de marché, rangs concurrents | Gratuit (limité) |
| **AppFollow / AppBot** | Suivi avis en temps réel + alertes | Payant (~20 €/mois) |
| **TestFlight** | Beta testing + feedback avant mise à jour | Gratuit (inclus) |

---

## Récapitulatif des priorités

```
PRIORITÉ 1 (avant soumission)
  → Politique de confidentialité en ligne
  → Suppression de données dans l'app
  → Screenshots iPhone 6.7" et 6.5" prêts
  → App Store Connect configuré

PRIORITÉ 2 (jour J)
  → Métadonnées ASO finalisées (titre + keywords + description)
  → App Preview Video uploadée
  → Product Hunt soumis
  → Posts Reddit planifiés

PRIORITÉ 3 (semaines 1-4)
  → Monitoring quotidien des crashs
  → Première rotation de mots-clés
  → 4 vidéos Reels/TikTok produites
  → 5 influenceurs finance contactés
```

---

*Document généré le 14 mars 2026 — à mettre à jour après chaque mise à jour majeure de l'app.*
