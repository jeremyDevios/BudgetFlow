# BudgetFlow

Application web minimaliste pour maîtriser son budget mensuel grâce à la méthode des enveloppes. Visualisez vos dépenses et respectez vos objectifs en un clin d'œil.

## 🎯 Fonctionnalités

- **Méthode des enveloppes** : Gérez votre budget par catégories avec des limites mensuelles
- **Onboarding intuitif** : Configuration facile en 3 étapes (salaire, frais fixes, enveloppes)
- **Dashboard visuel** : Visualisez votre "Reste à vivre" et l'état de chaque enveloppe
- **Suivi en temps réel** : Barres de progression et alertes pour chaque catégorie
- **Ajout de dépenses** : Interface simple pour enregistrer vos dépenses
- **Persistance des données** : Utilise Firebase ou localStorage comme fallback

## 🚀 Installation

1. Clonez le repository :
```bash
git clone https://github.com/jeremyDevios/BudgetFlow.git
cd BudgetFlow
```

2. Installez les dépendances :
```bash
npm install
```

3. Configurez Firebase (optionnel) :
   - Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
   - Créez une base de données Firestore
   - Copiez `.env.local.example` vers `.env.local`
   - Remplissez les variables d'environnement avec vos clés Firebase

4. Lancez le serveur de développement :
```bash
npm run dev
```

5. Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur

## 📦 Technologies

- **Next.js 16** - Framework React
- **TypeScript** - Typage statique
- **Tailwind CSS** - Styles utilitaires
- **Firebase** - Base de données et authentification
- **React Hooks** - Gestion d'état moderne

## 🏗️ Structure du projet

```
BudgetFlow/
├── app/                    # Pages Next.js (App Router)
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Page d'accueil
│   └── globals.css        # Styles globaux
├── components/            # Composants React
│   ├── Onboarding.tsx    # Flux d'onboarding
│   └── Dashboard.tsx     # Dashboard principal
├── lib/                   # Bibliothèques et utilitaires
│   ├── firebase.ts       # Configuration Firebase
│   ├── firebaseService.ts # Service de données Firebase
│   └── budgetCalculations.ts # Logique de calcul
└── types/                 # Types TypeScript
    └── index.ts          # Interfaces de données
```

## 💡 Utilisation

1. **Premier lancement** : Suivez le flux d'onboarding pour configurer votre profil
2. **Créer des enveloppes** : Définissez vos catégories de dépenses avec des icônes et budgets
3. **Ajouter des dépenses** : Cliquez sur "+" pour enregistrer une dépense dans une catégorie
4. **Suivre votre budget** : Consultez les barres de progression et le reste à vivre

## 🔒 Note sur Firebase

Si Firebase n'est pas configuré, l'application utilise localStorage comme fallback pour le stockage des données. Les données sont alors stockées localement dans votre navigateur.

## 📝 License

MIT
