# Устройство микросервиса SIPManager

Дата актуализации: 2026-07-30.

Документ описывает фактическое состояние по локальным исходникам:

- SIPManager: `/home/aslan/SipManager/sipmanager`;
- Kamailio: `/home/aslan/Kamailio/kamailio`;
- документация прототипов: `/home/aslan/Downloads/BMS 1/BMS/Прототипы SIP`.

Если в исходниках нет ответа на поставленный вопрос, это отмечено явно.

---

## Краткий вывод

**SIPManager** - это отдельный Go-микросервис-оркестратор для управления SIP-объектами, подписками на push-уведомления и связью с Kamailio. Он не является SIP-сервером и не обрабатывает SIP-пакеты напрямую.

**Kamailio в этой связке - отдельный самостоятельный серверный процесс/демон**, запущенный отдельным сервисом/контейнером. Это **не подключаемая библиотека**, не Go-модуль и не код, который загружается в память SIPManager.

SIPManager подключается к Kamailio **по сети через HTTP API**:

- `SIPMANAGER_KAMAILIO_HTTP_API_URL=http://kamailio:8080` - HTTP API Kamailio для subscriber/status;
- `SIPMANAGER_SIP_SERVER_ADDR=...:5060` - адрес SIP-сервера, который SIPManager отдает клиентам как точку регистрации SIP UA;
- Kamailio сам принимает SIP на `5060/udp` и `5060/tcp`;
- Kamailio сам вызывает SIPManager по HTTP: `POST /api/v1/sipmanager/calls` при начальном SIP `INVITE`.

---

## Роль компонентов

```text
AxxonNext / AxxonNet UI
    |
    | REST + JWT
    v
SIPManager :9010
    |-- Backend HTTP client: auth / permissions / users
    |-- SIPManager Postgres: panels, accounts, tree, subscriptions, shares
    |-- Push: APNS / FCM
    |
    | HTTP API :8080
    v
Kamailio process/container
    |-- SIP :5060 UDP/TCP
    |-- HTTP API :8080
    |-- JSON-RPC /RPC only from localhost
    |-- Postgres kamailio DB: subscriber, location, acc
    |
    | RTPEngine NG UDP :2223
    v
RTPEngine
```

### SIPManager

Назначение:

- хранит SIP-панели и SIP-аккаунты в своей БД;
- строит дерево SIP-объектов для UI;
- проверяет права пользователя через backend;
- создает и удаляет SIP subscriber в Kamailio;
- проверяет online/offline статус subscriber через Kamailio;
- принимает внутренний webhook входящего звонка от Kamailio;
- отправляет VoIP push в APNS/FCM.

### Kamailio

Назначение:

- SIP registrar/proxy/router;
- принимает `REGISTER`, `INVITE`, `BYE`, `CANCEL`, `ACK` и другие SIP-сообщения;
- хранит SIP-регистрации в своей таблице `location`;
- хранит credentials subscriber в своей таблице `subscriber`;
- делает accounting в `acc`;
- управляет медиарелеем через `rtpengine_manage(...)`;
- вызывает SIPManager по HTTP при входящем начальном `INVITE`.

### RTPEngine

Назначение:

- отдельный медиарелей;
- управляется Kamailio по UDP `10.250.0.3:2223`;
- прокидывает RTP-порты `10000-10100/udp` в текущем compose;
- в текущем конфиге используется профиль классического SIP/RTP, а не полноценный браузерный WebRTC gateway.

---

## Внутренняя структура SIPManager

### Точка входа

Файл: `sipmanager/cmd/main.go`.

Процесс:

1. читает env-конфигурацию через `config.ReadConfig()`;
2. инициализирует logger;
3. создает `service.New(cfg, logger)`;
4. создает HTTP handler через `handlers.GetHandler(...)`;
5. запускает HTTP server на `SIPMANAGER_PORT`, по умолчанию `9010`;
6. на `SIGINT/SIGTERM` делает graceful shutdown.

### Конфигурация

Файл: `sipmanager/config/config.go`.

Ключевые переменные:

