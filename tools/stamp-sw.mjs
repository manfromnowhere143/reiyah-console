import fs from "node:fs";
import {createHash} from "node:crypto";
const h=createHash("sha256");
for(const f of ["dist/index.html", "dist/snapshot/manifest.json"])h.update(fs.readFileSync(f));
const stamp=h.digest("hex").slice(0,16);
const p="dist/sw.js";fs.writeFileSync(p,fs.readFileSync(p,"utf8").replaceAll("__BUILD__",stamp));
console.log(`[sw] stamped ${stamp}`);
