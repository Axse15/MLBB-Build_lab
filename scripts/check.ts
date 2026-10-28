/**
 * Pemeriksaan logika tanpa browser. Jalankan: npm test
 * Gagal = exit code 1.
 */
import { BASE_HEROES, slug } from '../src/data/heroes';
import { ITEMS, ITEM_BY_ID } from '../src/data/items';
import { EMBLEMS, TALENTS, TALENT_BY_NAME } from '../src/data/emblems';
import { MATCHES, QUALIFIED, TEAMS } from '../src/data/mpl';
import { ROSTER_SNAPSHOT } from '../src/data/rosters';
import { PATCHES } from '../src/data/patches';
import { findAlternativeOrigin, getJson, loadCached, originKey, withOriginKey } from '../src/lib/api';
import {
  canonKey,
  compareVersions,
  parseBuilds,
  parseEmblemSets,
  parseGuides,
  parseIdMaps,
  parseSpellCatalog,
  parseTalentCatalog,
  rankGuides,
  rankName,
  laneFromTitle,
  latestVersion,
  mergeHeroes,
  nameKey,
  parseHeroImages,
  parseHeroNames,
  parseItemIcons,
  parseMatchDetail,
  parsePlayoffs,
  parsePositions,
  parseSchedule,
  gameStar,
  headToHead,
  kdaOf,
  lastDetailedMatch,
  recentDetailedMatches,
  rosterOf,
  validRoster,
  seriesStar,
  youtubeUrl,
  validMatchDetail,
  parseSpellIcons,
  parseStandings,
  parseTalentIcons,
  parseVersions,
  playoffWindow,
  roleFromTitle,
  iconFor,
  safeImg,
  validHeroCache,
  validIconsCache,
  withCustom,
  type Reco,
} from '../src/lib/live';
import { analyzeComposition, checkBuild, itemsOf, totalCost } from '../src/lib/analysis';
import { decodeBuild, decodeTeam, encodeBuild, encodeTeam, fromB64, toB64 } from '../src/lib/share';
import { mergeCatalog } from '../src/lib/catalog';
import { diffSnapshots, renderReport, staticItemsGone, type ApiSnapshot } from '../src/lib/drift';
import { recoToBuild } from '../src/lib/reco';
import { readConfig } from '../src/lib/config';
import { ago, cleanQuery, friendlyError, isUuid, parseActivity, parseComment, parsePost, parseProfile, statsFrom, tallyHeroes, winRate } from '../src/lib/community';
import { makeBackup, readBackup } from '../src/lib/backup';
import { avatarHue, emptyItems, emptySlots, greeting, uid } from '../src/lib/util';
import type { Build, Hero, Team } from '../src/types';

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    failed++;
    console.error('GAGAL:', msg);
  } else {
    console.log('ok   :', msg);
  }
};

// --- Data ---
const ids = new Set(BASE_HEROES.map((h) => h.id));
ok(ids.size === BASE_HEROES.length, `id hero unik (${BASE_HEROES.length} hero)`);
ok(new Set(ITEMS.map((i) => i.id)).size === ITEMS.length, `id item unik (${ITEMS.length} item)`);
ok(EMBLEMS.every((e) => e.recommended.every((r) => e.talents.some((t) => t.name === r))), 'talent rekomendasi ada di pool emblem');
ok(QUALIFIED.length === 6 && QUALIFIED.every((t) => TEAMS[t]), 'enam tim lolos terdaftar');
ok(MATCHES.every((m) => ['team' in m.a, 'team' in m.b].some(Boolean)), 'setiap match punya tim jelas');

// Cocokkan jumlah role dengan angka yang tertera di sumber (role utama + sekunder):
// Fighter 44, Mage 32, Marksman 23, Assassin 29, Tank 25, Support 15, total hero 133.
const count: Record<string, number> = {};
BASE_HEROES.forEach((h) => h.roles.forEach((r) => (count[r] = (count[r] ?? 0) + 1)));
console.log('info : jumlah hero di daftar =', BASE_HEROES.length, '(sumber menyebut 133)');
console.log('info : hitungan role =', JSON.stringify(count), '(sumber: Fighter 44, Mage 32, Marksman 23, Assassin 29, Tank 25, Support 15)');

// --- Data patch ---
ok(new Set(PATCHES.map((p) => `${p.server}:${p.version}`)).size === PATCHES.length, 'versi patch unik per server');
ok(PATCHES.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && !Number.isNaN(Date.parse(p.date))), 'tanggal patch valid');
ok(PATCHES.some((p) => p.server === 'original') && PATCHES.some((p) => p.server === 'advanced'), 'ada patch Original dan Advanced');
ok(PATCHES.every((p) => (p.detail === 'counts' || p.detail === 'none') === (p.heroes.length === 0)), 'detail patch konsisten dengan daftar hero');
// Hero ke-134 yang belum rilis di Original; sengaja belum ada di daftar hero build.
const UPCOMING = new Set(['Dori']);
const unknown = PATCHES.flatMap((p) => [...p.heroes.map((h) => h.name), ...(p.brawl ?? []).map((b) => b.hero)]).filter((n) => !ids.has(slug(n)) && !UPCOMING.has(n));
ok(unknown.length === 0, `semua nama hero di patch ada di daftar hero${unknown.length ? ': ' + [...new Set(unknown)].join(', ') : ''}`);

// --- Data live (fixture dari contoh respons di source Rone Arena; bukan panggilan jaringan) ---
const heroRec = (name: string, sort?: string, road?: string) => ({
  data: {
    hero_id: 1,
    hero: {
      data: {
        name,
        ...(sort ? { sortid: [{ data: { sort_id: '6', sort_title: sort } }, ''] } : {}),
        ...(road ? { roadsort: [{ data: { road_sort_id: '3', road_sort_title: road } }, ''] } : {}),
      },
    },
  },
});
const env = (records: unknown[]) => ({ code: 0, message: 'OK', data: { records, total: records.length } });

ok(roleFromTitle('support') === 'Support' && roleFromTitle('Marksman') === 'Marksman' && roleFromTitle('???') === null, 'judul role dipetakan');
ok(
  laneFromTitle('Mid Lane') === 'Mid' && laneFromTitle('Exp Lane') === 'EXP' && laneFromTitle('Gold Lane') === 'Gold' && laneFromTitle('Jungle') === 'Jungle' && laneFromTitle('Roam') === 'Roam' && laneFromTitle('x') === null,
  'judul lane dipetakan',
);
const posJson = env([heroRec('Marcel', 'support', 'Roam'), heroRec('Dori', 'mage', 'Mid Lane'), heroRec('Layla', 'marksman', 'Gold Lane'), heroRec('Tanpa Role'), { data: {} }, 'rusak']);
const pos = parsePositions(posJson);
ok(pos.length === 4 && pos[0].roles[0] === 'Support' && pos[0].lanes[0] === 'Roam', 'parsePositions membuang elemen "" dan record rusak');
ok(parseHeroNames(env([heroRec('A'), heroRec('B'), {}])).join() === 'A,B', 'parseHeroNames');

