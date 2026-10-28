import { useEffect } from 'react';
import { AuthProvider } from './auth';
import { AccountMenu } from './components/AccountMenu';
import { DataStatus } from './components/DataStatus';
import { ToastProvider } from './components/ui';
import { LiveProvider } from './live';
import { BuilderPage } from './pages/Builder';
import { CommunityPage } from './pages/Community';
import { MplPage } from './pages/Mpl';
import { PatchPage } from './pages/Patch';
import { TeamPage } from './pages/Team';
import { useRoute, type Page } from './route';
import { StoreProvider } from './store';

const TABS: { page: Page; label: string }[] = [
  { page: 'builder', label: 'Build hero' },
  { page: 'team', label: 'Komposisi tim' },
  { page: 'community', label: 'Komunitas' },
  { page: 'patch', label: 'Update patch' },
  { page: 'mpl', label: 'Jadwal MPL ID' },
];

export default function App() {
  const route = useRoute();
  // Di layar sempit tab bisa tergulir; pastikan tab aktif terlihat.
  useEffect(() => {
    document.querySelector('.tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [route.page]);
  return (
    <LiveProvider>
    <StoreProvider>
      <ToastProvider>
      <AuthProvider>
        <header className="topbar-wrap">
          <div className="topbar">
            <a className="brand" href="#/builder" aria-label="MLBB Build Lab, ke halaman Build hero">
              <span className="brand-mark" aria-hidden="true" />
              MLBB Build Lab
            </a>
            <nav className="tabs" aria-label="Halaman">
              {TABS.map((t) => (
                <a key={t.page} className={`tab${route.page === t.page ? ' on' : ''}`} href={`#/${t.page}`} aria-current={route.page === t.page ? 'page' : undefined}>
                  {t.label}
                </a>
              ))}
            </nav>
            <AccountMenu />
          </div>
        </header>
        <div className="shell">
          <main>
            {route.page === 'builder' && <BuilderPage params={route.params} />}
            {route.page === 'team' && <TeamPage params={route.params} />}
            {route.page === 'community' && <CommunityPage params={route.params} />}
            {route.page === 'patch' && <PatchPage params={route.params} />}
            {route.page === 'mpl' && <MplPage />}
          </main>

          <footer className="footer">
            <DataStatus />
            <p>
              Proyek fan, tidak berafiliasi dengan Moonton. Data hero, item, emblem, battle spell, dan catatan patch dikompilasi dari MLBBHub (patch 2.2.16a) dan Liquipedia (CC BY-SA 3.0). Daftar hero, role, lane, jadwal MPL, dan versi game diambil langsung dari {' '}
              <a href="https://arena.rone.dev" target="_blank" rel="noreferrer">Rone Arena API</a> (komunitas, tidak resmi; dikelola ridwaanhall/RoneAI, data milik Moonton). Mobile Legends: Bang Bang adalah merek dagang pemiliknya. Gambar hero, item, battle spell, talent, dan logo tim dimuat langsung dari URL yang dikirim API dan bukan bagian dari proyek ini; hak ciptanya milik Moonton dan MPL ID.
            </p>
          </footer>
        </div>
      </AuthProvider>
      </ToastProvider>
    </StoreProvider>
    </LiveProvider>
  );
}
