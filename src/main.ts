import { dataDir, load as loadProgress, openFile, saveFile, save as saveProgress } from './api'
import data from './data/cards.json'
import { t, type Lang, type Theme } from './i18n'
import './style.css'

// ---------- типы ----------
interface Card {
  id: number; name: string; nameRu: string;
  deck: string; deckRu: string; expansion: string; expansionRu: string;
  territory: string; territoryRu: string;
  type: string; typeRu: string;
  details: string; detailsRu: string;
  kind: string; kindRu: string; effectsRu: string; quoteRu: string;
  image: string | null;
}
interface DeckDef { en: string; ru: string; color: string }
interface Meta { total: number; unique: number; withImage: number; game: string; source: string }

const CARDS = (data as { cards: Card[] }).cards as Card[];
const DECKS = (data as { decks: DeckDef[] }).decks as DeckDef[];
const EXPS = (data as { expansions: DeckDef[] }).expansions as DeckDef[];
const META = (data as { meta: Meta }).meta as Meta;

// id больше не совпадает с индексом массива (карты могут удаляться),
// поэтому во всех местах, где по id достаётся карта, используем этот поиск.
const BY_ID = new Map<number, Card>(CARDS.map(c => [c.id, c]));

// ---------- состояние ----------
type SortField = 'name' | 'kind' | 'row' | 'deck' | 'expansion' | 'type' | 'territory' | 'details';

const state = {
  checked: new Set<number>(),
  lang: 'ru' as Lang,
  theme: 'dark' as Theme,
  sort: { field: 'name' as SortField, dir: 1 as 1 | -1 },
  f: { name: '', kind: '', row: '', territory: '', deck: 'all', expansion: 'all', found: 'all' },
  undo: [] as Array<Set<number>>,
  saveTimer: 0,
};

const root = document.getElementById('app')!;

// ---------- вспомогательное ----------
const tr = (c: Card, f: SortField): string =>
  (state.lang === 'ru' ? (c as unknown as Record<string, string>)[f + 'Ru'] : (c as unknown as Record<string, string>)[f])
  || (c as unknown as Record<string, string>)[f] || '';

const pct = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 100);

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]!));

const baseName = (s: string): string => s.replace(/\s*\(\d+ of \d+\)\s*$/i, '').trim();

/** Часть типа карты — «Отряд» из «Отряд, Дальнобойный». */
const kindPart = (s: string, idx: number): string => {
  const p = s.split(',').map(x => x.trim()).filter(Boolean);
  return idx === 0 ? p[0] || '' : p[1] || '';
};

// ---------- фильтрация и сортировка ----------
function visibleCards(): Card[] {
  const f = state.f;
  const q = [f.name, f.kind, f.row, f.territory].map(s => s.trim().toLowerCase());
  const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle);
  const list = CARDS.filter(c => {
    if (f.found === 'yes' && !state.checked.has(c.id)) return false;
    if (f.found === 'no' && state.checked.has(c.id)) return false;
    if (f.deck !== 'all' && c.deck !== f.deck) return false;
    if (f.expansion !== 'all' && c.expansion !== f.expansion) return false;
    if (q[0] && !has(tr(c, 'name'), q[0])) return false;
    if (q[1] && !has(kindPart(tr(c, 'kind'), 0), q[1])) return false;
    if (q[2] && !has(kindPart(tr(c, 'kind'), 1), q[2])) return false;
    if (q[3] && !has(tr(c, 'territory'), q[3])) return false;
    return true;
  });
  const { field, dir } = state.sort;
  list.sort((a, b) => {
    let r = 0;
    if (field === 'row') {
      r = kindPart(tr(a, 'kind'), 1).localeCompare(kindPart(tr(b, 'kind'), 1), 'ru');
    } else {
      r = tr(a, field).localeCompare(tr(b, field), 'ru');
    }
    if (r === 0) r = tr(a, 'name').localeCompare(tr(b, 'name'), 'ru');
    return r * dir;
  });
  return list;
}

// ---------- прогресс ----------
function deckStats(): Map<string, { have: number; total: number }> {
  const m = new Map<string, { have: number; total: number }>();
  for (const d of DECKS) m.set(d.en, { have: 0, total: 0 });
  for (const c of CARDS) {
    const e = m.get(c.deck) ?? { have: 0, total: 0 };
    e.total++;
    if (state.checked.has(c.id)) e.have++;
    m.set(c.deck, e);
  }
  return m;
}
function expStats(): Map<string, { have: number; total: number }> {
  const m = new Map<string, { have: number; total: number }>();
  for (const d of EXPS) m.set(d.en, { have: 0, total: 0 });
  for (const c of CARDS) {
    const e = m.get(c.expansion) ?? { have: 0, total: 0 };
    e.total++;
    if (state.checked.has(c.id)) e.have++;
    m.set(c.expansion, e);
  }
  return m;
}

