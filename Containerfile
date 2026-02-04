# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer TOUTES les dépendances (y compris devDependencies)
RUN npm ci && \
    npm cache clean --force

# Copier le code source
COPY . .

# Build l'application
RUN npm run build:web

# Stage 2: Runtime avec nginx
FROM nginx:alpine

# Copier la configuration nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copier les fichiers buildés
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposer le port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
