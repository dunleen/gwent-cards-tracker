// Экран «Гайд по сбору карт»: переработанное руководство knon_20 из
// docs/guide.md. Синтаксис, который понимает парсер:
//   '## Заголовок'            — раздел со счётчиком собранных копий;
//   '- [ ] Имя карты (1 из N)' — копия карты: галочка переключает её в трекере,
//                                наведение на имя показывает картинку;
//   '> текст'                 — врезка «Важно!»;
//   '![](img/guide/…jpg)'     — карта-схема;
//   '- текст'                 — обычный пункт списка;
//   '### …', '---'            — мелкий заголовок, разделитель.
// Повторные упоминания одной копии — синхронные галочки.

import guideMdRaw from '../docs/guide.md?raw'
import cardsData from './data/cards.json'
import type { Lang } from './i18n'
import { t } from './i18n'
import { hideTip, showTip, tipDelay } from './tip'

interface GuideCard { id: number; nameRu: string; image: string | null }
interface GuideDeps {
  lang: () => Lang;
  /** Текущее состояние копии в трекере. */
  isChecked: (id: number) => boolean;
  /** Переключение копии из гайда (undo, сохранение, полосы прогресса). */
  onToggle: (id: number) => void;
  /** Перерисовать таблицу после закрытия гайда. */
  refreshTable: () => void;
}
interface Section { title: string | null; html: string[] }

let deps: GuideDeps | null = null;
let box: HTMLElement | null = null;

// имя как в трекере → карта. Нумерация копий в md совпадает с трекером.
const CARD_BY_NAME = new Map<string, GuideCard>(
  (cardsData as { cards: GuideCard[] }).cards.map(c => [c.nameRu, c])
);

// ---------- мини-поддержка markdown ----------
const esc = (s: string): string =>
  s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]!));

function inline(s: string): string {
  let out = s;
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  // ссылки рендерим текстом с подсказкой: переходить наружу не нужно
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt: string, url: string) =>
    `<span class="g-link" title="${esc(url.trim())}">${txt}</span>`);
  return out;
}

