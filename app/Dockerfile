# Esep+ production image (Next.js standalone + node:sqlite).
# Build:  docker compose -f docker-compose.prod.yml build
# The SQLite DB lives in /app/data — mounted as a volume in compose.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
# sqlite CLI — for safe .backup from deploy/backup.sh
RUN apk add --no-cache sqlite
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Non-root: процесс не имеет прав вне /app даже при компрометации.
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
