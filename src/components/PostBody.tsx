import { useMemo } from 'react';
import { EMBLEM_BY_ID, SPELL_BY_ID } from '../data/emblems';
import { analyzeComposition, checkBuild, itemsOf, totalCost } from '../lib/analysis';
import type { Post } from '../lib/community';
import { iconFor } from '../lib/live';
import { decodeBuild, decodeTeam } from '../lib/share';
import { formatGold } from '../lib/util';
import { useLive } from '../live';
import { useStore } from '../store';
import { LANES, type Build, type Team } from '../types';
import { HeroAvatar, Icon, Img, IssueList, initials } from './ui';

export type Decoded = { kind: 'build'; build: Build } | { kind: 'team'; team: Team; builds: Build[] } | null;

/** Dekode isi tulisan dengan validasi ketat yang sama seperti tautan bagikan. null = tidak bisa ditampilkan. */
export function useDecoded(post: Pick<Post, 'kind' | 'payload'>): Decoded {
  const { heroMap } = useStore();
  return useMemo(() => {
    if (post.kind === 'build') {
      const build = decodeBuild(post.payload, heroMap);
      return build ? { kind: 'build', build } : null;
    }
    const res = decodeTeam(post.payload, heroMap);
    return res ? { kind: 'team', team: res.team, builds: res.builds } : null;
  }, [post.kind, post.payload, heroMap]);
}

function ItemIcon({ name }: { name: string }) {
  const { icons } = useLive();
  return (
    <span className="cm-item" title={name}>
      <Img src={iconFor(icons.items, name)} size={34} className="cm-item-img" fallback={<span className="cm-item-ini">{initials(name)}</span>} />
    </span>
  );
}

function ItemRow({ ids }: { ids: (string | null)[] }) {
  const items = itemsOf(ids);
  return (
    <div className="cm-items" role="list" aria-label="Item">
      {items.map((it, i) => (
        <span key={`${it.id}-${i}`} role="listitem">
          <ItemIcon name={it.name} />
          <span className="sr">{it.name}</span>
        </span>
      ))}
      {items.length === 0 && <span className="muted small">Belum ada item</span>}
    </div>
  );
}

export function BuildView({ build, compact }: { build: Build; compact?: boolean }) {
  const { heroById } = useStore();
  const hero = heroById(build.heroId);
  const items = itemsOf(build.items);
  const emblem = EMBLEM_BY_ID[build.emblemId];
  const spell = SPELL_BY_ID[build.spellId];
  return (
    <div className="cm-build">
      <div className="cm-hero">
        <HeroAvatar hero={hero} size={compact ? 40 : 56} />
        <div className="grow">
          <strong>{hero ? hero.name : 'Hero tidak dikenal'}</strong>
          <div className="muted small">
            {hero ? hero.roles.join(' / ') : ''}
            {hero && items.length > 0 ? ' · ' : ''}
            {items.length > 0 && <span className="gold">{formatGold(totalCost(items))}</span>}
          </div>
        </div>
      </div>
      <ItemRow ids={build.items} />
      {(emblem || spell || build.talents.length > 0) && (
        <div className="cm-extra">
          {emblem && <span className="tag static">{emblem.name}</span>}
          {spell && (
            <span className="tag static">
              <Icon kind="spells" name={spell.name} size={16} />
              {spell.name}
            </span>
          )}
          {build.talents.map((t) => (
            <span key={t} className="tag static">
              <Icon kind="talents" name={t} size={16} />
              {t}
            </span>
          ))}
        </div>
      )}
      {!compact && build.notes && <p className="cm-notes">{build.notes}</p>}
      {!compact && <IssueList issues={checkBuild(items)} />}
    </div>
  );
}

export function TeamView({ team, builds, compact }: { team: Team; builds: Build[]; compact?: boolean }) {
  const { heroById } = useStore();
  const byId = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds]);
  const report = useMemo(() => analyzeComposition(team.slots, heroById, (id) => byId.get(id)), [team.slots, heroById, byId]);
  return (
    <div className="cm-team">
      <ul className="cm-lanes">
        {LANES.map((lane) => {
          const s = team.slots[lane];
          const hero = s.heroId ? heroById(s.heroId) : undefined;
          const build = s.buildId ? byId.get(s.buildId) : undefined;
          return (
            <li key={lane} className={`cm-lane${hero ? '' : ' empty'}`}>
              <span className="cm-lane-name">{lane}</span>
              <HeroAvatar hero={hero} size={compact ? 34 : 44} />
              <span className="cm-lane-hero">{hero ? hero.name : 'Kosong'}</span>
              {build && !compact && <ItemRow ids={build.items} />}
              {build && !compact && build.notes && <span className="muted small cm-lane-note">{build.notes}</span>}
            </li>
          );
        })}
      </ul>
      {!compact && (
        <>
          <div className="chips">
            {Object.entries(report.roleCounts).map(([r, n]) => (
              <span key={r} className="tag static">
                {r} {n}
              </span>
            ))}
          </div>
          <IssueList issues={report.issues} />
        </>
      )}
    </div>
  );
}

/** Isi tulisan; kalau tidak bisa didekode (mis. hero belum ada di daftar pembaca), tampilkan penjelasan. */
export function PostBody({ post, compact }: { post: Pick<Post, 'kind' | 'payload'>; compact?: boolean }) {
  const d = useDecoded(post);
  if (!d) return <p className="empty small">Isi tidak bisa ditampilkan: ada hero yang belum dikenal di daftar hero kamu. Coba muat ulang setelah daftar hero termuat.</p>;
  return d.kind === 'build' ? <BuildView build={d.build} compact={compact} /> : <TeamView team={d.team} builds={d.builds} compact={compact} />;
}

/** Catatan komunitas. Disembunyikan kalau sama persis dengan catatan di dalam build (supaya tidak tampil dua kali). */
export function PostNote({ post, clamp }: { post: Pick<Post, 'kind' | 'payload' | 'note'>; clamp?: boolean }) {
  const d = useDecoded(post);
  const note = post.note.trim();
  if (!note || (d?.kind === 'build' && d.build.notes.trim() === note)) return null;
  return <p className={clamp ? 'muted small clamp cm-card-note' : 'cm-notes'}>{note}</p>;
}