// ---------- сохранение ----------
function scheduleSave() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    void saveProgress(JSON.stringify(Array.from(state.checked)));
  }, 300);
}
function pushUndo() {
  state.undo.push(new Set(state.checked));
  if (state.undo.length > 30) state.undo.shift();
  renderToolbar();
}
function undo() {
  const prev = state.undo.pop();
  if (!prev) return;
  state.checked = prev;
  scheduleSave();
  renderAll();
  toast(t(state.lang, 'undo'));
}

// ---------- подтверждение ----------
function ask(kind: 'mark' | 'unmark', count: number): Promise<boolean> {
  return new Promise(resolve => {
    const L = state.lang;
    const dlg = document.createElement('div');
    dlg.id = 'modal';
    dlg.innerHTML = `<div class="dlg">
      <h2>${t(L, 'confirmTitle')}</h2>
      <p>${t(L, kind === 'mark' ? 'confirmMarkBody' : 'confirmUnmarkBody', count)}</p>
      <p style="font-weight:600">${t(L, kind === 'mark' ? 'confirmMark' : 'confirmUnmark')}</p>
      <div class="note">${t(L, 'confirmNote')}</div>
      <div class="acts">
        <button class="btn" data-a="no">${t(L, 'cancel')}</button>
        <button class="btn primary" data-a="yes">${t(L, 'yes')}</button>
      </div></div>`;
    const done = (v: boolean) => { dlg.remove(); resolve(v); };
    dlg.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) done((b as HTMLElement).dataset.a === 'yes');
      else if (e.target === dlg) done(false);
    });
    document.body.appendChild(dlg);
  });
}

let toastTimer = 0;
function toast(msg: string) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200);
}

// ---------- отрисовка: шапка и панель ----------
function renderHeader(): string {
  const L = state.lang;
  return `<div class="hdr">
    <h1>${t(L, 'appTitle')}</h1>
    <span class="sub">${t(L, 'gameLine')}</span>
    <span class="grow"></span>
    <button class="btn" id="btn-export">${t(L, 'exportBtn')}</button>
    <button class="btn" id="btn-import">${t(L, 'importBtn')}</button>
    <button class="btn icon" id="btn-dir" title="${t(L, 'openData')}">📂</button>
    <button class="btn icon" id="btn-theme" title="${t(L, 'themeBtn')}">${state.theme === 'dark' ? '☀' : '☾'}</button>
    <button class="btn" id="btn-lang">${state.lang === 'ru' ? 'EN' : 'RU'}</button>
  </div>`;
}

function renderProgress(): string {
  const L = state.lang;
  const total = CARDS.length;
  const have = state.checked.size;
  const ds = deckStats();
  const es = expStats();

  const bar = (defs: DeckDef[], st: Map<string, { have: number; total: number }>, big: boolean) => {
    const segs = defs.filter(d => (st.get(d.en)?.total ?? 0) > 0).map(d => {
      const s = st.get(d.en)!;
      const w = (s.total / total) * 100;
      const f = s.total ? (s.have / s.total) * 100 : 0;
      const name = L === 'ru' ? d.ru : d.en;
      return `<div class="seg" style="width:${w}%;background:${d.color}22"
        title="${esc(name)}: ${s.have}/${s.total} (${pct(s.have, s.total)}%)">
        <div style="width:${f}%;height:100%;background:${d.color}"></div></div>`;
    }).join('');
    return `<div class="bar${big ? ' big' : ''}">${segs}</div>`;
  };

  const nums = (defs: DeckDef[], st: Map<string, { have: number; total: number }>) =>
    defs.filter(d => (st.get(d.en)?.total ?? 0) > 0)
      .map(d => {
        const s = st.get(d.en)!;
        const name = L === 'ru' ? d.ru : d.en;
        return `<span title="${esc(name)}"><b>${s.have}</b>/${s.total}</span>`;
      }).join(' · ');

  return `<div class="prog">
    <div class="prog-row">
      <div class="prog-lbl">${t(L, 'overall')}</div>
      ${bar(DECKS, ds, true)}
      <div class="prog-val"><b>${have}</b>/${total} · ${pct(have, total)}%</div>
    </div>
    <div class="prog-row">
      <div class="prog-lbl">${t(L, 'colDeck')}</div>
      ${bar(DECKS, ds, false)}
      <div class="prog-val">${nums(DECKS, ds)}</div>
    </div>
    <div class="prog-row">
      <div class="prog-lbl">${t(L, 'colExpansion')}</div>
      ${bar(EXPS, es, false)}
      <div class="prog-val">${nums(EXPS, es)}</div>
    </div>
  </div>`;
}

