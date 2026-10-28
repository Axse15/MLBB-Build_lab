/**
 * Cadangan data lokal (build, komposisi, hero kustom) ke satu berkas JSON, dan pemulihannya.
 *
 * Build dan komposisi disimpan sebagai string bagikan (`encodeBuild` / `encodeTeam`), jadi pemulihan
 * memakai validasi ketat yang sama dengan tautan bagikan: isi yang tidak dikenal dibuang, bukan dipercaya.
 * Yang TIDAK ikut tercadang: draft yang sedang dibuka, catatan pemenang MPL, dan waktu edit terakhir
 * (hasil pemulihan dianggap baru diedit).
 */
import { lanesFromRoles } from '../data/heroes';
import { LANES, ROLES, type Build, type Hero, type Lane, type Role, type Team } from '../types';
import { decodeBuild, decodeTeam, encodeBuild, encodeTeam } from './share';

export interface BackupFile {
  app: 'mlbb-build-lab';
  version: 1;
  exportedAt: number;
  heroes: { id: string; name: string; roles: Role[]; lanes: Lane[] }[];
  builds: string[];
  teams: string[];
}

export const MAX_BACKUP_BYTES = 2_000_000;
const MAX_ENTRIES = 500;
const MAX_CUSTOM_HEROES = 100;
const HERO_ID = /^[a-z0-9-]{1,60}$/;

export function makeBackup(builds: Build[], teams: Team[], customHeroes: Hero[], now = Date.now()): BackupFile {
  const byId = new Map(builds.map((b) => [b.id, b]));
  return {
    app: 'mlbb-build-lab',
    version: 1,
    exportedAt: now,
    heroes: customHeroes.filter((h) => h.custom).map((h) => ({ id: h.id, name: h.name, roles: h.roles, lanes: h.lanes })),
    builds: builds.map(encodeBuild),
    teams: teams.map((t) => encodeTeam(t, (id) => byId.get(id))),
  };
}

export interface ImportOk {
  ok: true;
  heroes: Hero[];
  builds: Build[];
  teams: Team[];
  /** Entri yang tidak bisa dibaca (rusak, atau hero-nya tidak dikenal). */
  skipped: number;
  /** Entri yang sudah ada persis sama di perangkat ini. */
  duplicates: number;
}
export type ImportResult = ImportOk | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function readHeroes(raw: unknown, known: Map<string, Hero>): { heroes: Hero[]; skipped: number } {
  const out: Hero[] = [];
  let skipped = 0;
  for (const r of (Array.isArray(raw) ? raw : []).slice(0, MAX_CUSTOM_HEROES)) {
    if (!isObj(r) || typeof r.id !== 'string' || !HERO_ID.test(r.id) || typeof r.name !== 'string') {
      skipped++;
      continue;
    }
    const name = r.name.trim().slice(0, 40);
    const roles = [...new Set((Array.isArray(r.roles) ? r.roles : []).filter((x): x is Role => (ROLES as readonly unknown[]).includes(x)))];
    if (!name || roles.length === 0) {
      skipped++;
      continue;
    }
    if (known.has(r.id)) continue; // sudah ada di daftar hero (bukan pelanggaran)
    const lanes = [...new Set((Array.isArray(r.lanes) ? r.lanes : []).filter((x): x is Lane => (LANES as readonly unknown[]).includes(x)))];
    const hero: Hero = { id: r.id, name, roles, lanes: lanes.length ? lanes : lanesFromRoles(roles), custom: true };
    known.set(hero.id, hero);
    out.push(hero);
  }
  return { heroes: out, skipped };
}

/** Baca teks cadangan. `current` = data yang sudah ada, dipakai untuk membuang duplikat persis. */
export function readBackup(text: string, heroMap: Map<string, Hero>, current: { builds: Build[]; teams: Team[] }): ImportResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'Berkas terlalu besar untuk berkas cadangan (maksimal 2 MB).' };
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Berkas bukan JSON yang sah.' };
  }
  if (!isObj(j) || j.app !== 'mlbb-build-lab') return { ok: false, error: 'Ini bukan berkas cadangan MLBB Build Lab.' };
  if (j.version !== 1) return { ok: false, error: 'Versi berkas cadangan ini belum didukung.' };

  const map = new Map(heroMap);
  const { heroes, skipped: heroSkipped } = readHeroes(j.heroes, map);
  let skipped = heroSkipped;
  let duplicates = 0;

  const byId = new Map(current.builds.map((b) => [b.id, b]));
  const bySig = new Map(current.builds.map((b) => [encodeBuild(b), b]));
  const builds: Build[] = [];
  const adopt = (b: Build): Build => {
    const sig = encodeBuild(b);
    const hit = bySig.get(sig);
    if (hit) return hit;
    bySig.set(sig, b);
    byId.set(b.id, b);
    builds.push(b);
    return b;
  };

  for (const s of (Array.isArray(j.builds) ? j.builds : []).slice(0, MAX_ENTRIES)) {
    const b = typeof s === 'string' && s.length <= 8000 ? decodeBuild(s, map) : null;
    if (!b) {
      skipped++;
      continue;
    }
    if (bySig.has(encodeBuild(b))) duplicates++;
    else adopt(b);
  }

  const lookup = (id: string) => byId.get(id);
  const teamSigs = new Set(current.teams.map((t) => encodeTeam(t, lookup)));
  const teams: Team[] = [];
  for (const s of (Array.isArray(j.teams) ? j.teams : []).slice(0, MAX_ENTRIES)) {
    const res = typeof s === 'string' && s.length <= 30_000 ? decodeTeam(s, map) : null;
    if (!res) {
      skipped++;
      continue;
    }
    // Build yang ikut di dalam komposisi: pakai yang sudah ada kalau persis sama.
    const remap = new Map<string, string>();
    for (const b of res.builds) remap.set(b.id, adopt(b).id);
    const t = res.team;
    for (const lane of LANES) {
      const bid = t.slots[lane].buildId;
      if (bid && remap.has(bid)) t.slots[lane] = { ...t.slots[lane], buildId: remap.get(bid) ?? null };
    }
    const sig = encodeTeam(t, lookup);
    if (teamSigs.has(sig)) duplicates++;
    else {
      teamSigs.add(sig);
      teams.push(t);
    }
  }
  return { ok: true, heroes, builds, teams, skipped, duplicates };
}
