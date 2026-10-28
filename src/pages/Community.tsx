import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { Glyph } from '../components/Glyph';
import { PostBody, PostNote } from '../components/PostBody';
import { Author, KIND_LABEL, LikeButton, SaveButton, UseButton, postLink, useBookmarks, useLikes } from '../components/PostCard';
import { PagedPosts, PostSkeleton } from '../components/PostList';
import { Modal, useToast } from '../components/ui';
import {
  REPORT_REASONS,
  addComment,
  ago,
  deleteComment,
  deletePost,
  friendlyError,
  getPost,
  getPosts,
  listBookmarks,
  listComments,
  listPosts,
  nextDuel,
  report,
  vote,
  winRate,
  MIN_DUELS_FOR_RANK,
  type Comment,
  type Post,
  type PostKind,
  type ReportReason,
  type SortKey,
} from '../lib/community';
import { OFF_TEXT } from '../lib/config';
import { hashFor } from '../route';
import { useStore } from '../store';

type View = 'feed' | 'duel' | 'saved';

const SORTS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'baru', label: 'Terbaru', hint: 'Urut waktu terbit' },
  { id: 'populer', label: 'Terpopuler', hint: 'Paling banyak disukai' },
  { id: 'adu', label: 'Juara adu', hint: `Peringkat menang di Adu (minimal ${MIN_DUELS_FOR_RANK} duel)` },
];

function Setup() {
  const { state } = useAuth();
  const reason = state.status === 'off' ? OFF_TEXT[state.reason] : '';
  return (
    <div className="page">
      <header className="page-head">
        <h1>Komunitas</h1>
        <p className="muted">Jelajahi build dan komposisi pemain lain, beri suka, komentar, dan adu.</p>
      </header>
      <section className="panel">
        <h2>Belum aktif</h2>
        <p className="muted">{reason}</p>
        <p className="muted small">Pemilik situs: ikuti bagian &ldquo;Komunitas&rdquo; di README untuk membuat proyek Supabase, lalu isi dua variabel lingkungan itu di Vercel dan deploy ulang.</p>
      </section>
    </div>
  );
}