function renderToolbar(): string {
  const L = state.lang;
  const opt = (v: string, cur: string, labelText: string) =>
    `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(labelText)}</option>`;
  const f = state.f;

  return `<div class="tools">
    <button class="btn primary" id="btn-mark">✓ ${t(L, 'markVisible')}</button>
    <button class="btn" id="btn-unmark">✕ ${t(L, 'unmarkVisible')}</button>
    <button class="btn" id="btn-undo"${state.undo.length ? '' : ' disabled'}>↶ ${t(L, 'undo')}</button>
    <span class="sep"></span>
    <input class="inp w-name" id="f-name" placeholder="${t(L, 'colName')}: …" value="${esc(f.name)}">
    <input class="inp w-kind" id="f-kind" placeholder="${t(L, 'colKind')}: …" value="${esc(f.kind)}">
    <input class="inp w-row" id="f-row" placeholder="${t(L, 'colRow')}: …" value="${esc(f.row)}">
    <input class="inp w-terr" id="f-terr" placeholder="${t(L, 'colTerritory')}: …" value="${esc(f.territory)}">
    <span class="sep"></span>
    <select class="sel" id="f-deck">
      ${opt('all', f.deck, `${t(L, 'filterDeck')}: ${t(L, 'filterAll')}`)}
      ${DECKS.map(d => opt(d.en, f.deck, L === 'ru' ? d.ru : d.en)).join('')}
    </select>
    <select class="sel" id="f-exp">
      ${opt('all', f.expansion, `${t(L, 'filterExpansion')}: ${t(L, 'filterAll')}`)}
      ${EXPS.map(d => opt(d.en, f.expansion, L === 'ru' ? d.ru : d.en)).join('')}
    </select>
    <select class="sel" id="f-found">
      ${opt('all', f.found, `${t(L, 'colCollected')}: ${t(L, 'filterAll')}`)}
      ${opt('yes', f.found, t(L, 'filterFound'))}
      ${opt('no', f.found, t(L, 'filterMissing'))}
    </select>
    <button class="btn" id="btn-reset">${t(L, 'resetFilters')}</button>
  </div>`;
}

// ---------- отрисовка: таблица ----------
const COLS: Array<{ f: SortField; k: 'colName' | 'colKind' | 'colRow' | 'colDeck' | 'colExpansion' | 'colTerritory' | 'colObtain'; w: string }> = [
  { f: 'name', k: 'colName', w: '22%' },
  { f: 'kind', k: 'colKind', w: '9%' },
  { f: 'row', k: 'colRow', w: '11%' },
  { f: 'deck', k: 'colDeck', w: '16%' },
  { f: 'expansion', k: 'colExpansion', w: '14%' },
  { f: 'type', k: 'colObtain', w: '17%' },
];

function renderTable(list: Card[]): string {
  const L = state.lang;
  const head = COLS.map(c => {
    const sorted = state.sort.field === c.f;
    const arrow = sorted ? (state.sort.dir === 1 ? '▲' : '▼') : '↕';
    return `<th style="width:${c.w}"><div class="th${sorted ? ' sorted' : ''}" data-sort="${c.f}">
      ${t(L, c.k)} <span class="arrow">${arrow}</span></div></th>`;
  }).join('');

  const body = list.map(c => {
    const on = state.checked.has(c.id);
    const deck = DECKS.find(d => d.en === c.deck);
    return `<tr data-id="${c.id}" class="${on ? 'done' : ''}">
      <td class="c-box"><input class="chk" type="checkbox" ${on ? 'checked' : ''}></td>
      <td class="c-name" title="${esc(baseName(tr(c, 'name')))} · ${esc(c.kindRu || '')}">${esc(tr(c, 'name'))}</td>
      <td>${esc(kindPart(tr(c, 'kind'), 0))}</td>
      <td class="muted">${esc(kindPart(tr(c, 'kind'), 1))}</td>
      <td><span class="tag" style="background:${deck?.color ?? '#666'}">${esc(tr(c, 'deck'))}</span></td>
      <td class="muted">${esc(tr(c, 'expansion'))}</td>
      <td title="${esc(tr(c, 'details'))}">${esc(tr(c, 'type'))}</td>
    </tr>`;
  }).join('');

  return `<table><thead><tr><th class="c-box"></th>${head}</tr></thead><tbody>${
    list.length ? body : `<tr><td colspan="7" class="empty">${t(L, 'noResults')}</td></tr>`
  }</tbody></table>`;
}