| Переменная | Роль |
|---|---|
| `SIPMANAGER_PORT` | HTTP-порт SIPManager, default `9010` |
| `SIPMANAGER_BACKEND_ADDR` | адрес backend для auth/permissions/users |
| `SIPMANAGER_DB_URL` | БД самого SIPManager |
| `SIPMANAGER_SIP_SERVER_ADDR` | SIP-адрес Kamailio, отдаваемый клиентам |
| `SIPMANAGER_KAMAILIO_HTTP_API_URL` | HTTP API Kamailio, например `http://kamailio:8080` |
| `SIPMANAGER_RUN_WITHOUT_SIP_SERVER` | режим с fake Kamailio client |
| `SIPMANAGER_APNS_*` | параметры APNS/VoIP push |
| `SIPMANAGER_FCM_CREDENTIALS_PATH` | credentials FCM |

### Handler layer

Файл: `sipmanager/handlers/handlers.go`.

Используется Gin и сгенерированный OpenAPI boilerplate. Базовый URL:

```text
/api/v1/sipmanager
```

Основные функции handler-слоя:

- JWT-auth middleware через backend;
- извлечение `userID` и `permissions`;
- валидация входных DTO;
- преобразование ошибок в HTTP responses;
- вызов service layer.

### Service layer

Файл: `sipmanager/service/service.go`.

Основная бизнес-логика:

- `CreateSipPanel` / `DeleteSipPanel`;
- `CreateSipAccount` / `DeleteSipAccount`;
- `ListSipNodeTree`, `CreateSipNodeTree`, move/update/delete узлов;
- share/unshare SIP-панелей и SIP-аккаунтов;
- `SubscribeDevice`;
- `InitiateCall` - обработка входящего вызова от Kamailio и отправка push;
- `GetSipPanelStatus` - запрос статуса subscriber в Kamailio.

### Store layer

Файлы:

- `sipmanager/store/store.go`;
- `sipmanager/store/migrations/*.sql`.

Таблицы SIPManager:

- `sip_panels`;
- `sip_accounts`;
- `sip_nodes`;
- `sip_device_subscriptions`;
- `sip_shared_devices`.

Важно: это **БД SIPManager**, не БД Kamailio. Kamailio имеет свою Postgres БД с таблицами `subscriber`, `location`, `acc`.

### Kamailio client

Файл: `sipmanager/service/clients/kamailio.go`.

SIPManager работает с Kamailio через Go `http.Client` с timeout 5 секунд.

Поддержанные методы:

- `SaveSubscriber(domain, username, password)` -> `POST /api/subscriber/create`;
- `DeleteSubscriber(username, domain)` -> `POST /api/subscriber/delete`;
- `GetSubscriberStatus(username, domain)` -> `GET /api/subscriber/status/{username}/{domain}`.

В интерфейсе `KamailioClient` **нет метода реального исходящего SIP-вызова**, `BYE`, transfer, switch channel или DTMF.

### Push service

Файл: `sipmanager/push/push_service.go`.

Назначение:

- iOS: APNS VoIP push (`PushTypeVOIP`, topic из `SIPMANAGER_APNS_TOPIC`);
- Android: FCM high priority data message;
- payload входящего звонка содержит тип `incoming_call`, caller и `call-id`.

### Backend client

Файл: `sipmanager/client/backend_client.go`.

Назначение:

- аутентификация JWT;
- получение пользователей;
- проверка permissions `CanViewSip` / `CanManageSip`.

---

## REST API SIPManager

Base URL:

```text
/api/v1/sipmanager
```

Основные endpoint'ы по OpenAPI:

| Область | Endpoint |
|---|---|
| Служебное | `GET /health`, `GET /heartbeat`, `GET /swagger` |
| Панели | `GET /sip-panels`, `POST /sip-panels`, `GET /sip-panels/{id}`, `DELETE /sip-panels/{id}` |
| Статус панели | `GET /sip-panels/status?sipNumber=...` |
| Аккаунты | `GET /sip-accounts`, `POST /sip-accounts`, `GET /sip-accounts/{id}`, `DELETE /sip-accounts/{id}` |
| Мой SIP-аккаунт | `GET /my-sip-account` |
| Дерево | `GET /trees/sip`, `POST /trees/sip`, `POST /trees/sip/move`, `DELETE/PATCH /trees/sip/{id}` |
| Push subscription | `POST /notifications/subscription` |
| Входящий звонок от Kamailio | `POST /calls` |
| Sharing | `POST /panels/{sipAdminId}/share`, `POST /panels/{sipAdminId}/unshare`, аналогично accounts |
| Integrators | `GET /integrators`, `GET /integrators/search` |
| Shared devices | `GET /shared-devices` |

