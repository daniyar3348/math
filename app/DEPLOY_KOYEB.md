# Деплой Esep+ на Koyeb (бесплатно, без карты, ~5 минут)

Koyeb запускает полную версию (сервер + SQLite + админка) из Docker прямо из
GitHub-репозитория. Free-тариф: 1 веб-сервис, без карты. Ограничения free —
как у всех: **БД эфемерна** (сбрасывается при передеплое/перезапуске) и сервис
засыпает при простое. Для постоянной БД см. «Апгрейд» ниже.

## Шаги

1. **https://app.koyeb.com** → Sign up / Sign in **with GitHub**.
2. **Create Web Service** → источник **GitHub** → выбери репозиторий
   **daniyar3348/math** (ветка `main`).
   Если репо не в списке — нажми «Configure GitHub permissions» и дай Koyeb
   доступ к репозиторию.
3. **Builder: Dockerfile** — путь оставить `Dockerfile` (корневой, уже готов).
4. **Instance: Free** · **Region: Frankfurt**.
5. **Exposed port: 3000**. Health check (опционально): HTTP `/api/health`.
6. **Environment variables** — добавь четыре:
   | Ключ | Значение |
   |------|----------|
   | `ADMIN_EMAIL` | `admin@esep.kz` |
   | `ADMIN_PASSWORD` | *сильный пароль — это вход админа* |
   | `SEED_DEMO` | `1` |
   | `PAYMENTS_MODE` | `sandbox` |
7. **Deploy**. Сборка ~4–6 минут.

URL будет вида **https://<имя-сервиса>-<организация>.koyeb.app** — показан в
дашборде сверху. Каждый `git push` в `main` → автодеплой.

## Проверка после деплоя
- Открой URL → лендинг Esep+
- `/api/health` → `{"ok":true}`
- Войди админом (`admin@esep.kz` + твой пароль) → «Админ» в шапке

## Апгрейд до постоянной БД
У Koyeb нет дисков на free. Варианты, когда понадобятся реальные ученики:
1. **VPS + Docker** (рекомендуется): `app/DEPLOY_VPS.md` — полный контроль, ~3–7 тыс ₸/мес.
2. **Render Starter + disk**: `render.yaml` уже готов (см. `app/DEPLOY_RENDER.md`).

## Если что-то пошло не так
- Логи: сервис → вкладка **Runtime logs** (ошибки приложения) / **Build logs** (сборка).
- Пересобрать: кнопка **Redeploy**.
