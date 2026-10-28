import { useMemo, useState, type CSSProperties } from 'react';
import { ROLE_COLOR } from '../data/heroes';
import { LANES, ROLES, type Hero, type Lane, type Role } from '../types';
import { HeroAvatar } from './ui';

export function HeroPicker({
  heroes,
  onPick,
  selectedId,
  initialLane,
}: {
  heroes: Hero[];
  onPick: (h: Hero) => void;
  selectedId?: string;
  initialLane?: Lane;
}) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);

  // Lane hero hanya perkiraan dari role, jadi lane slot tidak dipakai untuk menyembunyikan hero.
  // Hero yang cocok hanya diurutkan lebih dulu; filter lane tetap pilihan manual.
  const allLive = useMemo(() => heroes.every((h) => h.live || h.custom), [heroes]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = heroes.filter(
      (h) => (!role || h.roles.includes(role)) && (!lane || h.lanes.includes(lane)) && h.name.toLowerCase().includes(needle),
    );
    if (initialLane && !lane) {
      return [...out].sort((a, b) => Number(b.lanes.includes(initialLane)) - Number(a.lanes.includes(initialLane)));
    }
    return out;
  }, [heroes, q, role, lane, initialLane]);

  return (
    <div className="picker">
      <input
        className="input"
        type="search"
        placeholder="Cari hero"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Cari hero"
        autoFocus
      />
      <div className="chips" role="group" aria-label="Filter role">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            className={`chip${role === r ? ' on' : ''}`}
            style={{ ['--c' as string]: ROLE_COLOR[r] } as CSSProperties}
            aria-pressed={role === r}
            onClick={() => setRole(role === r ? null : r)}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Filter lane">
        {LANES.map((l) => (
          <button
            key={l}
            type="button"
            className={`chip plain${lane === l ? ' on' : ''}`}
            aria-pressed={lane === l}
            onClick={() => setLane(lane === l ? null : l)}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="muted small">
        {list.length} hero.
        {lane ? (allLive ? ' Lane dari data game.' : ' Lane sebagian hanya perkiraan dari role.') : ''}
        {initialLane && !lane ? ` Yang cocok dengan lane ${initialLane}${allLive ? '' : ' (sebagian perkiraan)'} tampil lebih dulu.` : ''}
      </p>
      <div className="hero-grid">
        {list.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`hero-btn${h.id === selectedId ? ' sel' : ''}`}
            onClick={() => onPick(h)}
            title={h.roles.join(' / ')}
          >
            <HeroAvatar hero={h} size={40} />
            <span className="hero-name">{h.name}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="empty">Tidak ada hero yang cocok. Longgarkan filter, atau tambahkan hero kustom.</p>}
    </div>
  );
}
