import { Fragment, useState } from 'react';
import { useAuth } from '../auth';
import { navItems } from '../nav';
import { hashFor, type Route } from '../route';
import { useTheme } from '../lib/theme';
import { AccountMenu } from './AccountMenu';
import { ActivityBell } from './Activity';
import { usePalette } from './CommandPalette';
import { Glyph } from './Glyph';
import { Modal } from './ui';

export function Brand() {
  return (
    <a className="brand" href="#/dashboard" aria-label="MLBB Build Lab, ke Beranda">
      <span className="brand-mark" aria-hidden="true" />
      MLBB Build Lab
    </a>
  );
}

export function Rail({ route }: { route: Route }) {
  const { state } = useAuth();
  const items = navItems(state.status !== 'off');
  const groups = ['Studio', 'Komunitas', 'Info'] as const;
  return (
    <aside className="rail" aria-label="Navigasi utama">
      <Brand />
      <nav className="rail-nav">
        {groups.map((g) => (
          <Fragment key={g}>
            <div className="rail-group">{g}</div>
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <a key={i.id} className={`nav-link${i.active(route) ? ' on' : ''}`} href={i.href} aria-current={i.active(route) ? 'page' : undefined}>
                  <Glyph name={i.icon} />
                  {i.label}
                </a>
              ))}
          </Fragment>
        ))}
      </nav>
      <div className="rail-foot">
        <a className={`nav-link${route.page === 'settings' ? ' on' : ''}`} href={hashFor('settings')} aria-current={route.page === 'settings' ? 'page' : undefined}>
          <Glyph name="settings" />
          Pengaturan
        </a>
        <AccountMenu />
      </div>
    </aside>
  );
}

export function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Pakai tema terang' : 'Pakai tema gelap'} title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}>
      <Glyph name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function Topbar() {
  const { show } = usePalette();
  const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <Brand />
        <button type="button" className="search-btn" onClick={show} aria-label="Cari (Ctrl+K)">
          <Glyph name="search" />
          <span className="grow">Cari hero, build, halaman…</span>
          <span className="kbd" aria-hidden="true">
            {isMac ? '⌘ K' : 'Ctrl K'}
          </span>
        </button>
        <span className="tb-spacer" />
        <ThemeButton />
        <ActivityBell />
      </div>
    </div>
  );
}

/** Menu bawah di layar sempit. "Menu" membuka sisanya (patch, MPL, profil, pengaturan, akun). */
export function BottomNav({ route }: { route: Route }) {
  const { state, signIn, signOut } = useAuth();
  const [more, setMore] = useState(false);
  const items = navItems(state.status !== 'off');
  const main = ['dashboard', 'builder', 'team', 'community'].map((id) => items.find((i) => i.id === id)!);
  const moreOn = ['patch', 'mpl', 'profile', 'settings'].includes(route.page);
  const rest = items.filter((i) => !['dashboard', 'builder', 'team'].includes(i.id));
  return (
    <>
      <nav className="bottom-nav" aria-label="Navigasi utama">
        {main.map((i) => {
          const on = i.id === 'community' ? route.page === 'community' : i.active(route);
          return (
            <a key={i.id} className={`bn-link${on ? ' on' : ''}`} href={i.href} aria-current={on ? 'page' : undefined}>
              <Glyph name={i.icon} />
              {i.id === 'community' ? 'Komunitas' : i.id === 'builder' ? 'Build' : i.id === 'team' ? 'Tim' : i.label}
            </a>
          );
        })}
        <button type="button" className={`bn-link${moreOn ? ' on' : ''}`} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Glyph name="menu" />
          Menu
        </button>
      </nav>
      {more && (
        <Modal title="Menu" onClose={() => setMore(false)}>
          <ul className="rows">
            {rest
              .filter((i) => i.id !== 'community')
              .map((i) => (
                <li key={i.id}>
                  <a className="row-main" href={i.href} onClick={() => setMore(false)}>
                    <Glyph name={i.icon} />
                    <span className="row-title">{i.label}</span>
                  </a>
                </li>
              ))}
            {state.status === 'in' && (
              <li>
                <a className="row-main" href={hashFor('profile')} onClick={() => setMore(false)}>
                  <Glyph name="user" />
                  <span className="row-title">Profil saya</span>
                </a>
              </li>
            )}
            <li>
              <a className="row-main" href={hashFor('settings')} onClick={() => setMore(false)}>
                <Glyph name="settings" />
                <span className="row-title">Pengaturan</span>
              </a>
            </li>
            {state.status === 'out' && (
              <li>
                <button type="button" className="row-main link" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => void signIn()}>
                  <Glyph name="user" />
                  <span className="row-title">Masuk dengan Google</span>
                </button>
              </li>
            )}
            {state.status === 'in' && (
              <li>
                <button
                  type="button"
                  className="row-main link"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  onClick={() => {
                    setMore(false);
                    void signOut();
                  }}
                >
                  <Glyph name="logout" />
                  <span className="row-title">Keluar</span>
                </button>
              </li>
            )}
          </ul>
        </Modal>
      )}
    </>
  );
}
