-- =====================================================================
-- MLBB Build Lab — skema komunitas (Supabase / PostgreSQL 15+)
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel seluruh
-- berkas ini -> Run. Aman dijalankan ulang (idempoten) selama belum ada data
-- yang kolomnya berubah.
--
-- Prinsip keamanan:
--   * Browser memakai kunci "anon" yang PUBLIK. Satu-satunya pengaman adalah
--     RLS + hak akses kolom di bawah ini, jadi semuanya diset ketat:
--     tabel dicabut dulu dari anon/authenticated, lalu hak diberikan per kolom.
--   * Klien tidak pernah mengirim user_id: nilainya diisi auth.uid() oleh DB.
--   * Kolom hitungan (like_count, duel_wins, dst.) hanya diubah trigger.
--   * Isi `payload` (string bagikan dari aplikasi) didekode dan divalidasi di
--     DB; kolom `heroes` diturunkan dari payload, bukan dipercaya dari klien.
-- =====================================================================

-- ---------- Profil -----------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 24 and display_name !~ '[[:cntrl:]]'),
  created_at   timestamptz not null default now()
);

-- Buat profil dari data akun. Hanya KATA PERTAMA nama Google yang dipakai
-- (privasi); pemain bisa menggantinya sendiri. Email tidak pernah dipakai.
create or replace function public.mbl_make_profile(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb;
  nm   text;
begin
  select raw_user_meta_data into meta from auth.users where id = uid;
  nm := coalesce(meta ->> 'full_name', meta ->> 'name', '');
  nm := regexp_replace(btrim(nm), '[[:cntrl:]]', '', 'g');
  nm := left(split_part(btrim(nm), ' ', 1), 24);
  if nm is null or nm = '' then nm := 'Pemain'; end if;
  insert into public.profiles (id, display_name) values (uid, nm) on conflict (id) do nothing;
end;
$$;

create or replace function public.mbl_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mbl_make_profile(new.id);
  return new;
end;
$$;

drop trigger if exists mbl_auth_user_created on auth.users;
create trigger mbl_auth_user_created
  after insert on auth.users
  for each row execute function public.mbl_on_auth_user_created();

-- Cadangan: dipanggil klien setelah login supaya akun yang dibuat SEBELUM
-- skema ini dijalankan tetap punya profil.
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  perform public.mbl_make_profile(auth.uid());
end;
$$;

-- ---------- Tulisan (build / komposisi) ---------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('build', 'team')),
  title         text not null
    check (char_length(title) between 1 and 60 and title = btrim(title) and title !~ '[[:cntrl:]]'),
  note          text not null default ''
    check (char_length(note) <= 280 and note !~ '[\x00-\x09\x0b-\x1f]'),
  -- String bagikan dari aplikasi (base64url dari JSON). Didekode & divalidasi trigger.
  payload       text not null
    check (char_length(payload) between 10 and 8000 and payload ~ '^[A-Za-z0-9_-]+$'),
  -- Diturunkan dari payload oleh trigger (build: 1 hero; team: hero tiap lane).
  heroes        text[] not null default '{}',
  hidden        boolean not null default false,
  -- true = sudah ditinjau admin, tidak disembunyikan otomatis lagi oleh laporan.
  cleared       boolean not null default false,
  like_count    integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  duel_played   integer not null default 0 check (duel_played >= 0),
  duel_wins     integer not null default 0 check (duel_wins >= 0 and duel_wins <= duel_played),
  -- Batas bawah Wilson (z=1,96): menang 3/3 tidak otomatis mengalahkan 40/50.
  duel_score    double precision generated always as (
    case when duel_played = 0 then 0::double precision
    else (
      (duel_wins::double precision / duel_played) + 1.9208 / duel_played
      - 1.96 * sqrt(
          ((duel_wins::double precision / duel_played) * (1 - duel_wins::double precision / duel_played)
           + 0.9604 / duel_played) / duel_played)
    ) / (1 + 3.8416 / duel_played)
    end
  ) stored,
  created_at    timestamptz not null default now()
);

