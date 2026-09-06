import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/* the build id is the digest of the source, so the same source builds to
   the same id on any machine: local and remote builds of one commit agree,
   and the id changes whenever the code does */
function sourceId(): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) walk(q); else { h.update(q); h.update(fs.readFileSync(q)); }
    }
  };
  walk("src"); h.update(fs.readFileSync("index.html")); h.update(fs.readFileSync("package-lock.json"));
  return h.digest("hex").slice(0, 10);
}

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(sourceId()) },
  plugins: [react()],
  server: {
    port: 4610,
    proxy: {
      "/api": { target: "http://localhost:4600", changeOrigin: false },
    },
  },
  build: { target: "es2022", sourcemap: false },
});
