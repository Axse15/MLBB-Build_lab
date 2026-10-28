import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { avatarHue } from '../lib/util';
import { hashFor } from '../route';
import { Glyph } from './Glyph';

/** Menutup popover saat klik di luar atau tekan Escape. `onDismiss` dipanggil hanya untuk dua cara menutup itu. */
export function usePopover(onDismiss?: () => void) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        dismiss.current?.();
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        dismiss.current?.();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return { open, setOpen, box };
}

export function UserAvatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return (
    <span className="uav" style={{ ['--s' as string]: `${size}px`, ['--h' as string]: avatarHue(id) }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Kartu akun di bawah sidebar. Tidak tampil sama sekali kalau fitur komunitas mati. */
export function AccountMenu() {
  const { state, signIn, signOut } = useAuth();
  const { open, setOpen, box } = usePopover();

  if (state.status === 'off') return null;
  if (state.status === 'loading' || (state.status === 'in' && !state.named)) return <span className="acct-skel" aria-hidden="true" />;
  if (state.status === 'out') {
    return (
      <button type="button" className="btn primary acct-login" onClick={() => void signIn()}>
        Masuk dengan Google
      </button>
    );
  }

  return (
    <div className="acct" ref={box}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <UserAvatar id={state.userId} name={state.name} />
        <span className="grow">
          <span className="acct-name" style={{ display: 'block' }}>
            {state.name}
          </span>
          <span className="acct-sub">Akun Google</span>
        </span>
      </button>
      {open && (
        <div className="pop acct-pop" role="menu">
          <a role="menuitem" className="pop-item" href={hashFor('profile')} onClick={() => setOpen(false)}>
            <Glyph name="user" /> Profil saya
          </a>
          <a role="menuitem" className="pop-item" href={hashFor('community', { view: 'saved' })} onClick={() => setOpen(false)}>
            <Glyph name="bookmark" /> Disimpan
          </a>
          <a role="menuitem" className="pop-item" href={hashFor('settings')} onClick={() => setOpen(false)}>
            <Glyph name="settings" /> Pengaturan
          </a>
          <div className="pop-sep" />
          <button
            type="button"
            role="menuitem"
            className="pop-item"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            <Glyph name="logout" /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
