import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth';
import { PAGE, deletePost, friendlyError, type Post } from '../lib/community';
import { PostCard, useBookmarks, useLikes } from './PostCard';
import { useToast } from './ui';

export function PostSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div role="status" aria-label="Memuat">
      <ul className="cards cm-cards" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <li key={i} className="card cm-card">
            <span className="skel" style={{ width: '62%', height: 18 }} />
            <span className="skel" style={{ width: '36%' }} />
            <span className="skel" style={{ height: 40 }} />
            <span className="skel" style={{ width: '80%' }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Daftar tulisan berhalaman dengan suka, simpan, hapus (milik sendiri), dan "muat lagi".
 * `load` mengambil satu halaman; `resetKey` berubah = mulai ulang dari awal.
 */
export function PagedPosts({
  load,
  resetKey,
  empty,
  removeOnUnsave,
  onDeleted,
}: {
  load: (offset: number) => Promise<{ posts: Post[]; more: boolean }>;
  resetKey: string;
  empty: ReactNode;
  /** true = tulisan hilang dari daftar begitu simpanannya dilepas (halaman Disimpan). */
  removeOnUnsave?: boolean;
  onDeleted?: () => void;
}) {
  const { db, state } = useAuth();
  const notify = useToast();
  const userId = state.status === 'in' ? state.userId : undefined;
  const likes = useLikes();
  const bm = useBookmarks((id, on) => {
    if (removeOnUnsave && !on) setPosts((ps) => ps.filter((p) => p.id !== id));
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [more, setMore] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [busyMore, setBusyMore] = useState(false);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const fetchPage = useCallback(
    async (offset: number) => {
      const my = ++seq.current;
      try {
        const res = await loadRef.current(offset);
        if (my !== seq.current) return;
        setPosts((prev) => (offset === 0 ? res.posts : [...prev, ...res.posts.filter((p) => !prev.some((x) => x.id === p.id))]));
        setMore(res.more);
        setPhase('ready');
        const ids = res.posts.map((p) => p.id);
        void likes.load(ids);
        void bm.load(ids);
      } catch (e) {
        if (my !== seq.current) return;
        setErr(friendlyError(e));
        setPhase('error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [likes.load, bm.load],
  );

  useEffect(() => {
    setPhase('loading');
    setPosts([]);
    setMore(false);
    void fetchPage(0);
  }, [resetKey, fetchPage]);

  const remove = async (p: Post) => {
    if (!db) return;
    try {
      await deletePost(db, p.id);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      notify('Tulisan dihapus');
      onDeleted?.();
    } catch (e) {
      notify(friendlyError(e));
    }
  };

  const loadMore = async () => {
    setBusyMore(true);
    await fetchPage(posts.length);
    setBusyMore(false);
  };

  if (phase === 'loading') return <PostSkeleton />;
  if (phase === 'error') {
    return (
      <section className="panel" role="alert">
        <p className="cm-err">{err}</p>
        <div>
          <button type="button" className="btn" onClick={() => void fetchPage(0)}>
            Coba lagi
          </button>
        </div>
      </section>
    );
  }
  if (posts.length === 0) return <div className="empty">{empty}</div>;
  return (
    <>
      <ul className="cards cm-cards">
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            liked={likes.liked.has(p.id)}
            onLike={() => void likes.toggle(p.id, (d) => setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + d) } : x))))}
            saved={bm.saved.has(p.id)}
            onSave={() => void bm.toggle(p.id)}
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
  );
}
