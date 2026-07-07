# Changelog

## 2026-07-07 18:20

**Task:** Устранение «принятых рисков» безопасности: анти-чит, 2FA, смена пароля, персистентный лимитер, анти-enumeration

**Changed files:**
- `app/lib/db.ts` — таблицы quiz_attempts/attempt_answers/rate_events; ensureColumn-миграции users.totp_secret/totp_enabled
- `app/app/api/challenges/[id]/start/route.ts` — new: серверная попытка (гости допускаются, user_id null)
- `app/app/api/challenges/[id]/answer/route.ts` — ответы только в рамках попытки: первый ответ на вопрос ОКОНЧАТЕЛЬНЫЙ (повтор возвращает записанный вердикт), тайм-лимит проверяет сервер (grace 10 c), телеметрия — только по зачётному ответу
- `app/app/api/challenges/[id]/submit/route.ts` — счёт ТОЛЬКО из записанных сервером ответов (клиентские данные не принимаются); повторная сдача → attempt_finished; гостевая попытка присваивается вошедшему
- `app/lib/totp.ts` — new: RFC 6238 TOTP на node:crypto (base32, HMAC-SHA1, ±1 окно, timing-safe)
- `app/app/api/me/totp/route.ts` — new: setup/confirm/disable (админы)
- `app/app/api/auth/login/route.ts` — шаг 2FA: totp_required → bad_totp/ok
- `app/app/api/me/password/route.ts` — new: смена своего пароля (проверка текущего, отзыв других сессий)
- `app/lib/ratelimit.ts` — переведён на SQLite (rate_events): переживает рестарты, работает между процессами
- `app/app/api/auth/register/route.ts` — email_taken → нейтральный registration_failed
- `app/lib/admin.ts` — userAction clear_totp (аварийный сброс 2FA)
- `app/app/challenge/[id]/page.tsx` — раннер на start/attemptId; гостевой локальный итог с приглашением войти
- `app/app/login/page.tsx` — поле кода 2FA по totp_required
- `app/app/profile/page.tsx` — блок «Безопасность»: смена пароля (все) + 2FA-карточка (админ)
- `app/app/admin/users/page.tsx` — кнопка «Сбросить 2FA»
- `app/lib/{types,i18n}.tsx` — totpEnabled, новые ключи/коды ошибок

**Verified:**
- TOTP кросс-проверен с независимой Python-реализацией RFC 6238 — коды совпали; полный цикл: setup→confirm→вход без кода (totp_required)→неверный код (bad_totp)→верный (ok)→disable
- Анти-чит: повторный ответ не перезаписывается (правильный «переответ» не засчитан → 0%), двойной submit → attempt_finished, попытка старше лимита → time_over
- Смена пароля: старый пароль перестал работать, новый работает
- UI-квиз на попытках прошёл в браузере; карточка «Безопасность» в профиле рендерится

**Остаточные (без email-сервиса не решаемые):** полное сокрытие занятости email требует подтверждения почты; «забыли пароль» — сбрасывает админ.

---

## 2026-07-07 17:30

**Task:** Аудит безопасности + фиксы

**Changed files:**
- `app/lib/ratelimit.ts` — new: in-memory sliding-window лимитер + clientIp (X-Forwarded-For за Caddy)
- `app/app/api/auth/login/route.ts` — 5/мин на IP+email, 20/мин на IP → 429; капы длины
- `app/app/api/auth/register/route.ts` — 5/10мин на IP; капы: имя≤60, email≤120, пароль≤100, регион≤40, класс 1–11
- `app/app/api/challenges/[id]/answer/route.ts` — 120/мин на IP (анти-флуд answer_events)
- `app/app/api/admin/[resource]/route.ts` — импорт: данные ≤2MB, ≤500 вопросов за раз
- `app/app/api/health/route.ts` — счётчики только админу, публично {ok:true}
- `app/app/api/checkout/confirm/route.ts` — PAYMENTS_MODE=live → 403 (доступ только через вебхук Kaspi)
- `app/next.config.ts` — заголовки X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy
- `app/lib/auth.ts` — GC просроченных сессий при логине
- `app/Dockerfile` — USER node (непривилегированный процесс)
- `app/deploy/Caddyfile` — request_body max_size 4MB
- `app/.gitignore` — /data/ и /backups/ (в БД — хэши паролей)
- `app/.env.example`, `app/DEPLOY_VPS.md` — PAYMENTS_MODE, шаг chown 1000:1000 data, раздел «встроенная защита»
- `app/lib/i18n.tsx` — errRateLimited/errTooLong (KK/RU)

**Notes:** Аудит подтвердил: SQL — только prepared statements (интерполяция лишь whitelisted-имён таблиц), XSS/CSRF закрыты (React-экранирование, sameSite=lax + POST-мутации), IDOR-проверки на платежах/попытках. Всё проверено вживую: 429 после 5 логинов, too_long/too_large, 403 confirm в live-режиме (standalone на :3400), заголовки в ответах, контейнер работает под node и пишет БД.

**Известные принятые риски:** email-enumeration при регистрации; XP-читерство через мгновенную проверку ответов (лечится серверными attempt-сессиями — отложено); лимитер в памяти одного процесса (Redis при масштабировании); нет восстановления пароля (сбрасывает админ) и 2FA.

---

## 2026-07-07 15:00

**Task:** Продакшен-деплой пакет (Docker + Caddy + бэкапы + инструкция)

