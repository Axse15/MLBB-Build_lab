import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth';
import { navItems } from '../nav';
import { hashFor } from '../route';
import { useStore } from '../store';
import { useTheme } from '../lib/theme';
import { Glyph, type GlyphName } from './Glyph';

type Group = 'Aksi' | 'Halaman' | 'Build saya' | 'Komposisi saya' | 'Hero';
const ORDER: Group[] = ['Aksi', 'Halaman', 'Build saya', 'Komposisi saya', 'Hero'];

export interface Cmd {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: GlyphName;
  keywords?: string;
  run: () => void;
}

/** Saring dan urutkan perintah. Setiap kata pencarian harus ada di label, petunjuk, atau kata kunci. Urutan: kelompok, lalu kecocokan label. */
export function filterCommands(cmds: Cmd[], query: string, limit = 40): Cmd[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const scored: { c: Cmd; score: number; i: number }[] = [];
  cmds.forEach((c, i) => {
    const label = c.label.toLowerCase();
    const hay = `${label} ${(c.hint ?? '').toLowerCase()} ${(c.keywords ?? '').toLowerCase()}`;
    if (!tokens.every((t) => hay.includes(t))) return;
    const score = tokens.reduce((n, t) => n + (label.startsWith(t) ? 3 : label.includes(` ${t}`) ? 2 : label.includes(t) ? 1 : 0), 0);
    scored.push({ c, score, i });
  });
  return scored
    .sort((a, b) => ORDER.indexOf(a.c.group) - ORDER.indexOf(b.c.group) || b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}

const go = (href: string) => {
  window.location.hash = href;
};

const Ctx = createContext<{ show: () => void }>({ show: () => undefined });
export const usePalette = () => useContext(Ctx);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {open && <Palette onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

function useCommands(close: () => void): Cmd[] {
  const { heroes, builds, teams, heroById } = useStore();
  const { state, signIn, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const communityOn = state.status !== 'off';
  const loggedIn = state.status === 'in';

  return useMemo(() => {
    const run = (fn: () => void) => () => {
      close();
      fn();
    };
    const cmds: Cmd[] = [
      { id: 'a-build', group: 'Aksi', label: 'Build baru', hint: 'Mulai dari kosong', icon: 'plus', keywords: 'buat tambah', run: run(() => go(hashFor('builder', { new: '1' }))) },
      { id: 'a-team', group: 'Aksi', label: 'Komposisi baru', hint: 'Isi lima lane', icon: 'plus', keywords: 'buat tambah tim', run: run(() => go(hashFor('team', { new: '1' }))) },
      {
        id: 'a-theme',
        group: 'Aksi',
        label: theme === 'dark' ? 'Pakai tema terang' : 'Pakai tema gelap',
        hint: 'Ganti tampilan',
        icon: theme === 'dark' ? 'sun' : 'moon',
        keywords: 'tema mode gelap terang dark light',
        run: run(toggle),
      },
    ];
    if (communityOn) {
      cmds.push(
        loggedIn
          ? { id: 'a-out', group: 'Aksi', label: 'Keluar', hint: 'Akhiri sesi di perangkat ini', icon: 'logout', keywords: 'logout sign out', run: run(() => void signOut()) }
          : { id: 'a-in', group: 'Aksi', label: 'Masuk dengan Google', hint: 'Untuk posting, suka, komentar, dan adu', icon: 'user', keywords: 'login sign in', run: run(() => void signIn()) },
      );
    }
    for (const n of navItems(communityOn)) cmds.push({ id: `p-${n.id}`, group: 'Halaman', label: n.label, hint: n.group, icon: n.icon, run: run(() => go(n.href)) });
    if (loggedIn) cmds.push({ id: 'p-profile', group: 'Halaman', label: 'Profil saya', icon: 'user', run: run(() => go(hashFor('profile'))) });
    cmds.push({ id: 'p-settings', group: 'Halaman', label: 'Pengaturan', hint: 'Tema, cadangan data, sumber data', icon: 'settings', keywords: 'backup ekspor impor', run: run(() => go(hashFor('settings'))) });
    for (const b of builds) {
      const h = heroById(b.heroId);
      cmds.push({ id: `b-${b.id}`, group: 'Build saya', label: b.name || 'Build tanpa nama', hint: h?.name ?? 'Hero dihapus', icon: 'build', keywords: h?.roles.join(' '), run: run(() => go(hashFor('builder', { edit: b.id }))) });
    }
    for (const t of teams) cmds.push({ id: `t-${t.id}`, group: 'Komposisi saya', label: t.name || 'Komposisi tanpa nama', icon: 'team', run: run(() => go(hashFor('team', { load: t.id }))) });
    for (const h of heroes) {
      cmds.push({ id: `h-${h.id}`, group: 'Hero', label: h.name, hint: `Buat build · ${h.roles.join(' / ')}`, icon: 'build', keywords: `${h.roles.join(' ')} ${h.lanes.join(' ')}`, run: run(() => go(hashFor('builder', { hero: h.id }))) });
    }
    return cmds;
  }, [builds, close, communityOn, heroById, heroes, loggedIn, signIn, signOut, teams, theme, toggle]);
}

function Palette({ onClose }: { onClose: () => void }) {
  const cmds = useCommands(onClose);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    if (q.trim()) return filterCommands(cmds, q);
    // Tanpa kata pencarian: aksi, halaman, dan beberapa build terakhir. Hero baru muncul setelah mengetik.
    const recent = cmds.filter((c) => c.group === 'Build saya').slice(0, 4);
    return [...cmds.filter((c) => c.group === 'Aksi'), ...cmds.filter((c) => c.group === 'Halaman'), ...recent];
  }, [cmds, q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => prev?.focus?.();
  }, []);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx, shown]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => (shown.length ? (i + 1) % shown.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => (shown.length ? (i - 1 + shown.length) % shown.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      shown[idx]?.run();
    }
  };

  let lastGroup = '';
  return (
    <div
      className="cp-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cp" role="dialog" aria-modal="true" aria-label="Pencarian cepat" onKeyDown={onKey}>
        <div className="cp-input">
          <Glyph name="search" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari hero, build, halaman, atau aksi"
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-list"
            aria-activedescendant={shown[idx] ? `cp-${shown[idx].id}` : undefined}
            aria-label="Cari"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="kbd">Esc</span>
        </div>
        {shown.length === 0 ? (
          <p className="cp-empty">Tidak ada yang cocok dengan “{q}”.</p>
        ) : (
          <ul className="cp-list" id="cp-list" role="listbox" ref={list}>
            {shown.map((c, i) => {
              const head = c.group !== lastGroup;
              lastGroup = c.group;
              return (
                <li key={c.id} role="presentation">
                  {head && <div className="cp-group">{c.group}</div>}
                  <button type="button" id={`cp-${c.id}`} role="option" aria-selected={i === idx} className="cp-item" onMouseMove={() => setIdx(i)} onClick={c.run}>
                    <Glyph name={c.icon} />
                    <span className="grow">{c.label}</span>
                    {c.hint && <span className="muted small">{c.hint}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="cp-foot">
          <span>↑↓ pilih</span>
          <span>Enter buka</span>
          <span>Esc tutup</span>
        </div>
      </div>
    </div>
  );
}
