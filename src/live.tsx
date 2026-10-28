import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BASE_HEROES } from './data/heroes';
import { loadCached, type Loaded } from './lib/api';
import { mergeCatalog, STATIC_CATALOG, type Catalog } from './lib/catalog';
import { fetchHeroes, fetchIcons, fetchPlayoffs, fetchStandings, fetchVersion, type HeroRaw } from './lib/fetchers';
import {
  EMPTY_ICONS,
  mergeHeroes,
  nameKey,
  validArrayCache,
  validHeroCache,
  validIconsCache,
  validPlayoffsCache,
  type HeroSync,
  type Icons,
  type LivePlayoffs,
  type LiveStanding,
} from './lib/live';
import type { Hero } from './types';

export interface Slice<T> {
  state: 'loading' | 'ok' | 'stale' | 'error';
  data: T | null;
  at: number | null;
  error: string | null;
}

const loading = <T,>(): Slice<T> => ({ state: 'loading', data: null, at: null, error: null });
const KEYS = {
  heroes: 'mbl:live:heroes:v2',
  icons: 'mbl:live:icons:v5',
  playoffs: 'mbl:live:playoffs:v1',
  standings: 'mbl:live:standings:v1',
  version: 'mbl:live:version:v1',
};
const MIN = 60_000;
const TTL = { heroes: 12 * 60 * MIN, icons: 12 * 60 * MIN, playoffs: 5 * MIN, standings: 15 * MIN, version: 60 * MIN };

interface LiveCtx {
  heroes: Slice<HeroSync>;
  /** Daftar hero dasar: data statis yang sudah digabung dengan API (atau statis saja kalau API gagal). */
  heroList: Hero[];
  /** Status pengambilan ikon item, spell, dan talent. */
  images: Slice<Icons>;
  /** Peta nameKey(nama) -> URL ikon. Selalu ada; kosong kalau API gagal. */
  icons: Icons;
  /** Talent dan battle spell: data statis ditambah yang baru dari API. */
  catalog: Catalog;
  playoffs: Slice<LivePlayoffs>;
  standings: Slice<LiveStanding[]>;
  /** Versi game terbaru yang tercatat di API. Server (Original/Advanced) tidak disebut oleh API. */
  version: Slice<string>;
  reload: () => void;
}

const Ctx = createContext<LiveCtx | null>(null);

function toSlice<T>(l: Loaded<T>): Slice<T> {
  return { state: l.stale ? 'stale' : 'ok', data: l.data, at: l.at, error: l.stale ? 'Server tidak terjangkau, memakai cache lama' : null };
}
const failed = <T,>(e: unknown): Slice<T> => ({
  state: 'error',
  data: null,
  at: null,
  error: e instanceof Error ? e.message : 'Gagal memuat',
});

export function LiveProvider({ children }: { children: ReactNode }) {
  const [heroRaw, setHeroRaw] = useState<Slice<HeroRaw>>(loading);
  const [images, setImages] = useState<Slice<Icons>>(loading);
  const [playoffs, setPlayoffs] = useState<Slice<LivePlayoffs>>(loading);
  const [standings, setStandings] = useState<Slice<LiveStanding[]>>(loading);
  const [version, setVersion] = useState<Slice<string>>(loading);
  const run = useRef(0);

  const load = useCallback((force: boolean) => {
    const id = ++run.current;
    const alive = () => run.current === id;
    const go = <T,>(set: (s: Slice<T>) => void, p: Promise<Loaded<T>>) =>
      p.then(
        (l) => alive() && set(toSlice(l)),
        (e) => alive() && set(failed<T>(e)),
      );
    void go(setHeroRaw, loadCached(KEYS.heroes, TTL.heroes, fetchHeroes, validHeroCache, force));
    void go(setImages, loadCached(KEYS.icons, TTL.icons, fetchIcons, validIconsCache, force));
    void go(setPlayoffs, loadCached(KEYS.playoffs, TTL.playoffs, fetchPlayoffs, validPlayoffsCache, force));
    void go(setStandings, loadCached(KEYS.standings, TTL.standings, fetchStandings, validArrayCache, force));
    void go(setVersion, loadCached(KEYS.version, TTL.version, fetchVersion, (v) => typeof v === 'string', force));
  }, []);

  useEffect(() => {
    load(false);
    return () => {
      run.current++;
    };
  }, [load]);

  const reload = useCallback(() => {
    setHeroRaw(loading);
    setImages(loading);
    setPlayoffs(loading);
    setStandings(loading);
    setVersion(loading);
    load(true);
  }, [load]);

  const merged = useMemo(() => {
    if (!heroRaw.data) return null;
    return mergeHeroes(BASE_HEROES, heroRaw.data.names, heroRaw.data.positions);
  }, [heroRaw.data]);

  const heroes: Slice<HeroSync> = useMemo(() => {
    if (heroRaw.state === 'loading' || heroRaw.state === 'error' || !merged) return { ...heroRaw, data: null };
    return { ...heroRaw, state: merged.sync.usable ? heroRaw.state : 'error', error: merged.sync.usable ? heroRaw.error : 'Daftar hero dari API tidak masuk akal, memakai data statis', data: merged.sync };
  }, [heroRaw, merged]);

  // Gambar hero dari API ditempelkan ke daftar hero (cocok lewat nama). Yang tidak cocok tetap tanpa gambar.
  const heroList = useMemo(() => {
    const list = merged ? merged.heroes : BASE_HEROES;
    const imgs = heroRaw.data?.images;
    if (!imgs) return list;
    return list.map((h) => {
      const img = imgs[nameKey(h.name)];
      return img ? { ...h, img } : h;
    });
  }, [merged, heroRaw.data]);

  const catalog = useMemo(() => (images.data ? mergeCatalog(images.data.catalog) : STATIC_CATALOG), [images.data]);

  const value: LiveCtx = {
    heroes,
    heroList,
    images,
    icons: images.data ?? EMPTY_ICONS,
    catalog,
    playoffs,
    standings,
    version,
    reload,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive(): LiveCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLive harus dipakai di dalam LiveProvider');
  return c;
}

export const ago = (at: number | null): string => {
  if (!at) return '';
  const m = Math.max(0, Math.round((Date.now() - at) / MIN));
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`;
};
