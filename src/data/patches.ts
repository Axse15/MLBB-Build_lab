/**
 * Catatan patch MLBB, statis (tidak ditarik otomatis). Perbarui file ini setelah patch baru.
 *
 * Sumber utama: MLBBHub (daftar + halaman tiap patch) dan Liquipedia (patch 2.2.16).
 * Aturan isi: hanya yang tertera di sumber. Angka yang sumber tidak sebutkan sengaja dikosongkan,
 * bukan ditebak. `detail: 'counts'` berarti kami hanya punya jumlah perubahan, tanpa nama hero.
 */
export type ServerId = 'original' | 'advanced';
export type ChangeKind = 'buff' | 'nerf' | 'adjust' | 'rework';

export interface Change {
  name: string;
  kind: ChangeKind;
  note: string;
}

export interface BrawlChange {
  hero: string;
  dir: 'up' | 'down';
  note: string;
}

export interface Counts {
  buff: number;
  nerf: number;
  rework?: number;
  adjust: number;
}

export interface Patch {
  version: string;
  server: ServerId;
  /** Tanggal rilis (ISO), zona Asia/Jakarta untuk tampilan. */
  date: string;
  /** Teks status singkat, mis. "Sedang diuji". */
  status?: string;
  /** full = ada nama hero + isi; heroes-only = nama + arah, tanpa angka; counts = hanya jumlah; none = tidak ada data. */
  detail: 'full' | 'heroes-only' | 'counts' | 'none';
  /** Jumlah resmi menurut daftar sumber (bisa tidak sama dengan jumlah hero yang berhasil dirinci). */
  counts?: Counts;
  heroes: Change[];
  items: Change[];
  system: string[];
  brawl?: BrawlChange[];
  /** Catatan kejujuran: apa yang tidak ada / tidak cocok. */
  caveat?: string;
  url: string;
}

export const LAST_VERIFIED = '27 Okt 2026';

export const SERVER_INFO: Record<ServerId, { label: string; blurb: string }> = {
  original: {
    label: 'Original Server',
    blurb: 'Server live yang dimainkan semua orang. Perubahan di sini sudah final untuk patch itu.',
  },
  advanced: {
    label: 'Advanced Server',
    blurb:
      'Server uji. Perubahan sering diubah lagi atau dibatalkan sebelum sampai ke Original, jadi jangan menganggap isinya pasti masuk live.',
  },
};

export const SOURCES = [
  { title: 'MLBBHub: daftar patch notes', url: 'https://mlbbhub.com/patch-notes' },
  { title: 'MLBBHub: Original 2.2.16a', url: 'https://mlbbhub.com/patch-notes/original/2.2.16a' },
  { title: 'MLBBHub: Advanced 2.2.28', url: 'https://mlbbhub.com/patch-notes/advanced/2.2.28' },
  { title: 'MLBBHub: Advanced 2.2.26', url: 'https://mlbbhub.com/patch-notes/advanced/2.2.26' },
  { title: 'Liquipedia: Patch 2.2.16', url: 'https://liquipedia.net/mobilelegends/Patch_2.2.16' },
];

