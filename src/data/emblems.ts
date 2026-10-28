import type { Emblem, Spell, Talent } from '../types';

/**
 * Emblem, talent, dan battle spell. Sumber: MLBBHub (menyadur Liquipedia, CC BY-SA 3.0),
 * patch 2.2.16a, lalu slot tier dicocokkan dengan data Rone Arena API (`gifttiers`).
 *
 * Cara kerja di game (dikonfirmasi dari build nyata di API, mis. Fanny jungle = Rupture [Assassin] +
 * Festival of Blood [Fighter] + Lethal Ignition [Mage]): emblem hanya menentukan stat dasar, sedangkan
 * talent dipilih SATU per tier (tier 1, 2, 3) dari seluruh 26 talent, tidak terkunci ke set emblem tadi.
 * Tiap talent di bawah tetap dikelompokkan per set asalnya (untuk `recommended`), dengan `slot` = tier-nya.
 * Deskripsi adalah ringkasan, bukan salinan teks asli.
 */
export const EMBLEMS: Emblem[] = [
  {
    id: 'common',
    name: 'Basic Common',
    base: '+12 Hybrid Regen, +275 HP, +22 Adaptive Attack',
    recommended: ['Thrill', 'Wilderness Blessing', 'Impure Rage'],
    talents: [
      { name: 'Thrill', slot: 1, tier: 'standard', text: '+16 Adaptive Attack.' },
      { name: 'Swift', slot: 1, tier: 'standard', text: '+10% Attack Speed.' },
      { name: 'Wilderness Blessing', slot: 2, tier: 'standard', text: '+10% Move Speed di jungle dan sungai (setengahnya saat bertarung).' },
      { name: 'Seasoned Hunter', slot: 2, tier: 'standard', text: '+15% damage ke Lord dan Turtle.' },
      { name: 'Impure Rage', slot: 3, tier: 'core', text: 'Skill memberi 4% Max HP target sebagai damage tambahan dan memulihkan mana.' },
      { name: 'Quantum Charge', slot: 3, tier: 'core', text: 'Basic attack memberi Move Speed dan memulihkan HP.' },
      { name: 'War Cry', slot: 3, tier: 'core', text: 'Setiap 3 serangan/skill kena hero, damage naik 8% selama 6 detik.' },
      { name: 'Temporal Reign', slot: 3, tier: 'core', text: 'Ultimate memotong cooldown skill lain dalam 4 detik.' },
    ],
  },
  {
    id: 'tank',
    name: 'Tank',
    base: '+500 HP, +10 Hybrid Defense, +4 HP Regen',
    recommended: ['Vitality', 'Tenacity', 'Concussive Blast'],
    talents: [
      { name: 'Vitality', slot: 1, tier: 'standard', text: '+225 Max HP.' },
      { name: 'Tenacity', slot: 2, tier: 'standard', text: '+15 Phys & Magic DEF saat HP di bawah 50%.' },
      { name: 'Concussive Blast', slot: 3, tier: 'core', text: 'Basic attack berikutnya memberi magic damage AoE berbasis Total HP.' },
    ],
  },
  {
    id: 'assassin',
    name: 'Assassin',
    base: '+14 Adaptive Pen, +10 Adaptive Attack, +3% Move Speed',
    recommended: ['Rupture', 'Master Assassin', 'Killing Spree'],
    talents: [
      { name: 'Rupture', slot: 1, tier: 'standard', text: '+5 Adaptive Penetration.' },
      { name: 'Master Assassin', slot: 2, tier: 'standard', text: '+7% damage ke hero yang sendirian.' },
      { name: 'Killing Spree', slot: 3, tier: 'core', text: 'Hero di bawah 30% HP: pulihkan 15% lost HP, +20% Move Speed; reset cooldown saat kill.' },
    ],
  },
  {
    id: 'mage',
    name: 'Mage',
    base: '+30 Magic Power, +5% CDR, +8 Magic Pen',
    recommended: ['Inspire', 'Bargain Hunter', 'Lethal Ignition'],
    talents: [
      { name: 'Inspire', slot: 1, tier: 'standard', text: '+5% CDR dan +2 Mana Regen.' },
      { name: 'Bargain Hunter', slot: 2, tier: 'standard', text: 'Item dibeli seharga 95% dari harga dasar.' },
      { name: 'Lethal Ignition', slot: 3, tier: 'core', text: '3 hit damage besar dalam 5 detik membakar target dengan damage tambahan.' },
    ],
  },
  {
    id: 'fighter',
    name: 'Fighter',
    base: '+10% Hybrid Lifesteal, +16 Adaptive Attack, +8 Hybrid Defense',
    recommended: ['Firmness', 'Festival of Blood', 'Brave Smite'],
    talents: [
      { name: 'Firmness', slot: 1, tier: 'standard', text: '+8 Phys & Magic DEF.' },
      { name: 'Festival of Blood', slot: 2, tier: 'standard', text: '+6% Spell Vamp, bertambah tiap kill/assist.' },
      { name: 'Brave Smite', slot: 3, tier: 'core', text: 'Skill kena hero memulihkan 5% Max HP (cooldown 6 detik).' },
    ],
  },
  {
    id: 'support',
    name: 'Support',
    base: '+12% Healing Effect, +10% CDR, +6% Move Speed',
    recommended: ['Agility', 'Pull Yourself Together', 'Focusing Mark'],
    talents: [
      { name: 'Agility', slot: 1, tier: 'standard', text: '+4% Move Speed.' },
      { name: 'Pull Yourself Together', slot: 2, tier: 'standard', text: 'Cooldown battle spell dan item aktif berkurang 12%, naik tiap kill/assist.' },
      { name: 'Focusing Mark', slot: 3, tier: 'core', text: 'Setelah kena hero, sekutu memberi +6% damage ke target itu dan dapat +10% Move Speed.' },
    ],
  },
  {
    id: 'marksman',
    name: 'Marksman',
    base: '+15% Attack Speed, +16 Adaptive Attack, +10% Adaptive Pen',
    recommended: ['Fatal', 'Weapon Master', 'Weakness Finder'],
    talents: [
      { name: 'Fatal', slot: 1, tier: 'standard', text: '+5% Crit Chance dan +5% Crit Damage.' },
      { name: 'Weapon Master', slot: 2, tier: 'standard', text: '+8% Attack/Magic Power yang didapat dari equipment, emblem, talent, dan skill.' },
      { name: 'Weakness Finder', slot: 3, tier: 'core', text: 'Basic attack memperlambat musuh dan menurunkan attack speed mereka.' },
    ],
  },
];

