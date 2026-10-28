# MLBB Build Lab

React + Vite + TypeScript. Lima halaman:

- **Build hero**: pilih hero, 6 item, emblem + talent, battle spell, catatan. Peringatan untuk boots ganda, item ganda, dan unique passive yang bentrok.
- **Komposisi tim**: 5 lane, tiap hero dihubungkan ke build tersimpan. Catatan: hero ganda, tanpa Tank, tanpa Marksman/Mage, campuran damage physical vs magic (dihitung dari item di build).
- **Komunitas** (opsional, butuh Supabase): jelajahi build dan komposisi pemain lain, like, komentar, lapor, dan **Adu** (dua tulisan, satu pilihan). Lihat bagian "Komunitas" di bawah.
- **Update patch**: catatan patch Original Server dan Advanced Server (hero, item, sistem), cari hero, filter buff/nerf. Patch lama hanya berisi jumlah perubahan.
- **Jadwal MPL ID**: playoff S18 (4 - 8 Nov 2026, JIE Convention Surabaya), hitung mundur, dan pencatat pemenang lokal.

Build, komposisi, dan hero kustom disimpan di `localStorage` (tanpa server). Tombol "Bagikan tautan" menyandikan data ke URL. Hanya fitur Komunitas yang memakai server (Supabase), dan hanya kalau kamu mengaktifkannya.

## Jalankan

```bash
npm install
npm run dev        # pengembangan
npm test           # pemeriksaan logika (analisis, tautan bagikan, validasi data, parser API)
npm run probe      # uji LANGSUNG ke Rone Arena API dan cocokkan dengan data statis (butuh internet)
npm run build      # hasil: dist/index.html (satu file, siap di-deploy)
```

Deploy ke Vercel: import repo, framework Vite, selesai. Routing memakai hash (`#/builder`), jadi tidak perlu konfigurasi rewrite.

## Data dan batasannya

| File | Isi | Sumber |
| --- | --- | --- |
| `src/data/heroes.ts` | 133 hero + role | MLBBHub, 26 Okt 2026. Jumlah per role cocok dengan sumber. Lane diturunkan dari role (perkiraan). |
| `src/data/items.ts` | 61 item (T3, boots, jungle, roam) | MLBBHub / Liquipedia, patch 2.2.16a |
| `src/data/emblems.ts` | 7 emblem, talent, 12 battle spell | MLBBHub / Liquipedia, patch 2.2.16a |
| `src/data/patches.ts` | Patch Original 2.2.16a/2.2.16/2.1.95a, Advanced 2.2.28/2.2.26/2.2.24/2.2.22a/2.2.22 | MLBBHub, Liquipedia (diperiksa 27 Okt 2026). Tiap patch punya `detail` dan `caveat` yang menyebut apa yang tidak ada. |
| `src/data/mpl.ts` | Playoff MPL ID S18 | detik, Gizmologi, Medcom (diperiksa 27 Okt 2026) |

- Tidak ada API resmi Moonton. Data hero/item **statis**; setelah patch, perbarui file di atas. Hero yang belum ada bisa ditambah lewat "Hero kustom".
- Talent: 26 talent dalam 3 tier (8 + 8 + 10). Di game dipilih satu per tier dari semua talent, tidak terkunci ke set emblem; emblem hanya menentukan stat dasar. Ini dikonfirmasi dari build nyata di API (mis. Fanny jungle = Rupture [Assassin] + Festival of Blood [Fighter] + Lethal Ignition [Mage]). Catatan lama di README ini yang menyebut "pilihan di game lebih banyak" keliru dan sudah dihapus, begitu juga kolom talent kustom.
- **Rekomendasi build** (panel di halaman Build): build yang paling sering dipakai per hero, lane, dan rank dari `/api/academy/heroes/{hero}/builds`, lengkap dengan persentase dipakai dan menang. Ini AGREGAT per rank, bukan build pemain Top Global; API tidak menyediakan data pemain. ID item dan talent di data build diterjemahkan lewat `/academy/equipment` (`equipid`) dan `/academy/emblems` (`giftid`, bukan `skillid`). Endpoint ini ditandai legacy di dokumentasi API. Diambil hanya setelah panel dibuka, di-cache 6 jam per hero/lane/rank.
- Jadwal MPL tidak ditarik otomatis. Tanggal Match 2-4 tidak disebut sumber dan ditandai di `dateNote`.
- Gambar tidak disimpan di proyek (hak cipta Moonton/MPL ID). Yang tampil hanya yang URL-nya dikirim API saat runtime (lihat "Gambar" di bawah); tanpa itu, hero tampil sebagai inisial berwarna menurut role.
- Data item/emblem/spell berasal dari Liquipedia (CC BY-SA 3.0); pertahankan atribusi di footer.
- Catatan patch statis dan cepat usang; Advanced Server sering berubah atau dibatalkan sebelum live. Jumlah buff/nerf 2.2.16 di MLBBHub tidak sama dengan daftar Liquipedia (ditandai di UI). Dori (hero ke-134) muncul di patch tetapi belum ada di daftar hero build.

