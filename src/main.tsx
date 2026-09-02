import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./instrument.css";

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
  /* when a new worker takes command, reload once so every deploy lands
     immediately on every device — no user ritual, ever */
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshed) return;
    refreshed = true;
    location.reload();
  });
}
