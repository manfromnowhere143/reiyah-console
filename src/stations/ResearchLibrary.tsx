import { useEffect, useMemo, useState } from "react";
import { Blocked, useSurfaceState } from "../components/primitives";
import { EditionLabel, DocumentReader, Segments } from "../components/Research";
import { editionManifest, sourceUrl } from "../lib/edition";
import { getAt, setAt } from "../lib/urlstate";
export function ResearchLibrary() {
  const m = useSurfaceState(editionManifest, []),
    [q, setQ] = useState(""),
    [scope, setScope] = useState("studies"),
    [selected, setSelected] = useState(getAt() ?? "README.md");
  useEffect(() => {
    const on = () => setSelected(getAt() ?? "README.md");
    window.addEventListener("reiyah:reading", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("reiyah:reading", on);
      window.removeEventListener("popstate", on);
    };
  }, []);
  const catalog = useMemo(() => {
    if (m.phase !== "ready") return [];
    const rows = new Map(m.data.catalog.map((r) => [r.path, r]));
    for (const f of m.data.files) rows.set(f.path, f);
    return [...rows.values()]
      .filter(
        (r) =>
          (scope === "all" ||
            (scope === "bound" &&
              m.data.files.find((f) => f.path === r.path)
                ?.continuation_bound) ||
            (scope === "studies" &&
              (r.path.endsWith("README.md") || r.path === "README.md"))) &&
          (
            r.path +
            " " +
            (m.data.files.find((f) => f.path === r.path)?.title ?? "")
          )
            .toLowerCase()
            .includes(q.toLowerCase()),
      )
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [m, q, scope]);
  if (m.phase === "loading")
    return <p role="status">Reading the research map…</p>;
  if (m.phase === "blocked") return <Blocked reason={m.reason} />;
  const local = m.data.files.some((f) => f.path === selected),
    exists = local || m.data.catalog.some((f) => f.path === selected);
  const choose = (p: string) => {
    setSelected(p);
    setAt(p);
  };
  return (
    <section
      className="research-station library-station"
      aria-label="Complete research library"
    >
      <EditionLabel />
      <header className="library-heading">
        <h1>The research, in full.</h1>
        <p>
          {m.data.files.length} local records ·{" "}
          {m.data.files.filter((f) => f.continuation_bound).length} continuation
          bindings · source links for the wider published archive.
        </p>
      </header>
      <div className="library-layout">
        <aside className="library-index">
          <label className="library-search">
            Find a study or record
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. reference, motion, corrections"
            />
          </label>
          <Segments
            label="Catalog coverage"
            value={scope}
            onChange={setScope}
            options={[
              { id: "studies", label: "Studies" },
              { id: "bound", label: "Current bindings" },
              { id: "all", label: "Archive" },
            ]}
          />
          <p className="eyebrow">{catalog.length} matching records</p>
          <nav aria-label="Research records">
            {catalog.map((r) => (
              <button
                key={r.path}
                onClick={() => choose(r.path)}
                aria-current={selected === r.path ? "page" : undefined}
              >
                <strong>
                  {m.data.files.find((f) => f.path === r.path)?.title ??
                    r.path.split("/").slice(-2).join(" / ")}
                </strong>
                <small>{r.path}</small>
                <span>
                  {r.coverage === "local_document"
                    ? "Read in this edition"
                    : "Source link"}
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <article
          className="library-document"
          aria-label="Selected research record"
        >
          <h2>{selected}</h2>
          {!exists ? (
            <p role="alert">
              This record is absent from this edition. Choose a record from the
              catalog.
            </p>
          ) : local ? (
            <DocumentReader key={selected} path={selected} />
          ) : (
            <>
              <p>
                This archive item is indexed here. Its bytes are available from
                the pinned engine commit on GitHub.
              </p>
              <a
                className="research-button"
                href={sourceUrl(selected)}
                target="_blank"
                rel="noreferrer"
              >
                Open the exact source ↗
              </a>
              <p className="research-limit">
                This Console does not locally verify records marked “Source
                link.”
              </p>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
