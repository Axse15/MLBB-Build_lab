import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '../auth';
import { AddHeroModal } from '../components/AddHero';
import { HeroPicker } from '../components/HeroPicker';
import { PublishDialog } from '../components/PublishDialog';
import { RecoPanel } from '../components/RecoPanel';
import { HeroAvatar, Icon, IssueList, Modal, ShareDialog, useToast } from '../components/ui';
import { EMBLEMS, EMBLEM_BY_ID, TALENT_SLOTS } from '../data/emblems';
import { ROLE_COLOR } from '../data/heroes';
import { ITEMS, ITEM_BY_ID, KIND_LABEL } from '../data/items';
import { checkBuild, itemsOf, totalCost } from '../lib/analysis';
import type { Reco } from '../lib/live';
import { recoToBuild } from '../lib/reco';
import { decodeBuild, encodeBuild } from '../lib/share';
import { emptyItems, formatGold, uid } from '../lib/util';
import { clearQuery, shareUrl } from '../route';
import { useLive } from '../live';
import { usePersistent, useStore } from '../store';
import type { Build, Hero, ItemKind } from '../types';

const blank = (): Build => ({
  id: uid(),
  name: '',
  heroId: '',
  items: emptyItems(),
  emblemId: '',
  talents: [],
  spellId: '',
  notes: '',
  updatedAt: Date.now(),
});

const KINDS: (ItemKind | 'all')[] = ['all', 'attack', 'magic', 'hybrid', 'defense', 'boots', 'jungle', 'roam'];

