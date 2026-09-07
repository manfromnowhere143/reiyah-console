# Harbor Instrument: Architecture

One page. One camera. Nothing on screen without its evidence digest.

This document is the engineering contract for the Reiyah control panel. It is
written so a reviewer can verify every claim against the code in one sitting.

## 1. System shape

```
Reiyah repository (read-only ground truth)
        │
        ├── LIVE:   server/evidence-server.mjs  ── HTTP + SSE ──┐
        │           (stdlib Node, fail-closed, digests at read)  │
        │                                                        ▼
        └── SEALED: tools/seal-snapshot.mjs ──► public/snapshot/ ──► the same client
                    (exact bytes + manifest at one commit)

Client (Vite + React 19 + TS strict)
  src/lib/evidence.ts   one client, two honest sources, no third option
  src/boot/ProofBoot    WebCrypto verification before first render
  src/lib/camera.ts     station and rail definitions; URL = selected station
  src/components/StationFrame  prepare one destination; reveal its settled DOM
  src/components        EpistemicValue · Digest (press-to-prove) · TruthPill · Station
  src/stations          eighteen instruments in three rails, each bound to committed JSON
  src/lib/prefetch.ts   what each station reads; neighbours warmed in idle time
  tools/lane-files.mjs  the Gate B lane read from one exact Git ref, shared by sealer and server
```

Two deployment modes, both truthful about what they are:

| Mode | Data path | Pill | Where it runs |
|---|---|---|---|
| LIVE | `/api/*` + SSE from the evidence server | `LIVE / STALE / OFFLINE` | any machine with a Reiyah checkout |
| SEALED | `/snapshot/*` static bundle | `SEALED · <commit> · <date>` | any static host (reiyah.danielwahnich.dev) |

The client tries live, falls back to sealed, and otherwise renders a blocked
state. Modes are displayed, never blended.

## 2. Honesty invariants (enforced in code, not prose)

1. **Verify-then-render.** The Proof Boot fetches the evidence index bytes,
   recomputes SHA-256 with `crypto.subtle.digest`, and requires equality with
   the committed sidecar before the stage mounts. Mismatch renders `Blocked`.
   There is no demo mode and no mock data anywhere in the tree.
2. **Nothing is a scalar.** Values arrive as epistemic envelopes
   (`{state, value}` / `{state, reason}`); the `Ev` component renders all six
   states distinctly and never coerces a non-observed state to a value.
3. **State truth snaps, never tweens.** Control results, authority flags, and
   digests change instantly; only continuous physical quantities interpolate.
4. **Press to prove.** Every digest chip refetches its exact bytes and
   recomputes the digest in the browser on demand, in both modes.
5. **Liveness is earned.** The pill derives from event age, not request
   success; a sealed bundle says SEALED with its commit and seal time on its
   face; the seal records `worktree_clean=false` when that is the truth.
6. **Fail closed.** Server errors emit `{state:"blocked", reason}`; the
   client renders `Blocked` panels; the service worker fabricates nothing
   (offline + uncached returns an explicit 503 blocked body).
7. **Non-claims in chrome.** Every station footer states: renders committed
   machine records only · not a driver-monitoring system · creates no
   acceptance, evidence, or authority. The console holds no authority over
   Reiyah; it lives outside the Gate A candidate projection because Reiyah's
   own denylist forbids runtime inside the repository.

## 3. Motion and performance law

- Compositor-only animation: `transform` and `opacity`. Blur radii are
  constants; blur is never animated.
- Navigation: one current page plus at most one hidden, inert destination.
  Code, readers, measured chart sizes and first drawings settle before reveal.
  Menus close in the destination's commit. Direct dock/history changes may use
  a single 180ms panel crossfade. Reduced motion skips that animation.
- Dock geometry is invariant during a request. Pending indicators are absolute;
  they cannot wrap station names or resize the page. They appear only after 200ms
  on a first visit; return visits do not show them. Only the rail scrolls.
- Opening: one shared first-paint stylesheet, one centered mark and name. Only
  REIYAH is visible as text during normal preparation; progress is available to
  assistive technology. One light pass retains its position across React arrival.
  After digest
  verification the first station mounts beneath the opening, inert. Its readers
  and first drawing report readiness before a single 360ms departure. There is
  no completed-state pause or separate stage fade. Reduced motion reveals directly.
- Unavailable surfaces preserve the actual source failure and provide expandable
  details with a retry through the complete verification gate. Required Reference
  records fail explicitly rather than entering the ready-data cache as null.
- The field index has eighteen destinations grouped by their three declared rails.
  Its centered, two-column dialog is at most 620px wide. At the supported phone
  heights each target is at least 44px tall, without index scrolling. Smaller
  windows may scroll the index to retain reachable controls.
- Glass ladder: rung 1 `feDisplacementMap` lens behind
  `@supports (backdrop-filter: url(#harborLens))` (Chromium); rung 2
  `blur(20px) saturate(1.18)`; rung 3 opaque under
  `prefers-reduced-transparency` and `prefers-contrast: more`.
- Budgets: main bundle ≤ 100 KB gz (approximately 93 KB gz as of 2026-09-07; the Harbor and its worker ship
  first, every other station is its own chunk of 2 to 7 KB gz, fetched when
  pressed or a moment earlier by the neighbour prefetch), ≤ 3 concurrent glass
  surfaces, one canvas, zero third-party runtime deps beyond React.
- Existing typefaces are served from `/fonts/` with content hashes, original
  OFL licenses and source records. No external stylesheet or font host is needed
  during startup. The boot reads the current index and report; the stage warms
  station data after mounting. Transfer size depends on the committed snapshot.

The readiness design follows React's [layout effect contract](https://react.dev/reference/react/useLayoutEffect)
and the browser's [snapshot and size transition model](https://developer.chrome.com/docs/web-platform/view-transitions/same-document).
Passing browser tests establishes observed UI behavior, not scientific validation.

## 4. Data surfaces

27 whitelisted surfaces (evidence index + sidecar, canonical validation
reports, recovery chain, protocol, mission, fixture catalog, frontier
register, decision template, decision interface, six object-chain records).
The whitelist is the only path resolution; there is no generic file endpoint.

## 5. Verification rigs

| Rig | Proves |
|---|---|
| `npm run build` | TS strict + bundle budgets |
| `tools/shots.mjs [out] [--mobile]` | every station renders, desktop and mobile |
| `tools/hangar-test.mjs` | offline: SW shell + cached evidence + honest OFFLINE pill |
| `tools/sealed-test.mjs` | static-only deploy boots, verifies, and reports SEALED |

## 6. Deploy

```sh
npm run seal && npm run build   # dist/ is the complete static artifact
# upload dist/ to reiyah.danielwahnich.dev — no server required
# or run `npm run serve` next to a Reiyah checkout for the live cockpit
```

Re-seal whenever a new Reiyah release should become the public snapshot; the
seal is one command and the manifest carries its own commit identity.
