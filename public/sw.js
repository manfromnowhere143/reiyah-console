/* Harbor Instrument service worker.
   Shell: cache-first. Evidence (/api): network-first with honest fallback —
   a cached surface is served only with its stored digest so the client can
   still verify; when nothing is cached the client renders a blocked state.
   The worker never fabricates a response body. */
const SHELL = "harbor-shell-v2";
const EVIDENCE = "harbor-evidence-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/events")) return; // SSE is never cached
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(EVIDENCE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(e.request);
          if (hit) return hit;
          return new Response(
            JSON.stringify({ state: "blocked", reason: "offline_and_uncached" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(e.request, copy));
          return res;
        })
    )
  );
});
