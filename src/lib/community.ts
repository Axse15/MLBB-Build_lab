/**
 * Lapisan data komunitas: tipe, validasi baris dari server, dan pemanggilan Supabase.
 * Semua data dari server diperlakukan tidak tepercaya: baris divalidasi bentuknya dan isi `payload`
 * didekode lewat `decodeBuild` / `decodeTeam` (validasi ketat yang sama dengan tautan bagikan).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type PostKind = 'build' | 'team';
export type SortKey = 'baru' | 'populer' | 'adu';
export type ReportReason = 'spam' | 'kasar' | 'menyesatkan' | 'lainnya';

export const PAGE = 12;
export const MIN_DUELS_FOR_RANK = 3;
export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam atau iklan' },
  { id: 'kasar', label: 'Kasar atau menyinggung' },
  { id: 'menyesatkan', label: 'Menyesatkan' },
  { id: 'lainnya', label: 'Lainnya' },
];

export interface Post {
  id: string;
  userId: string;
  author: string;
  kind: PostKind;
  title: string;
  note: string;
  payload: string;
  heroes: string[];
  hidden: boolean;
  likes: number;
  comments: number;
  duelPlayed: number;
  duelWins: number;
  createdAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  author: string;
  body: string;
  hidden: boolean;
  createdAt: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 100_000): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Nama penulis dari kolom embed `profiles`; PostgREST bisa mengirim objek atau larik 1 elemen. */
function authorOf(v: unknown): string {
  const p = Array.isArray(v) ? v[0] : v;
  const n = isObj(p) ? str(p.display_name, 60) : null;
  return n && n.trim() ? n : 'Pemain';
}

const when = (v: unknown): number => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : 0;
};

export function parsePost(row: unknown): Post | null {
  if (!isObj(row)) return null;
  const kind = row.kind === 'build' || row.kind === 'team' ? row.kind : null;
  const id = row.id;
  const userId = row.user_id;
  const title = str(row.title, 200);
  const payload = str(row.payload, 8000);
  const heroes = Array.isArray(row.heroes) && row.heroes.every((h) => typeof h === 'string' && h.length <= 60) ? (row.heroes as string[]) : null;
  if (!kind || !isUuid(id) || !isUuid(userId) || title === null || payload === null || !heroes) return null;
  return {
    id,
    userId,
    author: authorOf(row.profiles),
    kind,
    title,
    note: str(row.note, 1000) ?? '',
    payload,
    heroes,
    hidden: row.hidden === true,
    likes: int(row.like_count) ?? 0,
    comments: int(row.comment_count) ?? 0,
    duelPlayed: int(row.duel_played) ?? 0,
    duelWins: int(row.duel_wins) ?? 0,
    createdAt: when(row.created_at),
  };
}

export function parseComment(row: unknown): Comment | null {
  if (!isObj(row)) return null;
  const body = str(row.body, 2000);
  if (!isUuid(row.id) || !isUuid(row.post_id) || !isUuid(row.user_id) || body === null) return null;
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    author: authorOf(row.profiles),
    body,
    hidden: row.hidden === true,
    createdAt: when(row.created_at),
  };
}

const parsePosts = (rows: unknown): Post[] => (Array.isArray(rows) ? rows.map(parsePost).filter((p): p is Post => p !== null) : []);