create unique index if not exists posts_user_payload_uq on public.posts (user_id, md5(payload));
create index if not exists posts_feed_new_idx   on public.posts (kind, created_at desc) where not hidden;
create index if not exists posts_feed_like_idx  on public.posts (kind, like_count desc, created_at desc) where not hidden;
create index if not exists posts_feed_duel_idx  on public.posts (kind, duel_score desc) where not hidden;
create index if not exists posts_heroes_idx     on public.posts using gin (heroes);
create index if not exists posts_user_idx       on public.posts (user_id, created_at desc);

-- Dekode string bagikan. Mengembalikan NULL kalau bukan JSON UTF-8 yang sah.
create or replace function public.mbl_decode_payload(p text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
begin
  s := translate(p, '-_', '+/');
  s := s || repeat('=', (4 - length(s) % 4) % 4);
  return convert_from(decode(s, 'base64'), 'UTF8')::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function public.mbl_posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j    jsonb;
  hs   text[] := '{}';
  lane text;
  hero text;
  n    integer;
begin
  if new.kind is distinct from 'build' and new.kind is distinct from 'team' then
    raise exception 'kind_invalid';
  end if;
  j := public.mbl_decode_payload(new.payload);
  if j is null or coalesce(jsonb_typeof(j), '') <> 'object' then
    raise exception 'payload_invalid';
  end if;

  if new.kind = 'build' then
    if coalesce(jsonb_typeof(j -> 'h'), '') <> 'string' or char_length(j ->> 'h') not between 1 and 60 then
      raise exception 'payload_invalid';
    end if;
    hs := array[j ->> 'h'];
  else
    if coalesce(jsonb_typeof(j -> 'l'), '') <> 'object' then
      raise exception 'payload_invalid';
    end if;
    foreach lane in array array['Gold', 'EXP', 'Mid', 'Jungle', 'Roam'] loop
      if coalesce(jsonb_typeof(j -> 'l' -> lane -> 'h'), '') = 'string' then
        hero := j -> 'l' -> lane ->> 'h';
        if char_length(hero) not between 1 and 60 then
          raise exception 'payload_invalid';
        end if;
        if not (hero = any (hs)) then
          hs := hs || hero;
        end if;
      end if;
    end loop;
    if cardinality(hs) = 0 then
      raise exception 'team_empty';
    end if;
  end if;

  new.heroes        := hs;
  new.hidden        := false;
  new.cleared       := false;
  new.like_count    := 0;
  new.comment_count := 0;
  new.duel_played   := 0;
  new.duel_wins     := 0;

  select count(*) into n from public.posts
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if n >= 10 then
    raise exception 'rate_limit_posts';
  end if;
  select count(*) into n from public.posts where user_id = new.user_id;
  if n >= 60 then
    raise exception 'post_quota';
  end if;
  return new;
end;
$$;

drop trigger if exists mbl_posts_before_insert on public.posts;
create trigger mbl_posts_before_insert
  before insert on public.posts
  for each row execute function public.mbl_posts_before_insert();

-- ---------- Like -------------------------------------------------------
create table if not exists public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists likes_user_idx on public.likes (user_id);

create or replace function public.mbl_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists mbl_likes_count on public.likes;
create trigger mbl_likes_count
  after insert or delete on public.likes
  for each row execute function public.mbl_likes_count();

-- ---------- Komentar ---------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null
    check (char_length(body) between 1 and 500 and body = btrim(body) and body !~ '[\x00-\x09\x0b-\x1f]'),
  hidden     boolean not null default false,
  cleared    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create or replace function public.mbl_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  new.hidden  := false;
  new.cleared := false;
  select count(*) into n from public.comments
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if n >= 30 then
    raise exception 'rate_limit_comments';
  end if;
  return new;
end;
$$;

drop trigger if exists mbl_comments_before_insert on public.comments;
create trigger mbl_comments_before_insert
  before insert on public.comments
  for each row execute function public.mbl_comments_before_insert();

create or replace function public.mbl_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not new.hidden then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
  elsif tg_op = 'DELETE' then
    if not old.hidden then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
  else -- UPDATE (hidden berubah)
    if old.hidden and not new.hidden then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    elsif not old.hidden and new.hidden then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists mbl_comments_count on public.comments;
create trigger mbl_comments_count
  after insert or delete or update of hidden on public.comments
  for each row execute function public.mbl_comments_count();

-- ---------- Laporan ----------------------------------------------------
create table if not exists public.reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id    uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason     text not null check (reason in ('spam', 'kasar', 'menyesatkan', 'lainnya')),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null)),
  unique (user_id, post_id),
  unique (user_id, comment_id)
);