**Changed files:**
- `app/next.config.ts` — output: "standalone" (слим-образ)
- `app/lib/db.ts` — сид админа из env (ADMIN_EMAIL/ADMIN_PASSWORD), SEED_DEMO=0 отключает демо-учеников
- `app/lib/auth.ts` — secure-cookie в production
- `app/Dockerfile` — multi-stage: deps → build → runner (node:24-alpine + sqlite CLI для бэкапов)
- `app/docker-compose.prod.yml` — app + caddy (80/443, авто-HTTPS), ./data volume
- `app/deploy/Caddyfile` — {$DOMAIN} → reverse_proxy app:3000
- `app/deploy/backup.sh` — sqlite .backup → gzip, ротация 14 шт., строка для cron
- `app/.env.example`, `app/.dockerignore`
- `app/DEPLOY_VPS.md` — пошаговая инструкция (DNS → Docker → rsync → .env → up -d → бэкапы → обновления → чек-лист безопасности)
- `app/README.md` — раздел про деплой

**Notes:** .env заполняется ДО первого запуска (сид одноразовый). БД на хост-volume ./data — переживает пересборки.

---

## 2026-07-07 14:20

**Task:** Доп. функции админки: управление учениками, импорт/экспорт вопросов, аналитика

**Changed files:**
- `app/lib/db.ts` — + таблица answer_events (лог каждого ответа)
- `app/lib/admin.ts` — userAction (роль/пароль/XP/выдача-отзыв курса; guard от само-разжалования; сброс сессий при смене пароля), CSV-парсер (кавычки, автоделимитер ;/,), import/export/validate вопросов, duplicateChallenge, analytics
- `app/app/api/challenges/[id]/answer/route.ts` — логирование в answer_events
- `app/app/api/admin/[resource]{,/[id]}/route.ts` — ветки analytics, questions-export/import, duplicate-challenge, users PUT-actions; users list с enrolled
- `app/app/admin/users/page.tsx` — панель «Управлять»: роль, сброс пароля, XP, ручная выдача/отзыв курсов
- `app/app/admin/challenges/[id]/page.tsx` — ⬇ JSON / ⬇ CSV (BOM для Excel) / ⬆ Импорт (файл или вставка, режим «заменить», отчёт об ошибках построчно)
- `app/app/admin/courses/[id]/page.tsx` — кнопка «📋 Копия» (дубликат челленджа с вопросами)
- `app/app/admin/analytics/page.tsx` — new: SVG-графики (регистрации/попытки/выручка 30 дней), таблица курсов, сложность вопросов с фильтром
- `app/app/admin/layout.tsx` — пункт «Аналитика»

**Notes:**
- Ручная выдача курса = продажи через Kaspi-перевод без API: проверено, платный курс разблокировался у ученика без платежа.
- Импорт: JSON (объект/массив) и CSV (столбцы как в экспорте, разделитель ;) — валидные строки вставляются, ошибки возвращаются с номерами строк.
- Сложность вопроса = AVG(correct) по answer_events; 🔴<40% (сложный/ошибка), 🔵>85% (лёгкий).
- E2E проверено в браузере + sqlite3: grant/unlock, импорт 2 (JSON) + 1 (CSV с 1 ошибкой), дубликат с 5 вопросами, guard cannot_demote_self.

---

## 2026-07-07 13:10

**Task:** Превращение MVP в полноценный full-stack сайт: БД, авторизация, серверный скоринг, админ-панель, бренд Esep+

**Changed files:**
- `app/lib/db.ts` — new: SQLite (node:sqlite), 10 таблиц, автосид из content.ts, scrypt-хэши
- `app/lib/auth.ts` — new: cookie-сессии, guards
- `app/lib/types.ts` — new: клиентские типы + SCHOOLS/REGIONS
- `app/lib/admin.ts` — new: конфиги ресурсов + upsertQuestion (вопрос + варианты)
- `app/lib/api.ts`, `app/lib/session.tsx`, `app/lib/brand.ts` — new: fetch-хелпер, auth-контекст, бренд-конфиг
- `app/lib/content.ts` — теперь чистый seed-модуль (server-only)
- `app/lib/i18n.tsx` — ключи auth/admin/ошибок, terr()
- `app/lib/store.tsx` — удалён (localStorage-состояние заменено БД)
- `app/app/api/**` — 17 роутов: auth, me, courses, challenges(+answer/+submit), leaderboard, attempts, checkout(+confirm), admin/[resource](+id), health
- `app/app/**/page.tsx` — все страницы на API; new: register, admin (обзор/курсы/курс/вопросы/ученики/платежи)
- `app/app/layout.tsx`, `app/components/*` — SessionProvider, логотип Esep+, Spinner
- `app/app/icon.svg` — favicon (градиентный E+)
- `app/README.md` — переписан (архитектура, API, доступы)

**Notes:**
- Вопросы отдаются клиенту БЕЗ правильных ответов; проверка каждого ответа и финальный скоринг+XP — на сервере (защита от подглядывания в DevTools).
- Цена платежа всегда берётся из БД, не от клиента.
- SQLite выбран вместо облачного Supabase: нет ключей аккаунта; весь SQL изолирован в lib/db.ts, миграция на Postgres/Supabase — замена драйвера (schema.sql уже готова).
- E2E проверено в браузере: регистрация, квиз с серверным фидбеком, покупка → enrollment, админ-редактирование вопроса → мгновенно видно у ученика (подтверждено и через sqlite3 CLI).
- Доступ админа: admin@esep.kz / admin123 (сменить в проде).

**Remaining:** боевой Kaspi Pay (нужен договор/ключи), деплой.

---
