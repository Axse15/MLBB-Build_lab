/**
 * Klien tipis untuk Rone Arena API (https://arena.rone.dev), API komunitas tidak resmi.
 * - CORS terbuka (`allow_origins=*` di source-nya), jadi dipanggil langsung dari browser.
 * - Tanpa API key untuk endpoint yang dipakai di sini.
 * - Saat 503 ("high traffic"), body-nya menyebut `alternative_endpoint`. Host itu hanya diikuti
 *   kalau berada di daftar domain yang diizinkan di bawah, supaya respons yang dimanipulasi tidak
 *   bisa mengarahkan app ke server sembarang.
 */
export const API_BASE = 'https://arena.rone.dev';
export const ALLOWED_HOST_SUFFIXES = ['rone.dev', 'fastapicloud.dev'];
// Server gratis bisa lambat saat cache dingin; data statis tampil sementara, jadi menunggu lebih lama tidak memblokir UI.
const TIMEOUT_MS = 25_000;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Cari nilai `alternative_endpoint` di mana pun di dalam body JSON dan kembalikan origin-nya jika diizinkan. */
export function findAlternativeOrigin(body: unknown, depth = 0): string | null {
  if (depth > 6 || body === null || typeof body !== 'object') return null;
  const rec = body as Record<string, unknown>;
  const alt = rec['alternative_endpoint'];
  if (typeof alt === 'string') {
    try {
      const u = new URL(alt);
      const okHost = ALLOWED_HOST_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith(`.${s}`));
      if (u.protocol === 'https:' && okHost) return u.origin;
    } catch {
      /* URL tidak valid */
    }
    return null;
  }
  for (const v of Object.values(rec)) {
    const found = findAlternativeOrigin(v, depth + 1);
    if (found) return found;
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Hash pendek dari origin halaman ini (stabil per origin; `null` untuk file://). */
export function originKey(origin = typeof location !== 'undefined' ? location.origin : 'node'): string {
  let h = 5381;
  for (let i = 0; i < origin.length; i++) h = ((h << 5) + h + origin.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Cloudflare di depan API men-cache respons sampai 4 jam dan mengabaikan `Vary: Origin`, sehingga header
 * `Access-Control-Allow-Origin` yang kembali bisa milik origin lain yang kebetulan memanggil lebih dulu
 * (diverifikasi untuk /esports/...). Browser lalu memblokirnya dan fetch gagal sebagai TypeError.
 * Percobaan ulang memakai parameter `_o` yang stabil per origin: URL-nya masuk baris cache sendiri,
 * jadi header-nya milik kita dan hasilnya tetap bisa di-cache. API mengabaikan parameter yang tidak dikenal.
 */
export const withOriginKey = (path: string): string => `${path}${path.includes('?') ? '&' : '?'}_o=${originKey()}`;

async function request(origin: string, path: string, outer?: AbortSignal, maxAttempts = 3): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onAbort);
  const where = path.split('?')[0];
  try {
    // TypeError = 500 sesaat tanpa header CORS, koneksi putus, atau header CORS milik origin lain dari cache (lihat withOriginKey).
    // Percobaan kedua langsung memakai kunci per origin (tanpa jeda); percobaan ketiga menunggu dulu.
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetch(origin + (attempt === 0 ? path : withOriginKey(path)), { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      } catch (e) {
        if (ctrl.signal.aborted) throw new ApiError(`${where}: permintaan melewati batas waktu atau dibatalkan`);
        // fetch hanya melempar TypeError "Failed to fetch" untuk koneksi putus, diblokir, DAN server yang membalas error tanpa header CORS.
        if (e instanceof TypeError && attempt < maxAttempts - 1) {
          if (attempt > 0) await sleep(1200 * attempt);
          continue;
        }
        throw new ApiError(
          e instanceof TypeError ? `${where}: browser tidak menerima balasan (server API membalas error 500 sesaat, koneksi putus, header CORS dari cache milik origin lain, atau permintaan diblokir ekstensi/ad-blocker; coba lagi beberapa saat)` : e instanceof Error ? e.message : 'Gagal menghubungi server',
        );
      }
    }
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/** GET JSON. Satu kali percobaan ulang ke host cadangan hanya bila server menyebutnya saat 503. */
export async function getJson(path: string, signal?: AbortSignal, opts: { patient?: boolean } = {}): Promise<unknown> {
  let origin = API_BASE;
  for (let attempt = 0; attempt < 2; attempt++) {
    // `patient`: 5 percobaan (jeda 1,2 / 2,4 / 3,6 dtk) untuk data yang di-scrape server saat cache dingin dan sering gagal sesaat.
    const res = await request(origin, path, signal, opts.patient ? 5 : 3);
    if (res.status === 503) {
      const body: unknown = await res.json().catch(() => null);
      const alt = findAlternativeOrigin(body);
      if (attempt === 0 && alt && alt !== origin) {
        origin = alt;
        continue;
      }
      throw new ApiError('Layanan sedang maintenance atau terlalu ramai (503)', 503);
    }
    if ((res.status === 500 || res.status === 502 || res.status === 504) && attempt === 0) {
      await sleep(1500);
      continue;
    }
    if (!res.ok) throw new ApiError(`Server membalas ${res.status}`, res.status);
    try {
      return await res.json();
    } catch {
      throw new ApiError('Balasan server bukan JSON yang valid');
    }
  }
  throw new ApiError('Layanan tidak tersedia');
}

// ---------------------------------------------------------------- cache localStorage

interface Stored<T> {
  at: number;
  data: T;
}

export interface Loaded<T> {
  data: T;
  at: number;
  /** true = jaringan gagal, data lama dari cache dipakai. */
  stale: boolean;
}

function readCache<T>(key: string, valid: (v: unknown) => boolean): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Stored<unknown>;
    if (typeof p?.at !== 'number' || !valid(p.data)) return null;
    return p as Stored<T>;
  } catch {
    return null;
  }
}

/**
 * Pakai cache kalau masih segar (menjaga beban server gratis). Kalau sudah kedaluwarsa, ambil baru;
 * jika gagal dan masih ada cache lama, pakai itu dan tandai `stale`.
 */
export async function loadCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  valid: (v: unknown) => boolean,
  force = false,
): Promise<Loaded<T>> {
  const cached = readCache<T>(key, valid);
  if (cached && !force && Date.now() - cached.at < ttlMs) return { data: cached.data, at: cached.at, stale: false };
  try {
    const data = await fetcher();
    const at = Date.now();
    try {
      localStorage.setItem(key, JSON.stringify({ at, data } satisfies Stored<T>));
    } catch {
      /* storage penuh atau diblokir */
    }
    return { data, at, stale: false };
  } catch (e) {
    if (cached) return { data: cached.data, at: cached.at, stale: true };
    throw e;
  }
}
