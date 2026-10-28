import { useEffect } from 'react';
import { AuthProvider } from './auth';
import { ActivityProvider } from './components/Activity';
import { Attribution } from './components/Attribution';
import { PaletteProvider } from './components/CommandPalette';
import { DataStatus } from './components/DataStatus';
import { BottomNav, Rail, Topbar } from './components/Shell';
import { ToastProvider } from './components/ui';
import { LiveProvider } from './live';
import { BuilderPage } from './pages/Builder';
import { CommunityPage } from './pages/Community';
import { DashboardPage } from './pages/Dashboard';
import { MplPage } from './pages/Mpl';
import { PatchPage } from './pages/Patch';
import { ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';
import { TeamPage } from './pages/Team';
import { useRoute } from './route';
import { StoreProvider } from './store';

function Pages() {
  const route = useRoute();

  // Pindah halaman: mulai dari atas dan beri tahu pembaca layar.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.page]);

  return (
    <div className="app">
      <Rail route={route} />
      <div className="main">
        <Topbar />
        <main className="content" id="isi">
          {route.page === 'dashboard' && <DashboardPage />}
          {route.page === 'builder' && <BuilderPage params={route.params} />}
          {route.page === 'team' && <TeamPage params={route.params} />}
          {route.page === 'community' && <CommunityPage params={route.params} />}
          {route.page === 'patch' && <PatchPage params={route.params} />}
          {route.page === 'mpl' && <MplPage />}
          {route.page === 'profile' && <ProfilePage params={route.params} />}
          {route.page === 'settings' && <SettingsPage />}
          <footer className="footer">
            <details className="footer-status">
              <summary>Status sumber data</summary>
              <DataStatus />
            </details>
            <Attribution />
          </footer>
        </main>
      </div>
      <BottomNav route={route} />
    </div>
  );
}

export default function App() {
  return (
    <LiveProvider>
      <StoreProvider>
        <ToastProvider>
          <AuthProvider>
            <ActivityProvider>
              <PaletteProvider>
                <a className="skip" href="#isi">
                  Lompat ke isi
                </a>
                <Pages />
              </PaletteProvider>
            </ActivityProvider>
          </AuthProvider>
        </ToastProvider>
      </StoreProvider>
    </LiveProvider>
  );
}
