import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { useActivity } from '../components/Activity';
import { Countdown } from '../components/Countdown';
import { Glyph } from '../components/Glyph';
import { HeroAvatar, Icon } from '../components/ui';
import { PATCHES, type Patch } from '../data/patches';
import { EVENT, PLAYOFF_START_ISO } from '../data/mpl';
import { ROLE_COLOR } from '../data/heroes';
import { itemsOf, totalCost } from '../lib/analysis';
import { ago, heroTrend, profileStats, type ProfileStats } from '../lib/community';
import { playoffWindow } from '../lib/live';
import { formatGold, greeting, longDate } from '../lib/util';
import { useLive } from '../live';
import { hashFor } from '../route';
import { readPersistent, useStore } from '../store';
import { LANES, type Build, type Lane, type Team } from '../types';

const MPL_START = new Date(PLAYOFF_START_ISO).getTime();
const MPL_END = new Date('2026-11-09T00:00:00+07:00').getTime();
/** Di bawah jumlah ini, "tren" hanya kebetulan; lebih jujur bilang datanya belum cukup. */
const MIN_TREND_SAMPLE = 10;

const validTeamDraft = (v: unknown): boolean => !!v && typeof v === 'object' && !!(v as Team).slots && typeof (v as Team).slots === 'object';
const validBuildDraft = (v: unknown): boolean => !!v && typeof v === 'object' && Array.isArray((v as Build).items) && (v as Build).items.length === 6;

