/** Pengambil data dari Rone Arena API. Dipakai app dan `npm run probe`. */
import { getJson } from './api';
import {
  isApiOk,
  latestVersion,
  parseHeroImages,
  parseBuilds,
  parseEmblemSets,
  parseGuides,
  parseHeroNames,
  parseIdMaps,
  rankGuides,
  parseItemIcons,
  parseMatchDetail,
  parsePlayoffs,
  parseSchedule,
  parsePositions,
  parseSpellCatalog,
  parseSpellIcons,
  parseStandings,
  parseTalentCatalog,
  parseTalentIcons,
  parseVersions,
  totalOf,
  type IconMap,
  type IdMaps,
  type Icons,
  type LiveHero,
  type LiveMatch,
  type LivePlayoffs,
  type MatchDetail,
  type LiveStanding,
  type Reco,
} from './live';
import type { Lane } from '../types';

export interface HeroRaw {
  names: string[];
  positions: LiveHero[];
  /** nameKey(nama hero) -> URL gambar kepala hero. */
  images: IconMap;
}

/** Ambil semua halaman dan gabungkan jadi satu amplop `{code, data:{records,total}}`. */
export async function fetchAll(path: string, size = 100): Promise<unknown> {
  const all: unknown[] = [];
  let total: number | null = null;
  for (let index = 1; index <= 6; index++) {
    const json = await getJson(`${path}${path.includes('?') ? '&' : '?'}size=${size}&index=${index}&order=asc&lang=en`);
    if (!isApiOk(json)) throw new Error('Respons tidak dikenal');
    const recs = ((json as { data: { records?: unknown } }).data.records as unknown[] | undefined) ?? [];
    total = totalOf(json) ?? total;
    all.push(...recs);
    if (recs.length === 0 || (total !== null && all.length >= total)) break;
  }
  return { code: 0, data: { records: all, total } };
}

export async function fetchHeroes(): Promise<HeroRaw> {
  const [n, p] = await Promise.allSettled([fetchAll('/api/heroes'), fetchAll('/api/heroes/positions')]);
  if (n.status === 'rejected') throw new Error(`/api/heroes: ${reason(n.reason)}`);
  const names = parseHeroNames(n.value);
  if (names.length === 0) throw new Error('Daftar hero kosong');
  return { names, positions: p.status === 'fulfilled' ? parsePositions(p.value) : [], images: parseHeroImages(n.value) };
}

const recordCount = (v: unknown): number => {
  const r = (v as { data?: { records?: unknown } } | null)?.data?.records;
  return Array.isArray(r) ? r.length : 0;
};
const reason = (e: unknown): string => (e instanceof Error ? e.message : 'gagal');

/**
 * Ikon item, battle spell, dan talent emblem. Bagian yang gagal dibiarkan kosong; semua gagal = error
 * yang menyebut penyebab tiap endpoint (gagal jaringan, atau respons terbaca tapi skemanya beda).
 */
export async function fetchIcons(): Promise<Icons> {
  const [i, s, t] = await Promise.allSettled([
    fetchAll('/api/academy/equipment'),
    fetchAll('/api/academy/spells'),
    fetchAll('/api/academy/emblems'),
  ]);
  const problems: string[] = [];
  const take = (name: string, r: PromiseSettledResult<unknown>, parse: (j: unknown) => IconMap): IconMap => {
    if (r.status === 'rejected') {
      problems.push(`${name}: ${reason(r.reason)}`);
      return {};
    }
    const map = parse(r.value);
    if (Object.keys(map).length === 0) problems.push(`${name}: ${recordCount(r.value)} record, 0 ikon terbaca (skema beda?)`);
    return map;
  };
  const icons: Icons = {
    items: take('equipment', i, parseItemIcons),
    spells: take('spells', s, parseSpellIcons),
    talents: take('emblems', t, parseTalentIcons),
    problems,
    catalog: {
      talents: t.status === 'fulfilled' ? parseTalentCatalog(t.value) : [],
      spells: s.status === 'fulfilled' ? parseSpellCatalog(s.value) : [],
    },
    ids: parseIdMaps(i.status === 'fulfilled' ? i.value : null, t.status === 'fulfilled' ? t.value : null, s.status === 'fulfilled' ? s.value : null),
  };
  if (Object.keys(icons.items).length + Object.keys(icons.spells).length + Object.keys(icons.talents).length === 0) {
    throw new Error(problems.join('; '));
  }
  return icons;
}

