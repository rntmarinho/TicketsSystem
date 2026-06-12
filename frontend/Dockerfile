# ── Estágio 1: Build ──────────────────────────────────────────────────────────
# Usa Node para compilar o React/Vite e gerar os arquivos estáticos
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifests de dependências primeiro (otimiza cache)
COPY package.json package-lock.json ./

# Instala dependências Node
RUN npm ci

# Copia o restante do código
COPY . .

# Gera o build de produção (pasta /app/dist)
RUN npm run build


# ── Estágio 2: Serve ──────────────────────────────────────────────────────────
# Usa Nginx (leve) para servir os arquivos estáticos gerados
FROM nginx:alpine

# Copia os arquivos compilados para o diretório padrão do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração do Nginx para funcionar com React Router (SPA)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
