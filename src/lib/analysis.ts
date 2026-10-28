import { ITEM_BY_ID } from '../data/items';
import { LANES, type Build, type Hero, type Item, type Lane, type TeamSlot } from '../types';

export type Level = 'error' | 'warn' | 'info' | 'ok';
export interface Issue {
  level: Level;
  text: string;
}

export function itemsOf(items: (string | null)[]): Item[] {
  const out: Item[] = [];
  items.forEach((id) => {
    const it = id ? ITEM_BY_ID[id] : undefined;
    if (it) out.push(it);
  });
  return out;
}

export const totalCost = (items: Item[]): number => items.reduce((s, i) => s + i.cost, 0);

/** Pemeriksaan satu build. Aturan "satu boots/jungle/roam" adalah aturan in-game yang umum. */
export function checkBuild(items: Item[]): Issue[] {
  const issues: Issue[] = [];

  const count = (kind: Item['kind']) => items.filter((i) => i.kind === kind).length;
  if (count('boots') > 1) issues.push({ level: 'error', text: 'Ada lebih dari satu boots. Hanya satu boots yang bisa dipakai.' });
  if (count('jungle') > 1) issues.push({ level: 'error', text: 'Ada lebih dari satu item jungle.' });
  if (count('roam') > 1) issues.push({ level: 'error', text: 'Ada lebih dari satu item roam.' });

  const seen = new Set<string>();
  const dupNames = new Set<string>();
  items.forEach((i) => {
    if (seen.has(i.id)) dupNames.add(i.name);
    seen.add(i.id);
  });
  dupNames.forEach((n) => issues.push({ level: 'error', text: `${n} dipakai lebih dari sekali.` }));

  // Unique passive yang namanya sama tidak menumpuk (hanya hitung item yang berbeda).
  const unique = [...new Map(items.map((i) => [i.id, i])).values()];
  const byPassive = new Map<string, string[]>();
  unique.forEach((i) => {
    if (i.passive && i.kind !== 'roam') byPassive.set(i.passive, [...(byPassive.get(i.passive) ?? []), i.name]);
  });
  byPassive.forEach((names, passive) => {
    if (names.length > 1) {
      issues.push({ level: 'warn', text: `${names.join(' + ')} berbagi passive "${passive}". Efeknya tidak menumpuk.` });
    }
  });

  if (items.length >= 4 && count('boots') === 0) {
    issues.push({ level: 'info', text: 'Belum ada boots di build ini.' });
  }
  return issues;
}

export interface SlotView {
  lane: Lane;
  hero?: Hero;
  build?: Build;
}

export interface CompositionReport {
  filled: number;
  issues: Issue[];
  /** jumlah item ofensif per tipe damage, dihitung dari build yang dipilih */
  physical: number;
  magic: number;
  totalGold: number;
  roleCounts: Record<string, number>;
}

export function analyzeComposition(
  slots: Record<Lane, TeamSlot>,
  heroOf: (id: string) => Hero | undefined,
  buildOf: (id: string) => Build | undefined,
): CompositionReport {
  const views: SlotView[] = LANES.map((lane) => {
    const s = slots[lane];
    return {
      lane,
      hero: s.heroId ? heroOf(s.heroId) : undefined,
      build: s.buildId ? buildOf(s.buildId) : undefined,
    };
  });

  const issues: Issue[] = [];
  const picked = views.filter((v) => v.hero);
  const filled = picked.length;

  if (filled < 5) issues.push({ level: 'info', text: `Baru ${filled} dari 5 slot terisi.` });

  // Hero ganda
  const byHero = new Map<string, number>();
  picked.forEach((v) => byHero.set(v.hero!.id, (byHero.get(v.hero!.id) ?? 0) + 1));
  byHero.forEach((n, id) => {
    if (n > 1) issues.push({ level: 'error', text: `${heroOf(id)?.name ?? id} dipilih ${n} kali. Satu hero hanya bisa dipakai sekali per tim.` });
  });

  // Role
  const roleCounts: Record<string, number> = {};
  picked.forEach((v) => v.hero!.roles.forEach((r) => (roleCounts[r] = (roleCounts[r] ?? 0) + 1)));
  if (filled >= 4 && !roleCounts.Tank) {
    issues.push({ level: 'warn', text: 'Tidak ada hero bertipe Tank. Frontline tipis, tim mudah di-dive.' });
  }
  if (filled >= 4 && !roleCounts.Marksman && !roleCounts.Mage) {
    issues.push({ level: 'warn', text: 'Tidak ada Marksman maupun Mage. Damage jarak jauh yang stabil bergantung pada hero lain.' });
  }

  // Lane
  picked.forEach((v) => {
    if (!v.hero!.lanes.includes(v.lane)) {
      issues.push({ level: 'info', text: `${v.hero!.name} biasanya tidak di lane ${v.lane} (lane hero adalah perkiraan dari role).` });
    }
  });

  // Build
  const withoutBuild = picked.filter((v) => !v.build);
  if (picked.length > 0 && withoutBuild.length > 0) {
    issues.push({ level: 'info', text: `${withoutBuild.length} hero belum punya build, jadi belum ikut dihitung di campuran damage.` });
  }

  // Campuran damage dari item yang dipilih di build
  let physical = 0;
  let magic = 0;
  let totalGold = 0;
  views.forEach((v) => {
    if (!v.build) return;
    const its = itemsOf(v.build.items);
    totalGold += totalCost(its);
    its.forEach((i) => {
      if (i.kind === 'attack') physical++;
      if (i.kind === 'magic') magic++;
    });
  });
  const offensive = physical + magic;
  if (offensive >= 6) {
    const share = physical / offensive;
    if (share >= 0.85) {
      issues.push({ level: 'warn', text: `Item ofensif hampir semuanya physical (${physical} dari ${offensive}). Lawan cukup menumpuk Physical DEF.` });
    } else if (share <= 0.15) {
      issues.push({ level: 'warn', text: `Item ofensif hampir semuanya magic (${magic} dari ${offensive}). Lawan cukup menumpuk Magic DEF.` });
    } else {
      issues.push({ level: 'ok', text: `Campuran damage seimbang: ${physical} item physical, ${magic} item magic.` });
    }
  } else if (picked.length > 0) {
    issues.push({ level: 'info', text: 'Campuran damage baru bisa dibaca setelah build tiap hero terisi (minimal 6 item ofensif).' });
  }

  return { filled, issues, physical, magic, totalGold, roleCounts };
}