create or replace function public.mbl_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n from public.reports
    where user_id = new.user_id and created_at > now() - interval '1 hour' and id <> new.id;
  if n >= 20 then
    raise exception 'rate_limit_reports';
  end if;

  -- 3 pelapor berbeda -> disembunyikan otomatis sampai admin meninjau.
  if new.post_id is not null then
    select count(distinct user_id) into n from public.reports where post_id = new.post_id;
    if n >= 3 then
      update public.posts set hidden = true where id = new.post_id and not cleared and not hidden;
    end if;
  else
    select count(distinct user_id) into n from public.reports where comment_id = new.comment_id;
    if n >= 3 then
      update public.comments set hidden = true where id = new.comment_id and not cleared and not hidden;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists mbl_reports_after_insert on public.reports;
create trigger mbl_reports_after_insert
  after insert on public.reports
  for each row execute function public.mbl_reports_after_insert();

-- ---------- Adu (duel) -------------------------------------------------
-- Satu suara per akun per pasangan. Pasangan disimpan terurut (post_a < post_b).
create table if not exists public.duel_votes (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_a     uuid not null references public.posts (id) on delete cascade,
  post_b     uuid not null references public.posts (id) on delete cascade,
  winner     uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_a, post_b),
  check (post_a < post_b),
  check (winner = post_a or winner = post_b)
);
create index if not exists duel_votes_a_idx on public.duel_votes (post_a);
create index if not exists duel_votes_b_idx on public.duel_votes (post_b);

create or replace function public.mbl_duel_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tmp uuid;
  pa  public.posts;
  pb  public.posts;
  n   integer;
begin
  if new.post_a > new.post_b then
    tmp := new.post_a; new.post_a := new.post_b; new.post_b := tmp;
  end if;
  if new.post_a = new.post_b then
    raise exception 'duel_same';
  end if;

  select * into pa from public.posts where id = new.post_a;
  select * into pb from public.posts where id = new.post_b;
  if pa.id is null or pb.id is null or pa.hidden or pb.hidden then
    raise exception 'duel_missing';
  end if;
  if pa.kind <> pb.kind then
    raise exception 'duel_kind';
  end if;
  -- Membandingkan build beda hero tidak bermakna: wajib hero yang sama.
  if pa.kind = 'build' and pa.heroes <> pb.heroes then
    raise exception 'duel_hero';
  end if;
  -- Tidak boleh ikut memilih pada pasangan yang memuat tulisanmu sendiri.
  if pa.user_id = new.user_id or pb.user_id = new.user_id then
    raise exception 'duel_own';
  end if;

  select count(*) into n from public.duel_votes
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if n >= 60 then
    raise exception 'rate_limit_votes';
  end if;
  return new;
end;
$$;

drop trigger if exists mbl_duel_before_insert on public.duel_votes;
create trigger mbl_duel_before_insert
  before insert on public.duel_votes
  for each row execute function public.mbl_duel_before_insert();

create or replace function public.mbl_duel_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set duel_played = duel_played + 1 where id in (new.post_a, new.post_b);
    update public.posts set duel_wins = duel_wins + 1 where id = new.winner;
  else
    -- Kalau salah satu tulisan dihapus, suara lawannya ikut dibatalkan (cascade).
    update public.posts set duel_wins = greatest(duel_wins - 1, 0) where id = old.winner;
    update public.posts set duel_played = greatest(duel_played - 1, 0) where id in (old.post_a, old.post_b);
  end if;
  return null;
end;
$$;

drop trigger if exists mbl_duel_count on public.duel_votes;
create trigger mbl_duel_count
  after insert or delete on public.duel_votes
  for each row execute function public.mbl_duel_count();

