import { SPELLS, TALENTS } from '../data/emblems';
import { ITEMS } from '../data/items';
import { canonKey } from './live';

/** Foto singkat isi API pada pemeriksaan terakhir. Disimpan di repo supaya pemeriksaan berikutnya tahu apa yang baru. */
export interface ApiSnapshot {
  at: string;
  version: string | null;
  items: { name: string; type: string }[];
  talents: string[];
  spells: string[];
  heroes: string[];
  /** Item data statis yang tidak ada di API saat snapshot ini dibuat; supaya yang sudah dilaporkan tidak diulang. */
  itemsGone?: string[];
}

export interface DriftReport {
  /** Ada di API sekarang tapi tidak ada di snapshot sebelumnya. */
  newItems: { name: string; type: string }[];
  newHeroes: string[];
  newTalents: string[];
  newSpells: string[];
  version: { from: string; to: string } | null;
  /** Talent/spell di API yang tidak ada di data statis app (app sudah menambahkannya otomatis di pemilih). */
  talentsNotInApp: string[];
  spellsNotInApp: string[];
  /** Item di data statis app yang sudah tidak ada namanya di API (kemungkinan diganti nama atau dihapus). */
  itemsGoneFromApi: string[];
}

/** Boots varian ("Tough Boots - Favor", "Flame Hunter's Tough Boots") dihitung sebagai boots dasarnya. */
const base = (name: string): string => name.replace(/\s+-\s+.+$/, '').replace(/^(?:flame|ice|bloody)\s+hunter['’]s\s+/i, '').trim();

/** Item data statis yang namanya (atau nama boots dasarnya) tidak ada di daftar item API. */
export function staticItemsGone(items: { name: string }[]): string[] {
  const apiItems = new Set(items.map((i) => canonKey(i.name)));
  const apiItemsBase = new Set(items.map((i) => canonKey(base(i.name))));
  return ITEMS.filter((i) => !apiItems.has(canonKey(i.name)) && !apiItemsBase.has(canonKey(i.name))).map((i) => i.name);
}

/**
 * Bandingkan dengan snapshot sebelumnya. Tanpa snapshot (pemeriksaan pertama) yang dilaporkan hanya selisih
 * dengan data statis; sesudahnya hanya yang BARU, supaya laporan yang sama tidak muncul tiap minggu.
 */
export function diffSnapshots(prev: ApiSnapshot | null, next: ApiSnapshot): DriftReport {
  const had = (list: string[]) => new Set(list.map(canonKey));
  const prevItems = had((prev?.items ?? []).map((i) => i.name));
  const prevHeroes = had(prev?.heroes ?? []);
  const prevTalents = had(prev?.talents ?? []);
  const prevSpells = had(prev?.spells ?? []);
  const staticTalents = new Set(TALENTS.map((t) => canonKey(t.name)));
  const staticSpells = new Set(SPELLS.map((s) => canonKey(s.name)));
  const gone = next.itemsGone ?? staticItemsGone(next.items);
  const prevGone = new Set((prev?.itemsGone ?? []).map(canonKey));
  return {
    newItems: prev ? next.items.filter((i) => !prevItems.has(canonKey(i.name))) : [],
    newHeroes: prev ? next.heroes.filter((h) => !prevHeroes.has(canonKey(h))) : [],
    newTalents: prev ? next.talents.filter((t) => !prevTalents.has(canonKey(t))) : [],
    newSpells: prev ? next.spells.filter((s) => !prevSpells.has(canonKey(s))) : [],
    version: prev && prev.version && next.version && prev.version !== next.version ? { from: prev.version, to: next.version } : null,
    talentsNotInApp: prev ? [] : next.talents.filter((t) => !staticTalents.has(canonKey(t))),
    spellsNotInApp: prev ? [] : next.spells.filter((s) => !staticSpells.has(canonKey(s))),
    itemsGoneFromApi: gone.filter((n) => !prevGone.has(canonKey(n))),
  };
}

/** Teks Markdown untuk GitHub Issue. Kosong = tidak ada yang perlu dilaporkan. */
export function renderReport(r: DriftReport, at: string): string {
  const parts: string[] = [];
  const list = (title: string, lines: string[], hint: string) => {
    if (lines.length) parts.push(`### ${title}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n${hint}`);
  };
  list(
    'Item baru di API sejak pemeriksaan terakhir',
    r.newItems.map((i) => `${i.name}${i.type ? ` (${i.type})` : ''}`),
    'API tidak memberi harga atau tier. Cek di game, lalu tambahkan ke `src/data/items.ts` kalau itu item tier 3 / boots / jungle / roam. Item dasar boleh diabaikan.',
  );
  list('Hero baru di API', r.newHeroes, 'App menambahkannya otomatis kalau API mengirim role-nya. Kalau tidak, pakai "Hero kustom" atau tambahkan ke `src/data/heroes.ts`.');
  list('Talent baru di API', r.newTalents, 'Sudah muncul otomatis di pemilih (tier dari API). Tambahkan deskripsi dan set asalnya di `src/data/emblems.ts`.');
  list('Battle spell baru di API', r.newSpells, 'Sudah muncul otomatis di pemilih tanpa cooldown. Lengkapi di `src/data/emblems.ts`.');
  if (r.version) parts.push(`### Versi game di API berubah\n\n${r.version.from} -> ${r.version.to}\n\nCek catatan patch resmi, lalu perbarui \`src/data/patches.ts\` (isi patch tidak ada di API).`);
  list('Talent di API yang belum ada di data statis', r.talentsNotInApp, 'Sudah muncul otomatis di pemilih. Lengkapi deskripsi dan set asalnya di `src/data/emblems.ts`.');
  list('Battle spell di API yang belum ada di data statis', r.spellsNotInApp, 'Sudah muncul otomatis di pemilih tanpa cooldown. Lengkapi di `src/data/emblems.ts`.');
  list(
    'Item di data statis yang tidak ditemukan di API',
    r.itemsGoneFromApi,
    'Mungkin diganti nama atau dihapus di game (mis. enchant roam dan item Retribution kini menyatu dengan boots: "Tough Boots - Favor"). Periksa `src/data/items.ts`. Daftar ini hanya dilaporkan sekali per perubahan.',
  );
  return parts.length ? `Pemeriksaan otomatis ${at}. Sumber: Rone Arena API.\n\n${parts.join('\n\n')}\n` : '';
}