const allNames = BASE_HEROES.map((h) => h.name);
const liveNames = [...allNames, 'Dori'];
const m1 = mergeHeroes(
  BASE_HEROES,
  liveNames,
  [
    { name: 'Dori', roles: ['Mage'], lanes: ['Mid'] },
    { name: 'Layla', roles: ['Marksman'], lanes: ['Gold'] },
    { name: 'Lancelot', roles: ['Assassin'], lanes: ['Jungle', 'EXP'] },
  ],
);
ok(m1.sync.usable && m1.sync.added.join() === 'Dori', 'hero baru dari API ditambahkan');
ok(m1.heroes.find((h) => h.id === 'dori')?.fresh === true && m1.heroes.length === BASE_HEROES.length + 1, 'hero baru bertanda fresh, jumlah bertambah satu');
ok(m1.heroes.find((h) => h.id === 'layla')?.live === true, 'hero yang cocok ditandai live');
ok(m1.sync.updated.includes('Lancelot'), 'perubahan lane terdeteksi sebagai update');
const m2 = mergeHeroes(BASE_HEROES, liveNames.filter((n) => n !== 'Layla'), []);
ok(m2.sync.missing.join() === 'Layla', 'hero statis yang hilang di API dilaporkan, bukan dihapus');
ok(m2.heroes.some((h) => h.id === 'layla'), 'hero statis tetap ada walau tidak ada di API');
const m3 = mergeHeroes(BASE_HEROES, ['Cuma', 'Dua'], []);
ok(!m3.sync.usable && m3.heroes === BASE_HEROES, 'daftar API yang terlalu kecil diabaikan seluruhnya');
const m4 = mergeHeroes(BASE_HEROES, liveNames, [{ name: 'Dori', roles: [], lanes: [] }]);
ok(m4.sync.noRole.join() === 'Dori' && !m4.heroes.some((h) => h.id === 'dori'), 'hero baru tanpa role tidak ditambahkan');
const reorder = mergeHeroes(BASE_HEROES, allNames, [{ name: 'Lancelot', roles: [...BASE_HEROES.find((h) => h.id === 'lancelot')!.roles].reverse(), lanes: ['Jungle'] }]);
ok(reorder.heroes.find((h) => h.id === 'lancelot')!.roles.join() === BASE_HEROES.find((h) => h.id === 'lancelot')!.roles.join(), 'urutan role statis dipertahankan bila himpunannya sama');
const customs: Hero[] = [{ id: 'dori', name: 'Dori', roles: ['Mage'], lanes: ['Mid'], custom: true }, { id: 'abc', name: 'Abc', roles: ['Tank'], lanes: ['Roam'], custom: true }];
ok(withCustom(m1.heroes, customs).filter((h) => h.id === 'dori').length === 1 && withCustom(m1.heroes, customs).some((h) => h.id === 'abc'), 'hero kustom bentrok disembunyikan, yang lain tetap');

const verJson = env([{ data: { game_version: '2.2.9' } }, { data: { game_version: '2.2.16' } }, { data: { game_version: 'bukan versi' } }]);
ok(parseVersions(verJson).length === 2 && latestVersion(parseVersions(verJson)) === '2.2.16', 'versi terbaru dibandingkan secara numerik (2.2.16 > 2.2.9)');
ok(compareVersions('2.2.16a', '2.2.16') === 0 && compareVersions('2.3.0', '2.2.99') > 0, 'compareVersions mengabaikan sufiks huruf');

// --- Gambar dari API ---
ok(safeImg('https://akmweb.youngjoygame.com/a.png') === 'https://akmweb.youngjoygame.com/a.png', 'URL https diterima');
ok(safeImg('http://x.com/a.png') === undefined && safeImg('javascript:alert(1)') === undefined && safeImg('data:image/png;base64,AA') === undefined, 'http, javascript:, dan data: ditolak');
ok(safeImg('https://user:pw@x.com/a.png') === undefined && safeImg('bukan url') === undefined && safeImg(42) === undefined && safeImg('https://x.com/' + 'a'.repeat(700)) === undefined, 'kredensial, sampah, bukan string, dan URL terlalu panjang ditolak');
ok(nameKey("Berserker's Fury") === nameKey('Berserkers Fury') && nameKey('Chang’e') === nameKey("Chang'e") && nameKey('Yu Zhong') === 'yuzhong', 'kunci nama longgar terhadap apostrof dan spasi');

const hRec = (name: unknown, head: unknown) => ({ data: { hero_id: 1, hero: { data: { name, head } } } });
const himg = parseHeroImages(env([hRec('Layla', 'https://cdn.example.com/layla.png'), hRec("Chang'e", 'http://bad.example.com/x.png'), hRec('', 'https://cdn.example.com/y.png'), hRec('Tanpa', null), 'rusak', {}]));
ok(Object.keys(himg).join() === 'layla' && himg['layla'] === 'https://cdn.example.com/layla.png', 'gambar hero: hanya nama + https yang valid dipakai');

const iconRec = (data: unknown) => ({ data });
const itemIc = parseItemIcons(env([iconRec({ equipname: 'Blade of Despair', equipicon: 'https://cdn.example.com/bod.png' }), iconRec({ equipname: 'Rusak' }), 'x']));
ok(itemIc[nameKey('Blade of Despair')] === 'https://cdn.example.com/bod.png' && Object.keys(itemIc).length === 1, 'ikon item terbaca, record rusak dibuang');
const spellIc = parseSpellIcons(env([iconRec({ skillname: 'Flicker', skillicon: 'https://cdn.example.com/flicker.png' })]));
ok(spellIc['flicker'] === 'https://cdn.example.com/flicker.png', 'ikon spell terbaca');
const talentIc = parseTalentIcons(env([iconRec({ emblemskill: { skillname: 'Weapons Master', skillicon: 'https://cdn.example.com/wm.png' } }), iconRec({ emblemskill: [{ skillname: 'Fatal', skillicon: 'https://cdn.example.com/f.png' }] }), iconRec({ emblemskill: 'x' })]));
ok(Object.keys(talentIc).sort().join() === 'fatal,weaponsmaster', 'ikon talent terbaca (objek maupun array)');
ok(validHeroCache({ names: [], positions: [], images: {} }) && !validHeroCache({ names: [], positions: [] }), 'cache hero lama (tanpa images) dianggap tidak valid');
const ids0 = { items: {}, talents: {}, spells: {} };
const cat0 = { talents: [], spells: [] };
const icons0 = { items: {}, spells: {}, talents: {}, problems: [], ids: ids0, catalog: cat0 };
ok(validIconsCache(icons0), 'cache ikon versi sekarang valid');
ok(!validIconsCache({ ...icons0, catalog: undefined }) && !validIconsCache({ ...icons0, ids: undefined }) && !validIconsCache({ ...icons0, problems: undefined }), 'cache ikon versi lama (tanpa catalog, ids, atau problems) ditolak');
// Bentuk asli spell dari contoh respons API: nilai ada di data.__data, field biasa hanya rujukan "@__data.*".
const spellDoc = env([{ data: { __data: { skillicon: 'https://cdn.example.com/arrival.png', skillid: 20160, skillname: 'Arrival' }, battleskillid: 20160, skillicon: '@__data.skillicon', skillname: '@__data.skillname1' } }]);
ok(parseSpellIcons(spellDoc)['arrival'] === 'https://cdn.example.com/arrival.png', 'spell dengan rujukan @__data.* terbaca (skillname1 tidak ada, jatuh ke skillname)');
const IM = { haasclaws: 'u1', demonbootsfavor: 'u2', weaponsmaster: 'u3', bladeofdespair: 'u4' };
ok(iconFor(IM, "Haas's Claws") === 'u1', 'iconFor: "Haas\'s" cocok dengan "Haas\'"');
ok(iconFor(IM, 'Favor') === 'u2', 'iconFor: enchant roam "Favor" cocok dengan "Demon Boots Favor"');
ok(iconFor(IM, 'Weapon Master') === 'u3', 'iconFor: alias Weapon Master = Weapons Master');
ok(iconFor(IM, 'Blade of Despair') === 'u4' && iconFor(IM, 'Tidak Ada') === undefined, 'iconFor: nama persis cocok, yang tak ada = undefined');

