export const ROLES = ['Fighter', 'Mage', 'Marksman', 'Assassin', 'Tank', 'Support'] as const;
export type Role = (typeof ROLES)[number];

export const LANES = ['Gold', 'EXP', 'Mid', 'Jungle', 'Roam'] as const;
export type Lane = (typeof LANES)[number];

export interface Hero {
  id: string;
  name: string;
  /** Role pertama = role utama. */
  roles: Role[];
  /** Lane. Kalau `live` false, ini perkiraan yang diturunkan dari role. */
  lanes: Lane[];
  custom?: boolean;
  /** true = role dan lane dikonfirmasi dari API data game (Rone Arena). */
  live?: boolean;
  /** true = hero ini belum ada di data statis dan hanya datang dari API. */
  fresh?: boolean;
  /** URL gambar kepala hero dari API (https). Tidak disalin ke proyek; kosong = tampil inisial. */
  img?: string;
}

export type ItemKind = 'attack' | 'magic' | 'hybrid' | 'defense' | 'boots' | 'jungle' | 'roam';

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  cost: number;
  stats: string;
  /** Nama unique passive. Dua item dengan nama sama tidak menumpuk. */
  passive?: string;
}

export interface Talent {
  name: string;
  /** Tier di game: 1 dan 2 = standard, 3 = core. Satu talent dipilih per tier. */
  slot: 1 | 2 | 3;
  tier: 'standard' | 'core';
  text: string;
}

export interface Emblem {
  id: string;
  name: string;
  base: string;
  talents: Talent[];
  recommended: string[];
}

export interface Spell {
  id: string;
  name: string;
  cooldown: number;
  text: string;
}

export interface Build {
  id: string;
  name: string;
  heroId: string;
  /** 6 slot; null = kosong */
  items: (string | null)[];
  emblemId: string;
  talents: string[];
  spellId: string;
  notes: string;
  updatedAt: number;
}

export interface TeamSlot {
  heroId: string | null;
  buildId: string | null;
}

export interface Team {
  id: string;
  name: string;
  slots: Record<Lane, TeamSlot>;
  updatedAt: number;
}
