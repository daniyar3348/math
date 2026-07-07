# Esep+ — подготовка к БИЛ / НИШ / КТЛ по математике

Полноценная full-stack платформа (аналог Zerdeli): курсы, челленджи с таймером,
XP и рейтинг, покупки курсов через Kaspi Pay (sandbox) и **админ-панель** для
управления всем контентом. Всё — включая вопросы челленджей — хранится в БД
и отдаётся через API; проверка ответов и начисление XP происходят **на сервере**.

Полное ТЗ: [`../docs/TЗ.md`](../docs/TЗ.md).

## Запуск

```bash
npm install
npm run dev      # http://localhost:3000
```

БД (SQLite, файл `data/esep.db`) создаётся и наполняется автоматически при первом запросе.

**Доступы по умолчанию:**
| Роль | Email | Пароль |
|------|-------|--------|
| Админ | `admin@esep.kz` | `admin123` |
| Демо-ученики | `aisulu@demo.kz` … | `demo123` |

⚠️ Смени пароль админа перед продакшеном (сейчас он задаётся в `lib/db.ts` при первом сиде).

## Архитектура

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **SQLite** через встроенный `node:sqlite` — ноль зависимостей; схема и сид в `lib/db.ts`
- **Auth**: scrypt-хэши + серверные сессии, httpOnly cookie (`lib/auth.ts`)
- **Локализация KK/RU**: все тексты контента хранятся в БД в двух языках
- **Бренд** меняется в одном файле: `lib/brand.ts`

### Поток данных
```
Браузер (client components)
   → fetch /api/* (route handlers)
      → lib/db.ts (SQLite)
```
Вопросы уходят клиенту **без правильных ответов**; каждый ответ проверяется
через `POST /api/challenges/[id]/answer`, финальный счёт и XP считает
`POST /api/challenges/[id]/submit`.

### API (основное)
| Метод | Путь | Что делает |
|---|---|---|
| POST | `/api/auth/register` / `login` / `logout` | Аутентификация (cookie-сессии) |
| GET | `/api/me` | Профиль + купленные курсы + лучшие результаты |
| GET | `/api/courses`, `/api/courses/[id]` | Каталог; уроки платных курсов гейтятся сервером |
| GET | `/api/challenges`, `/api/challenges/[id]` | Челленджи; вопросы без ответов |
| POST | `/api/challenges/[id]/answer` | Мгновенная проверка одного ответа |
| POST | `/api/challenges/[id]/submit` | Серверный скоринг + XP |
| GET | `/api/leaderboard` | Рейтинг из БД |
| POST | `/api/checkout` → `/api/checkout/confirm` | Оплата (Kaspi sandbox) → enrollment |
| CRUD | `/api/admin/[resource]` | Админ: courses/lessons/challenges/questions/users/payments/summary |

### Админ-панель (`/admin`)
- Обзор: ученики, курсы, вопросы, попытки, оплаты, выручка
- Курсы: создание/редактирование (двуязычные поля, цена, публикация)
- Уроки и челленджи внутри курса
- **Вопросы**: двуязычный текст, 2–6 вариантов, отметка правильного, разбор
- Ученики и платежи: таблицы

## Деплой в один клик — Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/daniyar3348/math)

Blueprint в [`render.yaml`](../render.yaml): полная версия (сервер+БД+админка),
автодеплой на каждый пуш. Пошагово и про тарифы/постоянный диск —
**[DEPLOY_RENDER.md](DEPLOY_RENDER.md)**.

## Продакшен-деплой (свой VPS)

Готовый пакет: `Dockerfile` (standalone-образ) + `docker-compose.prod.yml` (app + Caddy
с авто-HTTPS) + `deploy/backup.sh` (ночные бэкапы SQLite) — пошагово в **[DEPLOY_VPS.md](DEPLOY_VPS.md)**.
Перед первым запуском заполни `.env` (см. `.env.example`): `DOMAIN`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `SEED_DEMO=0`.

## Kaspi Pay — переход на боевой режим
Сейчас: `/api/checkout` создаёт платёж в БД → клиент «оплачивает» →
`/api/checkout/confirm` помечает `paid` и выдаёт доступ.
Для продакшена: в `confirm` заменить клиентский вызов на **вебхук Kaspi**
(проверка подписи → `paid` → enrollment). Сумма всегда берётся из БД.

## Миграция на Supabase/Postgres (опционально)
Весь SQL изолирован в `lib/db.ts` (+ `lib/admin.ts`). Схема совместима с
`supabase/schema.sql`. Замена драйвера на Postgres-клиент не трогает ни API,
ни фронт. Для пилота SQLite достаточно (файл + бэкапы).
