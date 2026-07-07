# Деплой Esep+ на Hugging Face Spaces (бесплатно, без карты)

HF Spaces бесплатно запускает Docker-приложения: 2 vCPU / 16 GB RAM,
засыпает только после **48 часов** без посетителей (просыпается при заходе).
Ограничение free-тарифа: **диск эфемерный** — SQLite-база сбрасывается при
пересборке/перезапуске (как у Render/Koyeb free). Постоянное хранилище — платная
опция Spaces, либо смотри VPS/Render-варианты.

Корневые `README.md` (с блоком метаданных `sdk: docker, app_port: 3000`),
`Dockerfile` и `.dockerignore` уже готовы — Space собирается из них как есть.

## Вариант А — всё делает ассистент (нужен только токен)

1. Зарегистрируйся: **https://huggingface.co/join** (бесплатно, карта не нужна).
2. Создай токен: **Settings → Access Tokens → Create new token** → тип **Write**.
3. Передай токен ассистенту — дальше он сам: создаст Space, запушит код,
   поставит секреты (`ADMIN_PASSWORD` и др.), дождётся сборки и проверит живой сайт.
4. После деплоя токен можно отозвать (Settings → Access Tokens → Revoke).

## Вариант Б — вручную через сайт

1. **huggingface.co** → **New Space**: имя `esep`, License `mit`,
   SDK **Docker** → **Blank**, visibility Public → Create.
2. На странице Space → **Files** → **Add file → Upload files**: перетащи всё
   содержимое папки проекта (`Dockerfile`, `.dockerignore`, `README.md`, `app/…`
   без `app/node_modules`, `app/.next`, `app/data`) → Commit.
   (Либо, если умеешь в git: `git push https://<user>:<token>@huggingface.co/spaces/<user>/esep main`.)
3. **Settings → Variables and secrets**:
   - Secret `ADMIN_PASSWORD` = сильный пароль
   - Variables: `ADMIN_EMAIL=admin@esep.kz`, `SEED_DEMO=1`, `PAYMENTS_MODE=sandbox`
4. Space пересоберётся (~5 мин). Сайт: **https://<user>-esep.hf.space**

## Проверка
- `/{}` → лендинг · `/api/health` → `{"ok":true}` · вход админа → «Админ» в шапке

## Обновления
HF Space — это отдельный git-репозиторий. Синхронизация с GitHub при желании
настраивается GitHub Action'ом (push в main → push в Space), либо просто
повторный upload изменённых файлов.
