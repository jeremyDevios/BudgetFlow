# Roadmap: BudgetFlow

> Légende : ✅ Implémenté · 🔄 Partiel · ❌ Non implémenté

---

## Fonctionnalités implémentées

### Authentification & Session
- ✅ **Web + iOS** — Connexion Google (OAuth via Firebase)
- ✅ **Web** — Déconnexion automatique après 30 minutes d'inactivité
- ✅ **Web** — Persistance de session via localStorage
- ✅ **iOS** — Mode hors-ligne avec SwiftData (sync bidirectionnel au retour en ligne)

### Dashboard & Vue principale
- ✅ **Web + iOS** — Solde mensuel disponible, total dépensé, revenu vs. dépenses
- ✅ **Web + iOS** — Grille d'enveloppes avec icônes, couleurs, barres de progression mensuelle
- ✅ **Web + iOS** — Heatmap calendrier (activité journalière : transactions en orange, connexions en jaune)
- ✅ **Web + iOS** — Calcul de streak courant, streak max, progression du mois complet
- ✅ **Web + iOS** — Badges jalons (7 j, 14 j, mois complet) avec anneau SVG animé
- ✅ **Web** — Détection de dépenses exceptionnelles (transaction > 100 % du budget enveloppe)
- ✅ **Web** — Recherche globale dans la navbar (top 6 résultats avec correspondance accent-insensible)

### Gestion des enveloppes (CRUD)
- ✅ **Web + iOS** — Création avec nom, budget, icône (20–30+ options), couleur (10–14 options)
- ✅ **Web + iOS** — Modification inline et suppression
- ✅ **Web + iOS** — Réorganisation par glisser-déposer
- ✅ **Web** — Validation du budget restant disponible avant ajout d'une enveloppe

