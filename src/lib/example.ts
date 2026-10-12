import binding from "./example-binding.json";
import { sha256Hex, retainVerifiedRaw } from "./evidence";
export async function exampleRaw(name: string) {
  const f = binding.files.find((f) => f.name === name);
  if (!f) throw Error("unknown_example_record");
  const r = await fetch(`${binding.base}/${name}`);
  if (!r.ok) throw Error(`example_http_${r.status}`);
  const bytes = await r.arrayBuffer();
  if (bytes.byteLength !== f.bytes || (await sha256Hex(bytes)) !== f.sha256)
    throw Error("example_digest_mismatch");
  const raw = {
    bytes,
    path: `synthetic replay/${name}`,
    serverSha256: f.sha256,
    byteLength: bytes.byteLength,
  };
  retainVerifiedRaw(`example/${name}`, raw);
  return raw;
}
export async function exampleJson(name: string) {
  const raw = await exampleRaw(name);
  return {
    data: JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(raw.bytes),
    ),
    sha: raw.serverSha256,
  };
}
