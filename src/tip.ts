// Всплывающая картинка карты при наведении (общая для таблицы и гайда).

let tipTimer = 0;

function ensureTip(): HTMLElement {
  let el = document.getElementById('tip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tip';
    document.body.appendChild(el);
  }
  return el;
}

/** Прячет всплывающую картинку (безопасно, если её ещё нет). */
export function hideTip(): void {
  window.clearTimeout(tipTimer);
  document.getElementById('tip')?.classList.remove('show');
}

/** Отложенный вызов (показ/скрытие) с отменой предыдущего таймера. */
export function tipDelay(fn: () => void, ms: number): void {
  window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(fn, ms);
}

/** Показывает картинку карты рядом с элементом-якорем. */
export function showTip(image: string | null, noneText: string, anchor: HTMLElement): void {
  const tip = ensureTip();
  tip.innerHTML = image
    ? `<img src="${image}" alt="" />`
    : `<div class="none">${noneText}</div>`;
  tip.classList.add('show');
  const r = anchor.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  let left = r.right + 10;
  if (left + tr.width > window.innerWidth - 8) left = r.left - tr.width - 10;
  let top = r.top;
  if (top + tr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - tr.height - 8);
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = top + 'px';
}
