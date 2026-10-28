import { EMBLEMS } from '../data/emblems';
import { ITEMS } from '../data/items';
import { STATIC_CATALOG, type Catalog } from './catalog';
import { canonKey, nameKey, type Reco } from './live';
import { emptyItems } from './util';
import type { Build } from '../types';

export interface RecoApply {
  patch: Pick<Build, 'items' | 'talents'> & Partial<Pick<Build, 'emblemId' | 'spellId'>>;
  /** Nama dari API yang tidak ada di data statis app (tidak ikut dipasang). */
  missing: string[];
  /** Boots varian (enchant atau boots jungle) yang diganti boots dasarnya, karena app belum punya variannya. */
  substituted: string[];
}

/** "Tough Boots - Favor" dan "Flame Hunter's Tough Boots" adalah boots dasar plus enchant/jungle; app hanya punya boots dasar. */
const bootsBase = (name: string): string =>
  name.replace(/\s+-\s+.+$/, '').replace(/^(?:flame|ice|bloody)\s+hunter['’]s\s+/i, '').trim();

/** Terjemahkan rekomendasi API ke id data statis. Yang tidak cocok dilaporkan, bukan ditebak. */
export function recoToBuild(r: Reco, catalog: Pick<Catalog, 'talents' | 'spells'> = STATIC_CATALOG): RecoApply {
  const missing: string[] = [];
  const substituted: string[] = [];
  const byItem = new Map(ITEMS.map((i) => [canonKey(i.name), i.id]));
  const ids: string[] = [];
  for (const n of r.items) {
    let id = byItem.get(canonKey(n));
    if (!id && /boots/i.test(n)) {
      id = byItem.get(canonKey(bootsBase(n)));
      if (id) substituted.push(`${n} -> ${bootsBase(n)}`);
    }
    if (!id) missing.push(n);
    else if (!ids.includes(id)) ids.push(id);
  }
  const items = emptyItems();
  ids.slice(0, 6).forEach((id, i) => {
    items[i] = id;
  });

  const byTalent = new Map(catalog.talents.map((t) => [canonKey(t.name), t.name]));
  const talents: string[] = [];
  for (const n of r.talents) {
    const t = byTalent.get(canonKey(n));
    if (!t) missing.push(n);
    else if (!talents.includes(t)) talents.push(t);
  }

  // API menamai set emblem umum "All" (+275 HP, +22 Adaptive Attack, dari docs /academy/roles) = Basic Common.
  const ek = nameKey(r.emblem) === 'all' ? 'common' : nameKey(r.emblem);
  const emblem = ek ? EMBLEMS.find((e) => nameKey(e.name) === ek || nameKey(e.name) === `basic${ek}` || e.id === ek) : undefined;
  if (r.emblem && !emblem) missing.push(`Emblem ${r.emblem}`);

  const sk = canonKey(r.spell);
  const spell = sk ? catalog.spells.find((s) => canonKey(s.name) === sk) : undefined;
  if (r.spell && !spell) missing.push(`Spell ${r.spell}`);

  return { patch: { items, talents, ...(emblem ? { emblemId: emblem.id } : {}), ...(spell ? { spellId: spell.id } : {}) }, missing, substituted };
}
