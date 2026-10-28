/**
 * Klien Supabase untuk fitur komunitas. Tanpa konfigurasi yang valid, fitur komunitas mati dan
 * bagian lain aplikasi tetap jalan.
 *
 * Kunci yang dipakai di browser adalah kunci "anon"/"publishable" yang memang PUBLIK; keamanan datanya
 * ada di RLS (supabase/schema.sql). Kunci rahasia (service_role / sb_secret_) TIDAK BOLEH ada di sini:
 * kalau terdeteksi, klien menolak dibuat supaya tidak ikut terbundel ke situs publik.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readConfig, type CommunityConfig } from './config';

export { OFF_TEXT, type CommunityOff } from './config';

export const AUTH_STORAGE_KEY = 'mbl:auth';

export const config: CommunityConfig = readConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = config.ok
  ? createClient(config.url, config.key, {
      auth: {
        // PKCE: hasil login kembali lewat ?code=..., bukan #access_token=..., jadi tidak bentrok dengan routing hash.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
    })
  : null;

