import type { ReactNode } from "react";
import { researchLink } from "../lib/edition";

/* Readable, text-only Markdown. No HTML execution or remote image requests.
   The complete original remains available through the source toggle/receipt. */
export function RecordText({ text, path }: { text: string; path: string }) {
  function href(raw: string): string | null {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
    if (raw.startsWith("#")) return null;
    try {
      const p = new URL(raw, `https://record.invalid/${path}`).pathname.slice(
        1,
      );
      return researchLink("research", decodeURIComponent(p));
    } catch {
      return null;
    }
  }
  function inline(line: string): ReactNode[] {
    const re = /(`[^`]+`|\*\*[^*]+\*\*|!?\[[^\]]+\]\([^\s)]+\))/g;
    return line
      .split(re)
      .filter(Boolean)
      .map((part, i) => {
        if (part.startsWith("`"))
          return <code key={i}>{part.slice(1, -1)}</code>;
        if (part.startsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        const m = part.match(/^(!?)\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) {
          const u = href(m[3]);
          return u ? (
            <a
              key={i}
              href={u}
              target={u.startsWith("http") ? "_blank" : undefined}
              rel={u.startsWith("http") ? "noreferrer" : undefined}
            >
              {m[1] ? "Image: " : ""}
              {m[2]}
            </a>
          ) : (
            <span key={i}>{m[2]}</span>
          );
        }
        return part;
      });
  }
  const lines = text.split("\n"),
    nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i],
      key = i;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3),
        body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```"))
        body.push(lines[i++]);
      i++;
      nodes.push(
        <details key={key} className="record-code-block">
          <summary>
            {language === "mermaid"
              ? "Diagram source"
              : language
                ? `${language} source`
                : "Source excerpt"}
          </summary>
          <pre>{body.join("\n")}</pre>
        </details>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length < 3 ? "h3" : "h4";
      nodes.push(<Tag key={key}>{inline(heading[2])}</Tag>);
      i++;
      continue;
    }
    if (/^\|/.test(line) && /^\|?[\s:|-]+$/.test(lines[i + 1] ?? "")) {
      const rows: string[][] = [];
      rows.push(line.replace(/^\||\|$/g, "").split("|"));
      i += 2;
      while (i < lines.length && /^\|/.test(lines[i]))
        rows.push(lines[i++].replace(/^\||\|$/g, "").split("|"));
      nodes.push(
        <div className="record-table" key={key} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {rows[0].map((c, j) => (
                  <th key={j}>{inline(c.trim())}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, j) => (
                <tr key={j}>
                  {row.map((c, k) => (
                    <td key={k}>{inline(c.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*[-*]\s/, ""));
      nodes.push(
        <ul key={key}>
          {items.map((v, j) => (
            <li key={j}>{inline(v)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key} />);
      i++;
      continue;
    }
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#|```|\||\s*[-*]\s)/.test(lines[i])
    )
      paragraph.push(lines[i++]);
    nodes.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="record-typeset">{nodes}</div>;
}
