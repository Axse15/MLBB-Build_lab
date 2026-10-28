/**
 * Membuat snapshot roster tiap tim MPL ID dari API (match reguler terakhir yang punya detail pemain).
 * Dipakai app sebagai cadangan terakhir kalau API tidak bisa dijangkau. Hanya memakai Rone Arena API.
 * Jalankan: npm run rosters  (menulis src/data/rosters.ts). Jalankan lagi tiap ada pergantian pemain.
 * Satu tim yang gagal dilewati tanpa menghapus snapshot lamanya.
 * Server sering membalas 500/503 (batas sumber daya) atau lambat, jadi tiap match dicoba beberapa kali dengan jeda panjang.
 * Opsi: --missing = hanya tim yang belum punya snapshot lengkap (pemain + build); aman diulang sampai lengkap.
 */
import fs from 'node:fs';
import { fetchIdMaps, fetchMatch, fetchSchedule } from '../src/lib/fetchers';
import { recentDetailedMatches, rosterOf, type Roster } from '../src/lib/live';

const OUT = new URL('../src/data/rosters.ts', import.meta.url);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const day = (t: number | null) => (t === null ? '' : new Date(t).toISOString().slice(0, 10));

// Snapshot lama (kalau ada), supaya tim yang gagal diambil tetap punya data.
const old: Record<string, Roster & { date: string }> = {};
try {
  const mod = (await import('../src/data/rosters')) as { ROSTER_SNAPSHOT: { teams: typeof old } };
  Object.assign(old, mod.ROSTER_SNAPSHOT.teams);
} catch {
  /* belum ada */
}

const onlyMissing = process.argv.includes('--missing');

async function patient<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await sleep(4000 * (i + 1));
    }
  }
  throw last;
}

const schedule = await patient(fetchSchedule);
// Nama item/talent untuk snapshot (supaya build terbaca saat API mati). Gagal = snapshot tanpa nama.
const maps = await patient(fetchIdMaps, 3).catch(() => null);
const withNames = (r: Roster): Roster => ({
  ...r,
  players: r.players.map((p) => ({
    ...p,
    itemNames: maps ? (p.items ?? []).map((id) => maps.items[id] ?? id) : undefined,
    talentNames: maps ? (p.talents ?? []).map((id) => maps.talents[id] ?? id) : undefined,
  })),
});
const teams = [...new Set(schedule.flatMap((m) => [m.team1, m.team2]))].filter((t) => t && t !== 'TBD').sort();
const out: Record<string, Roster & { date: string }> = {};
for (const team of teams) {
  if (onlyMissing && old[team]?.players.every((p) => p.items?.length && p.itemNames?.length)) {
    out[team] = old[team];
    continue;
  }
  let got: (Roster & { date: string }) | null = null;
  for (const m of recentDetailedMatches(schedule, team, 3)) {
    try {
      const d = await patient(() => fetchMatch(m.matchId as string), 3);
      const r = rosterOf(d, team, m.team1 === team ? m.team2 : m.team1, m.startAt);
      if (r && r.players.length === 5) {
        got = { ...withNames(r), fromMatch: m.matchId as string, date: day(m.startAt) };
        break;
      }
    } catch (e) {
      console.log(`  ${team}: match ${m.matchId} gagal (${e instanceof Error ? e.message : String(e)})`);
    }
    await sleep(1500);
  }
  if (got) console.log(`${team}: ${got.players.map((p) => p.name).join(', ')} (match ${got.fromMatch}, ${got.date})`);
  else if (old[team]) console.log(`${team}: gagal, memakai snapshot lama`);
  else console.log(`${team}: gagal dan belum ada snapshot`);
  if (got ?? old[team]) out[team] = (got ?? old[team]) as Roster & { date: string };
  await sleep(1500);
}
if (Object.keys(out).length === 0) throw new Error('Tidak ada roster yang berhasil diambil; file tidak diubah.');

const body = `/**
 * Snapshot roster tiap tim MPL ID, dibuat otomatis oleh \`npm run rosters\` dari Rone Arena API
 * (susunan di match reguler terakhir yang punya detail pemain). JANGAN diedit manual.
 * Dipakai hanya sebagai cadangan terakhir kalau API tidak terjangkau; app selalu mencoba data langsung dulu.
 * Susunan playoff bisa berbeda (pergantian pemain, cadangan).
 */
import type { Roster } from '../lib/live';

export const ROSTER_SNAPSHOT: { at: string; teams: Record<string, Roster & { date: string }> } = ${JSON.stringify({ at: new Date().toISOString().slice(0, 10), teams: out }, null, 2)};
`;
fs.writeFileSync(OUT, body);
console.log(`\nDitulis ${Object.keys(out).length} tim ke src/data/rosters.ts`);