const logo = 'https://wsrv.nl/?url=https://mpl.example/tlid.png';
const pjson = {
  bracket_image: null,
  seeds: [{ seed: 1, team: { name: 'TLID', full_name: null, logo }, match_wl: { win: 12, lose: 4 } }, { seed: 0, team: {} }],
  days: [
    {
      day: null,
      label: 'Sunday, 8 November 2026',
      matches: [
        { match_id: null, start_at: '2026-11-08T09:00:00+00:00', local_time: '16:00', team1: { name: 'TLID' }, team2: { name: 'TBD' }, score1: null, score2: null, round: 'Grand Finals', best_of: 7, status: 'scheduled', winner: null },
        { start_at: 'bukan tanggal', team1: { name: 'A', full_name: 'Alpha' }, team2: {}, score1: 3, score2: 1 },
        'rusak',
      ],
    },
    { label: 'Kosong', matches: [] },
  ],
};
const pp = parsePlayoffs(pjson);
ok(pp.seeds.length === 1 && pp.seeds[0].team === 'TLID' && pp.seeds[0].win === 12, 'seed playoff terbaca, seed tak valid dibuang');
ok(pp.seeds[0].logo === logo && pp.days[0].matches[0].logo1 === undefined, 'logo tim terbaca bila ada, kosong bila tidak');
ok(parseStandings({ standings: [{ rank: 1, team: { name: 'A', logo: 'http://x.com/a.png' } }, { rank: 2, team: { name: 'B', logo } }] }).map((s) => s.logo).join('|') === `|${logo}`, 'logo non-https di klasemen dibuang');
ok(pp.days.length === 1 && pp.days[0].matches.length === 2, 'hari kosong dan match rusak dibuang');
ok(pp.days[0].matches[0].bestOf === 7 && pp.days[0].matches[0].status === 'scheduled', 'match terjadwal terbaca');
ok(pp.days[0].matches[1].team1 === 'Alpha' && pp.days[0].matches[1].team2 === 'TBD' && pp.days[0].matches[1].status === 'finished' && pp.days[0].matches[1].startAt === null, 'nama lengkap dipakai, TBD untuk kosong, status diturunkan dari skor');
const win = playoffWindow(pp, Date.parse('2026-11-01T00:00:00Z'));
ok(win.next === Date.parse('2026-11-08T09:00:00+00:00') && (win.end ?? 0) > (win.next ?? 0), 'jendela playoff dihitung dari start_at');
ok(playoffWindow(pp, Date.parse('2027-01-01T00:00:00Z')).next === null, 'tanpa match mendatang, next = null');
ok(parsePlayoffs(null).days.length === 0 && parsePlayoffs('x').seeds.length === 0, 'respons bukan objek tidak membuat error');
ok(parseStandings({ standings: [{ rank: 1, team: { name: 'NAVI' }, match_point: 11, match_wl: { win: 11, lose: 3 } }, { rank: 0 }] }).length === 1, 'klasemen terbaca');

ok(findAlternativeOrigin({ error: { details: { alternative_endpoint: 'https://arena-hv.fastapicloud.dev/api' } } }) === 'https://arena-hv.fastapicloud.dev', 'host cadangan yang diizinkan diikuti (origin saja)');
ok(findAlternativeOrigin({ alternative_endpoint: 'https://evil.example.com' }) === null, 'host cadangan asing ditolak');
ok(findAlternativeOrigin({ alternative_endpoint: 'http://arena.rone.dev' }) === null, 'host cadangan non-HTTPS ditolak');
ok(findAlternativeOrigin({ alternative_endpoint: 'https://rone.dev.evil.com' }) === null, 'domain yang hanya mirip ditolak');

// cache: stub localStorage
{
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return ['x'];
  };
  const arr = (v: unknown) => Array.isArray(v);
  const a = await loadCached('k', 60_000, fetcher, arr);
  const b = await loadCached('k', 60_000, fetcher, arr);
  ok(calls === 1 && !a.stale && !b.stale, 'cache segar tidak memanggil jaringan lagi');
  const c = await loadCached('k', 60_000, async () => { throw new Error('mati'); }, arr, true);
  ok(c.stale && c.data[0] === 'x', 'jaringan gagal + cache lama = pakai cache, ditandai stale');
  let threw = false;
  try { await loadCached('baru', 60_000, async () => { throw new Error('mati'); }, arr); } catch { threw = true; }
  ok(threw, 'jaringan gagal tanpa cache = error (UI jatuh ke data statis)');
  mem.set('k2', JSON.stringify({ at: Date.now(), data: { salah: 'bentuk' } }));
  const d = await loadCached('k2', 60_000, fetcher, arr);
  ok(Array.isArray(d.data) && calls === 2, 'cache dengan bentuk salah diabaikan');
}

// --- Pemeriksaan build ---
const it = (name: string) => ITEM_BY_ID[name];
const two = checkBuild([it('warrior-boots'), it('tough-boots')]);
ok(two.some((i) => i.level === 'error' && /boots/.test(i.text)), 'dua boots ditandai error');

const armor = checkBuild([it('malefic-gun'), it('malefic-roar')]);
ok(armor.some((i) => i.level === 'warn' && /Armor Buster/.test(i.text)), 'Malefic Gun + Malefic Roar ditandai passive bentrok');

const dup = checkBuild([it('blade-of-despair'), it('blade-of-despair')]);
ok(dup.some((i) => i.level === 'error' && /lebih dari sekali/.test(i.text)), 'item ganda ditandai');
ok(!dup.some((i) => i.level === 'warn' && /berbagi passive/.test(i.text)), 'item ganda tidak dilaporkan dobel sebagai bentrok passive');

const clean = checkBuild([it('swift-boots'), it('blade-of-despair'), it('windtalker'), it('berserker-s-fury')]);
ok(clean.every((i) => i.level === 'info') || clean.length === 0, 'build bersih tanpa error/warn');
ok(totalCost(itemsOf(['blade-of-despair', null, 'swift-boots'])) === 3010 + 710, 'total gold dihitung benar');

// --- Komposisi ---
const heroOf = (id: string) => BASE_HEROES.find((h) => h.id === id);
const mkBuild = (heroId: string, items: string[]): Build => ({
  id: uid(),
  name: heroId,
  heroId,
  items: [...items, ...Array(6 - items.length).fill(null)] as (string | null)[],
  emblemId: '',
  talents: [],
  spellId: '',
  notes: '',
  updatedAt: 0,
});
const phys = (h: string) => mkBuild(h, ['swift-boots', 'blade-of-despair', 'windtalker', 'berserker-s-fury', 'haas-s-claws', 'malefic-roar']);
const builds = [phys('layla'), phys('lancelot'), phys('yu-zhong')];
const buildOf = (id: string) => builds.find((b) => b.id === id);
const slots = emptySlots();
slots.Gold = { heroId: 'layla', buildId: builds[0].id };
slots.Jungle = { heroId: 'lancelot', buildId: builds[1].id };
slots.EXP = { heroId: 'yu-zhong', buildId: builds[2].id };
slots.Mid = { heroId: 'layla', buildId: null };
slots.Roam = { heroId: 'angela', buildId: null };
const rep = analyzeComposition(slots, heroOf, buildOf);
ok(rep.filled === 5, '5 slot terisi');
ok(rep.issues.some((i) => i.level === 'error' && /Layla/.test(i.text)), 'hero ganda terdeteksi');
ok(rep.issues.some((i) => i.level === 'warn' && /Tank/.test(i.text)), 'tanpa Tank terdeteksi');
ok(rep.issues.some((i) => i.level === 'warn' && /physical/i.test(i.text)), 'damage semua physical terdeteksi');
ok(rep.physical === 15 && rep.magic === 0, `hitungan item physical=${rep.physical}, magic=${rep.magic}`);

const empty = analyzeComposition(emptySlots(), heroOf, buildOf);
ok(empty.filled === 0 && empty.issues.length === 1, 'komposisi kosong hanya memberi satu catatan');

// --- Share ---
const heroes = new Map<string, Hero>(BASE_HEROES.map((h) => [h.id, h]));
const b = mkBuild('chang-e', ['arcane-boots', 'holy-crystal']);
b.name = 'Chang’e ✨ build';
b.notes = 'Catatan dengan emoji 🔥 dan aksen é';
b.talents = ['Inspire', 'Bargain Hunter', 'Lethal Ignition'];
const rt = decodeBuild(encodeBuild(b), heroes);
ok(!!rt && rt.name === b.name && rt.notes === b.notes && rt.heroId === 'chang-e', 'round-trip build (termasuk emoji)');
ok(!!rt && rt.items[0] === 'arcane-boots' && rt.items[1] === 'holy-crystal' && rt.items[2] === null, 'item pulih setelah round-trip');
ok(decodeBuild('bukan-base64!!', heroes) === null, 'tautan rusak ditolak');
ok(decodeBuild(toB64(JSON.stringify({ h: 'hero-palsu' })), heroes) === null, 'hero tak dikenal ditolak');
const evil = decodeBuild(toB64(JSON.stringify({ h: 'layla', i: ['item-palsu', 5, null, 'windtalker'], e: 'x', t: [1, 'ok'], s: 'zz' })), heroes);
ok(!!evil && evil.items[0] === null && evil.items[3] === 'windtalker' && evil.emblemId === '' && evil.talents.length === 1 && evil.spellId === '', 'payload berisi data aneh disaring');
ok(fromB64(toB64('héllo 🔥')) === 'héllo 🔥', 'base64 UTF-8 aman');

