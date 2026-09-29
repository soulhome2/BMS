// Поведенческие проверки index_11.html — модель из
// «10 - Модель географии, помещений и панелей»:
// слева один навигатор мест без вкладок и две закреплённые таблицы —
// «Все панели» и «Все аккаунты», сделанные одним компонентом; карточка дома
// и подъезда разбита на вкладки; крупное удаление подтверждается вводом
// числа, отсчёт отмены замирает при наведении на уведомление. Объекты
// обслуживания — своя ветка навигатора; длинные списки везде идут страницами.
// Запуск как у run.js:
//   node run_11.js path/to/index_11.html
// (на Node 22 до 22.12 — с флагом --experimental-require-module)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const file = process.argv[2] || path.join(__dirname, '..', 'index_11.html');
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
const count = (sel) => d.querySelectorAll(sel).length;
const selectable = () => count('#treeContainer .tree-node[data-selectable="1"]');
const pending = () => count('#treeContainer .tree-node.pending-delete');
const undoToast = () => {
  const all = d.querySelectorAll('#toastStack .toast:not([data-closing]) .toast-action');
  return all[all.length - 1] || null;
};
const lastToastEl = () => {
  const all = d.querySelectorAll('#toastStack .toast:not([data-closing])');
  return all[all.length - 1] || null;
};
const lastToast = () => lastToastEl() || { textContent: '' };
const cardType = () => d.getElementById('cardType').textContent;
const cardTitle = () => {
  const input = d.getElementById('cardName');
  return input.classList.contains('hidden') ? d.getElementById('cardStaticName').textContent : input.value;
};
const status = () => d.getElementById('treeStatus').textContent;
const statusNum = (re) => Number((status().match(re) || [])[1]);
const sections = () => d.getElementById('cardSections').textContent;
const stats = () => d.getElementById('cardStats').textContent;
const crumbs = () => d.getElementById('cardBreadcrumb').textContent;
const modalVisible = () => d.getElementById('modalOverlay').classList.contains('visible');
const modalText = () => d.getElementById('modalBody').textContent;
const meta = (key) => d.querySelector('#cardSections [data-meta="' + key + '"]');
const action = (a) => d.querySelector('#cardSections [data-action="' + a + '"]');
const listItems = (key) => count('[data-list-body="' + key + '"] .list-item');
const statValue = (label) => {
  const item = Array.from(d.querySelectorAll('#cardStats .stat-item')).find(s => s.querySelector('.label').textContent === label);
  return item ? item.querySelector('.value').textContent : null;
};

// --- навигатор ---
const rowName = (li) => li.querySelector(':scope > .node-content .hit-name').textContent;
// Строка «Объекты обслуживания» в корне — вход в ветку, а не узел уровня
const rows = () => Array.from(d.querySelectorAll('#treeContainer .nav-row:not(.nav-objects)'));
const objRow = () => d.querySelector('#treeContainer .nav-objects');
const rowNames = () => rows().map(rowName);
const row = (name) => rows().find(li => rowName(li) === name) || null;
const rowSub = (name) => { const li = row(name); return li ? li.querySelector('.hit-sub').textContent : null; };
const head = () => d.querySelector('#treeContainer .nav-head');
const headName = () => head() ? head().querySelector('.nav-name').textContent : null;
const headCrumbs = () => head() ? Array.from(head().querySelectorAll('.nav-crumb')).map(x => x.textContent) : [];
const drill = (name) => {
  const li = row(name);
  if (!li) { fail('нет строки «' + name + '» на уровне «' + (headName() || 'корень') + '»: ' + rowNames().join(' | ')); return; }
  click(li.querySelector(':scope > .node-content'), name);
};
const back = () => click(d.querySelector('#treeContainer [data-nav-back]'), 'назад');
const toRoot = () => { const c = d.querySelector('#treeContainer .nav-crumb[data-nav=""]'); if (c) click(c, 'корень'); };
const goTo = (names) => { toRoot(); names.forEach(drill); };
const openSeg = (name) => click(Array.from(d.querySelectorAll('#treeContainer .seg')).find(s => s.textContent === name), 'участок ' + name);
const hasChip = (li, kind) => !!(li && li.querySelector(':scope > .node-content > .node-chip.' + kind));
const menu = (li, act) => {
  click(li && li.querySelector(':scope > .node-content .btn-more'), 'меню');
  const item = d.querySelector('.node-dropdown.open [data-action="' + act + '"]');
  if (!item) { fail('в меню нет действия ' + act); return; }
  click(item, act);
};
const UK = 'United Kingdom › Greater London › Camden › Baker Street';
const PATHS = {
  'дом 14, корп. 2': ['Россия', 'Москва', 'Раменки › Мичуринский проспект', 'дом 14, корп. 2'],
  'дом 7А': ['Россия', 'Москва', 'Отрадное › Юрловский проезд', 'дом 7А'],
  'дом 12': ['Россия', 'Московская область', 'Одинцовский городской округ › село Ивановское', 'улица Садовая', 'дом 12'],
  'дом 14': ['Россия', 'Московская область', 'Одинцовский городской округ › село Ивановское', 'улица Садовая', 'дом 14'],
  '221B': [UK, '221B']
};
// Вкладка карточки запоминается по типу — каждый раз ставим нужную явно
const cardTab = (key) => {
  const b = d.querySelector('#cardSections [data-card-tab="' + key + '"]');
  if (!b) { fail('нет вкладки ' + key); return; }
  if (!b.classList.contains('active')) click(b, 'вкладка ' + key);
};
const activeTab = () => { const b = d.querySelector('#cardSections .card-tab.active'); return b ? b.dataset.cardTab : null; };
const openHouse = (name, tab) => { goTo(PATHS[name]); cardTab(tab || 'premises'); };

