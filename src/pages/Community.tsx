import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { PostBody, PostNote, useDecoded } from '../components/PostBody';
import { Modal, useToast } from '../components/ui';
import {
  PAGE,
  REPORT_REASONS,
  addComment,
  ago,
  deleteComment,
  deletePost,
  friendlyError,
  getPost,
  getPosts,
  likedIds,
  listComments,
  listPosts,
  nextDuel,
  report,
  setLike,
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

type View = 'feed' | 'duel' | 'mine';

const KIND_LABEL: Record<PostKind, string> = { build: 'Build', team: 'Komposisi' };
const SORTS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'baru', label: 'Terbaru', hint: 'Urut waktu terbit' },
  { id: 'populer', label: 'Terpopuler', hint: 'Paling banyak disukai' },
  { id: 'adu', label: 'Juara adu', hint: `Peringkat menang di Adu (minimal ${MIN_DUELS_FOR_RANK} duel)` },
];

/** Tautan ke tulisan yang bisa dibagikan. */
const postLink = (id: string): string => `${window.location.origin}${window.location.pathname}${hashFor('community', { post: id })}`;

function useLikes() {
  const { db, state, requireLogin } = useAuth();
  const notify = useToast();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const userId = state.status === 'in' ? state.userId : null;

  useEffect(() => {
    if (!userId) setLiked(new Set());
  }, [userId]);

  const load = useCallback(
    async (ids: string[]) => {
      if (!db || !userId || ids.length === 0) return;
      try {
        const s = await likedIds(db, ids);
        setLiked((prev) => new Set([...prev, ...s]));
      } catch {
        /* status like gagal dimuat: tombol tetap bisa dipakai */
      }
    },
    [db, userId],
  );

  const toggle = useCallback(
    async (id: string, bump: (delta: number) => void) => {
      if (!requireLogin('Masuk dengan Google untuk menyukai tulisan.')) return;
      if (!db || !userId) return;
      const was = liked.has(id);
      const apply = (on: boolean) => {
        setLiked((prev) => {
          const n = new Set(prev);
          if (on) n.add(id);
          else n.delete(id);
          return n;
        });
        bump(on ? 1 : -1);
      };
      apply(!was);
      try {
        await setLike(db, id, userId, !was);
      } catch (e) {
        apply(was);
        notify(friendlyError(e));
      }
    },
    [db, liked, notify, requireLogin, userId],
  );

  return { liked, load, toggle };
}

