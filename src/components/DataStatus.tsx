import { SPELLS, EMBLEMS } from '../data/emblems';
import { ITEMS } from '../data/items';
import { iconFor } from '../lib/live';
import { ago, useLive, type Slice } from '../live';

function Dot({ s }: { s: Slice<unknown> }) {
  const cls = s.state === 'ok' ? 'ok' : s.state === 'stale' ? 'warn' : s.state === 'loading' ? 'idle' : 'bad';
  return <span className={`dot ${cls}`} aria-hidden="true" />;
}

function stateText(s: Slice<unknown>): string {
  if (s.state === 'loading') return 'memuat…';
  if (s.state === 'error') return `gagal, pakai data statis (${s.error})`;
  if (s.state === 'stale') return `cache lama, ${ago(s.at)}`;
  return `live, ${ago(s.at)}`;
}

/** Ringkasan sumber data: apa yang live, apa yang jatuh ke data statis, dan kenapa. */
export function DataStatus() {
  const { heroes, heroList, images, icons, catalog, playoffs, standings, version, reload } = useLive();
  const talentNames = [...new Set(EMBLEMS.flatMap((e) => e.talents.map((t) => t.name)))];
  const heroImgs = heroList.filter((h) => h.img).length;
  const itemImgs = ITEMS.filter((i) => iconFor(icons.items, i.name)).length;
  const spellImgs = SPELLS.filter((s) => iconFor(icons.spells, s.name)).length;
  const talentImgs = talentNames.filter((t) => iconFor(icons.talents, t)).length;
  const rows: [string, Slice<unknown>][] = [
    ['Hero, role, lane', heroes],
    ['Ikon item, spell, talent', images],
    ['Playoff MPL ID', playoffs],
    ['Klasemen', standings],
    ['Versi game', version],
  ];
  const sync = heroes.data;
  const busy = rows.some(([, s]) => s.state === 'loading');

  return (
    <section className="data-status" aria-label="Status sumber data">
      <div className="row">
        <strong>Sumber data</strong>
        <button type="button" className="btn ghost small" onClick={reload} disabled={busy}>
          Muat ulang dari API
        </button>
      </div>
      <ul className="ds-list">
        {rows.map(([label, s]) => (
          <li key={label}>
            <Dot s={s} /> {label}: {stateText(s)}
          </li>
        ))}
        <li>
          <span className="dot static" aria-hidden="true" /> Item, emblem, battle spell, catatan patch: statis (API tidak menyediakan harga item, deskripsi talent, maupun isi patch)
        </li>
      </ul>
      <p className="small muted">
        Gambar dari API (tidak disimpan di proyek): hero {heroImgs}/{heroList.length}, item {itemImgs}/{ITEMS.length}, spell {spellImgs}/{SPELLS.length}, talent {talentImgs}/{talentNames.length}.
        Yang tidak cocok namanya tampil tanpa gambar. Emblem tidak punya ikon di API.
        {icons.problems.length > 0 && ` Masalah ikon: ${icons.problems.join('; ')}.`}
      </p>
      {(catalog.addedTalents.length > 0 || catalog.addedSpells.length > 0) && (
        <p className="small muted">
          API punya data yang belum ada di data statis app, dan sudah ditambahkan otomatis ke pemilih:
          {catalog.addedTalents.length > 0 && ` talent ${catalog.addedTalents.join(', ')};`}
          {catalog.addedSpells.length > 0 && ` battle spell ${catalog.addedSpells.join(', ')} (cooldown belum diketahui).`} Tanda bahwa data statis app mulai tertinggal; item dan catatan patch tetap dicek lewat tugas terjadwal atau manual.
        </p>
      )}
      {sync && (
        <div className="ds-notes small muted">
          <p>
            {sync.liveCount} hero di API.
            {sync.added.length > 0 && ` Hero baru ditambahkan: ${sync.added.join(', ')}.`}
            {sync.noRole.length > 0 && ` Hero baru tanpa role di API (tidak ditambahkan, pakai "Hero kustom"): ${sync.noRole.join(', ')}.`}
          </p>
          {sync.updated.length > 0 && (
            <details>
              <summary>Role atau lane diperbarui dari API untuk {sync.updated.length} hero</summary>
              <p>{sync.updated.join(', ')}</p>
            </details>
          )}
          {sync.missing.length > 0 && (
            <p>
              Ada di data statis tapi tidak ditemukan di API (kemungkinan beda ejaan nama): {sync.missing.join(', ')}. Hero ini tetap dipakai dengan role dan lane perkiraan.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
