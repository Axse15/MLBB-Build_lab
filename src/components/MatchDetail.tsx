import { useEffect, useState } from 'react';
import { loadCached } from '../lib/api';
import { fetchMatch, fetchSchedule } from '../lib/fetchers';
import {
  gameStar,
  headToHead,
  kdaOf,
  recentDetailedMatches,
  rosterOf,
  seriesStar,
  validRoster,
  type Roster as RosterData,
  type RosterPlayer,
  type LiveMatch,
  type MatchAsset,
  type MatchDetail,
  type MatchGame,
  type MatchPlayer,
} from '../lib/live';
import { iconFor, nameKey } from '../lib/live';
import { useLive } from '../live';
import { ROSTER_SNAPSHOT } from '../data/rosters';
import { Img, TeamLogo } from './ui';

const MIN = 60_000;
const nf = new Intl.NumberFormat('id-ID');
const fmt = (n: number | null): string => (n === null ? '-' : nf.format(n));
const dateOf = (t: number | null): string => (t === null ? '' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(t)));

/** Nama set emblem (id dari /academy/roles). Ikon emblem datang dari data match. */
const EMBLEM_NAME: Record<string, string> = {
  '20001': 'Basic',
  '20003': 'Tank',
  '20005': 'Assassin',
  '20006': 'Mage',
  '20007': 'Fighter',
  '20008': 'Support',
  '20012': 'Marksman',
};

// ---------------------------------------------------------------- pengambilan data

type Async<T> = { state: 'loading' } | { state: 'error'; msg: string } | { state: 'ok'; data: T };

// Disimpan di memori, bukan localStorage: satu match ~55 KB, dan URL gambarnya bertanda tangan sementara (~6 jam).
const matchMemo = new Map<string, { at: number; p: Promise<MatchDetail> }>();
const MATCH_TTL = 20 * MIN;

// Endpoint detail match berat di server (sering 500/503/timeout). Paling banyak 2 permintaan sekaligus.
let running = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function loadMatch(id: string): Promise<MatchDetail> {
  const hit = matchMemo.get(id);
  if (hit && Date.now() - hit.at < MATCH_TTL) return hit.p;
  const p = limited(() => fetchMatch(id));
  matchMemo.set(id, { at: Date.now(), p });
  p.catch(() => matchMemo.delete(id));
  return p;
}

export function useMatch(id: string | null, tick = 0): Async<MatchDetail> {
  const [st, setSt] = useState<Async<MatchDetail>>({ state: 'loading' });
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setSt({ state: 'loading' });
    loadMatch(id).then(
      (data) => alive && setSt({ state: 'ok', data }),
      (e: unknown) => alive && setSt({ state: 'error', msg: e instanceof Error ? e.message : 'Gagal memuat' }),
    );
    return () => {
      alive = false;
    };
  }, [id, tick]);
  return st;
}

const validSchedule = (v: unknown): boolean => Array.isArray(v) && v.length > 0;

export function useSchedule(): [Async<LiveMatch[]>, () => void] {
  const [st, setSt] = useState<Async<LiveMatch[]>>({ state: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    loadCached('mbl:live:schedule:v1', 15 * MIN, fetchSchedule, validSchedule, tick > 0).then(
      (r) => alive && setSt({ state: 'ok', data: r.data }),
      (e: unknown) => alive && setSt({ state: 'error', msg: e instanceof Error ? e.message : 'Gagal memuat' }),
    );
    return () => {
      alive = false;
    };
  }, [tick]);
  return [st, () => setTick((t) => t + 1)];
}

// ---------------------------------------------------------------- potongan tampilan

function useNames() {
  const { icons } = useLive();
  return { items: icons.ids.items, talents: icons.ids.talents };
}

/**
 * Gambar dari data match kadang gagal (URL bertanda tangan kedaluwarsa atau proxy tidak menemukan file).
 * Jatuh ke ikon katalog app (dicocokkan lewat nama), lalu ke teks.
 */
