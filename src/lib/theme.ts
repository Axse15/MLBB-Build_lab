import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';
export const THEME_KEY = 'mbl:theme';
const META_COLOR: Record<Theme, string> = { dark: '#0b111d', light: '#f3f5f9' };

export const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light';

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[t]);
}

// Satu sumber kebenaran untuk semua komponen (sidebar dan halaman Pengaturan memakai tema yang sama).
const listeners = new Set<() => void>();
const current = (): Theme => {
  const d = document.documentElement.dataset.theme;
  return isTheme(d) ? d : (storedTheme() ?? systemTheme());
};

function setTheme(t: Theme, persist: boolean): void {
  applyTheme(t);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* penyimpanan diblokir: tema tetap berlaku di sesi ini */
    }
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Tema aktif. Tanpa pilihan tersimpan, mengikuti pengaturan sistem; pilihan baru disimpan setelah tombol ditekan. */
export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, current, () => 'dark' as Theme);
  const set = useCallback((t: Theme) => setTheme(t, true), []);
  const toggle = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark', true), []);
  return { theme, toggle, set };
}
