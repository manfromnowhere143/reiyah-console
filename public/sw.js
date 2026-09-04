/* Harbor Instrument service worker — v__BUILD__
   Strategy (the honest PWA pattern):
   - navigations: NETWORK-FIRST, cache fallback — a new deploy is visible on
     the very next load; offline still boots the last verified shell.
   - hashed /assets/: cache-first (immutable by name).
   - /api: network-first with cached fallback carrying its stored digests;
     nothing is ever fabricated (offline+uncached => explicit blocked body).
   - activate: old caches purged. The new worker does NOT skipWaiting or
     claim: seizing a page mid-boot aborts its in-flight fetches on WebKit,
     and navigations are network-first anyway, so the next load is fresh
     without a takeover. The __BUILD__ stamp changes every build. */
const BUILD = "__BUILD__";
const SHELL = `harbor-shell-${BUILD}`;
const ASSETS = "harbor-assets-v1"; // hashed filenames: safe forever
const EVIDENCE = "harbor-evidence-v1";
const KEEP = new Set([SHELL, ASSETS, EVIDENCE]);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/events")) return; // SSE never cached

  /* evidence: network-first, honest cached fallback */
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(EVIDENCE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req);
          if (hit) return hit;
          return new Response(
            JSON.stringify({ state: "blocked", reason: "offline_and_uncached" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }

  /* hashed assets: cache-first, immutable */
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  /* navigations + everything else: network-first so deploys land instantly */
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          const home = await caches.match("/");
          if (home) return home;
        }
        return Response.error();
      })
  );
});
