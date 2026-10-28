import type { Item, ItemKind } from '../types';

/**
 * Item tier 3 + boots + item jungle/roam. Harga, stat, dan nama passive disalin dari MLBBHub
 * (menyadur Liquipedia, CC BY-SA 3.0), patch 2.2.16a, diperiksa 26 Okt 2026.
 * Stat ditulis ringkas; item dengan "(+lainnya)" punya stat tambahan yang tidak ikut ditampilkan.
 * Passive generik (mis. "Magic") sengaja dikosongkan agar tidak memicu peringatan palsu.
 */
const mk = (
  name: string,
  kind: ItemKind,
  cost: number,
  stats: string,
  passive?: string,
): Item => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  name,
  kind,
  cost,
  stats,
  passive,
});

export const ITEMS: Item[] = [
  // Attack
  mk("Berserker's Fury", 'attack', 2390, '+60 Phys ATK, +25% Crit', 'Doom'),
  mk('Blade of Despair', 'attack', 3010, '+160 Phys ATK, +5% Move Speed', 'Despair'),
  mk('Blade of the Heptaseas', 'attack', 1950, '+250 HP, +70 Phys ATK', 'Ambush'),
  mk('Corrosion Scythe', 'attack', 2050, '+30 Phys ATK, +30% Atk Speed, +5% Move Speed', 'Corrosion'),
  mk('Demon Hunter Sword', 'attack', 2180, '+35 Phys ATK, +20% Atk Speed', 'Devour'),
  mk('Endless Battle', 'attack', 2330, '+250 HP, +60 Phys ATK, +10% CDR (+lainnya)', 'Divine Justice'),
  mk('Golden Staff', 'attack', 2000, '+55 Phys ATK, +15% Atk Speed', 'Swift'),
  mk('Great Dragon Spear', 'attack', 2140, '+70 Phys ATK, +20% Crit, +10% CDR', 'Supreme Warrior'),
  mk("Haas's Claws", 'attack', 2020, '+40 Phys ATK, +15% Atk Speed, +20% Crit', 'Frenzy'),
  mk('Hunter Strike', 'attack', 2010, '+80 Phys ATK, +10% CDR', 'Retribution'),
  mk('Malefic Gun', 'attack', 2120, '+40 Phys ATK, +20% Atk Speed', 'Armor Buster'),
  mk('Malefic Roar', 'attack', 2060, '+60 Phys ATK', 'Armor Buster'),
  mk('Rose Gold Meteor', 'attack', 1820, '+30 Phys ATK, +20% Atk Speed, +10% Lifesteal', 'Dragon Scale'),
  mk('Sea Halberd', 'attack', 2050, '+80 Phys ATK, +20% Atk Speed', 'Lifebane'),
  mk('War Axe', 'attack', 2100, '+400 HP, +35 Phys ATK, +10% CDR (+lainnya)', 'Fighting Spirit'),
  mk('Wind of Nature', 'attack', 1910, '+30 Phys ATK, +20% Atk Speed, +10% Lifesteal', 'Wind Chant'),
  mk('Windtalker', 'attack', 1880, '+35% Atk Speed, +20% Crit, +20 Move Speed', 'Typhoon'),

  // Magic
  mk('Blood Wings', 'magic', 2100, '+90 Magic Power', 'Guard'),
  mk('Clock of Destiny', 'magic', 2030, '+400 HP, +400 Mana, +45 Magic Power (+lainnya)', 'Destiny'),
  mk('Concentrated Energy', 'magic', 2020, '+400 HP, +75 Magic Power', 'Recharge'),
  mk('Divine Glaive', 'magic', 1970, '+60 Magic Power', 'Spellbreaker'),
  mk('Enchanted Talisman', 'magic', 2070, '+300 HP, +75 Magic Power, +15% CDR', 'Mana Spring'),
  mk('Feather of Heaven', 'magic', 2030, '+60 Magic Power, +20% Atk Speed, +5% CDR (+lainnya)', 'Affliction'),
  mk('Flask of the Oasis', 'magic', 1850, '+300 HP, +60 Magic Power, +10% CDR', 'Blessing'),
  mk('Genius Wand', 'magic', 2000, '+75 Magic Power, +5% Move Speed'),
  mk('Glowing Wand', 'magic', 2050, '+300 HP, +60 Magic Power, +5% Move Speed', 'Scorch'),
  mk('Holy Crystal', 'magic', 3000, '+165 Magic Power', 'Mystery'),
  mk('Ice Queen Wand', 'magic', 2040, '+300 HP, +60 Magic Power, +10% Spell Vamp (+lainnya)', 'Ice Bound'),
  mk('Lightning Truncheon', 'magic', 2250, '+400 Mana, +75 Magic Power, +10% CDR', 'Resonate'),
  mk('Starlium Scythe', 'magic', 2220, '+75 Magic Power, +10% CDR, +6 Mana Regen', 'Crisis'),
  mk('Wishing Lantern', 'magic', 2250, '+400 Mana, +75 Magic Power, +10% CDR', 'Butterfly Goddess'),

  // Hybrid (kategori Attack + Magic di sumber)
  mk('Fleeting Time', 'hybrid', 2050, '+600 HP, +15% CDR', 'Timestream'),
  mk('Sky Piercer', 'hybrid', 1500, '+15 Move Speed', 'Lethality'),
  mk('Winter Crown', 'hybrid', 1910, '+400 HP, +5% CDR', 'Frozen'),

  // Defense
  mk('Antique Cuirass', 'defense', 2170, '+920 HP, +40 Phys DEF, +4 HP Regen', 'Deter'),
  mk("Athena's Shield", 'defense', 2150, '+900 HP, +48 Magic DEF, +2 HP Regen', 'Shield'),
  mk('Blade Armor', 'defense', 1910, '+70 Phys DEF', 'Bladed Armor'),
  mk('Brute Force Breastplate', 'defense', 1870, '+600 HP, +20 Phys DEF, +10% CDR', 'Brute Force'),
  mk('Chastise Pauldron', 'defense', 2100, '+900 HP, +40 Phys DEF', 'Chastise'),
  mk('Cursed Helmet', 'defense', 1910, '+1200 HP, +20 Magic DEF', 'Burning Soul'),
  mk('Dominance Ice', 'defense', 2010, '+40 Phys DEF, +40 Magic DEF, +5% Move Speed', 'Fortress Shield'),
  mk('Guardian Helmet', 'defense', 2500, '+1800 HP, +20 HP Regen', 'Recovery'),
  mk('Immortality', 'defense', 2120, '+800 HP, +15 Phys DEF', 'Immortal'),
  mk('Oracle', 'defense', 1860, '+850 HP, +20 Phys DEF, +20 Magic DEF (+lainnya)', 'Bless'),
  mk("Queen's Wings", 'defense', 2250, '+600 HP, +10% CDR, +10% Spell Vamp', 'Demonize'),
  mk('Radiant Armor', 'defense', 1880, '+950 HP, +40 Magic DEF, +12 HP Regen', 'Holy Blessing'),
  mk('Thunder Belt', 'defense', 1820, '+800 HP, +15 Phys DEF, +15 Magic DEF (+lainnya)', 'Thunderbolt'),

  // Boots
  mk('Arcane Boots', 'boots', 690, '+10 Magic Pen, +40 Move Speed'),
  mk('Demon Boots', 'boots', 720, '+40 Move Speed, +10 Mana Regen', 'Mysticism'),
  mk('Magic Boots', 'boots', 710, '+10% CDR, +40 Move Speed'),
  mk('Rapid Boots', 'boots', 750, '+55 Move Speed'),
  mk('Swift Boots', 'boots', 710, '+15% Atk Speed, +40 Move Speed'),
  mk('Tough Boots', 'boots', 700, '+18 Magic DEF, +40 Move Speed', 'Fortitude'),
  mk('Warrior Boots', 'boots', 720, '+18 Phys DEF, +40 Move Speed', 'Valor'),

  // Jungle & Roam (gratis, slot khusus)
  mk('Bloody Retribution', 'jungle', 0, 'Enchant Retribution (jungle)'),
  mk('Flame Retribution', 'jungle', 0, 'Enchant Retribution (jungle)'),
  mk('Ice Retribution', 'jungle', 0, 'Enchant Retribution (jungle)'),
  mk('Conceal', 'roam', 0, 'Item roam (aktif)'),
  mk('Dire Hit', 'roam', 0, 'Item roam', 'Devotion'),
  mk('Encourage', 'roam', 0, 'Item roam', 'Devotion'),
  mk('Favor', 'roam', 0, 'Item roam', 'Devotion'),
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const KIND_LABEL: Record<ItemKind, string> = {
  attack: 'Attack',
  magic: 'Magic',
  hybrid: 'Hybrid',
  defense: 'Defense',
  boots: 'Boots',
  jungle: 'Jungle',
  roam: 'Roam',
};
