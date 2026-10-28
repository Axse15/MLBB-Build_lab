/**
 * Data MPL ID Season 18. STATIS: diperiksa manual pada 27 Okt 2026 dari laporan media.
 * Aplikasi tidak menarik data otomatis. Kalau jadwal berubah, edit file ini.
 *
 * Yang terkonfirmasi di sumber: venue, rentang tanggal 4-8 Nov 2026, enam tim lolos,
 * format Bo5 (Grand Final Bo7), dan susunan Match 1-4 beserta jamnya.
 * Yang TIDAK disebut sumber: tanggal pasti Match 2, 3, dan 4. Itu ditandai di `dateNote`.
 */

export const LAST_VERIFIED = '27 Okt 2026';

export interface MplTeam {
  id: string;
  name: string;
  short: string;
}

export const TEAMS: Record<string, MplTeam> = {
  tlid: { id: 'tlid', name: 'Team Liquid ID', short: 'TLID' },
  navi: { id: 'navi', name: 'Navi', short: 'NAVI' },
  ae: { id: 'ae', name: 'Alter Ego Esports', short: 'AE' },
  onic: { id: 'onic', name: 'Onic', short: 'ONIC' },
  btr: { id: 'btr', name: 'Bigetron by Vitality', short: 'BTR' },
  evos: { id: 'evos', name: 'EVOS', short: 'EVOS' },
  dewa: { id: 'dewa', name: 'Dewa United Esports', short: 'DEWA' },
  rrq: { id: 'rrq', name: 'RRQ Hoshi', short: 'RRQ' },
  geek: { id: 'geek', name: 'Geek Fam', short: 'GEEK' },
};

export const QUALIFIED = ['tlid', 'navi', 'ae', 'onic', 'btr', 'evos'];
export const ELIMINATED = ['dewa', 'rrq', 'geek'];

export type MatchId = 'M1' | 'M2' | 'M3' | 'M4';
export type Slot = { team: string } | { winnerOf: MatchId };

export interface PlayoffMatch {
  id: MatchId;
  stage: string;
  /** ISO tanggal (WIB) atau null jika belum diumumkan */
  date: string | null;
  dateNote: string;
  /** Jam mulai WIB */
  time: string;
  a: Slot;
  b: Slot;
  format: string;
}

export const MATCHES: PlayoffMatch[] = [
  {
    id: 'M1',
    stage: 'Quarterfinal',
    date: '2026-11-04',
    dateNote: 'Hari pertama Playoff (terkonfirmasi)',
    time: '13:00',
    a: { team: 'ae' },
    b: { team: 'onic' },
    format: 'Bo5',
  },
  {
    id: 'M2',
    stage: 'Quarterfinal',
    date: '2026-11-04',
    dateNote: 'Hari terakhir belum dikonfirmasi; diasumsikan hari pertama',
    time: '18:00',
    a: { team: 'btr' },
    b: { team: 'evos' },
    format: 'Bo5',
  },
  {
    id: 'M3',
    stage: 'Semifinal Upper Bracket',
    date: null,
    dateNote: 'Tanggal belum diumumkan sumber',
    time: '13:00',
    a: { team: 'navi' },
    b: { winnerOf: 'M1' },
    format: 'Bo5',
  },
  {
    id: 'M4',
    stage: 'Semifinal Upper Bracket',
    date: null,
    dateNote: 'Tanggal belum diumumkan sumber',
    time: '18:00',
    a: { team: 'tlid' },
    b: { winnerOf: 'M2' },
    format: 'Bo5',
  },
];

export const PLAYOFF_START_ISO = '2026-11-04T13:00:00+07:00';

export const EVENT = {
  venue: 'JIE Convention, Surabaya',
  dates: '4 – 8 November 2026',
  regular: 'Regular Season: 14 Agustus – 18 Oktober 2026, 9 tim, double round robin Bo3',
  streaming: 'https://www.youtube.com/@MPLIndonesia',
};

export const SOURCES: { title: string; url: string }[] = [
  {
    title: 'detikInet: Jadwal Playoff MPL ID S18, mulai main 4 November 2026',
    url: 'https://inet.detik.com/esport/d-8720959/jadwal-playoff-mpl-id-s18-mulai-main-4-november-2026',
  },
  {
    title: 'detikInet: Hasil dan klasemen akhir Reguler Season MPL ID S18',
    url: 'https://inet.detik.com/esport/d-8714076/hasil-dan-klasemen-akhir-reguler-season-mpl-id-s18',
  },
  {
    title: 'Gizmologi: Hasil MPL ID S18 Week 8, enam tim lolos ke Surabaya',
    url: 'https://gizmologi.id/game/hasil-mpl-id-s18-week-8-rrq-gagal-playoff/',
  },
  {
    title: 'Medcom: Kapan MPL ID Season 18 dimulai, jadwal dan format',
    url: 'https://www.medcom.id/teknologi/esports/zNPRg6Vk-kapan-mpl-id-season-18-dimulai-cek-jadwal-lengkapnya-di-sini',
  },
];
