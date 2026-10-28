import { useEffect, useRef, useState } from 'react';
import { loadCached } from '../lib/api';
import { fetchBuilds, fetchEmblemSets, fetchGuides, fetchIdMaps, GUIDE_PAGE_SIZE, RANKS, type Rank } from '../lib/fetchers';
import { nameKey, rankName, validIdMaps, validRecos, type Reco } from '../lib/live';
import { ago, useLive } from '../live';
import { LANES, type Hero, type Lane } from '../types';
import { Icon } from './ui';

const HOUR = 3_600_000;
const RANK_LABEL: Record<Rank, string> = { glory: 'Glory', honor: 'Honor', mythic: 'Mythic', legend: 'Legend', epic: 'Epic', all: 'Semua rank' };
const pct = (v: number | null): string => (v === null ? '-' : `${(v * 100).toFixed(1)}%`);
const isRecord = (v: unknown): v is Record<string, string> => typeof v === 'object' && v !== null && !Array.isArray(v);

type Mode = 'rank' | 'guide';
type State =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; msg: string }
  | { state: 'ok'; recos: Reco[]; at: number; stale: boolean };

/**
 * Rekomendasi build dari Rone Arena API, dua sumber:
 * - Statistik rank: agregat build yang paling sering dipakai per rank dan lane. API hanya memberi 3 item inti.
 * - Panduan pemain: panduan buatan pemain (fitur panduan di game) dengan 6 item. Kualitasnya bervariasi.
 * Keduanya BUKAN build pemain Top Global: API tidak menyediakan data itu. Baru diambil setelah panel dibuka,
 * supaya server gratis tidak dipanggil setiap kali halaman ini dibuka.
 */
