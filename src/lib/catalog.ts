import { SPELLS, TALENTS, type PoolTalent } from '../data/emblems';
import type { Spell } from '../types';
import { canonKey, nameKey, type LiveCatalog } from './live';

export interface Catalog {
  talents: PoolTalent[];
  spells: Spell[];
  /** Nama yang ada di API tapi belum ada di data statis app (sudah ditambahkan ke daftar). */
  addedTalents: string[];
  addedSpells: string[];
}

export const STATIC_CATALOG: Catalog = { talents: TALENTS, spells: SPELLS, addedTalents: [], addedSpells: [] };

/**
 * Gabungkan data statis dengan talent/spell dari API. Yang sudah ada (nama sama setelah dinormalkan, termasuk
 * alias ejaan) tidak diganti: deskripsi dan set di data statis lebih lengkap. Yang baru ditambahkan apa adanya,
 * tanpa menebak: talent baru memakai tier dari API, spell baru tanpa cooldown (API tidak mengirimnya).
 */
export function mergeCatalog(live: LiveCatalog): Catalog {
  const haveT = new Set(TALENTS.map((t) => canonKey(t.name)));
  const haveS = new Set(SPELLS.map((s) => canonKey(s.name)));
  const talents: PoolTalent[] = [...TALENTS];
  const addedTalents: string[] = [];
  for (const t of live.talents) {
    const k = canonKey(t.name);
    if (haveT.has(k)) continue;
    haveT.add(k);
    addedTalents.push(t.name);
    talents.push({ name: t.name, slot: t.slot, tier: t.slot === 3 ? 'core' : 'standard', text: t.text || 'Talent baru dari API.', set: 'api', setName: 'Baru' });
  }
  const spells: Spell[] = [...SPELLS];
  const addedSpells: string[] = [];
  for (const s of live.spells) {
    const k = canonKey(s.name);
    if (haveS.has(k)) continue;
    haveS.add(k);
    addedSpells.push(s.name);
    spells.push({ id: nameKey(s.name), name: s.name, cooldown: 0, text: s.text || 'Battle spell baru dari API.' });
  }
  return { talents, spells, addedTalents, addedSpells };
}