const team: Team = { id: uid(), name: 'Tim uji', slots, updatedAt: 0 };
const tr = decodeTeam(encodeTeam(team, buildOf), heroes);
ok(!!tr && tr.team.slots.Gold.heroId === 'layla' && tr.builds.length === 3, 'round-trip komposisi + 3 build');
ok(!!tr && tr.team.slots.Gold.buildId === tr.builds[0].id, 'tautan slot-ke-build tersambung ulang');

// --- Talent: 1 per tier dari seluruh pool ---
ok(TALENTS.length === 26, '26 talent di pool');
ok([1, 2, 3].every((n) => TALENTS.filter((t) => t.slot === n).length === (n === 3 ? 10 : 8)), 'tier 1 dan 2 masing-masing 8 talent, tier 3 ada 10');
ok(TALENTS.every((t) => (t.tier === 'core') === (t.slot === 3)), 'talent core = tier 3');
ok(EMBLEMS.every((e) => new Set(e.recommended.map((r) => TALENT_BY_NAME[r]?.slot)).size === 3), 'rekomendasi tiap emblem mengisi tier 1, 2, dan 3');

// --- Rekomendasi build (bentuk data dari panggilan nyata ke API) ---
const idMaps = parseIdMaps(
  env([
    iconRec({ equipid: 3007, equipname: 'Blade of the Heptaseas', equipicon: 'https://cdn.example.com/a.png' }),
    iconRec({ equipid: 3001, equipname: 'War Axe' }),
    iconRec({ equipid: 2013, equipname: 'Malefic Roar' }),
    iconRec({ equipid: 'x', equipname: '' }),
  ]),
  env([
    iconRec({ giftid: 511, gifttiers: 1, emblemskill: { skillid: 63120, skillname: 'Rupture' } }),
    iconRec({ giftid: 721, gifttiers: 2, emblemskill: { skillid: 61030, skillname: 'Festival of Blood' } }),
    iconRec({ giftid: 631, gifttiers: 3, emblemskill: { skillid: 62040, skillname: 'Lethal Ignition' } }),
    iconRec({ giftid: 1221, gifttiers: 2, emblemskill: { skillid: 61010, skillname: 'Weapons Master' } }),
  ]),
);
ok(idMaps.items['3007'] === 'Blade of the Heptaseas' && Object.keys(idMaps.items).length === 3, 'peta ID item dibaca, record rusak dilewati');
ok(idMaps.talents['511'] === 'Rupture' && idMaps.talents['61010'] === undefined, 'talent dipetakan lewat giftid, bukan skillid');
const buildRec = {
  data: {
    big_rank: '9',
    heroid: 17,
    real_road: 4,
    build: [
      {
        battleskill: { data: { __data: { skillname: 'Retribution', skillid: 20020 }, battleskillid: 20020 } },
        build_pick_rate: 0.02,
        build_win_rate: 0.485,
        emblem: { data: { emblemid: 20005, emblemname: 'Assassin' } },
        equipid: [3007, 3001, 2013, 99999],
        new_rune_skill: [511, 721, 631],
      },
      {
        battleskill: { data: { skillname: 'Flicker' } },
        build_pick_rate: 0.5,
        build_win_rate: 'x',
        emblem: { data: { emblemname: 'Common' } },
        equipid: [3001],
        new_rune_skill: [1221],
      },
      { equipid: [99999], new_rune_skill: [] },
      'sampah',
    ],
  },
};
const recos = parseBuilds(env([buildRec, '']), idMaps);
ok(recos.length === 2, 'build tanpa satu pun item yang dikenal dibuang');
ok(recos[0].pick === 0.5 && recos[0].win === null, 'diurutkan dari yang paling sering dipakai; rate tidak valid jadi null');
ok(recos[1].items.join() === 'Blade of the Heptaseas,War Axe,Malefic Roar' && recos[1].unknown === 1, 'item diterjemahkan dan ID tak dikenal dihitung');
ok(recos[1].talents.join() === 'Rupture,Festival of Blood,Lethal Ignition' && recos[1].emblem === 'Assassin' && recos[1].spell === 'Retribution', 'talent, emblem, spell terbaca dari pembungkus data');
ok(parseBuilds({ code: 0, data: { records: [] } }, idMaps).length === 0 && parseBuilds(null, idMaps).length === 0, 'respons kosong atau aneh tidak error');
ok(canonKey("Weapons Master") === canonKey('Weapon Master'), 'alias ejaan Weapon Master');

const applied = recoToBuild({ items: ['War Axe', 'Blade of the Heptaseas', 'Item Fiktif'], emblem: 'Common', spell: 'Flicker', talents: ['Weapons Master', 'Rupture', 'Talent Fiktif'], pick: null, win: null, unknown: 0 });
ok(applied.patch.emblemId === 'common' && applied.patch.spellId === 'flicker', 'emblem "Common" dan spell dikenali');
ok(applied.patch.talents.join() === 'Weapon Master,Rupture', 'talent API dipetakan ke nama statis (alias)');
ok(applied.missing.join() === 'Item Fiktif,Talent Fiktif' && applied.patch.items.slice(0, 2).join() === 'war-axe,blade-of-the-heptaseas', 'yang tidak dikenal dilaporkan, bukan ditebak');
ok(applied.patch.items.length === 6, 'hasil selalu 6 slot item');

// --- Panduan pemain (bentuk dari docs /academy/heroes/{hero}/recommended) ---
const guideMaps = parseIdMaps(
  env([
    iconRec({ equipid: 3007, equipname: 'Blade of the Heptaseas' }),
    iconRec({ equipid: 3522, equipname: 'Hunter Strike' }),
    iconRec({ equipid: 2014, equipname: 'Malefic Gun' }),
    iconRec({ equipid: 3001, equipname: 'War Axe' }),
    iconRec({ equipid: 3012, equipname: 'Endless Battle' }),
    iconRec({ equipid: 3008, equipname: 'Corrosion Scythe' }),
  ]),
  env([
    iconRec({ giftid: 511, emblemskill: { skillname: 'Rupture' } }),
    iconRec({ giftid: 122, emblemskill: { skillname: 'Seasoned Hunter' } }),
    iconRec({ giftid: 631, emblemskill: { skillname: 'Lethal Ignition' } }),
  ]),
  env([iconRec({ battleskillid: 20020, __data: { skillid: 20020, skillname1: 'Retribution' }, skillname: '@__data.skillname1' })]),
);
ok(guideMaps.spells['20020'] === 'Retribution', 'id battle spell dibaca (nama lewat rujukan @__data)');
const sets = parseEmblemSets(env([iconRec({ emblem_id: 20001, emblem_title: 'All', emblem_detail: { data: { emblemid: 20001, emblemname: 'All' } } }), iconRec({ emblem_id: 20005, emblem_title: 'Assassin' })]));
ok(sets['20001'] === 'All' && sets['20005'] === 'Assassin', 'id set emblem dibaca dari /roles');
const guideRec = {
  createdAt: 1,
  data: {
    state: 'release',
    data: {
      title: 'Aggressive Fanny game style',
      hero: { hero_id: 17, hero_lane: '4' },
      equips: [
        { equip_title: 'Brust - one shot', equip_ids: [3007, 3522, 2014, 3001, 3012, 3008] },
        { equip_title: 'Kosong', equip_ids: [99999] },
        'sampah',
      ],
      emblems: [{ emblem_id: 20005, emblem_gifts: [511, 122, 631], emblem_title: 'Farming and Damage' }],
      spell: { spell_id: 20020 },
    },
  },
  dynamic: { views: 7, hot: 1.5 },
  user: { name: 'Penulis Uji' },
};
const guides = parseGuides(env([guideRec, '', { data: {} }]), guideMaps, sets);
ok(guides.length === 1, 'panduan tanpa item dikenal dibuang, record aneh dilewati');
ok(guides[0].items.length === 6 && guides[0].items[1] === 'Hunter Strike', 'panduan membawa 6 item');
ok(guides[0].emblem === 'Assassin' && guides[0].spell === 'Retribution' && guides[0].talents.join() === 'Rupture,Seasoned Hunter,Lethal Ignition', 'emblem, spell, talent panduan diterjemahkan');
ok(guides[0].author === 'Penulis Uji' && guides[0].views === 7 && guides[0].lane === 'Jungle' && guides[0].title === 'Aggressive Fanny game style', 'penulis, views, lane, judul terbaca');
const multi = parseGuides(env([{ ...guideRec, data: { ...guideRec.data, data: { ...guideRec.data.data, title: 'New\nHero\r\n  Best   Build\n' } } }]), guideMaps, sets);
ok(multi[0].title === 'New Hero Best Build', 'judul panduan dengan baris baru dan spasi ganda dijadikan satu baris');
ok(parseGuides(null, guideMaps).length === 0 && parseGuides({ code: 0, data: { records: [] } }, guideMaps).length === 0, 'respons panduan kosong atau aneh tidak error');
const allEmblem = recoToBuild({ items: ['War Axe'], emblem: 'All', spell: '', talents: [], pick: null, win: null, unknown: 0 });
ok(allEmblem.patch.emblemId === 'common' && !allEmblem.missing.some((m) => m.startsWith('Emblem')), 'emblem "All" dari API = Basic Common');

