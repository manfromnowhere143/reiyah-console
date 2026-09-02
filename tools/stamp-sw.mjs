/* Stamp the built service worker with a unique build id so browsers always
   detect an update. Runs as the final step of `npm run build`. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const p = new URL("../dist/sw.js", import.meta.url).pathname;
let head = "nogit";
try { head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
const stamp = `${head}-${Date.now().toString(36)}`;
fs.writeFileSync(p, fs.readFileSync(p, "utf8").replaceAll("__BUILD__", stamp));
console.log(`[sw] stamped ${stamp}`);