function SubNav({ view }: { view: View }) {
  const items: { id: View; label: string }[] = [
    { id: 'feed', label: 'Jelajah' },
    { id: 'duel', label: 'Adu' },
    { id: 'saved', label: 'Disimpan' },
  ];
  return (
    <nav className="cm-subnav" aria-label="Bagian komunitas">
      {items.map((i) => (
        <a key={i.id} className={`chip plain${view === i.id ? ' on' : ''}`} href={hashFor('community', { view: i.id === 'feed' ? undefined : i.id })} aria-current={view === i.id ? 'page' : undefined}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

function HeroSelect({ value, onChange, label, anyLabel }: { value: string; onChange: (v: string) => void; label: string; anyLabel: string }) {
  const { heroes } = useStore();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{anyLabel}</option>
      {heroes
        .filter((h) => !h.custom)
        .map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
    </select>
  );
}

function KindSwitch({ kind, onChange }: { kind: PostKind; onChange: (k: PostKind) => void }) {
  return (
    <div className="chips seg" role="group" aria-label="Jenis">
      {(['build', 'team'] as PostKind[]).map((k) => (
        <button key={k} type="button" className={`chip plain${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => onChange(k)}>
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function Feed({ initialHero }: { initialHero: string }) {
  const { db } = useAuth();
  const [kind, setKind] = useState<PostKind>('build');
  const [sort, setSort] = useState<SortKey>('baru');
  const [hero, setHero] = useState(initialHero);
  useEffect(() => setHero(initialHero), [initialHero]);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput), 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = useCallback((offset: number) => listPosts(db!, { kind, hero: hero || undefined, q, sort, offset }), [db, kind, hero, q, sort]);
  const label = KIND_LABEL[kind].toLowerCase();
  const tab = kind === 'build' ? 'Build hero' : 'Komposisi tim';

  return (
    <>
      <div className="panel cm-filters">
        <div className="cm-filter-bar">
          <KindSwitch kind={kind} onChange={setKind} />
          <div className="chips seg" role="group" aria-label="Urutan">
            {SORTS.map((s) => (
              <button key={s.id} type="button" title={s.hint} className={`chip plain${sort === s.id ? ' on' : ''}`} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="cm-filter-row">
          <HeroSelect value={hero} onChange={setHero} label="Filter hero" anyLabel="Semua hero" />
          <input className="input" type="search" value={qInput} maxLength={40} placeholder="Cari judul atau catatan" aria-label="Cari" onChange={(e) => setQInput(e.target.value)} />
        </div>
      </div>
      <PagedPosts
        load={load}
        resetKey={`${kind}|${sort}|${hero}|${q}`}
        empty={
          q || hero || sort === 'adu'
            ? sort === 'adu' && !q && !hero
              ? `Belum ada ${label} dengan ${MIN_DUELS_FOR_RANK} duel atau lebih. Ikut Adu untuk mengisinya.`
              : 'Tidak ada yang cocok dengan filter ini. Coba hapus filter hero atau kata pencarian.'
            : `Belum ada ${label} di komunitas. Jadilah yang pertama: buka ${tab} lalu tekan “Bagikan ke komunitas”.`
        }
      />
    </>
  );
}

function Saved() {
  const { db, state, requireLogin } = useAuth();
  const load = useCallback((offset: number) => listBookmarks(db!, offset), [db]);
  if (state.status === 'loading') return <PostSkeleton />;
  if (state.status !== 'in') {
    return (
      <section className="panel">
        <h2>Simpananmu</h2>
        <p className="muted">Tulisan yang kamu simpan dari Jelajah muncul di sini, jadi bisa dibuka lagi kapan saja. Masuk untuk melihatnya.</p>
        <div>
          <button type="button" className="btn primary" onClick={() => requireLogin('Masuk dengan Google untuk melihat simpananmu.')}>
            Masuk dengan Google
          </button>
        </div>
      </section>
    );
  }
  return <PagedPosts load={load} resetKey={`saved|${state.userId}`} removeOnUnsave empty="Belum ada yang disimpan. Tekan ikon penanda di kartu tulisan mana pun untuk menyimpannya di sini." />;
}

function ReportDialog({ what, onSend, onClose }: { what: string; onSend: (r: ReportReason) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>('spam');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={`Laporkan ${what}`} onClose={onClose}>
      <fieldset className="cm-reasons">
        <legend className="sr">Alasan</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.id} className="cm-reason">
            <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} /> {r.label}
          </label>
        ))}
      </fieldset>
      <p className="muted small">Tiga pelapor berbeda menyembunyikannya otomatis sampai ditinjau pengelola. Laporan palsu tidak berguna: satu akun hanya bisa melapor sekali per tulisan.</p>
      {err && (
        <p className="cm-err" role="alert">
          {err}
        </p>
      )}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onClose}>
          Batal
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSend(reason);
              onClose();
            } catch (e) {
              setErr(friendlyError(e));
              setBusy(false);
            }
          }}
        >
          Kirim laporan
        </button>
      </div>
    </Modal>
  );
}

function CommentRow({ c, mine, onDelete, onReport }: { c: Comment; mine: boolean; onDelete: () => void; onReport: () => void }) {
  return (
    <li className="cm-comment">
      <div className="cm-comment-head">
        <strong>{c.author}</strong>
        <span className="muted small">{ago(c.createdAt)}</span>
        {c.hidden && <span className="tag static warn">disembunyikan (laporan)</span>}
        <span className="grow" />
        {mine ? (
          <button type="button" className="link small" onClick={onDelete}>
            Hapus
          </button>
        ) : (
          <button type="button" className="link small" onClick={onReport}>
            Laporkan
          </button>
        )}
      </div>
      <p className="cm-comment-body">{c.body}</p>
    </li>
  );
}

function PostPage({ id }: { id: string }) {
  const { db, state, requireLogin } = useAuth();
  const notify = useToast();
  const likes = useLikes();
  const bm = useBookmarks();
  const userId = state.status === 'in' ? state.userId : undefined;

  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<{ post?: string; comment?: string; what: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const reload = useCallback(async () => {
    if (!db) return;
    try {
      const p = await getPost(db, id);
      setPost(p);
      if (p) {
        void likes.load([p.id]);
        void bm.load([p.id]);
        setComments(await listComments(db, id));
      }
    } catch (e) {
      setErr(friendlyError(e));
      setPost(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id, likes.load, bm.load]);

  useEffect(() => {
    setPost(undefined);
    setErr('');
    void reload();
  }, [reload]);

  const send = async () => {
    if (!requireLogin('Masuk dengan Google untuk berkomentar.') || !db || !text.trim()) return;
    setSending(true);
    try {
      await addComment(db, id, text);
      setText('');
      setComments(await listComments(db, id));
      setPost((p) => (p ? { ...p, comments: p.comments + 1 } : p));
    } catch (e) {
      notify(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(postLink(id));
      notify('Tautan disalin');
    } catch {
      notify(postLink(id));
    }
  };

  if (post === undefined) return <PostSkeleton n={1} />;
  if (!post) {
    return (
      <section className="panel" role="alert">
        <h2>Tidak ditemukan</h2>
        <p className="muted">{err || 'Tulisan ini sudah dihapus atau disembunyikan.'}</p>
        <a className="btn" href={hashFor('community')}>
          Kembali ke komunitas
        </a>
      </section>
    );
  }

  const mine = !!userId && post.userId === userId;
  return (
    <>
      <p>
        <a className="link" href={hashFor('community')}>
          ← Semua tulisan
        </a>
      </p>
      <div className="cm-post-grid">
      <article className="panel cm-detail">
        <header className="cm-detail-head">
          <div className="grow">
            <span className="tag static">{KIND_LABEL[post.kind]}</span>
            <h2>{post.title}</h2>
            <Author post={post} />
            {post.hidden && <span className="tag static warn"> disembunyikan (laporan), hanya kamu yang melihat ini</span>}
          </div>
        </header>
        <PostBody post={post} />
        <PostNote post={post} />
        <div className="cm-card-foot">
          <LikeButton
            count={post.likes}
            on={likes.liked.has(post.id)}
            onClick={() => void likes.toggle(post.id, (d) => setPost((p) => (p ? { ...p, likes: Math.max(0, p.likes + d) } : p)))}
          />
          <SaveButton on={bm.saved.has(post.id)} onClick={() => void bm.toggle(post.id)} />
          <span className="grow" />
          <UseButton post={post} />
          <button type="button" className="btn small" onClick={() => void copy()}>
            <Glyph name="link" /> Salin tautan
          </button>
          {mine ? (
            <button
              type="button"
              className={`btn small ${confirmDel ? 'danger' : 'ghost'}`}
              onClick={async () => {
                if (!confirmDel) {
                  setConfirmDel(true);
                  window.setTimeout(() => setConfirmDel(false), 3000);
                  return;
                }
                if (!db) return;
                try {
                  await deletePost(db, post.id);
                  notify('Tulisan dihapus');
                  window.location.hash = hashFor('community', { view: 'mine' });
                } catch (e) {
                  notify(friendlyError(e));
                }
              }}
            >
              {confirmDel ? 'Yakin hapus?' : 'Hapus'}
            </button>
          ) : (
            <button type="button" className="btn small ghost" onClick={() => requireLogin('Masuk dengan Google untuk melapor.') && setReporting({ post: post.id, what: 'tulisan ini' })}>
              Laporkan
            </button>
          )}
        </div>
      </article>

      <section className="panel cm-comments">
        <div className="panel-head">
          <h2>Komentar</h2>
          <span className="muted small">{post.comments}</span>
        </div>
        {comments.length === 0 && <p className="empty small">Belum ada komentar.</p>}
        <ul className="cm-comment-list">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              c={c}
              mine={!!userId && c.userId === userId}
              onDelete={async () => {
                if (!db) return;
                try {
                  await deleteComment(db, c.id);
                  setComments((cs) => cs.filter((x) => x.id !== c.id));
                  setPost((p) => (p ? { ...p, comments: Math.max(0, p.comments - 1) } : p));
                } catch (e) {
                  notify(friendlyError(e));
                }
              }}
              onReport={() => requireLogin('Masuk dengan Google untuk melapor.') && setReporting({ comment: c.id, what: 'komentar ini' })}
            />
          ))}
        </ul>
        {state.status === 'in' ? (
          <form
            className="cm-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="field">
              <span>Komentar sebagai {state.name} ({text.length}/500)</span>
              <textarea className="input" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis dengan sopan. Saran item dan alasan lebih berguna daripada “jelek”." />
            </label>
            <div className="row end">
              <button type="submit" className="btn primary" disabled={sending || !text.trim()}>
                {sending ? 'Mengirim…' : 'Kirim komentar'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn" onClick={() => requireLogin('Masuk dengan Google untuk berkomentar.')} disabled={state.status === 'loading'}>
            Masuk untuk berkomentar
          </button>
        )}
      </section>
      </div>

      {reporting && (
        <ReportDialog
          what={reporting.what}
          onClose={() => setReporting(null)}
          onSend={async (r) => {
            if (!db) return;
            await report(db, reporting, r);
            notify('Laporan terkirim. Terima kasih.');
          }}
        />
      )}
    </>
  );
}

function DuelSide({ label, post, picked, revealed, onPick, busy }: { label: string; post: Post; picked: boolean; revealed: boolean; onPick: () => void; busy: boolean }) {
  const rate = winRate(post);
  return (
    <section className={`panel cm-duel-side${picked ? ' won' : ''}`} aria-label={`Pilihan ${label}`}>
      <div className="cm-duel-label">{label}</div>
      <h3>{post.title}</h3>
      {revealed ? (
        <p className="muted small">
          <Author post={post} /> · {rate === null ? 'belum ada duel' : `${rate}% menang dari ${post.duelPlayed} duel`}
        </p>
      ) : (
        <p className="muted small">Penulis dan skor disembunyikan sampai kamu memilih.</p>
      )}
      <PostBody post={post} />
      <PostNote post={post} />
      <button type="button" className="btn primary" disabled={busy || revealed} onClick={onPick}>
        {picked ? 'Pilihanmu ✓' : `Pilih ${label}`}
      </button>
    </section>
  );
}

function Duel() {
  const { db, state, requireLogin } = useAuth();
  const notify = useToast();
  const [kind, setKind] = useState<PostKind>('build');
  const [hero, setHero] = useState('');
  const [pair, setPair] = useState<[Post, Post] | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const lastKey = useRef('');

  const loggedIn = state.status === 'in';

  const next = useCallback(async () => {
    if (!db || !loggedIn) return;
    setPhase('loading');
    setPicked(null);
    try {
      // Setelah "Lewati" jangan langsung dapat pasangan yang sama lagi (coba beberapa kali).
      let p: [Post, Post] | null = null;
      for (let i = 0; i < 4; i++) {
        p = await nextDuel(db, kind, hero || undefined);
        if (!p || [p[0].id, p[1].id].sort().join() !== lastKey.current) break;
      }
      if (p) lastKey.current = [p[0].id, p[1].id].sort().join();
      setPair(p);
      setPhase(p ? 'ready' : 'empty');
    } catch (e) {
      setErr(friendlyError(e));
      setPhase('error');
    }
  }, [db, loggedIn, kind, hero]);

  useEffect(() => {
    lastKey.current = '';
    void next();
  }, [next]);

  const choose = async (winner: Post) => {
    if (!db || !pair) return;
    setBusy(true);
    try {
      await vote(db, pair[0].id, pair[1].id, winner.id);
      setPicked(winner.id);
      setCount((n) => n + 1);
      // Muat ulang skor kedua sisi supaya yang tampil sudah termasuk suaramu.
      const fresh = await getPosts(db, [pair[0].id, pair[1].id]);
      const a = fresh.find((p) => p.id === pair[0].id) ?? pair[0];
      const b = fresh.find((p) => p.id === pair[1].id) ?? pair[1];
      setPair([a, b]);
    } catch (e) {
      notify(friendlyError(e));
      if (/Sudah pernah/.test(friendlyError(e))) void next();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel cm-duel-intro">
        <h2>Adu</h2>
        <p className="muted">
          Dua tulisan komunitas, satu pilihan. Build hanya diadu dengan build hero yang sama. Tulisanmu sendiri tidak ikut. Skor tidak menandakan meta atau kekuatan di game, hanya selera pemilih di sini;
          peringkat memakai batas bawah statistik supaya 3 menang dari 3 tidak otomatis mengalahkan 40 menang dari 50.
        </p>
        <div className="cm-filter-row">
          <KindSwitch kind={kind} onChange={setKind} />
          <HeroSelect value={hero} onChange={setHero} label="Hero untuk diadu" anyLabel={kind === 'build' ? 'Hero acak' : 'Semua hero'} />
        </div>
        <p className="small">
          <a className="link" href={hashFor('community')}>
            Lihat peringkat di Jelajah → Juara adu
          </a>
          {count > 0 && <span className="muted"> · {count} suara dari kamu sesi ini</span>}
        </p>
      </section>

      {state.status === 'loading' ? (
        <p className="empty" role="status">
          Memuat…
        </p>
      ) : !loggedIn ? (
        <section className="panel">
          <p>Masuk dengan Google untuk ikut mengadu.</p>
          <button type="button" className="btn primary" onClick={() => requireLogin('Masuk dengan Google untuk ikut adu.')}>
            Masuk
          </button>
        </section>
      ) : phase === 'loading' ? (
        <p className="empty" role="status">
          Mencari lawan yang pas…
        </p>
      ) : phase === 'error' ? (
        <section className="panel" role="alert">
          <p className="cm-err">{err}</p>
          <button type="button" className="btn" onClick={() => void next()}>
            Coba lagi
          </button>
        </section>
      ) : phase === 'empty' || !pair ? (
        <p className="empty">
          Belum ada pasangan yang bisa diadu. Untuk build perlu minimal dua build dari hero yang sama dan bukan milikmu; untuk komposisi, dua komposisi milik orang lain yang belum kamu pilih. Kalau
          komunitas baru mulai, ini wajar: ajak teman menerbitkan build.
        </p>
      ) : (
        <>
          <div className="cm-duel">
            <DuelSide label="A" post={pair[0]} picked={picked === pair[0].id} revealed={!!picked} busy={busy} onPick={() => void choose(pair[0])} />
            <div className="cm-vs" aria-hidden="true">
              VS
            </div>
            <DuelSide label="B" post={pair[1]} picked={picked === pair[1].id} revealed={!!picked} busy={busy} onPick={() => void choose(pair[1])} />
          </div>
          <div className="row center">
            {picked ? (
              <>
                <a className="btn small ghost" href={hashFor('community', { post: pair[0].id })}>
                  Buka A
                </a>
                <a className="btn small ghost" href={hashFor('community', { post: pair[1].id })}>
                  Buka B
                </a>
                <button type="button" className="btn primary" onClick={() => void next()}>
                  Adu berikutnya
                </button>
              </>
            ) : (
              <button type="button" className="btn ghost" onClick={() => void next()} disabled={busy}>
                Lewati
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

export function CommunityPage({ params }: { params: URLSearchParams }) {
  const { state } = useAuth();
  const postId = params.get('post');
  const v = params.get('view');
  const view: View = v === 'duel' ? 'duel' : v === 'saved' ? 'saved' : 'feed';

  // Tautan lama "Punyaku" kini ada di profil.
  useEffect(() => {
    if (v === 'mine') window.location.replace(`${window.location.pathname}${window.location.search}${hashFor('profile')}`);
  }, [v]);

  if (state.status === 'off') return <Setup />;
  return (
    <div className="page cm">
      <header className="page-head">
        <h1>Komunitas</h1>
        <p className="muted">Build dan komposisi dari pemain lain. Melihat dan menyalin tidak perlu akun; posting, suka, komentar, simpan, dan adu perlu login Google.</p>
      </header>
      {postId ? (
        <PostPage id={postId} />
      ) : (
        <>
          <SubNav view={view} />
          {view === 'duel' ? <Duel /> : view === 'saved' ? <Saved /> : <Feed initialHero={/^[a-z0-9-]{1,60}$/.test(params.get('hero') ?? '') ? params.get('hero')! : ''} />}
        </>
      )}
    </div>
  );
}