/** Talent dengan set asalnya, untuk pemilih per tier. */
export interface PoolTalent extends Talent {
  set: string;
  setName: string;
}
export const TALENTS: PoolTalent[] = EMBLEMS.flatMap((e) => e.talents.map((t) => ({ ...t, set: e.id, setName: e.name })));
export const TALENT_BY_NAME: Record<string, PoolTalent> = Object.fromEntries(TALENTS.map((t) => [t.name, t]));
export const TALENT_SLOTS: (1 | 2 | 3)[] = [1, 2, 3];

export const EMBLEM_BY_ID: Record<string, Emblem> = Object.fromEntries(EMBLEMS.map((e) => [e.id, e]));

export const SPELLS: Spell[] = [
  { id: 'execute', name: 'Execute', cooldown: 90, text: 'True damage ke hero musuh, makin besar jika HP-nya makin rendah.' },
  { id: 'retribution', name: 'Retribution', cooldown: 35, text: 'Damage besar ke creep atau minion. Wajib untuk jungler.' },
  { id: 'inspire', name: 'Inspire', cooldown: 75, text: 'Attack speed naik untuk beberapa basic attack berikutnya.' },
  { id: 'sprint', name: 'Sprint', cooldown: 100, text: '+50% Move Speed dan kebal slow selama 6 detik.' },
  { id: 'revitalize', name: 'Revitalize', cooldown: 75, text: 'Mata air penyembuh di sekitar hero selama 4 detik.' },
  { id: 'aegis', name: 'Aegis', cooldown: 75, text: 'Shield selama 5 detik.' },
  { id: 'petrify', name: 'Petrify', cooldown: 75, text: 'Damage, memadatkan dan memperlambat musuh di sekitar.' },
  { id: 'purify', name: 'Purify', cooldown: 90, text: 'Hapus debuff (kecuali Suppression), kebal kontrol sesaat.' },
  { id: 'flameshot', name: 'Flameshot', cooldown: 50, text: 'Menembakkan bola api ke arah target.' },
  { id: 'flicker', name: 'Flicker', cooldown: 120, text: 'Blink jarak tetap lalu dapat defense tambahan sesaat.' },
  { id: 'vengeance', name: 'Vengeance', cooldown: 75, text: 'Damage reduction dan memantulkan sebagian damage ke penyerang selama 3 detik.' },
  { id: 'arrival', name: 'Arrival', cooldown: 75, text: 'Teleport ke turret, base, minion, atau trap sekutu setelah channeling 3 detik.' },
];

export const SPELL_BY_ID: Record<string, Spell> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