/** Pesan galat server -> teks Indonesia. Pesan trigger di schema.sql dipakai sebagai kode. */
export function friendlyError(e: unknown): string {
  const o = isObj(e) ? e : {};
  const msg = typeof o.message === 'string' ? o.message : e instanceof Error ? e.message : '';
  const code = typeof o.code === 'string' ? o.code : '';
  const table: [string, string][] = [
    ['rate_limit_posts', 'Terlalu banyak posting dalam satu jam (maksimal 10). Coba lagi nanti.'],
    ['post_quota', 'Kamu sudah mencapai batas 60 tulisan. Hapus yang lama dulu.'],
    ['rate_limit_comments', 'Terlalu banyak komentar dalam satu jam (maksimal 30). Coba lagi nanti.'],
    ['rate_limit_reports', 'Terlalu banyak laporan dalam satu jam. Coba lagi nanti.'],
    ['rate_limit_votes', 'Terlalu banyak suara dalam satu jam. Istirahat dulu.'],
    ['payload_invalid', 'Isi build/komposisi tidak dikenali server.'],
    ['team_empty', 'Komposisi belum berisi hero.'],
    ['kind_invalid', 'Jenis tulisan tidak valid.'],
    ['duel_own', 'Kamu tidak bisa memilih di adu yang memuat tulisanmu sendiri.'],
    ['duel_hero', 'Adu build hanya antar build hero yang sama.'],
    ['duel_kind', 'Adu hanya antar jenis yang sama.'],
    ['duel_missing', 'Salah satu tulisan sudah dihapus atau disembunyikan.'],
    ['duel_same', 'Pasangan adu tidak valid.'],
    ['bookmark_quota', 'Simpananmu sudah penuh (maksimal 200). Lepas beberapa dulu.'],
    ['profiles_bio_check', 'Bio maksimal 160 karakter dan tanpa karakter kontrol.'],
    ['profiles_main_hero_check', 'Hero utama tidak valid.'],
    ['profiles_display_name_check', 'Nama tampilan 1 sampai 24 karakter.'],
  ];
  for (const [k, t] of table) if (msg.includes(k)) return t;
  if (code === '23505') return 'Sudah pernah dilakukan.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Tidak diizinkan. Coba masuk ulang, atau tulisan ini sudah disembunyikan.';
  if (code === 'PGRST301' || /jwt/i.test(msg)) return 'Sesi login habis. Masuk lagi.';
  if (code === '23514') return 'Isi tidak memenuhi batas panjang atau format.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'Tidak bisa terhubung ke server komunitas. Cek koneksi atau pemblokir iklan.';
  return msg ? `Gagal: ${msg}` : 'Gagal. Coba lagi.';
}

