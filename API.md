# HTTP API

Все маршруты имеют префикс `/api`. Авторизация — cookie `session`; POST принимает `Content-Type: application/json`. Ответы и ошибки — JSON. Браузер использует тот же origin.

| Метод | Путь               | Доступ | Ответ                                        |
| ----- | ------------------ | ------ | -------------------------------------------- |
| GET   | `/health`          | любой  | `{ "status": "ok" }`, проверяет БД           |
| POST  | `/auth/login`      | любой  | пользователь + Set-Cookie                    |
| GET   | `/auth/me`         | сессия | текущий пользователь                         |
| POST  | `/auth/logout`     | любой  | `{ "ok": true }`, удаляет cookie и сессию    |
| GET   | `/rounds`          | сессия | массив текущих и запланированных раундов     |
| POST  | `/rounds`          | admin  | созданный раунд, HTTP 201                    |
| GET   | `/rounds/:id`      | сессия | раунд, свои очки, победитель после окончания |
| POST  | `/rounds/:id/taps` | сессия | подтверждённые личные и общие очки           |

Тело login: `{ "username": "Иван", "password": "секрет" }`. Остальные POST отправляются с `{}`. Если имя отсутствует в базе, создаётся аккаунт; если присутствует, проверяется пароль.

Пользователь:

```json
{
  "id": "0f180012-87dc-40f6-aea0-8453b640c08c",
  "username": "Иван",
  "role": "survivor"
}
```

Детали раунда (все даты — ISO 8601):

```json
{
  "id": "d2fa6c90-5e4c-4897-94b6-b9e2e2cbd708",
  "createdAt": "2026-10-17T10:00:00.000Z",
  "startsAt": "2026-10-17T10:00:30.000Z",
  "endsAt": "2026-10-17T10:01:30.000Z",
  "totalScore": 40,
  "status": "finished",
  "serverNow": "2026-10-17T10:01:31.000Z",
  "mine": { "taps": 11, "score": 20 },
  "winner": {
    "id": "0f180012-87dc-40f6-aea0-8453b640c08c",
    "username": "Иван",
    "score": 20
  }
}
```

`status`: `scheduled`, `active`, `finished`. `winner` равен `null` до окончания и при отсутствии положительных очков. Пустая личная статистика — `{ "taps": 0, "score": 0 }`. Список возвращает поля раунда без `mine` и `winner`. Создание возвращает поля сохранённого раунда без вычисленных `status` и `serverNow`; клиент переходит к GET деталей.

Успешный тап:

```json
{
  "taps": 11,
  "score": 20,
  "totalScore": 40,
  "serverNow": "2026-10-17T10:01:00.000Z"
}
```

Ошибка:

```json
{ "code": "ROUND_NOT_ACTIVE", "message": "Раунд сейчас не активен" }
```

Основные HTTP-коды: 400 — валидация, 401 — нет сессии/неверный пароль, 403 — нет права создания, 404 — раунд не найден, 409 — раунд неактивен, 415 — POST не в JSON, 500 — внутренняя ошибка без деталей реализации. Ошибки валидации дополнительно содержат массив `issues`.

Пример работы через curl:

```bash
curl -c /tmp/guss.cookies -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your-password"}' \
  http://127.0.0.1:3000/api/auth/login

curl -b /tmp/guss.cookies -H 'Content-Type: application/json' -d '{}' \
  http://127.0.0.1:3000/api/rounds

curl -b /tmp/guss.cookies http://127.0.0.1:3000/api/rounds
```
