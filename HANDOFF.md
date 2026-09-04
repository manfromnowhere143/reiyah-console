# Reiyah Console — Session Handoff

Living handoff for the next session. This repo is **reiyah-console** (the Harbor
Instrument UI), separate from the Reiyah **engine** repo (`~/workspace/reiyah`,
which has the Gate-A baton/denylist — none of that applies here; normal git).

## The mission and the bar
Build the most state-of-the-art 2026 UI/UX for Reiyah: **SpaceX / Tesla /
Mobileye / HBO / Steve-Jobs level, edge of elegance, honest to the byte.** The
user reviews on an **iPhone (iOS Safari)** — **mobile must be perfect** (no
overflow, correct height, no scroll). "Every detail matters." Push each surface
to the absolute top level; analyse → plan → implement; do not assume — **measure**.

### The standing UX doctrine (how every page must be)
- **One page, one screen, dynamic, no scrolling.** Each station fits the
  viewport and reads at a glance. Enforced by measurement, not hope: lists use
  `FitList` (renders exactly the rows that fit, says what it withheld), the
  Adversaries wall sizes its cells to the screen, stat strips collapse to three
  columns on phones.
- **Floating surfaces** — no hard borders/boxes; content floats on the ground
  (soft fills + inset sheen + shadow). No page titles (identity is on the dock
  tab). No decorative red — red only signals genuine alarm / digest-mismatch /
  blocked / rejected / the joint-silent-miss concept mark.
- **Forge navigation** — pressing a dock station morphs (shared-element expand,
  View Transitions API) from that tab into the panel; see `go()` in `App.tsx`.
- **Honesty is the luxury** — renders only digest-verified committed machine
  records; the six epistemic states never collapse to zero/false; no fabricated
  metrics; retained history is shown but never counted as current replay
  evidence; "SYNTHETIC / NOT A DEPLOYED SYSTEM / NO PERFORMANCE CLAIM" where a
  claim could be implied. Not a driver-monitoring system.

### Design system ("Liquid Obsidian", tokens in `src/instrument.css`)
Two grounds: paper `#f4f3ee` (default) / obsidian `#050507` (toggle top-left).
One red accent (`#E31937` dark / `#D61732` light). Fonts: **Big Shoulders**
(display), **Instrument Sans** (body), **B612 Mono** (data). Operator's law: on
obsidian all text is white and visible — hierarchy via size/weight, never by
dimming ink. Dashed = missing (the EpistemicValue mark; the Chair's empty form
uses it). Repository text contains no em dash.

## Deploy / ops
- Deploy: `npm run build` then `vercel --prod --yes` (project "reiyah", team
  daniels-projects-…), then **`git push origin main`**. Live at
  **reiyah.danielwahnich.dev** (sealed-snapshot mode; `public/snapshot` is
  committed; `tools/watch-and-publish.mjs` reseals only clean engine commits).
- GitHub: `github.com/manfromnowhere143/reiyah-console` — push after every commit.
- Verify workflow: headless `puppeteer-core` against the dev server (`npx vite`
  on :4610; evidence server `npm run serve` on :4600). Always check **desktop
  1280×820, phone 430×745 and phone 390×660** (Safari's visible area with its
  chrome; never 430×932, the phone never shows that height in Safari), both
  grounds: screenshot + measure `.stbody` scrollHeight vs clientHeight.
  Capture → view → iterate. The rig lived in the session scratchpad (`ov.mjs`:
  all stations × three viewports, `--dark`; `enc.mjs`: the Encounter at
  chosen clock moments).
- Shell note: never use `wc` in this machine's shell (a profile hook hijacks
  it); use `awk 'END{print NR}'`.
- Disk can fill up: clean `dist/`, scratch shots, `npm cache clean --force`.