/** Buang karakter yang berarti di sintaks filter PostgREST; sisakan huruf, angka, spasi, tanda hubung. */
export function cleanQuery(q: string): string {
  return q.replace(/[^\p{L}\p{N} '-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

const POST_COLS =
  'id,user_id,kind,title,note,payload,heroes,hidden,like_count,comment_count,duel_played,duel_wins,created_at,profiles!posts_user_id_fkey(display_name)';

function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface FeedQuery {
  kind: PostKind;
  hero?: string;
  q?: string;
  sort: SortKey;
  /** Hanya tulisan milik pengguna ini (termasuk yang disembunyikan). */
  userId?: string;
  offset: number;
  /** Jumlah baris per halaman (default PAGE). */
  limit?: number;
}

export async function listPosts(db: SupabaseClient, f: FeedQuery): Promise<{ posts: Post[]; more: boolean }> {
  let req = db.from('posts').select(POST_COLS).eq('kind', f.kind);
  if (f.hero) req = req.contains('heroes', [f.hero]);
  if (f.userId) req = req.eq('user_id', f.userId);
  const needle = cleanQuery(f.q ?? '');
  if (needle) req = req.or(`title.ilike.*${needle}*,note.ilike.*${needle}*`);
  if (f.sort === 'adu') req = req.gte('duel_played', MIN_DUELS_FOR_RANK).order('duel_score', { ascending: false }).order('duel_played', { ascending: false });
  else if (f.sort === 'populer') req = req.order('like_count', { ascending: false }).order('comment_count', { ascending: false }).order('created_at', { ascending: false });
  else req = req.order('created_at', { ascending: false });
  req = req.order('id');
  const size = f.limit ?? PAGE;
  const rows = must(await req.range(f.offset, f.offset + size));
  const all = parsePosts(rows);
  return { posts: all.slice(0, size), more: Array.isArray(rows) && rows.length > size };
}

export async function getPost(db: SupabaseClient, id: string): Promise<Post | null> {
  if (!isUuid(id)) return null;
  const rows = must(await db.from('posts').select(POST_COLS).eq('id', id).limit(1));
  return parsePosts(rows)[0] ?? null;
}

export async function getPosts(db: SupabaseClient, ids: string[]): Promise<Post[]> {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return [];
  return parsePosts(must(await db.from('posts').select(POST_COLS).in('id', ok)));
}

export async function publish(db: SupabaseClient, kind: PostKind, title: string, note: string, payload: string): Promise<Post> {
  const rows = must(await db.from('posts').insert({ kind, title: title.trim(), note: note.trim(), payload }).select(POST_COLS));
  const p = parsePosts(rows)[0];
  if (!p) throw new Error('Respons server tidak dikenali');
  return p;
}

export async function deletePost(db: SupabaseClient, id: string): Promise<void> {
  const rows = must(await db.from('posts').delete().eq('id', id).select('id'));
  if (Array.isArray(rows) && rows.length === 0) throw new Error('Tulisan tidak ditemukan atau bukan milikmu');
}

/** ID tulisan (dari `ids`) yang sudah di-like pengguna ini. RLS membatasi ke milik sendiri. */
export async function likedIds(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return new Set();
  const rows = must(await db.from('likes').select('post_id').in('post_id', ok));
  return new Set((Array.isArray(rows) ? rows : []).map((r) => (isObj(r) ? r.post_id : null)).filter(isUuid));
}

export async function setLike(db: SupabaseClient, postId: string, userId: string, on: boolean): Promise<void> {
  if (on) must(await db.from('likes').insert({ post_id: postId }));
  else must(await db.from('likes').delete().eq('post_id', postId).eq('user_id', userId));
}

export async function listComments(db: SupabaseClient, postId: string): Promise<Comment[]> {
  const rows = must(
    await db.from('comments').select('id,post_id,user_id,body,hidden,created_at,profiles!comments_user_id_fkey(display_name)').eq('post_id', postId).order('created_at', { ascending: true }).limit(200),
  );
  return Array.isArray(rows) ? rows.map(parseComment).filter((c): c is Comment => c !== null) : [];
}

export async function addComment(db: SupabaseClient, postId: string, body: string): Promise<void> {
  must(await db.from('comments').insert({ post_id: postId, body: body.trim() }));
}

export async function deleteComment(db: SupabaseClient, id: string): Promise<void> {
  must(await db.from('comments').delete().eq('id', id));
}

export async function report(db: SupabaseClient, target: { post?: string; comment?: string }, reason: ReportReason): Promise<void> {
  must(await db.from('reports').insert({ post_id: target.post ?? null, comment_id: target.comment ?? null, reason }));
}

/** Pasangan acak yang belum kamu pilih (build: hero sama). Kosong = belum ada pasangan. */
export async function nextDuel(db: SupabaseClient, kind: PostKind, hero?: string): Promise<[Post, Post] | null> {
  const rows = must(await db.rpc('next_duel', { p_kind: kind, p_hero: hero || null }));
  const posts = Array.isArray(rows) ? rows.map(parsePost).filter((p): p is Post => p !== null) : [];
  return posts.length === 2 ? [posts[0], posts[1]] : null;
}

export async function vote(db: SupabaseClient, a: string, b: string, winner: string): Promise<void> {
  must(await db.from('duel_votes').insert({ post_a: a, post_b: b, winner }));
}

export async function myProfileName(db: SupabaseClient, userId: string): Promise<string | null> {
  const rows = must(await db.from('profiles').select('display_name').eq('id', userId).limit(1));
  const r = Array.isArray(rows) ? rows[0] : null;
  return isObj(r) ? str(r.display_name, 60) : null;
}

export async function ensureProfile(db: SupabaseClient): Promise<void> {
  must(await db.rpc('ensure_profile'));
}

export async function renameMe(db: SupabaseClient, userId: string, name: string): Promise<string> {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  if (!clean) throw new Error('Nama tidak boleh kosong');
  const rows = must(await db.from('profiles').update({ display_name: clean }).eq('id', userId).select('id'));
  if (Array.isArray(rows) && rows.length === 0) throw new Error('Profil tidak ditemukan');
  return clean;
}

// ---------------------------------------------------------------- Profil

export interface Profile {
  id: string;
  name: string;
  bio: string;
  /** id hero utama (slug) atau null. */
  mainHero: string | null;
  joinedAt: number;
}

export const BIO_MAX = 160;
const HERO_ID = /^[a-z0-9-]{1,60}$/;

export function parseProfile(row: unknown): Profile | null {
  if (!isObj(row) || !isUuid(row.id)) return null;
  const name = str(row.display_name, 60);
  if (!name || !name.trim()) return null;
  return {
    id: row.id,
    name,
    bio: str(row.bio, 400) ?? '',
    mainHero: typeof row.main_hero === 'string' && HERO_ID.test(row.main_hero) ? row.main_hero : null,
    joinedAt: when(row.created_at),
  };
}

export async function getProfile(db: SupabaseClient, id: string): Promise<Profile | null> {
  if (!isUuid(id)) return null;
  const rows = must(await db.from('profiles').select('id,display_name,bio,main_hero,created_at').eq('id', id).limit(1));
  return parseProfile(Array.isArray(rows) ? rows[0] : null);
}

export interface ProfileStats {
  posts: number;
  builds: number;
  teams: number;
  likes: number;
  comments: number;
  duelPlayed: number;
  duelWins: number;
  /** Hero yang paling sering muncul di tulisan pengguna ini, terbanyak dulu. */
  topHeroes: { id: string; count: number }[];
}

/** Hitung hero terbanyak dari daftar larik hero. Seri diurutkan menurut id supaya hasilnya stabil. */
export function tallyHeroes(lists: string[][], top = 5): { id: string; count: number }[] {
  const n = new Map<string, number>();
  for (const l of lists) for (const h of new Set(l)) n.set(h, (n.get(h) ?? 0) + 1);
  return [...n.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, top);
}

/** Statistik dari baris ringan (tanpa payload). Baris yang bentuknya salah dilewati. */
export function statsFrom(rows: unknown): ProfileStats {
  const out: ProfileStats = { posts: 0, builds: 0, teams: 0, likes: 0, comments: 0, duelPlayed: 0, duelWins: 0, topHeroes: [] };
  const heroes: string[][] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!isObj(r) || (r.kind !== 'build' && r.kind !== 'team')) continue;
    out.posts++;
    if (r.kind === 'build') out.builds++;
    else out.teams++;
    out.likes += int(r.like_count) ?? 0;
    out.comments += int(r.comment_count) ?? 0;
    out.duelPlayed += int(r.duel_played) ?? 0;
    out.duelWins += int(r.duel_wins) ?? 0;
    if (Array.isArray(r.heroes)) heroes.push(r.heroes.filter((h): h is string => typeof h === 'string' && h.length <= 60));
  }
  out.topHeroes = tallyHeroes(heroes);
  return out;
}

export async function profileStats(db: SupabaseClient, userId: string): Promise<ProfileStats> {
  if (!isUuid(userId)) return statsFrom([]);
  const rows = must(await db.from('posts').select('kind,heroes,like_count,comment_count,duel_played,duel_wins').eq('user_id', userId).limit(100));
  return statsFrom(rows);
}

export async function updateProfile(db: SupabaseClient, userId: string, p: { name: string; bio: string; mainHero: string | null }): Promise<Profile> {
  const name = p.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  if (!name) throw new Error('Nama tidak boleh kosong');
  const bio = p.bio.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, BIO_MAX);
  const mainHero = p.mainHero && HERO_ID.test(p.mainHero) ? p.mainHero : null;
  const rows = must(
    await db.from('profiles').update({ display_name: name, bio, main_hero: mainHero }).eq('id', userId).select('id,display_name,bio,main_hero,created_at'),
  );
  const prof = parseProfile(Array.isArray(rows) ? rows[0] : null);
  if (!prof) throw new Error('Profil tidak ditemukan');
  return prof;
}

