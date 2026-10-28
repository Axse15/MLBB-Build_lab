/**
 * Parser dan penggabung untuk data dari Rone Arena API. Semua fungsi di sini murni (tanpa jaringan)
 * dan defensif: bentuk respons yang tidak dikenal dilewati, bukan bikin app error.
 * Skema diambil dari source API (docstring + contoh respons), bukan dari panggilan langsung.
 * Jalankan `npm run probe` di komputer yang bisa mengakses internet untuk mencocokkan dengan respons asli.
 */
import { lanesFromRoles, slug } from '../data/heroes';
import { ROLES, type Hero, type Lane, type Role } from '../types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const oneLine = (v: unknown): string => str(v).replace(/\s+/g, ' ');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Amplop hero/academy: `{ code, data: { records: [...], total } }`. */
function records(json: unknown): unknown[] {
  if (!isObj(json) || !isObj(json.data)) return [];
  return asArr(json.data.records);
}
export function totalOf(json: unknown): number | null {
  return isObj(json) && isObj(json.data) ? num(json.data.total) : null;
}
export function isApiOk(json: unknown): boolean {
  return isObj(json) && (json.code === 0 || json.code === undefined) && isObj(json.data);
}

// ---------------------------------------------------------------- hero

export interface LiveHero {
  name: string;
  roles: Role[];
  lanes: Lane[];
}

const heroData = (rec: unknown): Obj | null => {
  if (!isObj(rec) || !isObj(rec.data) || !isObj(rec.data.hero) || !isObj(rec.data.hero.data)) return null;
  return rec.data.hero.data;
};

/** `/api/heroes`: daftar lengkap nama hero (tanpa role). */
export function parseHeroNames(json: unknown): string[] {
  return records(json)
    .map((r) => str(heroData(r)?.name))
    .filter(Boolean);
}

export function roleFromTitle(t: string): Role | null {
  const s = t.toLowerCase();
  return ROLES.find((r) => s.includes(r.toLowerCase())) ?? null;
}

export function laneFromTitle(t: string): Lane | null {
  const s = t.toLowerCase();
  if (s.includes('exp')) return 'EXP';
  if (s.includes('mid')) return 'Mid';
  if (s.includes('gold')) return 'Gold';
  if (s.includes('jungle')) return 'Jungle';
  if (s.includes('roam')) return 'Roam';
  return null;
}

const titles = (list: unknown, field: string): string[] =>
  asArr(list)
    .filter(isObj)
    .map((o) => (isObj(o.data) ? str(o.data[field]) : ''))
    .filter(Boolean);

/** `/api/heroes/positions`: nama + role (`sortid`) + lane (`roadsort`). Elemen `""` di array dibuang. */
export function parsePositions(json: unknown): LiveHero[] {
  const out: LiveHero[] = [];
  for (const r of records(json)) {
    const d = heroData(r);
    const name = str(d?.name);
    if (!d || !name) continue;
    const roles = [...new Set(titles(d.sortid, 'sort_title').map(roleFromTitle).filter((x): x is Role => !!x))];
    const lanes = [...new Set(titles(d.roadsort, 'road_sort_title').map(laneFromTitle).filter((x): x is Lane => !!x))];
    out.push({ name, roles, lanes });
  }
  return out;
}