function AssetIcon({ a, names, kind, label, name: given }: { a: MatchAsset; names: Record<string, string>; kind: 'items' | 'talents'; label: string; name?: string }) {
  const { icons } = useLive();
  const name = names[a.id] ?? given;
  const own = name ? iconFor(icons[kind], name) : undefined;
  return (
    <span className="md-ico" title={name ? `${label}: ${name}` : label}>
      <Img src={a.img} size={28} fallback={<Img src={own} size={28} fallback={<span className="md-ico-miss">{name ? name.slice(0, 5) : a.id}</span>} />} />
    </span>
  );
}

/** Foto hero dari data match; kalau gagal, foto hero dari daftar hero app (cocok lewat nama), lalu inisial. */
function HeroPic({ name, src, className = 'md-hero-img' }: { name: string; src?: string; className?: string }) {
  const { heroList } = useLive();
  const own = heroList.find((h) => nameKey(h.name) === nameKey(name))?.img;
  return <Img src={src} className={className} fallback={<Img src={own} className={className} fallback={<span className="md-hero-miss">{name.slice(0, 2)}</span>} />} />;
}

function PlayerRow({ p, star, topDamage }: { p: MatchPlayer; star: boolean; topDamage: boolean }) {
  const names = useNames();
  const kda = kdaOf(p.kills, p.deaths, p.assists);
  return (
    <li className="md-player">
      <div className="md-who">
        <span className="md-hero">
          <HeroPic name={p.hero} src={p.heroImg} />
        </span>
        <span className="md-names">
          <strong>{p.name}</strong>
          <span className="muted small">{p.hero}</span>
        </span>
        {star && (
          <span className="md-badge" title="KDA tertinggi di tim pemenang game ini. Estimasi situs ini, bukan MVP resmi.">
            KDA terbaik
          </span>
        )}
      </div>
      <div className="md-kda" aria-label={`KDA ${p.kills} ${p.deaths} ${p.assists}`}>
        <strong>
          {p.kills}/{p.deaths}/{p.assists}
        </strong>
        <span className="muted small">{kda.toFixed(1)}</span>
      </div>
      <dl className="md-stats">
        <div>
          <dt>Gold</dt>
          <dd className="gold">{fmt(p.gold)}</dd>
        </div>
        <div className={topDamage ? 'top' : undefined}>
          <dt>Damage</dt>
          <dd>{fmt(p.damage)}</dd>
        </div>
        <div>
          <dt title="Damage yang diterima">Diterima</dt>
          <dd>{fmt(p.taken)}</dd>
        </div>
        <div>
          <dt>Tower</dt>
          <dd>{fmt(p.tower)}</dd>
        </div>
      </dl>
      <div className="md-build" aria-label={`Build ${p.hero}`}>
        <span className="md-items">
          {p.items.map((it, i) => (
            <AssetIcon key={`${it.id}-${i}`} a={it} names={names.items} kind="items" label="Item" />
          ))}
        </span>
        {p.emblem && (
          <span className="md-ico md-emblem" title={`Emblem ${EMBLEM_NAME[p.emblem.id] ?? p.emblem.id}`}>
            <Img src={p.emblem.img} size={28} fallback={<span className="md-ico-miss">{EMBLEM_NAME[p.emblem.id]?.slice(0, 2) ?? 'E'}</span>} />
          </span>
        )}
        <span className="md-talents">
          {p.talents.map((t, i) => (
            <AssetIcon key={`${t.id}-${i}`} a={t} names={names.talents} kind="talents" label="Talent" />
          ))}
        </span>
      </div>
    </li>
  );
}

/** Logo tim dari data match; kalau gagal, logo dari baris jadwal (yang sudah termuat di halaman). */
function TeamPic({ src, alt, size }: { src?: string; alt?: string; size: number }) {
  return <Img src={src} size={size} className="team-logo" fallback={<TeamLogo src={alt} size={size} />} />;
}