export function RecoPanel({ hero, onApply }: { hero: Hero; onApply: (r: Reco) => void }) {
  const lanes: readonly Lane[] = hero.lanes.length ? hero.lanes : LANES;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('guide');
  const [lane, setLane] = useState<Lane>(lanes[0]);
  const [rank, setRank] = useState<Rank>('glory');
  const [st, setSt] = useState<State>({ state: 'idle' });
  const [tick, setTick] = useState(0);
  const force = useRef(false);
  const { icons } = useLive();
  const known = icons.ids;
  const haveIds = Object.keys(known.items).length > 0 && Object.keys(known.spells).length > 0;

  useEffect(() => {
    if (!open || hero.custom) return;
    let alive = true;
    const f = force.current;
    force.current = false;
    setSt({ state: 'loading' });
    void (async () => {
      try {
        // ID dari respons ikon yang sudah ada; hanya kalau itu kosong baru minta lagi ke server.
        const maps = haveIds ? known : (await loadCached('mbl:live:idmaps:v2', 24 * HOUR, fetchIdMaps, validIdMaps, f)).data;
        const key = nameKey(hero.name);
        const r =
          mode === 'rank'
            ? await loadCached(`mbl:reco:v1:${key}:${lane}:${rank}`, 6 * HOUR, () => fetchBuilds(hero.name, lane, rank, maps), validRecos, f)
            : await (async () => {
                // Nama set emblem hanya pelengkap: kalau gagal, panduan tetap tampil tanpa nama emblem.
                const sets = await loadCached('mbl:live:emblemsets:v1', 24 * HOUR, fetchEmblemSets, isRecord, f).then((x) => x.data, () => ({}));
                return loadCached(`mbl:guide:v1:${key}`, 6 * HOUR, () => fetchGuides(hero.name, maps, sets), validRecos, f);
              })();
        if (alive) setSt({ state: 'ok', recos: r.data, at: r.at, stale: r.stale });
      } catch (e) {
        if (alive) setSt({ state: 'error', msg: e instanceof Error ? e.message : 'Gagal memuat' });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hero.name, hero.custom, mode, lane, rank, tick, haveIds]);

  const retry = () => {
    force.current = true;
    setTick((t) => t + 1);
  };

  return (
    <section className="panel reco-panel">
      <div className="panel-head">
        <h2>Rekomendasi build</h2>
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Sembunyikan' : 'Tampilkan'}
        </button>
      </div>
      <p className="muted small">Dari Rone Arena API. Ini bukan build pemain Top Global: API tidak menyediakan data pemain peringkat.</p>
      {open && hero.custom && <p className="empty">Hero kustom tidak ada di API.</p>}
      {open && !hero.custom && (
        <>
          <div className="chips tabs" role="group" aria-label="Sumber rekomendasi">
            <button type="button" className={`chip plain${mode === 'guide' ? ' on' : ''}`} aria-pressed={mode === 'guide'} onClick={() => setMode('guide')}>
              Panduan pemain (6 item)
            </button>
            <button type="button" className={`chip plain${mode === 'rank' ? ' on' : ''}`} aria-pressed={mode === 'rank'} onClick={() => setMode('rank')}>
              Statistik rank (3 item inti)
            </button>
          </div>
          {mode === 'rank' ? (
            <>
              <p className="muted small">
                Build yang paling sering dipakai per rank dan lane. API hanya memberi 3 item inti, bukan enam; sisanya kamu lengkapi sendiri.
              </p>
              <div className="row">
                <label className="field grow">
                  <span>Lane</span>
                  <select className="input" value={lane} onChange={(e) => setLane(e.target.value as Lane)}>
                    {lanes.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field grow">
                  <span>Rank</span>
                  <select className="input" value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {RANK_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <p className="muted small">
              Dari {GUIDE_PAGE_SIZE} panduan terbaru buatan pemain di fitur panduan game (berbahasa Inggris), hanya yang lengkap, diurutkan dari penulis dengan peringkat tertinggi sepanjang masa, lalu suara. Itu bukan jaminan kualitas (judul dan jumlah suara bisa asal-asalan), jadi nilai sendiri sebelum dipakai.
            </p>
          )}
          {st.state === 'loading' && <p className="muted">Memuat dari API…</p>}
          {st.state === 'error' && (
            <p className="empty">
              Gagal memuat rekomendasi ({st.msg}){' '}
              <button type="button" className="btn small" onClick={retry}>
                Coba lagi
              </button>{' '}
              {mode === 'guide' && (
                <button type="button" className="btn small" onClick={() => setMode('rank')}>
                  Pakai statistik rank
                </button>
              )}
            </p>
          )}
          {st.state === 'ok' && st.recos.length === 0 && (
            <p className="empty">
              {mode === 'rank'
                ? `API belum punya data build untuk ${hero.name} di lane ${lane}, rank ${RANK_LABEL[rank]}. Coba lane atau rank lain.`
                : `Belum ada panduan pemain berbahasa Inggris untuk ${hero.name}. Coba tab Statistik rank.`}
            </p>
          )}
          {st.state === 'ok' && st.recos.length > 0 && (
            <>
              <ul className="reco-list">
                {st.recos.map((r, i) => (
                  <li key={i} className="reco">
                    <div className="row">
                      <strong className="grow">{r.title || `Build ${i + 1}`}</strong>
                      {mode === 'rank' ? (
                        <span className="muted small">
                          dipakai {pct(r.pick)} · menang {pct(r.win)}
                        </span>
                      ) : (
                        <span className="muted small">
                          {r.author ? `oleh ${r.author}` : ''}
                          {rankName(r.authorLevel) ? ` (peringkat tertinggi: ${rankName(r.authorLevel)})` : ''}
                          {r.views !== null && r.views !== undefined ? ` · ${r.views} dilihat` : ''}
                          {r.votes ? ` · ${r.votes} suara` : ''}
                          {r.lane ? ` · ${r.lane}` : ''}
                        </span>
                      )}
                      <button type="button" className="btn primary small" onClick={() => onApply(r)}>
                        Pakai build ini
                      </button>
                    </div>
                    <div className="picked">
                      {r.items.map((n, k) => (
                        <span key={k} className="tag static reco-chip">
                          <Icon kind="items" name={n} size={20} />
                          {n}
                        </span>
                      ))}
                    </div>
                    <div className="picked small">
                      {r.emblem && <span className="muted">Emblem {r.emblem === 'All' ? 'Basic Common' : r.emblem}</span>}
                      {r.spell && (
                        <span className="reco-chip">
                          <Icon kind="spells" name={r.spell} size={18} />
                          {r.spell}
                        </span>
                      )}
                      {r.talents.map((t) => (
                        <span key={t} className="reco-chip">
                          <Icon kind="talents" name={t} size={18} />
                          {t}
                        </span>
                      ))}
                    </div>
                    {r.unknown > 0 && <p className="muted small">{r.unknown} item/talent tidak dikenali dan dilewati.</p>}
                  </li>
                ))}
              </ul>
              <p className="muted small">
                Diambil {ago(st.at)}
                {st.stale ? ' (server tidak terjangkau, memakai cache lama)' : ''}.
                {mode === 'rank' ? ' Persentase kecil berarti sampelnya sedikit; tidak otomatis lebih baik.' : ''}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