// --- Urutan dan penyaringan panduan ---
const g = (title: string, level: number | null, votes: number, over: Partial<Reco> = {}): Reco => ({ items: ['a', 'b', 'c', 'd', 'e', 'f'], emblem: 'x', spell: 'Flicker', talents: ['t1', 't2', 't3'], pick: null, win: null, unknown: 0, title, authorLevel: level, votes, views: 1, ...over });
const ranked = rankGuides([
  g('Umpan', 300, 900, { title: 'Like for free 2000 diamonds' }),
  g('Glory banyak suara', 200, 50),
  g('Immortal sedikit suara', 250, 1),
  g('Immortal banyak suara', 240, 10),
  g('Tanpa spell', 300, 99, { spell: '' }),
  g('Hanya 3 item', 300, 99, { items: ['a', 'b', 'c'] }),
  g('Peringkat tak diketahui', null, 500),
]);
ok(ranked.map((x) => x.title).join('|') === 'Immortal banyak suara|Immortal sedikit suara|Glory banyak suara|Peringkat tak diketahui', 'panduan: buang umpan klik dan yang tidak lengkap; urut tier rank penulis lalu suara');
ok(rankGuides(Array.from({ length: 20 }, (_, i) => g(`g${i}`, 250, i))).length === 8, 'panduan dibatasi 8');
ok(rankName(240) === 'Mythical Immortal' && rankName(186) === 'Mythical Glory' && rankName(161) === 'Mythical Honor' && rankName(136) === 'Mythic' && rankName(null) === '', 'rank penulis dari historyRankLevel');

const boots = recoToBuild({ items: ['Tough Boots - Favor', "Flame Hunter's Warrior Boots", 'Arcane Boots - Dire Hit', 'Sepatu Fiktif Boots'], emblem: '', spell: '', talents: [], pick: null, win: null, unknown: 0 });
ok(boots.patch.items.slice(0, 3).join() === 'tough-boots,warrior-boots,arcane-boots' && boots.substituted.length === 3 && boots.missing.join() === 'Sepatu Fiktif Boots', 'boots varian (enchant / jungle) diganti boots dasar dan dilaporkan');

// --- Talent dan spell baru dari API ---
const tCat = parseTalentCatalog(
  env([
    iconRec({ giftid: 1221, gifttiers: 2, emblemskill: { skillname: 'Weapons Master', skilldesc: '<b>+8%</b> power' } }),
    iconRec({ giftid: 9991, gifttiers: 3, emblemskill: { skillname: 'Talent Baru', skilldesc: 'Efek <font color="red">baru</font>\nbaris dua' } }),
    iconRec({ giftid: 9992, gifttiers: 7, emblemskill: { skillname: 'Tier Aneh' } }),
    iconRec({ giftid: 9993, gifttiers: 1, emblemskill: 'x' }),
  ]),
);
ok(tCat.length === 2 && tCat[1].slot === 3 && tCat[1].text === 'Efek baru baris dua', 'katalog talent: tier valid saja, HTML dibuang');
const sCat = parseSpellCatalog(env([iconRec({ __data: { skillname1: 'Spell Baru', skilldesc: 'Deskripsi' }, skillname: '@__data.skillname1', skilldesc: '@__data.skilldesc' }), iconRec({ skillname: 'Flicker' })]));
ok(sCat.length === 2 && sCat[0].name === 'Spell Baru' && sCat[0].text === 'Deskripsi', 'katalog spell dibaca lewat rujukan @__data');
const merged = mergeCatalog({ talents: tCat, spells: sCat });
ok(merged.addedTalents.join() === 'Talent Baru' && merged.talents.length === TALENTS.length + 1, 'talent alias (Weapons Master) tidak dobel; talent baru ditambahkan');
ok(merged.addedSpells.join() === 'Spell Baru' && merged.spells.find((x) => x.name === 'Spell Baru')?.cooldown === 0, 'spell baru ditambahkan tanpa cooldown; Flicker tidak dobel');
ok(mergeCatalog({ talents: [], spells: [] }).addedTalents.length === 0, 'tanpa data API = hanya data statis');
const withNew = recoToBuild({ items: [], emblem: '', spell: 'Spell Baru', talents: ['Talent Baru'], pick: null, win: null, unknown: 0 }, merged);
ok(withNew.patch.talents.join() === 'Talent Baru' && withNew.patch.spellId === 'spellbaru', 'rekomendasi bisa memakai talent/spell baru dari API');

// --- Pemeriksa data usang ---
const apiItems = ITEMS.filter((i) => !['Bloody Retribution', 'Conceal'].includes(i.name)).map((i) => ({ name: i.name, type: 'Attack' }));
const snap0: ApiSnapshot = { at: '2026-10-01', version: '2.2.1', items: [...apiItems, { name: 'Tough Boots - Favor', type: 'Roam' }], talents: TALENTS.map((t) => t.name), spells: ['Flicker'], heroes: ['Layla'], itemsGone: staticItemsGone(apiItems) };
ok(staticItemsGone(apiItems).join() === 'Bloody Retribution,Conceal', 'item statis yang tak ada di API terdeteksi');
ok(staticItemsGone([...apiItems, { name: 'Tough Boots - Favor' }, { name: "Flame Hunter's Warrior Boots" }]).includes('Warrior Boots') === false, 'boots varian dihitung sebagai boots dasarnya');
const first = diffSnapshots(null, snap0);
ok(first.newItems.length === 0 && first.itemsGoneFromApi.join() === 'Bloody Retribution,Conceal', 'pemeriksaan pertama: hanya selisih dengan data statis, tanpa "baru"');
const same = diffSnapshots(snap0, { ...snap0, at: '2026-10-08' });
ok(renderReport(same, 'x') === '', 'tidak ada perubahan = tidak ada laporan (daftar tetap tidak diulang)');
const changed = diffSnapshots(snap0, { ...snap0, at: '2026-10-08', version: '2.2.2', items: [...snap0.items, { name: 'Item Super Baru', type: 'Magic' }], heroes: ['Layla', 'Hero Baru'], talents: [...snap0.talents, 'Talent Baru'], spells: ['Flicker', 'Spell Baru'] });
ok(changed.newItems.map((i) => i.name).join() === 'Item Super Baru' && changed.newHeroes.join() === 'Hero Baru' && changed.newTalents.join() === 'Talent Baru' && changed.newSpells.join() === 'Spell Baru', 'item, hero, talent, spell baru terdeteksi');
ok(changed.version?.from === '2.2.1' && changed.version.to === '2.2.2', 'perubahan versi terdeteksi');
const md = renderReport(changed, '2026-10-08');
ok(md.includes('Item Super Baru (Magic)') && md.includes('2.2.1 -> 2.2.2') && md.includes('Hero Baru') && !md.includes('Bloody Retribution'), 'laporan Markdown memuat yang baru saja');
ok(diffSnapshots(snap0, { ...snap0, items: snap0.items.filter((i) => i.name !== 'Windtalker'), itemsGone: staticItemsGone(snap0.items.filter((i) => i.name !== 'Windtalker')) }).itemsGoneFromApi.join() === 'Windtalker', 'item yang baru hilang dari API dilaporkan sekali');

