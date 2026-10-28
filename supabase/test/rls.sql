-- Uji perilaku skema (RLS, trigger, adu). Dijalankan lewat psql setelah shim.sql + schema.sql,
-- dengan variabel payload dari generator (\set b1 ..., t1 ..., bad_json ...).
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
reset role;
drop schema if exists t cascade;
create schema t;
grant usage on schema t to anon, authenticated;
create table t.log (n serial, label text);
grant all on t.log to anon, authenticated;
grant usage on all sequences in schema t to anon, authenticated;
create table t.vars (k text primary key, v text not null);
grant select on t.vars to anon, authenticated;
create function t.v(key text) returns text language sql stable as $f$ select v from t.vars where k = key $f$;
grant execute on function t.v(text) to anon, authenticated;
\ir vars_insert.sql

-- fails(q, expected): q harus gagal dan pesan error memuat `expected`.
create function t.fails(q text, expected text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm like '%' || expected || '%' then
      insert into t.log(label) values ('ok  fails[' || expected || ']');
      return;
    end if;
    raise exception 'GAGAL (error salah) %: dapat "%", harap "%"', q, sqlerrm, expected;
  end;
  raise exception 'GAGAL (harusnya error "%"): %', expected, q;
end $$;

create function t.eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'GAGAL %: dapat %, harap %', label, actual, expected;
  end if;
  insert into t.log(label) values ('ok  ' || label);
end $$;

create function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;
grant execute on all functions in schema t to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'a@x.test', '{"full_name":"Aldi Pratama Putra"}'),
 ('00000000-0000-0000-0000-00000000000b', 'b@x.test', '{"name":"Budi"}'),
 ('00000000-0000-0000-0000-00000000000c', 'c@x.test', '{}'),
 ('00000000-0000-0000-0000-00000000000d', 'd@x.test', '{"full_name":"Dewi"}'),
 ('00000000-0000-0000-0000-00000000000e', 'e@x.test', '{"full_name":"Eka"}');
select t.eq((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Aldi', 'profil: hanya kata pertama nama');
select t.eq((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'Pemain', 'profil: tanpa nama -> Pemain (email tidak bocor)');

-- ---------- anon ----------
set role anon;
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','x',t.v('b1'))$q$, 'permission denied');
select t.eq((select count(*) from public.posts), 0::bigint, 'anon bisa select posts (kosong)');
select t.fails($q$insert into public.likes(post_id) values (gen_random_uuid())$q$, 'permission denied');
select t.fails($q$select * from public.reports$q$, 'permission denied');
select t.fails($q$select * from public.duel_votes$q$, 'permission denied');
select t.fails($q$select public.next_duel('build')$q$, 'permission denied');
select t.fails($q$select public.mbl_make_profile(gen_random_uuid())$q$, 'permission denied');
select t.fails($q$select public.mbl_decode_payload('abc')$q$, 'permission denied');

-- ---------- A: posting ----------
reset role; set role authenticated;
select t.login('00000000-0000-0000-0000-00000000000a');
insert into public.posts(kind,title,note,payload) values ('build','Layla crit','mantap',t.v('b1'));
select t.eq((select user_id from public.posts where title='Layla crit'), '00000000-0000-0000-0000-00000000000a'::uuid, 'user_id diisi auth.uid()');
select t.eq((select heroes from public.posts where title='Layla crit'), array['layla'], 'heroes diturunkan dari payload build');
insert into public.posts(kind,title,payload) values ('team','Tim A',t.v('t1'));
select t.eq((select heroes from public.posts where title='Tim A'), array['layla','aldous','eudora','fanny','tigreal'], 'heroes tim = hero tiap lane');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','Layla crit',t.v('b1'))$q$, 'duplicate key');
select t.fails($q$insert into public.posts(user_id,kind,title,payload) values ('00000000-0000-0000-0000-00000000000b','build','palsu',t.v('b2'))$q$, 'permission denied');
select t.fails($q$insert into public.posts(kind,title,payload,like_count) values ('build','curang',t.v('b2'),999)$q$, 'permission denied');
select t.fails($q$insert into public.posts(kind,title,payload,heroes) values ('build','curang',t.v('b2'),'{tigreal}')$q$, 'permission denied');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','x',t.v('bad_json'))$q$, 'payload_invalid');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','x',t.v('bad_shape'))$q$, 'payload_invalid');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','x',t.v('bad_chars'))$q$, 'payload_invalid');
select t.fails($q$insert into public.posts(kind,title,payload) values ('team','x',t.v('b2'))$q$, 'payload_invalid');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','x',t.v('t2'))$q$, 'payload_invalid');
select t.fails($q$insert into public.posts(kind,title,payload) values ('team','x',t.v('tempty'))$q$, 'team_empty');
select t.fails($q$insert into public.posts(kind,title,payload) values ('game','x',t.v('b2'))$q$, 'kind_invalid');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','',t.v('b2'))$q$, 'check constraint');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build',' spasi ',t.v('b2'))$q$, 'check constraint');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build',repeat('a',61),t.v('b2'))$q$, 'check constraint');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build',E'baris\nbaru',t.v('b2'))$q$, 'check constraint');
select t.fails($q$insert into public.posts(kind,title,note,payload) values ('build','x',repeat('a',281),t.v('b2'))$q$, 'check constraint');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','x',repeat('A',8001))$q$, 'payload_invalid');
select t.fails($q$update public.posts set title='diubah'$q$, 'permission denied');
select t.fails($q$update public.profiles set id = gen_random_uuid()$q$, 'permission denied');

