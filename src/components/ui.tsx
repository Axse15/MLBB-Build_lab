import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ROLE_COLOR } from '../data/heroes';
import type { Issue, Level } from '../lib/analysis';
import { iconFor } from '../lib/live';
import { useLive } from '../live';
import type { Hero } from '../types';

export function initials(name: string): string {
  const parts = name.split(/[\s.\-']+/).filter((p) => p && p.toLowerCase() !== 'and');
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : name.replace(/[^a-zA-Z]/g, '').slice(0, 2);
  return s.toUpperCase();
}

/**
 * Gambar dari URL milik API (tidak disalin ke proyek). Gagal dimuat (diblokir, 404, offline)
 * atau tanpa URL = tampilkan `fallback`. Tanpa Referer supaya tidak membocorkan alamat app.
 */
export function Img({
  src,
  className,
  size,
  fallback = null,
}: {
  src?: string;
  className?: string;
  size?: number;
  fallback?: ReactNode;
}) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (!src || bad) return <>{fallback}</>;
  return (
    <img
      className={className}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBad(true)}
    />
  );
}

export function HeroAvatar({ hero, size = 44 }: { hero?: Hero; size?: number }) {
  const color = hero ? ROLE_COLOR[hero.roles[0]] : 'var(--line-2)';
  const style = { width: size, height: size, fontSize: size * 0.38, ['--c' as string]: color } as CSSProperties;
  const text = hero ? initials(hero.name) : '?';
  return (
    <span className="avatar" style={style} aria-hidden="true">
      <Img src={hero?.img} className="avatar-img" fallback={text} />
    </span>
  );
}

/** Ikon item, battle spell, atau talent dari API. Tidak ada yang cocok = tidak menampilkan apa pun. */
export function Icon({ kind, name, size = 32, className }: { kind: 'items' | 'spells' | 'talents'; name: string; size?: number; className?: string }) {
  const { icons } = useLive();
  const src = iconFor(icons[kind], name);
  return <Img src={src} size={size} className={`ico${className ? ` ${className}` : ''}`} />;
}

export function TeamLogo({ src, size = 26 }: { src?: string; size?: number }) {
  // Logo gagal dimuat/kosong: sisakan ruang yang sama supaya nama tim tetap sejajar.
  return <Img src={src} size={size} className="team-logo" fallback={<span className="team-logo ph" style={{ width: size, height: size }} aria-hidden="true" />} />;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', on);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Tutup
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const notify = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={notify}>
      {children}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function ShareDialog({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const notify = useToast();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.select();
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify('Tautan disalin');
    } catch {
      ref.current?.select();
      notify('Tautan sudah dipilih. Tekan Ctrl/Cmd+C untuk menyalin.');
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">Siapa pun yang membuka tautan ini akan melihat salinan datanya. Tidak ada yang disimpan di server.</p>
      <input ref={ref} className="input mono" readOnly value={url} aria-label="Tautan bagikan" onFocus={(e) => e.currentTarget.select()} />
      <div className="row end">
        <button type="button" className="btn primary" onClick={copy}>
          Salin tautan
        </button>
      </div>
    </Modal>
  );
}

const SR: Record<Level, string> = { error: 'Masalah', warn: 'Perhatian', info: 'Catatan', ok: 'Baik' };
const ICON: Record<Level, string> = { error: '!', warn: '!', info: 'i', ok: '✓' };

export function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="issues">
      {issues.map((i, k) => (
        <li key={k} className={`issue ${i.level}`}>
          <span className="ico" aria-hidden="true">
            {ICON[i.level]}
          </span>
          <span>
            <span className="sr">{SR[i.level]}: </span>
            {i.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
