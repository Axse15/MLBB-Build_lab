import type { Hero, Lane, Role } from '../types';

/**
 * Roster hero: nama + role, disalin dari daftar MLBBHub (update 26 Okt 2026, patch 2.2.16a).
 * Role pertama = role utama. Lane TIDAK ada di sumber, jadi diturunkan dari role
 * (lihat ROLE_LANE) dan hanya dipakai sebagai petunjuk filter, bukan aturan.
 * Hero baru yang belum ada di sini bisa ditambah lewat tombol "Hero kustom" di aplikasi.
 */
const RAW: [string, string][] = [
  ['Aamon', 'Assassin'],
  ['Akai', 'Tank'],
  ['Aldous', 'Fighter'],
  ['Alice', 'Tank,Mage'],
  ['Alpha', 'Fighter'],
  ['Alucard', 'Fighter,Assassin'],
  ['Angela', 'Support'],
  ['Argus', 'Fighter'],
  ['Arlott', 'Fighter,Assassin'],
  ['Atlas', 'Tank'],
  ['Aulus', 'Fighter'],
  ['Aurora', 'Mage'],
  ['Badang', 'Fighter'],
  ['Balmond', 'Fighter'],
  ['Bane', 'Fighter,Mage'],
  ['Barats', 'Tank,Fighter'],
  ['Baxia', 'Tank'],
  ['Beatrix', 'Marksman'],
  ['Belerick', 'Tank'],
  ['Benedetta', 'Assassin,Fighter'],
  ['Brody', 'Marksman'],
  ['Bruno', 'Marksman'],
  ['Carmilla', 'Support,Tank'],
  ['Cecilion', 'Mage'],
  ["Chang'e", 'Mage'],
  ['Chip', 'Support,Tank'],
  ['Chou', 'Fighter'],
  ['Cici', 'Fighter'],
  ['Claude', 'Marksman'],
  ['Clint', 'Marksman'],
  ['Cyclops', 'Mage'],
  ['Diggie', 'Support'],
  ['Dyrroth', 'Fighter'],
  ['Edith', 'Tank,Marksman'],
  ['Esmeralda', 'Tank,Mage'],
  ['Estes', 'Support'],
  ['Eudora', 'Mage'],
  ['Fanny', 'Assassin'],
  ['Faramis', 'Support,Mage'],
  ['Floryn', 'Support'],
  ['Franco', 'Tank'],
  ['Fredrinn', 'Fighter,Tank'],
  ['Freya', 'Fighter'],
  ['Gatotkaca', 'Tank,Fighter'],
  ['Gloo', 'Tank'],
  ['Gord', 'Mage'],
  ['Granger', 'Marksman'],
  ['Grock', 'Tank,Fighter'],
  ['Guinevere', 'Fighter'],
  ['Gusion', 'Assassin'],
  ['Hanabi', 'Marksman'],
  ['Hanzo', 'Assassin'],
  ['Harith', 'Mage'],
  ['Harley', 'Assassin,Mage'],
  ['Hayabusa', 'Assassin'],
  ['Helcurt', 'Assassin'],
  ['Hilda', 'Fighter,Tank'],
  ['Hirara', 'Assassin'],
  ['Hylos', 'Tank'],
  ['Irithel', 'Marksman'],
  ['Ixia', 'Marksman'],
  ['Jawhead', 'Fighter'],
  ['Johnson', 'Tank,Support'],
  ['Joy', 'Assassin'],
  ['Julian', 'Assassin,Fighter'],
  ['Kadita', 'Mage,Assassin'],
  ['Kagura', 'Mage'],
  ['Kaja', 'Support'],
  ['Kalea', 'Support,Fighter'],
  ['Karina', 'Assassin'],
  ['Karrie', 'Marksman'],
  ['Khaleed', 'Fighter'],
  ['Khufra', 'Tank'],
  ['Kimmy', 'Marksman,Mage'],
  ['Lancelot', 'Assassin'],
  ['Lapu-Lapu', 'Fighter'],
  ['Layla', 'Marksman'],
  ['Leomord', 'Fighter'],
  ['Lesley', 'Marksman,Assassin'],
  ['Ling', 'Assassin'],
  ['Lolita', 'Support,Tank'],
  ['Lukas', 'Fighter'],
  ['Lunox', 'Mage'],
  ['Luo Yi', 'Mage'],
  ['Lylia', 'Mage'],
  ['Marcel', 'Support'],
  ['Martis', 'Fighter'],
  ['Masha', 'Fighter,Tank'],
  ['Mathilda', 'Support,Assassin'],
  ['Melissa', 'Marksman'],
  ['Minotaur', 'Tank,Support'],
  ['Minsitthar', 'Fighter'],
  ['Miya', 'Marksman'],
  ['Moskov', 'Marksman'],
  ['Nana', 'Mage'],
  ['Natalia', 'Assassin'],
  ['Natan', 'Marksman'],
  ['Nolan', 'Assassin'],
  ['Novaria', 'Mage'],
  ['Obsidia', 'Marksman'],
  ['Odette', 'Mage'],
  ['Paquito', 'Fighter,Assassin'],
  ['Pharsa', 'Mage'],
  ['Phoveus', 'Fighter'],
  ['Popol and Kupa', 'Marksman'],
  ['Rafaela', 'Support'],
  ['Roger', 'Fighter,Marksman'],
  ['Ruby', 'Fighter'],
  ['Saber', 'Assassin'],
  ['Selena', 'Assassin,Mage'],
  ['Silvanna', 'Fighter'],
  ['Sora', 'Fighter,Assassin'],
  ['Sun', 'Fighter'],
  ['Suyou', 'Assassin,Fighter'],
  ['Terizla', 'Fighter,Tank'],
  ['Thamuz', 'Fighter'],
  ['Tigreal', 'Tank'],
  ['Uranus', 'Tank'],
  ['Vale', 'Mage'],
  ['Valentina', 'Mage'],
  ['Valir', 'Mage'],
  ['Vexana', 'Mage'],
  ['Wanwan', 'Marksman'],
  ['X.Borg', 'Fighter'],
  ['Xavier', 'Mage'],
  ['Yi Sun-shin', 'Assassin,Marksman'],
  ['Yin', 'Fighter,Assassin'],
  ['Yu Zhong', 'Fighter'],
  ['Yve', 'Mage'],
  ['Zetian', 'Mage'],
  ['Zhask', 'Mage'],
  ['Zhuxin', 'Mage'],
  ['Zilong', 'Fighter,Assassin'],
];

