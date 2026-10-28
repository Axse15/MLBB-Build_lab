import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { friendlyError } from '../lib/community';
import { hashFor } from '../route';
import { useToast } from './ui';

/** Tombol masuk / menu akun di topbar. Tidak tampil sama sekali kalau fitur komunitas mati. */
export function AccountMenu() {
  const { state, signIn, signOut, rename } = useAuth();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (state.status === 'off') return null;
  if (state.status === 'loading' || (state.status === 'in' && !state.named)) return <span className="acct-skel" aria-hidden="true" />;
  if (state.status === 'out') {
    return (
      <button type="button" className="btn small acct-login" onClick={() => void signIn()}>
        Masuk
      </button>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await rename(draft);
      setEditing(false);
      setOpen(false);
      notify('Nama tampilan diganti');
    } catch (e) {
      notify(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acct" ref={box}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="acct-dot" aria-hidden="true">
          {state.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="acct-name">{state.name}</span>
      </button>
      {open && (
        <div className="acct-pop" role="menu">
          {editing ? (
            <form
              className="acct-edit"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="field tight">
                <span>Nama tampilan (maks. 24)</span>
                <input className="input" value={draft} maxLength={24} autoFocus onChange={(e) => setDraft(e.target.value)} />
              </label>
              <div className="row end">
                <button type="button" className="btn small ghost" onClick={() => setEditing(false)}>
                  Batal
                </button>
                <button type="submit" className="btn small primary" disabled={busy || !draft.trim()}>
                  Simpan
                </button>
              </div>
            </form>
          ) : (
            <>
              <a role="menuitem" href={hashFor('community', { view: 'mine' })} onClick={() => setOpen(false)}>
                Tulisan saya
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDraft(state.name);
                  setEditing(true);
                }}
              >
                Ganti nama tampilan
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                Keluar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
