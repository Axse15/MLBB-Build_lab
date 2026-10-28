/**
 * Pemeriksa data usang. Membandingkan isi Rone Arena API sekarang dengan snapshot pemeriksaan terakhir
 * dan dengan data statis app. Hanya memakai API (tidak ada scraping situs lain).
 * Jalankan: npm run drift. Menulis scripts/api-snapshot.json dan, kalau ada yang perlu dilaporkan, drift-report.md.
 * API tidak terjangkau = keluar tanpa mengubah apa pun dan tanpa gagal (server gratis sering 500 sesaat).
 */
import fs from 'node:fs';
import { diffSnapshots, renderReport, staticItemsGone, type ApiSnapshot } from '../src/lib/drift';
import { fetchAll, fetchHeroes, fetchIcons, fetchVersion } from '../src/lib/fetchers';
import { parseEquipmentNames } from '../src/lib/live';

const SNAPSHOT = new URL('./api-snapshot.json', import.meta.url);
const REPORT = new URL('../drift-report.md', import.meta.url);

async function collect(): Promise<ApiSnapshot> {
  const [heroes, icons, equip, expanded, version] = await Promise.all([
    fetchHeroes(),
    fetchIcons(),
    fetchAll('/api/academy/equipment'),
    fetchAll('/api/academy/equipment/expanded').catch(() => null),
    fetchVersion().catch(() => null),
  ]);
  const types = new Map(parseEquipmentNames(expanded).map((i) => [i.name, i.type]));
  const items = parseEquipmentNames(equip).map((i) => ({ name: i.name, type: types.get(i.name) ?? '' }));
  if (items.length < 50 || heroes.names.length < 50) throw new Error(`Data API terlalu sedikit (${items.length} item, ${heroes.names.length} hero)`);
  return {
    at: new Date().toISOString().slice(0, 10),
    version,
    items,
    talents: icons.catalog.talents.map((t) => t.name),
    spells: icons.catalog.spells.map((s) => s.name),
    heroes: heroes.names,
    itemsGone: staticItemsGone(items),
  };
}

const next = await collect().catch((e: unknown) => {
  console.log(`API tidak terjangkau atau datanya tidak masuk akal, pemeriksaan dilewati: ${e instanceof Error ? e.message : String(e)}`);
  return null;
});
if (!next) process.exit(0);

let prev: ApiSnapshot | null = null;
try {
  prev = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as ApiSnapshot;
} catch {
  /* belum ada snapshot: pemeriksaan pertama */
}

const report = renderReport(diffSnapshots(prev, next), next.at);
fs.writeFileSync(SNAPSHOT, JSON.stringify(next, null, 1) + '\n');
if (report) {
  fs.writeFileSync(REPORT, report);
  console.log(report);
} else {
  fs.rmSync(REPORT, { force: true });
  console.log(prev ? 'Tidak ada perbedaan yang perlu dilaporkan.' : 'Snapshot pertama dibuat. Pemeriksaan berikutnya membandingkan dengan ini.');
}