-- profil: ganti nama sendiri saja
update public.profiles set display_name = 'AldiGG' where id = '00000000-0000-0000-0000-00000000000a';
select t.eq((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'AldiGG', 'ganti nama sendiri');
update public.profiles set display_name = 'HACK' where id = '00000000-0000-0000-0000-00000000000b';
select t.eq((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Budi', 'ganti nama orang lain: 0 baris berubah');
select t.fails($q$update public.profiles set display_name = '' where id = '00000000-0000-0000-0000-00000000000a'$q$, 'check constraint');

-- batas laju posting (10/jam)
insert into public.posts(kind,title,payload) values ('build','Layla burst',t.v('b2')),('build','Layla tahan',t.v('b3')),('build','Tigreal tank',t.v('b4')),('build','Layla v5',t.v('b5')),('team','Tim B',t.v('t2')),('team','Tim C',t.v('t3'));
select t.eq((select count(*) from public.posts where user_id='00000000-0000-0000-0000-00000000000a'), 8::bigint, 'A punya 8 post');

-- ---------- B: like, komentar, laporan ----------
select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.likes(post_id) select id from public.posts where title='Layla crit';
select t.eq((select like_count from public.posts where title='Layla crit'), 1, 'like_count naik');
select t.fails($q$insert into public.likes(post_id) select id from public.posts where title='Layla crit'$q$, 'duplicate key');
select t.fails($q$insert into public.likes(post_id, user_id) select id, '00000000-0000-0000-0000-00000000000c' from public.posts where title='Layla crit'$q$, 'permission denied');
select t.eq((select count(*) from public.likes), 1::bigint, 'B melihat like miliknya saja');
select t.login('00000000-0000-0000-0000-00000000000c');
select t.eq((select count(*) from public.likes), 0::bigint, 'C tidak melihat like orang lain');
insert into public.likes(post_id) select id from public.posts where title='Layla crit';
select t.eq((select like_count from public.posts where title='Layla crit'), 2, 'like_count 2');
delete from public.likes where user_id = '00000000-0000-0000-0000-00000000000b';  -- bukan miliknya: 0 baris
select t.eq((select like_count from public.posts where title='Layla crit'), 2, 'hapus like orang lain: tidak berefek');
delete from public.likes;
select t.eq((select like_count from public.posts where title='Layla crit'), 1, 'unlike menurunkan like_count');

select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.comments(post_id, body) select id, 'Build mantap, tapi tambah Blade of Despair?' from public.posts where title='Layla crit';
select t.eq((select comment_count from public.posts where title='Layla crit'), 1, 'comment_count naik');
select t.fails($q$insert into public.comments(post_id, body) select id, '   ' from public.posts where title='Layla crit'$q$, 'check constraint');
select t.fails($q$insert into public.comments(post_id, body) select id, repeat('a',501) from public.posts where title='Layla crit'$q$, 'check constraint');
select t.fails($q$insert into public.comments(post_id, body, hidden) select id, 'x', true from public.posts where title='Layla crit'$q$, 'permission denied');
select t.fails($q$insert into public.comments(post_id, body) values (gen_random_uuid(), 'tanpa post')$q$, 'row-level security');
select t.fails($q$update public.comments set body = 'ubah'$q$, 'permission denied');
select t.eq((select count(*) from public.comments), 1::bigint, 'komentar terbaca');

-- hapus komentar: hanya milik sendiri
select t.login('00000000-0000-0000-0000-00000000000c');
delete from public.comments;
select t.eq((select count(*) from public.comments), 1::bigint, 'C tidak bisa hapus komentar B');
select t.login('00000000-0000-0000-0000-00000000000b');
delete from public.comments;
select t.eq((select comment_count from public.posts where title='Layla crit'), 0, 'hapus komentar menurunkan comment_count');

-- laporan: 3 pelapor berbeda -> post tersembunyi
select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.reports(post_id, reason) select id, 'spam' from public.posts where title='Layla v5';
select t.fails($q$insert into public.reports(post_id, reason) select id, 'spam' from public.posts where title='Layla v5'$q$, 'duplicate key');
select t.fails($q$insert into public.reports(post_id, reason) select id, 'asal' from public.posts where title='Layla v5'$q$, 'check constraint');
select t.fails($q$insert into public.reports(post_id, comment_id, reason) values (gen_random_uuid(), gen_random_uuid(), 'spam')$q$, 'row-level security');
select t.eq((select count(*) from public.posts where title='Layla v5'), 1::bigint, '1 laporan: masih tampil');
select t.login('00000000-0000-0000-0000-00000000000c');
insert into public.reports(post_id, reason) select id, 'kasar' from public.posts where title='Layla v5';
select t.eq((select count(*) from public.posts where title='Layla v5'), 1::bigint, '2 laporan: masih tampil');
select t.login('00000000-0000-0000-0000-00000000000d');
insert into public.reports(post_id, reason) select id, 'menyesatkan' from public.posts where title='Layla v5';
select t.eq((select count(*) from public.posts where title='Layla v5'), 0::bigint, '3 laporan: tersembunyi dari orang lain');
select t.login('00000000-0000-0000-0000-00000000000a');
select t.eq((select hidden from public.posts where title='Layla v5'), true, 'penulis masih melihat post yang disembunyikan');
reset role; set role anon; select set_config('request.jwt.claims', '', false);
select t.eq((select count(*) from public.posts where title='Layla v5'), 0::bigint, 'anon tidak melihat post tersembunyi');
reset role;
-- admin meninjau: cleared = true -> laporan baru tidak menyembunyikan lagi
update public.posts set hidden=false, cleared=true where title='Layla v5';
set role authenticated;
select t.login('00000000-0000-0000-0000-00000000000e');
insert into public.reports(post_id, reason) select id, 'spam' from public.posts where title='Layla v5';
select t.eq((select count(*) from public.posts where title='Layla v5'), 1::bigint, 'cleared: tidak disembunyikan lagi');
select t.fails($q$select * from public.reports$q$, 'permission denied');

-- laporan komentar
select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.comments(post_id, body) select id, 'komentar buruk' from public.posts where title='Layla burst';
select t.eq((select comment_count from public.posts where title='Layla burst'), 1, 'comment_count 1');
select t.login('00000000-0000-0000-0000-00000000000c'); insert into public.reports(comment_id, reason) select id, 'kasar' from public.comments;
select t.login('00000000-0000-0000-0000-00000000000d'); insert into public.reports(comment_id, reason) select id, 'kasar' from public.comments;
select t.login('00000000-0000-0000-0000-00000000000e'); insert into public.reports(comment_id, reason) select id, 'kasar' from public.comments;
select t.eq((select count(*) from public.comments), 0::bigint, '3 laporan: komentar tersembunyi');
select t.eq((select comment_count from public.posts where title='Layla burst'), 0, 'komentar tersembunyi mengurangi comment_count');

-- ---------- Adu ----------
-- C menjadi pemilih. Pasangan build: hanya hero sama.
select t.login('00000000-0000-0000-0000-00000000000c');
select t.eq((select count(*) from public.next_duel('build')), 2::bigint, 'next_duel build -> 2 post');
select t.eq((select count(distinct heroes) from public.next_duel('build')), 1::bigint, 'next_duel build -> hero sama');
select t.eq((select count(*) from public.next_duel('team')), 2::bigint, 'next_duel team -> 2 post');
select t.eq((select count(*) from public.next_duel('build', 'tigreal')), 0::bigint, 'hero hanya punya 1 build -> tidak ada pasangan');
select t.login('00000000-0000-0000-0000-00000000000a');
select t.eq((select count(*) from public.next_duel('build')), 0::bigint, 'A tidak mendapat pasangan dari postingannya sendiri');

select t.login('00000000-0000-0000-0000-00000000000c');
create temp table pair as select min(id::text)::uuid as lo, max(id::text)::uuid as hi from public.next_duel('build', 'layla');
grant all on pair to authenticated;
-- sengaja kirim terbalik (b, a): trigger harus menormalkan
insert into public.duel_votes(post_a, post_b, winner) select hi, lo, lo from pair;
select t.eq((select count(*) from public.duel_votes), 1::bigint, 'suara tersimpan');
select t.eq((select sum(duel_played) from public.posts where id in (select lo from pair union select hi from pair)), 2::bigint, 'duel_played +1 untuk keduanya');
select t.eq((select duel_wins from public.posts where id = (select lo from pair)), 1, 'pemenang duel_wins = 1');
select t.eq((select duel_wins from public.posts where id = (select hi from pair)), 0, 'yang kalah duel_wins = 0');
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select lo, hi, hi from pair$q$, 'duplicate key');
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select hi, lo, hi from pair$q$, 'duplicate key');
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select lo, lo, lo from pair$q$, 'duel_same');
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select lo, hi, gen_random_uuid() from pair$q$, 'check constraint');
select t.fails($q$insert into public.duel_votes(user_id, post_a, post_b, winner) select '00000000-0000-0000-0000-00000000000d', lo, hi, lo from pair$q$, 'permission denied');
-- beda jenis / beda hero / punya sendiri
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select p1.id, p2.id, p1.id from public.posts p1, public.posts p2 where p1.title='Layla burst' and p2.title='Tim B'$q$, 'duel_kind');
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select p1.id, p2.id, p1.id from public.posts p1, public.posts p2 where p1.title='Layla burst' and p2.title='Tigreal tank'$q$, 'duel_hero');
select t.login('00000000-0000-0000-0000-00000000000a');
select t.fails($q$insert into public.duel_votes(post_a, post_b, winner) select p1.id, p2.id, p1.id from public.posts p1, public.posts p2 where p1.title='Layla burst' and p2.title='Layla tahan'$q$, 'duel_own');
-- pasangan yang sudah dipilih tidak muncul lagi
select t.login('00000000-0000-0000-0000-00000000000c');
do $$ declare i int; n int; l uuid; h uuid; begin
  select lo, hi into l, h from pair;
  for i in 1..40 loop
    select count(*) into n from public.next_duel('build', 'layla') where id in (l, h);
    if n = 2 then raise exception 'GAGAL pasangan yang sudah dipilih muncul lagi'; end if;
  end loop;
  insert into t.log(label) values ('ok  pasangan yang sudah dipilih tidak muncul lagi (40 undian)');