function DraftStrip({ game }: { game: MatchGame }) {
  return (
    <div className="md-draft" role="group" aria-label={`Hero yang dipilih di game ${game.number}`}>
      {game.teams.map((t, i) => (
        <div key={t.name} className={`md-draft-side side-${i === 0 ? 'a' : 'b'}`}>
          <span className="md-draft-name">{t.name}</span>
          <ul>
            {t.players.map((p) => (
              <li key={p.name} title={`${p.hero} (${p.name})`}>
                <HeroPic name={p.hero} src={p.heroImg} />
                <span className="small">{p.hero}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GameView({ game, logos }: { game: MatchGame; logos: Record<string, string | undefined> }) {
  const star = gameStar(game);
  const all = game.teams.flatMap((t) => t.players);
  const maxDmg = Math.max(...all.map((p) => p.damage ?? 0));
  return (
    <div className="md-game">
      <DraftStrip game={game} />
      <p className="muted small md-note">Yang tersedia dari API: hero yang dipakai tiap pemain. Ban dan urutan pick tidak disediakan.</p>
      {game.teams.map((t, i) => (
        <section key={t.name} className={`md-team side-${i === 0 ? 'a' : 'b'}${t.winner ? ' won' : ''}`} aria-label={t.name}>
          <header className="md-team-head">
            <TeamPic src={t.logo} alt={logos[t.name]} size={28} />
            <strong>{t.name}</strong>
            <span className={`md-result ${t.winner ? 'win' : 'lose'}`}>{t.winner ? 'Menang' : 'Kalah'}</span>
            <span className="muted small grow right">{t.kills} kill</span>
          </header>
          <ul className="md-players">
            {t.players.map((p) => (
              <PlayerRow key={p.name} p={p} star={star?.player === p} topDamage={!!p.damage && p.damage === maxDmg} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- match yang sudah dimainkan

function Played({ match, detail }: { match: LiveMatch; detail: MatchDetail }) {
  const [gi, setGi] = useState(0);
  const star = seriesStar(detail);
  const game = detail.games[Math.min(gi, detail.games.length - 1)];
  return (
    <div className="md">
      <div className="md-top">
        {star ? (
          <p className="md-star">
            <strong>{star.name}</strong> ({star.team}) paling menonjol di seri ini dengan KDA {kdaOf(star.kills, star.deaths, star.assists).toFixed(1)} ({star.kills}/{star.deaths}/{star.assists}; {star.heroes.join(', ')}).{' '}
            <span className="muted">Estimasi dari KDA, bukan MVP resmi: API tidak menyediakan skor MVP.</span>
          </p>
        ) : (
          <p className="muted small">Belum ada pemenang seri yang jelas, jadi tidak ada estimasi pemain terbaik.</p>
        )}
        {match.replayUrl && (
          <a className="btn small" href={match.replayUrl} target="_blank" rel="noreferrer noopener">
            Tonton ulang di YouTube
          </a>
        )}
      </div>
      <div className="md-tabs" role="tablist" aria-label="Game">
        {detail.games.map((g, i) => {
          const w = g.teams.find((t) => t.winner);
          return (
            <button key={g.number} type="button" role="tab" aria-selected={i === gi} className={`md-tab${i === gi ? ' on' : ''}`} onClick={() => setGi(i)}>
              <span>Game {g.number}</span>
              <span className="muted small">
                {w ? `${w.name} menang` : 'hasil tidak tercatat'}
                {g.duration ? ` · ${g.duration}` : ''}
              </span>
            </button>
          );
        })}
      </div>
      <GameView game={game} logos={{ [match.team1]: match.logo1, [match.team2]: match.logo2 }} />
    </div>
  );
}

// ---------------------------------------------------------------- match yang belum dimainkan

const ROSTER_TTL = 24 * 60 * MIN;

interface RosterResult {
  roster: RosterData;
  /** live = baru diambil; cache = tersimpan di browser; snapshot = bawaan app (API tidak terjangkau). */
  source: 'live' | 'cache' | 'stale' | 'snapshot';
  at: number | null;
}

/**
 * Susunan pemain satu tim. Urutan: cache browser (24 jam) -> ambil dari match reguler terakhir
 * (sampai 3 match, kalau satu gagal coba yang lain) -> cache lama -> snapshot bawaan app.
 */
function useRoster(team: string, schedule: LiveMatch[], tick: number): Async<RosterResult> {
  const [st, setSt] = useState<Async<RosterResult>>({ state: 'loading' });
  useEffect(() => {
    let alive = true;
    setSt({ state: 'loading' });
    const snap = ROSTER_SNAPSHOT.teams[team];
    const fromSnapshot = (): Async<RosterResult> =>
      snap ? { state: 'ok', data: { roster: snap, source: 'snapshot', at: Date.parse(ROSTER_SNAPSHOT.at) || null } } : { state: 'error', msg: 'server tidak terjangkau dan belum ada snapshot untuk tim ini' };
    const fetcher = async (): Promise<RosterData> => {
      let last: unknown = new Error('belum ada match reguler dengan detail pemain');
      for (const m of recentDetailedMatches(schedule, team, 3)) {
        try {
          const r = rosterOf(await loadMatch(m.matchId as string), team, m.team1 === team ? m.team2 : m.team1, m.startAt);
          if (r) return r;
        } catch (e) {
          last = e;
        }
      }
      throw last;
    };
    loadCached(`mbl:roster:v2:${team}`, ROSTER_TTL, fetcher, validRoster, tick > 0).then(
      (r) => alive && setSt({ state: 'ok', data: { roster: r.data, source: r.stale ? 'stale' : Date.now() - r.at < 60_000 ? 'live' : 'cache', at: r.at } }),
      () => alive && setSt(fromSnapshot()),
    );
    return () => {
      alive = false;
    };
  }, [team, schedule, tick]);
  return st;
}

const logoOf = (schedule: LiveMatch[], team: string): string | undefined => {
  for (const m of schedule) {
    if (m.team1 === team && m.logo1) return m.logo1;
    if (m.team2 === team && m.logo2) return m.logo2;
  }
  return undefined;
};

/** Build satu pemain di game terakhirnya (item, emblem, talent). Ikon dari katalog app lewat ID. */
function RosterBuild({ p }: { p: RosterPlayer }) {
  const names = useNames();
  if (!p.items?.length) return null;
  return (
    <span className="md-build md-rbuild" aria-label={`Build ${p.hero} di game terakhir`}>
      <span className="md-items">
        {p.items.map((id, i) => (
          <AssetIcon key={`${id}-${i}`} a={{ id }} names={names.items} kind="items" label="Item" name={p.itemNames?.[i]} />
        ))}
      </span>
      {p.emblem && <span className="muted small">Emblem {EMBLEM_NAME[p.emblem] ?? p.emblem}</span>}
      <span className="md-talents">
        {(p.talents ?? []).map((id, i) => (
          <AssetIcon key={`${id}-${i}`} a={{ id }} names={names.talents} kind="talents" label="Talent" name={p.talentNames?.[i]} />
        ))}
      </span>
    </span>
  );
}

function Roster({ team, schedule }: { team: string; schedule: LiveMatch[] }) {
  const [tick, setTick] = useState(0);
  const st = useRoster(team, schedule, tick);
  const head = (
    <header className="md-team-head">
      <TeamLogo src={logoOf(schedule, team)} size={26} />
      <strong>{team}</strong>
    </header>
  );
  if (st.state === 'loading')
    return (
      <div className="md-roster">
        {head}
        <p className="muted small">Memuat pemain…</p>
      </div>
    );
  if (st.state === 'error')
    return (
      <div className="md-roster">
        {head}
        <p className="empty">
          Pemain {team} belum bisa dimuat ({st.msg}){' '}
          <button type="button" className="btn small" onClick={() => setTick((t) => t + 1)}>
            Coba lagi
          </button>
        </p>
      </div>
    );
  const { roster, source } = st.data;
  const when = dateOf(roster.at);
  return (
    <div className="md-roster">
      {head}
      <ul>
        {roster.players.map((p) => (
          <li key={p.name}>
            <HeroPic name={p.hero} />
            <span className="md-names">
              <strong>{p.name}</strong>
              <span className="muted small">{p.hero}</span>
            </span>
            <RosterBuild p={p} />
          </li>
        ))}
      </ul>
      <p className="muted small">
        {roster.vs ? `Susunan di game terakhir lawan ${roster.vs}${when ? ` (${when})` : ''}. ` : ''}Build = yang dipakai di game itu, bisa berubah di playoff. Susunan playoff juga bisa berbeda.
        {source === 'snapshot' && ' Server API sedang tidak terjangkau, jadi ini snapshot bawaan app (bukan data terbaru).'}
        {source === 'stale' && ' Server tidak terjangkau; memakai data tersimpan.'}
      </p>
      {(source === 'snapshot' || source === 'stale') && (
        <button type="button" className="btn small" onClick={() => setTick((t) => t + 1)}>
          Muat data terbaru
        </button>
      )}
    </div>
  );
}

function Upcoming({ match, schedule }: { match: LiveMatch; schedule: Async<LiveMatch[]> }) {
  if (schedule.state === 'loading') return <p className="muted">Memuat data musim reguler…</p>;
  if (schedule.state === 'error') return <p className="empty">Data musim reguler tidak bisa dimuat ({schedule.msg}).</p>;
  const known = [match.team1, match.team2].filter((t) => t && t !== 'TBD');
  const both = known.length === 2;
  const h2h = both ? headToHead(schedule.data, match.team1, match.team2) : [];
  return (
    <div className="md">
      {!both && <p className="muted">{known.length === 0 ? 'Kedua tim belum ditentukan.' : 'Lawan belum ditentukan. Roster tim yang sudah pasti:'}</p>}
      {both && (
        <section>
          <h3>Pertemuan di musim reguler</h3>
          {h2h.length === 0 ? (
            <p className="muted small">Belum pernah bertemu di musim reguler ini.</p>
          ) : (
            <ul className="md-h2h">
              {h2h.map((m, i) => (
                <li key={i}>
                  <span className="muted small">{dateOf(m.startAt)}</span>
                  <span className={m.winner === 'team1' ? 'w' : undefined}>{m.team1}</span>
                  <strong>
                    {m.score1}–{m.score2}
                  </strong>
                  <span className={m.winner === 'team2' ? 'w' : undefined}>{m.team2}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {known.length > 0 && (
        <section>
          <h3>Roster</h3>
          <div className="md-rosters">
            {known.map((t) => (
              <Roster key={t} team={t} schedule={schedule.data} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pintu masuk

/** Isi panel detail untuk satu match. `schedule` dimuat sekali oleh halaman dan dipakai bersama. */
export function MatchDetailView({ match, schedule }: { match: LiveMatch; schedule: Async<LiveMatch[]> }) {
  const [tick, setTick] = useState(0);
  const st = useMatch(match.matchId ?? null, tick);
  const upcoming = match.status !== 'finished';
  const fallback = <Upcoming match={match} schedule={schedule} />;
  if (!match.matchId) {
    return upcoming ? (
      <div className="md">
        <p className="muted small">Detail game (hero, build, hasil) muncul di sini setelah match dimainkan dan API punya halaman detailnya. Sementara ini:</p>
        {fallback}
      </div>
    ) : (
      <div className="md">
        <p className="empty">API belum punya halaman detail game untuk match ini. Yang tersedia:</p>
        {fallback}
      </div>
    );
  }
  if (st.state === 'loading') return <p className="muted">Memuat detail match… (server API kadang lambat, sampai satu menit)</p>;
  if (st.state === 'error')
    return (
      <div className="md">
        <p className="empty">
          Detail game belum bisa dimuat ({st.msg}){' '}
          <button type="button" className="btn small" onClick={() => setTick((t) => t + 1)}>
            Coba lagi
          </button>
        </p>
        {fallback}
      </div>
    );
  return <Played match={match} detail={st.data} />;
}
