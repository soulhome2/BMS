# Состояние Android прототипа SIP / домофонии

Краткий вердикт: два проекта на общем Linphone-стеке. **android-intercom** — SIP-лаборатория; **domofon** — продуктовая оболочка с тем же ядром. На [sip-test1.axxoncloud.com](https://sip-test1.axxoncloud.com/) проверены вызов в foreground и в background через FCM-пуш; ответ на Beward и на имитацию Linphone — с видео и звуком, с явной обработкой **183 early media**.

---

## Исходники

| Что | Репозиторий / путь |
|---|---|
| SIP lab | [android-intercom](ssh://git@src.axxonsoft.dev/mc/android-intercom.git) (`master`) |
| Локально | `/Users/avgx/soft/itv/android/android-intercom` |
| App id | `com.axxonsoft.intercom` |
| Продуктовый прототип | [domofon](ssh://git@src.axxonsoft.dev/~ivan.fedeikin/domofon.git) (`master`) |
| Локально | `/Users/avgx/soft/itv/android/domofon` |

Связанные: [axxoncloudgo](ssh://git@src.axxonsoft.dev/proj/axxoncloudgo.git) (`feature/sipmanager_microservice`), [kamailio](ssh://git@src.axxonsoft.dev/new/kamailio.git), [axxoncloud-ui](ssh://git@src.axxonsoft.dev/proj/axxoncloud-ui.git), iOS — [apple-v5](ssh://git@src.axxonsoft.dev/mc/apple-v5.git).

---

## Два проекта

| | android-intercom | domofon |
|---|---|---|
| Роль | SIP PoC / workbench | Intercom app shell (MC-6867) |
| Навигация | Login → Devices → SIP Home | Bottom nav: Favorites / Hardware / Access / Events / **Sip** |
| SIP-ядро | `SipService` + `FcmService` + Linphone | То же (порт UI в `ui/sip_screen/`) |
| Продуктовые экраны | Минимальные | Камеры, шлагбаумы, коды, события — в основном демо/TODO |

Референс по early media и push — **android-intercom**. Domofon = UI-форк вокруг того же SIP.

---

## Архитектура (android-intercom)

```text
App (Linphone Core + FCM token + Telecom PhoneAccount)
 ├─ MainActivity → Launch → CloudLogin → DeviceConnection → Home (SIP UI)
 ├─ CallingActivity / CallingView (fullscreen call; частично не в nav)
 ├─ SipService — REGISTER, call state, notifications, DTMF unlock
 └─ FcmService — incoming-call push → high-priority / full-screen intent
```

Ключевые файлы:

- `.../App.kt` — конфиг Core (early media, video policy)
- `.../SipService.kt` — call state machine
- `.../FcmService.kt` — FCM
- `.../ui/home_screen/` — SIP UI (в domofon: `ui/sip_screen/`)
- `.../ui/cloud_login/` — логин + `sip().register(deviceToken, …)`
- `app/build.gradle` — зависимость SDK

---

## SIP / Linphone и 183 early media

| Параметр | Значение |
|---|---|
| SDK | `org.linphone.bundled:linphone-sdk-android:5.4.46` |
| Early media | `ringDuringIncomingEarlyMedia = true` |
| Video reuse | `setVideoSourceReuseEnabled(true)` — комментарий: «исправило проблему early media» |
| Auto-accept video offer | `videoActivationPolicy.automaticallyAccept = true` |
| Ringtone SDK | `disableCallRinging(true)` — звонок через notifications приложения |

### Входящий вызов (критический путь)

В `SipService.onCallStateChanged` при **`IncomingReceived`**:

1. `params.isVideoEnabled = true`, `videoDirection = SendRecv`
2. **`call.acceptEarlyMediaWithParams(params)`** — явная обработка 183 / early media
3. Ringing notification (Accept / Decline / Unlock)

`IncomingEarlyMedia` — пустой handler (заготовки под отключение capture закомментированы).  
Accept (200 OK): `acceptWithParams` с video.  
Unlock: `sendDtmfs(code)`.  
Beward-специфики в коде нет — панель как SIP UA; имитация — outbound dialer на другой Linphone/аккаунт.

**Отличие от iOS:** Android целенаправленно принимает early media сразу на INVITE; iOS идёт обычным INVITE→CallKit путём без `acceptEarlyMediaWithParams`.

---

## Push / фон

| Кусок | Поведение |
|---|---|
| `FcmService` | `onMessageReceived` → канал high importance + `CATEGORY_CALL` + `setFullScreenIntent` → `MainActivity` |
| Токен | `App.refreshFcmToken()` → prefs; после cloud login — `cloudClient.sip().register(deviceToken, email)` |
| Тест-утилиты | `push/send_test_push.bat`, `msg.json` (проект FCM `axxon-intercom`) |

**Факт теста:** пуши реально приходили и поднимали приложение из фона; вызов с Beward / Linphone-имитации отвечён с видео и звуком (включая сценарий background).

**Состояние кода (дыры, без отрицания теста):**

- Push сам по себе **не стартует** `SipService` / не делает re-REGISTER — показывает notification
- Возможный mismatch ключей payload (`caller`/`type` vs `sipNumber`/`callerNumber` в тестовых JSON)
- Нет `USE_FULL_SCREEN_INTENT` / `FOREGROUND_SERVICE` / `WAKE_LOCK` в manifest (в проверенных версиях)
- `SipService` не foreground service — процесс может убиваться ОС
- Telecom `ConnectionService` / system call UI — в основном stub / commented
- TODO в `MainActivity`: push должен открывать приложение и принимать звонок; проверка «уже в звонке»; адресация пушей на стороне облака

---

## Что работает / что нет

**Работает (прототип, когда процесс жив / зарегистрирован):**

- Cloud login + список SIP-аккаунтов
- SIP REGISTER (UDP в типичной конфигурации Linphone)
- Outbound invite с early-media sending + video
- Inbound **auto early media (183)** + answer A/V
- Video surfaces, mic/speaker, DTMF unlock
- Подписка FCM-токена в sipmanager
- High-priority call-style push

**Не готово / баги:**

- Надёжный cold-start: push → re-register SIP → INVITE
- Telecom / system incoming call UI
- CallingView: Accept только для `IncomingReceived || Idle`, **не** для `IncomingEarlyMedia` — кнопка Accept может пропасть после early media на этом экране
- CallingActivity wiring частично unused
- Domofon product tabs — demo
- README в обоих репах отсутствует

---

## Вывод для пакета документов

Android закрывает сценарий **раннего видео до ответа (183)** — типичный для домофонных панелей — и подтверждает тот же облачный контур, что и iOS. Продуктовый путь: довести wake+re-REGISTER, Telecom/fullscreen call UX, и HTTP unlock / RTSP вне SIP (документ 05). Для оценки SIP-логики смотреть **android-intercom**; для UX оболочки — **domofon**.