end $$;
-- skor Wilson
reset role;
select t.eq(round((select duel_score from public.posts where id = (select lo from pair))::numeric, 3), 0.207::numeric, 'duel_score Wilson 1/1 = 0,207');
select t.eq((select duel_score from public.posts where title='Tim A'), 0::double precision, 'duel_score belum main = 0');
-- menghapus post lawan membatalkan suara + mengurangi hitungan
set role authenticated;
select t.login('00000000-0000-0000-0000-00000000000a');
delete from public.posts where id = (select hi from pair);
select t.eq((select duel_played from public.posts where id = (select lo from pair)), 0, 'hapus lawan: duel_played kembali 0');
select t.eq((select duel_wins from public.posts where id = (select lo from pair)), 0, 'hapus lawan: duel_wins kembali 0');
select t.eq((select count(*) from public.duel_votes), 0::bigint, 'suara ikut terhapus (cascade)') ;
reset role;
select t.eq((select count(*) from public.duel_votes), 0::bigint, 'suara terhapus (admin view)');

-- ---------- hapus / batas ----------
set role authenticated;
select t.login('00000000-0000-0000-0000-00000000000b');
delete from public.posts;  -- bukan miliknya
reset role;
select t.eq((select count(*) from public.posts), 7::bigint, 'B tidak bisa menghapus post orang lain');
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000a');
delete from public.posts where title = 'Tim C';
reset role;
select t.eq((select count(*) from public.posts), 6::bigint, 'A menghapus post sendiri');

