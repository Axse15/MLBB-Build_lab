/**
 * Uji langsung ke Rone Arena API dan cocokkan dengan data statis.
 * Jalankan di komputer yang punya internet:  npm run probe
 * (Dibuat karena skema respons di app ini diambil dari source API, bukan dari panggilan langsung.)
 */
import { BASE_HEROES } from '../src/data/heroes';
import { EMBLEMS, SPELLS } from '../src/data/emblems';
import { ITEMS } from '../src/data/items';
import { PATCHES } from '../src/data/patches';
import { getJson } from '../src/lib/api';
import { fetchAll, fetchBuilds, fetchEmblemSets, fetchGuides, fetchIdMaps, fetchHeroes, fetchIcons, fetchPlayoffs, fetchStandings, fetchVersion } from '../src/lib/fetchers';
import { compareVersions, iconFor, mergeHeroes, nameKey } from '../src/lib/live';
import { recoToBuild } from '../src/lib/reco';
import { TALENT_BY_NAME } from '../src/data/emblems';

let failures = 0;
const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`ok   : ${name} (${Date.now() - t0} ms)`);
    return r;
  } catch (e) {
    console.log(`GAGAL: ${name} (${Date.now() - t0} ms) -> ${e instanceof Error ? e.message : String(e)}`);
    failures++;
    return null;
  }
};

const raw = await step('hero (/api/heroes + /api/heroes/positions)', fetchHeroes);
if (raw) {
  const { sync, heroes } = mergeHeroes(BASE_HEROES, raw.names, raw.positions);
  console.log(`      nama dari API: ${raw.names.length}, dengan role/lane: ${raw.positions.length}, hasil gabungan: ${heroes.length}`);
  console.log(`      dipakai: ${sync.usable}`);
  console.log(`      hero baru: ${sync.added.join(', ') || '-'}`);
  console.log(`      baru tanpa role: ${sync.noRole.join(', ') || '-'}`);
  console.log(`      role/lane berubah: ${sync.updated.join(', ') || '-'}`);
  console.log(`      statis tapi tak ditemukan di API (cek ejaan): ${sync.missing.join(', ') || '-'}`);
  const noLane = raw.positions.filter((p) => p.lanes.length === 0).map((p) => p.name);
  console.log(`      hero tanpa lane dari API: ${noLane.join(', ') || '-'}`);
  const noImg = BASE_HEROES.filter((h) => !raw.images[nameKey(h.name)]).map((h) => h.name);
  console.log(`      gambar hero: ${Object.keys(raw.images).length} dari API; hero statis tanpa gambar: ${noImg.join(', ') || '-'}`);
  const sample = Object.values(raw.images)[0];
  if (sample) console.log(`      contoh URL gambar: ${sample}`);
}

const icons = await step('ikon (/api/academy/equipment, /spells, /emblems)', fetchIcons);
if (icons) {
  const talentNames = [...new Set(EMBLEMS.flatMap((e) => e.talents.map((t) => t.name)))];
  const miss = (names: string[], map: Record<string, string>) => names.filter((n) => !iconFor(map, n));
  // Untuk nama yang tidak cocok, tampilkan kunci di API yang mengandung salah satu kata dari nama itu.
  const hint = (name: string, map: Record<string, string>) => {
    const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const found = Object.keys(map).filter((k) => words.some((w) => k.includes(w))).slice(0, 5);
    return `${name} -> ${found.join(' | ') || '(tidak ada kunci mirip)'}`;
  };
  if (icons.problems.length) console.log(`      MASALAH: ${icons.problems.join('; ')}`);
  const mi = miss(ITEMS.map((i) => i.name), icons.items);
  for (const n of mi) console.log(`      saran item  : ${hint(n, icons.items)}`);
  const ms = miss(SPELLS.map((s) => s.name), icons.spells);
  const mt = miss(talentNames, icons.talents);
  console.log(`      item: ${Object.keys(icons.items).length} ikon di API; item statis tanpa ikon (${mi.length}/${ITEMS.length}): ${mi.join(', ') || '-'}`);
  console.log(`      spell: ${Object.keys(icons.spells).length} ikon di API; tanpa ikon: ${ms.join(', ') || '-'}`);
  console.log(`      talent: ${Object.keys(icons.talents).length} ikon di API; talent statis tanpa ikon: ${mt.join(', ') || '-'}`);
  console.log(`      nama ikon item di API (contoh): ${Object.keys(icons.items).slice(0, 8).join(', ')}`);
}

