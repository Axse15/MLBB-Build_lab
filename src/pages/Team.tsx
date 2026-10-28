import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { HeroPicker } from '../components/HeroPicker';
import { PublishDialog } from '../components/PublishDialog';
import { HeroAvatar, IssueList, Modal, ShareDialog, useToast } from '../components/ui';
import { analyzeComposition, itemsOf, totalCost } from '../lib/analysis';
import { decodeTeam, encodeTeam } from '../lib/share';
import { emptySlots, formatGold, uid } from '../lib/util';
import { clearQuery, go, shareUrl } from '../route';
import { usePersistent, useStore } from '../store';
import { LANES, type Hero, type Lane, type Team } from '../types';

/** Draf dianggap "belum disimpan" kalau ada hero di dalamnya dan tidak sama dengan versi tersimpannya. */
function unsaved(d: Team, teams: Team[]): boolean {
  const key = (t: Team) => JSON.stringify([t.name.trim(), LANES.map((l) => [t.slots[l]?.heroId ?? null, t.slots[l]?.buildId ?? null])]);
  if (!LANES.some((l) => d.slots[l]?.heroId) && !d.name.trim()) return false;
  const saved = teams.find((t) => t.id === d.id);
  return !saved || key(saved) !== key(d);
}

const blankTeam = (): Team => ({ id: uid(), name: '', slots: emptySlots(), updatedAt: Date.now() });

const LANE_HINT: Record<Lane, string> = {
  Gold: 'Gold lane',
  EXP: 'EXP lane',
  Mid: 'Mid lane',
  Jungle: 'Jungle',
  Roam: 'Roam',
};