-- batas laju posting: A punya 6 post dalam 1 jam terakhir -> 4 lagi boleh, berikutnya ditolak
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000a');
insert into public.posts(kind,title,payload) values ('build','bulk 1',t.v('x1')),('build','bulk 2',t.v('x2')),('build','bulk 3',t.v('x3')),('build','bulk 4',t.v('x4'));
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','bulk 5',t.v('x5'))$q$, 'rate_limit_posts');
-- kuota total 60 (rate limit tidak berlaku untuk post lama)
reset role;
update public.posts set created_at = now() - interval '3 hours' where user_id = '00000000-0000-0000-0000-00000000000a';
insert into public.posts(user_id, kind, title, payload, created_at)
  select '00000000-0000-0000-0000-00000000000a', 'build', 'q' || i,
         translate(rtrim(encode(convert_to('{"n":"q' || i || '","h":"layla"}', 'UTF8'), 'base64'), '='), '+/' || chr(10), '-_'),
         now() - interval '3 hours'
  from generate_series(1, 50) i;
select t.eq((select count(*) from public.posts where user_id = '00000000-0000-0000-0000-00000000000a'), 60::bigint, 'A tepat 60 post');
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000a');
select t.fails($q$insert into public.posts(kind,title,payload) values ('build','bulk 6',t.v('x6'))$q$, 'post_quota');

