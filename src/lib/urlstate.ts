/* URL as state. The station is `st`; the reading under the cursor or the
   selection is `at`. A shared link reproduces the exact reading. Only a
   person's own gesture writes `at` (never the idle cursor walk), with
   replaceState, so history stays one entry per station. */
export function getAt(): string | null {
  return new URLSearchParams(location.search).get("at");
}
export function setAt(value: string | null) {
  const u = new URL(location.href);
  if (value === null || value === "") u.searchParams.delete("at"); else u.searchParams.set("at", value);
  const next = u.pathname + (u.search ? u.search : "");
  if (next !== location.pathname + location.search) history.replaceState(history.state, "", next);
}