export function TeamPage({ params }: { params: URLSearchParams }) {
  const { heroes, heroMap, heroById, builds, buildById, saveBuild, teams, saveTeam, deleteTeam } = useStore();
  const notify = useToast();
  const { state: auth, requireLogin } = useAuth();

  const [team, setTeam] = usePersistent<Team>(
    'mbl:team-draft:v1',
    blankTeam(),
    (v) => !!v && typeof v === 'object' && !!(v as Team).slots,
  );
  const [picking, setPicking] = useState<Lane | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [confirmSwap, setConfirmSwap] = useState<{ what: string; apply: () => void } | null>(null);
  const isUnsaved = unsaved(team, teams);
  /** Menjalankan `apply`; kalau draf yang terbuka belum disimpan, minta konfirmasi dulu. */
  const swap = (what: string, apply: () => void) => {
    if (isUnsaved) setConfirmSwap({ what, apply });
    else apply();
  };

  // Tautan masuk: ?s= (tautan bagikan; build di dalamnya ikut ditambahkan), ?new=1, ?load=<id>. Satu kali per navigasi.
  const handled = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    if (handled.current === params) return;
    handled.current = params;
    const s = params.get('s');
    const load = params.get('load');
    if (s) {
      const res = decodeTeam(s, heroMap);
      if (res) {
        res.builds.forEach(saveBuild);
        setTeam(res.team);
        window.scrollTo({ top: 0 });
        notify(`Komposisi dimuat${res.builds.length ? `, ${res.builds.length} build ditambahkan ke daftar kamu` : ''}.`);
      } else {
        notify('Tautan komposisi tidak valid, atau ada hero yang tidak dikenal.');
      }
    } else if (load) {
      const t = teams.find((x) => x.id === load);
      if (t) swap(`Membuka "${t.name || 'komposisi tanpa nama'}"`, () => setTeam({ ...t, slots: { ...t.slots } }));
      else notify('Komposisi itu tidak ada di browser ini.');
    } else if (params.get('new')) {
      swap('Memulai komposisi baru', () => setTeam(blankTeam()));
    } else {
      return;
    }
    clearQuery('team');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const report = useMemo(() => analyzeComposition(team.slots, heroById, buildById), [team.slots, heroById, buildById]);

  const setSlot = (lane: Lane, p: Partial<Team['slots'][Lane]>) =>
    setTeam((t) => ({ ...t, updatedAt: Date.now(), slots: { ...t.slots, [lane]: { ...t.slots[lane], ...p } } }));

  const pick = (h: Hero) => {
    if (!picking) return;
    const current = team.slots[picking];
    const stillValid = current.buildId && buildById(current.buildId)?.heroId === h.id;
    setSlot(picking, { heroId: h.id, buildId: stillValid ? current.buildId : null });
    setPicking(null);
  };

  const save = () => {
    const name = team.name.trim() || `Komposisi ${teams.length + 1}`;
    const t = { ...team, name, updatedAt: Date.now() };
    saveTeam(t);
    setTeam(t);
    notify(`Tersimpan: ${name}`);
  };

  const MIN_PUBLISH_HEROES = 3;
  const publish = () => {
    const picked = LANES.map((l) => team.slots[l].heroId).filter((id): id is string => !!id);
    if (picked.length < MIN_PUBLISH_HEROES) return notify(`Isi minimal ${MIN_PUBLISH_HEROES} hero sebelum dibagikan ke komunitas.`);
    if (picked.some((id) => heroById(id)?.custom)) return notify('Ada hero kustom di komposisi ini. Pemain lain tidak punya hero itu, jadi tidak bisa dibagikan.');
    if (!requireLogin('Masuk dengan Google untuk membagikan komposisi ke komunitas.')) return;
    setPublishing(true);
  };

  const offensive = report.physical + report.magic;
  const physPct = offensive ? Math.round((report.physical / offensive) * 100) : 0;
  const hasAny = report.filled > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Komposisi tim</h1>
        <p className="muted">
          Isi lima lane, hubungkan tiap hero ke build tersimpan, lalu baca catatan komposisinya. Catatan ini heuristik dari role dan item, bukan prediksi menang atau kalah.
        </p>
      </header>

      <div className="team">
        <div className="lanes">
          {LANES.map((lane) => {
            const s = team.slots[lane];
            const hero = s.heroId ? heroById(s.heroId) : undefined;
            const options = hero ? builds.filter((b) => b.heroId === hero.id) : [];
            const build = s.buildId ? buildById(s.buildId) : undefined;
            const its = build ? itemsOf(build.items) : [];
            return (
              <section key={lane} className="panel lane">
                <div className="lane-name">{LANE_HINT[lane]}</div>
                <div className="lane-body">
                  <button type="button" className="lane-hero" onClick={() => setPicking(lane)} aria-label={hero ? `Ganti hero ${LANE_HINT[lane]}` : `Pilih hero untuk ${LANE_HINT[lane]}`}>
                    <HeroAvatar hero={hero} size={52} />
                    <span className="grow left">
                      <strong>{hero ? hero.name : 'Pilih hero'}</strong>
                      <span className="muted small">{hero ? hero.roles.join(' / ') : 'Ketuk untuk memilih'}</span>
                    </span>
                  </button>
                  {hero && (
                    <>
                      <label className="field tight">
                        <span className="sr">Build untuk {hero.name}</span>
                        <select className="input" value={s.buildId ?? ''} onChange={(e) => setSlot(lane, { buildId: e.target.value || null })}>
                          <option value="">{options.length ? 'Tanpa build' : 'Belum ada build untuk hero ini'}</option>
                          {options.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {options.length === 0 && (
                        <p className="muted small">
                          Buat dulu di halaman{' '}
                          <button type="button" className="link" onClick={() => go('builder')}>
                            Build hero
                          </button>
                          .
                        </p>
                      )}
                      {build && (
                        <p className="muted small clamp">
                          {its.map((i) => i.name).join(', ') || 'Build kosong'} · <span className="gold">{formatGold(totalCost(its))}</span>
                        </p>
                      )}
                      <button type="button" className="btn ghost small" onClick={() => setSlot(lane, { heroId: null, buildId: null })}>
                        Kosongkan
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="panel report" aria-label="Analisis komposisi">
          <div className="panel-head">
            <h2>Catatan komposisi</h2>
            <span className="muted small">{report.filled}/5 slot</span>
          </div>

          {hasAny && (
            <div className="chips">
              {Object.entries(report.roleCounts).map(([r, n]) => (
                <span key={r} className="tag static">
                  {r} {n}
                </span>
              ))}
            </div>
          )}

          <div className="dmg">
            <div className="dmg-label muted small">
              <span>Physical {offensive ? `${physPct}%` : ''}</span>
              <span>Magic {offensive ? `${100 - physPct}%` : ''}</span>
            </div>
            <div
              className="dmg-bar"
              role="img"
              aria-label={offensive ? `Item ofensif: ${report.physical} physical, ${report.magic} magic` : 'Belum ada item ofensif'}
            >
              {offensive > 0 ? (
                <>
                  <span className="dmg-p" style={{ width: `${physPct}%` }} />
                  <span className="dmg-m" style={{ width: `${100 - physPct}%` }} />
                </>
              ) : (
                <span className="dmg-none" />
              )}
            </div>
            <p className="muted small">Dihitung dari item Attack dan Magic di build yang dipilih. Item Hybrid tidak dihitung.</p>
          </div>

          <p className="gold-total">
            Total <span className="gold">{formatGold(report.totalGold)} gold</span> dari build terpilih
          </p>

          <IssueList issues={report.issues} />
        </aside>
      </div>

      <div className="actions">
        <label className="field grow tight">
          <span className="sr">Nama komposisi</span>
          <input className="input" value={team.name} maxLength={60} placeholder="Nama komposisi, mis. Dive mid game" onChange={(e) => setTeam({ ...team, name: e.target.value })} />
        </label>
        <button type="button" className="btn primary" onClick={save} disabled={!hasAny}>
          Simpan komposisi
        </button>
        <button type="button" className="btn" disabled={!hasAny} onClick={() => setShare(shareUrl('team', encodeTeam(team, buildById)))}>
          Bagikan tautan
        </button>
        {auth.status !== 'off' && (
          <button type="button" className="btn" disabled={!hasAny || auth.status === 'loading'} onClick={publish}>
            Bagikan ke komunitas
          </button>
        )}
        <button type="button" className="btn ghost" onClick={() => swap('Memulai komposisi baru', () => setTeam(blankTeam()))}>
          Komposisi baru
        </button>
      </div>

      <section className="panel saved">
        <div className="panel-head">
          <h2>Komposisi tersimpan</h2>
          <span className="muted small">{teams.length} komposisi</span>
        </div>
        {teams.length === 0 ? (
          <p className="empty">Belum ada komposisi tersimpan.</p>
        ) : (
          <ul className="cards">
            {teams.map((t) => {
              const names = LANES.map((l) => (t.slots[l].heroId ? heroById(t.slots[l].heroId!)?.name : null)).filter(Boolean);
              return (
                <li key={t.id} className="card">
                  <strong>{t.name}</strong>
                  <p className="muted small clamp">{names.join(', ') || 'Kosong'}</p>
                  <div className="row">
                    <button type="button" className="btn small" onClick={() => swap(`Membuka "${t.name || 'komposisi tanpa nama'}"`, () => setTeam({ ...t, slots: { ...t.slots } }))}>
                      Muat
                    </button>
                    <button
                      type="button"
                      className={`btn small ${confirmDel === t.id ? 'danger' : 'ghost'}`}
                      onClick={() => {
                        if (confirmDel === t.id) {
                          deleteTeam(t.id);
                          setConfirmDel(null);
                        } else {
                          setConfirmDel(t.id);
                          window.setTimeout(() => setConfirmDel((c) => (c === t.id ? null : c)), 3000);
                        }
                      }}
                    >
                      {confirmDel === t.id ? 'Yakin hapus?' : 'Hapus'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmSwap && (
        <Modal title="Ganti draf di editor?" onClose={() => setConfirmSwap(null)}>
          <div className="stack">
            <p>{confirmSwap.what} akan menggantikan draf yang sedang terbuka. Perubahan yang belum disimpan akan hilang.</p>
            <div className="row end">
              <button type="button" className="btn ghost" onClick={() => setConfirmSwap(null)}>
                Tetap di draf ini
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const go = confirmSwap.apply;
                  setConfirmSwap(null);
                  go();
                }}
              >
                Ganti draf
              </button>
            </div>
          </div>
        </Modal>
      )}
      {picking && (
        <Modal title={`Pilih hero untuk ${LANE_HINT[picking]}`} onClose={() => setPicking(null)} wide>
          <HeroPicker heroes={heroes} onPick={pick} selectedId={team.slots[picking].heroId ?? undefined} initialLane={picking} />
        </Modal>
      )}
      {share && <ShareDialog title="Bagikan komposisi" url={share} onClose={() => setShare(null)} />}
      {publishing && (
        <PublishDialog
          kind="team"
          initialTitle={team.name.trim() || 'Komposisi tim'}
          payload={encodeTeam(team, buildById)}
          summary={`${report.filled}/5 hero · ${LANES.map((l) => (team.slots[l].heroId ? heroById(team.slots[l].heroId!)?.name : null)).filter(Boolean).join(', ')}`}
          onClose={() => setPublishing(false)}
        />
      )}
    </div>
  );
}
