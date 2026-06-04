FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Use production env vars for the build (NEXT_PUBLIC_* are inlined at build time)
COPY .env.local.prod .env.production

RUN npm run build

EXPOSE 8095

CMD ["npm", "start"]