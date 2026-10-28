import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { Glyph } from '../components/Glyph';
import { PagedPosts } from '../components/PostList';
import { HeroAvatar, Modal, useToast } from '../components/ui';
import {
  BIO_MAX,
  friendlyError,
  getProfile,
  isUuid,
  listBookmarks,
  listPosts,
  profileStats,
  updateProfile,
  type PostKind,
  type Profile,
  type ProfileStats,
} from '../lib/community';
import { avatarHue } from '../lib/util';
import { hashFor } from '../route';
import { useStore } from '../store';

type Tab = 'build' | 'team' | 'saved';

const joined = (ts: number): string =>
  ts > 0 ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(ts)) : '';

function BigAvatar({ id, name, size = 88 }: { id: string; name: string; size?: number }) {
  return (
    <span className="uav" style={{ ['--s' as string]: `${size}px`, ['--h' as string]: avatarHue(id) }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function EditDialog({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const { db, syncName } = useAuth();
  const { heroes } = useStore();
  const notify = useToast();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [main, setMain] = useState(profile.mainHero ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const options = useMemo(() => heroes.filter((h) => !h.custom), [heroes]);
  // Hero utama yang tersimpan tapi sudah tidak ada di daftar tetap ditampilkan supaya tidak hilang diam-diam.
  const stray = main && !options.some((h) => h.id === main);

  const save = async () => {
    if (!db) return;
    setBusy(true);
    setErr('');
    try {
      const p = await updateProfile(db, profile.id, { name, bio, mainHero: main || null });
      syncName(p.name);
      onSaved(p);
      notify('Profil diperbarui');
      onClose();
    } catch (e) {
      setErr(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit profil" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span>Nama tampilan ({name.length}/24)</span>
          <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>
            Bio ({bio.length}/{BIO_MAX})
          </span>
          <textarea className="input" rows={3} maxLength={BIO_MAX} value={bio} placeholder="Mis. Main jungle, suka build fleksibel. Rank Mythic." onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="field">
          <span>Hero utama</span>
          <select className="input" value={main} onChange={(e) => setMain(e.target.value)}>
            <option value="">Belum dipilih</option>
            {stray && <option value={main}>{main}</option>}
            {options.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">Nama, bio, dan hero utama tampil ke semua orang. Profil tidak punya tombol lapor di app ini, jadi jaga isinya tetap sopan dan jangan menaruh data pribadi.</p>
        {err && (
          <p className="note bad" role="alert">
            {err}
          </p>
        )}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Header({ profile, self, onEdit }: { profile: Profile; self: boolean; onEdit: () => void }) {
  const { heroById } = useStore();
  const notify = useToast();
  const main = profile.mainHero ? heroById(profile.mainHero) : undefined;
  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}${hashFor('profile', { u: profile.id })}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('Tautan profil disalin');
    } catch {
      notify(url);
    }
  };
  return (
    <section className="panel">
      <div className="pf-head">
        <BigAvatar id={profile.id} name={profile.name} />
        <div className="pf-id">
          <h1>{profile.name}</h1>
          {profile.bio ? <p className="pf-bio">{profile.bio}</p> : <p className="muted">{self ? 'Belum ada bio. Tambahkan lewat Edit profil.' : 'Belum ada bio.'}</p>}
          <div className="row">
            {main && (
              <span className="pf-main" title="Hero utama">
                <HeroAvatar hero={main} size={28} />
                {main.name}
              </span>
            )}
            {joined(profile.joinedAt) && <span className="muted small">Bergabung {joined(profile.joinedAt)}</span>}
          </div>
        </div>
        <div className="page-actions">
          {self && (
            <button type="button" className="btn" onClick={onEdit}>
              <Glyph name="edit" /> Edit profil
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => void copy()}>
            <Glyph name="link" /> Salin tautan
          </button>
        </div>
      </div>
    </section>
  );
}

function Stats({ stats }: { stats: ProfileStats | null | 'error' }) {
  const { heroById } = useStore();
  if (stats === 'error') return <p className="muted small">Statistik belum bisa dimuat.</p>;
  if (!stats) {
    return (
      <section className="panel ledger" aria-label="Memuat statistik">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ledger-cell">
            <span className="skel" style={{ height: 40, width: 56 }} />
            <span className="skel" style={{ width: 90 }} />
          </div>
        ))}
      </section>
    );
  }
  const top = stats.topHeroes.map((t) => ({ ...t, hero: heroById(t.id) })).filter((t) => t.hero);
  return (
    <>
      <section className="panel ledger" aria-label="Statistik">
        <div className="ledger-cell">
          <span className="ledger-num">{stats.posts}</span>
          <span className="ledger-label">Tulisan</span>
        </div>
        <div className="ledger-cell">
          <span className="ledger-num">{stats.likes}</span>
          <span className="ledger-label">Suka diterima</span>
        </div>
        <div className="ledger-cell">
          <span className="ledger-num">{stats.comments}</span>
          <span className="ledger-label">Komentar diterima</span>
        </div>
        <div className="ledger-cell">
          <span className="ledger-num">{stats.duelPlayed > 0 ? `${stats.duelWins}/${stats.duelPlayed}` : '–'}</span>
          <span className="ledger-label">Menang di Adu</span>
        </div>
      </section>
      {top.length > 0 && (
        <section className="panel">
          <h2>Hero yang sering dibuat</h2>
          <div className="heroes-top">
            {top.map((t) => (
              <a key={t.id} className="hero-pill" href={hashFor('community', { hero: t.id })}>
                <HeroAvatar hero={t.hero} size={30} />
                {t.hero?.name}
                <span className="num">{t.count}×</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function ProfilePage({ params }: { params: URLSearchParams }) {
  const { db, state, signIn } = useAuth();
  const u = params.get('u');
  const selfId = state.status === 'in' ? state.userId : null;
  const targetId = u ?? selfId;
  const self = !!selfId && targetId === selfId;
  const rawTab = params.get('tab');
  const tab: Tab = rawTab === 'team' ? 'team' : rawTab === 'saved' && self ? 'saved' : 'build';

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState('');
  const [stats, setStats] = useState<ProfileStats | null | 'error'>(null);
  const [editing, setEditing] = useState(false);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    setProfile(undefined);
    setLoadErr('');
    setStats(null);
    if (!db || !targetId || !isUuid(targetId)) return;
    let alive = true;
    getProfile(db, targetId)
      .then((p) => alive && setProfile(p))
      .catch((e) => {
        if (!alive) return;
        setLoadErr(friendlyError(e));
        setProfile(null);
      });
    return () => {
      alive = false;
    };
  }, [db, targetId]);

  useEffect(() => {
    if (!db || !targetId || !isUuid(targetId)) return;
    let alive = true;
    profileStats(db, targetId)
      .then((s) => alive && setStats(s))
      .catch(() => alive && setStats('error'));
    return () => {
      alive = false;
    };
  }, [db, targetId, statsKey]);

  const load = useCallback(
    (offset: number) => {
      if (!db || !targetId) return Promise.resolve({ posts: [], more: false });
      if (tab === 'saved') return listBookmarks(db, offset);
      return listPosts(db, { kind: tab as PostKind, sort: 'baru', userId: targetId, offset });
    },
    [db, targetId, tab],
  );

  if (state.status === 'off') {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Profil</h1>
        </header>
        <p className="empty">Fitur komunitas belum aktif di instalasi ini, jadi profil belum tersedia. Build dan komposisi lokalmu tetap bisa dipakai.</p>
      </div>
    );
  }
  if (!u && state.status === 'loading') {
    return (
      <div className="page" role="status" aria-label="Memuat">
        <span className="skel" style={{ height: 120 }} />
      </div>
    );
  }
  if (!targetId) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Profil</h1>
          <p className="muted">Masuk dengan Google untuk punya profil, membagikan build, dan menyimpan tulisan orang lain.</p>
        </header>
        <div>
          <button type="button" className="btn primary" onClick={() => void signIn()}>
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }
  if (!isUuid(targetId) || profile === null) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Profil tidak ditemukan</h1>
        </header>
        <p className="empty">{loadErr || 'Tautan profil ini tidak valid atau penggunanya sudah tidak ada.'}</p>
        <div>
          <a className="btn" href={hashFor('community')}>
            Ke Jelajah
          </a>
        </div>
      </div>
    );
  }
  if (profile === undefined) {
    return (
      <div className="page" role="status" aria-label="Memuat">
        <span className="skel" style={{ height: 120 }} />
        <span className="skel" style={{ height: 80 }} />
      </div>
    );
  }

  const q = (t: Tab) => hashFor('profile', { u: self && !u ? undefined : targetId, tab: t === 'build' ? undefined : t });
  const count = (n: number | undefined) => (typeof n === 'number' ? <span className="count">{n}</span> : null);
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: 'build', label: 'Build', n: stats && stats !== 'error' ? stats.builds : undefined },
    { id: 'team', label: 'Komposisi', n: stats && stats !== 'error' ? stats.teams : undefined },
  ];
  if (self) tabs.push({ id: 'saved', label: 'Disimpan' });

  return (
    <div className="page">
      <Header profile={profile} self={self} onEdit={() => setEditing(true)} />
      <Stats stats={stats} />

      <nav className="pf-tabs" aria-label="Isi profil">
        {tabs.map((t) => (
          <a key={t.id} className={`pf-tab${tab === t.id ? ' on' : ''}`} href={q(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            {t.label}
            {count(t.n)}
          </a>
        ))}
      </nav>

      <PagedPosts
        load={load}
        resetKey={`${targetId}:${tab}`}
        removeOnUnsave={tab === 'saved'}
        onDeleted={() => setStatsKey((k) => k + 1)}
        empty={
          tab === 'saved' ? (
            <>Belum ada yang disimpan. Tekan ikon penanda di tulisan komunitas untuk menyimpannya ke sini.</>
          ) : self ? (
            <>
              Belum ada {tab === 'build' ? 'build' : 'komposisi'} yang dibagikan.{' '}
              <a className="link" href={hashFor(tab === 'build' ? 'builder' : 'team')}>
                Susun satu
              </a>{' '}
              lalu pilih Bagikan ke komunitas.
            </>
          ) : (
            <>Belum ada {tab === 'build' ? 'build' : 'komposisi'} yang dibagikan.</>
          )
        }
      />

      {editing && self && <EditDialog profile={profile} onClose={() => setEditing(false)} onSaved={setProfile} />}
    </div>
  );
}
