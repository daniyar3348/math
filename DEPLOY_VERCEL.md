# Деплой Sózdik на Vercel + Turso (бесплатно, без карты)

Полная версия с **постоянной БД** и автодеплоем. Обе платформы — бесплатный
тариф без карты. ~10 минут.

## 1. База данных — Turso (бесплатный SQLite в облаке)
1. Зарегистрируйся: **https://turso.tech** → Sign in with GitHub.
2. Создай базу: **Create Database** (регион — ближе к пользователям, напр. `fra`/`ams`).
3. Возьми два значения:
   - **Database URL** — вида `libsql://sozdik-<org>.turso.io`
   - **Auth token** — Create Token (кнопка в настройках базы)

(Или через их CLI: `turso db create sozdik` → `turso db show sozdik --url` → `turso db tokens create sozdik`.)

Схема и слова создадутся **автоматически** при первом запросе — ничего вручную грузить не нужно.

## 2. Хостинг — Vercel
1. Залей проект на GitHub (уже сделано, репозиторий `daniyar3348/math`).
2. Зайди на **https://vercel.com** → Sign in with GitHub → **Add New… → Project**.
3. Выбери репозиторий → Framework Preset **Next.js** определится сам.
4. **Environment Variables** — добавь два:
   | Ключ | Значение |
   |------|----------|
   | `TURSO_DATABASE_URL` | `libsql://…turso.io` (из шага 1) |
   | `TURSO_AUTH_TOKEN` | токен (из шага 1) |
5. **Deploy**. Через ~2 минуты сайт на `https://<project>.vercel.app`.

Каждый `git push` в `main` → автодеплой.

## Проверка
- Открой сайт → лендинг Sózdik
- `/api/decks` → JSON с наборами
- Пройди пару карточек → зайди на `/progress` → прогресс сохранился (в Turso)

## Свой домен
Vercel → Project → Settings → Domains → добавь домен → пропиши записи у регистратора.
HTTPS выпустится автоматически.

## Почему не файловая БД на Vercel
У Vercel serverless — эфемерная файловая система, `file:sozdik.db` там не переживёт.
Поэтому в проде обязателен Turso (URL+токен в env). Локально же всё работает на файле
без каких-либо переменных.
