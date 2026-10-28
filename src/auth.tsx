import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, useToast } from './components/ui';
import { ensureProfile, friendlyError, myProfileName, renameMe } from './lib/community';
import type { CommunityOff } from './lib/config';
import { config, supabase } from './lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthState =
  | { status: 'off'; reason: CommunityOff }
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; userId: string; name: string; /** false = nama tampilan masih dimuat. */ named: boolean };

interface Auth {
  state: AuthState;
  /** Klien Supabase; null kalau fitur komunitas mati. */
  db: SupabaseClient | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  /** true = sudah masuk. Kalau belum, membuka dialog login dengan alasan `why` dan mengembalikan false. */
  requireLogin: (why: string) => boolean;
}

const RETURN_KEY = 'mbl:authReturn';
const Ctx = createContext<Auth | null>(null);

const safe = <T,>(fn: () => T): T | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [name, setName] = useState('Pemain');
  const [nameFor, setNameFor] = useState<string | null>(null);
  const [loginWhy, setLoginWhy] = useState<string | null>(null);

  // Sesi: pulihkan dari penyimpanan, tangani kembalinya dari Google (?code=… ditukar otomatis oleh supabase-js).
  useEffect(() => {
    if (!supabase) return;
    const url = new URL(window.location.href);
    const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error');
    if (failure) {
      notifyRef.current(`Login gagal: ${failure}`);
      safe(() => window.history.replaceState(null, '', `${url.pathname}${safe(() => localStorage.getItem(RETURN_KEY)) ?? url.hash}`));
      safe(() => localStorage.removeItem(RETURN_KEY));
    }
    let alive = true;
    const restoreRoute = () => {
      const back = safe(() => localStorage.getItem(RETURN_KEY));
      if (!back) return;
      safe(() => localStorage.removeItem(RETURN_KEY));
      // Tanda ?code= bisa tertinggal di URL; buang, lalu kembali ke halaman semula.
      safe(() => window.history.replaceState(null, '', `${window.location.pathname}${back.startsWith('#/') ? back : '#/community'}`));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUserId(data.session?.user.id ?? null);
      setReady(true);
      if (data.session) restoreRoute();
    }).catch(() => alive && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Jangan memanggil API Supabase di sini (bisa buntu); cukup catat id, sisanya di effect lain.
      setUserId(session?.user.id ?? null);
      setReady(true);
      if (event === 'SIGNED_IN') window.setTimeout(restoreRoute, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Profil (nama tampilan) untuk pengguna yang sedang masuk.
  useEffect(() => {
    if (!supabase || !userId) return;
    const db = supabase;
    let alive = true;
    (async () => {
      try {
        let n = await myProfileName(db, userId);
        if (!n) {
          await ensureProfile(db);
          n = await myProfileName(db, userId);
        }
        if (alive) {
          setName(n ?? 'Pemain');
          setNameFor(userId);
        }
      } catch (e) {
        if (alive) {
          setNameFor(userId);
          notifyRef.current(friendlyError(e));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    if (window.location.protocol === 'file:') {
      notifyRef.current('Login Google tidak bisa dari berkas lokal. Buka lewat situs yang sudah di-deploy atau http://localhost.');
      return;
    }
    safe(() => localStorage.setItem(RETURN_KEY, window.location.hash || '#/community'));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}`, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      safe(() => localStorage.removeItem(RETURN_KEY));
      notifyRef.current(`Login gagal: ${error.message}`);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) notifyRef.current(`Keluar gagal: ${error.message}`);
    setUserId(null);
  }, []);

  const rename = useCallback(
    async (n: string) => {
      if (!supabase || !userId) return;
      setName(await renameMe(supabase, userId, n));
    },
    [userId],
  );

  const state: AuthState = useMemo(() => {
    if (!config.ok) return { status: 'off', reason: config.reason };
    if (!ready) return { status: 'loading' };
    if (!userId) return { status: 'out' };
    return { status: 'in', userId, name: nameFor === userId ? name : 'Pemain', named: nameFor === userId };
  }, [ready, userId, name, nameFor]);

  const requireLogin = useCallback(
    (why: string): boolean => {
      if (state.status === 'in') return true;
      if (state.status === 'out') setLoginWhy(why);
      return false;
    },
    [state.status],
  );

  const value = useMemo<Auth>(() => ({ state, db: supabase, signIn, signOut, rename, requireLogin }), [state, signIn, signOut, rename, requireLogin]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {loginWhy && (
        <Modal title="Masuk dulu" onClose={() => setLoginWhy(null)}>
          <p>{loginWhy}</p>
          <p className="muted small">
            Melihat dan menyalin build orang lain tidak perlu akun. Login hanya untuk memposting, menyukai, berkomentar, dan ikut adu. Yang tampil ke orang lain
            hanya kata pertama nama Googlemu (bisa kamu ganti), bukan email.
          </p>
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setLoginWhy(null)}>
              Nanti
            </button>
            <button type="button" className="btn primary" onClick={() => void signIn()}>
              Masuk dengan Google
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return a;
}
