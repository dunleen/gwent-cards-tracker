import { invoke } from '@tauri-apps/api/core';

// В Tauri работаем через Rust. При запуске в обычном браузере (для отладки)
// используем localStorage — интерфейс остаётся полностью рабочим.
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const KEY = 'gwent-progress';

export const save = async (contents: string): Promise<void> => {
  if (inTauri) return void (await invoke('save_progress', { contents }));
  try { localStorage.setItem(KEY, contents); } catch { /* переполнено или отключено */ }
};

export const load = async (): Promise<string | null> => {
  if (inTauri) return await invoke('load_progress');
  try { return localStorage.getItem(KEY); } catch { return null; }
};

export const saveFile = async (contents: string): Promise<string | null> => {
  if (inTauri) return await invoke('export_progress', { contents });
  const name = `gwent-progress-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  return name;
};

export const openFile = async (): Promise<string | null> => {
  if (inTauri) return await invoke('import_progress');
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.addEventListener('change', () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve).catch(() => resolve(null));
    });
    inp.click();
  });
};

export const dataDir = async (): Promise<string | null> => {
  if (inTauri) return await invoke('open_data_dir');
  try { localStorage.setItem('gwent-ping', '1'); localStorage.removeItem('gwent-ping'); } catch { /* noop */ }
  return null;
};
