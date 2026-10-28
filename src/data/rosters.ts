/**
 * Snapshot roster tiap tim MPL ID, dibuat otomatis oleh `npm run rosters` dari Rone Arena API
 * (susunan di match reguler terakhir yang punya detail pemain). JANGAN diedit manual.
 * Dipakai hanya sebagai cadangan terakhir kalau API tidak terjangkau; app selalu mencoba data langsung dulu.
 * Susunan playoff bisa berbeda (pergantian pemain, cadangan).
 */
import type { Roster } from '../lib/live';

export const ROSTER_SNAPSHOT: { at: string; teams: Record<string, Roster & { date: string }> } = {
  "at": "2026-10-28",
  "teams": {
    "AE": {
      "team": "AE",
      "players": [
        {
          "name": "Nino",
          "hero": "Aulus",
          "items": [
            "2303",
            "2001",
            "3204",
            "2013",
            "2208"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "721",
            "731"
          ],
          "itemNames": [
            "Magic Boots",
            "Legion Sword",
            "Oracle",
            "War Axe",
            "Queen's Wings"
          ],
          "talentNames": [
            "Thrill",
            "Festival of Blood",
            "Brave Smite"
          ]
        },
        {
          "name": "Yazukee",
          "hero": "Leomord",
          "items": [
            "1005",
            "2103",
            "3422",
            "2013",
            "3208",
            "2002"
          ],
          "emblem": "20005",
          "talents": [
            "111",
            "122",
            "531"
          ],
          "itemNames": [
            "Iron Hunting Bow",
            "Azure Blade",
            "Flame Hunter's Tough Boots",
            "War Axe",
            "Brute Force Breastplate",
            "Ogre Tomahawk"
          ],
          "talentNames": [
            "Thrill",
            "Seasoned Hunter",
            "Killing Spree"
          ]
        },
        {
          "name": "Hijumee",
          "hero": "Valentina",
          "items": [
            "2303",
            "2101",
            "3105",
            "3110"
          ],
          "emblem": "20006",
          "talents": [
            "611",
            "621",
            "731"
          ],
          "itemNames": [
            "Magic Boots",
            "Magic Wand",
            "Glowing Wand",
            "Lightning Truncheon"
          ],
          "talentNames": [
            "Inspire",
            "Bargain Hunter",
            "Brave Smite"
          ]
        },
        {
          "name": "alekk",
          "hero": "Kalea",
          "items": [
            "2201",
            "3521",
            "3212",
            "1201",
            "3210",
            "1202"
          ],
          "emblem": "20003",
          "talents": [
            "311",
            "821",
            "331"
          ],
          "itemNames": [
            "Ares Belt",
            "Tough Boots - Conceal",
            "Chastise Pauldron",
            "Vitality Crystal",
            "Radiant Armor",
            "Leather Jerkin"
          ],
          "talentNames": [
            "Vitality",
            "Pull Yourself Together",
            "Concussive Blast"
          ]
        },
        {
          "name": "Arfy",
          "hero": "Claude",
          "items": [
            "2306",
            "2009",
            "2008",
            "2006",
            "3015"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "721",
            "132"
          ],
          "itemNames": [
            "Rapid Boots",
            "Golden Staff",
            "Corrosion Scythe",
            "Demon Hunter Sword",
            "Malefic Gun"
          ],
          "talentNames": [
            "Thrill",
            "Festival of Blood",
            "Quantum Charge"
          ]
        }
      ],
      "fromMatch": "1105",
      "vs": "EVOS",
      "at": 1792306800000,
      "date": "2026-10-18"
    },
    "BTR": {
      "team": "BTR",
      "players": [
        {
          "name": "Shogun",
          "hero": "Sora",
          "items": [
            "2302",
            "3009",
            "2013",
            "3210",
            "2208",
            "3208"
          ],
          "emblem": "20003",
          "talents": [
            "311",
            "721",
            "731"
          ],
          "itemNames": [
            "Tough Boots",
            "Hunter Strike",
            "War Axe",
            "Radiant Armor",
            "Queen's Wings",
            "Brute Force Breastplate"
          ],
          "talentNames": [
            "Vitality",
            "Festival of Blood",
            "Brave Smite"
          ]
        },
        {
          "name": "Nnael",
          "hero": "Alpha",
          "items": [
            "3013",
            "3008",
            "3208",
            "2013",
            "2208",
            "3012"
          ],
          "emblem": "20007",
          "talents": [
            "811",
            "122",
            "131"
          ],
          "itemNames": [
            "Sea Halberd",
            "Blade of Despair",
            "Brute Force Breastplate",
            "War Axe",
            "Queen's Wings",
            "Rose Gold Meteor"
          ],
          "talentNames": [
            "Agility",
            "Seasoned Hunter",
            "Impure Rage"
          ]
        },
        {
          "name": "Morenooo",
          "hero": "Valir",
          "items": [
            "3102",
            "3101",
            "2106",
            "3105",
            "3104",
            "2112"
          ],
          "emblem": "20006",
          "talents": [
            "611",
            "621",
            "131"
          ],
          "itemNames": [
            "Holy Crystal",
            "Divine Glaive",
            "Enchanted Talisman",
            "Glowing Wand",
            "Ice Queen Wand",
            "Wishing Lantern"
          ],
          "talentNames": [
            "Inspire",
            "Bargain Hunter",
            "Impure Rage"
          ]
        },
        {
          "name": "Finn",
          "hero": "Marcel",
          "items": [
            "3202",
            "3561",
            "3207",
            "2212",
            "3206",
            "3112"
          ],
          "emblem": "20008",
          "talents": [
            "811",
            "821",
            "132"
          ],
          "itemNames": [
            "Guardian Helmet",
            "Rapid Boots- Conceal",
            "Immortality",
            "Thunder Belt",
            "Dominance Ice",
            "Flask of the Oasis"
          ],
          "talentNames": [
            "Agility",
            "Pull Yourself Together",
            "Quantum Charge"
          ]
        },
        {
          "name": "EMANN",
          "hero": "Freya",
          "items": [
            "2009",
            "2006",
            "2008",
            "2013",
            "3013",
            "3001"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "721",
            "132"
          ],
          "itemNames": [
            "Golden Staff",
            "Demon Hunter Sword",
            "Corrosion Scythe",
            "War Axe",
            "Sea Halberd",
            "Malefic Roar"
          ],
          "talentNames": [
            "Thrill",
            "Festival of Blood",
            "Quantum Charge"
          ]
        }
      ],
      "fromMatch": "1106",
      "vs": "NAVI",
      "at": 1792317600000,
      "date": "2026-10-18"
    },
    "DEWA": {
      "team": "DEWA",
      "players": [
        {
          "name": "QINN",
          "hero": "Lukas",
          "items": [
            "3204",
            "2302",
            "2013",
            "2208",
            "3208"
          ],
          "emblem": "20007",
          "talents": [
            "711",
            "721",
            "731"
          ],
          "itemNames": [
            "Oracle",
            "Tough Boots",
            "War Axe",
            "Queen's Wings",
            "Brute Force Breastplate"
          ],
          "talentNames": [
            "Firmness",
            "Festival of Blood",
            "Brave Smite"
          ]
        },
        {
          "name": "Hazle",
          "hero": "Alice",
          "items": [
            "2207",
            "3203",
            "3433",
            "3204",
            "3201",
            "3208"
          ],
          "emblem": "20003",
          "talents": [
            "311",
            "122",
            "131"
          ],
          "itemNames": [
            "Blade Armor",
            "Antique Cuirass",
            "Behemoth Hunter's Magic Boots",
            "Oracle",
            "Cursed Helmet",
            "Brute Force Breastplate"
          ],
          "talentNames": [
            "Vitality",
            "Seasoned Hunter",
            "Impure Rage"
          ]
        },
        {
          "name": "Octa",
          "hero": "Valentina",
          "items": [
            "1205",
            "3204",
            "2303",
            "3105",
            "1008",
            "2208"
          ],
          "emblem": "20001",
          "talents": [
            "611",
            "721",
            "731"
          ],
          "itemNames": [
            "Hero's Ring",
            "Oracle",
            "Magic Boots",
            "Glowing Wand",
            "Expert Gloves",
            "Queen's Wings"
          ],
          "talentNames": [
            "Inspire",
            "Festival of Blood",
            "Brave Smite"
          ]
        },
        {
          "name": "Itoshi Kesu",
          "hero": "Gloo",
          "items": [
            "2201",
            "3522",
            "3203",
            "3201",
            "2206",
            "3210"
          ],
          "emblem": "20001",
          "talents": [
            "811",
            "121",
            "731"
          ],
          "itemNames": [
            "Ares Belt",
            "Tough Boots - Encourage",
            "Antique Cuirass",
            "Cursed Helmet",
            "Steel Legplates",
            "Radiant Armor"
          ],
          "talentNames": [
            "Agility",
            "Wilderness Blessing",
            "Brave Smite"
          ]
        },
        {
          "name": "Maybeee",
          "hero": "Paquito",
          "items": [
            "3001",
            "2013",
            "2301",
            "3009",
            "3013",
            "2208"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "721",
            "631"
          ],
          "itemNames": [
            "Malefic Roar",
            "War Axe",
            "Warrior Boots",
            "Hunter Strike",
            "Sea Halberd",
            "Queen's Wings"
          ],
          "talentNames": [
            "Thrill",
            "Festival of Blood",
            "Lethal Ignition"
          ]
        }
      ],
      "fromMatch": "1102",
      "vs": "ONIC",
      "at": 1792220400000,
      "date": "2026-10-17"
    },
    "EVOS": {
      "team": "EVOS",
      "players": [
        {
          "name": "Rendyyy",
          "hero": "Alice",
          "items": [
            "3204",
            "2303",
            "1202",
            "3212",
            "2201",
            "3210"
          ],
          "emblem": "20003",
          "talents": [
            "731",
            "311",
            "721"
          ],
          "itemNames": [
            "Oracle",
            "Magic Boots",
            "Leather Jerkin",
            "Chastise Pauldron",
            "Ares Belt",
            "Radiant Armor"
          ],
          "talentNames": [
            "Brave Smite",
            "Vitality",
            "Festival of Blood"
          ]
        },
        {
          "name": "Alberttt",
          "hero": "Alpha",
          "items": [
            "2206",
            "3421",
            "3208",
            "2013",
            "2107",
            "2208"
          ],
          "emblem": "20007",
          "talents": [
            "531",
            "111",
            "122"
          ],
          "itemNames": [
            "Steel Legplates",
            "Ice Hunter's Tough Boots",
            "Brute Force Breastplate",
            "War Axe",
            "Winter Crown",
            "Queen's Wings"
          ],
          "talentNames": [
            "Killing Spree",
            "Thrill",
            "Seasoned Hunter"
          ]
        },
        {
          "name": "Ryzaa",
          "hero": "Wu/Zetian",
          "items": [
            "2101",
            "3101",
            "2304",
            "3105",
            "3110",
            "1101"
          ],
          "emblem": "20006",
          "talents": [
            "131",
            "611",
            "121"
          ],
          "itemNames": [
            "Magic Wand",
            "Divine Glaive",
            "Arcane Boots",
            "Glowing Wand",
            "Lightning Truncheon",
            "Mystery Codex"
          ],
          "talentNames": [
            "Impure Rage",
            "Inspire",
            "Wilderness Blessing"
          ]
        },
        {
          "name": "Muezza",
          "hero": "Carmilla",
          "items": [
            "3205",
            "3521",
            "3212",
            "1202",
            "3207"
          ],
          "emblem": "20003",
          "talents": [
            "331",
            "311",
            "321"
          ],
          "itemNames": [
            "Athena's Shield",
            "Tough Boots - Conceal",
            "Chastise Pauldron",
            "Leather Jerkin",
            "Immortality"
          ],
          "talentNames": [
            "Concussive Blast",
            "Vitality",
            "Tenacity"
          ]
        },
        {
          "name": "Erlan",
          "hero": "Obsidia",
          "items": [
            "2301",
            "2009",
            "1006",
            "2008",
            "2006",
            "3015"
          ],
          "emblem": "20007",
          "talents": [
            "132",
            "111",
            "621"
          ],
          "itemNames": [
            "Warrior Boots",
            "Golden Staff",
            "Regular Spear",
            "Corrosion Scythe",
            "Demon Hunter Sword",
            "Malefic Gun"
          ],
          "talentNames": [
            "Quantum Charge",
            "Thrill",
            "Bargain Hunter"
          ]
        }
      ],
      "fromMatch": "1105",
      "vs": "AE",
      "at": 1792306800000,
      "date": "2026-10-18"
    },
    "GEEK": {
      "team": "GEEK",
      "players": [
        {
          "name": "Febriii",
          "hero": "Phoveus",
          "items": [
            "3203",
            "2302",
            "3212",
            "3210"
          ],
          "emblem": "20003",
          "talents": [
            "731",
            "311",
            "721"
          ],
          "itemNames": [
            "Antique Cuirass",
            "Tough Boots",
            "Chastise Pauldron",
            "Radiant Armor"
          ],
          "talentNames": [
            "Brave Smite",
            "Vitality",
            "Festival of Blood"
          ]
        },
        {
          "name": "Maykidss",
          "hero": "Aulus",
          "items": [
            "3012",
            "3001",
            "3462",
            "2013",
            "2208",
            "2001"
          ],
          "emblem": "20005",
          "talents": [
            "531",
            "111",
            "122"
          ],
          "itemNames": [
            "Rose Gold Meteor",
            "Malefic Roar",
            "Flame Hunter's Rapid Boots",
            "War Axe",
            "Queen's Wings",
            "Legion Sword"
          ],
          "talentNames": [
            "Killing Spree",
            "Thrill",
            "Seasoned Hunter"
          ]
        },
        {
          "name": "Aboyy",
          "hero": "Cecilion",
          "items": [
            "2308",
            "3101",
            "3105",
            "2112",
            "2107"
          ],
          "emblem": "20006",
          "talents": [
            "131",
            "611",
            "821"
          ],
          "itemNames": [
            "Demon Boots",
            "Divine Glaive",
            "Glowing Wand",
            "Wishing Lantern",
            "Winter Crown"
          ],
          "talentNames": [
            "Impure Rage",
            "Inspire",
            "Pull Yourself Together"
          ]
        },
        {
          "name": "Frenzyy",
          "hero": "Carmilla",
          "items": [
            "3203",
            "3521",
            "2201",
            "3212",
            "3210"
          ],
          "emblem": "20003",
          "talents": [
            "331",
            "711",
            "121"
          ],
          "itemNames": [
            "Antique Cuirass",
            "Tough Boots - Conceal",
            "Ares Belt",
            "Chastise Pauldron",
            "Radiant Armor"
          ],
          "talentNames": [
            "Concussive Blast",
            "Firmness",
            "Wilderness Blessing"
          ]
        },
        {
          "name": "KennzySkie",
          "hero": "Paquito",
          "items": [
            "2208",
            "3001",
            "2306",
            "3009",
            "3013"
          ],
          "emblem": "20005",
          "talents": [
            "631",
            "111",
            "721"
          ],
          "itemNames": [
            "Queen's Wings",
            "Malefic Roar",
            "Rapid Boots",
            "Hunter Strike",
            "Sea Halberd"
          ],
          "talentNames": [
            "Lethal Ignition",
            "Thrill",
            "Festival of Blood"
          ]
        }
      ],
      "fromMatch": "1104",
      "vs": "RRQ",
      "at": 1792242000000,
      "date": "2026-10-17"
    },
    "NAVI": {
      "team": "NAVI",
      "players": [
        {
          "name": "Karss",
          "hero": "Esmeralda",
          "items": [
            "3208",
            "2201",
            "3204",
            "2106",
            "3206",
            "3104"
          ],
          "emblem": "20008",
          "talents": [
            "131",
            "611",
            "121"
          ],
          "itemNames": [
            "Brute Force Breastplate",
            "Ares Belt",
            "Oracle",
            "Enchanted Talisman",
            "Dominance Ice",
            "Ice Queen Wand"
          ],
          "talentNames": [
            "Impure Rage",
            "Inspire",
            "Wilderness Blessing"
          ]
        },
        {
          "name": "Joshuaa",
          "hero": "Aulus",
          "items": [
            "3001",
            "2013",
            "3431",
            "2001",
            "2208",
            "3008"
          ],
          "emblem": "20007",
          "talents": [
            "531",
            "112",
            "122"
          ],
          "itemNames": [
            "Malefic Roar",
            "War Axe",
            "Ice Hunter's Magic Boots",
            "Legion Sword",
            "Queen's Wings",
            "Blade of Despair"
          ],
          "talentNames": [
            "Killing Spree",
            "Swift",
            "Seasoned Hunter"
          ]
        },
        {
          "name": "Jiizee",
          "hero": "Kimmy",
          "items": [
            "2108",
            "3101",
            "2306",
            "3105",
            "3108",
            "3102"
          ],
          "emblem": "20006",
          "talents": [
            "1231",
            "111",
            "121"
          ],
          "itemNames": [
            "Feather of Heaven",
            "Divine Glaive",
            "Rapid Boots",
            "Glowing Wand",
            "Blood Wings",
            "Holy Crystal"
          ],
          "talentNames": [
            "Weakness Finder",
            "Thrill",
            "Wilderness Blessing"
          ]
        },
        {
          "name": "Aprho",
          "hero": "Carmilla",
          "items": [
            "3203",
            "3561",
            "1202",
            "3212",
            "3210",
            "3202"
          ],
          "emblem": "20003",
          "talents": [
            "331",
            "811",
            "321"
          ],
          "itemNames": [
            "Antique Cuirass",
            "Rapid Boots- Conceal",
            "Leather Jerkin",
            "Chastise Pauldron",
            "Radiant Armor",
            "Guardian Helmet"
          ],
          "talentNames": [
            "Concussive Blast",
            "Agility",
            "Tenacity"
          ]
        },
        {
          "name": "Zeonn",
          "hero": "cici",
          "items": [
            "3208",
            "2201",
            "3204",
            "2013",
            "3013",
            "3009"
          ],
          "emblem": "20007",
          "talents": [
            "731",
            "811",
            "721"
          ],
          "itemNames": [
            "Brute Force Breastplate",
            "Ares Belt",
            "Oracle",
            "War Axe",
            "Sea Halberd",
            "Hunter Strike"
          ],
          "talentNames": [
            "Brave Smite",
            "Agility",
            "Festival of Blood"
          ]
        }
      ],
      "fromMatch": "1106",
      "vs": "BTR",
      "at": 1792317600000,
      "date": "2026-10-18"
    },
    "ONIC": {
      "team": "ONIC",
      "players": [
        {
          "name": "Lutpi",
          "hero": "cici",
          "items": [
            "2301",
            "1001",
            "2013",
            "3208"
          ],
          "emblem": "20007",
          "talents": [
            "731",
            "811",
            "721"
          ],
          "itemNames": [
            "Warrior Boots",
            "Dagger",
            "War Axe",
            "Brute Force Breastplate"
          ],
          "talentNames": [
            "Brave Smite",
            "Agility",
            "Festival of Blood"
          ]
        },
        {
          "name": "Kairi",
          "hero": "Hirara",
          "items": [
            "3432",
            "2014",
            "2001",
            "3009",
            "2013"
          ],
          "emblem": "20005",
          "talents": [
            "531",
            "111",
            "122"
          ],
          "itemNames": [
            "Flame Hunter's Magic Boots",
            "Sky Piercer",
            "Legion Sword",
            "Hunter Strike",
            "War Axe"
          ],
          "talentNames": [
            "Killing Spree",
            "Thrill",
            "Seasoned Hunter"
          ]
        },
        {
          "name": "Killuaa",
          "hero": "Kimmy",
          "items": [
            "3108",
            "3101",
            "2304",
            "3105"
          ],
          "emblem": "20006",
          "talents": [
            "1231",
            "111",
            "621"
          ],
          "itemNames": [
            "Blood Wings",
            "Divine Glaive",
            "Arcane Boots",
            "Glowing Wand"
          ],
          "talentNames": [
            "Weakness Finder",
            "Thrill",
            "Bargain Hunter"
          ]
        },
        {
          "name": "Kiboy",
          "hero": "Carmilla",
          "items": [
            "2205",
            "3522",
            "3212",
            "3206"
          ],
          "emblem": "20003",
          "talents": [
            "331",
            "311",
            "321"
          ],
          "itemNames": [
            "Dreadnaught Armor",
            "Tough Boots - Encourage",
            "Chastise Pauldron",
            "Dominance Ice"
          ],
          "talentNames": [
            "Concussive Blast",
            "Vitality",
            "Tenacity"
          ]
        },
        {
          "name": "Kelra",
          "hero": "Paquito",
          "items": [
            "1001",
            "1001",
            "2302",
            "3009",
            "2013",
            "2208"
          ],
          "emblem": "20007",
          "talents": [
            "631",
            "111",
            "721"
          ],
          "itemNames": [
            "Dagger",
            "Dagger",
            "Tough Boots",
            "Hunter Strike",
            "War Axe",
            "Queen's Wings"
          ],
          "talentNames": [
            "Lethal Ignition",
            "Thrill",
            "Festival of Blood"
          ]
        }
      ],
      "fromMatch": "1107",
      "vs": "TLID",
      "at": 1792328400000,
      "date": "2026-10-18"
    },
    "RRQ": {
      "team": "RRQ",
      "players": [
        {
          "name": "Joshua",
          "hero": "Atlas",
          "items": [
            "3210",
            "2306",
            "3203",
            "1201",
            "3206"
          ],
          "emblem": "20003",
          "talents": [
            "811",
            "121",
            "331"
          ],
          "itemNames": [
            "Radiant Armor",
            "Rapid Boots",
            "Antique Cuirass",
            "Vitality Crystal",
            "Dominance Ice"
          ],
          "talentNames": [
            "Agility",
            "Wilderness Blessing",
            "Concussive Blast"
          ]
        },
        {
          "name": "Faviannn",
          "hero": "Nolan",
          "items": [
            "3001",
            "3207",
            "3432",
            "3009",
            "3008",
            "3004"
          ],
          "emblem": "20005",
          "talents": [
            "111",
            "122",
            "131"
          ],
          "itemNames": [
            "Malefic Roar",
            "Immortality",
            "Flame Hunter's Magic Boots",
            "Hunter Strike",
            "Blade of Despair",
            "Endless Battle"
          ],
          "talentNames": [
            "Thrill",
            "Seasoned Hunter",
            "Impure Rage"
          ]
        },
        {
          "name": "Hajirin",
          "hero": "Zhuxin",
          "items": [
            "3208",
            "3105",
            "2105",
            "2302",
            "3212",
            "3104"
          ],
          "emblem": "20001",
          "talents": [
            "511",
            "121",
            "731"
          ],
          "itemNames": [
            "Brute Force Breastplate",
            "Glowing Wand",
            "Elegant Gem",
            "Tough Boots",
            "Chastise Pauldron",
            "Ice Queen Wand"
          ],
          "talentNames": [
            "Rupture",
            "Wilderness Blessing",
            "Brave Smite"
          ]
        },
        {
          "name": "Said",
          "hero": "Gatotkaca",
          "items": [
            "3521",
            "3212",
            "3210",
            "3206",
            "3207"
          ],
          "emblem": "20003",
          "talents": [
            "711",
            "321",
            "331"
          ],
          "itemNames": [
            "Tough Boots - Conceal",
            "Chastise Pauldron",
            "Radiant Armor",
            "Dominance Ice",
            "Immortality"
          ],
          "talentNames": [
            "Firmness",
            "Tenacity",
            "Concussive Blast"
          ]
        },
        {
          "name": "Arthur",
          "hero": "Freya",
          "items": [
            "3004",
            "2009",
            "3203",
            "2302",
            "3013",
            "2013"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "721",
            "531"
          ],
          "itemNames": [
            "Endless Battle",
            "Golden Staff",
            "Antique Cuirass",
            "Tough Boots",
            "Sea Halberd",
            "War Axe"
          ],
          "talentNames": [
            "Thrill",
            "Festival of Blood",
            "Killing Spree"
          ]
        }
      ],
      "fromMatch": "1104",
      "vs": "GEEK",
      "at": 1792242000000,
      "date": "2026-10-17"
    },
    "TLID": {
      "team": "TLID",
      "players": [
        {
          "name": "Aran",
          "hero": "Freya",
          "items": [
            "133",
            "2009",
            "3203",
            "2301",
            "1002",
            "1002",
            "2013"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "721"
          ],
          "itemNames": [
            "133",
            "Golden Staff",
            "Antique Cuirass",
            "Warrior Boots",
            "Knife",
            "Knife",
            "War Axe"
          ],
          "talentNames": [
            "Thrill",
            "Festival of Blood"
          ]
        },
        {
          "name": "Kevinn",
          "hero": "Aulus",
          "items": [
            "2001",
            "2001",
            "3432",
            "3012",
            "2013",
            "2208"
          ],
          "emblem": "20007",
          "talents": [
            "111",
            "122",
            "531"
          ],
          "itemNames": [
            "Legion Sword",
            "Legion Sword",
            "Flame Hunter's Magic Boots",
            "Rose Gold Meteor",
            "War Axe",
            "Queen's Wings"
          ],
          "talentNames": [
            "Thrill",
            "Seasoned Hunter",
            "Killing Spree"
          ]
        },
        {
          "name": "Drichel",
          "hero": "Zhuxin",
          "items": [
            "2105",
            "2014",
            "2306",
            "3105",
            "3104"
          ],
          "emblem": "20001",
          "talents": [
            "811",
            "321",
            "731"
          ],
          "itemNames": [
            "Elegant Gem",
            "Sky Piercer",
            "Rapid Boots",
            "Glowing Wand",
            "Ice Queen Wand"
          ],
          "talentNames": [
            "Agility",
            "Tenacity",
            "Brave Smite"
          ]
        },
        {
          "name": "Lyoni",
          "hero": "Marcel",
          "items": [
            "1205",
            "3561",
            "2212",
            "3206",
            "3112"
          ],
          "emblem": "20008",
          "talents": [
            "811",
            "121",
            "331"
          ],
          "itemNames": [
            "Hero's Ring",
            "Rapid Boots- Conceal",
            "Thunder Belt",
            "Dominance Ice",
            "Flask of the Oasis"
          ],
          "talentNames": [
            "Agility",
            "Wilderness Blessing",
            "Concussive Blast"
          ]
        },
        {
          "name": "Keven",
          "hero": "Bruno",
          "items": [
            "2308",
            "3002",
            "3005",
            "3015",
            "3003"
          ],
          "emblem": "20007",
          "talents": [
            "1211",
            "621",
            "132"
          ],
          "itemNames": [
            "Demon Boots",
            "Haas' Claws",
            "Windtalker",
            "Malefic Gun",
            "Berserker's Fury"
          ],
          "talentNames": [
            "Fatal",
            "Bargain Hunter",
            "Quantum Charge"
          ]
        }
      ],
      "fromMatch": "1107",
      "vs": "ONIC",
      "at": 1792328400000,
      "date": "2026-10-18"
    }
  }
};