### WebSocket

В текущем репозитории SIPManager **не найден WebSocket handler**:

- нет endpoint'ов `ws`;
- нет обработки `Upgrade`;
- нет WebSocket-библиотеки;
- OpenAPI описывает REST API, но не WebSocket.

Следовательно, если AxxonNext UI ожидает live-события по WebSocket, в предоставленных исходниках SIPManager такой реализации нет. Сейчас подтвержденный канал UI -> SIPManager - **REST**.

---

## Как UI-команды превращаются в сигнальные действия

### Подтвержденный сценарий: создание SIP-панели

```text
UI
  POST /api/v1/sipmanager/sip-panels
    { "parentNodeId": ... }
SIPManager
  1. проверяет JWT и CanManageSip;
  2. генерирует realm: default.axxoncloud.local или integrator-{id}.axxoncloud.local;
  3. генерирует password;
  4. создает запись в sip_panels;
  5. создает узел в sip_nodes;
  6. вызывает Kamailio HTTP API:
       POST /api/subscriber/create
       { "domain": realm, "username": sipNumber, "password": password }
Kamailio
  7. пишет subscriber credentials в свою таблицу subscriber;
  8. SIP UA панели может зарегистрироваться через REGISTER на :5060.
```

Это не отправка SIP-команды из SIPManager. SIPManager делает provisioning учетной записи, а дальнейшая SIP-сигнализация идет через Kamailio.

### Подтвержденный сценарий: создание SIP-аккаунта оператора/пользователя

```text
UI
  POST /api/v1/sipmanager/sip-accounts
    { "email": "...", "parentNodeId": ... }
SIPManager
  1. проверяет JWT и CanManageSip;
  2. проверяет уникальность email;
  3. генерирует SIP number/password/realm;
  4. сохраняет sip_accounts и sip_nodes;
  5. вызывает Kamailio:
       POST /api/subscriber/create
Kamailio
  6. создает subscriber;
  7. SIP-клиент оператора регистрируется на Kamailio по SIP :5060.
```

### Подтвержденный сценарий: проверка online/offline

```text
UI
  GET /api/v1/sipmanager/sip-panels/status?sipNumber=...
SIPManager
  1. находит панель и realm;
  2. вызывает Kamailio:
       GET /api/subscriber/status/{username}/{domain}
Kamailio
  3. проверяет таблицы subscriber и location;
  4. возвращает exists/registered/contact/userAgent/expiresAt.
SIPManager
  5. возвращает UI boolean online/offline.
```

### Команда "инициировать звонок"

В текущем SIPManager **не найден внешний REST endpoint для инициирования исходящего SIP-вызова из UI**.

Что есть:

- в Kamailio есть stub `POST /api/call/initiate`, который принимает `sip_number` и `caller_number`, логирует запрос и возвращает success;
- в коде SIPManager `KamailioClient` не вызывает этот endpoint;
- комментарий в Kamailio говорит, что логика отправки `INVITE` может быть добавлена позже.

Вывод: на данный момент нет подтвержденной реализации трансформации UI-команды "инициировать звонок" в SIP `INVITE`.

### Команда "завершить звонок"

В текущем SIPManager **не найден endpoint и service-метод**, который отправляет SIP `BYE`, `CANCEL` или RPC-команду завершения диалога в Kamailio.

Вывод: ответа по реализации завершения звонка в предоставленных исходниках нет.

### Команда "переключить канал"

Если под "переключить канал" имеется в виду переключение видеоканала/камеры/потока в AxxonNext, то в текущем SIPManager **не найдено такой бизнес-логики**.

SIPManager не содержит:

- привязки SIP-вызова к RTSP/архиву AxxonNext;
- управления видеоканалами;
- WebSocket-событий по переключению канала;
- SIP REFER/re-INVITE/UPDATE логики для смены media target.

Вывод: ответа по реализации переключения канала в предоставленных исходниках нет.

---

## Протокол взаимодействия SIPManager и Kamailio

### Направление SIPManager -> Kamailio

Используется **HTTP API Kamailio на порту 8080**.

Подтвержденные вызовы из SIPManager:

```http
POST http://kamailio:8080/api/subscriber/create
Content-Type: application/json

{
  "domain": "integrator-123.axxoncloud.local",
  "username": "1000001",
  "password": "generated"
}
```

```http
POST http://kamailio:8080/api/subscriber/delete
Content-Type: application/json

{
  "domain": "integrator-123.axxoncloud.local",
  "username": "1000001"
}
```

```http
GET http://kamailio:8080/api/subscriber/status/1000001/integrator-123.axxoncloud.local
Accept: application/json
```

Ответ status:

```json
{
  "username": "1000001",
  "domain": "integrator-123.axxoncloud.local",
  "realm": "integrator-123.axxoncloud.local",
  "exists": true,
  "registered": true,
  "contact": "sip:...",
  "userAgent": "...",
  "expiresAt": "..."
}
```

### Направление Kamailio -> SIPManager

При начальном SIP `INVITE` Kamailio выполняет:

```text
route(CALL_SIPMANAGER_API)
```

И отправляет асинхронный HTTP-запрос:

```http
POST {sipmanager.api_url}/calls
Content-Type: application/json

{
  "sipNumber": 1000001,
  "callerNumber": "1000002",
  "callId": "SIP Call-ID"
}
```

SIPManager:

1. ищет SIP-аккаунт по `sipNumber`;
2. получает email аккаунта;
3. ищет push-подписки по email;
4. отправляет APNS/FCM push на все подписанные устройства.

Важно: Kamailio использует `http_async_query(...)`, то есть HTTP callback в SIPManager выполняется асинхронно относительно обработки SIP-маршрута.

### JSON-RPC

В `kamailio.cfg` включен модуль `jsonrpcs.so`, а `/RPC` обрабатывается через `jsonrpc_dispatch()`.

Но есть существенное ограничение:

```text
JSON-RPC only from localhost
if(src_ip!=127.0.0.1) -> 403
```

В коде SIPManager **не найден клиент JSON-RPC Kamailio**. Следовательно, текущая интеграция SIPManager -> Kamailio идет не через JSON-RPC, а через HTTP API `/api/...` на `8080`.

### MI commands / IPC / sockets

В текущем коде SIPManager **не найдено использование MI commands**, FIFO, Unix socket, IPC или прямого control socket Kamailio.

Подтвержденный механизм подключения:

- сетевой HTTP от SIPManager к Kamailio `:8080`;
- сетевой HTTP от Kamailio к SIPManager `:9010`;
- SIP-клиенты подключаются к Kamailio по SIP `:5060`;
- Kamailio подключается к RTPEngine по UDP control socket `:2223`.

---

## Kamailio: библиотека или отдельный процесс

**Строгий ответ:** Kamailio - это **отдельный серверный процесс/демон**, а не подключаемая библиотека SIPManager.

Подтверждения по исходникам:

- Kamailio имеет отдельный репозиторий `/home/aslan/Kamailio/kamailio`;
- запускается отдельным контейнером `kamailio` в `docker-compose.yml`;
- внутри контейнера выполняется `kamailio -DD -E -m 64 -M 8`;
- публикует порты:
  - `5060/udp`;
  - `5060/tcp`;
  - `8080/tcp`;
- SIPManager имеет собственный Dockerfile, собственный binary `/usr/local/bin/sipmanager` и порт `9010`;
- SIPManager не импортирует Kamailio как библиотеку;
- SIPManager общается с Kamailio через `net/http`.

Практическая модель:

```text
SIPManager process/container       Kamailio process/container
----------------------------       --------------------------
Go HTTP server :9010        <----  HTTP async callback /calls
Go HTTP client              ---->  HTTP API :8080
No SIP stack inside process        SIP stack :5060
```

---

## Сценарий: входящий звонок с камеры/домофонной панели

Термин "камера" в исходниках SIPManager напрямую не моделируется. Подтвержденный объект - **SIP panel**. Если камера является частью домофонной панели, сценарий выглядит так:

```text
1. SIP-панель зарегистрирована в Kamailio:
   REGISTER sip:{realm} -> Kamailio :5060

2. Оператор/жилец также зарегистрирован как SIP account
   или имеет мобильное приложение с push subscription.

3. Панель инициирует звонок:
   INVITE sip:{sipNumber}@{realm} -> Kamailio :5060

4. Kamailio:
   - проходит auth/routing/NAT;
   - включает accounting;
   - вызывает route(CALL_SIPMANAGER_API);
   - отправляет async HTTP POST в SIPManager /calls:
     { "sipNumber": ..., "callerNumber": ..., "callId": ... }

5. SIPManager:
   - находит SipAccount по sipNumber;
   - по email находит device subscriptions;
   - отправляет APNS VoIP push или FCM push.

6. Мобильный клиент просыпается по push:
   - показывает входящий вызов;
   - регистрируется/поддерживает регистрацию в Kamailio;
   - отвечает на SIP INVITE через Kamailio.

7. Kamailio:
   - маршрутизирует SIP-диалог;
   - управляет RTP через RTPEngine.
```

Что не подтверждено исходниками:

- привязка вызова к конкретному AxxonNext camera channel;
- получение RTSP/архива камеры через SIPManager;
- WebRTC-вызов в браузерном UI;
- команда открытия двери в SIPManager.

---

## Сценарий: исходящий звонок оператора

Подтвержденная рабочая часть:

```text
1. Администратор создает SIP account оператора через UI.
2. SIPManager создает account в своей БД и subscriber в Kamailio.
3. SIP-клиент оператора получает sipNumber/password/realm/sipServerAddr.
4. SIP-клиент оператора регистрируется в Kamailio по REGISTER.
5. Операторский SIP UA может отправить INVITE на SIP-панель напрямую через Kamailio.
6. Kamailio маршрутизирует INVITE к панели, если панель зарегистрирована.
```

Неподтвержденная часть:

- в SIPManager нет REST-команды "позвонить с оператора на панель";
- в SIPManager нет логики генерации SIP `INVITE`;
- в Kamailio есть только заготовка `POST /api/call/initiate`, которая не инициирует реальный SIP-вызов;
- нет реализации переключения канала или завершения вызова через SIPManager.

Вывод: на данный момент исходящий звонок оператора подтвержден как функция **SIP-клиента оператора через Kamailio**, но не как оркестрируемая команда SIPManager.

---

## Как это оркестрируется сейчас в production / на стендах

### Что подтверждено локальными файлами

SIPManager:

- собирается как отдельный Docker image;
- в Makefile используется имя `ac/sipmanager`;
- CI-переменные указывают на Bamboo (`bamboo_buildNumber`, `bamboo_planKey`, `bamboo_planRepository_revision`);
- контейнер exposes `9010`;
- healthcheck ходит в `/health`;
- runtime-конфигурация задается env-переменными `SIPMANAGER_*`.

Kamailio-контур:

- описан отдельным `docker-compose.yml`;
- сервисы:
  - `db` - Postgres 11;
  - `rtpengine` - RTP relay;
  - `kamailio` - SIP proxy/registrar + HTTP API;
  - `asterisk` - закомментирован и не используется;
- сеть `sip` с subnet `10.250.0.0/24`;
- Kamailio публикует `5060/udp`, `5060/tcp`, `8080/tcp`;
- RTPEngine публикует `2223/udp` и RTP range `10000-10100/udp`.

Документ `04 - Состояние интеграции облака и sipmanager.md` фиксирует, что рабочий стенд `sip-test1.axxoncloud.com` был собран как:

```text
Axxon cloud UI -> sipmanager -> Kamailio HTTP API -> Kamailio SIP/RTP -> APNS/FCM -> mobile SIP clients
```

### Что не найдено

В предоставленных локальных исходниках **не найден production-манифест**, который окончательно отвечает, чем именно это развернуто в production:

- нет Helm chart;
- нет Kubernetes Deployment/Service;
- нет Nomad job;
- нет systemd unit;
- нет полного production docker-compose с SIPManager + Kamailio в одном файле;
- нет актуального inventory/terraform/ansible.

Поэтому строгий ответ: **как именно все это оркестрируется в production, по предоставленным файлам полностью установить нельзя**. Подтверждено только, что компоненты контейнеризованы, SIPManager собирается в `ac/sipmanager`, Kamailio-контур имеет compose для `db + rtpengine + kamailio`, а на стенде интеграция работала через сетевые HTTP/SIP-вызовы.

---

## Оценка архитектуры

### Плюсы

