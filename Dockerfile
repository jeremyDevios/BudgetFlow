# On utilise une version légère de Node.js
FROM node:20-slim

# On définit le dossier de travail dans le conteneur
WORKDIR /app

# On copie les fichiers de dépendances
COPY package*.json ./

# On installe les dépendances
RUN npm install

# On copie le reste du code
COPY . .

# On expose le port que ton app utilise (généralement 3000)
EXPOSE 3000

# Commande pour lancer l'application
CMD ["npm", "start"]