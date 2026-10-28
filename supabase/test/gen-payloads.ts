import { encodeBuild, encodeTeam, toB64 } from '../../src/lib/share';
import { ITEMS } from '../../src/data/items';
import type { Build, Team } from '../../src/types';
const mk = (heroId: string, name: string, n: number): Build => ({
  id: 'x' + n, name, heroId, items: ITEMS.slice(n, n + 6).map((i) => i.id), emblemId: '', talents: [], spellId: '', notes: 'catatan ' + n + ' é', updatedAt: 0,
});
const bs = { b1: mk('layla', 'Layla crit', 0), b2: mk('layla', 'Layla burst', 3), b3: mk('layla', 'Layla tahan', 6), b4: mk('tigreal', 'Tigreal tank', 2), b5: mk('layla', 'Layla v5', 9) };
const out: Record<string, string> = {};
for (const [k, b] of Object.entries(bs)) out[k] = encodeBuild(b);
const team = (n: string, ids: [string | null, string | null, string | null, string | null, string | null], with_b: boolean): Team => ({
  id: 't', name: n, updatedAt: 0,
  slots: { Gold: { heroId: ids[0], buildId: with_b ? 'x0' : null }, EXP: { heroId: ids[1], buildId: null }, Mid: { heroId: ids[2], buildId: null }, Jungle: { heroId: ids[3], buildId: null }, Roam: { heroId: ids[4], buildId: null } },
});
const lookup = (id: string) => (id === 'x0' ? bs.b1 : undefined);
out.t1 = encodeTeam(team('Tim A', ['layla', 'aldous', 'eudora', 'fanny', 'tigreal'], true), lookup);
out.t2 = encodeTeam(team('Tim B', ['claude', 'zilong', 'lunox', 'ling', 'khufra'], false), lookup);
out.t3 = encodeTeam(team('Tim C', ['miya', 'yu-zhong', 'cecilion', 'hayabusa', 'atlas'], false), lookup);
out.tempty = encodeTeam(team('Kosong', [null, null, null, null, null], false), lookup);
for (let i = 1; i <= 6; i++) out['x' + i] = encodeBuild(mk('layla', 'bulk ' + i, 20 + i));
out.bad_json = 'AAAAAAAAAAAA';
out.bad_shape = toB64(JSON.stringify({ x: 1 }));
out.bad_chars = 'abc def!!abc';
console.log(Object.entries(out).map(([k, v]) => `\\set ${k} '${v}'`).join('\n'));
