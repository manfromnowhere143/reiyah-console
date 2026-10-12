import binding from "./edition-binding.json";
import { sha256Hex, retainVerifiedRaw, type RawResult } from "./evidence";
export const EDITION = binding;
export interface EditionFile {
  path: string;
  bytes: number;
  sha256: string;
  title?: string;
  coverage: string;
  continuation_bound: boolean;
}
export interface EditionManifest {
  commit: string;
  as_of: string;
  files: EditionFile[];
  catalog: { path: string; coverage: string }[];
}
let manifest: Promise<EditionManifest> | undefined;
const records = new Map<string, Promise<RawResult>>();
export function editionManifest(): Promise<EditionManifest> {
  return (manifest ??= (async () => {
    const r = await fetch(`/editions/${EDITION.commit}/manifest.json`);
    if (!r.ok) throw Error(`edition_manifest_http_${r.status}`);
    const b = await r.arrayBuffer();
    if ((await sha256Hex(b)) !== EDITION.sha256)
      throw Error("edition_manifest_digest_mismatch");
    const m = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b));
    if (
      m.commit !== EDITION.commit ||
      !Array.isArray(m.files) ||
      !Array.isArray(m.catalog)
    )
      throw Error("edition_manifest_invalid");
    const requested = new URLSearchParams(location.search).get("edition");
    if (requested && requested !== EDITION.commit)
      throw Error(
        "requested_edition_not_loaded: this link names a different research edition",
      );
    return m;
  })().catch((e) => {
    manifest = undefined;
    throw e;
  }));
}
export async function editionRaw(path: string): Promise<RawResult> {
  if (records.has(path)) return records.get(path)!;
  const job = (async () => {
    const m = await editionManifest(),
      f = m.files.find((f) => f.path === path);
    if (!f) throw Error(`edition_record_absent:${path}`);
    const r = await fetch(
      `/editions/${EDITION.commit}/raw/${f.sha256.slice(7)}`,
    );
    if (!r.ok) throw Error(`edition_record_http_${r.status}`);
    const b = await r.arrayBuffer();
    if (b.byteLength !== f.bytes || (await sha256Hex(b)) !== f.sha256)
      throw Error(`edition_record_digest_mismatch:${path}`);
    const raw = {
      bytes: b,
      path,
      serverSha256: f.sha256,
      byteLength: b.byteLength,
    };
    retainVerifiedRaw(`edition/${path}`, raw);
    return raw;
  })();
  records.set(path, job);
  job.catch(() => records.delete(path));
  return job;
}
export async function editionText(path: string) {
  const r = await editionRaw(path);
  return {
    text: new TextDecoder("utf-8", { fatal: true }).decode(r.bytes),
    file: { path, sha256: r.serverSha256, bytes: r.byteLength },
  };
}
export async function editionJson<T = any>(
  path: string,
): Promise<{ data: T; file: { path: string; sha256: string; bytes: number } }> {
  const r = await editionText(path);
  return { data: JSON.parse(r.text), file: r.file };
}
export const sourceUrl = (p: string) =>
  `https://github.com/manfromnowhere143/reiyah/blob/${EDITION.commit}/${p.split("/").map(encodeURIComponent).join("/")}`;
export function researchLink(station: string, selection?: string) {
  const u = new URL(location.href);
  u.search = "";
  u.searchParams.set("st", station);
  if (selection) u.searchParams.set("at", selection);
  u.searchParams.set("edition", EDITION.commit);
  return u.pathname + u.search;
}
export function rational(s: string | number): number {
  if (typeof s === "number" && Number.isFinite(s)) return s;
  if (typeof s !== "string" || !/^-?\d+(?:\/\d+)?$/.test(s))
    throw Error("invalid_exact_number");
  const [a, b = "1"] = s.split("/");
  const n = Number(a) / Number(b);
  if (!Number.isFinite(n)) throw Error("invalid_exact_number");
  return n;
}