-- Pasangan acak yang belum pernah kamu pilih. Build: hero yang sama.
-- Tulisanmu sendiri tidak ikut. Berjalan sebagai pemanggil (RLS berlaku).
create or replace function public.next_duel(p_kind text, p_hero text default null)
returns setof public.posts
language sql
volatile
set search_path = ''
as $$
  with pool as (
    select p.*
    from public.posts p
    where not p.hidden
      and p.kind = p_kind
      and p.user_id <> auth.uid()
      and (p_hero is null or p.heroes @> array[p_hero])
    order by random()
    limit 400
  ),
  pair as (
    select a.id as a_id, b.id as b_id
    from pool a
    join pool b on a.id < b.id
    where (p_kind <> 'build' or a.heroes = b.heroes)
      and not exists (
        select 1 from public.duel_votes v
        where v.user_id = auth.uid() and v.post_a = a.id and v.post_b = b.id
      )
    order by random()
    limit 1
  )
  select p.*
  from public.posts p
  join pair on p.id in (pair.a_id, pair.b_id)
  order by random();
$$;

-- ---------- RLS --------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.posts      enable row level security;
alter table public.likes      enable row level security;
alter table public.comments   enable row level security;
alter table public.reports    enable row level security;
alter table public.duel_votes enable row level security;

drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists posts_read   on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_read   on public.posts for select using (not hidden or user_id = auth.uid());
create policy posts_insert on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists likes_read   on public.likes;
drop policy if exists likes_insert on public.likes;
drop policy if exists likes_delete on public.likes;
create policy likes_read   on public.likes for select to authenticated using (user_id = auth.uid());
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists comments_read   on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_read   on public.comments for select using (not hidden or user_id = auth.uid());
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
create policy comments_delete on public.comments for delete to authenticated using (user_id = auth.uid());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (post_id is not null and exists (select 1 from public.posts p where p.id = post_id and not p.hidden))
      or (comment_id is not null and exists (select 1 from public.comments c where c.id = comment_id and not c.hidden))
    )
  );

drop policy if exists duel_votes_read   on public.duel_votes;
drop policy if exists duel_votes_insert on public.duel_votes;
create policy duel_votes_read   on public.duel_votes for select to authenticated using (user_id = auth.uid());
create policy duel_votes_insert on public.duel_votes for insert to authenticated with check (user_id = auth.uid());

-- ---------- Hak akses (per kolom) -------------------------------------
-- Supabase memberi anon/authenticated SEMUA hak pada tabel baru. Cabut dulu.
revoke all on public.profiles, public.posts, public.likes, public.comments, public.reports, public.duel_votes
  from anon, authenticated;

grant select on public.profiles   to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.posts to anon, authenticated;
grant insert (kind, title, note, payload) on public.posts to authenticated;
grant delete on public.posts to authenticated;

grant select, delete on public.likes to authenticated;
grant insert (post_id) on public.likes to authenticated;

grant select on public.comments to anon, authenticated;
grant insert (post_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant insert (post_id, comment_id, reason) on public.reports to authenticated;

grant select on public.duel_votes to authenticated;
grant insert (post_a, post_b, winner) on public.duel_votes to authenticated;

-- Fungsi internal tidak boleh dipanggil lewat API (PostgREST /rpc).
revoke execute on function public.mbl_make_profile(uuid)        from public, anon, authenticated;
revoke execute on function public.mbl_on_auth_user_created()    from public, anon, authenticated;
revoke execute on function public.mbl_decode_payload(text)      from public, anon, authenticated;
revoke execute on function public.mbl_posts_before_insert()     from public, anon, authenticated;
revoke execute on function public.mbl_likes_count()             from public, anon, authenticated;
revoke execute on function public.mbl_comments_before_insert()  from public, anon, authenticated;
revoke execute on function public.mbl_comments_count()          from public, anon, authenticated;
revoke execute on function public.mbl_reports_after_insert()    from public, anon, authenticated;
revoke execute on function public.mbl_duel_before_insert()      from public, anon, authenticated;
revoke execute on function public.mbl_duel_count()              from public, anon, authenticated;

revoke execute on function public.ensure_profile()              from public, anon;
grant  execute on function public.ensure_profile()              to authenticated;
revoke execute on function public.next_duel(text, text)         from public, anon;
grant  execute on function public.next_duel(text, text)         to authenticated;
