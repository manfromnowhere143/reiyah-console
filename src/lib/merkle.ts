/* Merkle integrity — the sealed set's digests folded into a single root, and
   an inclusion proof for any one surface, recomputed in the browser with
   WebCrypto. This turns "this file matches its digest" into "this file is
   provably part of the sealed whole whose root is R" — an RFC 6962-style
   audit path, verifiable offline, in front of a skeptic. Nothing is asserted
   the browser did not just recompute. */

export interface Leaf { id: string; sha256: string }

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^sha256:/, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}
async function hashPair(a: Uint8Array, b: Uint8Array): Promise<Uint8Array> {
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0); c.set(b, a.length);
  return sha256Bytes(c);
}

export interface MerkleTree {
  rootHex: string;
  layers: Uint8Array[][];
  leafIndex: Map<string, number>;
  leafCount: number;
}

/** Build a Merkle tree over the sealed surfaces, ordered by id (deterministic).
    Odd nodes duplicate the last (standard). Leaves are the surfaces' own
    committed SHA-256 digests. */
export async function buildMerkle(leaves: Leaf[]): Promise<MerkleTree> {
  const sorted = [...leaves].filter((l) => l.sha256 && l.sha256.includes("sha256:")).sort((a, b) => a.id.localeCompare(b.id));
  const leafIndex = new Map(sorted.map((l, i) => [l.id, i]));
  let layer = sorted.map((l) => hexToBytes(l.sha256));
  const layers: Uint8Array[][] = [layer];
  while (layer.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(await hashPair(layer[i], layer[i + 1] ?? layer[i]));
    }
    layers.push(next);
    layer = next;
  }
  return { rootHex: layer.length ? bytesToHex(layer[0]) : "", layers, leafIndex, leafCount: sorted.length };
}

export interface ProofStep { siblingHex: string; side: "L" | "R" }

/** The audit path: sibling hashes from a leaf up to the root. */
export function inclusionPath(tree: MerkleTree, id: string): ProofStep[] | null {
  let idx = tree.leafIndex.get(id);
  if (idx === undefined) return null;
  const steps: ProofStep[] = [];
  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const nodes = tree.layers[layer];
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : Math.min(idx + 1, nodes.length - 1);
    steps.push({ siblingHex: bytesToHex(nodes[sibIdx]), side: isRight ? "L" : "R" });
    idx = Math.floor(idx / 2);
  }
  return steps;
}

/** Fold a leaf digest with its audit path and compare to the root — the
    verification a skeptic can watch happen. */
export async function verifyInclusion(leafHex: string, steps: ProofStep[], rootHex: string): Promise<boolean> {
  let acc = hexToBytes(leafHex);
  for (const s of steps) {
    const sib = hexToBytes(s.siblingHex);
    acc = s.side === "L" ? await hashPair(sib, acc) : await hashPair(acc, sib);
  }
  return bytesToHex(acc) === rootHex.replace(/^sha256:/, "");
}
