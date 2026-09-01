# Состояние интеграции облака и sipmanager

Краткий вердикт: интеграция «облако ↔ SIP» реализована микросервисом **sipmanager** + Kamailio HTTP API + раздел **SIP** в AxxonNet UI. На [sip-test1.axxoncloud.com](https://sip-test1.axxoncloud.com/) клиенты iOS/Android проверяли полный путь: настройка в UI → аккаунты → регистрация → вызов foreground и background через push. Отдельного «SIP-коннектора» / WebRTC в этом контуре нет.

---

## Исходники

| Что | Репозиторий | Ветка | Локальный путь |
|---|---|---|---|
| **Полный контур с облаком** | [axxoncloudgo](ssh://git@src.axxonsoft.dev/proj/axxoncloudgo.git) | `feature/sipmanager_microservice` | `/Users/avgx/soft/itv/cloud/axxoncloudgo/sipmanager` |
| Compose / образ | тот же axxoncloudgo | | `tools/compose/…` (`ac/sipmanager`) |
| **Отдельный реп sipmanager** | [sipmanager](ssh://git@src.axxonsoft.dev/new/sipmanager.git) | `master` | `/Users/avgx/soft/itv/cloud/sipmanager` |
| Cloud UI (раздел SIP) | [axxoncloud-ui](ssh://git@src.axxonsoft.dev/proj/axxoncloud-ui.git) | `master` | `…/app/components/Sip`, `…/app/containers/Sip`, `…/app/api/sipmanager.ts` |
| SIP-сервер | [kamailio](ssh://git@src.axxonsoft.dev/new/kamailio.git) | `main` | `/Users/avgx/soft/itv/cloud/kamailio` |
| Описание API / потоков | Confluence [SIP](https://internal.axxonsoft.dev/pages/viewpage.action?pageId=146424130) | | экспорт `/Users/avgx/soft/itv/cloud/confluence-sip` |

Мобильные клиенты теста: [apple-v5](ssh://git@src.axxonsoft.dev/mc/apple-v5.git), [android-intercom](ssh://git@src.axxonsoft.dev/mc/android-intercom.git), [domofon](ssh://git@src.axxonsoft.dev/~ivan.fedeikin/domofon.git).

---

## Два артефакта sipmanager — какой смотреть

### 1. axxoncloudgo / `sipmanager` (основной)

Ветка **`feature/sipmanager_microservice`**. Микросервис живёт рядом с backend / vmsmanager / прочим облаком. Это то, что обеспечивает **полный рабочий функционал** на стендах вроде sip-test1: auth через backend, права, БД, push, запись в Kamailio.

Ключевые пакеты:

- `sipmanager/handlers` — HTTP API `/api/v1/sipmanager/...`
- `sipmanager/service` + `service/clients/kamailio.go` — провижининг subscriber
- `sipmanager/push` — APNS / FCM
- `sipmanager/store` — Postgres
- `sipmanager/config` — env `SIPMANAGER_*`

### 2. Отдельный реп `new/sipmanager`

Удобен для изолированной разработки SIP-части. **Сам по себе полный E2E не даёт:** есть `BackendClient` (`SIPMANAGER_BACKEND_ADDR`) — introspect токена и связанные запросы в облачный backend. Без поддержки со стороны облака часть функций (авторизация, права интегратора и т.д.) не работает.

**Для описания состояния продукта и тестов sip-test1** опираться на **axxoncloudgo + ветку feature/sipmanager_microservice**.

---

## Роли и связи

```text
Интегратор (браузер)
    │  REST + auth
    ▼
axxoncloud-ui (Sip*)
    │
    ▼
sipmanager  ←── auth / permissions ──→  backend
    │
    ├── Postgres (дерево, панели, аккаунты, subscriptions)
    ├── Kamailio HTTP API :8080  (create/delete subscriber, status)
    └── Push APNS/FCM

Kamailio (SIP INVITE)
    └── async POST sipmanager /calls  →  push на устройства абонента

Мобильный UA (Linphone)
    └── SIP REGISTER/INVITE к Kamailio (+ token в CONTACT / subscription API)
```

Это и есть фактическая замена размытому «SIP-коннектору = ITV-Cloud» из раннего ТЗ: **конкретный микросервис sipmanager + уже существующий backend + Kamailio**.

---

## Функции sipmanager (по коду)

Base URL: `/api/v1/sipmanager`.

| Область | Примеры endpoint |
|---|---|
| Дерево адресов | `GET/POST /trees/sip`, move, delete, patch |
| Панели | `GET/POST /sip-panels`, get/delete by id, `GET /sip-panels/status` |
| Аккаунты | `GET/POST /sip-accounts`, get/delete, `GET /my-sip-account` |
| Share | `POST /panels/:sipAdminId/share|unshare`, то же для accounts |
| Push subscription | `POST /notifications/subscription` |
| Входящий звонок (от Kamailio) | `POST /calls` |
| Служебное | `GET /heartbeat`, swagger, integrators search |

Права (Confluence / UI): `canViewSip` / `canManageSip`.

Env (совпадает с Confluence): `SIPMANAGER_PORT`, `SIPMANAGER_BACKEND_ADDR`, `SIPMANAGER_SIP_SERVER_ADDR`, `SIPMANAGER_DB_URL`, `SIPMANAGER_KAMAILIO_HTTP_API_URL`, `SIPMANAGER_RUN_WITHOUT_SIP_SERVER`, ключи APNS, `SIPMANAGER_FCM_CREDENTIALS_PATH`, …

---

## UI облака (раздел SIP)

Пути: `axxoncloud-ui/app/components/Sip/*`, `containers/Sip/*`, клиент `app/api/sipmanager.ts`.  
Роут с проверкой пермишнов (`RedirectSipPage`).

**Что есть:**

- sidebar-дерево (папки / панели / аккаунты), DnD move;
- карточка: имя, online/offline панели, SIP number, password, realm, email (аккаунт), `sipServerAddr`;
- add / delete / rename;
- share панелей и аккаунтов с другими интеграторами.

**Чего нет (и не должно путаться с ТЗ про WebRTC):**

- звонка из браузера;
- WebRTC-плеера вызова;
- кнопки «открыть дверь»;
- привязки RTSP камеры панели;
- UI истории звонков (API calls на стороне Kamailio/sipmanager может существовать — экрана в Sip-разделе нет).

---

## Что проверено на sip-test1

- Админка SIP в облаке (дерево, панели, аккаунты).
- Мобильные клиенты iOS и Android регистрировались и принимали вызов.
- Путь **foreground** и **background через push** — работал end-to-end.
- Источники вызова: панель **Beward** и имитация телефоном с **Linphone**.
- Медиа: видео + звук (детали early media — документы 01 / 02).

---

## Расхождения доков и кода

| Тема | Док / ожидание | Факт |
|---|---|---|
| SIP-сервер | Confluence: asterisk + kamailio | Kamailio + RTPEngine (док 03) |
| Share path | В старых фрагментах Confluence иные path | UI/codegen: `POST …/panels/{sipAdminId}/share` |
| Email confirm / active-inactive абонента | Sequence «Добавление квартир» | В Sip UI не видно |
| Call history | API упоминается | Нет экрана в Sip UI |
| «SIP-коннектор» с WebRTC и дверью через SIP | ТЗ «Экосистема…» | **Нет такого сервиса**; есть sipmanager без WebRTC/door HTTP |

---

## Вывод

Облачная часть домофонного SIP-пилота **уже собрана**: UI → sipmanager → Kamailio → push → мобильный SIP. Для развития МКД не нужно заново проектировать «мост в облако» — нужно:

1. довести мобильные push/CallKit (доки 01–02);
2. добавить **открытие двери и RTSP вне SIP** в Next/облако (док 05);
3. не тащить WebRTC в этап 1, пока ответ идёт с телефона/планшета по SIP.