// ---------------------------------------------------------------- Simpanan

/** ID tulisan (dari `ids`) yang sudah kamu simpan. */
export async function bookmarkedIds(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const ok = ids.filter(isUuid);
  if (ok.length === 0) return new Set();
  const rows = must(await db.from('bookmarks').select('post_id').in('post_id', ok));
  return new Set((Array.isArray(rows) ? rows : []).map((r) => (isObj(r) ? r.post_id : null)).filter(isUuid));
}

export async function setBookmark(db: SupabaseClient, postId: string, userId: string, on: boolean): Promise<void> {
  if (on) must(await db.from('bookmarks').insert({ post_id: postId }));
  else must(await db.from('bookmarks').delete().eq('post_id', postId).eq('user_id', userId));
}

/** Simpananmu, terbaru dulu. Tulisan yang sudah dihapus/disembunyikan otomatis tidak muncul. */
export async function listBookmarks(db: SupabaseClient, offset: number, limit = PAGE): Promise<{ posts: Post[]; more: boolean }> {
  const rows = must(await db.from('bookmarks').select('post_id,created_at').order('created_at', { ascending: false }).range(offset, offset + limit));
  const marks = (Array.isArray(rows) ? rows : []).filter(isObj).filter((r) => isUuid(r.post_id));
  const page = marks.slice(0, limit).map((r) => r.post_id as string);
  const posts = await getPosts(db, page);
  const byId = new Map(posts.map((p) => [p.id, p]));
  return { posts: page.map((id) => byId.get(id)).filter((p): p is Post => !!p), more: marks.length > limit };
}

