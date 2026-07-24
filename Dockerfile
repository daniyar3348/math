# BilimHub — production-образ (используется профилем app в docker-compose.yml)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads /app/.next
USER node
EXPOSE 3000
# Прямые бинарники вместо pnpm: старт контейнера не зависит от corepack/сети.
# Миграции недеструктивны (migrate deploy); сид в production не выполняется.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/next start"]