function Setup() {
  const { state } = useAuth();
  const reason = state.status === 'off' ? OFF_TEXT[state.reason] : '';
  return (
    <div className="page">
      <header className="page-head">
        <h1>Komunitas</h1>
        <p className="muted">Jelajahi build dan komposisi pemain lain, beri like, komentar, dan adu.</p>
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
    { id: 'mine', label: 'Punyaku' },
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

function Author({ post }: { post: Pick<Post, 'author' | 'createdAt'> }) {
  return (
    <span className="muted small">
      {post.author} · {ago(post.createdAt)}
    </span>
  );
}

function LikeButton({ count, on, onClick }: { count: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`cm-like${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? `Batal suka, ${count} suka` : `Suka, ${count} suka`} onClick={onClick}>
      <span aria-hidden="true">{on ? '♥' : '♡'}</span> {count}
    </button>
  );
}

function UseButton({ post }: { post: Post }) {
  const d = useDecoded(post);
  const page = post.kind === 'build' ? 'builder' : 'team';
  if (!d) return null;
  return (
    <a className="btn small" href={hashFor(page, { s: post.payload })} title="Memuat ke editor dan menggantikan draft yang sedang terbuka">
      {post.kind === 'build' ? 'Pakai build ini' : 'Pakai komposisi ini'}
    </a>
  );
}

function PostCard({ post, liked, onLike, mine, onDelete }: { post: Post; liked: boolean; onLike: () => void; mine: boolean; onDelete?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const rate = winRate(post);
  return (
    <li className="card cm-card">
      <div className="cm-card-head">
        <div className="grow">
          <a className="cm-title" href={hashFor('community', { post: post.id })}>
            {post.title}
          </a>
          <div>
            <Author post={post} />
            {post.hidden && <span className="tag static warn"> disembunyikan (laporan)</span>}
          </div>
        </div>
        {rate !== null && post.duelPlayed >= MIN_DUELS_FOR_RANK && (
          <span className="tag static" title={`${rate}% menang di Adu`}>
            {post.duelWins}/{post.duelPlayed} menang
          </span>
        )}
      </div>
      <PostBody post={post} compact />
      <PostNote post={post} clamp />
      <div className="cm-card-foot">
        <LikeButton count={post.likes} on={liked} onClick={onLike} />
        <a className="cm-cmt" href={hashFor('community', { post: post.id })}>
          💬 {post.comments}
        </a>
        <span className="grow" />
        <UseButton post={post} />
        {mine && onDelete && (
          <button
            type="button"
            className={`btn small ${confirm ? 'danger' : 'ghost'}`}
            onClick={() => {
              if (confirm) onDelete();
              else {
                setConfirm(true);
                window.setTimeout(() => setConfirm(false), 3000);
              }
            }}
          >
            {confirm ? 'Yakin hapus?' : 'Hapus'}
          </button>
        )}
      </div>
    </li>
  );
}

function Feed({ mine }: { mine: boolean }) {
  const { db, state, requireLogin } = useAuth();
  const { heroes } = useStore();
  const notify = useToast();
  const likes = useLikes();
  const userId = state.status === 'in' ? state.userId : undefined;

  const [kind, setKind] = useState<PostKind>('build');
  const [sort, setSort] = useState<SortKey>('baru');
  const [hero, setHero] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [more, setMore] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [busyMore, setBusyMore] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput), 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const needLogin = mine && state.status === 'out';
  const waiting = mine && state.status === 'loading';

  const load = useCallback(
    async (offset: number) => {
      if (!db || (mine && !userId)) return;
      const my = ++seq.current;
      try {
        const res = await listPosts(db, { kind, hero: hero || undefined, q, sort, userId: mine ? userId : undefined, offset });
        if (my !== seq.current) return;
        setPosts((prev) => (offset === 0 ? res.posts : [...prev, ...res.posts.filter((p) => !prev.some((x) => x.id === p.id))]));
        setMore(res.more);
        setPhase('ready');
        void likes.load(res.posts.map((p) => p.id));
      } catch (e) {
        if (my !== seq.current) return;
        setErr(friendlyError(e));
        setPhase('error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, kind, hero, q, sort, mine, userId, likes.load],
  );

  useEffect(() => {
    setPhase('loading');
    setPosts([]);
    setMore(false);
    void load(0);
  }, [load]);

  const remove = async (p: Post) => {
    if (!db) return;
    try {
      await deletePost(db, p.id);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      notify('Tulisan dihapus');
    } catch (e) {
      notify(friendlyError(e));
    }
  };

  const loadMore = async () => {
    setBusyMore(true);
    await load(posts.length);
    setBusyMore(false);
  };

  return (
    <>
      <div className="panel cm-filters">
        <div className="chips" role="group" aria-label="Jenis">
          {(['build', 'team'] as PostKind[]).map((k) => (
            <button key={k} type="button" className={`chip plain${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Urutan">
          {SORTS.map((s) => (
            <button key={s.id} type="button" title={s.hint} className={`chip plain${sort === s.id ? ' on' : ''}`} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="cm-filter-row">
          <select className="input" value={hero} onChange={(e) => setHero(e.target.value)} aria-label="Filter hero">
            <option value="">Semua hero</option>
            {heroes.filter((h) => !h.custom).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input className="input" type="search" value={qInput} maxLength={40} placeholder="Cari judul atau catatan" aria-label="Cari" onChange={(e) => setQInput(e.target.value)} />
        </div>
      </div>

      {needLogin ? (
        <section className="panel">
          <p>Masuk untuk melihat tulisanmu sendiri.</p>
          <button type="button" className="btn primary" onClick={() => requireLogin('Masuk dengan Google untuk melihat tulisanmu.')}>
            Masuk
          </button>
        </section>
      ) : waiting || phase === 'loading' ? (
        <p className="empty" role="status">
          Memuat…
        </p>
      ) : phase === 'error' ? (
        <section className="panel" role="alert">
          <p className="cm-err">{err}</p>
          <button type="button" className="btn" onClick={() => void load(0)}>
            Coba lagi
          </button>
        </section>
      ) : posts.length === 0 ? (
        <p className="empty">
          {q || hero || sort === 'adu'
            ? sort === 'adu' && !q && !hero
              ? `Belum ada ${KIND_LABEL[kind].toLowerCase()} dengan ${MIN_DUELS_FOR_RANK} duel atau lebih.`
              : 'Tidak ada yang cocok dengan filter ini.'
            : mine
              ? `Kamu belum menerbitkan ${KIND_LABEL[kind].toLowerCase()}. Buka tab ${kind === 'build' ? 'Build hero' : 'Komposisi tim'} lalu tekan “Bagikan ke komunitas”.`
              : `Belum ada ${KIND_LABEL[kind].toLowerCase()} di komunitas. Jadilah yang pertama: tekan “Bagikan ke komunitas” di tab ${kind === 'build' ? 'Build hero' : 'Komposisi tim'}.`}
        </p>
      ) : (
        <>
          <ul className="cards cm-cards">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                liked={likes.liked.has(p.id)}
                onLike={() => void likes.toggle(p.id, (d) => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + d) } : x))))}
                mine={!!userId && p.userId === userId}
                onDelete={() => void remove(p)}
              />
            ))}
          </ul>
          {more && (
            <div className="row center">
              <button type="button" className="btn" disabled={busyMore} onClick={() => void loadMore()}>
                {busyMore ? 'Memuat…' : `Muat ${PAGE} lagi`}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
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
        setComments(await listComments(db, id));
      }
    } catch (e) {
      setErr(friendlyError(e));
      setPost(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id, likes.load]);

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

  if (post === undefined) {
    return (
      <p className="empty" role="status">
        Memuat…
      </p>
    );
  }
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
          <span className="grow" />
          <UseButton post={post} />
          <button type="button" className="btn small" onClick={() => void copy()}>
            Salin tautan
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
          {post.author} · {rate === null ? 'belum ada duel' : `${rate}% menang dari ${post.duelPlayed} duel`}
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
  const { heroes } = useStore();
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
          <div className="chips" role="group" aria-label="Jenis">
            {(['build', 'team'] as PostKind[]).map((k) => (
              <button key={k} type="button" className={`chip plain${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <select className="input" value={hero} onChange={(e) => setHero(e.target.value)} aria-label="Hero untuk diadu">
            <option value="">{kind === 'build' ? 'Hero acak' : 'Semua hero'}</option>
            {heroes.filter((h) => !h.custom).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
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
  const view: View = params.get('view') === 'duel' ? 'duel' : params.get('view') === 'mine' ? 'mine' : 'feed';

  if (state.status === 'off') return <Setup />;
  return (
    <div className="page cm">
      <header className="page-head">
        <h1>Komunitas</h1>
        <p className="muted">Build dan komposisi dari pemain lain. Melihat dan menyalin tidak perlu akun; posting, like, komentar, dan adu perlu login Google.</p>
      </header>
      {postId ? (
        <PostPage id={postId} />
      ) : (
        <>
          <SubNav view={view} />
          {view === 'duel' ? <Duel /> : <Feed key={view} mine={view === 'mine'} />}
        </>
      )}
    </div>
  );
}
