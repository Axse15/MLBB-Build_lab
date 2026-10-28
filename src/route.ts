import { useEffect, useState } from 'react';

export type Page = 'dashboard' | 'builder' | 'team' | 'community' | 'patch' | 'mpl' | 'profile' | 'settings';
const PAGES: Page[] = ['dashboard', 'builder', 'team', 'community', 'patch', 'mpl', 'profile', 'settings'];

export interface Route {
  page: Page;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const page = (PAGES as string[]).includes(path) ? (path as Page) : 'dashboard';
  return { page, params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(page: Page): void {
  window.location.hash = `#/${page}`;
}

/** Hapus query dari hash tanpa memicu navigasi (dipakai setelah impor tautan bagikan). */
export function clearQuery(page: Page): void {
  try {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${page}`);
  } catch {
    /* beberapa sandbox melarang replaceState */
  }
}

/** Hash untuk tautan internal, mis. hashFor('community', { post: id }) -> '#/community?post=…'. Nilai kosong dibuang. */
export function hashFor(page: Page, params?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  const s = q.toString();
  return `#/${page}${s ? `?${s}` : ''}`;
}

export function shareUrl(page: Page, payload: string): string {
  return `${window.location.origin}${window.location.pathname}#/${page}?s=${payload}`;
}