const po = await step('playoff MPL ID (/api/esports/id/playoffs)', fetchPlayoffs);
if (po) {
  console.log(`      seed: ${po.seeds.length}, hari: ${po.days.length}, match: ${po.days.reduce((n, d) => n + d.matches.length, 0)}, seed dengan logo: ${po.seeds.filter((s) => s.logo).length}`);
  for (const d of po.days) for (const m of d.matches) console.log(`      ${d.label} | ${m.round} | ${m.team1} vs ${m.team2} | ${m.score1 ?? '-'}:${m.score2 ?? '-'} | ${m.status}`);
}

const st = await step('klasemen (/api/esports/id/standings)', fetchStandings);
if (st) console.log(`      baris klasemen: ${st.length}`);

const ver = await step('versi game (/api/academy/meta/version)', fetchVersion);
if (ver) {
  const known = PATCHES.some((p) => compareVersions(p.version, ver) === 0);
  console.log(`      versi terbaru di API: ${ver}; ada di data patch statis: ${known}`);
}

// Bentuk data build (belum dipakai app): dicetak apa adanya supaya fitur "rekomendasi build" disusun dari data nyata.
// Catatan: ini agregat per rank (pick/win rate), BUKAN build pemain Top Global.
const shape = (v: unknown, depth = 0): string => {
  if (Array.isArray(v)) return `[${v.length}] ${v.length ? shape(v[0], depth + 1) : ''}`;
  if (v && typeof v === 'object') {
    if (depth > 4) return '{…}';
    return '{' + Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${shape(x, depth + 1)}`).join(', ') + '}';
  }
  return typeof v === 'string' ? JSON.stringify(v.length > 40 ? v.slice(0, 40) + '…' : v) : String(v);
};
await step('bentuk data build (/api/academy/heroes/Fanny/builds?lane=jungle&rank=glory)', async () => {
  const json = await getJson('/api/academy/heroes/Fanny/builds?lane=jungle&rank=glory&size=3&index=1&lang=en');
  const recs = (json as { data?: { records?: unknown[] } })?.data?.records ?? [];
  console.log(`      record: ${recs.length}`);
  if (recs[0]) console.log(`      bentuk: ${shape(recs[0])}`);
});
await step('contoh record equipment dan emblem (cari kunci id)', async () => {
  const eq = await getJson('/api/academy/equipment?size=2&index=1&lang=en');
  const em = await getJson('/api/academy/emblems?size=2&index=1&lang=en');
  console.log(`      equipment: ${shape((eq as { data?: { records?: unknown[] } })?.data?.records?.[0])}`);
  console.log(`      emblem   : ${shape((em as { data?: { records?: unknown[] } })?.data?.records?.[0])}`);
});

// Gabungkan ID di build dengan daftar equipment dan emblem: berapa persen ID yang ketemu?
await step('uji pemetaan ID build -> nama (equipment, emblem)', async () => {
  const recs = (j: unknown): Record<string, unknown>[] =>
    (((j as { data?: { records?: unknown[] } })?.data?.records ?? []) as unknown[]).map((r) => ((r as { data?: unknown })?.data ?? {}) as Record<string, unknown>);
  const equip = recs(await fetchAll('/api/academy/equipment'));
  const emb = recs(await fetchAll('/api/academy/emblems'));
  const equipIds = new Map(equip.map((e) => [String(e.equipid), String(e.equipname)]));
  const byGift = new Map<string, string>();
  const bySkill = new Map<string, string>();
  const bySkillLv = new Map<string, string>();
  for (const e of emb) {
    const sk = (e.emblemskill ?? {}) as Record<string, unknown>;
    const nm = String(sk.skillname);
    byGift.set(String(e.giftid), nm);
    bySkill.set(String(sk.skillid), nm);
    bySkillLv.set(String(sk.skillid_lv), nm);
  }
  console.log('      talent: giftid | gifttiers | skillid | skillid_lv | nama');
  for (const e of emb) {
    const sk = (e.emblemskill ?? {}) as Record<string, unknown>;
    console.log(`        ${e.giftid} | ${e.gifttiers} | ${sk.skillid} | ${sk.skillid_lv} | ${sk.skillname}`);
  }
  const skillIds = new Set<string>([...byGift.keys(), ...bySkill.keys(), ...bySkillLv.keys()]);
  let hGift = 0, hSkill = 0, hLv = 0;
  console.log(`      equipment: ${equip.length} record, rentang id ${Math.min(...equip.map((e) => Number(e.equipid)))}..${Math.max(...equip.map((e) => Number(e.equipid)))}`);
  console.log(`      emblem   : ${emb.length} record, contoh skillid: ${[...skillIds].slice(0, 6).join(', ')}`);
  let eqSeen = 0, eqHit = 0, runeSeen = 0, runeHit = 0;
  let shown = false;
  for (const hero of ['Fanny', 'Layla', 'Gusion', 'Tigreal']) {
    for (const lane of ['jungle', 'gold', 'mid', 'roam', 'exp']) {
      let json: unknown;
      try { json = await getJson(`/api/academy/heroes/${hero}/builds?lane=${lane}&rank=glory&size=3&index=1&lang=en`); } catch { continue; }
      for (const r of recs(json)) {
        for (const b of (r.build as Record<string, unknown>[] | undefined) ?? []) {
          for (const id of (b.equipid as unknown[]) ?? []) { eqSeen++; if (equipIds.has(String(id))) eqHit++; }
          for (const id of (b.new_rune_skill as unknown[]) ?? []) { runeSeen++; if (skillIds.has(String(id))) runeHit++; if (byGift.has(String(id))) hGift++; if (bySkill.has(String(id))) hSkill++; if (bySkillLv.has(String(id))) hLv++; }
          if (!shown) {
            shown = true;
            console.log(`      contoh build ${hero}/${lane}: ${JSON.stringify(b).slice(0, 900)}`);
            console.log(`      new_rune_skill ${JSON.stringify(b.new_rune_skill)} -> giftid: ${((b.new_rune_skill as unknown[]) ?? []).map((i) => byGift.get(String(i)) ?? '?').join(' | ')}`);
            console.log(`      equipid -> nama: ${((b.equipid as unknown[]) ?? []).map((i) => equipIds.get(String(i)) ?? '?' + i).join(' | ')}`);
          }
        }
      }
    }
  }
  console.log(`      rune cocok per kolom -> giftid: ${hGift}, skillid: ${hSkill}, skillid_lv: ${hLv} (dari ${runeSeen})`);
  console.log(`      equipid cocok: ${eqHit}/${eqSeen}; new_rune_skill cocok dengan id emblem: ${runeHit}/${runeSeen}`);
});

// Fitur rekomendasi build memakai kode yang sama dengan app: peta ID -> nama, lalu cocokkan ke data statis.
await step('rekomendasi build (kode app, beberapa hero)', async () => {
  const maps = await fetchIdMaps();
  console.log(`      peta ID: ${Object.keys(maps.items).length} item, ${Object.keys(maps.talents).length} talent`);
  const tests: [string, 'Gold' | 'EXP' | 'Mid' | 'Jungle' | 'Roam'][] = [['Fanny', 'Jungle'], ['Layla', 'Gold'], ['Gusion', 'Mid'], ['Tigreal', 'Roam'], ['Yu Zhong', 'EXP']];
  let builds = 0, perTier = 0, unknownIds = 0;
  const missing = new Set<string>();
  for (const [h, lane] of tests) {
    try {
      const recos = await fetchBuilds(h, lane, 'glory', maps);
      console.log(`      ${h}/${lane}: ${recos.length} build`);
      recos.slice(0, 1).forEach((r) => console.log(`        ${r.items.join(' | ')} || ${r.emblem} || ${r.spell} || ${r.talents.join(', ')} || pick ${r.pick} win ${r.win}`));
      for (const r of recos) {
        builds++;
        unknownIds += r.unknown;
        const slots = r.talents.map((t) => TALENT_BY_NAME[t]?.slot ?? 0).sort().join('');
        if (slots === '123') perTier++;
        recoToBuild(r).missing.forEach((m) => missing.add(m));
      }
    } catch (e) {
      console.log(`      ${h}/${lane}: GAGAL ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`      ${builds} build; tepat 1 talent per tier: ${perTier}/${builds}; ID tak dikenal: ${unknownIds}`);
  console.log(`      nama dari API yang tidak ada di data statis app: ${[...missing].join(', ') || '-'}`);
});