// --- карточка ---
const cardMenu = (act) => {
  click(d.getElementById('cardMore'), 'меню карточки');
  const item = d.querySelector('.node-dropdown.open [data-action="' + act + '"]');
  if (!item) { fail('в меню карточки нет действия ' + act); return; }
  click(item, act);
};
const groupLabels = () => Array.from(d.querySelectorAll('#premBody .prem-group .col-link')).map(x => x.textContent);
const groupRow = (label) => Array.from(d.querySelectorAll('#premBody .prem-group')).find(r => r.querySelector('.col-link').textContent === label);
const premRows = (label) => {
  const out = [];
  let on = false;
  d.querySelectorAll('#premBody tr').forEach(tr => {
    if (tr.classList.contains('prem-group')) { on = tr.querySelector('.col-link').textContent === label; return; }
    if (on && tr.classList.contains('prem-row')) out.push(tr.querySelector('.pn').textContent);
  });
  return out;
};
const premVisible = () => count('#premBody tr.prem-row');
const premRow = (name) => Array.from(d.querySelectorAll('#premBody tr.prem-row')).find(r => r.querySelector('.pn').textContent === name);
const openPrem = (name) => click(premRow(name), 'помещение ' + name);
const openGroup = (label) => { const r = groupRow(label); click(r && r.querySelector('.col-link'), 'этаж ' + label); };
const addOnFloor = (label) => { const r = groupRow(label); click(r && r.querySelector('.prem-add'), '+ помещение: ' + label); };
const rowMenu = (name, act) => {
  const r = premRow(name);
  click(r && r.querySelector('.btn-more'), 'меню строки ' + name);
  const item = d.querySelector('.node-dropdown.open [data-action="' + act + '"]');
  if (!item) { fail('в меню строки нет действия ' + act); return; }
  click(item, act);
};
const openListItem = (key, name) => click(Array.from(d.querySelectorAll('[data-list-body="' + key + '"] .list-item'))
  .find(x => x.querySelector('.name').textContent === name), name);

// --- таблицы-реестры ---
const listBtn = (view) => d.querySelector('.tree-list-btn[data-view="' + view + '"]');
const openList = (view) => click(listBtn(view), 'таблица ' + view);
const regRows = () => count('#regBody tr');
const regInfo = () => d.getElementById('regInfo').textContent;
const regTotal = () => (regInfo().match(/из (\d+)/) || [])[1];
const regCell = (r, c) => d.querySelectorAll('#regBody tr')[r].children[c].textContent;
const regColumn = (c) => Array.from(d.querySelectorAll('#regBody tr')).map(tr => tr.children[c].textContent);
const regStatus = (m) => click(d.querySelector('#cardSections .reg-status-btn[data-mode="' + m + '"]'), 'фильтр ' + m);
const regPicked = () => (d.getElementById('regPicked') || {}).textContent || '';
const regBulk = (k) => click(d.querySelector('#cardSections [data-reg-bulk="' + k + '"]'), 'массово: ' + k);
const selectByText = (id, text) => {
  const sel = d.getElementById(id);
  const opt = Array.from(sel.options).find(o => o.textContent === text);
  if (!opt) { fail('нет варианта «' + text + '» в ' + id); return; }
  change(sel, opt.value);
};

// --- поиск списком ---
const hitNames = () => Array.from(d.querySelectorAll('#treeContainer .search-hit .hit-name')).map(x => x.textContent);
const openHit = (query, t, test) => {
  type(d.getElementById('searchInput'), query);
  const hit = Array.from(d.querySelectorAll('#treeContainer .search-hit[data-type="' + t + '"]'))
    .find(li => !test || test(li.textContent));
  click(hit && hit.querySelector('.node-content'), query);
  click(d.getElementById('searchClear'), 'очистить поиск');
};
// Объект короче всего открыть поиском; ветку «Объекты» проверяет свой раздел
const openObject = (name) => {
  type(d.getElementById('searchInput'), name);
  const hit = Array.from(d.querySelectorAll('#treeContainer .search-hit[data-type="object"]'))
    .find(li => li.querySelector('.hit-name').textContent === name);
  click(hit && hit.querySelector('.node-content'), name);
  click(d.getElementById('searchClear'), 'очистить поиск');
};