// ---------------------------------------------------------------- Aktivitas & tren

export interface Activity {
  id: string;
  postId: string;
  postTitle: string;
  author: string;
  body: string;
  createdAt: number;
}

export function parseActivity(row: unknown): Activity | null {
  if (!isObj(row) || !isUuid(row.id) || !isUuid(row.post_id)) return null;
  const body = str(row.body, 2000);
  const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
  const title = isObj(post) ? str(post.title, 200) : null;
  if (body === null || title === null) return null;
  return { id: row.id, postId: row.post_id, postTitle: title, author: authorOf(row.profiles), body, createdAt: when(row.created_at) };
}

/** Komentar terbaru dari orang lain pada tulisanmu. */
export async function listActivity(db: SupabaseClient, userId: string, limit = 15): Promise<Activity[]> {
  if (!isUuid(userId)) return [];
  const rows = must(
    await db
      .from('comments')
      .select('id,post_id,body,created_at,profiles!comments_user_id_fkey(display_name),posts!inner(title,user_id)')
      .eq('posts.user_id', userId)
      .neq('user_id', userId)
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  return Array.isArray(rows) ? rows.map(parseActivity).filter((a): a is Activity => a !== null) : [];
}

/** Hero yang paling sering dipakai di build terbaru komunitas. `sample` = berapa build yang dihitung. */
export async function heroTrend(db: SupabaseClient, sample = 200): Promise<{ heroes: { id: string; count: number }[]; sample: number }> {
  const rows = must(await db.from('posts').select('heroes').eq('kind', 'build').order('created_at', { ascending: false }).limit(sample));
  const lists = (Array.isArray(rows) ? rows : []).filter(isObj).map((r) => (Array.isArray(r.heroes) ? r.heroes.filter((h): h is string => typeof h === 'string') : []));
  return { heroes: tallyHeroes(lists, 6), sample: lists.length };
}

/** Persentase menang dibulatkan; null kalau belum ada duel. */
export const winRate = (p: Pick<Post, 'duelPlayed' | 'duelWins'>): number | null =>
  p.duelPlayed > 0 ? Math.round((p.duelWins / p.duelPlayed) * 100) : null;

/** "3 mnt lalu", "2 jam lalu", dst. `now` bisa disuntik untuk uji. */
export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (!ts) return '';
  if (s < 45) return 'baru saja';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} mnt lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
