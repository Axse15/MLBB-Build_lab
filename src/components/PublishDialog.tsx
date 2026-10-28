import { useState } from 'react';
import { useAuth } from '../auth';
import { friendlyError, publish, type PostKind } from '../lib/community';
import { hashFor } from '../route';
import { Modal, useToast } from './ui';

/** Dialog "Bagikan ke komunitas". Pemanggil sudah memastikan pengguna login dan isinya layak. */
export function PublishDialog({
  kind,
  initialTitle,
  initialNote = '',
  payload,
  summary,
  onClose,
}: {
  kind: PostKind;
  initialTitle: string;
  initialNote?: string;
  payload: string;
  /** Ringkasan satu baris isi yang akan dipublikasikan. */
  summary: string;
  onClose: () => void;
}) {
  const { db, state } = useAuth();
  const notify = useToast();
  const [title, setTitle] = useState(initialTitle.slice(0, 60));
  const [note, setNote] = useState(initialNote.slice(0, 280));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = state.status === 'in' ? state.name : '';
  const label = kind === 'build' ? 'build' : 'komposisi';

  const submit = async () => {
    if (!db || busy) return;
    setBusy(true);
    setErr('');
    try {
      const p = await publish(db, kind, title, note, payload);
      notify(`Dipublikasikan ke komunitas`);
      onClose();
      window.location.hash = hashFor('community', { post: p.id });
    } catch (e) {
      setErr(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Bagikan ${label} ke komunitas`} onClose={onClose}>
      <p className="muted small">{summary}</p>
      <label className="field">
        <span>Judul ({title.length}/60)</span>
        <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value.replace(/[\r\n]+/g, ' '))} autoFocus />
      </label>
      <label className="field">
        <span>Catatan untuk komunitas (opsional, {note.length}/280)</span>
        <textarea className="input" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kapan build ini cocok? Lawan yang sulit?" />
      </label>
      <ul className="cm-disclose muted small">
        <li>
          Publik: judul, catatan, isi {label}, dan namamu sebagai <strong>{name || 'Pemain'}</strong>.
        </li>
        <li>Tidak bisa diedit setelah terbit. Untuk mengubah, hapus lalu terbitkan ulang (like dan komentarnya ikut hilang).</li>
        <li>Siapa pun yang login bisa melaporkan; tiga laporan berbeda menyembunyikan tulisan sampai ditinjau.</li>
      </ul>
      {err && (
        <p className="cm-err" role="alert">
          {err}
        </p>
      )}
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onClose}>
          Batal
        </button>
        <button type="button" className="btn primary" disabled={busy || !title.trim()} onClick={() => void submit()}>
          {busy ? 'Mengirim…' : 'Terbitkan'}
        </button>
      </div>
    </Modal>
  );
}

