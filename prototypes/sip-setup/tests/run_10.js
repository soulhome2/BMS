// Поведенческие проверки index_10.html — модель из
// «10 - Модель географии, помещений и панелей». Запуск как у run.js:
//   node run_10.js path/to/index_10.html
// (на Node 22 до 22.12 — с флагом --experimental-require-module)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const file = process.argv[2] || path.join(__dirname, '..', 'index_10.html');
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
const change = (el, v) => {
  if (!el) { fail('нет поля для изменения: ' + v); return; }
  el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true }));
};
const visible = (sel) => Array.from(d.querySelectorAll(sel)).filter(n => !n.classList.contains('hidden'));
const count = (sel) => d.querySelectorAll(sel).length;
const nodes = () => count('#treeContainer .tree-node');
const byType = (t) => count('#treeContainer .tree-node[data-type="' + t + '"]');
const groups = () => count('#treeContainer .tree-group');
const selectable = () => count('#treeContainer .tree-node[data-selectable="1"]');
const fleetRows = () => count('#fleetBody tr');
const pending = () => count('#treeContainer .tree-node.pending-delete');
const undoToast = () => {
  const all = d.querySelectorAll('#toastStack .toast:not([data-closing]) .toast-action');
  return all[all.length - 1] || null;
};
const lastToast = () => {
  const all = d.querySelectorAll('#toastStack .toast:not([data-closing])');
  return all[all.length - 1] || { textContent: '' };
};
const cardType = () => d.getElementById('cardType').textContent;
const cardTitle = () => {
  const input = d.getElementById('cardName');
  return input.classList.contains('hidden') ? d.getElementById('cardStaticName').textContent : input.value;
};
const status = () => d.getElementById('treeStatus').textContent;
const sections = () => d.getElementById('cardSections').textContent;
const stats = () => d.getElementById('cardStats').textContent;
const crumbs = () => d.getElementById('cardBreadcrumb').textContent;
const modalVisible = () => d.getElementById('modalOverlay').classList.contains('visible');
const modalText = () => d.getElementById('modalBody').textContent;
const meta = (key) => d.querySelector('#cardSections [data-meta="' + key + '"]');
const action = (a) => d.querySelector('#cardSections [data-action="' + a + '"]');
const listItems = (key) => count('[data-list-body="' + key + '"] .list-item');
const listNames = (key) => Array.from(d.querySelectorAll('[data-list-body="' + key + '"] .list-item .name')).map(x => x.textContent);
const statValue = (label) => {
  const item = Array.from(d.querySelectorAll('#cardStats .stat-item')).find(s => s.querySelector('.label').textContent === label);
  return item ? item.querySelector('.value').textContent : null;
};
const nodeText = (li) => li.querySelector(':scope > .node-content > .node-text').textContent;
const tip = (li) => li.querySelector(':scope > .node-content').title;
const liByName = (t, name, test) => Array.from(d.querySelectorAll('#treeContainer .tree-node[data-type="' + t + '"]'))
  .find(li => nodeText(li) === name && (!test || test(li))) || null;
const openByName = (t, name, test) => {
  const li = liByName(t, name, test);
  if (!li) { fail('нет узла ' + t + ' «' + name + '»'); return null; }
  click(li.querySelector(':scope > .node-content'), name);
  return li;
};
const within = (text) => (li) => tip(li).includes(text);
// Узел внутри ветки: у подъездов и помещений в подсказке нет адреса,
// поэтому принадлежность ищется по предкам в дереве
const inside = (text) => (li) => {
  let p = li.parentElement && li.parentElement.closest('.tree-node');
  while (p) {
    if (p.dataset.id && nodeText(p).includes(text)) return true;
    p = p.parentElement && p.parentElement.closest('.tree-node');
  }
  return false;
};
const kidNames = (li, t) => li
  ? Array.from(li.querySelectorAll(':scope > ul > .tree-node[data-type="' + t + '"]')).map(nodeText)
  : [];
const hasChip = (li, kind) => !!(li && li.querySelector(':scope > .node-content > .node-chip.' + kind));
const menu = (li, act) => {
  click(li && li.querySelector(':scope > .node-content .btn-more'), 'меню');
  const item = d.querySelector('.node-dropdown.open [data-action="' + act + '"]');
  if (!item) { fail('в меню нет действия ' + act); return; }
  click(item, act);
};
const pickOption = (selectId, test) => {
  const sel = d.getElementById(selectId);
  const opt = Array.from(sel.options).find(o => test(o.textContent));
  if (!opt) { fail('нет варианта в ' + selectId); return null; }
  change(sel, opt.value);
  return opt;
};
const cancelModal = () => click(d.querySelector('[data-modal-cancel]'), 'cancel');
const RP = inside('дом 14, корп. 2');