export interface HeroSync {
  /** false = daftar dari API terlalu kecil/aneh, diabaikan seluruhnya. */
  usable: boolean;
  liveCount: number;
  /** Hero yang ditambahkan karena belum ada di data statis. */
  added: string[];
  /** Hero baru yang API tidak beri role, jadi tidak ditambahkan. */
  noRole: string[];
  /** Hero statis yang role/lane-nya diperbarui dari API. */
  updated: string[];
  /** Hero statis yang tidak ada di daftar API (nama beda ejaan, atau hero dihapus). */
  missing: string[];
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function mergeHeroes(base: Hero[], names: string[], positions: LiveHero[]): { heroes: Hero[]; sync: HeroSync } {
  const sync: HeroSync = { usable: false, liveCount: names.length, added: [], noRole: [], updated: [], missing: [] };
  if (names.length < Math.max(50, Math.floor(base.length * 0.5))) return { heroes: base, sync };
  sync.usable = true;

  const pos = new Map(positions.map((p) => [slug(p.name), p]));
  const liveSlugs = new Set(names.map(slug));
  const baseIds = new Set(base.map((h) => h.id));

  const merged: Hero[] = base.map((h) => {
    const p = pos.get(h.id);
    if (!p || p.roles.length === 0) return h;
    const roles = sameSet(p.roles, h.roles) ? h.roles : p.roles;
    const lanes = p.lanes.length > 0 ? p.lanes : h.lanes;
    if (roles !== h.roles || !sameSet(lanes, h.lanes)) sync.updated.push(h.name);
    return { ...h, roles, lanes, live: p.lanes.length > 0 };
  });
  sync.missing = base.filter((h) => !liveSlugs.has(h.id)).map((h) => h.name);

  for (const name of names) {
    const id = slug(name);
    if (!id || baseIds.has(id)) continue;
    baseIds.add(id);
    const p = pos.get(id);
    if (!p || p.roles.length === 0) {
      sync.noRole.push(name);
      continue;
    }
    merged.push({ id, name, roles: p.roles, lanes: p.lanes.length > 0 ? p.lanes : lanesFromRoles(p.roles), live: p.lanes.length > 0, fresh: true });
    sync.added.push(name);
  }
  return { heroes: merged, sync };
}

/** Hero kustom milik user disembunyikan kalau id-nya sekarang dipegang hero dari daftar resmi. */
export function withCustom(merged: Hero[], customs: Hero[]): Hero[] {
  const ids = new Set(merged.map((h) => h.id));
  return [...merged, ...customs.filter((c) => !ids.has(c.id))];
}

// ---------------------------------------------------------------- versi game

/** `/api/academy/meta/version`: `records[].data.game_version`. */
export function parseVersions(json: unknown): string[] {
  return records(json)
    .map((r) => (isObj(r) && isObj(r.data) ? str(r.data.game_version) : ''))
    .filter((v) => /^\d+\.\d+\.\d+/.test(v));
}

export function versionTriple(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a: string, b: string): number {
  const x = versionTriple(a);
  const y = versionTriple(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export function latestVersion(list: string[]): string | null {
  return list.reduce<string | null>((best, v) => (best === null || compareVersions(v, best) > 0 ? v : best), null);
}

// ---------------------------------------------------------------- esports (MPL ID)

export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'unknown';

export interface LiveMatch {
  startAt: number | null;
  localTime: string;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  round: string;
  bestOf: number | null;
  status: MatchStatus;
  winner: 'team1' | 'team2' | null;
  logo1?: string;
  logo2?: string;
  /** ID untuk `/esports/id/matches/{id}`. Null selama halaman detail belum ada (match belum dimainkan). */
  matchId?: string | null;
  replayUrl?: string;
}
export interface LiveDay {
  label: string;
  matches: LiveMatch[];
}
export interface LiveSeed {
  seed: number;
  team: string;
  win: number | null;
  lose: number | null;
  logo?: string;
}
export interface LivePlayoffs {
  seeds: LiveSeed[];
  days: LiveDay[];
}
export interface LiveStanding {
  rank: number;
  team: string;
  win: number | null;
  lose: number | null;
  points: number | null;
  logo?: string;
}

/** Hanya tautan YouTube https; apa pun selain itu dibuang. */
export function youtubeUrl(v: unknown): string | undefined {
  const u = safeImg(v);
  if (!u) return undefined;
  const host = new URL(u).hostname.replace(/^www\./, '');
  return host === 'youtube.com' || host === 'youtu.be' ? u : undefined;
}

const teamName = (t: unknown): string => (isObj(t) ? str(t.full_name) || str(t.name) : '') || 'TBD';
const teamLogo = (t: unknown): string | undefined => (isObj(t) ? safeImg(t.logo) : undefined);

function parseMatch(m: unknown): LiveMatch | null {
  if (!isObj(m)) return null;
  const start = typeof m.start_at === 'string' ? Date.parse(m.start_at) : NaN;
  const s1 = num(m.score1);
  const s2 = num(m.score2);
  const st = str(m.status);
  const status: MatchStatus = st === 'scheduled' || st === 'in_progress' || st === 'finished' ? st : s1 !== null && s2 !== null ? 'finished' : 'unknown';
  const w = str(m.winner);
  return {
    startAt: Number.isNaN(start) ? null : start,
    localTime: str(m.local_time),
    team1: teamName(m.team1),
    team2: teamName(m.team2),
    score1: s1,
    score2: s2,
    round: str(m.round),
    bestOf: num(m.best_of),
    status,
    winner: w === 'team1' || w === 'team2' ? w : null,
    logo1: teamLogo(m.team1),
    logo2: teamLogo(m.team2),
    matchId: typeof m.match_id === 'string' && /^\d{1,9}$/.test(m.match_id) ? m.match_id : typeof m.match_id === 'number' && Number.isInteger(m.match_id) && m.match_id > 0 ? String(m.match_id) : null,
    replayUrl: youtubeUrl(m.replay_url),
  };
}

function parseDays(raw: unknown): LiveDay[] {
  return asArr(raw)
    .filter(isObj)
    .map((d) => ({
      label: str(d.label),
      matches: asArr(d.matches).map(parseMatch).filter((x): x is LiveMatch => !!x),
    }))
    .filter((d) => d.matches.length > 0);
}

/** `/api/esports/id/playoffs`: respons langsung (tanpa amplop `code/data`). */
export function parsePlayoffs(json: unknown): LivePlayoffs {
  if (!isObj(json)) return { seeds: [], days: [] };
  const seeds = asArr(json.seeds)
    .filter(isObj)
    .map((s) => ({
      seed: num(s.seed) ?? 0,
      team: teamName(s.team),
      win: isObj(s.match_wl) ? num(s.match_wl.win) : null,
      lose: isObj(s.match_wl) ? num(s.match_wl.lose) : null,
      logo: teamLogo(s.team),
    }))
    .filter((s) => s.seed > 0);
  return { seeds, days: parseDays(json.days) };
}

export function parseStandings(json: unknown): LiveStanding[] {
  if (!isObj(json)) return [];
  return asArr(json.standings)
    .filter(isObj)
    .map((s) => ({
      rank: num(s.rank) ?? 0,
      team: teamName(s.team),
      win: isObj(s.match_wl) ? num(s.match_wl.win) : null,
      lose: isObj(s.match_wl) ? num(s.match_wl.lose) : null,
      points: num(s.match_point),
      logo: teamLogo(s.team),
    }))
    .filter((s) => s.rank > 0);
}

/** Waktu mulai pertandingan pertama yang belum lewat, dan perkiraan akhir (match terakhir + 6 jam). */
export function playoffWindow(p: LivePlayoffs, now: number): { next: number | null; end: number | null } {
  const times = p.days.flatMap((d) => d.matches.map((m) => m.startAt)).filter((t): t is number => t !== null);
  if (times.length === 0) return { next: null, end: null };
  const upcoming = times.filter((t) => t > now);
  return { next: upcoming.length ? Math.min(...upcoming) : null, end: Math.max(...times) + 6 * 3600_000 };
}

/** `/api/esports/id/schedule`: jadwal musim reguler per minggu, diratakan jadi satu daftar. */
export function parseSchedule(json: unknown): LiveMatch[] {
  if (!isObj(json)) return [];
  return asArr(json.weeks)
    .filter(isObj)
    .flatMap((w) => parseDays(w.days).flatMap((d) => d.matches));
}

// ---------------------------------------------------------------- detail match (`/api/esports/id/matches/{id}`)

export interface MatchAsset {
  id: string;
  img?: string;
}
export interface MatchPlayer {
  name: string;
  hero: string;
  heroImg?: string;
  kills: number;
  deaths: number;
  assists: number;
  items: MatchAsset[];
  emblem?: MatchAsset;
  talents: MatchAsset[];
  gold: number | null;
  damage: number | null;
  taken: number | null;
  tower: number | null;
}
export interface MatchTeam {
  name: string;
  logo?: string;
  winner: boolean | null;
  kills: number;
  players: MatchPlayer[];
}
export interface MatchGame {
  number: number;
  duration: string;
  teams: MatchTeam[];
}
export interface MatchDetail {
  id: string;
  games: MatchGame[];
}

/** URL gambar detail match bertanda tangan sementara dan panjang (bisa >600 karakter), jadi batasnya lebih longgar. */
const matchImg = (v: unknown): string | undefined => (typeof v === 'string' && v.length <= 2000 ? safeImgLong(v) : undefined);
function safeImgLong(v: string): string | undefined {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}
const asset = (v: unknown): MatchAsset | null => (isObj(v) && (str(v.id) || num(v.id) !== null) ? { id: String(v.id).trim(), img: matchImg(v.image) } : null);
const count = (v: unknown): number => {
  const n = num(v);
  return n !== null && n >= 0 ? n : 0;
};

function parseMatchPlayer(p: unknown): MatchPlayer | null {
  if (!isObj(p) || !isObj(p.hero)) return null;
  const hero = str(p.hero.name);
  if (!hero) return null;
  return {
    name: str(p.name) || '?',
    hero,
    heroImg: matchImg(p.hero.image),
    kills: count(p.kills),
    deaths: count(p.deaths),
    assists: count(p.assists),
    items: asArr(p.items).map(asset).filter((x): x is MatchAsset => !!x),
    emblem: asset(p.emblem) ?? undefined,
    talents: asArr(p.talents).map(asset).filter((x): x is MatchAsset => !!x),
    gold: num(p.gold),
    damage: num(p.damage_dealt),
    taken: num(p.damage_taken),
    tower: num(p.tower_damage),
  };
}

export function parseMatchDetail(json: unknown): MatchDetail | null {
  if (!isObj(json)) return null;
  const games = asArr(json.games)
    .filter(isObj)
    .map((g, i): MatchGame => ({
      number: num(g.number) ?? i + 1,
      duration: str(g.duration),
      teams: asArr(g.teams)
        .filter(isObj)
        .map((t): MatchTeam => ({
          name: teamName(t.team),
          logo: teamLogo(t.team),
          winner: typeof t.winner === 'boolean' ? t.winner : null,
          kills: count(t.kills),
          players: asArr(t.players).map(parseMatchPlayer).filter((x): x is MatchPlayer => !!x),
        }))
        .filter((t) => t.players.length > 0),
    }))
    .filter((g) => g.teams.length === 2);
  return games.length ? { id: str(json.match_id), games } : null;
}

export function validMatchDetail(v: unknown): v is MatchDetail {
  return isObj(v) && Array.isArray(v.games) && v.games.length > 0;
}

/** (K + A) / D, dengan D minimal 1 supaya tidak membagi nol. */
export const kdaOf = (k: number, d: number, a: number): number => (k + a) / Math.max(d, 1);

export interface SeriesStar {
  name: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  games: number;
  heroes: string[];
}

/**
 * Estimasi pemain terbaik: di tim yang menang lebih banyak game, pemain dengan KDA kumulatif tertinggi
 * (selisih diputus oleh damage). BUKAN MVP resmi: skor MVP game tidak disediakan API.
 */
export function seriesStar(d: MatchDetail): SeriesStar | null {
  const wins = new Map<string, number>();
  for (const g of d.games) for (const t of g.teams) if (t.winner) wins.set(t.name, (wins.get(t.name) ?? 0) + 1);
  const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || (ranked.length > 1 && ranked[0][1] === ranked[1][1])) return null;
  const team = ranked[0][0];
  const agg = new Map<string, SeriesStar & { dmg: number }>();
  for (const g of d.games)
    for (const t of g.teams)
      if (t.name === team)
        for (const p of t.players) {
          const cur = agg.get(p.name) ?? { name: p.name, team, kills: 0, deaths: 0, assists: 0, games: 0, heroes: [], dmg: 0 };
          cur.kills += p.kills;
          cur.deaths += p.deaths;
          cur.assists += p.assists;
          cur.games += 1;
          cur.dmg += p.damage ?? 0;
          if (!cur.heroes.includes(p.hero)) cur.heroes.push(p.hero);
          agg.set(p.name, cur);
        }
  const best = [...agg.values()].sort((a, b) => kdaOf(b.kills, b.deaths, b.assists) - kdaOf(a.kills, a.deaths, a.assists) || b.dmg - a.dmg)[0];
  return best ?? null;
}

/** Pemain di tim pemenang satu game dengan KDA tertinggi (estimasi, bukan MVP resmi). */
export function gameStar(g: MatchGame): { team: string; player: MatchPlayer } | null {
  const w = g.teams.find((t) => t.winner);
  if (!w) return null;
  const best = [...w.players].sort((a, b) => kdaOf(b.kills, b.deaths, b.assists) - kdaOf(a.kills, a.deaths, a.assists) || (b.damage ?? 0) - (a.damage ?? 0))[0];
  return best ? { team: w.name, player: best } : null;
}

/** Hasil tatap muka dua tim di jadwal reguler (yang sudah selesai), terbaru dulu. */
export function headToHead(schedule: LiveMatch[], a: string, b: string): LiveMatch[] {
  return schedule
    .filter((m) => m.status === 'finished' && ((m.team1 === a && m.team2 === b) || (m.team1 === b && m.team2 === a)))
    .sort((x, y) => (y.startAt ?? 0) - (x.startAt ?? 0));
}

/** Match reguler terakhir yang sudah punya halaman detail untuk satu tim. */
export function lastDetailedMatch(schedule: LiveMatch[], team: string): LiveMatch | null {
  return (
    schedule
      .filter((m) => m.status === 'finished' && m.matchId && (m.team1 === team || m.team2 === team))
      .sort((x, y) => (y.startAt ?? 0) - (x.startAt ?? 0))[0] ?? null
  );
}

/** Beberapa match reguler terakhir (terbaru dulu) yang punya halaman detail untuk satu tim. */
export function recentDetailedMatches(schedule: LiveMatch[], team: string, n = 3): LiveMatch[] {
  return schedule
    .filter((m) => m.status === 'finished' && m.matchId && (m.team1 === team || m.team2 === team))
    .sort((x, y) => (y.startAt ?? 0) - (x.startAt ?? 0))
    .slice(0, n);
}

export interface RosterPlayer {
  name: string;
  hero: string;
  /** Build di game itu, sebagai ID (nama dan ikonnya dicari dari katalog API di sisi tampilan, karena URL gambar match kedaluwarsa). */
  items?: string[];
  emblem?: string;
  talents?: string[];
  /** Nama sejajar dengan `items`/`talents`; hanya diisi di snapshot bawaan (supaya terbaca saat API mati). */
  itemNames?: string[];
  talentNames?: string[];
}
export interface Roster {
  team: string;
  players: RosterPlayer[];
  /** match_id sumbernya, lawan, dan waktu match (ms). */
  fromMatch: string;
  vs: string;
  at: number | null;
}

/** Susunan lima pemain satu tim di game terakhir sebuah match, beserta hero yang mereka pakai. */
export function rosterOf(d: MatchDetail, team: string, vs = '', at: number | null = null): Roster | null {
  for (let i = d.games.length - 1; i >= 0; i--) {
    const t = d.games[i].teams.find((x) => x.name === team);
    if (t && t.players.length > 0) return { team, players: t.players.map((p) => ({ name: p.name, hero: p.hero, items: p.items.map((x) => x.id), emblem: p.emblem?.id, talents: p.talents.map((x) => x.id) })), fromMatch: d.id, vs, at };
  }
  return null;
}

export function validRoster(v: unknown): v is Roster {
  return (
    isObj(v) &&
    typeof v.team === 'string' &&
    Array.isArray(v.players) &&
    v.players.length > 0 &&
    v.players.every((p) => isObj(p) && typeof p.name === 'string' && typeof p.hero === 'string' && (p.items === undefined || (Array.isArray(p.items) && p.items.every((x) => typeof x === 'string'))))
  );
}

// ---------------------------------------------------------------- gambar (URL dari API, tidak disalin ke proyek)

/** Hanya URL https tanpa kredensial. Dipakai untuk <img>, jadi tidak ada skrip yang ikut berjalan. */
export function safeImg(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 600) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Kunci pencocokan nama yang longgar: huruf kecil, hanya huruf dan angka ("Berserker's Fury" = "berserkers fury"). */
export const nameKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

export type IconMap = Record<string, string>;

export interface Icons {
  items: IconMap;
  spells: IconMap;
  talents: IconMap;
  /** Endpoint ikon yang gagal atau terbaca kosong, untuk ditampilkan di footer dan probe. */
  problems: string[];
  /** ID -> nama item dan talent, dari respons yang sama (tidak perlu permintaan tambahan untuk rekomendasi build). */
  ids: IdMaps;
  /** Talent dan spell menurut API, untuk menambahkan yang belum ada di data statis. */
  catalog: LiveCatalog;
}
export interface LiveTalent {
  name: string;
  slot: 1 | 2 | 3;
  text: string;
}
export interface LiveSpell {
  name: string;
  text: string;
}
export interface LiveCatalog {
  talents: LiveTalent[];
  spells: LiveSpell[];
}
export const EMPTY_ICONS: Icons = { items: {}, spells: {}, talents: {}, problems: [], ids: { items: {}, talents: {}, spells: {} }, catalog: { talents: [], spells: [] } };

function addIcon(out: IconMap, name: unknown, icon: unknown): void {
  const key = nameKey(str(name));
  const url = safeImg(icon);
  if (key && url) out[key] = url;
}

/**
 * Sebagian record academy menyimpan nilai asli di `data.__data` dan hanya merujuknya dari field biasa
 * (mis. `"skillicon": "@__data.skillicon"`). Ambil nilai langsung, atau ikuti rujukannya.
 */
function field(d: Obj | null, key: string): unknown {
  if (!d) return undefined;
  const inner = isObj(d.__data) ? d.__data : null;
  const v = d[key];
  if (typeof v === 'string' && v.startsWith('@__data.')) return inner?.[v.slice('@__data.'.length)] ?? inner?.[key];
  return v ?? inner?.[key];
}

/** Nama di data statis yang ditulis beda oleh API (kunci dan nilai = nameKey). */
const ALIASES: Record<string, string> = { weaponmaster: 'weaponsmaster' };

/**
 * Cari URL ikon untuk sebuah nama: persis, alias, bentuk kepemilikan ("Haas's" = "Haas'"),
 * dan awalan "Demon Boots" untuk enchant boots roam (API menamainya "Demon Boots Favor", dst.).
 */
export function iconFor(map: IconMap, name: string): string | undefined {
  const k = nameKey(name);
  for (const t of [k, ALIASES[k], nameKey(name.replace(/['’]s\b/g, '')), `demonboots${k}`]) {
    if (t && map[t]) return map[t];
  }
  return undefined;
}

/** `/api/heroes`: `data.hero.data.head` per hero, dikunci dengan nama. */
export function parseHeroImages(json: unknown): IconMap {
  const out: IconMap = {};
  for (const r of records(json)) {
    const d = heroData(r);
    addIcon(out, d?.name, d?.head);
  }
  return out;
}

const recData = (r: unknown): Obj | null => (isObj(r) && isObj(r.data) ? r.data : null);

/** `/api/academy/equipment`: `data.equipname` + `data.equipicon`. */
export function parseItemIcons(json: unknown): IconMap {
  const out: IconMap = {};
  for (const r of records(json)) addIcon(out, field(recData(r), 'equipname'), field(recData(r), 'equipicon'));
  return out;
}

/** `/api/academy/spells`: `skillname` + `skillicon`, yang di respons asli berupa rujukan ke `data.__data`. */
export function parseSpellIcons(json: unknown): IconMap {
  const out: IconMap = {};
  for (const r of records(json)) addIcon(out, field(recData(r), 'skillname'), field(recData(r), 'skillicon'));
  return out;
}

/** `/api/academy/emblems`: talent ada di `data.emblemskill.{skillname, skillicon}`. */
export function parseTalentIcons(json: unknown): IconMap {
  const out: IconMap = {};
  for (const r of records(json)) {
    const s = recData(r)?.emblemskill;
    for (const one of Array.isArray(s) ? s : [s]) if (isObj(one)) addIcon(out, one.skillname, one.skillicon);
  }
  return out;
}

/** `/api/academy/equipment` (dan `/equipment/expanded` untuk tipe): daftar nama item. `type` kosong kalau tidak ada. */
export function parseEquipmentNames(json: unknown): { name: string; type: string }[] {
  const out: { name: string; type: string }[] = [];
  for (const r of records(json)) {
    const d = recData(r);
    const name = str(field(d, 'equipname'));
    if (name) out.push({ name, type: str(field(d, 'equiptypename')) });
  }
  return out;
}

// ---------------------------------------------------------------- katalog talent dan spell

/** Teks deskripsi dari API berisi tag HTML dan baris baru: ambil teks polos yang pendek. */
const plain = (v: unknown): string => str(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);

/** `/api/academy/emblems`: tier talent ada di `data.gifttiers` (1, 2, atau 3). Yang tidak jelas dilewati. */
export function parseTalentCatalog(json: unknown): LiveTalent[] {
  const out: LiveTalent[] = [];
  for (const r of records(json)) {
    const d = recData(r);
    const sk = d?.emblemskill;
    const one = Array.isArray(sk) ? sk[0] : sk;
    const tier = Number(d?.gifttiers);
    const name = isObj(one) ? str(one.skillname) : '';
    if (!name || (tier !== 1 && tier !== 2 && tier !== 3) || !isObj(one)) continue;
    out.push({ name, slot: tier, text: plain(one.skilldesc_text ?? one.skilldesc) });
  }
  return out;
}

/** `/api/academy/spells`: nama dan deskripsi (bisa berupa rujukan `@__data.*`). */
export function parseSpellCatalog(json: unknown): LiveSpell[] {
  const out: LiveSpell[] = [];
  for (const r of records(json)) {
    const d = recData(r);
    const name = str(field(d, 'skillname'));
    if (name) out.push({ name, text: plain(field(d, 'skilldesc')) });
  }
  return out;
}

// ---------------------------------------------------------------- rekomendasi build (agregat rank)

/** Kunci pembanding nama yang juga menyamakan alias ejaan dan bentuk kepemilikan. */
export const canonKey = (name: string): string => {
  const k = nameKey(name.replace(/['’]s\b/g, ''));
  return ALIASES[k] ?? k;
};

/** ID angka di data build -> nama. Item dari `equipid`, talent dari `giftid` (bukan skillid). */
export interface IdMaps {
  items: Record<string, string>;
  talents: Record<string, string>;
  /** battleskillid -> nama battle spell. */
  spells: Record<string, string>;
}
export const validIdMaps = (v: unknown): boolean => isObj(v) && isObj(v.items) && isObj(v.talents) && isObj(v.spells);

export function parseIdMaps(equipJson: unknown, emblemJson: unknown, spellJson: unknown = null): IdMaps {
  const items: Record<string, string> = {};
  for (const r of records(equipJson)) {
    const d = recData(r);
    const id = field(d, 'equipid');
    const name = str(field(d, 'equipname'));
    if ((typeof id === 'number' || typeof id === 'string') && name) items[String(id)] = name;
  }
  const talents: Record<string, string> = {};
  for (const r of records(emblemJson)) {
    const d = recData(r);
    const sk = d?.emblemskill;
    const one = Array.isArray(sk) ? sk[0] : sk;
    const name = isObj(one) ? str(one.skillname) : '';
    const gift = d?.giftid;
    if ((typeof gift === 'number' || typeof gift === 'string') && name) talents[String(gift)] = name;
  }
  const spells: Record<string, string> = {};
  for (const r of records(spellJson)) {
    const d = recData(r);
    const id = field(d, 'battleskillid') ?? field(d, 'skillid');
    const name = str(field(d, 'skillname'));
    if ((typeof id === 'number' || typeof id === 'string') && name) spells[String(id)] = name;
  }
  return { items, talents, spells };
}

/** `/api/academy/roles`: emblem_id -> nama set emblem ("All" = Basic Common). */
export function parseEmblemSets(rolesJson: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of records(rolesJson)) {
    const d = recData(r);
    const detail = d && isObj(d.emblem_detail) && isObj(d.emblem_detail.data) ? d.emblem_detail.data : null;
    const id = detail?.emblemid ?? d?.emblem_id;
    const name = str(detail?.emblemname ?? d?.emblem_title);
    if ((typeof id === 'number' || typeof id === 'string') && name) out[String(id)] = name;
  }
  return out;
}

/** Satu rekomendasi build: agregat per rank dan lane dari API, BUKAN build pemain tertentu. */
export interface Reco {
  items: string[];
  emblem: string;
  spell: string;
  talents: string[];
  /** 0..1, atau null kalau API tidak mengirimnya. */
  pick: number | null;
  win: number | null;
  /** Jumlah ID item/talent yang tidak bisa diterjemahkan ke nama. */
  unknown: number;
  /** Hanya untuk panduan buatan pemain. */
  title?: string;
  author?: string;
  views?: number | null;
  votes?: number | null;
  /** Peringkat tertinggi sepanjang masa si penulis (`historyRankLevel`), bukan peringkat sekarang. */
  authorLevel?: number | null;
  lane?: string;
}

/**
 * `historyRankLevel` -> nama rank, dari rentang di `/api/academy/ranks`
 * (136 Mythic, 161 Mythical Honor, 186 Mythical Glory, 236 Mythical Immortal).
 */
export function rankName(level: number | null | undefined): string {
  if (typeof level !== 'number' || !Number.isFinite(level)) return '';
  if (level >= 236) return 'Mythical Immortal';
  if (level >= 186) return 'Mythical Glory';
  if (level >= 161) return 'Mythical Honor';
  if (level >= 136) return 'Mythic';
  if (level >= 106) return 'Legend';
  if (level >= 76) return 'Epic';
  return 'di bawah Epic';
}
export const validRecos = (v: unknown): boolean => Array.isArray(v) && v.every((r) => isObj(r) && Array.isArray(r.items) && Array.isArray(r.talents));

/** Nilai di dalam pembungkus `{data: {..., __data: {...}}}` yang dipakai emblem dan battleskill. */
function wrapped(o: unknown, key: string): unknown {
  const d = isObj(o) ? (isObj(o.data) ? o.data : o) : null;
  return field(d, key);
}
const rate = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);

/** `/api/academy/heroes/{hero}/builds`: `data.build[]`, diurutkan dari yang paling sering dipakai. */
export function parseBuilds(json: unknown, maps: IdMaps): Reco[] {
  const out: Reco[] = [];
  for (const r of records(json)) {
    const list = recData(r)?.build;
    if (!Array.isArray(list)) continue;
    for (const b of list) {
      if (!isObj(b)) continue;
      let unknown = 0;
      const names = (ids: unknown, map: Record<string, string>): string[] =>
        (Array.isArray(ids) ? ids : []).flatMap((id) => {
          const n = typeof id === 'number' || typeof id === 'string' ? map[String(id)] : undefined;
          if (n) return [n];
          unknown++;
          return [];
        });
      const items = names(b.equipid, maps.items).slice(0, 6);
      if (items.length === 0) continue;
      out.push({
        items,
        emblem: str(wrapped(b.emblem, 'emblemname')),
        spell: str(wrapped(b.battleskill, 'skillname')),
        talents: names(b.new_rune_skill, maps.talents).slice(0, 3),
        pick: rate(b.build_pick_rate),
        win: rate(b.build_win_rate),
        unknown,
      });
    }
  }
  return out.sort((a, b) => (b.pick ?? -1) - (a.pick ?? -1));
}

/**
 * Saring panduan yang lengkap (6 item, 3 talent, ada battle spell) dan bukan umpan klik, lalu urutkan: peringkat penulis
 * (per tier rank), votes, views. Peringkat tinggi bukan jaminan panduannya bagus, hanya sinyal yang tersedia.
 */
const BAIT = /\b(free|diamonds?|giveaway|subscribe|follow me|like for|skin)\b/i;
export function rankGuides(list: Reco[], limit = 8): Reco[] {
  const tier = (g: Reco): number => {
    const l = g.authorLevel ?? 0;
    return l >= 236 ? 4 : l >= 186 ? 3 : l >= 161 ? 2 : l >= 136 ? 1 : 0;
  };
  return list
    // Judul umpan klik ("Like for free 2000 diamonds") ikut dibuang: suaranya biasanya hasil umpan, bukan kualitas.
    .filter((g) => g.items.length === 6 && g.talents.length === 3 && g.spell !== '' && !BAIT.test(g.title ?? ''))
    .sort((a, b) => tier(b) - tier(a) || (b.votes ?? 0) - (a.votes ?? 0) || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, limit);
}

const LANE_BY_CODE: Record<string, string> = { '1': 'EXP', '2': 'Mid', '3': 'Roam', '4': 'Jungle', '5': 'Gold' };

/**
 * `/api/academy/heroes/{hero}/recommended`: panduan buatan pemain (fitur panduan di game), 6 item per build.
 * `emblem_gifts` berisi giftid talent, `spell_id` berisi id battle spell, `emblem_id` id set emblem.
 * Urutannya dibiarkan seperti dari API; kualitas panduan bervariasi dan penulisnya belum tentu pemain top.
 */
export function parseGuides(json: unknown, maps: IdMaps, sets: Record<string, string> = {}): Reco[] {
  const out: Reco[] = [];
  for (const r of records(json)) {
    const rd = recData(r);
    const g = rd && isObj(rd.data) ? rd.data : null;
    if (!g) continue;
    const user = isObj(r) && isObj(r.user) ? r.user : rd && isObj(rd.user) ? rd.user : null;
    const dyn = isObj(r) && isObj(r.dynamic) ? r.dynamic : rd && isObj(rd.dynamic) ? rd.dynamic : null;
    const hero = isObj(g.hero) ? g.hero : null;
    const emblem0 = Array.isArray(g.emblems) ? g.emblems.find(isObj) : undefined;
    const spellId = isObj(g.spell) ? g.spell.spell_id : undefined;
    const equips = Array.isArray(g.equips) ? g.equips.filter(isObj) : [];
    for (const e of equips) {
      let unknown = 0;
      const names = (ids: unknown, map: Record<string, string>): string[] =>
        (Array.isArray(ids) ? ids : []).flatMap((id) => {
          const n = typeof id === 'number' || typeof id === 'string' ? map[String(id)] : undefined;
          if (n) return [n];
          unknown++;
          return [];
        });
      const items = names(e.equip_ids, maps.items).slice(0, 6);
      if (items.length === 0) continue;
      const emblemId = emblem0?.emblem_id;
      out.push({
        items,
        emblem: typeof emblemId === 'number' || typeof emblemId === 'string' ? (sets[String(emblemId)] ?? '') : '',
        spell: typeof spellId === 'number' || typeof spellId === 'string' ? (maps.spells[String(spellId)] ?? '') : '',
        talents: names(emblem0?.emblem_gifts, maps.talents).slice(0, 3),
        pick: null,
        win: null,
        unknown,
        title: oneLine(g.title) || oneLine(e.equip_title),
        // satu baris: judul pemain sering berisi baris baru dan spasi ganda
        author: oneLine(user?.name),
        views: typeof dyn?.views === 'number' && Number.isFinite(dyn.views) ? dyn.views : null,
        votes: typeof dyn?.votes === 'number' && Number.isFinite(dyn.votes) ? dyn.votes : null,
        authorLevel: typeof user?.historyRankLevel === 'number' && Number.isFinite(user.historyRankLevel) ? user.historyRankLevel : null,
        lane: LANE_BY_CODE[String(hero?.hero_lane ?? '')],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- validasi cache

export const validHeroCache = (v: unknown): boolean =>
  isObj(v) && Array.isArray(v.names) && Array.isArray(v.positions) && isObj(v.images);
export const validIconsCache = (v: unknown): boolean =>
  isObj(v) && isObj(v.items) && isObj(v.spells) && isObj(v.talents) && Array.isArray(v.problems) && validIdMaps(v.ids) && isObj(v.catalog) && Array.isArray(v.catalog.talents) && Array.isArray(v.catalog.spells);
export const validPlayoffsCache = (v: unknown): boolean => isObj(v) && Array.isArray(v.seeds) && Array.isArray(v.days);
export const validArrayCache = (v: unknown): boolean => Array.isArray(v);