- **Развязка UI и телефонии.** UI работает с REST API SIPManager и не знает деталей SIP routing, REGISTER, INVITE, location table.
- **Kamailio используется по назначению.** Он остается SIP registrar/proxy, а не превращается в бизнес-сервис.
- **Масштабируемость signaling layer.** Kamailio хорошо подходит для большого количества регистраций и маршрутизации SIP.
- **Гибкость маршрутизации.** SIP-routing, NAT handling и RTP relay сосредоточены в Kamailio/RTPEngine.
- **Разделение данных.** SIPManager хранит бизнес-модель, Kamailio хранит SIP subscriber/location/accounting.
- **Push-интеграция вынесена из SIP-сервера.** Kamailio только сигнализирует о `INVITE`, а APNS/FCM делает SIPManager.
- **Возможность offline/mobile сценариев.** Входящий звонок может разбудить мобильное приложение через VoIP push.

### Минусы

- **Синхронный provisioning между двумя БД.** SIPManager сначала пишет свою БД, затем вызывает Kamailio HTTP API. При ошибке возможна рассинхронизация.
- **Нет outbox/retry механизма.** Не найден durable queue для повторной доставки команд в Kamailio.
- **Kamailio HTTP API реализован в `kamailio.cfg`.** JSON разбирается regex-ами, SQL собирается строками; это усложняет сопровождение и повышает риск ошибок.
- **Единая точка отказа для SIP.** Один Kamailio-контур без найденного HA-манифеста - риск простоя регистраций и звонков.
- **Сложность отладки E2E.** Один звонок проходит UI, SIPManager, backend, Kamailio, Postgres Kamailio, RTPEngine, APNS/FCM и SIP UA.
- **Нет подтвержденной WebSocket/event модели.** UI не получает live-события звонка из SIPManager по найденному коду.
- **Нет транзакционной целостности между SIPManager и Kamailio.** Локальная SQL-транзакция SIPManager не покрывает внешние HTTP-вызовы.
- **Ограниченный call control.** В SIPManager нет подтвержденных операций исходящего INVITE, BYE/CANCEL, transfer, switch channel.
- **Production-оркестрация не полностью документирована в доступных файлах.** Нельзя подтвердить HA, autoscaling, backup, rolling update и сетевые политики.

### Рекомендации

- **Ввести outbox pattern** в SIPManager для команд `create/delete subscriber`, чтобы запись в БД и постановка команды были атомарны.
- **Добавить брокер сообщений** Redis Streams, NATS JetStream или Kafka для асинхронной доставки команд в SIP-layer и повторов.
- **Вынести Kamailio HTTP API из regex-heavy cfg** в отдельный тонкий management service или заменить на проверенный control API с нормальным JSON parser и параметризованным SQL.
- **Добавить идемпотентность** для create/delete subscriber: одинаковая команда должна безопасно повторяться.
- **Добавить reconciliation job**: периодически сравнивать `sip_panels/sip_accounts` SIPManager с `subscriber` Kamailio и чинить расхождения.
- **Документировать production deployment**: реальные манифесты, порты, DNS/service discovery, secrets, backup, health checks, rolling update.
- **Продумать HA Kamailio/RTPEngine**: несколько Kamailio nodes, shared/replicated usrloc или DB-backed registration, LB для SIP/HTTP API, мониторинг `REGISTER`, `INVITE`, RTP loss.
- **Добавить observability по call-id**: единый correlation ID от SIP `Call-ID` через Kamailio logs, SIPManager logs, push logs и UI events.
- **Если нужен browser/operator call control**, явно спроектировать API: `POST /calls/outgoing`, `POST /calls/{id}/hangup`, transfer/channel switch, и определить, кто является SIP UA или B2BUA.
- **Если нужен AxxonNext channel switch**, не смешивать это с SIP без необходимости: сделать отдельную интеграцию с VMS/camera API и связать ее с SIP `callId` на уровне бизнес-событий.

---

## Итог

Текущий SIPManager закрывает provisioning SIP-учеток, дерево SIP-объектов, push-подписки и webhook входящего звонка. Kamailio является отдельным SIP-сервером/демоном и подключается к SIPManager сетевыми HTTP-вызовами, а не как библиотека.

В текущих исходниках не подтверждены WebSocket, полноценный исходящий call control из UI, завершение звонка через SIPManager, переключение канала и production-оркестрация уровня Kubernetes/Helm/Nomad/systemd.
