# Étape 1 : Build de l'application React avec Node.js
FROM node:20-alpine AS build-stage

WORKDIR /app

# Copie des fichiers de dépendances et installation autonome dans le conteneur
COPY package.json package-lock.json ./
RUN npm ci

# Copie du reste du code source et compilation de production Vite
COPY . .
RUN npm run build

# Étape 2 : Serveur Nginx léger pour la production
FROM nginx:alpine AS production-stage

# Copie de la configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie du dossier dist généré par Vite
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
