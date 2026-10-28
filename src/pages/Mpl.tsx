import { useState } from 'react';
import {
  ELIMINATED,
  EVENT,
  LAST_VERIFIED,
  MATCHES,
  PLAYOFF_START_ISO,
  QUALIFIED,
  SOURCES,
  TEAMS,
  type MatchId,
  type PlayoffMatch,
  type Slot,
} from '../data/mpl';
import { Countdown } from '../components/Countdown';
import { MatchDetailView, useSchedule } from '../components/MatchDetail';
import { TeamLogo } from '../components/ui';
import { ago, useLive } from '../live';
import { playoffWindow, type LiveMatch, type LivePlayoffs } from '../lib/live';
import { usePersistent } from '../store';

const START = new Date(PLAYOFF_START_ISO).getTime();
const END = new Date('2026-11-09T00:00:00+07:00').getTime();

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${iso}T12:00:00+07:00`));

function MplStatic({ embedded = false, banner }: { embedded?: boolean; banner?: string }) {
  const [winners, setWinners] = usePersistent<Partial<Record<MatchId, string>>>('mbl:mpl-winners:v1', {}, (v) => !!v && typeof v === 'object' && !Array.isArray(v));

  const resolve = (slot: Slot): string | null => {
    if ('team' in slot) return slot.team;
    return winners[slot.winnerOf] ?? null;
  };

  const label = (slot: Slot) => {
    const id = resolve(slot);
    if (id) return TEAMS[id].name;
    return 'winnerOf' in slot ? `Pemenang ${slot.winnerOf}` : '';
  };

  const mark = (m: PlayoffMatch, teamId: string | null) => {
    if (!teamId) return;
    setWinners((w) => {
      const next = { ...w };
      if (next[m.id] === teamId) delete next[m.id];
      else next[m.id] = teamId;
      return next;
    });
  };

  const hasMarks = Object.keys(winners).length > 0;

  return (
    <div className={embedded ? 'stack' : 'page'}>
      {!embedded && (
        <header className="page-head">
          <h1>Jadwal MPL ID S18</h1>
          <p className="muted">
            Playoff {EVENT.dates} di {EVENT.venue}. Data statis, terakhir diperiksa {LAST_VERIFIED}.
          </p>
        </header>
      )}
      {banner && <p className="p-caveat small">{banner}</p>}

      <section className="panel mpl-hero">
        <div>
          <h2>Playoff dimulai</h2>
          <p className="muted">Rabu, 4 November 2026, 13:00 WIB. Alter Ego Esports bertemu Onic di pertandingan pembuka.</p>
        </div>
        <Countdown start={START} end={END} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Quarterfinal dan semifinal upper bracket</h2>
          {hasMarks && (
            <button type="button" className="btn ghost small" onClick={() => setWinners({})}>
              Reset hasil catatan
            </button>
          )}
        </div>
        <p className="muted small">
          Ketuk nama tim untuk mencatat pemenang. Catatan ini hanya tersimpan di browser kamu dan bukan hasil resmi; gunanya supaya lawan di Match 3 dan 4 ikut terisi.
        </p>
        <ul className="matches">
          {MATCHES.map((m) => {
            const a = resolve(m.a);
            const b = resolve(m.b);
            const w = winners[m.id];
            return (
              <li key={m.id} className="match">
                <div className="match-meta">
                  <strong>{m.id}</strong>
                  <span>{m.stage}</span>
                  <span className="muted">{m.format}</span>
                </div>
                <div className="match-when">
                  <span>{m.date ? fmtDate(m.date) : 'Tanggal menyusul'}, {m.time} WIB</span>
                  <span className="muted small">{m.dateNote}</span>
                </div>
                <div className="match-teams">
                  {([
                    [a, m.a],
                    [b, m.b],
                  ] as const).map(([id, slot], idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`team-btn${id && w === id ? ' win' : ''}${id && w && w !== id ? ' lose' : ''}`}
                      disabled={!id}
                      aria-pressed={!!id && w === id}
                      onClick={() => mark(m, id)}
                    >
                      <span className="team-short">{id ? TEAMS[id].short : '?'}</span>
                      <span>{label(slot)}</span>
                      {id && w === id && <span className="tag static">menang</span>}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="muted small">
          Setelah itu: lower bracket, final lower bracket, dan Grand Final (Bo7). Jadwal tiap babak belum diumumkan di sumber yang saya cek. Dua finalis mewakili Indonesia di M8 World Championship.
        </p>
      </section>

      <div className="two">
        <section className="panel">
          <h2>Lolos ke playoff</h2>
          <ul className="teams">
            {QUALIFIED.map((id) => (
              <li key={id}>
                <span className="team-short">{TEAMS[id].short}</span>
                {TEAMS[id].name}
                {id === 'tlid' && <span className="muted small"> · juara klasemen reguler</span>}
              </li>
            ))}
          </ul>
          <p className="muted small">Team Liquid ID dan Navi langsung menunggu di semifinal upper bracket.</p>
        </section>
        <section className="panel">
          <h2>Tersingkir di reguler</h2>
          <ul className="teams out">
            {ELIMINATED.map((id) => (
              <li key={id}>
                <span className="team-short">{TEAMS[id].short}</span>
                {TEAMS[id].name}
              </li>
            ))}
          </ul>
          <p className="muted small">{EVENT.regular}.</p>
        </section>
      </div>

      <section className="panel">
        <h2>Tonton dan sumber data</h2>
        <p>
          Siaran langsung di{' '}
          <a href={EVENT.streaming} target="_blank" rel="noreferrer">
            kanal YouTube MPL Indonesia
          </a>
          .
        </p>
        <ul className="sources">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Sumber media menyebut format Bo5 dan Grand Final Bo7. Satu sumber menambahkan final lower bracket juga Bo7, yang lain tidak, jadi cek jadwal resmi sebelum bergantung pada detail itu.
        </p>
      </section>
    </div>
  );
}

const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(ms));

const STATUS_TEXT: Record<LiveMatch['status'], string> = {
  scheduled: 'Dijadwalkan',
  in_progress: 'Berlangsung',
  finished: 'Selesai',
  unknown: '',
};

type Sched = ReturnType<typeof useSchedule>[0];

/** Satu baris match. Kalau `schedule` diberikan, barisnya bisa dibuka untuk melihat detail (pemain, hero, build, hasil). */
function LiveMatchRow({ m, schedule }: { m: LiveMatch; schedule: Sched }) {
  const played = m.score1 !== null && m.score2 !== null;
  const [open, setOpen] = useState(false);
  return (
    <li className={`match live-match${open ? ' open' : ''}`}>
      <div className="match-meta">
        <strong>{m.round || 'Reguler'}</strong>
        <span className="muted">{m.bestOf ? `Bo${m.bestOf}` : ''}</span>
      </div>
      <div className="match-when">
        <span>{m.startAt ? fmtTime(m.startAt) + ' WIB' : m.localTime ? `${m.localTime} (zona waktu liga)` : 'Waktu menyusul'}</span>
        {STATUS_TEXT[m.status] && <span className={`tag static st-${m.status}`}>{STATUS_TEXT[m.status]}</span>}
      </div>
      <div className="match-teams">
        <div className={`team-btn static${m.winner === 'team1' ? ' win' : ''}${m.winner === 'team2' ? ' lose' : ''}`}>
          <span className="team-id">
            <TeamLogo src={m.logo1} />
            {m.team1}
          </span>
          {played && <strong className="score">{m.score1}</strong>}
        </div>
        <div className={`team-btn static${m.winner === 'team2' ? ' win' : ''}${m.winner === 'team1' ? ' lose' : ''}`}>
          <span className="team-id">
            <TeamLogo src={m.logo2} />
            {m.team2}
          </span>
          {played && <strong className="score">{m.score2}</strong>}
        </div>
      </div>
      <button type="button" className="btn small match-open" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Tutup detail' : m.status === 'finished' ? 'Lihat detail game' : 'Lihat detail'}
      </button>
      {open && (
        <div className="match-detail">
          <MatchDetailView match={m} schedule={schedule} />
        </div>
      )}
    </li>
  );
}

const PAGE = 10;

/** Hasil musim reguler yang sudah selesai (terbaru dulu), bisa disaring per tim. */
function Results({ schedule, retry }: { schedule: Sched; retry: () => void }) {
  const [team, setTeam] = useState('');
  const [shown, setShown] = useState(PAGE);
  if (schedule.state === 'loading') return <p className="muted">Memuat hasil musim reguler…</p>;
  if (schedule.state === 'error')
    return (
      <p className="empty">
        Hasil musim reguler tidak bisa dimuat ({schedule.msg}){' '}
        <button type="button" className="btn small" onClick={retry}>
          Coba lagi
        </button>
      </p>
    );
  const finished = schedule.data.filter((m) => m.status === 'finished').sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0));
  const teams = [...new Set(finished.flatMap((m) => [m.team1, m.team2]))].sort();
  const list = team ? finished.filter((m) => m.team1 === team || m.team2 === team) : finished;
  return (
    <>
      <label className="field">
        <span>Saring tim</span>
        <select
          className="input"
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
            setShown(PAGE);
          }}
        >
          <option value="">Semua tim ({finished.length} match)</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <ul className="matches">
        {list.slice(0, shown).map((m) => (
          <LiveMatchRow key={m.matchId ?? `${m.startAt}-${m.team1}`} m={m} schedule={schedule} />
        ))}
      </ul>
      {list.length > shown && (
        <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
          Tampilkan {Math.min(PAGE, list.length - shown)} lagi
        </button>
      )}
    </>
  );
}

function MplLive({ data, at, stale }: { data: LivePlayoffs; at: number | null; stale: boolean }) {
  const { standings } = useLive();
  const [schedule, retrySchedule] = useSchedule();
  const win = playoffWindow(data, Date.now());
  const firstStart = data.days.flatMap((d) => d.matches.map((m) => m.startAt)).filter((t): t is number => t !== null).sort((a, b) => a - b)[0];
  const target = win.next ?? firstStart ?? Date.now();
  return (
    <div className="page">
      <header className="page-head">
        <h1>Jadwal MPL ID S18</h1>
        <p className="muted">
          Data playoff langsung dari Rone Arena API ({stale ? `cache lama, ${ago(at)}` : `diperbarui ${ago(at)}`}). Jadwal dan skor mengikuti situs resmi MPL ID, bisa terlambat beberapa menit karena cache.
        </p>
      </header>

      <section className="panel mpl-hero">
        <div>
          <h2>{win.next ? 'Pertandingan berikutnya' : 'Playoff'}</h2>
          <p className="muted">{win.next ? fmtTime(win.next) + ' WIB' : 'Tidak ada pertandingan yang akan datang di jadwal.'}</p>
        </div>
        <Countdown start={target} end={win.end ?? target} />
      </section>

      {data.days.map((d) => (
        <section key={d.label} className="panel">
          <h2>{d.label || 'Jadwal'}</h2>
          <ul className="matches">
            {d.matches.map((m, i) => (
              <LiveMatchRow key={`${m.startAt ?? 'x'}-${i}`} m={m} schedule={schedule} />
            ))}
          </ul>
        </section>
      ))}

      <section className="panel">
        <h2>Hasil musim reguler</h2>
        <p className="muted small">Buka satu match untuk melihat tiap game: pemain, hero, KDA, build, dan pemenangnya.</p>
        <Results schedule={schedule} retry={retrySchedule} />
      </section>

      <div className="two">
        {data.seeds.length > 0 && (
          <section className="panel">
            <h2>Seed playoff</h2>
            <ul className="teams">
              {data.seeds.map((s) => (
                <li key={s.seed}>
                  <span className="team-short">#{s.seed}</span>
                  <TeamLogo src={s.logo} size={22} />
                  {s.team}
                  {s.win !== null && s.lose !== null && <span className="muted small"> · {s.win}-{s.lose}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {standings.data && standings.data.length > 0 && (
          <section className="panel">
            <h2>Klasemen reguler</h2>
            <ul className="teams">
              {standings.data.map((s) => (
                <li key={s.rank}>
                  <span className="team-short">{s.rank}</span>
                  <TeamLogo src={s.logo} size={22} />
                  {s.team}
                  {s.win !== null && s.lose !== null && <span className="muted small"> · {s.win}-{s.lose}{s.points !== null ? ` · ${s.points} poin` : ''}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <details className="panel">
        <summary className="p-brawl-sum">Data statis cadangan (diperiksa {LAST_VERIFIED})</summary>
        <MplStatic embedded />
      </details>
    </div>
  );
}

export function MplPage() {
  const { playoffs } = useLive();
  if (playoffs.data && playoffs.data.days.length > 0) {
    return <MplLive data={playoffs.data} at={playoffs.at} stale={playoffs.state === 'stale'} />;
  }
  const banner =
    playoffs.state === 'loading'
      ? 'Memuat data langsung dari API… sementara ini tampil data statis.'
      : playoffs.state === 'error'
        ? `Data langsung dari API tidak tersedia (${playoffs.error}). Memakai data statis, diperiksa ${LAST_VERIFIED}.`
        : 'API tidak mengembalikan jadwal playoff. Memakai data statis.';
  return <MplStatic banner={banner} />;
}