function renderFooter(list: Card[]): string {
  const L = state.lang;
  return `<div class="foot">
    <span>${t(L, 'cardsShown', list.length, CARDS.length)}</span>
    <span>·</span>
    <span>${t(L, 'collected')}: <b>${state.checked.size}</b>/${CARDS.length}</span>
    <span>·</span>
    <span>${META.unique} ${L === 'ru' ? 'уникальных' : 'unique'}</span>
    <span class="grow"></span>
    <span>${t(L, 'source')}</span>
  </div>`;
}

// ---------- сборка ----------
function renderAll() {
  hideTip();
  const list = visibleCards();
  document.documentElement.dataset.theme = state.theme;
  const scroller = document.querySelector('.wrap');
  const scrollTop = scroller ? scroller.scrollTop : 0;

  root.innerHTML = renderHeader() + renderProgress() + renderToolbar() +
    `<div class="wrap">${renderTable(list)}</div>` + renderFooter(list);

  const sc = document.querySelector('.wrap');
  if (sc) sc.scrollTop = scrollTop;
  bindEvents();
}

/** Перерисовывает только таблицу и футер.
 *  Поле поиска и остальной тулбар не трогаем — поэтому фокус не теряется,
 *  а результаты фильтра обновляются сразу на каждую букву. */
function renderTableOnly() {
  hideTip();
  const wrap = document.querySelector('.wrap');
  if (!wrap) { renderAll(); return; }
  const list = visibleCards();
  const scrollTop = wrap.scrollTop;

  wrap.outerHTML = `<div class="wrap">${renderTable(list)}</div>`;

  const foot = document.querySelector('.foot');
  if (foot) foot.outerHTML = renderFooter(list);

  const sc = document.querySelector('.wrap');
  if (sc) sc.scrollTop = scrollTop;

  bindTableEvents();
}

// ---------- события ----------
let tipTimer = 0;
function bindEvents() {
  const byId = (id: string) => document.getElementById(id);

  byId('btn-theme')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    renderAll();
  });
  byId('btn-lang')?.addEventListener('click', () => {
    state.lang = state.lang === 'ru' ? 'en' : 'ru';
    renderAll();
  });
  byId('btn-dir')?.addEventListener('click', () => { void dataDir(); });
  byId('btn-export')?.addEventListener('click', () => { void doExport(); });
  byId('btn-import')?.addEventListener('click', () => { void doImport(); });

  byId('btn-mark')?.addEventListener('click', async () => {
    const list = visibleCards();
    const n = list.filter(c => !state.checked.has(c.id)).length;
    if (!n) return;
    if (await ask('mark', n)) { pushUndo(); list.forEach(c => state.checked.add(c.id)); scheduleSave(); renderAll(); }
  });
  byId('btn-unmark')?.addEventListener('click', async () => {
    const list = visibleCards();
    const n = list.filter(c => state.checked.has(c.id)).length;
    if (!n) return;
    if (await ask('unmark', n)) { pushUndo(); list.forEach(c => state.checked.delete(c.id)); scheduleSave(); renderAll(); }
  });
  byId('btn-undo')?.addEventListener('click', undo);
  byId('btn-reset')?.addEventListener('click', () => {
    state.f = { name: '', kind: '', row: '', territory: '', deck: 'all', expansion: 'all', found: 'all' };
    renderAll();
  });

  const txt = (id: string, key: 'name' | 'kind' | 'row' | 'territory') => {
    const e = byId(id) as HTMLInputElement | null;
    e?.addEventListener('input', () => {
      state.f[key] = e.value;
      // перерисовываем только таблицу: поле ввода остаётся живым, фокус не теряется
      renderTableOnly();
    });
  };
  txt('f-name', 'name'); txt('f-kind', 'kind'); txt('f-row', 'row'); txt('f-terr', 'territory');

  const sel = (id: string, key: 'deck' | 'expansion' | 'found') => {
    const e = byId(id) as HTMLSelectElement | null;
    e?.addEventListener('change', () => { state.f[key] = e.value as never; renderTableOnly(); });
  };
  sel('f-deck', 'deck'); sel('f-exp', 'expansion'); sel('f-found', 'found');

  bindTableEvents();
}

/** События элементов таблицы: сортировка по столбцам и клики по строкам.
 *  Вынесено отдельно, потому что таблица перерисовывается чаще, чем тулбар. */
