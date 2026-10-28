import { useState } from 'react';
import { lanesFromRoles } from '../data/heroes';
import { LANES, ROLES, type Hero, type Lane, type Role } from '../types';
import { Modal } from './ui';

/** Untuk hero yang belum ada di daftar bawaan (mis. hero yang baru rilis). */
export function AddHeroModal({ onAdd, onClose }: { onAdd: (h: Omit<Hero, 'id' | 'custom'>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);

  const toggleRole = (r: Role) => setRoles((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const toggleLane = (l: Lane) => setLanes((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  const canSave = name.trim().length > 0 && roles.length > 0;

  return (
    <Modal title="Tambah hero kustom" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onAdd({ name: name.trim().slice(0, 40), roles, lanes: lanes.length ? lanes : lanesFromRoles(roles) });
        }}
      >
        <label className="field">
          <span>Nama hero</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <fieldset className="field">
          <legend>Role (yang pertama dipilih jadi role utama)</legend>
          <div className="chips">
            {ROLES.map((r) => (
              <label key={r} className={`chip plain${roles.includes(r) ? ' on' : ''}`}>
                <input type="checkbox" className="sr" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Lane (opsional, default dari role)</legend>
          <div className="chips">
            {LANES.map((l) => (
              <label key={l} className={`chip plain${lanes.includes(l) ? ' on' : ''}`}>
                <input type="checkbox" className="sr" checked={lanes.includes(l)} onChange={() => toggleLane(l)} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row end">
          <button type="submit" className="btn primary" disabled={!canSave}>
            Tambah hero
          </button>
        </div>
      </form>
    </Modal>
  );
}