const pickOption = (selectId, test) => {
  const sel = d.getElementById(selectId);
  const opt = Array.from(sel.options).find(o => test(o.textContent));
  if (!opt) { fail('нет варианта в ' + selectId); return null; }
  change(sel, opt.value);
  return opt;
};
const cancelModal = () => click(d.querySelector('[data-modal-cancel]'), 'cancel');

// --- страницы ---
const pgInfo = (root) => { const x = root && root.querySelector('[data-pg-info]'); return x ? x.textContent : null; };
const pgGo = (root, p) => click(root && root.querySelector('[data-pg-go="' + p + '"]'), 'страница ' + p);
const pgSize = (root, v) => change(root && root.querySelector('[data-pg-size]'), v);
const pickVisible = () => Array.from(d.querySelectorAll('#bindPickList .modal-option')).filter(o => o.style.display !== 'none').length;
const pickCount = () => d.getElementById('bindPickCount').textContent;

(async function main() {
  const t0 = Date.now();
  const search = d.getElementById('searchInput');
  const scopeSelect = d.getElementById('scopeSelect');

  console.log('— стартовое состояние: навигатор и две таблицы, без вкладок —');
  assert(count('.tree-tab') === 0, 'вкладок «Адреса / Оборудование» больше нет');
  assert(listBtn('panels').textContent.includes('Все панели') && listBtn('panels').querySelector('.badge').textContent === '26' &&
    listBtn('accounts').querySelector('.badge').textContent === '805', 'над навигатором — «Все панели» (26) и «Все аккаунты» (805)');
  assert(!head() && rowNames().join(' | ') === 'Россия | ' + UK, 'в корне навигатора — Россия и склеенный британский адрес');
  assert(rowSub('Россия') === '8 домов · 810 помещений' && !!row('Россия').querySelector('.nav-go'), 'подпись с содержимым, стрелка внутрь');
  assert(!row(UK).querySelector('.checkbox-custom') && !!row('Россия').querySelector('.checkbox-custom'),
    'у склеенной строки флажка нет: удалилось бы не всё, что подписано');
  assert(cardType() === 'Страна · профиль RU' && status().includes('814 помещений') && status().includes('26 панелей'), 'выбрана страна, статус считает всё');

  console.log('— профиль страны —');
  assert(sections().includes('Профиль страны · RU') && sections().includes('Машиноместо'), 'профиль и справочники');
  d.getElementById('newTypeName').value = 'Колясочная';
  click(action('add-premise-type'), 'добавить тип');
  assert(sections().includes('Колясочная'), 'свой тип установки дописан к базовым');

  console.log('— проваливание, «назад» и крошки —');
  drill('Россия');
  drill('Москва');
  assert(cardType() === 'Субъект РФ' && headCrumbs().join(' › ') === 'Адреса › Россия', 'крошки над заголовком');
  openSeg('Раменки');
  assert(headName() === 'Раменки › Мичуринский проспект' && cardTitle() === 'Раменки', 'участок цепочки проваливает и открывает свой узел');
  back();
  assert(headName() === 'Москва', '«назад» — на уровень выше');
  toRoot();
  assert(!head(), 'крошка «Адреса» — в корень');

  console.log('— поиск — плоский список —');
  type(search, 'Квартира 1011');
  const hit1011 = Array.from(d.querySelectorAll('#treeContainer .search-hit')).find(li => li.textContent.includes('Квартира 1011'));
  click(hit1011 && hit1011.querySelector('.node-content'), 'найденное');
  click(d.getElementById('searchClear'), 'очистить');
  assert(cardTitle() === 'Квартира 1011' && headName() === 'дом 73, корп. 1', 'найденное открыто, навигатор — там, где оно');
  type(search, 'Раменки-парк');
  assert(hitNames().includes('Раменки-парк'), 'объект находится поиском');
  click(d.getElementById('searchClear'), 'очистить');

  console.log('— дом: вкладки карточки —');
  goTo(PATHS['дом 14, корп. 2']);
  assert(cardType() === 'Дом' && activeTab() === 'premises', 'карточка дома открывается на вкладке «Помещения»');
  assert(Array.from(d.querySelectorAll('#cardSections .card-tab')).map(b => b.textContent).join(' | ') === 'homeПомещения44 | doorbellПанели4 | tuneПараметры',
    'вкладки с числами: помещения, панели, параметры');
  assert(!!d.getElementById('premBody') && !meta('num') && listItems('hpanels') === 0, 'на первом экране только таблица помещений');
  assert(groupLabels()[0] === 'Подъезд 1 › Этаж 1' && premRows('Вне подъездов › Этаж −1').includes('Машиноместо 118'), 'помещения по этажам');
  cardTab('panels');
  assert(listItems('hpanels') === 4 && !d.getElementById('premBody'), 'вкладка «Панели» — все панели дома');
  assert(!!d.querySelector('#cardSections [data-open-reg^="panels|"]'), 'и ссылка на них в общей таблице');
  cardTab('params');
  assert(meta('num').value === '14' && meta('korpus').value === '2' && sections().includes('Москва, Мичуринский проспект, дом 14, корп. 2'),
    'вкладка «Параметры» — номер, реестр, адрес для печати');
  change(meta('stroenie'), '3');
  assert(cardTitle() === 'дом 14, корп. 2, стр. 3' && activeTab() === 'params', 'правка поля не сбрасывает вкладку');
  change(meta('stroenie'), '');
  goTo(PATHS['дом 7А']);
  assert(activeTab() === 'params', 'выбранная вкладка запоминается для всех домов');
  cardTab('premises');
  drill('Подъезд 1');
  assert(cardType() === 'Подъезд' && Array.from(d.querySelectorAll('#cardSections .card-tab')).length === 2 && activeTab() === 'premises',
    'у подъезда две вкладки — помещения и панели');

  console.log('— помещения и зоны —');
  openHouse('дом 14, корп. 2');
  openPrem('Машиноместо 118');
  assert(cardType() === 'Помещение' && meta('callCode').value === '118' && statValue('Вызывают панелей') === '4', 'машиноместо: код, вызывающие панели');
  openHouse('дом 14, корп. 2', 'panels');
  openListItem('hpanels', 'Дверь: Подъезд 1');
  assert(meta('zoneId').selectedOptions[0].textContent === 'Подъезд: Подъезд 1' && statValue('Кого вызывает') === '34', 'зона и исключения');
  assert(crumbs().startsWith('Все панели'), 'в крошках панели — путь в общую таблицу');
  openHouse('дом 14, корп. 2');
  click(action('add-premise'), 'помещение из карточки дома');
  pickOption('mFloor', t => t === 'Подъезд 1 › Этаж 9');
  click(d.getElementById('mOk'), 'создать кв. 33');
  assert(cardTitle() === 'Квартира 33' && crumbs().includes('Этаж 9'), 'квартира заведена на выбранный этаж');

  console.log('— аккаунты —');
  openHouse('дом 7А');
  openPrem('Квартира 111');
  click(action('add-account'), 'add-account');
  d.getElementById('aEmail').value = 'petrova@mail.ru';
  d.getElementById('aSip').value = '5900';
  click(d.getElementById('aOk'), 'aOk');
  click(d.querySelector('.form-toggle[data-action="toggle-blocked"]'), 'block');
  assert(stats().includes('Заблокирована') && listBtn('accounts').querySelector('.badge').textContent === '806', 'аккаунт создан и заблокирован');

  console.log('— «Все аккаунты»: общий компонент таблиц —');
  openList('accounts');
  assert(cardType() === 'SIP-аккаунты' && listBtn('accounts').classList.contains('active'), 'кнопка открыла таблицу и подсвечена');
  assert(statValue('Аккаунтов') === '806' && statValue('Заблокировано') === '1' && statValue('В нескольких помещениях') === '7', 'сводка');
  assert(regRows() === 50 && regInfo() === 'показаны 1–50 из 806', 'по 50 строк');
  change(d.getElementById('regSize'), '100');
  click(d.querySelector('#cardSections th[data-reg-sort="sip"]'), 'сортировка по SIP');
  assert(regCell(0, 2) === '111', 'по возрастанию SIP первым 111');
  regStatus('blocked');
  assert(regRows() === 1 && regCell(0, 2) === '5900', 'заблокирована одна');
  regStatus('all');
  selectByText('regObject', 'Отрадное');
  assert(regTotal() === '248', 'фильтр по объекту');
  click(d.querySelector('#cardSections [data-reg-page]'), 'вся страница');
  click(d.querySelector('#cardSections [data-reg-all]'), 'все по фильтру');
  assert(regPicked() === 'Выбрано: 248', 'выбраны все 248 по фильтру');
  regBulk('block');
  assert(statValue('Заблокировано') === '248', 'заблокированы пачкой');
  click(undoToast(), 'отменить');
  assert(statValue('Заблокировано') === '1', 'отмена вернула всё');

  console.log('— крупное удаление подтверждается числом —');
  regBulk('delete');
  assert(modalVisible() && d.getElementById('modalTitle').textContent === 'Удалить 248 учётных записей?',
    'удаление 248 — через окно со сводкой: ' + d.getElementById('modalTitle').textContent);
  assert(modalText().includes('248 аккаунтов') && modalText().includes('«Отрадное»') && modalText().includes('без домофона'),
    'в окне — что и где уйдёт, и чем это грозит');
  d.getElementById('bigDelCount').value = '24';
  click(d.getElementById('bigDelOk'), 'неверное число');
  assert(modalVisible() && d.getElementById('bigDelErr').textContent.includes('ровно 248'), 'неверное число не принимается');
  cancelModal();
  assert(!modalVisible() && pending() === 0 && regPicked() === 'Выбрано: 248', 'отмена — ничего не поставлено в очередь, выделение на месте');
  regBulk('clear');
  click(d.querySelectorAll('#regBody [data-reg-pick]')[0], 'строка 1');
  click(d.querySelectorAll('#regBody [data-reg-pick]')[1], 'строка 2');
  regBulk('delete');
  assert(!modalVisible() && lastToast().textContent.includes('удаление через') && count('#regBody tr.pending') === 2,
    'две учётки — без окна, сразу отсчёт');
  click(undoToast(), 'отменить удаление');
  assert(count('#regBody tr.pending') === 0, 'отменено');

  console.log('— отсчёт замирает, пока на уведомление навели —');
  click(d.querySelectorAll('#regBody [data-reg-pick]')[0], 'строка');
  regBulk('delete');
  const delToast = lastToastEl();
  delToast.dispatchEvent(new w.MouseEvent('mouseenter'));
  await sleep(13000);
  assert(count('#regBody tr.pending') === 1 && statValue('Аккаунтов') === '806',
    'за 13 с при наведении удаление не зафиксировалось (отсчёт 12 с)');
  delToast.dispatchEvent(new w.MouseEvent('mouseleave'));
  click(delToast.querySelector('.toast-action'), 'отменить');
  assert(count('#regBody tr.pending') === 0 && statValue('Аккаунтов') === '806', 'после паузы отмена всё ещё работает');

  console.log('— «Все панели»: та же таблица —');
  openList('panels');
  assert(cardType() === 'Вызывные панели' && listBtn('panels').classList.contains('active') && regInfo() === 'показаны 1–26 из 26',
    'таблица панелей — тем же компонентом');
  assert(Array.from(d.querySelectorAll('#cardSections .reg-status-btn')).map(b => b.textContent).join(',') ===
    'Все,Онлайн,Офлайн,Заблокированы,Никого не вызывают,Конфликт кодов', 'свои фильтры состояния — в той же раскладке');
  selectByText('regObject', 'CityBay (Сити Бэй)');
  assert(regTotal() === '5', 'объект → его панели: фильтр вместо отдельной вкладки');
  const places = regColumn(3);
  assert(places.includes('территория') && places.some(p => p.includes('Волоколамское шоссе')) && places.some(p => p.includes('Строительный проезд')),
    'место установки видно: территория и корпуса на разных улицах');
  selectByText('regObject', 'Все объекты');
  click(d.querySelector('#cardSections th[data-reg-sort="level"]'), 'сортировка по уровню');
  assert(regCell(0, 4) === '−1', 'первой — калитка на −1');
  click(d.querySelector('#regBody tr'), 'строка');
  assert(cardType() === 'Вызывная панель' && crumbs().startsWith('Все панели'), 'строка открывает панель');
  click(d.querySelector('#cardBreadcrumb [data-view="panels"]'), 'назад');
  assert(cardType() === 'Вызывные панели' && d.querySelector('#cardSections th.sorted').dataset.regSort === 'level', 'вернулись с той же сортировкой');
  regStatus('clash');
  assert(regTotal() === undefined && d.getElementById('regEmpty').style.display === '', 'конфликтов кодов нет');
  regStatus('all');
  click(d.getElementById('addButton'), '«Добавить» в таблице панелей');
  assert(modalVisible() && !!d.getElementById('pPlace'), 'в таблице панелей «Добавить» ставит панель');
  pickOption('pPlace', t => t.startsWith('Раменки-парк › дом 14, корп. 2 › Подъезд 1 › Этаж 3'));
  d.getElementById('pSip').value = '9400';
  click(d.getElementById('pOk'), 'создать');
  assert(cardType() === 'Вызывная панель' && listBtn('panels').querySelector('.badge').textContent === '27', 'панель создана');
  cardMenu('delete-node');
  await sleep(6800);
  assert(listBtn('panels').querySelector('.badge').textContent === '26', 'удалена после отсчёта');
  openList('accounts');
  click(d.getElementById('addButton'), '«Добавить» в таблице аккаунтов');
  assert(!modalVisible() && lastToast().textContent.includes('в карточке помещения'), 'аккаунт заводится в помещении — так и сказано');

  console.log('— ссылки из карточек открывают таблицы с фильтром —');
  openObject('Раменки-парк');
  assert(cardType() === 'Объект обслуживания', 'объект открыт поиском');
  click(d.querySelector('#cardSections [data-open-reg^="accounts|"]'), 'аккаунты объекта');
  assert(cardType() === 'SIP-аккаунты' && regTotal() === '33', 'аккаунты объекта: ' + regTotal());
  openObject('Раменки-парк');
  click(d.querySelector('#cardSections [data-open-reg^="panels|"]'), 'панели объекта');
  assert(cardType() === 'Вызывные панели' && regTotal() === '6', 'панели объекта');
  openHouse('дом 7А', 'params');
  click(d.querySelector('#cardSections [data-open-reg^="accounts|"]'), 'аккаунты дома');
  assert(regTotal() === '217', 'аккаунты дома: ' + regTotal());

  console.log('— ветка «Объекты» в навигаторе —');
  toRoot();
  assert(!!objRow() && d.querySelector('#treeContainer > li').classList.contains('nav-objects') &&
    objRow().querySelector('.hit-sub').textContent === '7 объектов' && objRow().textContent.includes('подписка: 2'),
    'в корне первой строкой — «Объекты обслуживания»: число и проблемы подписки');
  const cardBefore = cardTitle();
  click(objRow().querySelector('.node-content'), 'Объекты обслуживания');
  assert(headName() === 'Объекты обслуживания' && headCrumbs().join(' › ') === 'Адреса' && rows().length === 7 && cardTitle() === cardBefore,
    'список объектов; своей карточки у списка нет — открытая осталась');
  assert(rowSub('CityBay (Сити Бэй)') === '2 дома · 500 помещений · 5 панелей, 0 онлайн' && hasChip(row('CityBay (Сити Бэй)'), 'sub'),
    'строка объекта: дома, помещения, панели и чип подписки');
  assert(!row('CityBay (Сити Бэй)').querySelector('.checkbox-custom'), 'объект флажком не отмечается — он уходит с последним домом');
  drill('CityBay (Сити Бэй)');
  assert(cardType() === 'Объект обслуживания' && headName() === 'CityBay (Сити Бэй)' && headCrumbs().join(' › ') === 'Адреса › Объекты' &&
    rowNames().join(' | ') === 'Строительный проезд, дом 7, корп. 2 | Волоколамское шоссе, дом 73, корп. 1',
    'объект — его карточка и его дома, подписанные с улицей');
  drill('Волоколамское шоссе, дом 73, корп. 1');
  assert(cardType() === 'Дом' && headCrumbs().join(' › ') === 'Адреса › Объекты › CityBay (Сити Бэй)', 'в крошках дома — объект, через который вошли');
  drill('Секция 1');
  assert(cardType() === 'Подъезд' && headName() === 'Волоколамское шоссе, дом 73, корп. 1', 'секция открыта, навигатор в доме');
  back();
  assert(headName() === 'CityBay (Сити Бэй)', '«назад» из такого дома — к объекту, а не к улице');
  back();
  assert(headName() === 'Объекты обслуживания', 'дальше — к списку объектов');
  back();
  assert(!head(), 'и в корень');
  goTo(PATHS['дом 7А']);
  assert(headCrumbs()[1] === 'Россия' && !headCrumbs().includes('Объекты'), 'вошли по адресу — в крошках адрес: ' + headCrumbs().join(' › '));
  click(d.querySelector('#cardBreadcrumb .crumb-link[title="Объект обслуживания"]'), 'объект из крошек дома');
  assert(cardTitle() === 'Отрадное' && headName() === 'Отрадное' && rowNames().length === 2, 'ссылка на объект открывает его и в навигаторе');
  openHit('Въезд на территорию', 'panel');
  assert(cardType() === 'Вызывная панель' && headCrumbs().join(' › ') === 'Адреса › Объекты' &&
    ['Отрадное', 'CityBay (Сити Бэй)'].includes(headName()), 'панель территории из поиска — навигатор на её объекте');

  console.log('— страницы в длинных списках —');
  const gate = headName();
  const pf = () => d.querySelector('[data-list-pager="pflats"]');
  const calls = Number((d.querySelector('[data-list-count="pflats"]').textContent.match(/\d+/) || [])[0]);
  assert(calls > 200 && listItems('pflats') === 25 && pgInfo(pf()) === '1–25 из ' + calls,
    'список карточки — по 25: «Кого вызывает» въезда ' + gate + ' — ' + calls);
  pgGo(pf(), 2);
  assert(listItems('pflats') === 25 && pgInfo(pf()) === '26–50 из ' + calls, 'вторая страница');
  pgSize(pf(), '100');
  assert(listItems('pflats') === 100 && pgInfo(pf()) === '1–100 из ' + calls, 'размер 100 — с первой страницы');
  pgGo(pf(), 2);
  type(d.querySelector('.section-search-input[data-list="pflats"]'), 'Квартира 1');
  assert(pgInfo(pf()).startsWith('1–') && d.querySelector('[data-list-count="pflats"]').textContent.includes(' из ' + calls),
    'поиск в списке — снова с первой: ' + pgInfo(pf()));

  click(action('bind-flats'), 'окно выбора помещений');
  const pickPager = () => d.getElementById('bindPickPager');
  assert(modalVisible() && pickVisible() === 50 && pgInfo(pickPager()) === '1–50 из ' + calls && pickCount() === 'Выбрано: ' + calls,
    'окно выбора — по 50, отметки на всех страницах считаются');
  click(d.getElementById('bindPickMaster'), 'снять страницу 1');
  pgGo(pickPager(), 2);
  click(d.getElementById('bindPickMaster'), 'снять страницу 2');
  assert(pickCount() === 'Выбрано: ' + (calls - 100) && pgInfo(pickPager()) === '51–100 из ' + calls, '«Выбрать всё» действует на страницу');
  click(d.getElementById('bindPickMaster'), 'отметить страницу 2');
  const allLink = d.getElementById('bindPickAll');
  assert(!allLink.classList.contains('hidden') && allLink.textContent === 'Отметить все найденные — ' + calls,
    'страница отмечена, а найдено больше — предложено отметить всё, с числом');
  click(allLink, 'отметить все найденные');
  assert(pickCount() === 'Выбрано: ' + calls && allLink.classList.contains('hidden'), 'отмечены все найденные');
  type(d.getElementById('bindSearch'), 'Квартира 2');
  assert(pickVisible() < 50 && pgInfo(pickPager()) === null, 'поиск сузил до одной страницы — пейджера нет');
  cancelModal();

  toRoot();
  click(objRow().querySelector('.node-content'), 'Объекты обслуживания');
  drill('CityBay (Сити Бэй)');
  drill('Волоколамское шоссе, дом 73, корп. 1');
  cardTab('premises');
  const premPager = () => d.getElementById('premPager');
  assert(premVisible() === 50 && pgInfo(premPager()) === '1–50 из 292', 'таблица помещений — по 50 (292 в корпусе)');
  pgGo(premPager(), 2);
  const g2 = d.querySelector('#premBody tr.prem-group');
  assert(premVisible() === 50 && pgInfo(premPager()) === '51–100 из 292' && !!g2 && g2.textContent.includes('Этаж 17 — продолжение'),
    'вторая страница: этаж, разорванный границей, подписан «продолжение»');
  pgGo(premPager(), 6);
  assert(premVisible() === 42 && pgInfo(premPager()) === '251–292 из 292', 'последняя страница — остаток');
  type(d.getElementById('premSearch'), '1');
  const found = Number(d.getElementById('premCount').textContent.split(' ')[0]);
  assert(pgInfo(premPager()) === '1–50 из ' + found && found < 292, 'поиск — с первой страницы: ' + found);
  pgSize(premPager(), '100');
  assert(premVisible() === Math.min(100, found), 'размер страницы 100');
  pgSize(premPager(), '50');
  type(d.getElementById('premSearch'), '');

  type(search, 'Квартира');
  const hitsTotal = Number(d.querySelector('#treeContainer .search-summary').textContent.replace(/\D/g, ''));
  const tc = d.getElementById('treeContainer');
  assert(hitsTotal > 700 && count('#treeContainer .search-hit') === 50 && pgInfo(tc) === '1–50 из ' + hitsTotal,
    'поиск — страницами по 50 без обрезки: ' + hitsTotal);
  pgGo(tc, 2);
  assert(pgInfo(tc) === '51–100 из ' + hitsTotal && count('#treeContainer .search-hit') === 50, 'вторая страница поиска');
  type(search, 'Квартира 1');
  assert(pgInfo(tc).startsWith('1–'), 'новый запрос — с первой');
  click(d.getElementById('searchClear'), 'очистить');

  console.log('— частный дом —');
  openHouse('дом 12');
  assert(headName() === 'улица Садовая' && !row('дом 12').querySelector('.nav-go'), 'в частный дом проваливаться некуда');
  assert(premRows('Этаж 1').join(',') === 'Жилое помещение 1', 'одно помещение');
  click(head().querySelector('.nav-name'), 'улица Садовая');
  click(action('add-house'), 'новый дом');
  d.getElementById('hp-num').value = '14';
  click(d.getElementById('mOk'), 'дом 14');
  assert(cardTitle() === 'дом 14' && scopeSelect.options.length === 9, 'дом и объект созданы');
  menu(row('дом 14'), 'delete-node');
  assert(!modalVisible() && lastToast().textContent.includes('уйдёт вместе с последним домом'), 'маленькое удаление — без окна');
  await sleep(6800);
  assert(scopeSelect.options.length === 8 && !row('дом 14'), 'дом и объект ушли');

  console.log('— область видимости —');
  change(scopeSelect, scopeSelect.options[1].value);
  assert(!head() && rowNames().join(' | ') === 'Юрловский проезд, дом 7А | Юрловский проезд, дом 7Б' && cardTitle() === 'Отрадное',
    'выбран объект — в корне его дома, открыта карточка объекта');
  assert(listBtn('accounts').querySelector('.badge').textContent === '248' && listBtn('panels').querySelector('.badge').textContent === '10',
    'числа на кнопках таблиц — по объекту');
  openList('accounts');
  assert(statValue('Аккаунтов') === '248' && d.getElementById('regObject').disabled, 'таблица ограничена объектом');
  change(scopeSelect, '');
  assert(statValue('Аккаунтов') === '806' && rowNames().length === 2, 'все объекты');

  console.log('— слияние и разделение объектов —');
  openObject('Отрадное');
  click(action('merge'), 'merge');
  pickOption('mTarget', t => t.startsWith('CityBay'));
  assert(d.getElementById('mOk').disabled, 'другой сервер — нельзя');
  cancelModal();
  click(Array.from(d.querySelectorAll('[data-list-body="ohouses"] .list-item')).find(x => x.textContent.includes('7Б'))
    .querySelector('[data-act="split-house"]'), 'вынести 7Б');
  click(d.getElementById('mOk'), 'вынести');
  assert(scopeSelect.options.length === 9, 'дом 7Б стал отдельным объектом');
  openObject('Отрадное');
  click(action('merge'), 'merge back');
  pickOption('mTarget', t => t.startsWith('Юрловский проезд, дом 7Б'));
  click(d.getElementById('mOk'), 'объединить');
  assert(scopeSelect.options.length === 8 && statValue('Домов') === '2', 'объединены обратно');

  console.log('— массовое выделение в навигаторе —');
  goTo(['Россия']);
  assert(selectable() === rows().length, 'отметить можно каждую строку уровня');
  click(row('Московская область').querySelector(':scope > .node-content > .checkbox-custom'), 'checkbox');
  click(d.getElementById('deleteSelectedBtn'), 'delete selected');
  assert(modalVisible() && modalText().includes('Вместе с последними домами уйдут объекты'),
    'удаление субъекта — через окно, и сказано, какие объекты уйдут');
  const need = d.getElementById('bigDelCount').placeholder;
  d.getElementById('bigDelCount').value = need;
  click(d.getElementById('bigDelOk'), 'подтвердить');
  assert(!modalVisible() && lastToast().textContent.includes('3 объекта уйдут вместе с последними домами'), 'после подтверждения — отсчёт');
  click(undoToast(), 'cancel bulk');
  assert(pending() === 0 && status().includes('815 помещений'), 'отмена оставила всё как было');

  console.log('— провижининг и лимиты —');
  const subs = statusNum(/(\d+) аккаунт/) + statusNum(/(\d+) панел/);
  click(d.getElementById('provisionBtn'), 'provision');
  const text = d.getElementById('provCommands').value;
  assert((text.split('/api/subscriber/create').length - 1) + (text.split('/api/subscriber/delete').length - 1) === subs, 'команд по числу subscriber\'ов');
  cancelModal();
  openObject('Отрадное');
  change(meta('limitPremises'), '245');
  openHouse('дом 7А');
  addOnFloor('Подъезд 1 › Этаж 1');
  click(d.getElementById('mOk'), 'сверх лимита');
  assert(d.getElementById('mErr').textContent.includes('доступно 245'), 'помещение сверх лимита не создаётся');
  cancelModal();

  console.log('— за рубежом и единственная страна —');
  toRoot();
  openSeg('United Kingdom');
  assert(cardType() === 'Страна · профиль GB' && headName() === UK, 'британская цепочка — один шаг');
  openHouse('221B');
  assert(groupLabels().join(',') === 'Ground floor,First floor', 'этажи GB');
  toRoot();
  openSeg('United Kingdom');
  cardMenu('delete-node');
  assert(!modalVisible(), 'страна с пятью учётками — без окна');
  await sleep(6800);
  assert(!head() && rowNames().join(',') === 'Москва,Московская область', 'одна страна — её уровень скрыт');
  drill('Москва');
  click(Array.from(d.querySelectorAll('#cardBreadcrumb .crumb-link')).find(a => a.textContent === 'Россия'), 'Россия по крошкам карточки');
  assert(cardType() === 'Страна · профиль RU' && !head(), 'карточка скрытой страны — из крошек, навигатор в корне');
  click(d.getElementById('addButton'), '«Добавить» при выбранной стране');
  const addMenu = d.querySelector('.node-dropdown.open');
  click(addMenu && addMenu.querySelector('[data-action="add-country"]'), 'Добавить страну');
  click(d.getElementById('mOk'), 'создать');
  assert(rowNames().join(',') === 'Россия,United Kingdom', 'стран снова две');

  console.log('— сброс —');
  click(d.getElementById('resetBtn'), 'reset');
  click(d.getElementById('resetOk'), 'resetOk');
  assert(!head() && rowNames().join(' | ') === 'Россия | ' + UK && status().includes('814 помещений'), 'после сброса — корень демо-набора');
  assert(listBtn('accounts').querySelector('.badge').textContent === '805' && !d.querySelector('.tree-list-btn.active'), 'таблицы закрыты, числа сброшены');

  console.log('\nвсего за', Date.now() - t0, 'ms');
  if (errors.length) {
    console.log('\nПРОБЛЕМЫ (' + errors.length + '):');
    errors.forEach(e => console.log(' - ' + e));
    process.exit(1);
  }
  console.log('\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  process.exit(0);
})();
