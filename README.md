# Reiyah Console: Harbor Instrument

The control panel of the Reiyah evidence engine. One page, one camera, no scrolling.
Black glass, bone ink, one red. Nothing renders without its evidence digest.

This project is deliberately separate from the Reiyah repository. Gate A's denylist
forbids network services and product runtime inside Reiyah; this console reads
Reiyah's committed bytes and holds no authority over them. It is not a
driver-monitoring system, creates no operator acceptance, and creates no
scientific evidence. A blocked result is preferable to a plausible default.

## Run

```sh
npm install
npm run build          # type-check + bundle to dist/
npm run serve          # evidence server on http://localhost:4600 (serves dist/ + API)
```

Development with hot reload (two terminals):

```sh
npm run serve          # evidence server on :4600
npm run dev            # vite on :4610, /api proxied to :4600
```

The evidence server reads `/Users/danielwahnich/workspace/reiyah` (override with
`REIYAH_ROOT`). It is read-only and fail-closed: every response carries the source
path and a SHA-256 recomputed at read time; on any error it emits an explicit
blocked state instead of a fabricated value.

## The honest pipeline

1. **Proof Boot**: the app fetches the evidence index bytes, recomputes their
   SHA-256 in the browser with WebCrypto, and requires equality with the committed
   sidecar before rendering anything. A mismatch renders a blocked screen. There is
   no demo mode.
2. **Press to prove**: every digest chip refetches its exact bytes and recomputes
   the digest in the browser on demand.
3. **Live**: SSE from the evidence server; the truth pill turns STALE on silence
   and OFFLINE on disconnect. Liveness is earned, never asserted.

## Stations

Harbor (epistemic field + authority wall) · Ledger · Lineage · Encounter ·
Controls · Estimands · Adversaries · The Chair · Frontier.

Navigation: choose a station from the dock or field index. The current page
stays in place until the destination is ready. Escape returns to Harbor; arrow
keys move between neighbors; the URL (`?st=...`) identifies the station.

## Verification rigs

For navigation regression, build and serve the existing snapshot locally:

```sh
npm run build
python3 -m http.server 4620 --bind 127.0.0.1 --directory dist
# In another terminal:
npm run test:navigation
npm run test:opening
```

This checks all eighteen stations through the field index, both grounds and three
viewport sizes, plus slow/failed loads, interrupted selections, history, keyboard
focus and motion fallbacks. It requires installed Chrome. `NAV_BASE` changes the
test URL and `NAV_OUT` the capture directory. `NAV_WEBKIT` optionally names an
installed Playwright `index.mjs` to run the same checks in its WebKit browser.
The opening rig checks identical geometry before and after React loads, first
drawing readiness, verification failures and retries, font failure, reduced motion,
and all eighteen index targets at a minimum 44px height. `BOOT_OUT` selects its
capture directory. No evidence sealer or engine service is used by these tests.

```sh
node tools/shots.mjs out/ [--mobile]   # capture boot + all nine stations
node tools/hangar-test.mjs             # offline proof: SW shell + cached evidence + honest OFFLINE pill
```

The hangar test passes when, with the network cut, the instrument reboots from
its service worker, re-verifies the cached evidence bytes, and the truth pill
reads "OFFLINE · rendering last verified snapshot". No fabricated state exists:
with nothing cached, the boot blocks instead.

## Sealed snapshot mode (static deploy)

```sh
npm run seal && npm run build
```

`npm run seal` copies the exact evidence bytes into `public/snapshot/` with a
manifest recording the commit identity and per-file digests at seal time.
`dist/` then works on any static host with no server: the client falls back
from `/api` to `/snapshot`, the WebCrypto boot verification runs unchanged on
the sealed bytes, and the truth pill reads `SEALED · <commit> · <date>` —
never pretending to be live. Verified by `tools/sealed-test.mjs`.

## Deployment target

Home: `reiyah.danielwahnich.dev` (following the danielwahnich.dev convention;
the sealed `dist/` can also be mounted into the portfolio repo like the other
system consoles). The live cockpit (`npm run serve`) needs read access to a
Reiyah checkout. See `ARCHITECTURE.md` for the full engineering contract.