export async function fetchPlayoffs(): Promise<LivePlayoffs> {
  return parsePlayoffs(await getJson('/api/esports/id/playoffs?lang=id'));
}

export async function fetchStandings(): Promise<LiveStanding[]> {
  return parseStandings(await getJson('/api/esports/id/standings?lang=id'));
}

export async function fetchVersion(): Promise<string> {
  const v = latestVersion(parseVersions(await getJson('/api/academy/meta/version?size=20&index=1&order=desc&lang=en')));
  if (!v) throw new Error('Versi tidak ditemukan');
  return v;
}

export const RANKS = ['glory', 'honor', 'mythic', 'legend', 'epic', 'all'] as const;
export type Rank = (typeof RANKS)[number];

/** Peta ID -> nama untuk item dan talent. Cadangan kalau ikon belum termuat; biasanya `icons.ids` sudah cukup. */
export async function fetchIdMaps(): Promise<IdMaps> {
  const [eq, em, sp] = await Promise.all([fetchAll('/api/academy/equipment'), fetchAll('/api/academy/emblems'), fetchAll('/api/academy/spells')]);
  const maps = parseIdMaps(eq, em, sp);
  if (Object.keys(maps.items).length === 0) throw new Error('Daftar item dari API kosong');
  return maps;
}

/** Build yang paling sering dipakai untuk satu hero, lane, dan rank (agregat, bukan pemain tertentu). */
export async function fetchBuilds(hero: string, lane: Lane, rank: Rank, maps: IdMaps): Promise<Reco[]> {
  const json = await getJson(`/api/academy/heroes/${encodeURIComponent(hero)}/builds?lane=${lane.toLowerCase()}&rank=${rank}&size=5&index=1&lang=en`);
  if (!isApiOk(json)) throw new Error('Respons tidak dikenal');
  return parseBuilds(json, maps);
}

/** ID set emblem -> nama (`/academy/roles`). Kosong kalau gagal: panduan tetap tampil, tanpa nama emblem. */
export async function fetchEmblemSets(): Promise<Record<string, string>> {
  return parseEmblemSets(await fetchAll('/api/academy/roles'));
}

export const GUIDE_PAGE_SIZE = 30;

/**
 * 30 panduan terbaru untuk satu hero (bahasa Inggris), disaring yang lengkap dan diurutkan lewat `rankGuides`.
 * Sengaja tidak 100: untuk hero populer (mis. Layla) itu 240 KB dan pernah macet di server gratis; 30 hanya 65 KB.
 */
export async function fetchGuides(hero: string, maps: IdMaps, sets: Record<string, string>): Promise<Reco[]> {
  const json = await getJson(`/api/academy/heroes/${encodeURIComponent(hero)}/recommended?size=${GUIDE_PAGE_SIZE}&index=1&order=desc&lang=en`);
  if (!isApiOk(json)) throw new Error('Respons tidak dikenal');
  return rankGuides(parseGuides(json, maps, sets));
}

/** Jadwal musim reguler (72 match; ~37 KB). */
export async function fetchSchedule(): Promise<LiveMatch[]> {
  const list = parseSchedule(await getJson('/api/esports/id/schedule?lang=id'));
  if (list.length === 0) throw new Error('Jadwal kosong');
  return list;
}

/** Detail satu match: semua game, pemain, hero, KDA, item, emblem, talent. Hanya angka positif dari jadwal yang diterima. */
export async function fetchMatch(id: string): Promise<MatchDetail> {
  if (!/^\d{1,9}$/.test(id)) throw new Error('ID match tidak valid');
  const d = parseMatchDetail(await getJson(`/api/esports/id/matches/${id}`, undefined, { patient: true }));
  if (!d) throw new Error('Detail match belum tersedia');
  return d;
}