### Gestion des transactions (CRUD)
- ✅ **Web + iOS** — Ajout avec montant, description, date, enveloppe cible
- ✅ **Web + iOS** — Liste groupée par mois (ordre chronologique décroissant)
- ✅ **Web + iOS** — Recherche par nom, montant ou enveloppe
- ✅ **Web + iOS** — Modification et suppression (recalcul automatique du `spent` d'enveloppe)
- ✅ **Web** — Validation serveur (montant 0,01–1 000 000, description ≤ 255 caractères)
- ✅ **iOS** — Bouton flottant (FAB) avec animation pulse pour saisie rapide

### Graphiques & Visualisations
- ✅ **Web + iOS** — Graphique d'évolution sur 12 mois (courbe de solde résiduel mensuel)
- ✅ **Web + iOS** — Diagramme de flux Sankey (revenus → charges fixes, épargne, enveloppes)
- ✅ **Web + iOS** — Mode clair et mode sombre avec tokens sémantiques Tailwind / DesignSystem.swift

### Prévisions & Intelligence
- ✅ **Web** — Projection à 90 jours par enveloppe (moyenne journalière sur historique 3 mois)
- ✅ **Web** — Score de confiance de prévision (basé sur la profondeur d'historique disponible)
- ✅ **Web** — Alertes de dépassement prévisible par enveloppe
- ✅ **iOS** — Projections portées sur iOS (`SpendingForecastEngine.swift`) — parité complète avec le Web
- ✅ **iOS** — Détection de dépenses exceptionnelles (`SpendingInsightsEngine.swift`)

### Notifications
- ✅ **Web** — Push notifications via Firebase Cloud Messaging (FCM) avec déclenchement serveur quotidien
- ✅ **iOS** — Notifications locales hebdomadaires configurables (jour, heure, message intelligent)

### Paramètres & Profil
- ✅ **Web + iOS** — Configuration du budget global (revenus, charges fixes, épargne)
- ✅ **Web + iOS** — Affichage du profil Google et déconnexion
- ✅ **Web** — Activation/désactivation des notifications push et enregistrement token FCM
- ✅ **iOS** — Indicateur de mode en ligne/hors-ligne et déclenchement manuel de la sync

### Enveloppes Temporaires
- ✅ **Web + iOS** — Enveloppes à durée limitée (`isTemporary` + `activeMonths`) : visibles uniquement pour les mois sélectionnés
- ✅ **Web** — Formulaire de création `TemporaryEnvelopeForm` avec sélection de mois
- ✅ **Web** — Filtrage automatique du dashboard, du Cash Flow Sankey et du total disponible selon le mois courant
- ✅ **iOS** — `Envelope.isActive(in:)` pour le filtrage par mois

### Widgets & Plateformes étendues
- ✅ **iOS** — Widget WidgetKit pour l'écran d'accueil (solde disponible, top enveloppe)
- ✅ **iOS** — Retours haptiques via `HapticsManager.swift`
- ✅ **iOS** — Localisation FR/EN via `Localization.swift`
- ✅ **iOS** — App compagnon Apple Watch avec quick-add relayé vers l'iPhone (`WatchConnectivityManager`)

### Onboarding
- ✅ **Web + iOS** — Flux d'onboarding multi-étapes (configuration budget + création des premières enveloppes)

---

## Phases roadmap

### Phase 1 — Design "Premium Dark" & Bento Layout 🔄
- 🔄 **Tableau de bord Bento Grid** : le champ `tileSize` (`"small"` / `"wide"` / `null`) est présent dans le modèle d'enveloppe et utilisé pour le layout ; présets Bento implémentés (`bentoPreset` dans `UserSettings`)
- ❌ **Glassmorphism** : effets de transparence et bordures subtiles
- ❌ **Nouvelle palette** : dégradés "Ebony & Deep Blue" plus luxueux

### Phase 2 — Saisie "Zéro Friction" 🔄
- 🔄 **iOS** FAB rapide implémenté, mais sans auto-complétion basée sur l'historique
- ✅ **Retour haptique iOS** : `HapticsManager.swift` implémenté — vibrations à la confirmation et en cas d'alerte
- ❌ **Suggestions intelligentes** : proposer le libellé/montant selon l'historique local lors de la frappe
- ❌ **Calculatrice intégrée** : évaluation d'expression dans le champ montant (ex: `10+5`)

### Phase 3 — Intelligence Prédictive ✅
- ✅ **Web** — Projections à 90 jours implémentées
- ✅ **iOS** — Prévisions portées (`SpendingForecastEngine.swift`) — parité algorithmique complète
- ❌ **Alerte de rythme** : avertissement si la cadence de dépense est trop rapide pour le jour du mois

### Phase 4 — Recherche & Analyse Avancée 🔄
- 🔄 Recherche basique implémentée sur Web et iOS
- ❌ **Barre "Spotlight"** : recherche globale unifiée par nom, montant ou date
- ❌ **Filtres multicritères** : ex. toutes les dépenses > 50 €
- ❌ **Statistiques flash** : total cumulé d'une recherche (ex. "Total chez Carrefour : 150 €")

### Phase 5 — Fonctionnalités "Power User" 🔄
- ✅ **Web + iOS** — Réorganisation d'enveloppes par glisser-déposer
- ❌ **Transferts** : déplacer le solde restant d'une enveloppe vers une autre
- ❌ **Mode Anonyme** : floutage rapide des montants pour consultation en public
- ❌ **Export** : génération de rapports PDF/CSV

---

## 5 nouvelles features proposées

### A. Transactions récurrentes ⭐

> 💡 **Note — Features B (Widget iOS) et E (résumé mensuel) réalisées** : le Widget WidgetKit est implémenté dans `BudgetFlowWidgets/`. Les notifications push Web et les rappels locaux iOS sont en production.


Marquer une transaction comme récurrente (mensuelle, hebdomadaire…) pour qu'elle se rejoue automatiquement à la date prévue sans ressaisie. Utile pour les abonnements, le loyer, les remboursements fixes. Simple à modéliser : un champ `recurrence` sur le document transaction et un déclenchement serveur (Web) ou local (iOS, via `UNNotificationCenter`).

### B. Widgets iOS — Solde disponible
Un widget pour l'écran d'accueil iOS (WidgetKit) affichant le solde disponible du mois et la barre de progression de l'enveloppe la plus dépensée. Lecture directe depuis SwiftData, aucune requête réseau nécessaire. Idéal pour la consultation en un coup d'œil sans ouvrir l'app.

### C. Import CSV bancaire
Importation d'un relevé bancaire au format CSV (format générique : date, libellé, montant) pour alimenter les transactions en masse. L'utilisateur mappe les colonnes une seule fois, choisit l'enveloppe cible, puis valide. Évite la ressaisie manuelle lors du démarrage ou d'un changement de mois.

### D. Mode Anonyme (floutage)
Un bouton ou geste rapide (double-tap sur le solde, ou toggle dans la navbar) qui floute tous les montants visibles à l'écran. Utile pour présenter son budget à quelqu'un ou consulter l'app dans les transports. Purement visuel, aucune donnée n'est modifiée.

### E. Résumé mensuel automatique (email ou notification)
À la fin de chaque mois, un résumé personnalisé : enveloppe la plus dépensée, écart par rapport au mois précédent, streak de fidélité. Envoyé par notification push (FCM / iOS local) ou par email via Firebase. Renforce l'engagement sans nécessiter d'action de l'utilisateur.

---

> 💡 **Note**: Utilisez le prompt spécial pour vos agents de développement inclus dans ce fichier.
