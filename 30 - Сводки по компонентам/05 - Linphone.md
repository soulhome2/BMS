
**Linphone** — это open-source SIP-клиент (софтфон) для аудио- и видеозвонков по протоколу SIP. Разрабатывается компанией Belledonne Communications (Франция).

## Состав

1. **Linphone SDK** — библиотека для встраивания SIP-функционала в мобильные и десктопные приложения (iOS, Android, Windows, macOS, Linux). Поддерживает аудио/видео кодеки, шифрование (SRTP/TLS), WebRTC.
2. **Готовые приложения** — бесплатные версии для iOS и Android (Linphone) и десктопа (Linphone Desktop).

## Использование в проекте

В ТЗ «Экосистема для многоквартирных домов» Linphone SDK планируется использовать как основу для **мобильного приложения жильца**, чтобы жилец мог:
- принимать видеовызовы с домофонной панели на смартфон;
- открывать дверь (DTMF);
- видеть видео с камеры панели.

## Стоимость

В ТЗ указано **18 тыс. евро единоразово** — это стоимость коммерческой лицензии на Linphone SDK для встраивания в проприетарное приложение. Если использовать Linphone SDK под AGPL (бесплатно), то своё приложение тоже придётся открывать под AGPL, что для коммерческого продукта обычно неприемлемо.

## Важный нюанс

SDK даёт SIP-стек и UI-компоненты, но **не решает** проблему push-уведомлений (iOS/Android убивают фоновые SIP-соединения). Для приёма вызова в свёрнутом приложении потребуется отдельная инфраструктура push-уведомлений (APNs/FCM) и, возможно, VoIP-сертификат для iOS — это дополнительная работа, не описанная в ТЗ.

## Ссылки

- **Официальный сайт**: [https://www.linphone.org](https://www.linphone.org)
- **SDK (GitHub)**: [https://github.com/BelledonneCommunications/linphone-sdk](https://github.com/BelledonneCommunications/linphone-sdk)
- **Документация SDK**: [https://www.linphone.org/technical-corner/liblinphone](https://www.linphone.org/technical-corner/liblinphone)
- **Готовые приложения**: [https://www.linphone.org/linphone-app](https://www.linphone.org/linphone-app)
- **Лицензирование**: [https://www.linphone.org/contact/linphone-sdk-license](https://www.linphone.org/contact/linphone-sdk-license)