/** Разбирает md один раз; результат переиспользуется при каждом открытии. */
function parse(): Section[] {
  const sections: Section[] = [{ title: null, html: [] }];
  let paras = 0;      // счётчик строк текущего абзаца
  let list: string[] = [];      // накопленные пункты ul
  let cardsBuf: string[] = [];  // накопленные подряд галочки
  let notes: string[] = [];     // накопленные строки врезки

  const flush = () => {
    if (list.length) {
      sections[sections.length - 1].html.push(
        `<ul class="g-ul">${list.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`);
      list = [];
    }
    if (cardsBuf.length) {
      sections[sections.length - 1].html.push(
        `<div class="g-cards">${cardsBuf.join('')}</div>`);
      cardsBuf = [];
    }
    if (notes.length) {
      sections[sections.length - 1].html.push(
        `<div class="g-note">${notes.map(x => `<p>${inline(x)}</p>`).join('')}</div>`);
      notes = [];
    }
    paras = 0;
  };

  for (const raw of guideMdRaw.split(/\r?\n/)) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;

    if (!line) { flush(); paras = 0; continue; }

    if ((m = line.match(/^##\s+(.+)$/))) { flush(); sections.push({ title: m[1].trim(), html: [] }); continue; }
    if ((m = line.match(/^###\s+(.+)$/))) { flush(); sections[sections.length - 1].html.push(`<h3 class="g-h3">${inline(m[1].trim())}</h3>`); continue; }
    if (line === '---') { flush(); sections[sections.length - 1].html.push('<hr class="g-hr" />'); continue; }

    if ((m = line.match(/^!\[(.*)\]\((.+)\)$/))) {
      flush();
      const src = m[2].trim();
      sections[sections.length - 1].html.push(
        `<figure class="g-fig"><img loading="lazy" src="${esc(src)}" alt="${esc(m[1])}" /></figure>`);
      continue;
    }

    if ((m = line.match(/^>\s*(.*)$/))) { if (paras) flush(); if (m[1]) notes.push(m[1]); paras = 0; list = []; cardsBuf = []; continue; }

    if ((m = line.match(/^- \[([ xX])\]\s*(.+)$/))) {
      if (paras) flush();
      const card = CARD_BY_NAME.get(m[2].trim());
      if (!card) { // сбой авторинга: имя не из трекера — показываем без галочки
        flush();
        sections[sections.length - 1].html.push(`<div class="g-miss">${inline(m[2])}</div>`);
        continue;
      }
      cardsBuf.push(
        `<div class="g-card"><label><input class="chk" type="checkbox" data-id="${card.id}" data-sec="${sections.length - 1}">` +
        `<span class="g-card-name" data-id="${card.id}">${esc(m[2].trim())}</span></label></div>`);
      continue;
    }

    if ((m = line.match(/^-\s+(.+)$/))) { if (paras) flush(); list.push(m[1]); continue; }

    // обычный абзац (строка текста)
    flush();
    if (paras === 0) sections[sections.length - 1].html.push('');
    sections[sections.length - 1].html.push(`<p class="g-p">${inline(line)}</p>`);
    paras++;
  }
  flush();
  return sections;
}

const sections = parse();

// ---------- вёрстка ----------
function secHtml(sec: Section, idx: number): string {
  const head = sec.title === null ? '' :
    `<h2 class="g-sec-t"><span>${inline(sec.title)}</span><span class="g-count" data-sec="${idx}">–</span></h2>`;
  return `<section class="g-sec">${head}${sec.html.join('\n')}</section>`;
}

function rebuild(): void {
  if (!box) return;
  const L = deps!.lang();
  box.innerHTML = `
    <div class="g-hdr">
      <button class="btn" id="btn-guide-back">&#8592; ${t(L, 'guideBack')}</button>
      <div class="g-title">${t(L, 'guideTitle')}</div>
      <span class="grow"></span>
      <span class="g-count" id="g-total"></span>
    </div>
    <div class="g-body"><div class="g-col">${sections.map(secHtml).join('')}</div></div>`;

  const body = box.querySelector('.g-body')!;

  // клик по галочке → трекер; остальные галочки той же копии и счётчики — на месте
  body.addEventListener('change', ev => {
    const input = (ev.target as HTMLElement).closest('input[data-id]') as HTMLInputElement | null;
    if (!input) return;
    const id = Number(input.dataset.id);
    deps!.onToggle(id);
    box!.querySelectorAll<HTMLInputElement>(`.g-body input[data-id="${id}"]`)
      .forEach(i => { i.checked = deps!.isChecked(id); });
    updateCounts();
  });

  // наведение на имя карты → всплывающая картинка
  body.addEventListener('mouseover', ev => {
    const nm = (ev.target as HTMLElement).closest('.g-card-name') as HTMLElement | null;
    if (!nm) return;
    const card = CARD_BY_NAME_BY_ID.get(Number(nm.dataset.id));
    if (!card) return;
    const L2 = deps!.lang();
    const img = card.image ? 'img/' + card.image : null;
    tipDelay(() => showTip(img, t(L2, 'noImage'), nm), 180);
  });
  body.addEventListener('mouseout', ev => {
    if (!(ev.target as HTMLElement).closest('.g-card-name')) return;
    tipDelay(hideTip, 90);
  });

  box.querySelector('#btn-guide-back')!.addEventListener('click', closeGuide);
  updateCounts();
}

// карта по id — для тултипов
const CARD_BY_NAME_BY_ID = new Map<number, GuideCard>([...CARD_BY_NAME.values()].map(c => [c.id, c]));

// ---------- открытие и закрытие ----------
const onKey = (ev: KeyboardEvent): void => {
  if (ev.key === 'Escape') closeGuide();
};

export function guideOpen(): boolean {
  return !!box && !box.hidden;
}

export function openGuide(): void {
  if (!box) {
    box = document.createElement('div');
    box.id = 'guide';
    box.hidden = true;
    document.body.appendChild(box);
  }
  rebuild();
  box.hidden = false;
  document.addEventListener('keydown', onKey);
  hideTip();
  const body = box.querySelector('.g-body');
  if (body) body.scrollTop = 0;
}

export function closeGuide(): void {
  if (!box || box.hidden) return;
  box.hidden = true;
  document.removeEventListener('keydown', onKey);
  hideTip();
  deps?.refreshTable();
}

/** main.ts передаёт связи с трекером (состояние, переключение, обновление таблицы). */
export function initGuide(d: GuideDeps): void {
  deps = d;
}

/** Синхронизирует все галочки с состоянием трекера и обновляет счётчики. */
function updateCounts(): void {
  if (!box) return;
  const inputs = box.querySelectorAll<HTMLInputElement>('.g-body input[data-id]');
  const perSec = new Map<string, { have: number; total: number }>();
  let have = 0, total = 0;
  inputs.forEach(i => {
    i.checked = deps!.isChecked(Number(i.dataset.id));
    const s = i.dataset.sec ?? '0';
    const e = perSec.get(s) ?? { have: 0, total: 0 };
    e.total++;
    if (i.checked) e.have++;
    perSec.set(s, e);
  });
  perSec.forEach((e, s) => {
    have += e.have; total += e.total;
    const sp = box!.querySelector<HTMLElement>(`.g-count[data-sec="${s}"]`);
    if (sp) {
      sp.textContent = `${e.have}/${e.total}`;
      sp.classList.toggle('full', e.have === e.total);
    }
  });
  const tot = document.getElementById('g-total');
  if (tot) {
    tot.textContent = `${have}/${total}`;
    tot.classList.toggle('full', total > 0 && have === total);
  }
}
