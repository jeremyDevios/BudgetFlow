# 📈 Algorithme de prévision des dépenses (BudgetFlow)

## 🧭 1) Vue d'ensemble

L’objectif de l’algorithme est d’estimer, de manière simple et lisible, la dépense de fin de mois :

- **au niveau global** (toutes enveloppes confondues),
- **au niveau de chaque enveloppe**.

La philosophie est volontairement **conservative** : quand des données historiques manquent, BudgetFlow évite les projections optimistes et applique une **dégradation progressive** (graceful degradation), jusqu’à masquer l’estimation si elle n’est pas fiable.

---

## 🗂️ 2) Sources de données

### Collections Firestore utilisées

- `transactions/{id}`
  - `amount`
  - `envelopeId`
  - `date` (chaîne ISO)
- `envelopes/{id}`
  - `budget`
  - `name`
- `settings/general`
  - `monthlyIncome`
  - `fixedCosts`
  - `monthlySavings`

### Fenêtre d’historique

- Requête sur les **3 derniers mois complets** (mois courant exclu),
- via un filtre de plage sur `date` :
  - `date >= rangeStart`
  - `date <= rangeEnd`

---

## 🧮 3) Algorithme

```txt
budget_mensuel_disponible = revenu_mensuel - charges_fixes - épargne_mensuelle

# Pour chaque enveloppe e, sur les N derniers mois:
dépense_mois_m[e] = Σ transactions de l'enveloppe e dans le mois m
moyenne_mensuelle[e] = Σ(dépense_mois_m[e] pour m in 1..N) / N

# Projection
taux_journalier[e] = moyenne_mensuelle[e] / nb_jours_mois_courant
jours_restants = nb_jours_mois_courant - jour_actuel + 1
dépense_projetée[e] = dépense_actuelle[e] + (taux_journalier[e] × jours_restants)

# Global
total_projeté = Σ dépense_projetée[e]
reste_estimé = budget_mensuel_disponible - total_projeté
dépassement_estimé = max(0, total_projeté - budget_mensuel_disponible)

# Score de confiance par enveloppe
score_confiance[e] = min(mois_avec_données[e] / N, 1.0)
```

> `N = 3` par défaut dans BudgetFlow.

---

## ✅ 4) Exemple concret

### Données d’entrée

- Paramètres:
  - Revenu mensuel: **3000€**
  - Charges fixes: **1500€**
  - Épargne mensuelle: **300€**
  - **Budget mensuel disponible = 1200€**
- Enveloppes:
  - **Courses** (budget 300€)
  - **Sorties** (budget 150€)
  - **Transport** (budget 100€)
- Historique (3 derniers mois):
  - Courses: **280€, 310€, 295€** → moyenne **295€**
  - Sorties: **120€, 0€, 180€** → moyenne **100€** (approche conservative: division par 3, pas par 2)
  - Transport: **0€, 0€, 0€** → pas d’historique exploitable, on fige à la dépense actuelle
- Date actuelle: **jour 10** d’un mois de **30 jours**
  - Jours restants: **21**
- Dépenses actuelles:
  - Courses: **95€**
  - Sorties: **45€**
  - Transport: **30€**

### Projection par enveloppe

- Courses: `95 + (295/30 × 21) = 95 + 206.5 = 301.5€`
- Sorties: `45 + (100/30 × 21) = 45 + 70 = 115€`
- Transport: `30€` (pas de projection historique)

### Résultat global

- Total projeté: `301.5 + 115 + 30 = 446.5€`
- Reste estimé: `1200 - 446.5 = 753.5€`
- Dépassement estimé: `max(0, 446.5 - 1200) = 0€`

➡️ **Pas de dépassement prévu**.

### Cas avec dépassement (exemple)

Si le total projeté monte à **1325€** pour le même budget disponible (**1200€**) :

- Reste estimé: `1200 - 1325 = -125€`
- Dépassement estimé: `max(0, 1325 - 1200) = 125€`

➡️ **Dépassement prévu: 125€**.

---

## ⚠️ 5) Cas limites

| Situation | Comportement |
|-----------|-------------|
| Premier mois d'utilisation | Pas de projection, message « données insuffisantes » |
| Mois avec 0 transactions | Contribue 0 à la moyenne (approche conservative) |
| Dernier jour du mois | Projection = dépense actuelle (0 jour à extrapoler, borne minimale à 1 si nécessaire côté calcul) |
| Budget enveloppe = 0€ | Pas de calcul de dépassement |
| Consultation d'un mois passé | Estimation désactivée |
| Pas de connexion | Estimation masquée silencieusement |

---

## 🎯 6) Score de confiance

| Score | Signification |
|-------|--------------|
| 0.0 | Aucune donnée historique |
| 0.33 | 1 mois d'historique |
| 0.67 | 2 mois d'historique |
| 1.0 | 3 mois d'historique (confiance maximale) |

---

## 🛠️ 7) Implémentation technique (référence rapide)

- **Logique cœur**: `src/lib/forecasting.ts`
  - Fonctions pures, sans effets de bord.
- **Hook React**: `src/hooks/useSpendingForecast.ts`
  - Récupération Firestore + gestion d’état UI.
- **Requête Firestore**:
  - `where("date", ">=", rangeStart)` + `where("date", "<=", rangeEnd)`
  - Pas d’index composite requis pour ce cas.
- **Affichage**:
  - Tuile principale du Dashboard (global),
  - Vue détail enveloppe (par enveloppe).
