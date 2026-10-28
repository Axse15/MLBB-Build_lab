import { LANES, type Lane, type TeamSlot } from '../types';

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const emptyItems = (): (string | null)[] => Array<string | null>(6).fill(null);

export function emptySlots(): Record<Lane, TeamSlot> {
  const out = {} as Record<Lane, TeamSlot>;
  LANES.forEach((l) => {
    out[l] = { heroId: null, buildId: null };
  });
  return out;
}

export const formatGold = (n: number): string => n.toLocaleString('id-ID');

/** Sapaan menurut jam setempat. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 4 && h < 11) return 'Selamat pagi';
  if (h >= 11 && h < 15) return 'Selamat siang';
  if (h >= 15 && h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** "Rabu, 28 Oktober 2026" dalam zona waktu pengguna. */
export const longDate = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

/** Warna dan huruf avatar yang stabil untuk satu id (profil tanpa foto). Hue 0-359 dari hash id. */
export function avatarHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
