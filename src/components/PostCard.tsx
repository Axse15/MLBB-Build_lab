import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import {
  MIN_DUELS_FOR_RANK,
  ago,
  bookmarkedIds,
  friendlyError,
  likedIds,
  setBookmark,
  setLike,
  winRate,
  type Post,
  type PostKind,
} from '../lib/community';
import { avatarHue } from '../lib/util';
import { hashFor } from '../route';
import { Glyph } from './Glyph';
import { PostBody, PostNote, useDecoded } from './PostBody';
import { useToast } from './ui';

export const KIND_LABEL: Record<PostKind, string> = { build: 'Build', team: 'Komposisi' };

/** Tautan ke tulisan yang bisa dibagikan. */
export const postLink = (id: string): string => `${window.location.origin}${window.location.pathname}${hashFor('community', { post: id })}`;

/** Status "disukai" untuk tulisan yang sedang tampil, plus aksi suka/batal dengan pembaruan optimis. */
export function useLikes() {
  const { db, state, requireLogin } = useAuth();
  const notify = useToast();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const userId = state.status === 'in' ? state.userId : null;

  useEffect(() => {
    if (!userId) setLiked(new Set());
  }, [userId]);

  const load = useCallback(
    async (ids: string[]) => {
      if (!db || !userId || ids.length === 0) return;
      try {
        const s = await likedIds(db, ids);
        setLiked((prev) => new Set([...prev, ...s]));
      } catch {
        /* status suka gagal dimuat: tombol tetap bisa dipakai */
      }
    },
    [db, userId],
  );

  const toggle = useCallback(
    async (id: string, bump: (delta: number) => void) => {
      if (!requireLogin('Masuk dengan Google untuk menyukai tulisan.')) return;
      if (!db || !userId) return;
      const was = liked.has(id);
      const apply = (on: boolean) => {
        setLiked((prev) => {
          const n = new Set(prev);
          if (on) n.add(id);
          else n.delete(id);
          return n;
        });
        bump(on ? 1 : -1);
      };
      apply(!was);
      try {
        await setLike(db, id, userId, !was);
      } catch (e) {
        apply(was);
        notify(friendlyError(e));
      }
    },
    [db, liked, notify, requireLogin, userId],
  );

  return { liked, load, toggle };
}

/** Sama seperti useLikes, untuk simpanan pribadi. `onChange` dipanggil setelah server menerima perubahan. */
export function useBookmarks(onChange?: (id: string, on: boolean) => void) {
  const { db, state, requireLogin } = useAuth();
  const notify = useToast();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const userId = state.status === 'in' ? state.userId : null;

  useEffect(() => {
    if (!userId) setSaved(new Set());
  }, [userId]);

  const load = useCallback(
    async (ids: string[]) => {
      if (!db || !userId || ids.length === 0) return;
      try {
        const s = await bookmarkedIds(db, ids);
        setSaved((prev) => new Set([...prev, ...s]));
      } catch {
        /* status simpanan gagal dimuat: tombol tetap bisa dipakai */
      }
    },
    [db, userId],
  );

  const toggle = useCallback(
    async (id: string) => {
      if (!requireLogin('Masuk dengan Google untuk menyimpan tulisan.')) return;
      if (!db || !userId) return;
      const was = saved.has(id);
      const apply = (on: boolean) =>
        setSaved((prev) => {
          const n = new Set(prev);
          if (on) n.add(id);
          else n.delete(id);
          return n;
        });
      apply(!was);
      try {
        await setBookmark(db, id, userId, !was);
        notify(was ? 'Dilepas dari simpanan' : 'Disimpan');
        onChange?.(id, !was);
      } catch (e) {
        apply(was);
        notify(friendlyError(e));
      }
    },
    [db, notify, onChange, requireLogin, saved, userId],
  );

  return { saved, load, toggle };
}

export function Author({ post }: { post: Pick<Post, 'author' | 'createdAt' | 'userId'> }) {
  return (
    <span className="cm-author">
      <span className="uav" style={{ ['--s' as string]: '20px', ['--h' as string]: avatarHue(post.userId) }} aria-hidden="true">
        {post.author.slice(0, 1).toUpperCase()}
      </span>
      <a href={hashFor('profile', { u: post.userId })}>{post.author}</a>
      <span aria-hidden="true">·</span>
      <span>{ago(post.createdAt)}</span>
    </span>
  );
}

export function LikeButton({ count, on, onClick }: { count: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`cm-like${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? `Batal suka, ${count} suka` : `Suka, ${count} suka`} onClick={onClick}>
      <Glyph name="heart" /> {count}
    </button>
  );
}

export function SaveButton({ on, onClick, label = true }: { on: boolean; onClick: () => void; label?: boolean }) {
  return (
    <button type="button" className={`cm-save${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? 'Lepas dari simpanan' : 'Simpan tulisan ini'} onClick={onClick}>
      <Glyph name="bookmark" />
      {label && (on ? 'Disimpan' : 'Simpan')}
    </button>
  );
}

export function UseButton({ post }: { post: Post }) {
  const d = useDecoded(post);
  const page = post.kind === 'build' ? 'builder' : 'team';
  if (!d) return null;
  return (
    <a className="btn small" href={hashFor(page, { s: post.payload })} title="Memuat ke editor dan menggantikan draf yang sedang terbuka">
      {post.kind === 'build' ? 'Pakai build ini' : 'Pakai komposisi ini'}
    </a>
  );
}

export function PostCard({
  post,
  liked,
  onLike,
  saved,
  onSave,
  mine,
  onDelete,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
  saved: boolean;
  onSave: () => void;
  mine: boolean;
  onDelete?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const rate = winRate(post);
  return (
    <li className="card cm-card">
      <div className="cm-card-head">
        <div className="grow">
          <a className="cm-title" href={hashFor('community', { post: post.id })}>
            {post.title}
          </a>
          <div>
            <Author post={post} />
            {post.hidden && <span className="tag static warn"> disembunyikan (laporan)</span>}
          </div>
        </div>
        {rate !== null && post.duelPlayed >= MIN_DUELS_FOR_RANK && (
          <span className="tag static" title={`${rate}% menang di Adu`}>
            {post.duelWins}/{post.duelPlayed} menang
          </span>
        )}
      </div>
      <PostBody post={post} compact />
      <PostNote post={post} clamp />
      <div className="cm-card-foot">
        <LikeButton count={post.likes} on={liked} onClick={onLike} />
        <a className="cm-cmt" href={hashFor('community', { post: post.id })} aria-label={`${post.comments} komentar`}>
          <Glyph name="comment" /> {post.comments}
        </a>
        <SaveButton on={saved} onClick={onSave} label={false} />
        <span className="grow" />
        <UseButton post={post} />
        {mine && onDelete && (
          <button
            type="button"
            className={`btn small ${confirm ? 'danger' : 'ghost'}`}
            onClick={() => {
              if (confirm) onDelete();
              else {
                setConfirm(true);
                window.setTimeout(() => setConfirm(false), 3000);
              }
            }}
          >
            {confirm ? 'Yakin hapus?' : 'Hapus'}
          </button>
        )}
      </div>
    </li>
  );
}
