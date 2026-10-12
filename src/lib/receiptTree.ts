/* A visual receipt uses the exact manifest for the selected record. A local
   Merkle root is an explanatory computation, never an independent trust anchor. */
import { getMerkle } from "./evidence";
import {
  buildMerkle,
  inclusionPath,
  verifyInclusion,
  type MerkleTree,
} from "./merkle";

export interface ReceiptTree {
  tree: MerkleTree;
  verified: boolean;
  scope: string;
  binding: string;
}
let editionTree: Promise<MerkleTree> | undefined;
let exampleTree: Promise<MerkleTree> | undefined;
export async function receiptTree(
  id: string,
  digest: string,
): Promise<ReceiptTree | null> {
  let tree: MerkleTree | null;
  let scope: string;
  let binding: string;
  if (id.startsWith("edition/")) {
    const { editionManifest, EDITION } = await import("./edition");
    editionTree ??= editionManifest()
      .then((m) =>
        buildMerkle(
          m.files.map((f) => ({ id: `edition/${f.path}`, sha256: f.sha256 })),
        ),
      )
      .catch((e) => {
        editionTree = undefined;
        throw e;
      });
    tree = await editionTree;
    scope = "Research edition records";
    binding = `Engine ${EDITION.commit.slice(0, 12)} · build-bound manifest`;
  } else if (id.startsWith("example/")) {
    const { default: b } = await import("./example-binding.json");
    exampleTree ??= buildMerkle(
      b.files.map((f) => ({ id: `example/${f.name}`, sha256: f.sha256 })),
    );
    tree = await exampleTree;
    scope = "Synthetic replay records";
    binding = "Build-bound replay manifest · hypothetical observations";
  } else {
    tree = await getMerkle();
    scope = "Historical snapshot surfaces";
    binding =
      "Historical source generation · separate from the research edition";
  }
  if (!tree) return null;
  const path = inclusionPath(tree, id);
  if (!path) return null;
  return {
    tree,
    scope,
    binding,
    verified: await verifyInclusion(digest, path, tree.rootHex),
  };
}
