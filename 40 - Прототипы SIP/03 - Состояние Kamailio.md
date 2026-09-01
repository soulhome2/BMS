# Состояние SIP-сервера Kamailio

Краткий вердикт: облачный SIP-контур развёрнут как **Kamailio 5.7.6 + RTPEngine + Postgres**. Это сигнальный прокси/регистратор и медиа-релей для классического SIP/RTP. **Asterisk в активном деплое нет** (в compose закомментирован). WebRTC-шлюзом Kamailio/RTPEngine в текущей конфигурации **не** является.

---

## Исходники

| Что | Репозиторий / путь |
|---|---|
| Репозиторий | [kamailio](ssh://git@src.axxonsoft.dev/new/kamailio.git) |
| Ветка | `main` |
| Локально | `/Users/avgx/soft/itv/cloud/kamailio` |
| Конфиг | `kamailio/kamailio.cfg` |
| Compose | `docker-compose.yml` |
| Образ | `Dockerfile` (Kamailio 5.7.6, postgres/xml/json modules, sngrep, gophone) |
| Документация локального запуска | `README.md` |

Связанные: [axxoncloudgo](ssh://git@src.axxonsoft.dev/proj/axxoncloudgo.git) (`feature/sipmanager_microservice`) — webhook `/calls` и CRUD subscriber; [sipmanager](ssh://git@src.axxonsoft.dev/new/sipmanager.git) (отдельный реп); клиенты [apple-v5](ssh://git@src.axxonsoft.dev/mc/apple-v5.git), [android-intercom](ssh://git@src.axxonsoft.dev/mc/android-intercom.git).  
Confluence: [SIP](https://internal.axxonsoft.dev/pages/viewpage.action?pageId=146424130), локальный экспорт `/Users/avgx/soft/itv/cloud/confluence-sip`.  
Тест: [https://sip-test1.axxoncloud.com/](https://sip-test1.axxoncloud.com/) (UI/облако; SIP на том же контуре).

---

## Архитектура развёртывания

```text
Panel / mobile SIP UA
    │  SIP :5060 UDP/TCP
    ▼
 Kamailio  ──► Postgres (subscriber, location, accounting)
    │
    ├── RTPEngine :2223 NG + RTP ports (медиа-релей / NAT)
    │
    └── HTTP :8080 (xhttp + jsonrpc)
            │  subscriber CRUD, calls API
            ▼
         sipmanager  ◄── async POST /calls на входящий INVITE
            │
            ▼
         APNS / FCM push
```

Сервисы в `docker-compose.yml`:

| Сервис | Роль |
|---|---|
| `db` | Postgres 11 |
| `rtpengine` | медиа-релей (`drachtio/rtpengine`) |
| `kamailio` | SIP proxy/registrar + HTTP API |
| `asterisk` | **закомментирован** — не используется |

Локальный bootstrap (`run.sh` / README): ожидание БД → `kamdbctl create` → seed пользователей `user1` / `sippanel` → старт. В контейнере: **sngrep**, **gophone** для ручных REGISTER/INVITE.

---

## Конфиг: что включено

Флаги в `kamailio.cfg` (среди прочих): `WITH_PGSQL`, `WITH_AUTH`, `WITH_USRLOCDB`, `WITH_NAT`, `WITH_RTPENGINE`, **`WITH_SIPMANAGER_INTEGRATION`**, `WITH_HTTP_API`, `WITH_JSONRPC`.

### Сигнализация и медиа

- Listen SIP `:5060`; advertise IP в конфиге нужно выставлять под стенд (README: строки listen).
- Медиа: `rtpengine_manage("… ICE=remove RTP/AVP")` — **классический SIP/RTP**, ICE снимается. Это **не** DTLS-SRTP / WebRTC для браузера.
- Push Contact: правки `pn-silent`, `pn-timeout` под push-сценарии мобильных клиентов.

### Интеграция с sipmanager

На начальный **INVITE** → `route(CALL_SIPMANAGER_API)`:

- payload: `sipNumber`, `callerNumber`, `callId`
- async `POST {sipmanager.api_url}/calls`
- sipmanager шлёт push (APNS/FCM) — см. документ 04

HTTP API Kamailio `:8080` (subscriber create/delete/status, calls GET/DELETE, call initiate и т.п.) — сторона, в которую пишет sipmanager при провижининге аккаунтов/панелей.

---

## Расхождение с Confluence

В экспорте Confluence SIP сервер описан как связка **«asterisk + kamailio»** (CLOUD-14379).

**Факт репозитория деплоя:** активны Kamailio + RTPEngine + Postgres. Asterisk только в комментарии compose. Asterisk+Kamailio встречается в вендорских/экспериментальных стеках (например BAS-IP Link), но **не** в этом cloud kamailio-репо.

Итог: для документации продукта и пилота опираться на **Kamailio + RTPEngine**, не на Asterisk.

---

## Что проверено на стенде

Клиенты iOS и Android ходили на контур sip-test1:

- регистрация SIP UA;
- вызов с панели Beward и с softphone Linphone;
- медиа (видео + звук) через RTPEngine-путь;
- push при входящем (Kamailio → sipmanager → APNS/FCM).

Сам репозиторий kamailio — инфраструктура сигнализации/медиа; бизнес-логика панелей/аккаунтов/пушей — в sipmanager + UI (документ 04).

---

## Что это значит для архитектуры МКД

1. **Роль Kamailio** — правильная: registrar/proxy, масштаб регистраций, NAT, хук на INVITE для push.
2. **RTPEngine здесь** — relay для SIP/RTP, а не обязательный WebRTC-gateway. Для браузерного ответа нужен был бы другой профиль (ICE/DTLS) или отдельный медиасервер — это **не** сделано и **не** нужно для мобильного пилота (см. документ 05).
3. Отдельный «SIP-коннектор» как ещё один микросервис поверх Kamailio **не** требуется для текущей модели: провижининг и push уже в **sipmanager**.

---

## Локальный запуск (кратко)

См. `README.md` репозитория:

1. Прописать публичный listen в `kamailio.cfg`.
2. `docker-compose up`.
3. Диагностика: `docker exec -it kamailio sngrep`.
4. Тест: `gophone register` / `gophone dial` с seed-пользователями.