## Shipped 2026-09-04 (second pass), all live
- **Measured at real Safari heights.** The phone rig now runs 430x745 and
  390x660 (Safari's visible area with its chrome), not 430x932. All ten
  stations fit on desktop 1280x820 and both phone views, both grounds (60/60).
  Compact rules live under `@media (max-width: 760px) and (max-height: 800px)`.
- **iOS off-top bug, third measure:** no `position: fixed` anywhere in the
  document. `html`/`body` are static, the body is exactly `--app-h` tall, all
  roots are absolute inside it, the prove overlay renders through a portal to
  the body. `?diag=1` still records the viewport timeline. Root cause still
  NOT confirmed from the device; the clue that a touch settles it, and that
  LinkedIn's in-app browser is fine, points at Safari's tab-open animation
  placing fixed layers against a stale viewport.
- **Controls = THE TWIN SEAM.** Every control a column, height = log
  observations, mirrored above and below the seam where the two isolated
  evaluations met; seam reads BYTE-IDENTICAL, bytes, payload digest, with a
  running light; hover/touch reads control id, state, observations, digest.
- **Estimands = the dial bank.** Ten dark dials (dashed arc = missing, no
  needle), symbol on the face, direction glyph, sized to the screen by
  measurement; touch reads unit of analysis, uncertainty method, lifecycle.
- **Adversaries:** the wall has named family bands with reject/pass counts;
  the cell-size fit accounts for the bands.
- **Chair = the decision chamber.** Stat strip, correction rail, the seat drawn
  (glyph, kicker "no tool may sit here", one line), a stage-rail stepper, the
  empty form as dashed chips. The boxed seat is gone.
- **Encounter graphics pass:** horizon wash, flowing ground grid, wire cuboid
  object toward the vanishing point, gradient sightlines with scan beams,
  captions cut to one line.
- **HUD:** the mark first, then REIYAH, then a 22px liquid-glass ground toggle
  in flow (no longer a separate corner control); during boot the toggle sits
  at top-left as before.

## Shipped 2026-09-04 (third pass), all live
- **Ledger = THE BYTE SKYLINE.** All 934 artifacts on one canvas line, sorted
  by role then size, height = log bytes, role bands shaded and named where
  wide enough; a sweeping cursor reads path, role, bytes, digest; hover/touch
  takes it. Stacked byte bar and ranked roles list kept.
- **Lineage = THE CUSTODY GRAPH.** One spine, a node per canonical validation,
  and under each node its RECOVERY record (method + custody continuity; the
  1.0.0 break drawn as a broken spine and a hollow red dot). The three
  decision-interface contract reports sit on a lower rail as a different kind.
- **Frontier = THE HORIZON.** 54 pointers as hollow rings standing on the
  horizon line in their source-kind column; filled would mean evidence-eligible
  (0); ring size measured to the screen; cursor reads title, publisher, date,
  kind, custody, eligibility. Claims-admitted stat from the register itself.
- **The Seeing:** cards float (no hard borders), rays are measured from the
  iris centre to each card (dashed to the dark sector), phones stack evenly.
- Lesson recorded: a hook after an early return blanked the page; hooks stay
  above every return.

## Shipped 2026-09-04 (fourth pass), all live
- **Dock missing on first load (reported):** the app height was sampled at
  fixed moments (events + timeouts ending at 2.5 s); iOS does not always fire
  resize when its toolbars appear during a tab-open, so a late toolbar left the
  app taller than the screen and the dock below the fold until a touch. Now
  `--app-h` tracks the visual viewport continuously: every frame for 12 s,
  then twice a second, writing only on change, and always the smaller of
  visualViewport.height and innerHeight. `.glass` surfaces get their own
  compositor layer (iOS can leave backdrop-filtered elements unpainted until
  interaction). `?diag=1` now prints the dock's top/bottom and whether it is
  on screen.
- **Estimands tap disruption:** click toggled the dial off after pointer-enter
  had selected it, and a growing caption re-flowed the bank and resized every
  dial. Click now only selects; the caption reserves a fixed height. Verified:
  dial sizes identical before and after a tap.

## Shipped 2026-09-04 (fifth pass): the boot contract
- **"Blocked · could not be verified" on the phone (reported, not reproduced
  on Chrome with a persisted SW nor on macOS Safari):** every boot failure was
  terminal, including a fetch that merely failed or was aborted, and the
  service worker seized live pages mid-boot (skipWaiting + claim) after each
  deploy, which WebKit answers by aborting in-flight fetches. Now: transport
  failures retry up to 3x with backoff and `cache: "reload"` on every fetch;
  a digest mismatch retries once through the network then blocks hard; the
  blocked screen states the reason and offers RETRY; the worker no longer
  skipWaiting/claims. Verified by request interception: transient abort,
  two 503s, tampered bytes, healthy.
- macOS Safari `?diag=1` proved the continuous viewport tracking: the height
  changed 888 → 808 as Safari's banner appeared and `--app-h` followed.

## Shipped 2026-09-04 (sixth pass)
- Ledger skyline precision: labelled log gridlines (1 KB / 10 KB / 100 KB /
  1 MB), the rejected band tinted, the exact byte reading on a plate beside
  the cursor.
- Controls: the twin has a fixed footprint; the capability list is a FitList
  (no overlap on the smallest phone). FitList now counts the grid row gap.

## Shipped 2026-09-04 (seventh pass): the torn transition, warmed stations, CDN
- **Torn mid-transition on iPhone (from a screen recording):** the "forge"
  shared-element morph named the pressed dock tab and the new panel; WebKit
  snapshots only composited parts of a named element, so mid-morph the new
  station showed as a floating canvas + chip with the rest missing, and the
  tab vanished from the dock. The forge is removed; the stage-panel crossfade
  (compositor-only) remains. Never name dock tabs or station content for
  view transitions again.
- **Loading flash ("reading custody chain…" on an empty page):** sealed bytes
  are memoized (content-addressed, immutable within a snapshot) and every
  surface + decision record is warmed in idle time after boot
  (`warmSealedSurfaces`); stations then render with zero requests. A retry
  with cache bypass ignores the memo. Live mode is never memoized.
- **Scale:** `vercel.json` cache headers: hashed assets immutable, snapshot
  5 min edge + SWR, sw.js no-cache.
- Also: `.mandala` phones use `space-evenly`; The Seeing rays.

## Shipped 2026-09-03 (first pass)
One-screen everywhere with `FitList`; Ledger, Lineage, Chair one-page;
Adversaries = THE WALL; Encounter v3 at the fixture's own clock; Harbor shape =
role, ground depth, the gate fires; body-lock and single-fixed-layer iOS steps
(now superseded by the static document).

## NEXT STEPS (in order)
1. Read the user's `?diag=1` screenshot (opened from WhatsApp); confirm the
   static document fixed the off-top open, or act on the readout.
2. Every station has now had a pass. Next candidates: Harbor HUD refinement,
   press-to-prove from any skyline/wall/horizon cursor (live mode only).
3. Keep every change measured: run the overflow rig on all 10 stations, three
   viewports, both grounds, before committing.
4. Candidates from the research verdict: ⌘K palette, signed proof cards, honest
   sonification (off by default). Only if clearly brilliant and honest.

## Do NOT repeat
- The **Sora concept film was rejected** ("ridiculously bad"). The user wants a
  real product commercial, not artsy dramatization.
- Never import code/config/authority from a sibling repo (Odeya, Sentinel,
  Aweb, …). External models/MCP are adapters only.
- Never trust a prior handoff's "fits" claim; measure first (the previous
  handoff missed that Ledger and Lineage overflowed on both viewports).

## Key files
`src/App.tsx` (stage, dock, `go()` forge) · `src/instrument.css` (tokens,
`.onepage` scaffold, `.fitlist`, `.wall`, `.rail`) · `src/components/primitives.tsx`
(`FitList`, `Digest`, `Ev`, `TruthPill`) · `src/stations/*.tsx` ·
`src/stations/harborEngine.ts` + `harborGL.ts` + `harbor.worker.ts` (the sensed
world) · `src/boot/ProofBoot.tsx` · `index.html` (inline splash, `--app-h`,
document lock, `?diag=1`, boot watchdog).
