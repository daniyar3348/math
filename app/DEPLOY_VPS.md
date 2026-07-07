# Деплой Esep+ на VPS (Docker + Caddy, авто-HTTPS)

Проверено на Ubuntu 22.04/24.04. Нужны: VPS (от 1 vCPU / 1 GB RAM), домен.

## 0. Что понадобится
- VPS с публичным IP (PS Cloud, Hetzner, Timeweb и т.п.)
- Домен (например `esep.kz`) с доступом к DNS

## 1. DNS
Создай A-запись домена на IP сервера:
```
esep.kz  A  <IP_сервера>
```
(и `www` при желании — тогда добавь его в `deploy/Caddyfile` через запятую).

## 2. Установка Docker на сервере
```bash
ssh root@<IP>
curl -fsSL https://get.docker.com | sh
```

## 3. Загрузка проекта
С локальной машины (из папки `learning_platform`):
```bash
rsync -av --exclude node_modules --exclude .next --exclude data \
  app/ root@<IP>:/opt/esep/app/
```
(или `git clone`, если положишь проект в репозиторий).

## 4. Конфигурация
На сервере:
```bash
cd /opt/esep/app
cp .env.example .env
nano .env        # DOMAIN=esep.kz, ADMIN_EMAIL, СИЛЬНЫЙ ADMIN_PASSWORD, SEED_DEMO=0
```
⚠️ `.env` заполняется **до первого запуска** — админ и контент сидятся один раз в пустую БД.

## 5. Запуск
```bash
# Приложение в контейнере работает под пользователем node (uid 1000) —
# папка БД на хосте должна принадлежать ему:
mkdir -p data && chown -R 1000:1000 data

docker compose -f docker-compose.prod.yml up -d --build
```
Первая сборка ~2–5 минут. Caddy сам получит HTTPS-сертификат.
Проверка: открой `https://<домен>` и `https://<домен>/api/health`.

## 6. Бэкапы (обязательно)
```bash
chmod +x deploy/backup.sh
./deploy/backup.sh                 # проверка вручную → backups/esep-*.db.gz
crontab -e                         # добавь строку:
# 30 3 * * * cd /opt/esep/app && ./deploy/backup.sh >> backups/backup.log 2>&1
```
Восстановление: `gunzip -k backups/esep-XXX.db.gz && docker compose -f docker-compose.prod.yml down && cp backups/esep-XXX.db data/esep.db && docker compose -f docker-compose.prod.yml up -d`

## 7. Обновление версии
```bash
cd /opt/esep/app
rsync/git pull …                   # залей новый код
docker compose -f docker-compose.prod.yml up -d --build
```
БД в `./data` не трогается пересборкой.

## 8. Полезное
```bash
docker compose -f docker-compose.prod.yml logs -f app    # логи приложения
docker compose -f docker-compose.prod.yml logs -f caddy  # логи HTTPS
docker compose -f docker-compose.prod.yml ps             # статус
```

## Чек-лист безопасности перед запуском
- [ ] `ADMIN_PASSWORD` в `.env` — сильный (не `admin123`!)
- [ ] `SEED_DEMO=0`
- [ ] `PAYMENTS_MODE`: пока продаёшь через ручную выдачу — можно `sandbox`,
      но помни: в sandbox кнопка «оплатить» открывает курс без денег.
      Если объявляешь онлайн-оплату — только `live` + вебхук Kaspi.
- [ ] Бэкап-крон включён, восстановление проверено
- [ ] SSH: вход по ключу, `PasswordAuthentication no`
- [ ] Порты: наружу только 22/80/443 (`ufw allow 22,80,443/tcp && ufw enable`)

### Встроенная защита (уже в коде)
- Пароли: scrypt + соль, timing-safe сравнение; сессии httpOnly+secure cookie
- Rate-limit: вход 5/мин, регистрация 5/10 мин, ответы 120/мин (на IP)
- Ответы на вопросы никогда не уходят в браузер; скоринг и цены — только сервер
- Заголовки X-Frame-Options/nosniff/Referrer-Policy; лимит тела запроса 4 MB (Caddy)
- Docker-процесс под непривилегированным пользователем `node`