export const PATCHES: Patch[] = [
  // ---------------------------------------------------------------- Original
  {
    version: '2.2.16a',
    server: 'original',
    date: '2026-10-14',
    status: 'Patch live terbaru',
    detail: 'heroes-only',
    counts: { buff: 1, nerf: 4, adjust: 0 },
    heroes: [
      { name: 'Kalea', kind: 'buff', note: 'Potensi solo kill dinaikkan; sebelumnya sulit menekan backline lawan tanpa bantuan tim.' },
      { name: 'Aulus', kind: 'nerf', note: 'Sustain dikurangi; burst early sampai mid game dipertahankan.' },
      { name: 'Hirara', kind: 'nerf', note: 'Frekuensi skill invincibility dikurangi; burst full combo mid-late game sedikit naik.' },
      { name: 'Eudora', kind: 'nerf', note: 'Damage Ultimate dikurangi sedikit di semua level.' },
      { name: 'Rafaela', kind: 'nerf', note: 'Cooldown Skill 1 dan 2 dinaikkan pada level skill tinggi.' },
    ],
    items: [],
    system: [],
    caveat: 'Sumber hanya menjelaskan arah perubahan, tanpa angka pasti. Tidak ada perubahan item, emblem, atau sistem yang tercantum.',
    url: 'https://mlbbhub.com/patch-notes/original/2.2.16a',
  },
  {
    version: '2.2.16',
    server: 'original',
    date: '2026-09-16',
    detail: 'full',
    counts: { buff: 12, nerf: 6, rework: 2, adjust: 5 },
    heroes: [
      { name: 'Masha', kind: 'rework', note: 'Rework total: kini Berserker yang masuk status Feral dengan memecah Wound musuh.' },
      { name: 'Bruno', kind: 'rework', note: 'Volley Shot dan Worldie diubah, Slide di-buff.' },
      { name: 'Argus', kind: 'buff', note: 'Movement Speed 240 → 260; damage Ultimate naik.' },
      { name: 'Kalea', kind: 'buff', note: 'Wavebreaker damage 200-350 → 200-450, cooldown 4s → 3,5s.' },
      { name: 'Karina', kind: 'buff', note: 'Dance of Blades cooldown 7s → 6s.' },
      { name: 'Kaja', kind: 'buff', note: 'Ring of Order cooldown 7s → 5,5s.' },
      { name: 'Cici', kind: 'buff', note: 'Performer’s Delight spell vamp 0,75% → 1,25% per stack.' },
      { name: 'Alpha', kind: 'buff', note: 'Passive kini scale dengan Total Physical Attack; Force Swing diperkuat.' },
      { name: 'Kagura', kind: 'buff', note: 'Movement Speed Seimei Umbrella diperbaiki.' },
      { name: 'Edith', kind: 'buff', note: 'Onward dan Primal Wrath diperkuat.' },
      { name: 'Kadita', kind: 'buff', note: 'Passive Thalassophobia +10% Movement Speed di river.' },
      { name: 'Paquito', kind: 'nerf', note: 'Jab damage 300-800 dengan bonus 210% TPA (sebelumnya 350-750 dan 230%).' },
      { name: 'Miya', kind: 'nerf', note: 'Moonlight Shadow 25 (+20% TPA), dari 30 (+25%).' },
      { name: 'Melissa', kind: 'nerf', note: 'Bonus Attack Speed Falling! diturunkan; Eyes On You dilemahkan.' },
      { name: 'Hanabi', kind: 'nerf', note: 'Bounce berulang pada target yang sama kena damage -30%.' },
      { name: 'Yi Sun-shin', kind: 'nerf', note: 'Cooldown Traceless 12-9s (dari 12-7s).' },
      { name: 'Marcel', kind: 'nerf', note: 'Framed Moment damage 300-650, cooldown naik.' },
      { name: 'Aulus', kind: 'nerf', note: 'Damage Undying Fury diturunkan. (Di sumber yang sama, ramp-up dan cooldown Power of Axe 10-8s juga disesuaikan.)' },
      { name: 'Sun', kind: 'nerf', note: 'Doppelganger lebih lemah; cooldown Clone Techniques diubah.' },
      { name: 'Aldous', kind: 'adjust', note: 'Shield Contract Transform 350 (dari 500); Soul Steal diperkuat.' },
      { name: 'Lukas', kind: 'adjust', note: 'Lebih kuat di Exp Lane, Resolve Gain naik; Unleash the Beast diturunkan.' },
      { name: 'Odette', kind: 'adjust', note: 'Dua cast Swan Song dihapus; bisa bergerak saat Ultimate.' },
      { name: 'Hylos', kind: 'adjust', note: 'Passive Thickened Blood diubah.' },
    ],
    items: [],
    system: [
      'Creep gold Horned Lizard, Fire Beetle, Lava Golem turun 13%. Gold deficit Team Bounty 2.000 → 1.500. Gold minion sedikit turun.',
      'Annual Map Change mulai 28 September: Revealing Wisps, Healing Turtle, Golden Turret. Art Sanctum Island diperbarui.',
      'Enhanced Basic Attack dari Emblem, Battle Spell, dan Equipment tidak memicu efek saat menyerang Turret.',
      'Ranked: S41 berakhir, S42 dimulai 16 September.',
      'Fitur baru: Namecard, Super Like, Auction House (Sale Reminder), Season Achievement, Supreme Medal, Multiplayer Training Camp.',
    ],
    caveat:
      'Jumlah resmi di MLBBHub (12 buff, 6 nerf, 2 rework, 5 adjust) tidak sama dengan daftar yang berhasil saya rinci dari Liquipedia (9 buff, 8 nerf, 2 rework, 5 adjust). Selisihnya kemungkinan soal cara kedua situs mengelompokkan perubahan (mis. Aulus muncul di nerf dan adjust), tapi saya tidak bisa memastikannya. Daftar ini bisa tidak lengkap; cek halaman sumber untuk angka lengkap.',
    url: 'https://liquipedia.net/mobilelegends/Patch_2.2.16',
  },
  {
    version: '2.1.95a',
    server: 'original',
    date: '2026-08-25',
    detail: 'counts',
    counts: { buff: 2, nerf: 1, adjust: 1 },
    heroes: [],
    items: [],
    system: [],
    caveat: 'Hanya jumlah dari daftar sumber; nama hero tidak saya ambil.',
    url: 'https://mlbbhub.com/patch-notes',
  },

  // ---------------------------------------------------------------- Advanced
  {
    version: '2.2.28',
    server: 'advanced',
    date: '2026-10-24',
    status: 'Sedang diuji',
    detail: 'full',
    counts: { buff: 6, nerf: 3, adjust: 2 },
    heroes: [
      { name: 'Aldous', kind: 'buff', note: 'Skill 1 dikembalikan; Skill 2 dapat Damage Reduction lebih besar; downtime early game berkurang.' },
      { name: 'Gloo', kind: 'buff', note: 'Perubahan eksperimental dibatalkan.' },
      { name: 'Kaja', kind: 'buff', note: 'Lebih banyak cara bertahan di state Soaring; mobilitas saat Soaring naik.' },
      { name: 'Melissa', kind: 'buff', note: 'Perubahan patch sebelumnya dikembalikan sebagian untuk memulihkan damage late game.' },
      { name: 'Atlas', kind: 'nerf', note: 'Durasi Frigid Breath dikurangi.' },
      { name: 'Masha', kind: 'nerf', note: 'Damage Passive berkelanjutan di late game sedikit dikurangi.' },
      { name: 'Kagura', kind: 'adjust', note: 'Indikator visual jarak maksimum Seimei Umbrella dioptimalkan.' },
    ],
    items: [
      { name: 'Antique Cuirass', kind: 'buff', note: 'Performa dinilai kurang dibanding Chastise Pauldron.' },
      { name: 'Chastise Pauldron', kind: 'nerf', note: 'Terlalu efektif melawan hero berbasis Attack Speed.' },
      { name: 'Gold Lane Siege Minion', kind: 'buff', note: 'Extra Gold early game 40% → 60%.' },
      { name: 'Golden Turret', kind: 'adjust', note: 'Perubahan minggu lalu dibatalkan. Base Turret HP Increase 1.000 → 2.000; Team Gold Outer Turret 100 → 90; Inner Turret 140 → 120.' },
    ],
    system: [
      'Turret: durasi proteksi Second Turret dan Base 2 menit → 1 menit; Damage Reduction saat protected 80% → 50%.',
      'Battle Spell Aegis: shield 750 (+90 per level hero) → 1.500 (+180 per level hero).',
      'Auction House: entri "Item Sources" untuk item Bang Bang Card.',
      'Community Academy (trial) dinonaktifkan sementara. Tablet: layout antarmuka dioptimalkan.',
      'Custom UI: setup tombol kiri ukuran medium dan large dinonaktifkan sementara.',
      'Mode Bang Bang (Card): ~50 hero dinaikkan statnya (mis. Zilong, Kalea, Granger, Lapu-Lapu); Obsidia, Cici, Cyclops, Natan, Irithel, Hanabi, Claude, Valir, Moskov diturunkan.',
    ],
    brawl: [
      { hero: 'Aamon', dir: 'up', note: 'DMG Taken -2% (baru)' },
      { hero: 'Chip', dir: 'up', note: 'DMG +6% → +8%' },
      { hero: 'Franco', dir: 'up', note: 'Skill DMG +10%' },
      { hero: 'Gatotkaca', dir: 'up', note: 'DMG Taken +10% → +8%' },
      { hero: 'Helcurt', dir: 'up', note: 'DMG +10% → +12%' },
      { hero: 'Joy', dir: 'up', note: 'DMG +10% → +12%' },
      { hero: 'Lancelot', dir: 'up', note: 'DMG Taken -4% → -6%' },
      { hero: 'Lunox', dir: 'up', note: 'DMG Taken -2% (baru)' },
      { hero: 'Luo Yi', dir: 'up', note: 'DMG Taken -2% → -4%' },
      { hero: 'Masha', dir: 'up', note: 'DMG Taken -4% (baru)' },
      { hero: 'Melissa', dir: 'up', note: 'DMG -12% → -10%' },
      { hero: 'Nolan', dir: 'up', note: 'Energy Cost Skill 1 dan 2 dikurangi' },
      { hero: 'Yi Sun-shin', dir: 'up', note: 'DMG Taken -4% (baru)' },
      { hero: 'Zhuxin', dir: 'up', note: 'DMG +16% → +20%' },
      { hero: 'Aulus', dir: 'down', note: 'DMG Taken +4% → +8%' },
      { hero: 'Barats', dir: 'down', note: 'DMG -2% (baru)' },
      { hero: 'Brody', dir: 'down', note: 'DMG Taken +2% (baru)' },
      { hero: 'Bruno', dir: 'down', note: 'DMG -10% → -12%; DMG Taken +4% (baru)' },
      { hero: 'Cici', dir: 'down', note: 'DMG Taken -8% → -4%' },
      { hero: 'Cyclops', dir: 'down', note: 'DMG Taken +6% → +10%' },
      { hero: 'Edith', dir: 'down', note: 'DMG Taken +4% → +8%' },
      { hero: 'Hilda', dir: 'down', note: 'DMG Taken -8% → -6%' },
      { hero: 'Lukas', dir: 'down', note: 'DMG -2% → -6%' },
      { hero: 'Martis', dir: 'down', note: 'DMG +6% → +4%' },
      { hero: 'Minotaur', dir: 'down', note: 'DMG Taken +8% → +4%; Healing -6% (baru)' },
      { hero: 'Natan', dir: 'down', note: 'DMG Taken +8% → +10%' },
      { hero: 'Phoveus', dir: 'down', note: 'DMG Taken +6% → +10%' },
      { hero: 'Popol and Kupa', dir: 'down', note: 'DMG Taken +2% (baru)' },
      { hero: 'Rafaela', dir: 'down', note: 'DMG Taken +10% → +12%' },
      { hero: 'Roger', dir: 'down', note: 'DMG Taken -6% → -4%' },
      { hero: 'Terizla', dir: 'down', note: 'DMG Taken +14% → +18%' },
      { hero: 'Valir', dir: 'down', note: 'DMG Taken +2% (baru)' },
      { hero: 'Yu Zhong', dir: 'down', note: 'DMG Taken -4% → -2%' },
    ],
    caveat:
      'Tidak ada perubahan emblem. Beberapa baris menandai pembatalan perubahan minggu sebelumnya (Gloo, Golden Turret, Melissa), contoh nyata kenapa isi Advanced Server tidak bisa dianggap pasti masuk live.',
    url: 'https://mlbbhub.com/patch-notes/advanced/2.2.28',
  },
  {
    version: '2.2.26',
    server: 'advanced',
    date: '2026-10-15',
    detail: 'full',
    counts: { buff: 3, nerf: 3, rework: 1, adjust: 3 },
    heroes: [
      { name: 'Natalia', kind: 'rework', note: 'Passive, Skill 2, dan Ultimate dirancang ulang; Skill 1 (Claw Dash) dipertahankan.' },
      { name: 'Aldous', kind: 'buff', note: 'Damage early-mid game sedikit dinaikkan.' },
      { name: 'Belerick', kind: 'buff', note: 'Semua perubahan terbaru dikembalikan.' },
      { name: 'Lukas', kind: 'buff', note: 'Dikuatkan karena penyesuaian sebelumnya dianggap terlalu melemahkan.' },
      { name: 'Atlas', kind: 'nerf', note: 'Durasi Frigid Breath dikurangi karena Passive terlalu sering membekukan musuh.' },
      { name: 'Dori', kind: 'nerf', note: 'Frekuensi cast skill sedikit dikurangi. (Hero ke-134, belum ada di daftar 133 hero aplikasi ini; menurut pemberitaan belum rilis di Original.)' },
      { name: 'Gloo', kind: 'nerf', note: 'Damage dikurangi.' },
      { name: 'Barats', kind: 'adjust', note: 'Perubahan eksperimental minggu lalu dikembalikan.' },
      { name: 'Masha', kind: 'adjust', note: 'Efek slow pindah ke Skill 2, jalur Skill 2 dipersempit, bonus damage Skill 1 dan base damage Ultimate dikurangi.' },
      { name: 'Popol and Kupa', kind: 'adjust', note: 'Ramp-up sebelum masuk combat dipersingkat; efektivitas ganking naik.' },
    ],
    items: [],
    system: [
      'Battlefield (uji coba): Glowing Lantern. Satu lane dipilih acak; tim yang lebih dulu mengalahkan Lantern Bearer musuh dapat hadiah tim.',
      'Golden Turret: Extra HP Inner dan Base Turret dihapus; semua Turret dapat Hybrid Defense jauh lebih tinggi selama 12 menit pertama.',
      'Healing Turtle: Gold dan EXP dari membunuh Turtle musuh naik signifikan, dibagi ke sekutu dalam jangkauan.',
      'MLBB Community Academy (beta): Layla’s Workshop digabung ke bagian panduan komunitas baru.',
      'Mode Brawl/Bang Bang: Healing global -25% sebelum menit 6 dan -50% sesudahnya; beberapa kartu Epic/Legend diturunkan, Slow but Deadly turun dari Legend ke Epic.',
    ],
    caveat: 'Tidak ada perubahan item atau emblem. Angka stat hero mode Brawl tidak dicantumkan sumber.',
    url: 'https://mlbbhub.com/patch-notes/advanced/2.2.26',
  },
  {
    version: '2.2.24',
    server: 'advanced',
    date: '2026-10-09',
    detail: 'none',
    heroes: [],
    items: [],
    system: [],
    caveat: 'Daftar sumber tidak mencantumkan jumlah perubahan dan isinya belum saya ambil.',
    url: 'https://mlbbhub.com/patch-notes',
  },
  {
    version: '2.2.22a',
    server: 'advanced',
    date: '2026-09-30',
    detail: 'counts',
    counts: { buff: 3, nerf: 0, adjust: 3 },
    heroes: [],
    items: [],
    system: [],
    caveat: 'Hanya jumlah dari daftar sumber; nama hero tidak saya ambil.',
    url: 'https://mlbbhub.com/patch-notes/advanced/2.2.22a',
  },
  {
    version: '2.2.22',
    server: 'advanced',
    date: '2026-09-23',
    detail: 'counts',
    counts: { buff: 0, nerf: 2, adjust: 2 },
    heroes: [],
    items: [],
    system: [],
    caveat: 'Hanya jumlah dari daftar sumber; nama hero tidak saya ambil.',
    url: 'https://mlbbhub.com/patch-notes/advanced/2.2.22',
  },
];