// --- Detail match MPL (bentuk dari /api/esports/id/matches/{id}) ---
const mp = (name: string, hero: string, k: number, d: number, a: number, dmg: number | null = 1000) => ({
  name, hero: { name: hero, image: 'https://wsrv.nl/?url=https%3A%2F%2Fx%2Fh.png' }, kills: k, deaths: d, assists: a,
  items: [{ id: '2306', image: `https://wsrv.nl/?url=${'a'.repeat(700)}` }], emblem: { id: '20007', image: 'https://x/e.png' },
  talents: [{ id: '811', image: 'https://x/t.png' }], gold: 9000, damage_dealt: dmg, damage_taken: 5000, tower_damage: 100,
});
const detailJson = {
  match_id: '1107',
  games: [
    { number: 1, duration: '14:47', teams: [
      { team: { name: 'TLID', logo: 'https://x/l.png' }, winner: true, kills: 14, players: [mp('Aran', 'Atlas', 0, 1, 9), mp('Keven', 'Wanwan', 4, 0, 8, 30000), mp('Lyoni', 'Gloo', 3, 1, 8)] },
      { team: { name: 'ONIC' }, winner: false, kills: 3, players: [mp('Lutpi', 'Terizla', 1, 4, 2, 40000), mp('Kairi', 'Nolan', 1, 3, 1)] },
    ] },
    { number: 2, duration: '12:10', teams: [
      { team: { name: 'TLID' }, winner: true, kills: 10, players: [mp('Aran', 'Atlas', 1, 0, 6), mp('Keven', 'Wanwan', 2, 1, 3), mp('Lyoni', 'Gloo', 0, 0, 4)] },
      { team: { name: 'ONIC' }, winner: false, kills: 2, players: [mp('Lutpi', 'Terizla', 0, 3, 1), mp('Kairi', 'Nolan', 2, 3, 0)] },
    ] },
  ],
};
const det = parseMatchDetail(detailJson);
ok(det !== null && validMatchDetail(det) && det.games.length === 2 && det.games[0].teams.length === 2, 'detail match terbaca: 2 game, 2 tim');
ok(det!.games[0].teams[0].players[0].items[0].img !== undefined && det!.games[0].teams[0].players[0].items[0].img!.length > 600, 'URL gambar bertanda tangan yang panjang tetap diterima');
ok(parseMatchDetail({ games: [] }) === null && parseMatchDetail(null) === null && parseMatchDetail({ games: [{ teams: [{ team: { name: 'X' }, players: [] }] }] }) === null, 'detail kosong/rusak = null');
ok(parseMatchDetail({ games: [{ teams: [{ team: { name: 'A' }, players: [mp('p', 'H', 1, 1, 1)] }, { team: { name: 'B' }, players: [{ name: 'x' }] }] }] }) === null, 'pemain tanpa hero dibuang; tim tanpa pemain valid = game dibuang');
ok(parseMatchDetail({ games: [{ teams: [{ team: { name: 'A', logo: 'javascript:alert(1)' }, players: [{ ...mp('p', 'H', 1, 1, 1), hero: { name: 'H', image: 'http://x/insecure.png' } }] }, { team: { name: 'B' }, players: [mp('q', 'G', 0, 0, 0)] }] }] })!.games[0].teams[0].players[0].heroImg === undefined, 'gambar non-https ditolak');
ok(kdaOf(0, 0, 5) === 5 && kdaOf(4, 2, 6) === 5, 'KDA: kematian 0 dihitung 1');
const star = seriesStar(det!)!;
ok(star.name === 'Keven' && star.team === 'TLID' && star.kills === 6 && star.deaths === 1 && star.assists === 11, `estimasi pemain seri: KDA kumulatif tertinggi di tim pemenang (${star?.name})`);
ok(gameStar(det!.games[0])!.player.name === 'Keven' && gameStar(det!.games[1])!.player.name === 'Aran', 'estimasi per game: KDA tertinggi di tim pemenang');
ok(seriesStar({ id: 'x', games: [det!.games[0], { ...det!.games[1], teams: det!.games[1].teams.map((t) => ({ ...t, winner: t.name === 'ONIC' })) }] }) === null, 'seri 1-1 tanpa pemenang = tanpa estimasi');
const sched = parseSchedule({ weeks: [{ week: 1, days: [{ day: 'Jumat', matches: [
  { match_id: '1036', start_at: '2026-08-14T08:00:00+00:00', team1: { name: 'EVOS' }, team2: { name: 'RRQ' }, score1: 2, score2: 0, status: 'finished', winner: 'team1', best_of: 3, replay_url: 'https://www.youtube.com/watch?v=abc' },
  { match_id: null, start_at: '2026-08-15T08:00:00+00:00', team1: { name: 'EVOS' }, team2: { name: 'RRQ' }, score1: null, score2: null, status: 'scheduled', winner: null, best_of: 3, replay_url: 'https://evil.example/x' },
  { match_id: 1107, start_at: '2026-10-18T13:00:00+00:00', team1: { name: 'RRQ' }, team2: { name: 'EVOS' }, score1: 1, score2: 2, status: 'finished', winner: 'team2', best_of: 3 },
] }] }] });
ok(sched.length === 3 && sched[0].matchId === '1036' && sched[1].matchId === null && sched[2].matchId === '1107', 'jadwal diratakan; match_id string/angka diterima, null tetap null');
ok(sched[0].replayUrl === 'https://www.youtube.com/watch?v=abc' && sched[1].replayUrl === undefined && youtubeUrl('https://youtu.be/x') === 'https://youtu.be/x' && youtubeUrl('javascript:1') === undefined, 'tautan replay: hanya YouTube https');
ok(headToHead(sched, 'EVOS', 'RRQ').length === 2 && headToHead(sched, 'EVOS', 'RRQ')[0].matchId === '1107', 'tatap muka: hanya yang selesai, terbaru dulu');
ok(lastDetailedMatch(sched, 'EVOS')?.matchId === '1107' && lastDetailedMatch(sched, 'NAVI') === null, 'match terakhir yang punya detail');
ok(parsePlayoffs({ days: [{ label: 'x', matches: [{ match_id: null, team1: { name: 'AE' }, team2: { name: 'ONIC' }, status: 'scheduled', start_at: '2026-11-04T06:00:00+00:00' }] }] }).days[0].matches[0].matchId === null, 'playoff belum dimainkan: match_id null');

// --- Roster ---
ok(recentDetailedMatches(sched, 'EVOS', 5).map((x) => x.matchId).join() === '1107,1036', 'match terakhir dengan detail: terbaru dulu, hanya yang punya match_id');
ok(recentDetailedMatches(sched, 'EVOS', 1).length === 1 && recentDetailedMatches(sched, 'NAVI').length === 0, 'batas jumlah dan tim tanpa match');
const ro = rosterOf(det!, 'TLID', 'ONIC', 123)!;
ok(ro.players.length === 3 && ro.players[0].name === 'Aran' && ro.players[0].hero === 'Atlas' && ro.vs === 'ONIC' && ro.at === 123 && validRoster(ro), 'roster dari game terakhir: nama + hero');
ok(ro.players[0].items?.join() === '2306' && ro.players[0].emblem === '20007' && ro.players[0].talents?.join() === '811', 'roster membawa build: id item, emblem, talent');
ok(validRoster({ team: 'x', players: [{ name: 'a', hero: 'b' }] }) && !validRoster({ team: 'x', players: [{ name: 'a', hero: 'b', items: [1] }] }), 'roster lama tanpa build tetap valid; build rusak ditolak');
ok(rosterOf(det!, 'TIDAKADA') === null && !validRoster({ team: 'x', players: [] }) && !validRoster(null) && !validRoster({ team: 'x', players: [{ name: 1 }] }), 'roster tim tak dikenal/rusak ditolak');
const snapTeams = Object.entries(ROSTER_SNAPSHOT.teams);
ok(snapTeams.length >= 6, `snapshot roster bawaan memuat tim (${snapTeams.length})`);
ok(snapTeams.every(([k, r]) => validRoster(r) && r.team === k && r.players.length === 5 && new Set(r.players.map((p) => p.name)).size === 5 && r.players.every((p) => p.name && p.hero)), 'tiap snapshot: 5 pemain unik dengan hero');
ok(snapTeams.every(([, r]) => r.players.every((p) => !p.itemNames || p.itemNames.length === (p.items ?? []).length)) && snapTeams.some(([, r]) => r.players.some((p) => (p.items?.length ?? 0) > 0)), 'snapshot membawa build; nama item sejajar dengan id');

