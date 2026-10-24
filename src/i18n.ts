export type Lang = 'ru' | 'en';
export type Theme = 'dark' | 'light';

/** Пара строк: [английский, русский] — в этом порядке. */
type Pair = [string, string];

const S = {
  appTitle: ['Gwent Cards Checklist', 'Счётчик карт Гвинт'],
  gameLine: ['The Witcher 3, patch 1.32 + Hearts of Stone + Blood and Wine', 'Ведьмак 3, патч 1.32 + Камни Сердца + Кровь и Вино'],

  overall: ['Overall', 'Всего'],
  collected: ['Collected', 'Собрано'],

  markAll: ['Mark all', 'Отметить все'],
  unmarkAll: ['Unmark all', 'Снять все'],
  undo: ['Undo', 'Отменить'],
  undoNothing: ['Nothing to undo', 'Отменять нечего'],

  search: ['Search', 'Поиск'],
  resetFilters: ['Reset filters', 'Сбросить фильтры'],
  filterDeck: ['Deck', 'Колода'],
  filterExpansion: ['Content', 'Содержимое'],
  filterKind: ['Card type', 'Тип карты'],
  filterAll: ['All', 'Все'],

  colName: ['Name', 'Название'],
  colKind: ['Type', 'Тип карты'],
  colRow: ['Row', 'Ряд'],
  colDeck: ['Deck', 'Колода'],
  colExpansion: ['Content', 'Содержимое'],
  colTerritory: ['Territory', 'Территория'],
  colObtain: ['How to get', 'Способ получения'],
  colCollected: ['Found', 'Есть'],

  found: ['yes', 'есть'],
  notFound: ['no', 'нет'],
  filterFound: ['only collected', 'только собранные'],
  filterMissing: ['only missing', 'только несобранные'],

  noImage: ['Picture unavailable', 'Картинка недоступна'],
  effect: ['Effect', 'Эффект'],
  gameText: ['In-game description', 'Описание в игре'],

  exportBtn: ['Export to file', 'Сохранить в файл'],
  importBtn: ['Import from file', 'Загрузить из файла'],
  openData: ['Data folder', 'Папка с данными'],
  themeBtn: ['Toggle theme', 'Сменить тему'],

  saved: ['Saved', 'Сохранено'],
  loaded: ['Loaded', 'Загружено'],
  exported: ['Exported to:', 'Файл сохранён:'],
  importFailed: ['Could not read the file', 'Не удалось прочитать файл'],
  exportFailed: ['Could not save the file', 'Не удалось сохранить файл'],

  cardsShown: ['Showing {0} of {1}', 'Показано {0} из {1}'],
  source: ['Data and images: Witcher Wiki, CC BY-SA license', 'Данные и картинки: Вики Ведьмака, лицензия CC BY-SA'],
  noResults: ['Nothing found', 'Ничего не найдено'],
} satisfies Record<string, Pair>;

export type StringKey = keyof typeof S;

export function t(lang: Lang, key: StringKey, ...args: (string | number)[]): string {
  const pair = S[key];
  let s = lang === 'ru' ? pair[1] : pair[0];
  return s.replace(/\{(\d+)\}/g, (m, i) => {
    const v = args[Number(i)];
    return v === undefined || v === null ? m : String(v);
  });
}
