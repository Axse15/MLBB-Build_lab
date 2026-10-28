import type { GlyphName } from './components/Glyph';
import type { Route } from './route';

export interface NavItem {
  id: string;
  label: string;
  icon: GlyphName;
  href: string;
  group: 'Studio' | 'Komunitas' | 'Info';
  active: (r: Route) => boolean;
}

const view = (r: Route) => r.params.get('view');

/** Daftar menu. Kalau fitur komunitas mati, Komunitas hanya satu tautan (halamannya berisi petunjuk pemasangan). */
export function navItems(communityOn: boolean): NavItem[] {
  const items: NavItem[] = [
    { id: 'dashboard', label: 'Beranda', icon: 'home', href: '#/dashboard', group: 'Studio', active: (r) => r.page === 'dashboard' },
    { id: 'builder', label: 'Build hero', icon: 'build', href: '#/builder', group: 'Studio', active: (r) => r.page === 'builder' },
    { id: 'team', label: 'Komposisi tim', icon: 'team', href: '#/team', group: 'Studio', active: (r) => r.page === 'team' },
    { id: 'community', label: communityOn ? 'Jelajah' : 'Komunitas', icon: 'community', href: '#/community', group: 'Komunitas', active: (r) => r.page === 'community' && view(r) !== 'duel' && view(r) !== 'saved' },
  ];
  if (communityOn) {
    items.push(
      { id: 'duel', label: 'Adu', icon: 'duel', href: '#/community?view=duel', group: 'Komunitas', active: (r) => r.page === 'community' && view(r) === 'duel' },
      { id: 'saved', label: 'Disimpan', icon: 'bookmark', href: '#/community?view=saved', group: 'Komunitas', active: (r) => r.page === 'community' && view(r) === 'saved' },
    );
  }
  items.push(
    { id: 'patch', label: 'Update patch', icon: 'patch', href: '#/patch', group: 'Info', active: (r) => r.page === 'patch' },
    { id: 'mpl', label: 'Jadwal MPL ID', icon: 'trophy', href: '#/mpl', group: 'Info', active: (r) => r.page === 'mpl' },
  );
  return items;
}