(async function main() {
  const t0 = Date.now();
  const search = d.getElementById('searchInput');
  const scopeSelect = d.getElementById('scopeSelect');

  console.log('— стартовое состояние —');
  assert(nodes() === 2001, 'адресное дерево отрисовано: ' + nodes() + ' узлов (1980 узлов + 21 полка панелей)');
  assert(byType('country') === 2 && byType('addr') === 19, 'две страны и 19 элементов адреса: ' + byType('country') + '/' + byType('addr'));
  assert(byType('object') === 0, 'объекты обслуживания в адресное дерево не входят');
  assert(count('.tree-tab') === 2, 'вкладок две — «Адреса» и «Оборудование»: список объектов — переключатель в шапке');
  assert(byType('house') === 9 && byType('entrance') === 16, 'девять домов и 16 подъездов');
  assert(byType('premise') === 814 && byType('account') === 805, 'помещений 814, аккаунтов 805: ' + byType('premise') + '/' + byType('account'));
  assert(byType('panel') === 21, 'в адресах 21 панель — панели территории живут на объектах: ' + byType('panel'));
  assert(cardType() === 'Страна · профиль RU' && cardTitle() === 'Россия', 'сверху дерева страна — адресный корень: ' + cardType());
  assert(status().includes('7 объектов') && status().includes('814 помещений') && status().includes('26 панелей'),
    'статус-бар считает объекты, помещения и все панели: ' + status());

  console.log('— профиль страны: данные, а не код —');
  assert(sections().includes('Профиль страны · RU'), 'в карточке страны показан профиль');
  assert(sections().includes('ГАР · ключ: ГУИД ГАР'), 'реестр и ключ из профиля');
  assert(sections().includes('Виды адреса по порядку') && sections().includes('только навигация'),
    'виды адреса с признаком «печатается / только навигация»');
  assert(sections().includes('Машиноместо') && sections().includes('нежилое'), 'справочник типов помещений с признаком «жилое»');
  assert(sections().includes('Этажная дверь'), 'справочник типов панелей тоже в профиле');
  change(d.getElementById('newTypeName'), 'Колясочная');
  d.getElementById('newTypeName').value = 'Колясочная';
  click(action('add-premise-type'), 'добавить тип');
  assert(sections().includes('Колясочная') && sections().includes('добавлен установкой'), 'свой тип установки дописан к базовым');
  d.getElementById('newTypeName').value = 'машиноместо';
  click(action('add-premise-type'), 'дубль типа');
  assert(lastToast().textContent.includes('уже есть'), 'дубль базового типа не принят: ' + lastToast().textContent);

  console.log('— элементы адреса: один тип узла, вид из профиля —');
  openByName('addr', 'Москва');
  assert(cardType() === 'Субъект РФ', 'у элемента адреса в шапке его вид: ' + cardType());
  assert(listItems('addrs') === 3, 'в Москве три муниципальных округа, без административных уровней: ' + listItems('addrs'));
  openByName('addr', 'Раменки');
  assert(cardType().startsWith('Муниципальный округ'), 'Раменки — муниципальный округ: ' + cardType());
  assert(meta('atd').value === 'ЗАО', 'административный округ — метка на узле, а не уровень: ' + meta('atd').value);
  assert(sections().includes('только навигация'), 'муниципальный округ в адресную строку не печатается');
  assert(!!meta('ref').value, 'у элемента адреса своя ссылка на ГАР');
  const kindOptions = Array.from(meta('kind').options).map(o => o.textContent);
  assert(!kindOptions.includes('Субъект РФ') && kindOptions.includes('Город'),
    'вид ограничен порядком: не выше родителя: ' + kindOptions.join(', '));
  type(search, 'ЗАО');
  const shownAddr = visible('#treeContainer .tree-node[data-type="addr"]').map(nodeText);
  assert(shownAddr.includes('Раменки') && !shownAddr.includes('Отрадное'), 'по метке АТД находится узел: ' + shownAddr.join(', '));
  click(d.getElementById('searchClear'), 'searchClear');

  openByName('addr', 'Москва');
  click(action('add-addr'), 'добавить элемент адреса в Москву');
  pickOption('mKind', t => t.startsWith('Муниципальный округ'));
  d.getElementById('mName').value = 'Раменки';
  click(d.getElementById('mOk'), 'дубль Раменки');
  assert(d.getElementById('mErr').textContent.includes('уже есть'), 'пара «вид + имя» уникальна в родителе: ' + d.getElementById('mErr').textContent);
  d.getElementById('mName').value = 'Москва';
  click(d.getElementById('mOk'), 'Москва в Москве');
  assert(d.getElementById('mErr').textContent.includes('совпадает с родителем'), 'Москва → Москва не заводится: ' + d.getElementById('mErr').textContent);
  d.getElementById('mName').value = 'Хорошёво-Мнёвники';
  click(d.getElementById('mOk'), 'новый округ');
  assert(!modalVisible() && cardType().startsWith('Муниципальный округ') && byType('addr') === 20, 'новый элемент адреса создан');
  assert(!d.querySelector('#cardSections [data-meta="ref"]').value && sections().includes('нет в реестре'),
    'без ГУИД узел помечен «нет в реестре»');
  assert(!!d.querySelector('#treeContainer .tree-node.active .node-chip.reg'), 'и в дереве у него чип «нет в реестре»');

  console.log('— дом: номер из полей, адрес по шаблону, объект по ссылке —');
  openByName('house', 'дом 14, корп. 2');
  assert(cardType() === 'Дом' && cardTitle() === 'дом 14, корп. 2', 'карточка дома: ' + cardTitle());
  assert(d.getElementById('cardName').classList.contains('hidden'), 'имя дома вручную не правится — оно из полей');
  assert(meta('num').value === '14' && meta('korpus').value === '2', 'номер и корпус — раздельные поля');
  assert(sections().includes('Москва, Мичуринский проспект, дом 14, корп. 2'),
    'адрес для печати без муниципального округа: Москва, Мичуринский проспект, дом 14, корп. 2');
  assert(crumbs().includes('Россия') && crumbs().includes('Раменки') && crumbs().includes('Раменки-парк'),
    'в крошках весь адрес и объект обслуживания: ' + crumbs());
  assert(listNames('hfloors').includes('Этаж −1'), 'паркинг −1 — этаж прямо в доме, вне подъезда');
  click(Array.from(d.querySelectorAll('#cardSections .crumb-link')).find(a => a.textContent === 'Раменки-парк'), 'ссылка на объект');
  assert(cardType() === 'Объект обслуживания' && d.querySelector('.tree-tab.active').dataset.tab === 'addr',
    'объект открывается карточкой, вкладка «Адреса» остаётся');
  openByName('house', 'дом 14, корп. 2');
  change(meta('stroenie'), '3');
  assert(cardTitle() === 'дом 14, корп. 2, стр. 3', 'имя дома пересобралось из полей: ' + cardTitle());
  change(meta('stroenie'), '');
  change(meta('num'), '');
  assert(meta('num').value === '14' && lastToast().textContent.includes('обязательно'), 'номер дома обязателен');

  console.log('— этажи: уровень — число, −1 ниже входа —');
  const floorOrder = kidNames(liByName('entrance', 'Подъезд 1', RP), 'floor');
  assert(floorOrder[0] === 'Этаж 1' && floorOrder[8] === 'Этаж 9', 'этажи идут по уровню: ' + floorOrder.join(', '));
  openByName('house', 'дом 14, корп. 2');
  click(action('add-floor'), 'этаж в дом');
  d.getElementById('mLevel').value = '-1';
  click(d.getElementById('mOk'), 'дубль −1');
  assert(d.getElementById('mErr').textContent.includes('уже есть'), 'уровень −1 без названия уже занят');
  d.getElementById('mLevel').value = '-2';
  click(d.getElementById('mOk'), 'этаж −2');
  assert(cardTitle() === 'Этаж −2', 'создан этаж −2: ' + cardTitle());
  const direct = kidNames(liByName('house', 'дом 14, корп. 2'), 'floor');
  assert(direct.join(',') === 'Этаж −2,Этаж −1', '−2 стоит ниже −1, а не после: ' + direct.join(','));
  openByName('floor', 'Этаж 5', RP);
  click(action('add-premise'), 'помещение');
  cancelModal();
  change(meta('title'), 'Этаж 5А');
  assert(cardTitle() === 'Этаж 5А', 'название этажа заменяет «Этаж N»');
  change(meta('title'), '');
  openByName('entrance', 'Подъезд 1', RP);
  click(action('add-floor'), 'этаж в подъезд');
  d.getElementById('mLevel').value = '5';
  d.getElementById('mTitle').value = 'мезонин';
  click(d.getElementById('mOk'), 'мезонин');
  assert(cardTitle() === 'мезонин' && !modalVisible(), 'пара «уровень + название» пускает мезонин на уровень 5');

  console.log('— помещения: тип, номер-строка, код вызова —');
  openByName('premise', 'Машиноместо 118');
  assert(cardType() === 'Помещение' && meta('ptype').value === 'parking', 'тип помещения из справочника');
  assert(meta('callCode').value === '118' && sections().includes('нежилое'), 'у машиноместа код 118, оно нежилое');
  openByName('premise', 'Кладовая 7');
  assert(meta('callCode').value === '207', 'у кладовой 7 код 207: цифры номера заняты квартирой 7');
  change(meta('ptype'), 'flat');
  assert(meta('ptype').value === 'storage' && lastToast().textContent.includes('Квартира 7'),
    'кладовая 7 не станет второй квартирой 7: ' + lastToast().textContent);
  openByName('premise', 'Машиноместо 118');
  change(meta('number'), '119');
  assert(meta('number').value === '118', 'второе машиноместо 119 в доме не заводится');
  change(meta('callCode'), '20');
  assert(meta('callCode').value === '118' && lastToast().textContent.includes('Квартира 20'),
    'код 20 занят квартирой 20 на тех же панелях: ' + lastToast().textContent);
  change(meta('callCode'), '12a');
  assert(lastToast().textContent.includes('целое число'), 'код вызова — только цифры');
  assert(statValue('Вызывают панелей') === '4', 'машиноместо вызывают въезд, калитка, входная группа и дверь подъезда: ' + statValue('Вызывают панелей'));
  assert(sections().includes('добавлено вручную'), 'видно, что дверь подъезда вызывает его по исключению');

  console.log('— зона обслуживания и исключения —');
  openByName('panel', 'Дверь: Подъезд 1', RP);
  assert(cardType() === 'Вызывная панель', 'карточка двери подъезда');
  assert(meta('zoneId').selectedOptions[0].textContent === 'Подъезд: Подъезд 1', 'зона — подъезд: ' + meta('zoneId').selectedOptions[0].textContent);
  assert(statValue('Кого вызывает') === '34', 'подъезд (34) минус кв. 14 плюс м/м 118 = 34: ' + statValue('Кого вызывает'));
  assert(listItems('pexc') === 2, 'два исключения: ' + listItems('pexc'));
  assert(sections().includes('исключено') && sections().includes('добавлено'), 'виден характер исключений');
  const exItem = Array.from(d.querySelectorAll('[data-list-body="pexc"] .list-item')).find(x => x.textContent.includes('Квартира 14'));
  click(exItem.querySelector('[data-act="drop-exception"]'), 'снять исключение кв. 14');
  assert(statValue('Кого вызывает') === '35', 'кв. 14 вернулась в зону: ' + statValue('Кого вызывает'));
  click(undoToast(), 'undo');
  assert(statValue('Кого вызывает') === '34' && listItems('pexc') === 2, 'отмена вернула исключение');

  openByName('premise', 'Квартира 13', RP);
  assert(statValue('Вызывают панелей') === '5', 'кв. 13 вызывают пять панелей: ' + statValue('Вызывают панелей'));
  const stop = Array.from(d.querySelectorAll('[data-list-body="fpanels"] .list-item')).find(x => x.textContent.includes('Дверь: Подъезд 1'));
  click(stop.querySelector('[data-act="stop-call"]'), 'снять вызов');
  assert(statValue('Вызывают панелей') === '4' && lastToast().textContent.includes('исключено из зоны'),
    'снятие вызова в зоне — это исключение: ' + lastToast().textContent);
  click(undoToast(), 'undo stop');
  assert(statValue('Вызывают панелей') === '5', 'отмена вернула вызов');

  console.log('— новое помещение попадает в зону само —');
  openByName('floor', 'Этаж 9', RP);
  click(action('add-premise'), 'помещение на 9');
  assert(d.getElementById('mNumber').value === '33' && d.getElementById('mCode').value === '33',
    'номер и код предложены следующими: ' + d.getElementById('mNumber').value + '/' + d.getElementById('mCode').value);
  d.getElementById('mCode').value = '1';
  click(d.getElementById('mOk'), 'код 1');
  assert(d.getElementById('mErr').textContent.includes('Квартира 1'), 'код 1 занят: ' + d.getElementById('mErr').textContent);
  d.getElementById('mCode').value = '33';
  click(d.getElementById('mOk'), 'создать кв. 33');
  assert(cardTitle() === 'Квартира 33', 'квартира 33 создана');
  assert(statValue('Вызывают панелей') === '4',
    'её сразу вызывают въезд, калитка, входная группа и дверь подъезда: ' + statValue('Вызывают панелей'));
  openByName('panel', 'Дверь: Подъезд 1', RP);
  assert(statValue('Кого вызывает') === '35', 'дверь подъезда вызывает и новую квартиру: ' + statValue('Кого вызывает'));

  console.log('— смена зоны снимает ненужные исключения —');
  const zoneSel = meta('zoneId');
  const houseZone = Array.from(zoneSel.options).find(o => o.textContent.startsWith('Дом:'));
  change(zoneSel, houseZone.value);
  assert(lastToast().textContent.includes('снято ненужных исключений: 1'), 'м/м 118 теперь в зоне — добавление снято: ' + lastToast().textContent);
  assert(listItems('pexc') === 1, 'осталось исключение кв. 14');
  assert(statValue('Кого вызывает') === '44', 'весь дом (45) минус кв. 14: ' + statValue('Кого вызывает'));
  change(meta('zoneId'), meta('zoneId').querySelector('option').value);
  assert(meta('zoneId').selectedOptions[0].textContent.startsWith('Весь объект'), 'зону можно расширить до объекта');

  console.log('— пикеры: отметки — желаемый вызов, исключения выводятся —');
  click(action('bind-flats'), 'bind-flats');
  const opts = count('#bindPickList .modal-option');
  const checkedBefore = count('#bindPickList input:checked');
  assert(opts === 45 && checkedBefore === 44, 'все помещения объекта, отмечены вызываемые: ' + checkedBefore + ' из ' + opts);
  assert(modalText().includes('весь объект'), 'в подсказке названа зона');
  const kv14 = Array.from(d.querySelectorAll('#bindPickList .modal-option')).find(o => o.querySelector('.opt-name').textContent === 'Квартира 14');
  kv14.querySelector('input').checked = true;
  kv14.querySelector('input').dispatchEvent(new w.Event('change', { bubbles: true }));
  click(d.getElementById('bindOk'), 'save');
  assert(statValue('Кого вызывает') === '45' && listItems('pexc') === 0, 'отметка в зоне сняла исключение');
  click(undoToast(), 'undo');
  assert(listItems('pexc') === 1, 'отмена вернула исключение');

  openByName('premise', 'Квартира 111');
  click(action('bind-panels'), 'bind-panels');
  assert(count('#bindPickList .modal-option') === 10, 'предложены все панели объекта «Отрадное»: ' + count('#bindPickList .modal-option'));
  assert(count('#bindPickList input:checked') === 2, 'вызывают две: дверь подъезда и въезд');
  const firstSub = d.querySelector('#bindPickList .modal-option').dataset.subOff;
  assert(firstSub.startsWith('в зоне'), 'первыми идут панели, в зону которых помещение входит: ' + firstSub);
  const outOpt = Array.from(d.querySelectorAll('#bindPickList .modal-option')).find(o => !o.querySelector('input').checked);
  outOpt.querySelector('input').checked = true;
  outOpt.querySelector('input').dispatchEvent(new w.Event('change', { bubbles: true }));
  click(d.getElementById('bindOk'), 'save');
  assert(statValue('Вызывают панелей') === '3' && sections().includes('добавлено вручную'), 'отметка вне зоны стала добавлением');
  click(undoToast(), 'undo');
  assert(statValue('Вызывают панелей') === '2', 'отмена убрала добавление');

  console.log('— аккаунты, пароли, регистрация, блокировка —');
  assert(listItems('acc') === 2, 'в кв. 111 два аккаунта');
  const pwdSpan = d.querySelector('[data-list-body="acc"] .pwd');
  assert(pwdSpan.textContent === '••••••••', 'пароль замаскирован');
  click(d.querySelector('[data-list-body="acc"] .item-action[data-act="reveal-pwd"]'), 'reveal');
  assert(d.querySelector('[data-list-body="acc"] .pwd').textContent.length > 3, 'по кнопке пароль открылся');
  click(action('add-account'), 'add-account');
  d.getElementById('aEmail').value = 'ivanov@mail.ru';
  click(d.getElementById('aOk'), 'дубль email');
  assert(d.getElementById('aErr').textContent.toLowerCase().includes('в этом помещении'), 'email уникален внутри помещения: ' + d.getElementById('aErr').textContent);
  d.getElementById('aEmail').value = 'petrova@mail.ru';
  d.getElementById('aSip').value = '9001';
  click(d.getElementById('aOk'), 'занятый SIP');
  assert(d.getElementById('aErr').textContent.includes('занят'), 'SIP-номер уникален в установке');
  d.getElementById('aSip').value = '5900';
  click(d.getElementById('aOk'), 'aOk');
  assert(cardType() === 'SIP-аккаунт' && byType('account') === 806, 'аккаунт создан: ' + byType('account'));
  assert(statValue('Помещений у жильца') === '3', 'у Петровой три помещения: ' + statValue('Помещений у жильца'));
  click(d.querySelector('.readout-btn[data-action="check-status"]'), 'check-status');
  assert(d.querySelector('.form-readout .readout-sub').textContent.includes('опрошено'), 'опрос статуса отмечает время');
  click(d.querySelector('.form-toggle[data-action="toggle-blocked"]'), 'block');
  assert(stats().includes('Заблокирована'), 'учётка заблокирована — проверим выгрузку');

  console.log('— собственник нескольких помещений —');
  click(Array.from(d.querySelectorAll('#treeContainer .tree-node[data-type="account"] .node-text'))
    .find(el => el.textContent === 'ivanov@mail.ru'), 'аккаунт Иванова');
  assert(listItems('owner') === 3, 'у Иванова ещё три помещения — другой дом, объект и субъект: ' + listItems('owner'));
  const ownerSubs = Array.from(d.querySelectorAll('[data-list-body="owner"] .list-item .sub')).map(x => x.textContent);
  assert(ownerSubs.some(s => s.includes('дом 7Б')) && ownerSubs.some(s => s.includes('улица Молодёжная')),
    'в списке видно, где они: ' + ownerSubs.join(' | '));

  console.log('— частный дом: объект вместе с домом, этаж свёрнут —');
  assert(kidNames(liByName('house', 'дом 12'), 'premise').length === 1 && !kidNames(liByName('house', 'дом 12'), 'floor').length,
    'единственный этаж частного дома в дереве свёрнут');
  assert(hasChip(liByName('house', 'дом 12'), 'reg'), 'новый дом ещё не в ГАР');
  openByName('house', 'дом 12');
  assert(sections().includes('объект равен этому дому'), 'объект одиночного дома равен ему');
  openByName('addr', 'улица Садовая');
  click(action('add-house'), 'новый дом');
  d.getElementById('hp-num').value = '12';
  click(d.getElementById('mOk'), 'дубль дома');
  assert(d.getElementById('mErr').textContent.includes('уже есть'), 'второй «дом 12» на улице не заводится');
  d.getElementById('hp-num').value = '14';
  click(d.getElementById('mOk'), 'дом 14');
  assert(cardTitle() === 'дом 14' && lastToast().textContent.includes('объект обслуживания создан вместе с ним'),
    'дом создан, объект — вместе с ним: ' + lastToast().textContent);
  assert(scopeSelect.options.length === 9, 'новый объект в переключателе: ' + scopeSelect.options.length);
  click(action('add-premise'), 'помещение прямо в дом');
  assert(modalText().includes('создастся сам'), 'сказано, что этаж входа создастся сам');
  pickOption('mType', t => t.startsWith('Жилое помещение'));
  click(d.getElementById('mOk'), 'создать');
  assert(lastToast().textContent.includes('вместе с этажом «Этаж 1»'), 'этаж входа создан автоматически: ' + lastToast().textContent);
  assert(!kidNames(liByName('house', 'дом 14', inside('улица Садовая')), 'floor').length, 'и свёрнут в дереве');
  const floorCrumb = Array.from(d.querySelectorAll('#cardBreadcrumb .crumb-link')).find(a => a.textContent === 'Этаж 1');
  click(floorCrumb, 'в свёрнутый этаж по крошкам');
  assert(cardType() === 'Этаж' && sections().includes('в дереве он свёрнут'), 'карточка этажа объясняет свёртку');
  click(action('add-panel'), 'панель на этаж');
  assert(d.getElementById('pType').value === 'floorDoor', 'для этажа предложена этажная дверь');
  assert(d.getElementById('pLevel').disabled && d.getElementById('pLevel').value === '1', 'уровень панели на этаже — по этажу');
  d.getElementById('pSip').value = '9401';
  click(d.getElementById('pOk'), 'создать панель');
  assert(kidNames(liByName('house', 'дом 14', inside('улица Садовая')), 'floor').length === 1,
    'у этажа появилась панель — строка этажа вернулась');

  console.log('— объект уходит вместе с последним домом —');
  menu(liByName('house', 'дом 14', inside('улица Садовая')), 'delete-node');
  assert(lastToast().textContent.includes('уйдёт вместе с последним домом'), 'предупреждение об объекте: ' + lastToast().textContent);
  await sleep(6800);
  assert(scopeSelect.options.length === 8, 'объект закрыт вместе с домом: ' + scopeSelect.options.length);
  assert(lastToast().textContent.includes('закрыт'), 'тост говорит, что объект закрыт');

  console.log('— объекты обслуживания в линзе «Оборудование» —');
  click(d.querySelector('.tree-tab[data-tab="equip"]'), 'lens equip');
  assert(byType('object') === 7 && byType('country') === 0, 'в оборудовании верхний уровень — объекты, а не адреса');
  assert(byType('house') === 8,
    'под объектами дома с панелями; у частного дома панель только на участке — строки дома нет: ' + byType('house'));
  const cbHouses = kidNames(liByName('object', 'CityBay (Сити Бэй)'), 'house');
  assert(cbHouses.some(h => h.startsWith('Волоколамское шоссе')) && cbHouses.some(h => h.startsWith('Строительный проезд')),
    'корпуса одного ЖК на разных улицах: ' + cbHouses.join(' | '));
  assert(hasChip(liByName('object', 'CityBay (Сити Бэй)'), 'sub'), 'просроченная подписка видна чипом');
  assert(kidNames(liByName('object', 'CityBay (Сити Бэй)'), 'panel').includes('Главный въезд (Сити Бэй)'),
    'панель территории стоит прямо под объектом');
  openByName('object', 'Раменки-парк');
  assert(cardType() === 'Объект обслуживания', 'карточка объекта');
  assert(meta('server').value === 'sip-test1.axxoncloud.com', 'сервер Kamailio — поле объекта');
  assert(sections().includes('Договор и лимиты') && meta('contract').value === 'Д-2026/231', 'договор живёт на объекте');
  assert(listItems('opanels') === 2, 'на территории въезд и калитка подземного въезда');
  const gateSub = Array.from(d.querySelectorAll('[data-list-body="opanels"] .list-item .sub')).map(x => x.textContent);
  assert(gateSub.some(s => s.includes('уровень −1') && s.includes('весь объект')), 'калитка на −1 вызывает весь объект: ' + gateSub.join(' | '));
  assert(!d.querySelector('#treeContainer .tree-node[data-type="object"] > .node-content > .checkbox-custom'),
    'объект не выделяется и отдельно не удаляется');

  console.log('— область видимости: объект обслуживания —');
  assert(scopeSelect.options[1].textContent === 'Москва › Отрадное', 'в подписи объекта — населённый пункт: ' + scopeSelect.options[1].textContent);
  change(scopeSelect, scopeSelect.options[1].value);
  assert(byType('object') === 1 && byType('house') === 2, 'один объект и два его дома');
  assert(cardType() === 'Объект обслуживания' && cardTitle() === 'Отрадное', 'открылась карточка объекта');
  click(d.querySelector('.tree-tab[data-tab="addr"]'), 'lens addr');
  assert(byType('country') === 1 && byType('addr') === 3 && byType('house') === 2,
    'адресное дерево — только пути к домам объекта: ' + byType('addr'));
  assert(byType('premise') === 245 && byType('account') === 248,
    'помещения и аккаунты своего объекта, с аккаунтом, заведённым выше: ' + byType('account'));
  assert(status().includes('Отрадное') && status().includes('подписка активна'), 'статус-бар назван по объекту: ' + status());
  click(d.getElementById('provisionBtn'), 'provision в границах объекта');
  const scopedCmds = d.getElementById('provCommands').value.split('subscriber/create').length - 1;
  assert(scopedCmds === 257, 'выгружены только subscriber\'ы объекта, с панелью въезда: ' + scopedCmds);
  cancelModal();
  change(scopeSelect, '');
  assert(byType('premise') === 815, 'возврат ко всем объектам: ' + byType('premise'));

  console.log('— слияние и разделение объектов —');
  click(d.querySelector('.tree-tab[data-tab="equip"]'), 'lens equip');
  openByName('object', 'Отрадное');
  click(action('merge'), 'merge');
  pickOption('mTarget', t => t.startsWith('CityBay'));
  assert(d.getElementById('mErr').textContent.includes('Разные серверы'), 'слияние с объектом другого сервера — миграция: ' + d.getElementById('mErr').textContent);
  assert(d.getElementById('mOk').disabled, 'кнопка слияния заблокирована');
  cancelModal();

  openByName('object', 'Ивановские дачи');
  click(action('merge'), 'merge дачи');
  pickOption('mTarget', t => t.startsWith('улица Садовая'));
  assert(d.getElementById('mErr').textContent.includes('одинаковые коды вызова'),
    'калитка частного дома получила бы два кода 1 — слияние заблокировано: ' + d.getElementById('mErr').textContent);
  cancelModal();

  openByName('object', 'Отрадное');
  const splitBtn = Array.from(d.querySelectorAll('[data-list-body="ohouses"] .list-item')).find(x => x.textContent.includes('7Б'))
    .querySelector('[data-act="split-house"]');
  click(splitBtn, 'вынести 7Б');
  assert(modalText().includes('потеряет 30 помещений'), 'предпросмотр: въезд теряет 30 помещений 7Б');
  click(d.getElementById('mOk'), 'вынести');
  assert(scopeSelect.options.length === 9 && lastToast().textContent.includes('отдельный объект'), 'дом 7Б стал отдельным объектом');
  openByName('object', 'Отрадное');
  assert(statValue('Домов') === '1', 'в «Отрадном» один дом');
  const gate = Array.from(d.querySelectorAll('[data-list-body="opanels"] .list-item'))[0];
  click(gate, 'въезд');
  assert(statValue('Кого вызывает') === '215', 'въезд вызывает только 7А: ' + statValue('Кого вызывает'));
  openByName('object', 'Отрадное');
  click(action('merge'), 'merge back');
  pickOption('mTarget', t => t.startsWith('Юрловский проезд, дом 7Б'));
  assert(!d.getElementById('mOk').disabled, 'тот же сервер и страна — слияние доступно');
  assert(d.getElementById('mPreview').textContent.includes('расширится на 30 помещений'), 'предпросмотр: зона въезда расширится');
  click(d.getElementById('mOk'), 'объединить');
  assert(scopeSelect.options.length === 8 && cardTitle() === 'Отрадное', 'объекты объединены обратно');
  assert(statValue('Домов') === '2' && meta('contract').value === 'Д-2026/114', 'договор «Отрадного» сохранился');
  click(Array.from(d.querySelectorAll('[data-list-body="opanels"] .list-item'))[0], 'въезд');
  assert(statValue('Кого вызывает') === '245', 'зона «весь объект» снова накрывает оба дома');

  console.log('— линза «Оборудование» и таблица парка —');
  click(d.querySelector('.tree-tab[data-tab="equip"]'), 'lens equip');
  assert(byType('panel') === 26 && byType('premise') === 1, 'все панели, из помещений — только офис с панелью у двери: ' + byType('panel') + '/' + byType('premise'));
  assert(groups() === 0 && !!d.querySelector('#treeContainer .tree-view-row'), 'полок нет, есть строка таблицы');
  click(d.querySelector('#treeContainer .tree-view-row'), 'таблица');
  assert(cardType() === 'Парк оборудования' && fleetRows() === 26, 'в таблице все панели: ' + fleetRows());
  click(d.querySelector('.fleet-filter-btn[data-mode="clash"]'), 'filter clash');
  assert(fleetRows() === 0, 'конфликтов кодов нет — интерфейс их не допускает');
  click(d.querySelector('.fleet-filter-btn[data-mode="all"]'), 'filter all');
  type(d.getElementById('fleetSearch'), 'Раменки-парк');
  assert(fleetRows() === 6, 'поиск по объекту: ' + fleetRows());
  type(d.getElementById('fleetSearch'), '');
  click(d.querySelector('.fleet-table th[data-sort="level"]'), 'sort level');
  assert(d.querySelector('#fleetBody tr td:nth-child(4)').textContent === '−1', 'сортировка по уровню: первой калитка на −1');
  click(d.querySelector('#fleetBody tr'), 'строка');
  assert(cardType() === 'Вызывная панель', 'строка открывает панель');

  console.log('— добавление панели: место, тип, уровень, зона —');
  click(d.getElementById('addButton'), 'addButton');
  const place = d.getElementById('pPlace');
  assert(Array.from(place.options).some(o => o.textContent.endsWith('(территория)')), 'местом может быть объект');
  assert(Array.from(place.options).some(o => / › Этаж 3$/.test(o.textContent)), 'и этаж');
  pickOption('pPlace', t => t.startsWith('Раменки-парк') && t.endsWith('(территория)'));
  assert(d.getElementById('pType').value === 'wicket', 'на объекте с въездом предложена калитка: ' + d.getElementById('pType').value);
  assert(!d.getElementById('pLevel').disabled && d.getElementById('pLevel').value === '1', 'уровень на объекте задаётся вручную, по умолчанию вход');
  pickOption('pPlace', t => t.startsWith('Раменки-парк › дом 14, корп. 2 › Подъезд 1 › Этаж 3'));
  assert(d.getElementById('pType').value === 'floorDoor' && d.getElementById('pLevel').value === '3', 'на этаже — этажная дверь и его уровень');
  assert(d.getElementById('pZone').selectedOptions[0].textContent === 'Этаж: Этаж 3', 'зона по умолчанию — место установки');
  assert(d.getElementById('pName').value === 'Этажная дверь: Этаж 3', 'имя от типа и места: ' + d.getElementById('pName').value);
  d.getElementById('pSip').value = '9001';
  click(d.getElementById('pOk'), 'занятый номер');
  assert(d.getElementById('pErr').classList.contains('visible'), 'занятый SIP-номер не даёт создать панель');
  d.getElementById('pSip').value = '9400';
  click(d.getElementById('pOk'), 'создать');
  assert(cardType() === 'Вызывная панель' && statValue('Уровень') === '3' && statValue('Кого вызывает') === '4',
    'панель на этаже вызывает этаж: ' + statValue('Кого вызывает'));

  console.log('— удаление панели: фиксация по таймеру —');
  const panelsBefore = byType('panel');
  menu(d.querySelector('#treeContainer .tree-node.active'), 'delete-node');
  assert(byType('panel') === panelsBefore && pending() === 1, 'панель на месте, пока идёт отсчёт');
  await sleep(6800);
  assert(byType('panel') === panelsBefore - 1, 'после фиксации панель удалена');
  assert(d.getElementById('toastStack').textContent.includes('Kamailio'), 'сказано, что subscriber удалён в Kamailio');

  console.log('— массовое выделение и отложенное удаление —');
  click(d.querySelector('.tree-tab[data-tab="addr"]'), 'lens addr');
  const selCount = selectable();
  assert(selCount > 1000, 'отмечать можно адресные узлы: ' + selCount);
  click(liByName('addr', 'Московская область').querySelector(':scope > .node-content > .checkbox-custom'), 'checkbox');
  click(d.getElementById('deleteSelectedBtn'), 'delete selected');
  assert(lastToast().textContent.includes('3 объекта уйдут вместе с последними домами'),
    'сказано, какие объекты уйдут с домами: ' + lastToast().textContent);
  click(undoToast(), 'cancel bulk');
  assert(pending() === 0 && byType('premise') === 815, 'отмена оставила всё как было');

  console.log('— провижининг по серверам —');
  const subs = byType('panel') + d.querySelectorAll('#treeContainer .tree-node[data-type="account"]').length + 5;
  click(d.getElementById('provisionBtn'), 'provision');
  const text = d.getElementById('provCommands').value;
  const creates = text.split('/api/subscriber/create').length - 1;
  const deletes = text.split('/api/subscriber/delete').length - 1;
  assert(creates + deletes === subs, 'команд по числу subscriber\'ов (с панелями территории): ' + (creates + deletes) + ' из ' + subs);
  assert(deletes === 1, 'заблокированная учётка выгружается на удаление');
  assert(text.includes('# ===== Сервер sip-test2.axxoncloud.com') && text.includes('http://sip-uk-1.axxoncloud.com:8080'),
    'команды сгруппированы по серверам объектов');
  assert(modalText().includes('серверов: 3'), 'в сводке три сервера');
  cancelModal();

  console.log('— лимиты и подписка на объекте —');
  click(d.querySelector('.tree-tab[data-tab="equip"]'), 'lens equip');
  const otrId = openByName('object', 'Отрадное').dataset.id;
  change(meta('status'), 'Приостановлена');
  assert(!!d.querySelector('#treeContainer .tree-node[data-id="' + otrId + '"] > .node-content > .node-chip.sub'), 'признак подписки в дереве');
  assert(scopeSelect.options[1].textContent.includes('приостановлена'), 'и в переключателе: ' + scopeSelect.options[1].textContent);
  change(meta('status'), 'Активна');
  change(meta('limitPremises'), '245');
  assert(sections().includes('Достигнут лимит помещений'), 'предупреждение о лимите помещений');
  click(d.querySelector('.tree-tab[data-tab="addr"]'), 'lens addr');
  openByName('floor', 'Этаж 1', inside('дом 7А'));
  click(action('add-premise'), 'сверх лимита');
  click(d.getElementById('mOk'), 'mOk');
  assert(d.getElementById('mErr').textContent.includes('доступно 245'), 'помещение сверх лимита не создаётся: ' + d.getElementById('mErr').textContent);
  cancelModal();

  console.log('— та же модель за рубежом —');
  click(d.querySelector('.tree-tab[data-tab="addr"]'), 'lens addr');
  openByName('country', 'United Kingdom');
  assert(cardType() === 'Страна · профиль GB' && sections().includes('AddressBase'), 'профиль GB');
  assert(sections().includes('221B Baker Street'), 'адрес по шаблону GB: дом впереди улицы');
  openByName('floor', 'Ground floor');
  assert(sections().includes('этаж входа по профилю GB') && statValue('Уровень') === '0', 'вход — уровень 0 по профилю');
  openByName('premise', 'Flat 3B');
  assert(meta('number').value === '3B' && meta('callCode').value === '303', 'номер «3B» — строка, код 303 — число');
  assert(crumbs().includes('United Kingdom') && crumbs().includes('Baker Street Estate'), 'крошки: адрес GB и объект');
  assert(hasChip(liByName('addr', 'Greater London'), 'reg'), 'над улицей в реестре GB иерархии нет — «нет в реестре»');

  console.log('— удалённую страну можно завести снова —');
  menu(liByName('country', 'Россия'), 'add-country');
  assert(lastToast().textContent.includes('уже заведены'), 'пока обе страны есть, свободных профилей нет');
  menu(liByName('country', 'United Kingdom'), 'delete-node');
  assert(lastToast().textContent.includes('Baker Street Estate'), 'объект Британии уйдёт вместе с последним домом');
  menu(liByName('country', 'Россия'), 'add-country');
  assert(lastToast().textContent.includes('удаляется'), 'пока идёт отсчёт, профиль занят — и это сказано: ' + lastToast().textContent);
  await sleep(6800);
  assert(byType('country') === 1 && scopeSelect.options.length === 7, 'Британия удалена вместе с объектом');
  openByName('country', 'Россия');
  click(d.getElementById('addButton'), '«Добавить» при выбранной и единственной стране');
  const addMenu = d.querySelector('.node-dropdown.open');
  assert(!!addMenu && addMenu.textContent.includes('Добавить элемент адреса') && addMenu.textContent.includes('Добавить страну'),
    'кнопка «Добавить» предлагает и элемент адреса в выбранную страну, и новую страну');
  click(addMenu && addMenu.querySelector('[data-action="add-country"]'), 'Добавить страну');
  assert(modalVisible() && d.getElementById('mCountry').value === 'GB', 'при выбранной России можно завести другую страну');
  cancelModal();
  click(action('add-country'), 'кнопка в карточке страны');
  assert(modalVisible() && d.getElementById('mCountry').value === 'GB', 'то же — из карточки страны');
  click(d.getElementById('mOk'), 'создать');
  assert(byType('country') === 2 && cardType() === 'Страна · профиль GB', 'страна заведена заново: ' + cardType());

  console.log('— сброс —');
  click(d.getElementById('resetBtn'), 'reset');
  click(d.getElementById('resetOk'), 'resetOk');
  assert(nodes() === 2001 && byType('premise') === 814, 'после сброса вернулся демо-набор: ' + nodes());
  assert(scopeSelect.options.length === 8, 'после сброса семь объектов');
  assert(d.querySelectorAll('.tree-tab.active')[0].dataset.tab === 'addr', 'линза «Адреса»');

  console.log('\nвсего за', Date.now() - t0, 'ms');
  if (errors.length) {
    console.log('\nПРОБЛЕМЫ (' + errors.length + '):');
    errors.forEach(e => console.log(' - ' + e));
    process.exit(1);
  }
  console.log('\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  process.exit(0);
})();
