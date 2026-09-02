import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./instrument.css";

/* The module executed — the bundle is healthy, so the boot watchdog's
   recovery guard is cleared. A later genuine failure can then self-heal
   again rather than being locked out by a one-shot flag. */
try { sessionStorage.removeItem("harbor-recovering"); } catch { /* private mode */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => reg.update().catch(() => {}))
    .catch(() => {
      /* offline support is an enhancement; its absence is not a failure */
    });
  /* No forced reload on controllerchange. A fresh worker claiming the page
     (first visit, or the first load after a deploy) would otherwise reload the
     page and read as a double-load flash. Freshness does not need it: every
     navigation is network-first, so the newest HTML and assets arrive on the
     next load anyway, and the boot watchdog recovers any stale-cache case. */
}
