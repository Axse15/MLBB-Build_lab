import { useMemo, useState } from "react";
import {
  LAST_VERIFIED,
  PATCHES,
  SERVER_INFO,
  SOURCES,
  type Change,
  type ChangeKind,
  type Patch,
  type ServerId,
} from "../data/patches";
import { ago, useLive } from "../live";
import { compareVersions } from "../lib/live";
import { usePersistent } from "../store";

const KIND_LABEL: Record<ChangeKind, string> = {
  buff: "Buff",
  nerf: "Nerf",
  rework: "Rework",
  adjust: "Adjust",
};
const KINDS: ChangeKind[] = ["buff", "nerf", "rework", "adjust"];

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${iso}T12:00:00+07:00`));

const DETAIL_LABEL: Record<Patch["detail"], string> = {
  full: "Rincian hero",
  "heroes-only": "Nama hero, tanpa angka",
  counts: "Hanya jumlah",
  none: "Belum ada rincian",
};

function Counts({ p }: { p: Patch }) {
  if (!p.counts) return null;
  const c = p.counts;
  const parts: [string, number, ChangeKind][] = [
    ["buff", c.buff, "buff"],
    ["nerf", c.nerf, "nerf"],
    ["rework", c.rework ?? 0, "rework"],
    ["adjust", c.adjust, "adjust"],
  ];
  return (
    <span
      className="p-counts"
      aria-label="Jumlah perubahan menurut daftar sumber"
    >
      {parts
        .filter(([, n]) => n > 0)
        .map(([label, n, k]) => (
          <span key={label} className={`p-kind k-${k}`}>
            {n} {label}
          </span>
        ))}
    </span>
  );
}

function ChangeList({ list, title }: { list: Change[]; title: string }) {
  if (list.length === 0) return null;
  return (
    <section className="stack">
      <h4 className="p-sub">{title}</h4>
      <ul className="p-list">
        {list.map((c) => (
          <li key={`${c.kind}-${c.name}`} className="p-row">
            <span className={`p-kind k-${c.kind}`}>{KIND_LABEL[c.kind]}</span>
            <strong className="p-name">{c.name}</strong>
            <span className="p-note">{c.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PatchCard({
  p,
  q,
  kinds,
  open,
}: {
  p: Patch;
  q: string;
  kinds: Set<ChangeKind>;
  open: boolean;
}) {
  const needle = q.trim().toLowerCase();
  const keep = (c: Change) =>
    kinds.has(c.kind) && (!needle || c.name.toLowerCase().includes(needle));
  const heroes = p.heroes.filter(keep);
  const items = p.items.filter(keep);
  const brawl = (p.brawl ?? []).filter(
    (b) => !needle || b.hero.toLowerCase().includes(needle),
  );
  const filtering = needle !== "" || kinds.size < KINDS.length;
  const emptyHit =
    filtering && heroes.length + items.length === 0 && brawl.length === 0;

  return (
    <details className="panel patch" open={open}>
      <summary className="patch-sum">
        <span className="patch-ver">{p.version}</span>
        <span className="muted small">{fmtDate(p.date)}</span>
        {p.status && <span className="tag static p-status">{p.status}</span>}
        <Counts p={p} />
        <span className="muted small p-detail">{DETAIL_LABEL[p.detail]}</span>
      </summary>

      <div className="patch-body">
        {emptyHit ? (
          <p className="empty">
            Tidak ada perubahan yang cocok dengan filter di patch ini.
          </p>
        ) : (
          <>
            <ChangeList list={heroes} title="Hero" />
            <ChangeList list={items} title="Item, battlefield, dan spell" />
            {!filtering && p.system.length > 0 && (
              <section className="stack">
                <h4 className="p-sub">Sistem dan battlefield</h4>
                <ul className="p-plain">
                  {p.system.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
            {brawl.length > 0 && (
              <details className="p-brawl">
                <summary>Penyesuaian hero mode Brawl ({brawl.length})</summary>
                <ul className="p-list">
                  {brawl.map((b) => (
                    <li key={b.hero} className="p-row">
                      <span
                        className={`p-kind ${b.dir === "up" ? "k-buff" : "k-nerf"}`}
                      >
                        {b.dir === "up" ? "Naik" : "Turun"}
                      </span>
                      <strong className="p-name">{b.hero}</strong>
                      <span className="p-note">{b.note}</span>
                    </li>
                  ))}
                </ul>
                <p className="muted small">
                  Hanya berlaku di mode Brawl, bukan Classic/Ranked.
                </p>
              </details>
            )}
            {p.detail === "counts" || p.detail === "none" ? (
              <p className="muted small">
                Rincian per hero belum saya ambil untuk patch ini.
              </p>
            ) : null}
          </>
        )}
        {p.caveat && <p className="p-caveat small">{p.caveat}</p>}
        <p className="small">
          <a href={p.url} target="_blank" rel="noreferrer">
            Buka sumber patch {p.version}
          </a>
        </p>
      </div>
    </details>
  );
}

function VersionCheck() {
  const { version } = useLive();
  if (version.state === "loading") return null;
  if (!version.data) {
    return (
      <p className="small muted">
        Versi game terbaru tidak bisa dicek dari API ({version.error}).
      </p>
    );
  }
  const v = version.data;
  const known = PATCHES.some((p) => compareVersions(p.version, v) === 0);
  const newest = PATCHES.reduce(
    (a, p) => (compareVersions(p.version, a) > 0 ? p.version : a),
    PATCHES[0].version,
  );
  const ahead = compareVersions(v, newest) > 0;
  const behind = compareVersions(v, newest) < 0 && !known;
  // API yang tertinggal (nomor lebih kecil dari patch yang sudah kita punya) bukan alasan untuk menandai data kita usang.
  return (
    <p className={`small ${known || behind ? "muted" : "p-caveat"}`}>
      Versi terakhir yang tercatat di Rone Arena API: <strong>{v}</strong> (
      {ago(version.at)}; API tidak menyebut server Original atau Advanced).{" "}
      {known
        ? "Versi ini sudah ada di data patch di bawah."
        : ahead
          ? `Versi ini lebih baru daripada patch terbaru di data (${newest}), jadi catatan patch di halaman ini kemungkinan tertinggal.`
          : behind
            ? `Ini lebih lama daripada patch di data kita (${newest}), artinya nomor versi di API ini yang tertinggal. Abaikan; halaman ini tidak memakainya untuk menilai patch.`
            : "Versi ini tidak ada di data patch di bawah."}
    </p>
  );
}

export function PatchPage({ params }: { params: URLSearchParams }) {
  const fromUrl = params.get("server") === "advanced" ? "advanced" : "original";
  const [server, setServer] = usePersistent<ServerId>(
    "mbl:patch-server:v1",
    fromUrl,
    (v) => v === "original" || v === "advanced",
  );
  const active: ServerId = params.has("server") ? fromUrl : server;
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<ChangeKind>>(() => new Set(KINDS));

  const list = useMemo(
    () =>
      PATCHES.filter((p) => p.server === active).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [active],
  );
  const info = SERVER_INFO[active];

  const toggle = (k: ChangeKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next.size === 0 ? new Set(KINDS) : next;
    });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Update patch MLBB</h1>
        <p className="muted">
          Catatan patch Original Server dan Advanced Server. Data statis,
          terakhir diperiksa {LAST_VERIFIED}; bukan feed langsung, jadi patch
          yang rilis setelah itu belum ada di sini.
        </p>
      </header>

      <VersionCheck />

      <div className="chips seg" role="group" aria-label="Pilih server">
        {(Object.keys(SERVER_INFO) as ServerId[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip plain${active === s ? " on" : ""}`}
            aria-pressed={active === s}
            onClick={() => setServer(s)}
          >
            {SERVER_INFO[s].label}
          </button>
        ))}
      </div>

      <section className={`panel p-server s-${active}`}>
        <p>{info.blurb}</p>
        {active === "advanced" && (
          <p className="small muted">
            Contoh di data ini: Advanced 2.2.28 membatalkan perubahan Golden
            Turret dan Gloo dari minggu sebelumnya, dan mengembalikan sebagian
            perubahan Melissa.
          </p>
        )}
      </section>

      <div className="row p-filters">
        <input
          className="input"
          type="search"
          placeholder="Cari hero atau item di semua patch"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari hero atau item"
        />
        <div className="chips" role="group" aria-label="Filter jenis perubahan">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chip plain${kinds.has(k) ? " on" : ""}`}
              aria-pressed={kinds.has(k)}
              onClick={() => toggle(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="stack patches">
        {list.map((p, i) => (
          <PatchCard
            key={p.version}
            p={p}
            q={q}
            kinds={kinds}
            open={i === 0 || q.trim() !== ""}
          />
        ))}
      </div>

      <section className="panel">
        <h2>Sumber dan batasan</h2>
        <ul className="sources">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Isi dirangkum dari sumber di atas dan tidak diverifikasi langsung di
          game. Untuk patch lama saya hanya punya jumlah perubahan, bukan daftar
          hero. Update hero di sini tidak otomatis masuk ke data build; kalau
          item atau hero berubah, perbarui file data di proyek.
        </p>
      </section>
    </div>
  );
}