// Diagnosis "Failed to fetch" di browser: Node melihat status HTTP asli dan ada/tidaknya header CORS.
await step('diagnosis endpoint builds (status HTTP + header CORS)', async () => {
  const cases = [
    ['Obsidia', 'gold', 'all'], ['Obsidia', 'gold', 'glory'], ['Obsidia', 'gold', 'mythic'],
    ['Fanny', 'jungle', 'all'], ['Fanny', 'jungle', 'glory'], ['Layla', 'gold', 'all'],
  ];
  // Pembanding: endpoint yang di browser kamu berhasil (ikon item) harus punya header CORS yang sama.
  const ctl = await fetch('https://arena.rone.dev/api/academy/equipment?size=1&index=1&lang=en', { headers: { Origin: 'http://localhost:5173' } });
  console.log(`      pembanding /academy/equipment: HTTP ${ctl.status}, CORS=${ctl.headers.get('access-control-allow-origin') ?? 'TIDAK ADA'}`);
  for (const [h, lane, rank] of cases) {
    const url = `https://arena.rone.dev/api/academy/heroes/${h}/builds?lane=${lane}&rank=${rank}&size=5&index=1&lang=en`;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', Origin: 'http://localhost:5173' } });
      const body = await r.text();
      let info = '';
      try {
        const j = JSON.parse(body) as { data?: { records?: { data?: { build?: unknown[] } }[] } };
        const recs = j.data?.records ?? [];
        info = `record ${recs.length}, build ${recs.reduce((n, x) => n + (x.data?.build?.length ?? 0), 0)}`;
      } catch {
        info = `bukan JSON: ${body.slice(0, 120).replace(/\s+/g, ' ')}`;
      }
      console.log(`      ${h}/${lane}/${rank}: HTTP ${r.status}, CORS=${r.headers.get('access-control-allow-origin') ?? 'TIDAK ADA'}, ${info} (${Date.now() - t0} ms)`);
    } catch (e) {
      console.log(`      ${h}/${lane}/${rank}: error jaringan ${e instanceof Error ? e.message : String(e)}`);
    }
  }
});