// --- Cache CORS Cloudflare: percobaan ulang memakai kunci per origin ---
ok(originKey('http://localhost:5173') === originKey('http://localhost:5173') && originKey('http://localhost:5173') !== originKey('https://a.vercel.app') && /^[0-9a-z]+$/.test(originKey('null')), 'kunci origin stabil, berbeda per origin');
ok(withOriginKey('/api/x?a=1').startsWith('/api/x?a=1&_o=') && withOriginKey('/api/x').startsWith('/api/x?_o='), 'kunci ditambahkan dengan pemisah yang benar');
{
  const realFetch = globalThis.fetch;
  const urls: string[] = [];
  let calls = 0;
  globalThis.fetch = (async (u: string) => {
    urls.push(String(u));
    calls++;
    if (calls === 1) throw new TypeError('Failed to fetch'); // mis. header CORS milik origin lain dari cache
    return new Response(JSON.stringify({ hello: 'dunia' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const t0 = Date.now();
  const got = (await getJson('/api/esports/id/matches/1107')) as { hello: string };
  ok(got.hello === 'dunia' && urls.length === 2, 'fetch gagal sekali lalu berhasil di percobaan kedua');
  ok(!urls[0].includes('_o=') && urls[1].includes('_o='), 'percobaan pertama normal, kedua memakai kunci per origin');
  ok(Date.now() - t0 < 800, 'percobaan kedua tanpa jeda');
  globalThis.fetch = realFetch;
}

// --- Komunitas ---
{
  const ID = '00000000-0000-4000-8000-000000000001';
  const row = {
    id: ID, user_id: ID, kind: 'build', title: 'Layla crit', note: 'x', payload: 'eyJoIjoibGF5bGEifQ', heroes: ['layla'], hidden: false,
    like_count: 3, comment_count: 1, duel_played: 4, duel_wins: 3, created_at: '2026-10-28T10:00:00Z', profiles: { display_name: 'Aldi' },
  };
  const p = parsePost(row);
  ok(!!p && p.author === 'Aldi' && p.likes === 3 && p.duelWins === 3 && p.kind === 'build', 'parsePost: baris valid terbaca');
  ok(parsePost({ ...row, profiles: [{ display_name: 'Budi' }] })?.author === 'Budi', 'parsePost: embed profiles berbentuk larik');
  ok(parsePost({ ...row, profiles: null })?.author === 'Pemain', 'parsePost: tanpa profil -> "Pemain"');
  ok(parsePost({ ...row, kind: 'game' }) === null, 'parsePost: kind tak dikenal ditolak');
  ok(parsePost({ ...row, id: 'bukan-uuid' }) === null, 'parsePost: id bukan UUID ditolak');
  ok(parsePost({ ...row, heroes: 'layla' }) === null && parsePost({ ...row, heroes: [1] }) === null, 'parsePost: heroes harus larik string');
  ok(parsePost({ ...row, payload: 'a'.repeat(9000) }) === null, 'parsePost: payload terlalu panjang ditolak');
  ok(parsePost({ ...row, like_count: -5, comment_count: 'x' })?.likes === 0, 'parsePost: hitungan negatif/rusak jadi 0');
  ok(parsePost(null) === null && parsePost([]) === null && parsePost('x') === null, 'parsePost: bukan objek ditolak');
  const c = parseComment({ id: ID, post_id: ID, user_id: ID, body: 'halo', hidden: true, created_at: '2026-10-28T10:00:00Z', profiles: { display_name: 'Eka' } });
  ok(!!c && c.author === 'Eka' && c.hidden, 'parseComment: valid');
  ok(parseComment({ id: ID, post_id: ID, user_id: ID, body: 5 }) === null, 'parseComment: body bukan teks ditolak');
  ok(isUuid(ID) && !isUuid('abc') && !isUuid(null), 'isUuid');

  ok(winRate({ duelPlayed: 0, duelWins: 0 }) === null && winRate({ duelPlayed: 3, duelWins: 2 }) === 67, 'winRate: null tanpa duel, 2/3 = 67');
  ok(cleanQuery("a'b,c)(*%\\") === "a'b c", 'cleanQuery: buang karakter sintaks filter');
  ok(cleanQuery('x'.repeat(100)).length === 40, 'cleanQuery: maks 40 karakter');
  ok(cleanQuery('Chang’e rōnin') === 'Chang e rōnin', 'cleanQuery: huruf unicode dipertahankan');
  const now = Date.parse('2026-10-28T12:00:00Z');
  ok(ago(now - 10_000, now) === 'baru saja' && ago(now - 5 * 60_000, now) === '5 mnt lalu' && ago(now - 3 * 3600_000, now) === '3 jam lalu' && ago(now - 2 * 86400_000, now) === '2 hari lalu', 'ago: satuan waktu');
  ok(ago(0, now) === '', 'ago: tanpa waktu -> kosong');

  ok(friendlyError({ message: 'rate_limit_posts', code: 'P0001' }).includes('maksimal 10'), 'friendlyError: rate limit posting');
  ok(friendlyError({ message: 'duel_hero' }).includes('hero yang sama'), 'friendlyError: duel beda hero');
  ok(friendlyError({ code: '23505', message: 'duplicate key' }) === 'Sudah pernah dilakukan.', 'friendlyError: duplikat');
  ok(friendlyError({ code: '42501', message: 'new row violates row-level security policy' }).startsWith('Tidak diizinkan'), 'friendlyError: RLS');
  ok(friendlyError(new TypeError('Failed to fetch')).includes('Tidak bisa terhubung'), 'friendlyError: jaringan');
  ok(friendlyError({ code: 'PGRST301', message: 'JWT expired' }).includes('Sesi'), 'friendlyError: JWT kedaluwarsa');
  ok(friendlyError(undefined) === 'Gagal. Coba lagi.', 'friendlyError: tanpa info');

  const jwt = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.s`;
  ok(!readConfig(undefined, 'k').ok && !readConfig('https://x.supabase.co', '').ok, 'readConfig: kosong -> mati');
  ok(JSON.stringify(readConfig('abc', 'k')) === '{"ok":false,"reason":"bad_url"}', 'readConfig: URL tidak valid');
  ok(JSON.stringify(readConfig('http://abc.supabase.co', 'k')) === '{"ok":false,"reason":"bad_url"}', 'readConfig: http non-lokal ditolak');
  ok(readConfig('http://localhost:54321', 'k').ok && readConfig('http://127.0.0.1:3002/', 'k').ok, 'readConfig: http lokal diizinkan');
  const good = readConfig(' https://abc.supabase.co/ ', jwt('anon'));
  ok(good.ok && good.url === 'https://abc.supabase.co', 'readConfig: kunci anon diterima, spasi/garis miring akhir dibuang');
  ok(JSON.stringify(readConfig('https://abc.supabase.co', jwt('service_role'))) === '{"ok":false,"reason":"secret_key"}', 'readConfig: kunci service_role ditolak');
  ok(JSON.stringify(readConfig('https://abc.supabase.co', 'sb_secret_abc')) === '{"ok":false,"reason":"secret_key"}', 'readConfig: sb_secret_ ditolak');
  ok(readConfig('https://abc.supabase.co', 'sb_publishable_abc').ok, 'readConfig: sb_publishable_ diterima');

  // --- profil, statistik, aktivitas ---
  const prof = parseProfile({ id: ID, display_name: 'Eka', bio: 'Main jungle', main_hero: 'ling', created_at: '2026-10-01T00:00:00Z' });
  ok(!!prof && prof.name === 'Eka' && prof.bio === 'Main jungle' && prof.mainHero === 'ling' && prof.joinedAt > 0, 'parseProfile: valid');
  ok(parseProfile({ id: ID, display_name: 'Eka', main_hero: 'Ling; drop' })?.mainHero === null, 'parseProfile: hero utama tidak valid -> null');
  ok(parseProfile({ id: ID, display_name: '   ' }) === null && parseProfile({ id: 'x', display_name: 'a' }) === null, 'parseProfile: nama kosong / id salah ditolak');
  ok(parseProfile({ id: ID, display_name: 'Eka' })?.bio === '', 'parseProfile: bio hilang -> kosong');

  const tally = tallyHeroes([['layla', 'aldous'], ['layla'], ['layla', 'layla'], ['zilong'], ['aldous']]);
  ok(tally[0].id === 'layla' && tally[0].count === 3 && tally[1].id === 'aldous' && tally[1].count === 2, 'tallyHeroes: hitung per tulisan (hero ganda dalam satu tulisan dihitung sekali)');
  ok(tallyHeroes([['b'], ['a']]).map((x) => x.id).join() === 'a,b', 'tallyHeroes: seri diurutkan menurut id');
  ok(tallyHeroes([['a'], ['b'], ['c']], 2).length === 2, 'tallyHeroes: batas teratas');

  const st = statsFrom([
    { kind: 'build', heroes: ['layla'], like_count: 4, comment_count: 1, duel_played: 3, duel_wins: 2 },
    { kind: 'team', heroes: ['layla', 'aldous'], like_count: 1, comment_count: 0, duel_played: 0, duel_wins: 0 },
    { kind: 'zzz', like_count: 99 },
    null,
    { kind: 'build', heroes: 'bukan larik', like_count: -3, comment_count: 'x' },
  ]);
  ok(st.posts === 3 && st.builds === 2 && st.teams === 1, 'statsFrom: hitung tulisan, baris rusak dilewati');
  ok(st.likes === 5 && st.comments === 1 && st.duelPlayed === 3 && st.duelWins === 2, 'statsFrom: jumlah suka/komentar/duel, nilai negatif jadi 0');
  ok(st.topHeroes[0].id === 'layla' && st.topHeroes[0].count === 2, 'statsFrom: hero teratas');
  ok(statsFrom('bukan larik').posts === 0, 'statsFrom: bukan larik -> nol');

  const act = parseActivity({ id: ID, post_id: ID, body: 'mantap', created_at: '2026-10-28T10:00:00Z', profiles: { display_name: 'Budi' }, posts: { title: 'Layla crit', user_id: ID } });
  ok(!!act && act.author === 'Budi' && act.postTitle === 'Layla crit', 'parseActivity: valid');
  ok(parseActivity({ id: ID, post_id: ID, body: 'x', posts: [] }) === null && parseActivity({ id: ID, post_id: ID, body: 5, posts: { title: 't' } }) === null, 'parseActivity: tanpa judul / body salah ditolak');

  ok(friendlyError({ message: 'bookmark_quota' }).includes('200'), 'friendlyError: kuota simpanan');
  ok(friendlyError({ message: 'violates check constraint "profiles_bio_check"' }).includes('Bio'), 'friendlyError: bio terlalu panjang');
}

// --- util tampilan ---
{
  const at = (h: number) => new Date(2026, 9, 28, h, 0, 0);
  ok(greeting(at(5)) === 'Selamat pagi' && greeting(at(12)) === 'Selamat siang' && greeting(at(16)) === 'Selamat sore' && greeting(at(20)) === 'Selamat malam' && greeting(at(2)) === 'Selamat malam', 'greeting: pagi/siang/sore/malam');
  ok(avatarHue('abc') === avatarHue('abc') && avatarHue('abc') !== avatarHue('abd') && avatarHue('x') >= 0 && avatarHue('x') < 360, 'avatarHue: stabil dan 0-359');
}

// --- cadangan data ---
{
  const hm = new Map(BASE_HEROES.map((h) => [h.id, h]));
  const b1: Build = { id: 'b1', name: 'Layla crit', heroId: 'layla', items: [ITEMS[0].id, ITEMS[1].id, null, null, null, null], emblemId: '', talents: [], spellId: '', notes: 'catatan é', updatedAt: 1 };
  const b2: Build = { ...b1, id: 'b2', name: 'Layla burst', items: [ITEMS[2].id, null, null, null, null, null] };
  const t1: Team = { id: 't1', name: 'Tim A', updatedAt: 1, slots: { ...emptySlots(), Gold: { heroId: 'layla', buildId: 'b1' }, EXP: { heroId: 'aldous', buildId: null } } };
  const custom: Hero = { id: 'hero-baru', name: 'Hero Baru', roles: ['Mage'], lanes: ['Mid'], custom: true };
  const file = makeBackup([b1, b2], [t1], [custom, BASE_HEROES[0]], 5);
  ok(file.heroes.length === 1 && file.builds.length === 2 && file.teams.length === 1 && file.version === 1, 'makeBackup: isi berkas (hanya hero kustom)');
  const text = JSON.stringify(file);

  const empty = readBackup(text, hm, { builds: [], teams: [] });
  ok(empty.ok && empty.heroes.length === 1 && empty.heroes[0].custom === true, 'readBackup: hero kustom dipulihkan');
  ok(empty.ok && empty.builds.length === 2 && empty.teams.length === 1 && empty.skipped === 0 && empty.duplicates === 0, 'readBackup: ke perangkat kosong semua masuk, build di dalam komposisi tidak dobel');
  if (empty.ok) {
    const gold = empty.teams[0].slots.Gold.buildId;
    ok(!!gold && empty.builds.some((b) => b.id === gold && b.name === 'Layla crit'), 'readBackup: komposisi menunjuk build hasil pulihan');
    ok(empty.builds.find((b) => b.name === 'Layla crit')?.notes === 'catatan é', 'readBackup: catatan unicode utuh');
  }
  const again = readBackup(text, hm, { builds: empty.ok ? empty.builds : [], teams: empty.ok ? empty.teams : [] });
  ok(again.ok && again.builds.length === 0 && again.teams.length === 0 && again.duplicates === 3, 'readBackup: pulihkan dua kali -> semua dianggap duplikat');
  const withCustom = new Map(hm);
  withCustom.set('hero-baru', custom);
  const noDupHero = readBackup(text, withCustom, { builds: [], teams: [] });
  ok(noDupHero.ok && noDupHero.heroes.length === 0, 'readBackup: hero yang sudah ada tidak ditambah lagi');

  ok(!readBackup('bukan json', hm, { builds: [], teams: [] }).ok, 'readBackup: bukan JSON ditolak');
  ok(!readBackup('{"app":"lain","version":1}', hm, { builds: [], teams: [] }).ok, 'readBackup: berkas aplikasi lain ditolak');
  ok(!readBackup('{"app":"mlbb-build-lab","version":2}', hm, { builds: [], teams: [] }).ok, 'readBackup: versi tak dikenal ditolak');
  ok(!readBackup('x'.repeat(2_000_001), hm, { builds: [], teams: [] }).ok, 'readBackup: berkas terlalu besar ditolak');
  const dirty = JSON.stringify({ ...file, builds: [...file.builds, 'AAAA', 5, null], teams: ['bukan', ...file.teams], heroes: [{ id: 'Bad Id!', name: 'x', roles: ['Mage'] }, { id: 'ok-id', name: 'Ok', roles: ['Nope'] }] });
  const d = readBackup(dirty, hm, { builds: [], teams: [] });
  ok(d.ok && d.skipped === 6 && d.builds.length === 2 && d.teams.length === 1, 'readBackup: entri rusak dilewati dan dihitung, sisanya tetap masuk');
  const unknownHero = JSON.stringify({ ...file, heroes: [] });
  const u = readBackup(unknownHero, hm, { builds: [], teams: [] });
  ok(u.ok && u.builds.length === 2, 'readBackup: build hero bawaan tetap terbaca tanpa daftar hero kustom');
  const badHeroBuild = makeBackup([{ ...b1, heroId: 'hero-baru' }], [], [custom]);
  const noHeroList = readBackup(JSON.stringify({ ...badHeroBuild, heroes: [] }), hm, { builds: [], teams: [] });
  ok(noHeroList.ok && noHeroList.builds.length === 0 && noHeroList.skipped === 1, 'readBackup: build milik hero kustom yang tidak ikut tercadang dibuang');
}

void emptyItems;
if (failed) {
  throw new Error(`${failed} pemeriksaan gagal`);
}
console.log('\nSemua pemeriksaan lolos');