const patchDate = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${iso}T12:00:00+07:00`));

function Board() {
  const { heroById } = useStore();
  const team = useMemo(() => readPersistent<Team>('mbl:team-draft:v1', validTeamDraft), []);
  const build = useMemo(() => readPersistent<Build>('mbl:draft:v1', validBuildDraft), []);

  const lanes = LANES.map((lane: Lane) => {
    const id = team?.slots?.[lane]?.heroId ?? null;
    return { lane, hero: id ? heroById(id) : undefined };
  });
  const filled = lanes.filter((l) => l.hero).length;

  const bHero = build?.heroId ? heroById(build.heroId) : undefined;
  const bItems = build ? itemsOf(build.items) : [];

  return (
    <section className="panel board" aria-label="Draf yang sedang dikerjakan">
      <section>
        <div className="panel-head">
          <h2>Komposisi tim</h2>
          <span className="muted small">{filled}/5 lane terisi</span>
        </div>
        <ul className="hexrow">
          {lanes.map(({ lane, hero }) => (
            <li key={lane}>
              {hero ? (
                <a href={hashFor('team')} aria-label={`${lane}: ${hero.name}`} style={{ display: 'contents' }}>
                  <HeroAvatar hero={hero} size={68} />
                </a>
              ) : (
                <a className="hex-empty" href={hashFor('team')} aria-label={`${lane} kosong, buka Komposisi tim`}>
                  <span aria-hidden="true">+</span>
                </a>
              )}
              <span className="hx-lane">{lane}</span>
              <span className="hx-name">{hero ? hero.name : 'Kosong'}</span>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 18 }}>
          <a className="btn small" href={hashFor('team')}>
            {filled > 0 ? 'Lanjutkan komposisi' : 'Mulai komposisi'}
          </a>
        </div>
      </section>

      <section>
        <div className="panel-head">
          <h2>Build di editor</h2>
          {bHero && <span className="muted small">{bItems.length}/6 item</span>}
        </div>
        {bHero ? (
          <>
            <div className="board-hero">
              <HeroAvatar hero={bHero} size={64} />
              <div className="grow">
                <strong>{build?.name || `${bHero.name} build`}</strong>
                <div className="muted small">{bHero.roles.join(' / ')}</div>
              </div>
            </div>
            <div className="board-items" aria-label="Item di draf">
              {bItems.length === 0 && <span className="muted small">Belum ada item.</span>}
              {bItems.map((it) => (
                <Icon key={it.id} kind="items" name={it.name} size={34} />
              ))}
            </div>
            <div>
              <span className="big-gold">{formatGold(totalCost(bItems))}</span> <span className="muted small">gold</span>
            </div>
            <div className="row">
              <a className="btn small primary" href={hashFor('builder')}>
                Lanjutkan build
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="muted">Belum ada hero di editor. Pilih hero, isi enam item, lalu simpan.</p>
            <div className="row">
              <a className="btn small primary" href={hashFor('builder', { new: '1' })}>
                Mulai build
              </a>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function Ledger() {
  const { builds, teams, heroes } = useStore();
  const { db, state } = useAuth();
  const userId = state.status === 'in' ? state.userId : null;
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setStats(null);
    setFailed(false);
    if (!db || !userId) return;
    let alive = true;
    profileStats(db, userId)
      .then((s) => alive && setStats(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [db, userId]);

  const cells: { n: string; label: string }[] = [
    { n: String(builds.length), label: 'Build tersimpan' },
    { n: String(teams.length), label: 'Komposisi tersimpan' },
  ];
  if (userId) {
    cells.push({ n: stats ? String(stats.posts) : failed ? '–' : '…', label: 'Dibagikan ke komunitas' }, { n: stats ? String(stats.likes) : failed ? '–' : '…', label: 'Suka diterima' });
  } else {
    cells.push({ n: String(heroes.length), label: 'Hero tersedia' });
  }
  return (
    <section className="panel ledger" aria-label="Ringkasan">
      {cells.map((c) => (
        <div key={c.label} className="ledger-cell">
          <span className="ledger-num">{c.n}</span>
          <span className="ledger-label">{c.label}</span>
        </div>
      ))}
    </section>
  );
}

function RecentBuilds() {
  const { builds, heroById } = useStore();
  const recent = useMemo(() => [...builds].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5), [builds]);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Build terakhir diubah</h2>
        {builds.length > 5 && <a className="link small" href={hashFor('builder')}>Lihat semua ({builds.length})</a>}
      </div>
      {recent.length === 0 ? (
        <p className="empty">Belum ada build tersimpan. Susun satu di editor lalu tekan Simpan build.</p>
      ) : (
        <ul className="rows">
          {recent.map((b) => {
            const h = heroById(b.heroId);
            const its = itemsOf(b.items);
            return (
              <li key={b.id}>
                <a className="row-main" href={hashFor('builder', { edit: b.id })}>
                  <HeroAvatar hero={h} size={40} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row-title" style={{ display: 'block' }}>{b.name || 'Build tanpa nama'}</span>
                    <span className="row-sub">
                      {h ? h.name : 'Hero dihapus'} · {its.length}/6 item · {ago(b.updatedAt)}
                    </span>
                  </span>
                </a>
                <span className="gold small">{formatGold(totalCost(its))}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Trend() {
  const { db } = useAuth();
  const { heroById } = useStore();
  const [res, setRes] = useState<{ phase: 'loading' } | { phase: 'error' } | { phase: 'ok'; heroes: { id: string; count: number }[]; sample: number }>({ phase: 'loading' });

  useEffect(() => {
    if (!db) return;
    let alive = true;
    heroTrend(db)
      .then((t) => alive && setRes({ phase: 'ok', ...t }))
      .catch(() => alive && setRes({ phase: 'error' }));
    return () => {
      alive = false;
    };
  }, [db]);

  const rows = res.phase === 'ok' ? res.heroes.map((h) => ({ ...h, hero: heroById(h.id) })).filter((r) => r.hero) : [];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Hero di build komunitas</h2>
        <a className="link small" href={hashFor('community')}>Jelajah</a>
      </div>
      {res.phase === 'loading' && (
        <div role="status" aria-label="Memuat" className="stack">
          <span className="skel" style={{ height: 30 }} />
          <span className="skel" style={{ height: 30 }} />
          <span className="skel" style={{ height: 30 }} />
        </div>
      )}
      {res.phase === 'error' && <p className="muted">Data komunitas belum bisa dimuat. Coba muat ulang halaman.</p>}
      {res.phase === 'ok' && (res.sample < MIN_TREND_SAMPLE || rows.length === 0) && (
        <p className="empty">
          Baru {res.sample} build dibagikan, terlalu sedikit untuk dibaca sebagai tren. Bagikan build kamu supaya daftar ini terisi.
        </p>
      )}
      {res.phase === 'ok' && res.sample >= MIN_TREND_SAMPLE && rows.length > 0 && (
        <>
          <ul className="trend">
            {rows.map((r) => (
              <li key={r.id} style={{ ['--c' as string]: r.hero ? ROLE_COLOR[r.hero.roles[0]] : undefined }}>
                <HeroAvatar hero={r.hero} size={34} />
                <a href={hashFor('community', { hero: r.id })} style={{ color: 'inherit', fontWeight: 650, textDecoration: 'none' }}>
                  {r.hero?.name}
                </a>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }} />
                </span>
                <span className="muted small" style={{ textAlign: 'right' }}>{r.count}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Dihitung dari {res.sample} build komunitas terbaru. Ini gambaran popularitas di app ini, bukan statistik pick rate resmi.</p>
        </>
      )}
    </section>
  );
}

function PatchMini() {
  const p: Patch | undefined = PATCHES.find((x) => x.server === 'original');
  if (!p) return null;
  const names = p.heroes.slice(0, 4);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Patch live terbaru</h2>
        <a className="link small" href={hashFor('patch')}>Selengkapnya</a>
      </div>
      <div>
        <strong style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 600 }}>{p.version}</strong>
        <div className="muted small">
          {patchDate(p.date)} · Original Server
        </div>
      </div>
      {p.counts && (
        <div className="row">
          <span className="p-kind k-buff">{p.counts.buff} buff</span>
          <span className="p-kind k-nerf">{p.counts.nerf} nerf</span>
          {p.counts.adjust > 0 && <span className="p-kind k-adjust">{p.counts.adjust} adjust</span>}
        </div>
      )}
      {names.length > 0 && (
        <ul className="patch-mini p-list">
          {names.map((c) => (
            <li key={`${c.kind}-${c.name}`} className="p-row">
              <span className={`p-kind k-${c.kind}`}>{c.kind === 'buff' ? 'Buff' : c.kind === 'nerf' ? 'Nerf' : c.kind === 'rework' ? 'Rework' : 'Ubah'}</span>
              <strong className="p-name">{c.name}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MplMini() {
  const { playoffs } = useLive();
  const { start, end } = useMemo(() => {
    if (playoffs.data) {
      const w = playoffWindow(playoffs.data, Date.now());
      if (w.end !== null) return { start: w.next ?? 0, end: w.end };
    }
    return { start: MPL_START, end: MPL_END };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playoffs.data]);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Playoff MPL ID S18</h2>
        <a className="link small" href={hashFor('mpl')}>Jadwal</a>
      </div>
      <Countdown start={start} end={end} compact />
      <p className="muted small">
        {EVENT.dates}, {EVENT.venue}.
      </p>
    </section>
  );
}

function Comments() {
  const { state } = useAuth();
  const { items, unread, loaded } = useActivity();
  if (state.status !== 'in' || !loaded || items.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Komentar di tulisanmu</h2>
        {unread > 0 && <span className="tag static">{unread} baru</span>}
      </div>
      <ul className="rows">
        {items.slice(0, 4).map((a) => (
          <li key={a.id}>
            <a className="row-main" href={hashFor('community', { post: a.postId })}>
              <Glyph name="comment" />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="row-title" style={{ display: 'block' }}>
                  {a.author} di “{a.postTitle}”
                </span>
                <span className="row-sub" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.body}
                </span>
              </span>
              <span className="muted small">{ago(a.createdAt)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardPage() {
  const { state, signIn } = useAuth();
  const communityOn = state.status !== 'off';
  const name = state.status === 'in' ? state.name : null;
  return (
    <div className="page">
      <header className="db-greet">
        <div className="stack" style={{ gap: 4 }}>
          <span className="muted small">{longDate()}</span>
          <h1>
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <div className="page-actions">
          <a className="btn primary" href={hashFor('builder', { new: '1' })}>
            <Glyph name="plus" /> Build baru
          </a>
          <a className="btn" href={hashFor('team', { new: '1' })}>
            <Glyph name="plus" /> Komposisi baru
          </a>
          {state.status === 'out' && (
            <button type="button" className="btn ghost" onClick={() => void signIn()}>
              Masuk dengan Google
            </button>
          )}
        </div>
      </header>

      <Board />
      <Ledger />

      <div className="db-cols">
        <div className="stack" style={{ gap: 20 }}>
          <RecentBuilds />
          <MplMini />
        </div>
        <div className="stack" style={{ gap: 20 }}>
          {communityOn && <Trend />}
          <PatchMini />
        </div>
      </div>
      <Comments />
    </div>
  );
}
