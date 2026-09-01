const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(window) {
    window.Element.prototype.scrollIntoView = function() {};
    window.addEventListener('error', e => errors.push('window error: ' + e.message));
  }
});

const w = dom.window;
const d = w.document;

function fail(msg) { errors.push('FAIL: ' + msg); console.log('  FAIL ' + msg); }
function ok(msg) { console.log('  ok   ' + msg); }
function assert(cond, msg) { cond ? ok(msg) : fail(msg); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const click = (el, what) => {
  if (!el) { fail('нет элемента для клика: ' + what); return; }
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
};
const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
const visible = (sel) => Array.from(d.querySelectorAll(sel)).filter(n => !n.classList.contains('hidden'));
const count = (sel) => d.querySelectorAll(sel).length;
const nodes = () => count('#treeContainer .tree-node');
const byType = (t) => count('#treeContainer .tree-node[data-type="' + t + '"]');
const regions = () => byType('region');
const cities = () => byType('city');
const complexes = () => byType('complex');
const houses = () => byType('house');
const entrances = () => byType('entrance');
const flats = () => byType('flat');
const panels = () => byType('panel');
const accounts = () => byType('account');
const groups = () => count('#treeContainer .tree-group');
const selectable = () => count('#treeContainer .tree-node[data-selectable="1"]');
const fleetRows = () => count('#fleetBody tr');
const pending = () => count('#treeContainer .tree-node.pending-delete');
// Живых тостов с кнопкой может быть несколько — нужен последний
const undoToast = () => {
  const all = d.querySelectorAll('#toastStack .toast:not([data-closing]) .toast-action');
  return all[all.length - 1] || null;
};
const lastToast = () => {
  const all = d.querySelectorAll('#toastStack .toast:not([data-closing])');
  return all[all.length - 1] || { textContent: '' };
};
const cardType = () => d.getElementById('cardType').textContent;
const status = () => d.getElementById('treeStatus').textContent;
const sections = () => d.getElementById('cardSections').textContent;
const stats = () => d.getElementById('cardStats').textContent;
const modalVisible = () => d.getElementById('modalOverlay').classList.contains('visible');
const openNode = (sel, what) => {
  const li = d.querySelector(sel);
  if (!li) { fail('нет узла: ' + what); return null; }
  click(li.querySelector('.node-content'), what);
  return li;
};

(async function main() {
  const t0 = Date.now();
  const search = d.getElementById('searchInput');
  const scopeSelect = d.getElementById('scopeSelect');

  console.log('— стартовое состояние —');
  assert(nodes() === 1880, 'дерево отрисовано: ' + nodes() + ' узлов (1862 объекта + 18 полок)');
  assert(regions() === 2 && cities() === 3, 'два региона и три населённых пункта');
  assert(complexes() === 4 && houses() === 6, 'четыре ЖК и шесть домов: ' + complexes() + '/' + houses());
  assert(flats() === 765, 'квартир 765: ' + flats());
  assert(panels() === 18, 'панелей 18: ' + panels());
  assert(accounts() === 767, 'аккаунтов 767: ' + accounts());
  assert(!d.getElementById('detailCard').classList.contains('hidden'), 'карточка показана при старте');
  assert(cardType() === 'Регион' && d.getElementById('cardName').value === 'Москва',
    'сверху дерева регион, а не ЖК: ' + cardType());
  assert(status().includes('4 ЖК') && status().includes('6 домов'),
    'статус-бар считает ЖК и дома по всей установке: ' + status());

  console.log('— адрес: регион → город → ЖК → дом —');
  assert(sections().includes('Города и села'), 'в карточке региона список населённых пунктов');
  assert(sections().includes('Страна одна — Российская Федерация'), 'объяснено, почему страны в дереве нет');
  openNode('#treeContainer .tree-node[data-type="city"]', 'город');
  assert(cardType() === 'Населённый пункт', 'карточка города: ' + cardType());
  assert(sections().includes('Жилые комплексы'), 'в городе перечислены ЖК');
  assert(count('[data-list-body="complexes"] .list-item') === 2, 'в Москве два ЖК: ' + count('[data-list-body="complexes"] .list-item'));

  openNode('#treeContainer .tree-node[data-type="house"]', 'дом');
  assert(cardType() === 'Дом', 'карточка дома: ' + cardType());
  assert(sections().includes('Подъезды') && sections().includes('Панели дома'), 'у дома свои подъезды и панели');
  assert(count('[data-list-body="ent"] .list-item') === 6, 'в 7А шесть подъездов: ' + count('[data-list-body="ent"] .list-item'));
  const crumbText = d.getElementById('cardBreadcrumb').textContent;
  assert(crumbText.includes('Москва') && crumbText.includes('Отрадное'),
    'в хлебных крошках весь адрес до региона: ' + crumbText);

  console.log('— параметры контура —');
  assert(d.getElementById('cfgRealm').readOnly, 'realm в шапке только показывается: его выдаёт сервер');
  assert(d.querySelector('.top-bar-fields .fields-lead').textContent === 'Контур',
    'поля инсталляции отделены от настроек ЖК');

  console.log('— ЖК как арендатор —');
  openNode('#treeContainer .tree-node[data-type="complex"]', 'ЖК');
  assert(cardType() === 'Жилой комплекс', 'карточка ЖК: ' + cardType());
  assert(stats().includes('Подписка'), 'в карточке ЖК видно состояние подписки');
  assert(sections().includes('Подписка и договор'), 'есть раздел договора');
  assert(d.querySelector('[data-meta="company"]').value.includes('Отрадное'), 'управляющая компания заполнена');
  assert(d.querySelector('[data-meta="contract"]').value === 'Д-2026/114', 'номер договора на месте');
  assert(d.querySelector('[data-meta="limitFlats"]').value === '300', 'лимит квартир задан');
  assert(stats().includes('245 из 300'), 'квартиры двух домов сложены против лимита: ' + stats());
  assert(count('[data-list-body="houses"] .list-item') === 2, 'в ЖК два дома: ' + count('[data-list-body="houses"] .list-item'));
  assert(sections().includes('Лимиты тарифа считаются на весь ЖК'), 'сказано, что лимит на ЖК, а не на дом');

  console.log('— панели на своём месте в дереве —');
  assert(groups() === 18, 'полок «Панели» столько же, сколько уровней монтажа: ' + groups());
  const kGroup = d.querySelector('#treeContainer .tree-node[data-type="complex"] > ul > .tree-group');
  assert(!!kGroup, 'полка панелей есть прямо в ЖК');
  assert(kGroup.querySelector('.tree-node[data-type="panel"] .node-text').textContent.includes('Въезд'),
    'въезд на территорию лежит в самом ЖК');
  const hGroup = d.querySelector('#treeContainer .tree-node[data-type="house"] > ul > .tree-group');
  assert(!!hGroup, 'у дома есть своя полка панелей — входная группа');
  const eGroup = d.querySelector('#treeContainer .tree-node[data-type="entrance"] > ul > .tree-group');
  assert(!!eGroup, 'у подъезда своя полка панелей');

  console.log('— область видимости —');
  assert(scopeSelect.options.length === 5, 'в селекторе «Все ЖК» и четыре ЖК: ' + scopeSelect.options.length);
  assert(scopeSelect.options[1].textContent.startsWith('Москва › '),
    'в подписи ЖК указан город: ' + scopeSelect.options[1].textContent);
  assert(scopeSelect.value === '', 'по умолчанию показаны все ЖК');

  const otradnoe = scopeSelect.options[1].value;
  change(scopeSelect, otradnoe);
  assert(complexes() === 1 && regions() === 0, 'дерево обрезано до одного ЖК: ' + complexes() + '/' + regions());
  assert(houses() === 2 && flats() === 245, 'дома и квартиры только своего ЖК: ' + houses() + '/' + flats());
  assert(panels() === 10, 'панелей только своего ЖК: ' + panels());
  assert(accounts() === 247, 'аккаунтов только своего ЖК: ' + accounts());
  assert(status().includes('Отрадное'), 'статус-бар назван по ЖК: ' + status());
  assert(status().includes('подписка активна'), 'в статус-баре видно состояние подписки: ' + status());

  click(d.getElementById('provisionBtn'), 'provision в границах ЖК');
  const scopedCmds = d.getElementById('provCommands').value.split('subscriber/create').length - 1;
  assert(scopedCmds === 257, 'выгружены только subscriber\'ы своего ЖК: ' + scopedCmds);
  assert(d.getElementById('provCommands').value.includes('integrator-123'), 'realm един для всей выгрузки');
  assert(d.getElementById('modalBody').textContent.includes('Отрадное'), 'в модалке указана область выгрузки');
  click(d.querySelector('[data-modal-cancel]'), 'cancel');

  change(scopeSelect, '');
  assert(complexes() === 4 && flats() === 765, 'возврат ко всем ЖК');

  console.log('— свои выпадающие списки —');
  const scopeTrigger = scopeSelect.nextElementSibling;
  assert(scopeSelect.classList.contains('combo-native'), 'родной select скрыт');
  assert(!!scopeTrigger && scopeTrigger.classList.contains('combo-trigger'), 'вместо него кнопка в оформлении экрана');
  assert(scopeTrigger.querySelector('.combo-value').textContent.startsWith('Все ЖК'),
    'на кнопке текущее значение: ' + scopeTrigger.querySelector('.combo-value').textContent);
  click(scopeTrigger, 'открыть список ЖК');
  const menu = d.querySelector('.combo-menu');
  assert(!!menu, 'список открылся');
  assert(menu.querySelectorAll('.combo-option').length === 5, 'в списке пять пунктов');
  assert(menu.querySelector('.combo-option.selected').textContent.includes('Все ЖК'), 'текущий пункт отмечен галочкой');
  click(menu.querySelectorAll('.combo-option')[1], 'выбрать ЖК из списка');
  assert(!d.querySelector('.combo-menu'), 'после выбора список закрылся');
  assert(complexes() === 1, 'выбор в списке переключил область видимости');
  assert(scopeTrigger.querySelector('.combo-value').textContent.includes('Отрадное'), 'подпись кнопки обновилась');
  click(scopeTrigger, 'открыть снова');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert(!d.querySelector('.combo-menu'), 'Escape закрывает список');
  change(scopeSelect, '');

  console.log('— поиск в дереве —');
  type(search, 'Квартира 1011');
  assert(visible('#treeContainer .tree-node[data-type="flat"]').length === 1, 'поиск по имени квартиры');
  type(search, 'cb1012@citybay.ru');
  assert(visible('#treeContainer .tree-node[data-type="account"]').length === 1, 'поиск по email аккаунта');
  type(search, '9003');
  assert(visible('#treeContainer .tree-node[data-type="panel"]').length === 1, 'поиск по SIP-номеру панели');
  type(search, 'Химки');
  assert(visible('#treeContainer .tree-node[data-type="panel"]').length === 2,
    'панель находится по городу: ' + visible('#treeContainer .tree-node[data-type="panel"]').length);
  type(search, 'нетакого');
  assert(d.getElementById('treeSearchEmpty').classList.contains('visible'), 'состояние «ничего не найдено»');
  click(d.getElementById('searchClear'), 'searchClear');
  assert(search.value === '' && !d.getElementById('treeSearchEmpty').classList.contains('visible'), 'очистка поиска');

  console.log('— карточка квартиры —');
  const flatLi = openNode('#treeContainer .tree-node[data-type="flat"]', 'квартира');
  assert(cardType() === 'Квартира', 'карточка квартиры');
  assert(count('[data-list-body="acc"] .list-item') === 2, 'аккаунтов в карточке: ' + count('[data-list-body="acc"] .list-item'));
  assert(count('[data-list-body="fpanels"] .list-item') === 2, 'связанных панелей: ' + count('[data-list-body="fpanels"] .list-item'));

  console.log('— пароль в списке скрыт —');
  const pwdSpan = d.querySelector('[data-list-body="acc"] .pwd');
  assert(pwdSpan.textContent === '••••••••', 'пароль замаскирован: ' + pwdSpan.textContent);
  click(d.querySelector('[data-list-body="acc"] .item-action[data-act="reveal-pwd"]'), 'reveal');
  const shownPwd = d.querySelector('[data-list-body="acc"] .pwd');
  assert(shownPwd.textContent === shownPwd.dataset.pwd && shownPwd.textContent.length > 3,
    'по кнопке пароль открылся');
  click(d.querySelector('[data-list-body="acc"] .item-action[data-act="reveal-pwd"]'), 'hide');
  assert(d.querySelector('[data-list-body="acc"] .pwd').textContent === '••••••••', 'и прячется обратно');

  const secSearch = d.querySelector('.section-search-input[data-list="fpanels"]');
  type(secSearch, 'Въезд');
  assert(count('[data-list-body="fpanels"] .list-item') === 1, 'поиск внутри секции');
  type(secSearch, '');
  const before = d.querySelector('[data-list-body="fpanels"] .list-item .name').textContent;
  click(d.querySelector('.section-sort[data-list="fpanels"]'), 'sort');
  assert(before !== d.querySelector('[data-list-body="fpanels"] .list-item .name').textContent, 'сортировка секции');

  console.log('— отвязка панели с отменой —');
  click(d.querySelector('[data-list-body="fpanels"] .item-action[data-act="unbind"]'), 'unbind');
  assert(count('[data-list-body="fpanels"] .list-item') === 1, 'связка убрана');
  click(undoToast(), 'undo unbind');
  assert(count('[data-list-body="fpanels"] .list-item') === 2, 'отмена вернула связку: правка связок обратима');

  console.log('— пикер панелей: весь ЖК, свой дом первым —');
  click(d.querySelector('.section-action[data-action="bind-panels"]'), 'bind-panels');
  const panelOpts = count('#bindPickList .modal-option');
  assert(panelOpts === 10, 'предложены все панели ЖК, включая другой дом: ' + panelOpts);
  assert(d.getElementById('modalBody').textContent.includes('Юрловский проезд, 7А'),
    'в подсказке назван свой дом: ' + d.getElementById('modalBody').textContent.slice(0, 220));
  const firstPanelSub = d.querySelector('#bindPickList .modal-option').dataset.subOff ||
    d.querySelector('#bindPickList .modal-option .opt-sub').textContent;
  assert(firstPanelSub.includes('Подъезд 1'), 'первой идёт панель своего подъезда: ' + firstPanelSub);
  click(d.querySelector('[data-modal-cancel]'), 'cancel');

  console.log('— email жильца уникален в квартире, но не в установке —');
  click(d.querySelector('.section-action[data-action="add-account"]'), 'add-account');
  assert(modalVisible(), 'модалка открыта');
  d.getElementById('aEmail').value = 'не-почта';
  click(d.getElementById('aOk'), 'aOk с кривым email');
  assert(d.getElementById('aErr').classList.contains('visible'), 'формат email проверяется');
  assert(modalVisible(), 'модалка не закрылась на ошибке');
  d.getElementById('aEmail').value = 'ivanov@mail.ru';
  click(d.getElementById('aOk'), 'aOk с email из этой же квартиры');
  assert(d.getElementById('aErr').textContent.toLowerCase().includes('в этой квартире'),
    'дубль внутри квартиры не пропущен: ' + d.getElementById('aErr').textContent);
  d.getElementById('aEmail').value = 'petrova@mail.ru';
  d.getElementById('aSip').value = '9001';
  click(d.getElementById('aOk'), 'aOk с занятым номером');
  assert(d.getElementById('aErr').textContent.includes('занят'),
    'SIP-номер не должен дублировать панель: ' + d.getElementById('aErr').textContent);
  d.getElementById('aSip').value = '5900';
  click(d.getElementById('aOk'), 'aOk');
  assert(!modalVisible(), 'email собственника из другой квартиры принят');
  assert(cardType() === 'SIP-аккаунт', 'открылась карточка нового аккаунта');
  assert(accounts() === 768, 'аккаунтов стало 768: ' + accounts());
  assert(stats().includes('Квартир у жильца'), 'в карточке видно, сколько квартир у жильца: ' + stats());
  assert(count('[data-list-body="owner"] .list-item') === 2,
    'перечислены другие квартиры того же собственника: ' + count('[data-list-body="owner"] .list-item'));

  change(d.querySelector('[data-meta="priority"]'), '3');
  assert(d.querySelector('[data-meta="priority"]').value === '3', 'приоритет сохранён');

  console.log('— регистрация только для чтения —');
  assert(!d.querySelector('[data-action="toggle-online"]'), 'тумблера «включить регистрацию» больше нет');
  assert(!!d.querySelector('.form-readout'), 'регистрация показана как индикатор');
  assert(d.querySelector('.form-readout .readout-sub').textContent.includes('не опрашивалось'),
    'видно, что состояние ещё не запрашивали');
  click(d.querySelector('.readout-btn[data-action="check-status"]'), 'check-status');
  assert(d.querySelector('.form-readout .readout-sub').textContent.includes('опрошено'),
    'после опроса отмечено время: ' + d.querySelector('.form-readout .readout-sub').textContent);

  console.log('— блокировка учётной записи —');
  const secret = d.querySelector('[data-meta="password"]');
  assert(secret.type === 'password', 'пароль в карточке под маской');
  click(d.querySelector('.form-secret .secret-btn'), 'показать пароль');
  assert(d.querySelector('[data-meta="password"]').type === 'text', 'по кнопке пароль открылся');
  click(d.querySelector('.form-toggle[data-action="toggle-blocked"]'), 'block');
  assert(stats().includes('Заблокирована'), 'статус учётки стал «Заблокирована»: ' + stats());
  assert(!!d.querySelector('#treeContainer .tree-node[data-type="account"][data-id] .status-dot.blocked'),
    'в дереве точка статуса тоже показывает блокировку');
  click(d.querySelector('.form-toggle[data-action="toggle-blocked"]'), 'unblock');
  assert(!stats().includes('Заблокирована'), 'разблокировка возвращает обычный статус');
  click(d.querySelector('.form-toggle[data-action="toggle-blocked"]'), 'block again');
  assert(stats().includes('Заблокирована'), 'оставляем заблокированной — проверим выгрузку');

  console.log('— собственник нескольких квартир —');
  const ivanovRow = Array.from(d.querySelectorAll('#treeContainer .tree-node[data-type="account"] .node-text'))
    .find(el => el.textContent === 'ivanov@mail.ru');
  click(ivanovRow, 'аккаунт Иванова');
  assert(cardType() === 'SIP-аккаунт', 'карточка аккаунта Иванова');
  assert(count('[data-list-body="owner"] .list-item') === 3,
    'у Иванова ещё три квартиры — в другом доме, ЖК и регионе: ' + count('[data-list-body="owner"] .list-item'));
  const ownerSubs = Array.from(d.querySelectorAll('[data-list-body="owner"] .list-item .sub')).map(x => x.textContent);
  assert(ownerSubs.some(s => s.includes('7Б')) && ownerSubs.some(s => s.includes('Новые Химки')),
    'в списке видно, где эти квартиры: ' + ownerSubs.join(' | '));
  click(d.querySelector('[data-list-body="owner"] .list-item'), 'перейти в другую квартиру жильца');
  assert(cardType() === 'Квартира', 'ссылка ведёт в квартиру');

  console.log('— удаление аккаунта: окно до фиксации —');
  click(flatLi.querySelector('.node-content'), 'вернуться в первую квартиру');
  const accBefore = count('[data-list-body="acc"] .list-item');
  click(d.querySelector('[data-list-body="acc"] .item-action[data-act="delete-node"]'), 'delete account');
  assert(count('[data-list-body="acc"] .list-item') === accBefore,
    'аккаунт остаётся на месте, пока идёт отсчёт: в Kamailio ничего не отправлено');
  assert(pending() === 1, 'узел помечен как удаляемый: ' + pending());
  assert(!!d.querySelector('.pending-chip'), 'виден обратный отсчёт');
  assert(lastToast().textContent.includes('удаление через'), 'тост объясняет, что удаление отложено');
  click(undoToast(), 'cancel delete account');
  assert(pending() === 0, 'отметка снята');
  assert(accounts() === 768, 'аккаунт никуда не делся: ' + accounts());

  console.log('— линза «Оборудование» —');
  click(d.querySelector('.tree-tab[data-tab="equip"]'), 'lens equip');
  assert(panels() === 18, 'панелей столько же: ' + panels());
  assert(flats() === 0 && accounts() === 0, 'квартиры и аккаунты скрыты');
  assert(complexes() === 4 && houses() === 6, 'адресный остов над панелями остался: ' + complexes() + '/' + houses());
  assert(entrances() === 15, 'подъезды с панелями видны: ' + entrances());
  assert(groups() === 0, 'в линзе оборудования полки не нужны');
  assert(!!d.querySelector('#treeContainer .tree-view-row'), 'есть строка входа в таблицу');
  assert(status().includes('18 панелей'), 'статус-бар про оборудование: ' + status());
  type(search, 'Секция 2');
  assert(visible('#treeContainer .tree-node[data-type="panel"]').length === 1, 'поиск панели по месту установки');
  type(search, 'Ивановское');
  assert(visible('#treeContainer .tree-node[data-type="panel"]').length === 1, 'поиск панели по селу');
  click(d.getElementById('searchClear'), 'searchClear');

  console.log('— таблица парка —');
  assert(cardType() === 'Парк оборудования', 'квартира в линзе оборудования уступила место сводке');
  assert(fleetRows() === 18, 'в таблице все панели: ' + fleetRows());
  assert(stats().includes('Без привязок'), 'в сводке есть счётчик панелей без квартир');
  click(d.querySelector('.fleet-filter-btn[data-mode="offline"]'), 'filter offline');
  assert(fleetRows() === 16, 'фильтр «офлайн»: ' + fleetRows());
  click(d.querySelector('.fleet-filter-btn[data-mode="online"]'), 'filter online');
  assert(fleetRows() === 2, 'фильтр «онлайн»: ' + fleetRows());
  click(d.querySelector('.fleet-filter-btn[data-mode="all"]'), 'filter all');
  type(d.getElementById('fleetSearch'), 'Корпус');
  assert(fleetRows() === 4, 'поиск по дому в таблице: ' + fleetRows());
  type(d.getElementById('fleetSearch'), 'Химки');
  assert(fleetRows() === 2, 'поиск по городу в таблице: ' + fleetRows());
  type(d.getElementById('fleetSearch'), '');
  click(d.querySelector('.fleet-table th[data-sort="sip"]'), 'sort by sip');
  assert(d.querySelector('#fleetBody tr td:nth-child(4)').textContent === '7001', 'сортировка по SIP по возрастанию');
  click(d.querySelector('.fleet-table th[data-sort="sip"]'), 'sort by sip desc');
  assert(d.querySelector('#fleetBody tr td:nth-child(4)').textContent === '9012', 'повторный клик переворачивает сортировку');
  click(d.querySelector('#fleetBody tr'), 'открыть панель из таблицы');
  assert(cardType() === 'Вызывная панель', 'строка таблицы открывает карточку панели');

  console.log('— карточка панели —');
  openNode('#treeContainer .tree-node[data-type="panel"]', 'панель');
  assert(cardType() === 'Вызывная панель', 'карточка панели');
  assert(stats().includes('Где стоит'), 'показано место установки');
  assert(stats().includes('Кого вызывает'), 'показано, кого панель вызывает');
  assert(sections().includes('Панель принадлежит ЖК'), 'указана принадлежность ЖК');
  assert(count('[data-list-body="pflats"] .list-item') > 0, 'связанные квартиры показаны');
  assert(!d.querySelector('[data-meta="realm"]'), 'realm в карточке не правится');
  const uri = Array.from(d.querySelectorAll('#cardSections .form-input')).map(i => i.value).find(v => v.startsWith('sip:'));
  assert(!!uri && uri.includes('@integrator-123'), 'показан итоговый SIP URI: ' + uri);

  change(d.querySelector('[data-meta="sipNumber"]'), '9001');
  assert(d.querySelector('[data-meta="sipNumber"]').value !== '9001', 'занятый SIP-номер не принят');
  change(d.querySelector('[data-meta="sipNumber"]'), '9999');
  assert(d.querySelector('[data-meta="sipNumber"]').value === '9999', 'свободный SIP-номер принят');
  const pwd = d.querySelector('[data-meta="password"]').value;
  click(d.querySelector('.section-action[data-action="regen-password"]'), 'regen');
  assert(pwd !== d.querySelector('[data-meta="password"]').value, 'пароль перегенерирован');

  console.log('— пикер квартир: весь ЖК, свой подъезд первым —');
  click(d.querySelector('.section-action[data-action="bind-flats"]'), 'bind-flats');
  const flatOpts = count('#bindPickList .modal-option');
  assert(flatOpts === 245, 'предложены квартиры обоих домов ЖК: ' + flatOpts);
  const checked = count('#bindPickList input:checked');
  assert(checked === 36, 'привязанные отмечены: ' + checked);
  const firstOptSub = d.querySelector('#bindPickList .modal-option').dataset.subOff;
  assert(firstOptSub.includes('Подъезд 1'), 'первыми идут квартиры своего подъезда: ' + firstOptSub);
  assert(firstOptSub.includes('Юрловский проезд, 7А'), 'в подписи есть дом: ' + firstOptSub);
  click(d.querySelector('#bindPickFilter .modal-filter-btn[data-mode="unlinked"]'), 'filter');
  const shown = Array.from(d.querySelectorAll('#bindPickList .modal-option')).filter(o => o.style.display !== 'none').length;
  assert(shown === flatOpts - checked, 'фильтр «не привязанные»: ' + shown);
  click(d.querySelector('#bindPickFilter .modal-filter-btn[data-mode="all"]'), 'filter all');
  const firstUnchecked = Array.from(d.querySelectorAll('#bindPickList input')).find(i => !i.checked);
  firstUnchecked.checked = true;
  firstUnchecked.dispatchEvent(new w.Event('change', { bubbles: true }));
  click(d.getElementById('bindOk'), 'bindOk');
  assert(count('[data-list-body="pflats"] .list-item') === checked + 1, 'связка добавлена: ' + count('[data-list-body="pflats"] .list-item'));
  click(undoToast(), 'undo bind');
  assert(count('[data-list-body="pflats"] .list-item') === checked, 'отмена вернула прежний набор связок');

  console.log('— удаление панели: фиксация по таймеру —');
  click(d.querySelector('#treeContainer .tree-node[data-type="panel"] .btn-more'), 'btn-more');
  const dd = d.querySelector('.node-dropdown.open');
  assert(!!dd, 'контекстное меню открылось');
  assert(dd.textContent.includes('Управлять квартирами'), 'пункт привязки в меню панели');
  assert(dd.textContent.includes('Заблокировать учётную запись'), 'блокировка есть в меню');
  assert(!dd.textContent.includes('Включить регистрацию'), 'управлять регистрацией из меню нельзя');
  click(dd.querySelector('[data-action="delete-node"]'), 'delete panel');
  assert(panels() === 18, 'панель на месте, пока идёт отсчёт: ' + panels());
  assert(pending() === 1, 'панель помечена как удаляемая');
  await sleep(6800);
  assert(panels() === 17, 'после фиксации панель удалена: ' + panels());
  assert(entrances() === 14, 'подъезд без панелей ушёл из линзы оборудования: ' + entrances());
  assert(!undoToast(), 'после фиксации отмены не предлагается');
  assert(d.getElementById('toastStack').textContent.includes('Kamailio'),
    'в сообщении сказано, что subscriber удалён в Kamailio');

  console.log('— массовое выделение и отложенное удаление —');
  click(d.querySelector('.tree-tab[data-tab="addr"]'), 'lens addr');
  assert(groups() === 17, 'полки панелей вернулись: ' + groups());
  const selCount = selectable();
  assert(selCount === 1077, 'отмечать можно все адресные узлы: ' + selCount);
  click(d.getElementById('masterCheckbox'), 'master');
  assert(count('#treeContainer .tree-node.selected') === selCount, 'выделено всё: ' + count('#treeContainer .tree-node.selected'));
  assert(d.getElementById('deleteWrapper').classList.contains('visible'), 'кнопка удаления появилась');
  click(d.getElementById('masterCheckbox'), 'master off');
  assert(count('#treeContainer .tree-node.selected') === 0, 'выделение снято');

  const k0 = d.querySelector('#treeContainer .tree-node[data-type="complex"]');
  click(k0.querySelector('.checkbox-custom'), 'checkbox ЖК');
  assert(k0.classList.contains('selected'), 'ЖК выделен');
  assert(count('#treeContainer .tree-node.selected') > 100, 'выделение ушло вглубь: ' + count('#treeContainer .tree-node.selected'));
  click(d.getElementById('deleteSelectedBtn'), 'delete selected');
  assert(complexes() === 4, 'ЖК на месте, пока идёт отсчёт: ' + complexes());
  assert(pending() === 1, 'в очереди на удаление верхний узел');
  assert(count('#treeContainer .tree-node.selected') === 0, 'выделение снято при постановке в очередь');
  click(undoToast(), 'cancel bulk');
  assert(pending() === 0 && complexes() === 4, 'отмена оставила всё как было');
  assert(flats() === 765 && accounts() === 768, 'квартиры и аккаунты не тронуты');

  console.log('— удаление ЖК, выбранного областью видимости —');
  change(scopeSelect, scopeSelect.options[2].value);
  assert(complexes() === 1 && flats() === 500, 'переключились на CityBay: ' + flats());
  const cityBayLi = d.querySelector('#treeContainer > .tree-node[data-type="complex"]');
  click(cityBayLi.querySelector('.btn-more'), 'btn-more CityBay');
  click(d.querySelector('.node-dropdown.open [data-action="delete-node"]'), 'delete CityBay');
  assert(lastToast().textContent.includes('учётн'),
    'в предупреждении названо число учётных записей: ' + lastToast().textContent);
  await sleep(6800);
  assert(scopeSelect.value === '', 'область видимости вернулась ко всем ЖК');
  assert(complexes() === 3 && flats() === 265, 'в дереве остались остальные ЖК: ' + complexes() + '/' + flats());
  assert(scopeSelect.options.length === 4, 'селектор ЖК обновился: ' + scopeSelect.options.length);

  console.log('— добавление адреса сверху вниз —');
  click(d.getElementById('addButton'), 'addButton');
  assert(d.getElementById('modalBody').textContent.includes('Страна одна — РФ'), 'сверху создаётся регион');
  d.getElementById('mName').value = 'Тверская область';
  click(d.getElementById('mOk'), 'mOk region');
  assert(regions() === 3 && cardType() === 'Регион', 'регион добавлен: ' + regions());

  let last = d.querySelector('#treeContainer > .tree-node:last-child');
  click(last.querySelector('.btn-more'), 'btn-more region');
  click(d.querySelector('.node-dropdown.open [data-action="add-child"]'), 'add city');
  assert(d.getElementById('modalTitle').textContent.includes('город'), 'предложено создать город: ' + d.getElementById('modalTitle').textContent);
  d.getElementById('mName').value = 'село Медное';
  click(d.getElementById('mOk'), 'mOk city');
  assert(cardType() === 'Населённый пункт', 'создан населённый пункт');

  click(d.querySelector('.section-action[data-action="add-child"]'), 'add complex');
  assert(d.getElementById('modalBody').textContent.includes('ЖК — арендатор'), 'в ЖК объяснено, что это арендатор');
  d.getElementById('mName').value = 'Тестовый';
  click(d.getElementById('mOk'), 'mOk complex');
  assert(cardType() === 'Жилой комплекс' && complexes() === 4, 'ЖК создан внутри города: ' + complexes());
  assert(d.querySelector('[data-meta="status"]').value === 'Демо', 'новый ЖК заводится демо-подпиской');
  assert(!!d.querySelector('[data-meta="until"]').value, 'у демо-подписки есть срок');
  assert(scopeSelect.options.length === 5, 'новый ЖК попал в селектор: ' + scopeSelect.options.length);
  assert(Array.from(scopeSelect.options).some(o => o.textContent === 'село Медное › Тестовый'),
    'в подписи ЖК стоит его село: ' + Array.from(scopeSelect.options).map(o => o.textContent).join(' | '));

  change(d.getElementById('cardName'), 'Переименованный');
  assert(Array.from(scopeSelect.options).some(o => o.textContent === 'село Медное › Переименованный'),
    'имя обновилось в селекторе ЖК');

  click(d.querySelector('.section-action[data-action="add-child"]'), 'add house');
  assert(d.getElementById('mName').value === 'Корпус 1', 'предложено имя дома: ' + d.getElementById('mName').value);
  click(d.getElementById('mOk'), 'mOk house');
  assert(cardType() === 'Дом', 'создан дом');
  click(d.querySelector('.section-action[data-action="add-child"]'), 'add entrance');
  assert(d.getElementById('mName').value === 'Подъезд 1', 'предложено имя подъезда: ' + d.getElementById('mName').value);
  click(d.getElementById('mOk'), 'mOk entrance');
  assert(cardType() === 'Подъезд', 'создан подъезд');

  console.log('— добавление панели —');
  click(d.querySelector('.tree-tab[data-tab="equip"]'), 'lens equip');
  const panelsBefore = panels();
  click(d.getElementById('addButton'), 'addButton panel');
  assert(d.getElementById('pName').value === 'Калитка 2', 'имя предложено по уровню монтажа: ' + d.getElementById('pName').value);
  const place = d.getElementById('pPlace');
  assert(place.options[0].textContent.includes('вся территория'), 'первый вариант — территория ЖК: ' + place.options[0].textContent);
  assert(Array.from(place.options).some(o => o.textContent.includes('(весь дом)')), 'дом тоже уровень монтажа');
  assert(!!d.querySelector('#modalBody .combo-trigger'), 'списки в модалке тоже свои');
  click(place.nextElementSibling, 'открыть список мест');
  const placeMenu = d.querySelector('.combo-menu');
  assert(placeMenu.querySelectorAll('.combo-option').length === place.options.length, 'в списке все места установки');
  click(placeMenu.querySelectorAll('.combo-option')[1], 'выбрать место из списка');
  assert(place.selectedIndex === 1, 'выбор из списка попал в select');
  change(place, place.options[1].value);
  assert(d.getElementById('pName').value.includes('входная группа'),
    'для дома предложена входная группа: ' + d.getElementById('pName').value);
  d.getElementById('pName').value = 'Тестовая панель';
  d.getElementById('pSip').value = '9001';
  click(d.getElementById('pOk'), 'pOk с занятым номером');
  assert(d.getElementById('pErr').classList.contains('visible'), 'занятый номер не даёт создать панель');
  d.getElementById('pSip').value = '9200';
  click(d.getElementById('pOk'), 'pOk');
  assert(cardType() === 'Вызывная панель', 'панель создана');
  assert(panels() === panelsBefore + 1, 'панелей стало больше: ' + panels());

  console.log('— провижининг —');
  click(d.querySelector('.tree-tab[data-tab="addr"]'), 'lens addr');
  const subs = panels() + accounts();
  click(d.getElementById('provisionBtn'), 'provision');
  const text = d.getElementById('provCommands').value;
  const creates = text.split('POST http://kamailio:8080/api/subscriber/create').length - 1;
  const deletes = text.split('POST http://kamailio:8080/api/subscriber/delete').length - 1;
  assert(creates === subs - 1, 'команд создания по числу активных subscriber\'ов: ' + creates + ' из ' + subs);
  assert(deletes === 1, 'заблокированная учётка выгружается на удаление: ' + deletes);
  assert(d.getElementById('modalBody').textContent.includes('заблокировано'), 'в сводке отмечены заблокированные');
  click(d.querySelector('[data-modal-cancel]'), 'cancel');

  console.log('— лимиты и состояние подписки —');
  const otrLi = openNode('#treeContainer .tree-node[data-type="complex"]', 'ЖК Отрадное');
  const otrId = otrLi.dataset.id;
  // Дерево перестраивается после смены статуса, поэтому узел ищется заново по id
  const otrChip = () => d.querySelector('#treeContainer .tree-node[data-id="' + otrId + '"] > .node-content > .node-chip');
  assert(d.getElementById('cardName').value.includes('Отрадное'), 'выбран ЖК Отрадное: ' + d.getElementById('cardName').value);
  change(d.querySelector('[data-meta="status"]'), 'Приостановлена');
  assert(!!otrChip(), 'в дереве появился признак проблемной подписки');
  assert(scopeSelect.options[1].textContent.includes('приостановлена'),
    'в селекторе ЖК тоже видно: ' + scopeSelect.options[1].textContent);
  assert(sections().includes('Подписка приостановлена'), 'в карточке висит предупреждение');
  change(d.querySelector('[data-meta="status"]'), 'Активна');
  assert(!otrChip(), 'признак снят');

  change(d.querySelector('[data-meta="limitFlats"]'), '245');
  assert(sections().includes('Достигнут лимит квартир'), 'предупреждение о лимите');
  openNode('#treeContainer .tree-node[data-type="floor"]', 'этаж');
  click(d.querySelector('.section-action[data-action="add-child"]'), 'add flat');
  click(d.getElementById('mOk'), 'mOk сверх лимита');
  assert(d.getElementById('mErr').classList.contains('visible'), 'квартиру сверх лимита создать нельзя');
  assert(d.getElementById('mErr').textContent.includes('245'), 'в ошибке названы лимит и факт: ' + d.getElementById('mErr').textContent);
  click(d.querySelector('[data-modal-cancel]'), 'cancel');

  console.log('— сброс —');
  click(d.getElementById('resetBtn'), 'reset');
  click(d.getElementById('resetOk'), 'resetOk');
  assert(regions() === 2 && cities() === 3, 'после сброса вернулась вся иерархия адресов');
  assert(complexes() === 4 && houses() === 6, 'после сброса четыре ЖК и шесть домов: ' + complexes() + '/' + houses());
  assert(panels() === 18, 'после сброса 18 панелей: ' + panels());
  assert(accounts() === 767, 'после сброса 767 аккаунтов: ' + accounts());
  assert(groups() === 18, 'после сброса полки панелей на месте: ' + groups());
  assert(scopeSelect.options.length === 5, 'после сброса селектор ЖК из пяти пунктов');

  console.log('\nвсего за', Date.now() - t0, 'ms');
  if (errors.length) {
    console.log('\nПРОБЛЕМЫ (' + errors.length + '):');
    errors.forEach(e => console.log(' - ' + e));
    process.exit(1);
  }
  console.log('\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  process.exit(0);
})();
