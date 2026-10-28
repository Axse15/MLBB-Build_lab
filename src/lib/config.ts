/** Konfigurasi komunitas (murni, tanpa efek samping; diuji di scripts/check.ts). */

export type CommunityOff = 'missing' | 'bad_url' | 'secret_key';
export type CommunityConfig = { ok: true; url: string; key: string } | { ok: false; reason: CommunityOff };

/** Peran dari JWT (tanpa verifikasi; hanya untuk mendeteksi salah tempel kunci). */
function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function readConfig(rawUrl: string | undefined, rawKey: string | undefined): CommunityConfig {
  const url = (rawUrl ?? '').trim().replace(/\/+$/, '');
  const key = (rawKey ?? '').trim();
  if (!url || !key) return { ok: false, reason: 'missing' };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: 'bad_url' };
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return { ok: false, reason: 'bad_url' };
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') return { ok: false, reason: 'secret_key' };
  return { ok: true, url, key };
}

export const OFF_TEXT: Record<CommunityOff, string> = {
  missing: 'Fitur komunitas belum diaktifkan di situs ini (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi).',
  bad_url: 'Alamat Supabase tidak valid. Harus https://… (atau http://localhost untuk pengembangan).',
  secret_key: 'Kunci yang dipasang adalah kunci RAHASIA (service_role). Ganti dengan kunci anon/publishable, dan anggap kunci rahasia itu bocor.',
};