const ROLE_LANE: Record<Role, Lane[]> = {
  Marksman: ['Gold'],
  Mage: ['Mid'],
  Fighter: ['EXP'],
  Assassin: ['Jungle'],
  Tank: ['Roam'],
  Support: ['Roam'],
};

/** Koreksi untuk hero yang jelas menyimpang dari pola role -> lane. */
const LANE_OVERRIDES: Record<string, Lane[]> = {
  roger: ['Jungle', 'Gold'],
  esmeralda: ['EXP', 'Roam'],
  edith: ['Roam', 'EXP'],
};

export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function lanesFromRoles(roles: Role[]): Lane[] {
  const set = new Set<Lane>();
  roles.forEach((r) => ROLE_LANE[r].forEach((l) => set.add(l)));
  return [...set];
}

export const BASE_HEROES: Hero[] = RAW.map(([name, r]) => {
  const roles = r.split(',') as Role[];
  const id = slug(name);
  return { id, name, roles, lanes: LANE_OVERRIDES[id] ?? lanesFromRoles(roles) };
});

export const ROLE_COLOR: Record<Role, string> = {
  Fighter: 'var(--r-fighter)',
  Mage: 'var(--r-mage)',
  Marksman: 'var(--r-marksman)',
  Assassin: 'var(--r-assassin)',
  Tank: 'var(--r-tank)',
  Support: 'var(--r-support)',
};
