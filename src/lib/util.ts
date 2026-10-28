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
