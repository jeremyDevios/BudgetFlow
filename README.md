# BudgetFlow

Application web minimaliste pour maîtriser son budget mensuel grâce à la méthode des enveloppes. Visualisez vos dépenses et respectez vos objectifs en un clin d'œil.

## 🎯 Fonctionnalités

- **Méthode des enveloppes** : Créez des catégories de budget avec des limites mensuelles
- **Onboarding simplifié** : Configuration en 3 étapes (salaire, frais fixes, enveloppes)
- **Dashboard intuitif** : Vue d'ensemble de votre budget du mois
- **Suivi visuel** : Barres de progression et pourcentages pour chaque catégorie
- **Ajout de dépenses** : Interface simple pour enregistrer vos dépenses
- **Persistance locale** : Vos données sont sauvegardées dans le navigateur
- **Support Firebase** : Prêt pour la synchronisation cloud (configuration requise)

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+ et npm

### Installation

```bash
# Cloner le repository
git clone https://github.com/jeremyDevios/BudgetFlow.git
cd BudgetFlow

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### Configuration Firebase (optionnel)

Pour activer la synchronisation cloud avec Firebase :

1. Créez un projet Firebase sur [console.firebase.google.com](https://console.firebase.google.com)
2. Copiez `.env.example` vers `.env.local`
3. Remplissez les variables d'environnement avec vos identifiants Firebase

```bash
cp .env.example .env.local
# Éditez .env.local avec vos identifiants
```

## 📦 Scripts disponibles

```bash
npm run dev      # Lancer le serveur de développement
npm run build    # Créer une version de production
npm start        # Lancer la version de production
```

## 🏗️ Technologies utilisées

- **Next.js 16** - Framework React avec App Router
- **TypeScript** - Typage statique
- **Tailwind CSS** - Styles utilitaires
- **Firebase** - Base de données et authentification (optionnel)

## 📱 Utilisation

### 1. Onboarding

Lors de votre première visite :
- **Étape 1** : Entrez votre salaire mensuel net
- **Étape 2** : Indiquez vos frais fixes (loyer, assurances, etc.)
- **Étape 3** : Répartissez votre budget disponible dans différentes enveloppes

### 2. Dashboard

Une fois configuré, le dashboard affiche :
- **Budget total** : La somme de toutes vos enveloppes
- **Dépensé** : Le total de vos dépenses du mois
- **Restant** : Ce qu'il vous reste à dépenser
- **Grille de catégories** : Chaque enveloppe avec son icône, sa progression et son budget

### 3. Ajout de dépenses

Cliquez sur le bouton **+** en bas à droite pour :
- Sélectionner une catégorie
- Entrer le montant dépensé
- Ajouter une description (optionnel)

## 📄 Licence

ISC
