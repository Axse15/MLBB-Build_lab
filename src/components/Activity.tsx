import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth';
import { ago, listActivity, type Activity } from '../lib/community';
import { hashFor } from '../route';
import { usePopover } from './AccountMenu';
import { Glyph } from './Glyph';

interface Ctx {
  items: Activity[];
  /** Waktu terakhir daftar ini ditandai dibaca (ms). */
  seen: number;
  unread: number;
  loaded: boolean;
  markSeen: () => void;
  refresh: () => void;
}
const ActivityCtx = createContext<Ctx>({ items: [], seen: 0, unread: 0, loaded: false, markSeen: () => undefined, refresh: () => undefined });
export const useActivity = () => useContext(ActivityCtx);

const seenKey = (userId: string) => `mbl:activity-seen:${userId}`;
const readSeen = (userId: string): number => {
  try {
    const n = Number(localStorage.getItem(seenKey(userId)));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

/**
 * Komentar baru dari orang lain pada tulisanmu. Tidak ada tabel notifikasi terpisah: daftar ini dihitung dari
 * komentar yang ada, dan "sudah dibaca" hanya diingat di perangkat ini. Suka tidak ikut karena daftar penyuka
 * sengaja tidak bisa dibaca pemilik tulisan (privasi); jumlahnya tetap terlihat di profil.
 */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { db, state } = useAuth();
  const userId = state.status === 'in' ? state.userId : null;
  const [items, setItems] = useState<Activity[]>([]);
  const [seen, setSeen] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const last = useRef(0);

  const refresh = useCallback(() => {
    if (!db || !userId) return;
    last.current = Date.now();
    listActivity(db, userId)
      .then((a) => {
        setItems(a);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [db, userId]);

  useEffect(() => {
    setItems([]);
    setLoaded(false);
    if (!userId) return;
    setSeen(readSeen(userId));
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > 60_000) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(onVisible, 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [userId, refresh]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    const at = Math.max(Date.now(), ...items.map((i) => i.createdAt));
    setSeen(at);
    try {
      localStorage.setItem(seenKey(userId), String(at));
    } catch {
      /* penyimpanan diblokir: tanda hanya berlaku di sesi ini */
    }
  }, [items, userId]);

  const unread = useMemo(() => items.filter((i) => i.createdAt > seen).length, [items, seen]);
  const value = useMemo(() => ({ items, seen, unread, loaded, markSeen, refresh }), [items, seen, unread, loaded, markSeen, refresh]);
  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}

export function ActivityBell() {
  const { state } = useAuth();
  const { items, seen, unread, markSeen, refresh } = useActivity();
  const { open, setOpen, box } = usePopover(markSeen);
  if (state.status !== 'in') return null;

  // Penanda "baru" tetap terlihat selama daftar terbuka; tanda dibaca baru dipasang saat ditutup.
  const toggle = () => {
    if (open) markSeen();
    else refresh();
    setOpen(!open);
  };

  return (
    <div className="bell-wrap" ref={box}>
      <button type="button" className="icon-btn" aria-label={unread ? `Notifikasi, ${unread} baru` : 'Notifikasi'} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
        <Glyph name="bell" />
        {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="pop bell-pop" role="dialog" aria-label="Notifikasi">
          <div className="bell-head">
            <strong>Komentar baru</strong>
            <span className="muted small">pada tulisanmu</span>
          </div>
          {items.length === 0 ? (
            <p className="muted small" style={{ padding: '18px 14px' }}>
              Belum ada komentar dari orang lain. Terbitkan build atau komposisi ke komunitas, lalu komentar yang masuk muncul di sini.
            </p>
          ) : (
            <ul className="bell-list">
              {items.map((a) => (
                <li key={a.id}>
                  <a
                    className={`bell-item${a.createdAt > seen ? ' new' : ''}`}
                    href={hashFor('community', { post: a.postId })}
                    onClick={() => {
                      markSeen();
                      setOpen(false);
                    }}
                  >
                    <span className="small">
                      <strong>{a.author}</strong> mengomentari <strong>{a.postTitle}</strong>
                    </span>
                    <span className="bell-body">{a.body}</span>
                    <span className="muted small">{ago(a.createdAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
