import { useRef, useState } from 'react';
import { useAuth } from '../auth';
import { Attribution } from '../components/Attribution';
import { DataStatus } from '../components/DataStatus';
import { Glyph } from '../components/Glyph';
import { useToast } from '../components/ui';
import { MAX_BACKUP_BYTES, makeBackup, readBackup } from '../lib/backup';
import { useTheme } from '../lib/theme';
import { hashFor } from '../route';
import { useStore } from '../store';

type Note = { ok: boolean; text: string } | null;

const stamp = (d = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Appearance() {
  const { theme, set } = useTheme();
  return (
    <section className="panel">
      <h2>Tampilan</h2>
      <div className="set-row">
        <div>
          <strong>Tema</strong>
          <div className="muted small">Pilihan diingat di browser ini. Sebelum kamu memilih, tema mengikuti pengaturan perangkat.</div>
        </div>
        <div className="chips seg" role="group" aria-label="Tema">
          <button type="button" className={`chip plain${theme === 'dark' ? ' on' : ''}`} aria-pressed={theme === 'dark'} onClick={() => set('dark')}>
            <Glyph name="moon" /> Gelap
          </button>
          <button type="button" className={`chip plain${theme === 'light' ? ' on' : ''}`} aria-pressed={theme === 'light'} onClick={() => set('light')}>
            <Glyph name="sun" /> Terang
          </button>
        </div>
      </div>
    </section>
  );
}

function Account() {
  const { state, signIn, signOut } = useAuth();
  return (
    <section className="panel">
      <h2>Akun</h2>
      {state.status === 'off' && <p className="muted">Fitur komunitas belum aktif di instalasi ini, jadi tidak ada akun. Semua data kamu tersimpan di browser ini saja.</p>}
      {state.status === 'loading' && <span className="skel" style={{ height: 38 }} role="status" aria-label="Memuat" />}
      {state.status === 'out' && (
        <>
          <p className="muted">Masuk dengan Google untuk membagikan build, menyukai, berkomentar, menyimpan tulisan, dan ikut Adu. Build lokalmu tidak ikut terunggah kecuali kamu membagikannya.</p>
          <div>
            <button type="button" className="btn primary" onClick={() => void signIn()}>
              Masuk dengan Google
            </button>
          </div>
        </>
      )}
      {state.status === 'in' && (
        <>
          <div className="set-row">
            <div>
              <strong>{state.name}</strong>
              <div className="muted small">Masuk dengan Google</div>
            </div>
            <div className="row">
              <a className="btn" href={hashFor('profile')}>
                Lihat profil
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                <Glyph name="logout" /> Keluar
              </button>
            </div>
          </div>
          <p className="muted small">Menghapus akun dan tulisanmu belum ada tombolnya di app ini. Hapus tulisan satu per satu dari profil; untuk penghapusan akun, hubungi pengelola situs ini.</p>
        </>
      )}
    </section>
  );
}

function Backup() {
  const { builds, teams, customHeroes, heroMap, importAll } = useStore();
  const notify = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<Note>(null);

  const exportAll = () => {
    const data = makeBackup(builds, teams, customHeroes);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlbb-build-lab-cadangan-${stamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Cadangan diunduh');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setNote(null);
    if (f.size > MAX_BACKUP_BYTES) {
      setNote({ ok: false, text: 'Berkas terlalu besar untuk berkas cadangan (maksimal 2 MB).' });
      return;
    }
    let text: string;
    try {
      text = await f.text();
    } catch {
      setNote({ ok: false, text: 'Berkas tidak bisa dibaca.' });
      return;
    }
    const res = readBackup(text, heroMap, { builds, teams });
    if (!res.ok) {
      setNote({ ok: false, text: res.error });
      return;
    }
    const added = res.builds.length + res.teams.length + res.heroes.length;
    if (added > 0) importAll({ heroes: res.heroes, builds: res.builds, teams: res.teams });
    const parts = [
      `${res.builds.length} build`,
      `${res.teams.length} komposisi`,
      ...(res.heroes.length ? [`${res.heroes.length} hero kustom`] : []),
    ];
    const extra = [res.duplicates ? `${res.duplicates} sudah ada` : '', res.skipped ? `${res.skipped} dilewati karena rusak atau hero-nya tidak dikenal` : ''].filter(Boolean);
    setNote({
      ok: added > 0 || res.skipped === 0,
      text: `${added > 0 ? `Dipulihkan: ${parts.join(', ')}.` : 'Tidak ada data baru untuk ditambahkan.'}${extra.length ? ` ${extra.join('; ')}.` : ''}`,
    });
  };

  return (
    <section className="panel">
      <h2>Data di perangkat ini</h2>
      <p className="muted">
        Build, komposisi, dan hero kustom disimpan di browser ini, bukan di server. Membersihkan data situs, ganti browser, atau ganti perangkat akan menghilangkannya. Unduh cadangan sesekali.
      </p>
      <div className="set-row">
        <span>
          <strong>{builds.length}</strong> build · <strong>{teams.length}</strong> komposisi · <strong>{customHeroes.length}</strong> hero kustom
        </span>
        <div className="row">
          <button type="button" className="btn" onClick={exportAll} disabled={builds.length + teams.length + customHeroes.length === 0}>
            <Glyph name="download" /> Unduh cadangan
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            <Glyph name="upload" /> Pulihkan dari berkas
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onFile(f);
            }}
          />
        </div>
      </div>
      {note && (
        <p className={`note ${note.ok ? 'ok' : 'bad'}`} role="status">
          {note.text}
        </p>
      )}
      <p className="muted small">
        Pemulihan hanya menambah: data yang sudah ada di perangkat ini tidak ditimpa. Cadangan tidak memuat draf yang belum disimpan, catatan hasil di halaman MPL, atau tema.
      </p>
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="page">
      <header className="page-head">
        <h1>Pengaturan</h1>
        <p className="muted">Tampilan, akun, dan cadangan data.</p>
      </header>
      <div className="set-grid">
        <div className="stack" style={{ gap: 20 }}>
          <Appearance />
          <Account />
        </div>
        <Backup />
      </div>
      <section className="panel">
        <h2>Sumber data</h2>
        <DataStatus />
        <div className="muted small">
          <Attribution />
        </div>
      </section>
    </div>
  );
}