## Data langsung (Rone Arena API)

Sumber: [arena.rone.dev](https://arena.rone.dev), API komunitas tidak resmi (BSD-3, dikelola ridwaanhall/RoneAI; data milik Moonton). CORS terbuka dan tanpa API key, jadi dipanggil langsung dari browser. Atribusi ada di footer; Hosted API Terms meminta kredit yang terlihat dan cache.

| Data | Endpoint | Cache |
| --- | --- | --- |
| Daftar hero, role, lane | `/api/heroes`, `/api/heroes/positions` | 12 jam |
| Playoff MPL ID (jadwal, skor, seed) | `/api/esports/id/playoffs` | 5 menit |
| Klasemen reguler | `/api/esports/id/standings` | 15 menit |
| Jadwal + hasil musim reguler (72 match) | `/api/esports/id/schedule` | 15 menit |
| Detail match (game, pemain, hero, KDA, item, emblem, talent, gold, damage) | `/api/esports/id/matches/{match_id}` | 20 menit, di memori |
| Versi game terbaru | `/api/academy/meta/version` | 1 jam |
| Ikon, talent, battle spell, peta ID item/talent/spell | `/api/academy/equipment`, `/emblems`, `/spells` | 12 jam |
| Panduan pemain (6 item) | `/api/academy/heroes/{hero}/recommended` (30 terbaru) | 6 jam per hero |
| Statistik rank (3 item inti) | `/api/academy/heroes/{hero}/builds` | 6 jam per hero/lane/rank |
| Nama set emblem | `/api/academy/roles` | 24 jam |

- **Fallback:** kalau API gagal, app memakai data statis dan bilang kenapa (footer "Sumber data"). Saat 503 "high traffic", host cadangan dari `alternative_endpoint` hanya diikuti kalau domainnya `*.rone.dev` atau `*.fastapicloud.dev`.
- **Yang tetap statis:** item, emblem, battle spell, dan catatan patch. API tidak mengirim harga item (total gold tidak bisa dihitung), tidak punya deskripsi talent bahasa Indonesia, dan tidak punya isi patch (`/academy/meta/version` hanya nomor versi).
- **Hero baru** dari API ditambahkan otomatis hanya kalau API memberi rolenya. Hero statis yang tidak ditemukan di API (mis. beda ejaan) dilaporkan di footer, bukan dihapus.
- **Belum diuji ke server asli** (catatan lama: sejak itu sudah diuji ke API sungguhan lewat `npm run probe`; jalankan lagi setelah mengubah parser). Skema respons dibaca dari source API (docstring dan contoh respons), dan e2e memakai API tiruan. Jalankan `npm run probe` sekali di komputer dengan internet untuk memastikan bentuk respons asli cocok.
- **Gambar:** hero (`head` dari `/api/heroes`), item (`/api/academy/equipment`), battle spell (`/api/academy/spells`), talent (`/api/academy/emblems`), dan logo tim (dari endpoint esports) dimuat langsung dari URL yang dikirim API, hanya https, tanpa header Referer, `loading=lazy`, dan jatuh ke inisial/teks kalau gagal dimuat. Pencocokan lewat nama (huruf kecil, tanpa tanda baca), jadi nama yang beda ejaan (mis. "Weapon Master" vs "Weapons Master") tampil tanpa gambar; jumlah yang cocok ditampilkan di footer dan `npm run probe` mencetak daftar yang tidak cocok. API tidak punya ikon untuk emblem itu sendiri. Hak cipta gambar tetap milik Moonton/MPL ID, dan CDN mereka bisa memblokir hotlink kapan saja.
- **Detail match MPL:** klik "Lihat detail" pada match di halaman Jadwal MPL. Match yang sudah dimainkan menampilkan tiap game: pemenang, durasi, hero yang dipakai tiap pemain, KDA, gold, damage, dan build (item, emblem, talent). Match yang belum dimainkan menampilkan riwayat tatap muka di musim reguler dan pemain yang terakhir tampil. **Yang tidak ada di API: skor MVP resmi, ban, dan urutan pick.** Yang ditampilkan sebagai "paling menonjol" adalah estimasi (KDA tertinggi di tim pemenang), dan diberi label begitu di layar. Detail playoff baru muncul setelah match dimainkan dan API punya halaman detailnya (`match_id` masih null sebelum itu).
- **Roster:** diambil dari susunan di match reguler terakhir tim itu (API tidak punya endpoint roster). Urutan: cache browser 24 jam, lalu match terakhir (sampai 3 match, kalau satu gagal coba yang lain), lalu data tersimpan lama, lalu **snapshot bawaan** `src/data/rosters.ts`. Snapshot dibuat oleh `npm run rosters` (jalankan lagi tiap ada pergantian pemain; `--missing` hanya mengisi tim yang belum ada). Endpoint detail match berat di server: sering membalas 500/503 (`error code: 1102`, batas sumber daya Cloudflare Worker) atau timeout, jadi app membatasi 2 permintaan sekaligus dan mencoba sampai 5 kali.
- **Cache CORS di API:** respons di-cache Cloudflare sampai 4 jam dan `Vary: Origin` diabaikan, jadi header `Access-Control-Allow-Origin` bisa milik origin orang lain (diverifikasi untuk `/esports/...`). Browser memblokirnya dan fetch gagal sebagai "Failed to fetch". `src/lib/api.ts` mencoba ulang dengan `?_o=<hash origin>` (stabil per origin, API mengabaikan parameter itu) sehingga tiap origin punya baris cache sendiri. Ini penting kalau app di-deploy ke domain Vercel/Netlify.
- Tanda "Muat ulang dari API" di footer menghapus cache dan mengambil ulang.

## Update otomatis: apa yang jalan sendiri dan apa yang tidak

**Otomatis tiap halaman dibuka (dari API, dengan cache di browser):** hero, role, lane, gambar, ikon, jadwal MPL, klasemen, rekomendasi build, dan talent atau battle spell baru. Talent/spell baru dari API langsung muncul di pemilih (tier dari API; spell tanpa cooldown karena API tidak mengirimnya) dan disebut di footer.

**Otomatis tiap minggu (GitHub Action, `.github/workflows/drift.yml`):** `npm run drift` membandingkan isi API dengan snapshot minggu lalu (`scripts/api-snapshot.json`) dan dengan data statis app. Kalau ada item, hero, talent, spell, atau versi game baru, ia membuka GitHub Issue berlabel `data-drift`. Ia tidak mengubah kode app. API tidak terjangkau = dilewati tanpa gagal. Cara memakai: taruh proyek di repo GitHub; Action jalan sendiri tiap Senin (atau tombol "Run workflow"). Kalau branch utama diproteksi, izinkan `github-actions[bot]` push, atau hapus langkah "Simpan snapshot" dan simpan snapshot manual.

**Tetap manual:**
- **Harga, tier, dan stat item** (`src/data/items.ts`): API tidak mengirimnya.
- **Isi catatan patch** (`src/data/patches.ts`): tidak ada di API.
- **Deskripsi talent dan set asalnya**, cooldown spell (`src/data/emblems.ts`).

**Kenapa tidak di-scrape dari MLBBHub:** Terms MLBBHub melarang scraping otomatis tanpa izin tertulis, jadi proyek ini tidak mengambil item atau patch dari sana secara otomatis. Data statis yang ada dikompilasi manual dengan atribusi (lihat footer). Kalau mau mengotomatiskan harga item dan patch, jalur yang sah: minta izin tertulis ke pengelola MLBBHub, atau pakai API resmi Liquipedia sesuai aturannya (User-Agent jelas, batas permintaan); keduanya perlu dikerjakan terpisah.

## Deploy ke Vercel atau Netlify

1. Taruh proyek di repo GitHub (`node_modules` dan `dist` sudah di `.gitignore`).
2. Vercel: Add New Project, impor repo. Framework Vite terdeteksi otomatis (Build Command `npm run build`, Output Directory `dist`). Netlify: sama, build command `npm run build`, publish directory `dist`.
3. Tiap push ke branch utama men-deploy ulang. Aplikasi ini statis penuh (satu `index.html`) dan memanggil API langsung dari browser pengunjung, jadi tidak perlu server. Environment variable hanya dibutuhkan kalau fitur Komunitas diaktifkan (bagian berikutnya).
4. Tautan bagikan memakai hash (`#/builder?s=...`), jadi tidak perlu aturan rewrite.
5. Hanya Action `drift.yml` yang punya jadwal; deploy tidak bergantung padanya.


## Komunitas (Supabase + login Google)

Tanpa konfigurasi, tab Komunitas hanya menampilkan "belum aktif" dan semua halaman lain tetap jalan. Untuk mengaktifkannya (sekali saja, sekitar 15 menit):

1. **Proyek Supabase.** supabase.com, New project (region Singapore paling dekat). Catat *Project URL* dan kunci **anon / publishable** di Settings, API Keys.
2. **Skema.** SQL Editor, New query, tempel seluruh `supabase/schema.sql`, Run. Aman diulang.
3. **Login Google.**
   - Google Cloud Console, APIs & Services, Credentials, Create credentials, OAuth client ID, tipe *Web application*. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback` (ref = bagian awal Project URL).
   - Supabase, Authentication, Sign In / Providers, Google: aktifkan, tempel Client ID dan Client Secret.
   - Google Auth Platform, Audience: ubah status ke **In production**. Selama masih *Testing*, hanya akun yang kamu daftarkan sebagai test user yang bisa masuk. Cakupan default (email, profile, openid) tidak butuh verifikasi Google.
4. **URL yang diizinkan.** Supabase, Authentication, URL Configuration: *Site URL* = alamat Vercel-mu; *Redirect URLs* tambahkan `https://<aplikasi>.vercel.app/**` dan `http://localhost:5173/**`. Alamat yang tidak terdaftar ditolak Supabase, dan itu penyebab paling umum "login tidak kembali ke situs".
5. **Variabel lingkungan.** Lokal: buat `.env.local` (lihat `.env.example`). Vercel: Project Settings, Environment Variables, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`, lalu **Redeploy** (nilai `VITE_*` ditanam saat build, bukan saat dijalankan).
6. `npm install` (menambah `@supabase/supabase-js`).

**Jangan** memakai kunci `service_role` / `sb_secret_…` di variabel `VITE_*`: semuanya ikut terbundel ke situs publik. Aplikasi menolak membuat klien kalau mendeteksinya, tetapi nilainya tetap sudah ada di berkas hasil build; kalau itu terjadi, putar (rotate) kuncinya di dashboard. Kunci anon memang publik; yang melindungi data adalah RLS di `schema.sql`.

### Apa yang tersimpan dan siapa melihat apa

- Publik: judul, catatan, isi build/komposisi, nama tampilan (hanya **kata pertama** nama Google, bisa diganti di menu akun), jumlah like/komentar/adu. Email tidak pernah ditampilkan.
- Hanya pemilik: like, suara adu, dan laporan yang dia buat. Laporan tidak terbaca oleh pengguna lain, termasuk pelapor lain.
- Tulisan tidak bisa diedit (hapus lalu terbitkan ulang). Build dengan hero kustom tidak bisa dibagikan karena pembaca tidak punya hero itu.

### Batas yang dipasang di database

10 tulisan per jam dan 60 total per akun, 30 komentar per jam, 20 laporan per jam, 60 suara adu per jam. Tiga pelapor berbeda menyembunyikan tulisan/komentar otomatis. Isi `payload` didekode dan divalidasi di database, dan kolom hero diturunkan dari payload (bukan dipercaya dari klien); di sisi pembaca isi didekode lagi dengan validasi ketat yang sama seperti tautan bagikan.

### Moderasi (manual, lewat SQL Editor)

```sql
-- laporan terbaru
select r.created_at, r.reason, p.id, p.title, p.hidden
from reports r left join posts p on p.id = r.post_id
order by r.created_at desc limit 50;

-- tulisan ternyata aman: tampilkan lagi dan kebal dari penyembunyian otomatis
update posts set hidden = false, cleared = true where id = '<uuid>';
update comments set hidden = false, cleared = true where id = '<uuid>';

-- hapus tulisan (like, komentar, laporan, suara adu terkait ikut terhapus)
delete from posts where id = '<uuid>';
```

Untuk memblokir pengguna: Authentication, Users, pilih akun, Ban user (atau Delete user, yang menghapus semua tulisannya).

### Batasan yang perlu kamu tahu

- **Tidak ada filter kata kasar.** Moderasi bergantung pada laporan dan kamu membuka dashboard.
- **Akun ganda.** Seorang pemain bisa membuat beberapa akun Google untuk menambah like, suara adu, atau (dengan tiga akun) menyembunyikan tulisan orang. Aturan "tidak boleh memilih di adu yang memuat tulisan sendiri" dan batas per jam hanya memperlambat, tidak mencegah.
- **Adu mengukur selera pemilih di sini**, bukan kekuatan di game. Peringkat "Juara adu" memakai batas bawah Wilson dan baru muncul setelah minimal 3 duel. Build hanya diadu dengan build hero yang sama.
- **Komunitas baru kosong.** Feed dan Adu baru terasa kalau ada belasan tulisan. Adu butuh minimal dua build dari hero yang sama dan bukan milikmu.
- Proyek gratis Supabase bisa dijeda kalau lama tidak dipakai (cek kebijakan terbaru mereka); data tidak hilang, tapi situs komunitas error sampai proyek dilanjutkan.
- Ukuran bundel naik sekitar 270 KB karena `@supabase/supabase-js`.

### Cara fitur ini diuji

`supabase/test/` berisi pengujian skema yang dijalankan di PostgreSQL 16 sungguhan: `shim.sql` meniru bagian Supabase yang dipakai skema (peran `anon`/`authenticated`, `auth.uid()`, `auth.users`), `rls.sql` memeriksa RLS, hak per kolom, trigger, batas laju, auto-sembunyi, dan adu (96 pemeriksaan), `run.sh` menjalankannya, `gen-payloads.ts` membuat payload dari encoder asli aplikasi. Contoh: `npx tsx supabase/test/gen-payloads.ts > /tmp/vars.psql && PGHOST=127.0.0.1 PGUSER=postgres supabase/test/run.sh /tmp/vars.psql` (butuh PostgreSQL lokal; `shim.sql` jangan dijalankan di Supabase sungguhan).
Klien juga diuji end-to-end di browser terhadap PostgREST asli + skema itu. **Yang belum pernah diuji dengan layanan sungguhan**: Google OAuth dan GoTrue milik Supabase (hanya alur kembalinya `?code=` yang disimulasikan), serta perilaku proyek Supabase hosting (kuota, pembatasan). Uji sekali dengan akun Google-mu sendiri setelah deploy.
