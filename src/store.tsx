import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { slug } from './data/heroes';
import { useLive } from './live';
import { withCustom } from './lib/live';
import type { Build, Hero, Team } from './types';

/** State yang disimpan di localStorage. Jika storage diblokir, tetap jalan tanpa persist. */
export function usePersistent<T>(key: string, initial: T, valid?: (v: unknown) => boolean) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed: unknown = JSON.parse(raw);
      return !valid || valid(parsed) ? (parsed as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage penuh atau diblokir */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Baca nilai dari localStorage tanpa menulis apa pun. null = tidak ada, rusak, atau tidak lolos validasi. */
export function readPersistent<T>(key: string, valid: (v: unknown) => boolean): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

interface Store {
  heroes: Hero[];
  heroById: (id: string) => Hero | undefined;
  heroMap: Map<string, Hero>;
  addHero: (h: Omit<Hero, 'id' | 'custom'>) => Hero;
  removeHero: (id: string) => void;
  /** Hero kustom milik perangkat ini (untuk cadangan). */
  customHeroes: Hero[];
  /** Gabungkan hasil pemulihan cadangan: yang sudah ada (id sama) tidak ditimpa. */
  importAll: (data: { heroes: Hero[]; builds: Build[]; teams: Team[] }) => void;
  builds: Build[];
  buildById: (id: string) => Build | undefined;
  saveBuild: (b: Build) => void;
  deleteBuild: (id: string) => void;
  teams: Team[];
  saveTeam: (t: Team) => void;
  deleteTeam: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customHeroes, setCustomHeroes] = usePersistent<Hero[]>('mbl:heroes:v1', [], Array.isArray);
  const [builds, setBuilds] = usePersistent<Build[]>('mbl:builds:v1', [], Array.isArray);
  const [teams, setTeams] = usePersistent<Team[]>('mbl:teams:v1', [], Array.isArray);

  const { heroList } = useLive();
  const heroes = useMemo(
    () => withCustom(heroList, customHeroes).sort((a, b) => a.name.localeCompare(b.name)),
    [heroList, customHeroes],
  );
  const heroMap = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const buildMap = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds]);

  const addHero = useCallback(
    (h: Omit<Hero, 'id' | 'custom'>): Hero => {
      let id = slug(h.name) || 'hero';
      if (heroMap.has(id)) id = `${id}-kustom`;
      let n = 2;
      while (heroMap.has(id)) id = `${slug(h.name)}-kustom-${n++}`;
      const hero: Hero = { ...h, id, custom: true };
      setCustomHeroes((prev) => [...prev, hero]);
      return hero;
    },
    [heroMap, setCustomHeroes],
  );

  const store: Store = {
    heroes,
    heroMap,
    heroById: (id) => heroMap.get(id),
    addHero,
    removeHero: (id) => setCustomHeroes((p) => p.filter((h) => h.id !== id)),
    customHeroes,
    importAll: ({ heroes: hs, builds: bs, teams: ts }) => {
      const fresh = <T extends { id: string }>(prev: T[], add: T[]) => [...add.filter((x) => !prev.some((p) => p.id === x.id)), ...prev];
      if (hs.length) setCustomHeroes((p) => [...p, ...hs.filter((h) => !p.some((x) => x.id === h.id))]);
      if (bs.length) setBuilds((p) => fresh(p, bs));
      if (ts.length) setTeams((p) => fresh(p, ts));
    },
    builds,
    buildById: (id) => buildMap.get(id),
    saveBuild: (b) =>
      setBuilds((p) => (p.some((x) => x.id === b.id) ? p.map((x) => (x.id === b.id ? b : x)) : [b, ...p])),
    deleteBuild: (id) => setBuilds((p) => p.filter((b) => b.id !== id)),
    teams,
    saveTeam: (t) =>
      setTeams((p) => (p.some((x) => x.id === t.id) ? p.map((x) => (x.id === t.id ? t : x)) : [t, ...p])),
    deleteTeam: (id) => setTeams((p) => p.filter((t) => t.id !== id)),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore harus dipakai di dalam StoreProvider');
  return s;
}