// Panduan pemain (6 item): diuji dengan kode app yang sama.
await step('panduan pemain (/api/academy/heroes/{hero}/recommended)', async () => {
  const maps = await fetchIdMaps();
  const sets = await fetchEmblemSets().catch(() => ({}));
  console.log(`      peta: ${Object.keys(maps.items).length} item, ${Object.keys(maps.talents).length} talent, ${Object.keys(maps.spells).length} spell, ${Object.keys(sets).length} set emblem (${Object.values(sets).join(', ')})`);
  let total = 0, six = 0, noSpell = 0, noEmblem = 0, noAuthor = 0, unk = 0;
  const missing = new Set<string>();
  for (const h of ['Fanny', 'Layla', 'Gusion', 'Tigreal', 'Obsidia', 'Yu Zhong']) {
    try {
      const gs = await fetchGuides(h, maps, sets);
      console.log(`      ${h}: ${gs.length} panduan`);
      gs.slice(0, 2).forEach((g) => console.log(`        "${g.title}" oleh ${g.author} (${g.views} dilihat, ${g.lane ?? '?'}) | ${g.items.length} item: ${g.items.join(', ')} | ${g.emblem || '?'} | ${g.spell || '?'} | ${g.talents.join(', ')}`));
      for (const g of gs) {
        total++;
        if (g.items.length === 6) six++;
        if (!g.spell) noSpell++;
        if (!g.emblem) noEmblem++;
        if (!g.author) noAuthor++;
        unk += g.unknown;
        recoToBuild(g).missing.forEach((m) => missing.add(m));
      }
    } catch (e) {
      console.log(`      ${h}: GAGAL ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`      ${total} panduan; 6 item: ${six}; tanpa spell: ${noSpell}; tanpa emblem: ${noEmblem}; tanpa penulis: ${noAuthor}; ID tak dikenal: ${unk}`);
  console.log(`      nama dari API yang tidak ada di data statis app: ${[...missing].join(', ') || '-'}`);
});

if (failures) throw new Error(`${failures} pemeriksaan gagal`);
