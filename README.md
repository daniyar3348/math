---
title: Esep+
emoji: ➕
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 3000
pinned: false
---

# Esep+ — подготовка к БИЛ / НИШ / КТЛ по математике

Full-stack платформа: челленджи с серверным анти-читом, XP и рейтинг,
двуязычие KK/RU, оплата Kaspi (sandbox) + ручная выдача курсов, полная
админ-панель (контент, ученики, платежи, аналитика), TOTP 2FA.

- Приложение и документация: [`app/`](app/) · [README](app/README.md)
- ТЗ: [`docs/TЗ.md`](docs/TЗ.md) · История: [`CHANGELOG.md`](CHANGELOG.md)
- Деплой: [Hugging Face Spaces](app/DEPLOY_HF.md) · [Koyeb](app/DEPLOY_KOYEB.md) ·
  [Render](app/DEPLOY_RENDER.md) · [VPS (Docker+Caddy)](app/DEPLOY_VPS.md)

> Блок метаданных вверху — для Hugging Face Spaces (Docker-хостинг);
> GitHub показывает его как таблицу, это нормально.

**Стек:** Next.js 16 · SQLite (node:sqlite, ноль зависимостей) · Tailwind v4 · Docker.

**Запуск локально:** `cd app && npm install && npm run dev` → http://localhost:3000
(БД создаётся и наполняется автоматически; админ по умолчанию `admin@esep.kz` / `admin123`).
