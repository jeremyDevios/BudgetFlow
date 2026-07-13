FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Use production env vars for the build (NEXT_PUBLIC_* are inlined at build time)
COPY .env.local.prod .env.production

RUN npm run build

EXPOSE 8095

# Override host to 0.0.0.0 inside the container so Docker's port mapping
# can reach the server. The docker-compose binds only to 127.0.0.1 on
# the host, so the service is not exposed to the external network.
CMD ["npx", "next", "start", "-p", "8095", "-H", "0.0.0.0"]