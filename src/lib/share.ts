import { EMBLEM_BY_ID, SPELL_BY_ID } from '../data/emblems';
import { ITEM_BY_ID } from '../data/items';
import { LANES, type Build, type Hero, type Lane, type Team, type TeamSlot } from '../types';
import { emptySlots, uid } from './util';

export function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64(t: string): string {
  const p = t.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

interface BuildPayload {
  n: string;
  h: string;
  i: (string | null)[];
  e: string;
  t: string[];
  s: string;
  o: string;
}

const pack = (b: Build): BuildPayload => ({
  n: b.name,
  h: b.heroId,
  i: b.items,
  e: b.emblemId,
  t: b.talents,
  s: b.spellId,
  o: b.notes,
});

/** Validasi ketat: data dari URL tidak dipercaya. */
function unpack(p: unknown, heroes: Map<string, Hero>): Build | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const heroId = typeof o.h === 'string' ? o.h : '';
  if (!heroes.has(heroId)) return null;
  const rawItems = Array.isArray(o.i) ? (o.i as unknown[]) : [];
  const items = Array.from({ length: 6 }, (_, idx) => {
    const v = rawItems[idx];
    return typeof v === 'string' && ITEM_BY_ID[v] ? v : null;
  });
  const talents = Array.isArray(o.t)
    ? (o.t as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.slice(0, 40))
        .slice(0, 3)
    : [];
  return {
    id: uid(),
    name: typeof o.n === 'string' ? o.n.slice(0, 60) : '',
    heroId,
    items,
    emblemId: typeof o.e === 'string' && EMBLEM_BY_ID[o.e] ? o.e : '',
    talents,
    spellId: typeof o.s === 'string' && SPELL_BY_ID[o.s] ? o.s : '',
    notes: typeof o.o === 'string' ? o.o.slice(0, 280) : '',
    updatedAt: Date.now(),
  };
}

export const encodeBuild = (b: Build): string => toB64(JSON.stringify(pack(b)));

export function decodeBuild(text: string, heroes: Map<string, Hero>): Build | null {
  try {
    return unpack(JSON.parse(fromB64(text)), heroes);
  } catch {
    return null;
  }
}

export function encodeTeam(team: Team, buildOf: (id: string) => Build | undefined): string {
  const l: Record<string, { h: string | null; b: BuildPayload | null }> = {};
  LANES.forEach((lane) => {
    const s = team.slots[lane];
    const b = s.buildId ? buildOf(s.buildId) : undefined;
    l[lane] = { h: s.heroId, b: b ? pack(b) : null };
  });
  return toB64(JSON.stringify({ n: team.name, l }));
}

export function decodeTeam(text: string, heroes: Map<string, Hero>): { team: Team; builds: Build[] } | null {
  try {
    const o = JSON.parse(fromB64(text)) as { n?: unknown; l?: unknown };
    if (!o || typeof o !== 'object' || !o.l || typeof o.l !== 'object') return null;
    const lanes = o.l as Record<string, { h?: unknown; b?: unknown } | undefined>;
    const slots: Record<Lane, TeamSlot> = emptySlots();
    const builds: Build[] = [];
    for (const lane of LANES) {
      const e = lanes[lane];
      if (!e) continue;
      const heroId = typeof e.h === 'string' && heroes.has(e.h) ? e.h : null;
      const build = e.b ? unpack(e.b, heroes) : null;
      if (build) builds.push(build);
      slots[lane] = { heroId, buildId: build ? build.id : null };
    }
    return {
      team: { id: uid(), name: typeof o.n === 'string' ? o.n.slice(0, 60) : '', slots, updatedAt: Date.now() },
      builds,
    };
  } catch {
    return null;
  }
}