-- batas laju komentar (30/jam). Komentar lama B dibersihkan dulu: duel di atas menghapus satu post acak, bisa jadi bersama komentarnya.
reset role;
delete from public.comments where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.comments(post_id, body) select (select id from public.posts where title='Tim A'), 'k' || i from generate_series(1, 30) i;
select t.fails($q$insert into public.comments(post_id, body) select id, 'k31' from public.posts where title='Tim A'$q$, 'rate_limit_comments');

-- ---------- profil v2: bio & hero utama ----------
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
update public.profiles set bio = 'Main jungle, suka Ling', main_hero = 'ling' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select t.eq((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Main jungle, suka Ling', 'profil: pemilik bisa mengisi bio');
select t.eq((select main_hero from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'ling', 'profil: pemilik bisa memilih hero utama');
select t.eq((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), '', 'profil: bio default kosong');
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
update public.profiles set bio = 'diretas' where id = '00000000-0000-0000-0000-00000000000c';
reset role;
select t.eq((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), '', 'profil: tidak bisa mengubah bio orang lain');
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
select t.fails($q$update public.profiles set bio = repeat('x', 161) where id = auth.uid()$q$, 'profiles_bio_check');
select t.fails($q$update public.profiles set bio = E'baris\x01kontrol' where id = auth.uid()$q$, 'profiles_bio_check');
select t.fails($q$update public.profiles set main_hero = 'Ling; drop' where id = auth.uid()$q$, 'profiles_main_hero_check');
select t.fails($q$update public.profiles set main_hero = '' where id = auth.uid()$q$, 'profiles_main_hero_check');
select t.fails($q$update public.profiles set created_at = now() where id = auth.uid()$q$, 'permission denied');
update public.profiles set main_hero = null where id = auth.uid();
reset role;
select t.eq((select main_hero from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null::text, 'profil: hero utama bisa dikosongkan');
set role anon;
select t.eq((select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Main jungle, suka Ling', 'profil: bio terbaca publik (anon)');

-- ---------- simpanan (bookmark) ----------
select t.fails($q$select * from public.bookmarks$q$, 'permission denied');
select t.fails($q$insert into public.bookmarks(post_id) values (gen_random_uuid())$q$, 'permission denied');
reset role; set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.bookmarks(post_id) select id from public.posts where title in ('Tim B', 'Tim A');
select t.eq((select count(*) from public.bookmarks), 2::bigint, 'bookmark: B menyimpan 2 tulisan');
select t.eq((select user_id from public.bookmarks limit 1), '00000000-0000-0000-0000-00000000000b'::uuid, 'bookmark: user_id diisi auth.uid()');
select t.fails($q$insert into public.bookmarks(post_id) select id from public.posts where title = 'Tim B'$q$, 'duplicate key');
select t.fails($q$insert into public.bookmarks(user_id, post_id) select '00000000-0000-0000-0000-00000000000c', id from public.posts where title = 'Tim B'$q$, 'permission denied');
select t.fails($q$insert into public.bookmarks(post_id) values (gen_random_uuid())$q$, 'row-level security');
select t.login('00000000-0000-0000-0000-00000000000c');
select t.eq((select count(*) from public.bookmarks), 0::bigint, 'bookmark: C tidak melihat simpanan B');
delete from public.bookmarks;
select t.login('00000000-0000-0000-0000-00000000000b');
select t.eq((select count(*) from public.bookmarks), 2::bigint, 'bookmark: C tidak bisa menghapus simpanan B');
delete from public.bookmarks where post_id = (select id from public.posts where title = 'Tim A');
select t.eq((select count(*) from public.bookmarks), 1::bigint, 'bookmark: B bisa melepas simpanan');
-- tulisan yang disembunyikan tidak bisa disimpan
reset role;
insert into t.vars select 'tima_id', id::text from public.posts where title = 'Tim A';
update public.posts set hidden = true where title = 'Tim A';
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
select t.fails($q$insert into public.bookmarks(post_id) values (t.v('tima_id')::uuid)$q$, 'row-level security');
-- hapus tulisan -> simpanan ikut terhapus
reset role;
update public.posts set hidden = false where title = 'Tim A';
delete from public.posts where title = 'Tim B';
select t.eq((select count(*) from public.bookmarks), 0::bigint, 'bookmark: ikut terhapus saat tulisan dihapus (cascade)');
-- kuota 200
alter table public.posts disable trigger mbl_posts_before_insert;
insert into public.posts(user_id, kind, title, payload)
  select '00000000-0000-0000-0000-00000000000d', 'build', 'bm' || i,
         translate(rtrim(encode(convert_to('{"n":"bm' || i || '","h":"layla"}', 'UTF8'), 'base64'), '='), '+/' || chr(10), '-_')
  from generate_series(1, 201) i;
alter table public.posts enable trigger mbl_posts_before_insert;
set role authenticated; select t.login('00000000-0000-0000-0000-00000000000b');
insert into public.bookmarks(post_id) select id from public.posts where title like 'bm%' order by title limit 200;
select t.eq((select count(*) from public.bookmarks), 200::bigint, 'bookmark: tepat 200 diizinkan');
select t.fails($q$insert into public.bookmarks(post_id) select id from public.posts where title like 'bm%' order by title desc limit 1$q$, 'bookmark_quota');
reset role;
delete from public.posts where title like 'bm%';

-- ringkasan
reset role;
select count(*) || ' pemeriksaan lulus' from t.log;