export function BuilderPage({ params }: { params: URLSearchParams }) {
  const { heroes, heroMap, heroById, builds, saveBuild, deleteBuild, addHero } = useStore();
  const notify = useToast();
  const { state: auth, requireLogin } = useAuth();
  const { catalog } = useLive();
  const talentSlot = useMemo(() => new Map(catalog.talents.map((t) => [t.name, t.slot])), [catalog]);

  const [draft, setDraft] = usePersistent<Build>(
    'mbl:draft:v1',
    blank(),
    (v) => !!v && typeof v === 'object' && Array.isArray((v as Build).items) && (v as Build).items.length === 6,
  );
  const [slot, setSlot] = useState(() => Math.max(0, draft.items.findIndex((x) => !x)));
  const [pickHero, setPickHero] = useState(false);
  const [addingHero, setAddingHero] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [kind, setKind] = useState<ItemKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Impor dari tautan bagikan
  useEffect(() => {
    const s = params.get('s');
    if (!s) return;
    const b = decodeBuild(s, heroMap);
    if (b) {
      setDraft(b);
      setSlot(Math.max(0, b.items.findIndex((x) => !x)));
      notify('Build dari tautan dimuat. Simpan kalau mau dipertahankan.');
    } else {
      notify('Tautan build tidak valid, atau hero-nya tidak dikenal di daftar kamu.');
    }
    clearQuery('builder');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hero = heroById(draft.heroId);
  const emblem = EMBLEM_BY_ID[draft.emblemId];
  const items = useMemo(() => itemsOf(draft.items), [draft.items]);
  const cost = totalCost(items);
  const issues = useMemo(() => checkBuild(items), [items]);
  const saved = builds.some((b) => b.id === draft.id);

  const patch = (p: Partial<Build>) => setDraft((d) => ({ ...d, ...p, updatedAt: Date.now() }));

  const onPickHero = (h: Hero) => {
    const roleEmblem = EMBLEM_BY_ID[h.roles[0].toLowerCase()];
    patch({
      heroId: h.id,
      name: draft.name || `${h.name} build`,
      ...(draft.emblemId || !roleEmblem ? {} : { emblemId: roleEmblem.id, talents: roleEmblem.recommended }),
    });
    setPickHero(false);
  };

  const place = (id: string) => {
    const next = [...draft.items];
    let target = slot;
    if (next[slot]) {
      const e = next.findIndex((x) => !x);
      if (e >= 0) target = e;
    }
    next[target] = id;
    patch({ items: next });
    const after = next.findIndex((x) => !x);
    setSlot(after >= 0 ? after : target);
  };

  const clearSlot = (i: number) => {
    const next = [...draft.items];
    next[i] = null;
    patch({ items: next });
    setSlot(i);
  };

  const setEmblem = (id: string) => {
    const e = EMBLEM_BY_ID[id];
    patch({ emblemId: id, talents: e ? e.recommended : [] });
  };

  // Satu talent per tier: memilih talent di tier yang sudah terisi menggantikan yang lama.
  const toggleTalent = (name: string) => {
    if (draft.talents.includes(name)) return patch({ talents: draft.talents.filter((t) => t !== name) });
    const slotOf = talentSlot.get(name);
    const kept = draft.talents.filter((t) => talentSlot.get(t) !== slotOf);
    if (kept.length >= 3) return notify('Maksimal 3 talent. Lepas satu dulu.');
    patch({ talents: [...kept, name] });
  };

  const applyReco = (r: Reco) => {
    const { patch: p, missing, substituted } = recoToBuild(r, catalog);
    patch(p);
    setSlot(Math.max(0, p.items.findIndex((x) => !x)));
    const notes = [
      substituted.length ? `Boots varian diganti boots dasar (${substituted.join('; ')})` : '',
      missing.length ? `Tidak ada di data app, dilewati: ${missing.join(', ')}` : '',
    ].filter(Boolean);
    notify(notes.length ? `Build dipasang. ${notes.join('. ')}` : 'Build dipasang ke editor. Simpan kalau mau dipertahankan.');
  };

  const save = () => {
    if (!hero) return;
    const name = draft.name.trim() || `${hero.name} build`;
    const b = { ...draft, name, updatedAt: Date.now() };
    saveBuild(b);
    setDraft(b);
    notify(saved ? `Diperbarui: ${name}` : `Tersimpan: ${name}`);
  };

  const MIN_PUBLISH_ITEMS = 4;
  const publish = () => {
    if (!hero) return;
    if (hero.custom) return notify('Hero kustom tidak bisa dibagikan ke komunitas: pemain lain tidak punya hero ini.');
    if (items.length < MIN_PUBLISH_ITEMS) return notify(`Isi minimal ${MIN_PUBLISH_ITEMS} item sebelum dibagikan ke komunitas.`);
    if (!requireLogin('Masuk dengan Google untuk membagikan build ke komunitas.')) return;
    setPublishing(true);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ITEMS.filter((i) => (kind === 'all' || i.kind === kind) && i.name.toLowerCase().includes(needle));
  }, [kind, q]);

  const roleColor = hero ? ROLE_COLOR[hero.roles[0]] : 'var(--line-2)';

  return (
    <div className="page">
      <header className="page-head">
        <h1>Build hero</h1>
        <p className="muted">Pilih hero, isi enam item, atur emblem dan battle spell. Peringatan muncul kalau ada boots ganda atau passive yang bentrok.</p>
      </header>

      <div className="builder">
        <section className="panel hero-panel" style={{ ['--c' as string]: roleColor } as CSSProperties}>
          {hero ? (
            <div className="hero-head">
              <HeroAvatar hero={hero} size={72} />
              <div className="grow">
                <h2>{hero.name}</h2>
                <p className="muted">
                  {hero.roles.join(' / ')}
                  {hero.custom && ' (kustom)'}
                </p>
              </div>
              <button type="button" className="btn" onClick={() => setPickHero(true)}>
                Ganti hero
              </button>
            </div>
          ) : (
            <div className="hero-empty">
              <HeroAvatar size={72} />
              <div className="grow">
                <h2>Belum ada hero</h2>
                <p className="muted">Mulai dengan memilih hero. {heroes.length} hero tersedia.</p>
              </div>
              <button type="button" className="btn primary" onClick={() => setPickHero(true)}>
                Pilih hero
              </button>
            </div>
          )}
          <label className="field">
            <span>Nama build</span>
            <input
              className="input"
              value={draft.name}
              maxLength={60}
              placeholder={hero ? `${hero.name} build` : 'Mis. Lancelot jungle agresif'}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
        </section>

        {hero && <RecoPanel key={hero.id} hero={hero} onApply={applyReco} />}

        <section className="panel">
          <div className="panel-head">
            <h2>Item</h2>
            <span className="gold">{formatGold(cost)} gold</span>
          </div>
          <div className="slots" role="group" aria-label="Slot item">
            {draft.items.map((id, i) => {
              const it = id ? ITEM_BY_ID[id] : undefined;
              return (
                <div key={i} className={`slot${slot === i ? ' active' : ''}${it ? ` k-${it.kind}` : ''}`}>
                  <button type="button" className="slot-main" onClick={() => setSlot(i)} aria-pressed={slot === i} aria-label={`Slot ${i + 1}${it ? `: ${it.name}` : ' kosong'}`}>
                    {it ? (
                      <>
                        <Icon kind="items" name={it.name} size={36} className="slot-ico" />
                        <span className="slot-name">{it.name}</span>
                        <span className="slot-cost">{formatGold(it.cost)}</span>
                      </>
                    ) : (
                      <span className="slot-plus">+</span>
                    )}
                  </button>
                  {it && (
                    <button type="button" className="slot-x" onClick={() => clearSlot(i)} aria-label={`Lepas ${it.name}`}>
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <IssueList issues={issues} />

          <div className="chips tabs" role="group" aria-label="Kategori item">
            {KINDS.map((k) => (
              <button key={k} type="button" className={`chip plain${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k === 'all' ? 'Semua' : KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <input className="input" type="search" placeholder="Cari item" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari item" />
          <ul className="item-list">
            {filtered.map((it) => {
              const used = draft.items.includes(it.id);
              return (
                <li key={it.id}>
                  <button type="button" className={`item-btn k-${it.kind}${used ? ' used' : ''}`} onClick={() => place(it.id)}>
                    <Icon kind="items" name={it.name} size={36} />
                    <span className="item-body">
                      <span className="item-top">
                        <span className="item-name">{it.name}</span>
                        <span className="gold small">{it.cost ? formatGold(it.cost) : 'gratis'}</span>
                      </span>
                      <span className="item-stats">
                        {it.stats}
                        {it.passive ? ` · ${it.passive}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && <p className="empty">Tidak ada item yang cocok dengan filter ini.</p>}
          <p className="muted small">Data patch 2.2.16a. Stat tertentu diringkas, jadi cek in-game untuk angka lengkap.</p>
        </section>

        <section className="panel">
          <h2>Emblem dan talent</h2>
          <label className="field">
            <span>Emblem</span>
            <select className="input" value={draft.emblemId} onChange={(e) => setEmblem(e.target.value)}>
              <option value="">Belum dipilih</option>
              {EMBLEMS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          {emblem && <p className="muted small">Stat dasar: {emblem.base}. Memilih emblem mengisi talent dengan rekomendasi umumnya; ubah sesuai heromu.</p>}
          <p className="muted small">Talent dipilih satu per tier, dan boleh dari set emblem mana pun (seperti di game).</p>
          {TALENT_SLOTS.map((n) => (
            <div key={n} className="tier-row">
              <span className="tier-label">{n === 3 ? 'Tier 3 (core)' : `Tier ${n}`}</span>
              <div className="chips" role="group" aria-label={`Talent tier ${n}`}>
                {catalog.talents.filter((t) => t.slot === n).map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    className={`chip plain${draft.talents.includes(t.name) ? ' on' : ''}`}
                    aria-pressed={draft.talents.includes(t.name)}
                    title={`${t.setName}: ${t.text}`}
                    onClick={() => toggleTalent(t.name)}
                  >
                    <Icon kind="talents" name={t.name} size={18} />
                    {t.name}
                    <span className="tier">{t.setName}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="picked">
            <span className="muted small">Talent terpilih ({draft.talents.length}/3):</span>
            {draft.talents.length === 0 && <span className="muted small"> belum ada</span>}
            {draft.talents.map((t) => (
              <button key={t} type="button" className="tag" onClick={() => toggleTalent(t)} aria-label={`Lepas talent ${t}`}>
                {t} ×
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Battle spell</h2>
          <div className="spells" role="group" aria-label="Battle spell">
            {catalog.spells.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`spell${draft.spellId === s.id ? ' on' : ''}`}
                aria-pressed={draft.spellId === s.id}
                onClick={() => patch({ spellId: draft.spellId === s.id ? '' : s.id })}
                title={s.text}
              >
                <span className="spell-name">
                  <Icon kind="spells" name={s.name} size={24} />
                  {s.name}
                </span>
                <span className="muted small">{s.cooldown ? `${s.cooldown}s` : '?'}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Catatan ({draft.notes.length}/280)</span>
            <textarea
              className="input"
              rows={3}
              maxLength={280}
              value={draft.notes}
              placeholder="Urutan skill, kapan beli item, lawan yang perlu diwaspadai"
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </label>
        </section>

        <div className="actions">
          <button type="button" className="btn primary" disabled={!hero} onClick={save}>
            {saved ? 'Perbarui build' : 'Simpan build'}
          </button>
          <button type="button" className="btn" disabled={!hero} onClick={() => setShare(shareUrl('builder', encodeBuild(draft)))}>
            Bagikan tautan
          </button>
          {auth.status !== 'off' && (
            <button type="button" className="btn" disabled={!hero || auth.status === 'loading'} onClick={publish}>
              Bagikan ke komunitas
            </button>
          )}
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setDraft(blank());
              setSlot(0);
            }}
          >
            Build baru
          </button>
          <button type="button" className="btn ghost" onClick={() => setAddingHero(true)}>
            Hero kustom
          </button>
        </div>
      </div>

      <section className="panel saved">
        <div className="panel-head">
          <h2>Build tersimpan</h2>
          <span className="muted small">{builds.length} build, disimpan di browser ini</span>
        </div>
        {builds.length === 0 ? (
          <p className="empty">Belum ada build tersimpan. Susun satu di atas lalu tekan Simpan build.</p>
        ) : (
          <ul className="cards">
            {builds.map((b) => {
              const h = heroById(b.heroId);
              const its = itemsOf(b.items);
              return (
                <li key={b.id} className="card">
                  <div className="card-top">
                    <HeroAvatar hero={h} size={40} />
                    <div className="grow">
                      <strong>{b.name}</strong>
                      <div className="muted small">
                        {h ? h.name : 'Hero dihapus'} · {its.length}/6 item · <span className="gold">{formatGold(totalCost(its))}</span>
                      </div>
                    </div>
                  </div>
                  <p className="muted small clamp">{its.map((i) => i.name).join(', ') || 'Belum ada item'}</p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setDraft({ ...b });
                        setSlot(Math.max(0, b.items.findIndex((x) => !x)));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        saveBuild({ ...b, id: uid(), name: `${b.name} (salinan)`, updatedAt: Date.now() });
                        notify('Build diduplikasi');
                      }}
                    >
                      Duplikat
                    </button>
                    <button
                      type="button"
                      className={`btn small ${confirmDel === b.id ? 'danger' : 'ghost'}`}
                      onClick={() => {
                        if (confirmDel === b.id) {
                          deleteBuild(b.id);
                          setConfirmDel(null);
                        } else {
                          setConfirmDel(b.id);
                          window.setTimeout(() => setConfirmDel((c) => (c === b.id ? null : c)), 3000);
                        }
                      }}
                    >
                      {confirmDel === b.id ? 'Yakin hapus?' : 'Hapus'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pickHero && (
        <Modal title="Pilih hero" onClose={() => setPickHero(false)} wide>
          <HeroPicker heroes={heroes} onPick={onPickHero} selectedId={draft.heroId} />
        </Modal>
      )}
      {addingHero && (
        <AddHeroModal
          onClose={() => setAddingHero(false)}
          onAdd={(h) => {
            const created = addHero(h);
            setAddingHero(false);
            notify(`${created.name} ditambahkan`);
          }}
        />
      )}
      {share && <ShareDialog title="Bagikan build" url={share} onClose={() => setShare(null)} />}
      {publishing && hero && (
        <PublishDialog
          kind="build"
          initialTitle={draft.name.trim() || `${hero.name} build`}
          initialNote={draft.notes}
          payload={encodeBuild(draft)}
          summary={`${hero.name} · ${items.length}/6 item · ${formatGold(cost)} gold`}
          onClose={() => setPublishing(false)}
        />
      )}
    </div>
  );
}