function bindTableEvents() {
  hideTip();

  document.querySelectorAll<HTMLElement>('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const f = th.dataset.sort as SortField;
      if (state.sort.field === f) state.sort.dir = state.sort.dir === 1 ? -1 : 1;
      else state.sort = { field: f, dir: 1 };
      renderAll();
    });
  });

  document.querySelectorAll<HTMLElement>('tbody tr').forEach(trr => {
    const id = Number(trr.dataset.id);
    const card = BY_ID.get(id);
    if (!card) return;
    const box = trr.querySelector<HTMLElement>('td.c-box');
    const cb = trr.querySelector<HTMLInputElement>('input.chk');

    const flip = () => {
      pushUndo();
      if (state.checked.has(id)) state.checked.delete(id); else state.checked.add(id);
      scheduleSave();
      // точечное обновление — без полной перерисовки, чтобы отклик был мгновенным
      cb!.checked = state.checked.has(id);
      trr.classList.toggle('done', state.checked.has(id));
      refreshCounts();
    };
    // Клик по самому квадратику: гасим всплытие, чтобы flip() не сработал
    // второй раз через ячейку. preventDefault тут НЕЛЬЗЯ — он отменяет
    // и визуальную установку галочки (строка зеленеет, а квадрат пустой).
    cb?.addEventListener('click', ev => { ev.stopPropagation(); flip(); });
    // Клик по остальной части ячейки.
    box?.addEventListener('click', ev => { if (ev.target !== cb) flip(); });

    const nameCell = trr.querySelector<HTMLElement>('td.c-name');
    nameCell?.addEventListener('mouseenter', () => {
      window.clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => showTip(card, nameCell!), 180);
    });
    nameCell?.addEventListener('mouseleave', () => {
      window.clearTimeout(tipTimer);
      // элемент подсказки ищем заново: к моменту привязки его ещё не было
      tipTimer = window.setTimeout(() => hideTip(), 90);
    });
  });
}

/** Обновляет только полосы прогресса и цифры — дёшево и без мигания. */
function refreshCounts() {
  const prog = document.querySelector('.prog');
  if (prog) prog.outerHTML = renderProgress();
  const foot = document.querySelector('.foot');
  if (foot) foot.outerHTML = renderFooter(visibleCards());
  const btn = document.getElementById('btn-undo');
  if (btn) (btn as HTMLButtonElement).disabled = state.undo.length === 0;
}

function ensureTip(): HTMLElement {
  let el = document.getElementById('tip');
  if (!el) { el = document.createElement('div'); el.id = 'tip'; document.body.appendChild(el); }
  return el;
}

/** Прячет всплывающую картинку (безопасно, если её ещё нет). */
function hideTip() {
  window.clearTimeout(tipTimer);
  document.getElementById('tip')?.classList.remove('show');
}

function showTip(c: Card, anchor: HTMLElement) {
  const tip = ensureTip();
  const L = state.lang;
  const img = c.image
    ? `<img src="${'img/' + c.image}" alt="" />`
    : `<div class="none">${t(L, 'noImage')}</div>`;
  tip.innerHTML = img;
  tip.classList.add('show');
  const r = anchor.getBoundingClientRect();
  const tr2 = tip.getBoundingClientRect();
  let left = r.right + 10;
  if (left + tr2.width > window.innerWidth - 8) left = r.left - tr2.width - 10;
  let top = r.top;
  if (top + tr2.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - tr2.height - 8);
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = top + 'px';
}

// ---------- экспорт / импорт ----------
async function doExport() {
  const p = await saveFile(JSON.stringify({ v: 1, saved: new Date().toISOString(), checked: [...state.checked] }));
  if (p) toast(t(state.lang, 'exported') + ' ' + p);
}
async function doImport() {
  const txtIn = await openFile();
  if (!txtIn) return;
  try {
    const obj = JSON.parse(txtIn) as { checked?: number[] };
    if (!Array.isArray(obj.checked)) throw new Error('bad');
    pushUndo();
    // число + существующий id: отсекая строки, «фантомные» и отрицательные значения
    state.checked = new Set(obj.checked.filter(n => Number.isInteger(n) && BY_ID.has(n)));
    scheduleSave();
    renderAll();
    toast(t(state.lang, 'loaded'));
  } catch {
    toast(t(state.lang, 'importFailed'));
  }
}

// ---------- старт ----------
async function main() {
  try {
    const raw = await loadProgress();
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      // тот же фильтр, что и при импорте: привязка к существующим id, а не к длине массива
      state.checked = new Set(arr.filter(n => Number.isInteger(n) && BY_ID.has(n)));
    }
  } catch { /* начинаем с нуля */ }
  document.documentElement.dataset.theme = state.theme;
  renderAll();
}

void main();
