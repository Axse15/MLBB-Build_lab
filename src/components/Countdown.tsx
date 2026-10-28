import { useEffect, useState } from 'react';

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Hitung mundur ke `start`. Setelah lewat: "sedang berlangsung" sampai `end`, lalu "sudah selesai". */
export function Countdown({ start, end, compact }: { start: number; end: number; compact?: boolean }) {
  const now = useNow(1000);
  const diff = start - now;
  if (diff <= 0) {
    return (
      <div className="countdown">
        <strong>{now < end ? 'Playoff sedang berlangsung' : 'Playoff sudah selesai'}</strong>
        {!compact && <span className="muted small">{now < end ? 'Tonton lewat kanal YouTube MPL Indonesia.' : 'Cek hasil akhir di sumber di bawah.'}</span>}
      </div>
    );
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const cell = (n: number, label: string) => (
    <div className="cd-cell">
      <span className="cd-num">{String(n).padStart(2, '0')}</span>
      <span className="cd-label">{label}</span>
    </div>
  );
  return (
    <div className={`countdown${compact ? ' compact' : ''}`} role="timer" aria-label={`Dimulai dalam ${d} hari ${h} jam ${m} menit`}>
      {cell(d, 'hari')}
      {cell(h, 'jam')}
      {cell(m, 'menit')}
      {cell(s, 'detik')}
    </div>
  );
}
