# Корневой Dockerfile для сервисов, собирающих из корня репозитория
# (Koyeb, Railway, Cloud Run и т.п.). Логика та же, что в app/Dockerfile,
# но пути с префиксом app/. Для Render используется app/Dockerfile (см. render.yaml).

FROM node:24-alpine AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache sqlite
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Non-root: процесс не имеет прав вне /app даже при компрометации.
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
