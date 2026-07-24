# Деплой

## Вариант A — Docker Compose (одна машина)

```bash
cp .env.docker.example .env.docker     # задать APP_SECRET, пароль БД
docker compose --profile app up -d --build
```

Образ собирается из [Dockerfile](../Dockerfile); при старте контейнер выполняет
`prisma migrate deploy` и поднимает `next start` на `:3000`. Файлы пользователей
живут в volume `uploads`, данные БД — в `pg_data`.

Сид демо-данных в production не выполняется (защита в seed.ts). Первого
администратора создайте вручную:

```bash
docker compose exec app node -e "
const argon2=require('argon2');
(async()=>{ console.log(await argon2.hash(process.argv[1],{type:argon2.argon2id})); })()
" 'ВашПароль'
# полученный хэш → INSERT в User/Membership через psql, либо временно
# запустите сид локально и перенесите дампом только справочники.
```

## Вариант B — без Docker (systemd/PM2 + управляемый PostgreSQL)

```bash
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
NODE_ENV=production pnpm start   # PORT=3000
```

Перед приложением — обратный прокси (Caddy/Nginx) с TLS; cookie уже
`Secure/SameSite`, security-заголовки и CSP выставляет middleware.

## Секреты и окружение

- Все секреты — только через env (`.env` не коммитится; в репозитории —
  `.env.example` без реальных значений).
- `APP_SECRET` — длинная случайная строка; подписывает файловые ссылки и
  webhook мока платежей.
- `SMS_PROVIDER=http` + `SMS_HTTP_URL`/`SMS_HTTP_TOKEN` — подключение боевого
  SMS-шлюза (dev-провайдер в production бросает ошибку).
- `PAYMENT_PROVIDER`: реальный провайдер реализуется классом `PaymentProvider`
  ([lib/payments.ts](../lib/payments.ts)) — интерфейс checkout + идемпотентный
  webhook уже готовы; платёжные ключи в репозиторий не попадают.

## Миграции

- Продакшен: только `pnpm db:deploy` (без интерактива, без потери данных).
- Новая миграция создаётся в разработке `pnpm db:migrate` и коммитится в
  `prisma/migrations/`.

## Бэкапы

```bash
# ежедневный дамп (cron)
docker exec learning_platform-db-1 pg_dump -U bilimhub -Fc bilimhub \
  > /backups/bilimhub_$(date +%F).dump
# восстановление
docker exec -i learning_platform-db-1 pg_restore -U bilimhub -d bilimhub --clean < dump
```

Каталог загрузок (`uploads`) бэкапится файлово (rsync/tar) вместе с дампом БД.

## Health и логи

- `GET /api/healthz` — проверка приложения и БД (для балансировщика/monit).
- Логи — stdout контейнера (`docker compose logs -f app`); ошибки API пишутся
  единым обработчиком, журнал входов и действий — в БД (LoginEvent, AuditLog).
