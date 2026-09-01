# Состояние iOS прототипа SIP / домофонии

Краткий вердикт: standalone-приложение **ITV Intercom** на Linphone SDK принимает входящий SIP-вызов с видео и звуком, открывает дверь DTMF, поднимается из фона по VoIP push на тестовом контуре [sip-test1.axxoncloud.com](https://sip-test1.axxoncloud.com/). Это рабочий прототип жильца/оператора по SIP, не веб-клиент и не WebRTC.

---

## Исходники

| Что | Репозиторий / путь |
|---|---|
| Репозиторий | [apple-v5](ssh://git@src.axxonsoft.dev/mc/apple-v5.git) |
| Ветка | `dev` |
| Приложение | `/Users/avgx/soft/itv/ios/VmsClientApp/IntercomApp` |
| Ядро SIP / FSM | `/Users/avgx/soft/itv/ios/VmsClientApp/Packages/IntercomCore` |
| UI | `/Users/avgx/soft/itv/ios/VmsClientApp/Packages/IntercomUI` |
| Bundle ID | `ru.itv.Intercom` (display name: ITV Intercom) |

Связанные облачные компоненты (тест): [axxoncloudgo](ssh://git@src.axxonsoft.dev/proj/axxoncloudgo.git) (`feature/sipmanager_microservice`), [kamailio](ssh://git@src.axxonsoft.dev/new/kamailio.git), [axxoncloud-ui](ssh://git@src.axxonsoft.dev/proj/axxoncloud-ui.git).

---

## Архитектура

```text
IntercomApp (SwiftUI host)
  └─ IntercomUI  — экраны: onboarding, login, intercom, settings, video call, SIP trace
  └─ IntercomCore
       ├─ IntercomService     — оркестрация (singleton)
       ├─ IntercomCoordinator — чистый reducer / FSM
       ├─ Linphone + CoreDelegateAdapter — адаптер SDK
       ├─ CallKitManager      — системный UI входящего / audio session
       └─ VoipPushLogger      — PushKit registry + токен
```

Поток событий: `LinphoneEvent` → `IntercomService` → `IntercomEvent` → `IntercomCoordinator` → `IntercomState` (UI) + `IntercomEffect` (CallKit).

Ключевые файлы:

- `IntercomCore/.../Public/IntercomService.swift`
- `IntercomCore/.../FSM/IntercomCoordinator.swift`
- `IntercomCore/.../Core/Linphone.swift`
- `IntercomCore/.../CallKit/CallKitManager.swift`
- `IntercomCore/.../Support/VoipPushLogger.swift`
- `IntercomUI/.../IntercomScreen.swift`, `VideoCallView.swift`

---

## SIP / Linphone

| Параметр | Значение |
|---|---|
| SDK | `linphone-sdk-swift-ios` **exact 5.4.88** (`Package.swift`) |
| Транспорт | TCP |
| Видео | display on, capture off; accept = **recv-only**; H.264 |
| Аудио | PCMU / PCMA / G726 / G722 |
| Шифрование медиа | none (LIME/ZRTP off) |
| CallKit SDK-флаг | `callkitEnabled = false` — CallKit владеет приложение |
| `maxCalls` | 1 |
| Persistent config | `linphonerc` — cold start после VoIP push может восстановить регистрацию |

Demo-аккаунт для sip-test1 (`SipAccount+Demo.swift`): user `145`, server `49.13.224.57:5060`, realm/domain `integrator-7.axxoncloud.local`, transport TCP. Вендорского SDK Beward нет — панель и softphone-имитация идут как обычные SIP UA.

### Поток вызова

| Шаг | Поведение |
|---|---|
| INVITE | `IncomingReceived` → FSM `.incoming` → CallKit incoming |
| Early media | `IncomingEarlyMedia` → bind video → UI «Accept» поверх картинки |
| Answer | CallKit `CXAnswerCallAction` или UI → `acceptWithParams(videoRecvOnly)` → `.streamsRunning` / `.connected` |
| Дверь | `openDoor()` → DTMF `"#"` |
| End | `End` / `Released` / `Error` → CallKit end → idle |

**Отличие от Android:** нет явного `acceptEarlyMediaWithParams` на первом `IncomingReceived`. На iOS — обычная обработка INVITE; early media отрабатывается состояниями Linphone и UI, но продукт описывается как INVITE-путь (в отличие от android-фокуса на 183).

---

## Push / фон

Заявлено в `Info.plist`: `UIBackgroundModes` = `voip`, `remote-notification`. PushKit регистрирует VoIP-токен → `Linphone.voipToken` → CONTACT / REGISTER (`pn-param`, provider `apns` / `apns.dev`).

**Факт теста:** пуши реально приходили и поднимали приложение из фона; после подъёма принимался вызов с Beward и с имитации через телефон с Linphone — с видео и звуком.

**Состояние кода (дыры):**

- В `VoipPushLogger.didReceiveIncomingPushWith` payload только логируется; `completion()` не вызывается; CallKit на push не репортится (обязателен для iOS 13+ VoIP policy).
- CallKit показывается при приходе **SIP INVITE**, а не на момент push.
- Файла entitlements у `IntercomApp` в дереве нет.
- `core.processPushNotification` / полноценный push-only mode не доведены.

Итог: E2E на тестовом стенде подтверждён; путь push→CallKit в коде ещё не доведён до продакшен-качества Apple.

---

## Что работает / что нет

**Работает (прототип):**

- REGISTER TCP к sip-test1
- Входящий INVITE → CallKit / in-app UI
- Early media video + Accept
- Answer с recv-only H.264 + аудио, speaker
- Hangup / remote end
- Открытие двери DTMF `#`
- SIP trace / логирование диалога
- Onboarding (уведомления, микрофон), login form, settings

**Не готово:**

- «Получить аккаунт из облака» — disabled TODO
- `DoorUnlockMethod.sipInfo` смоделирован, не используется
- Много `LinphoneEvent` / registration states — TODO
- Неполный VoIP push → CallKit
- Нет README / тестов в пакетах Intercom*
- HTTP unlock двери без SIP — отсутствует (только DTMF в звонке)

---

## Вывод для пакета документов

iOS-прототип доказывает, что **мобильный жилец/оператор может работать чистым SIP+RTP** (Linphone) против текущего облачного Kamailio/sipmanager без WebRTC. Следующие шаги прототипа: довести PushKit→CallKit, cloud login, и отдельно — API открытия двери / RTSP вне SIP (см. документ 05).
