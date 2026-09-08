# Reiyah Console — Session Handoff

Living handoff for the next session. This repo is **reiyah-console** (the Harbor
Instrument UI), separate from the Reiyah **engine** repo (`~/workspace/reiyah`,
which has the Gate-A baton/denylist — none of that applies here; normal git).

## Repository routing and commit attribution, 2026-09-08

Daniel explicitly authorizes Console work from the existing session rooted at
`/Users/danielwahnich/workspace/reiyah`. Use this Console repository's explicit
working directory, Git root, remote and instructions. Do not demand a relaunch
or repeated permission merely because of the session's startup path. This is a
specific operator exception to the global directory gate; engine instructions
continue to apply to engine work. Read `AGENTS.md` for the retained rule.

Rule number one: Console commits must not credit Claude/Anthropic as author,
committer, contributor or co-author, or append generated-by/session notices.
Claude's project attribution is disabled in `.claude/settings.json`. The installed
`.githooks/commit-msg` rejects prohibited credits and identities; its ten checks
accept ordinary/human credits and reject model credits, session trailers and
model author/committer identities. Global Codex and Claude instructions and the
Reiyah session memories retain the same routing and attribution requirements.

The operator authorized an entire-history cleanup. The 114 original commits all
already named Daniel as author and committer. A verified isolated rewrite removes
105 co-author credits and 105 session trailers. Every original file tree, author,
committer, timestamp and mapped parent relationship is identical. Substantive
commit text is preserved. There is one published branch (`main`) and no tags or
pull-request refs. No application, engine or snapshot bytes change in this task.

The original history, full local Git metadata, changed instruction-file backups,
old/new commit mapping and verification records are retained outside the repo in
`~/.codex/backups/reiyah-console-authorship-20260908-74piy0ej/`.
The original tip `4a9cf9c81a5115054df7bb7d1c4ab51fef14e06a` maps to
`e3153cc0586cf26f78cc4fce33d006c29523d9ec`; the instruction/guard commit follows it.
Earlier deployment records below retain their historical, pre-rewrite commit IDs.
The deployed application bytes remain identical; these documentation/settings
changes do not require resealing evidence or redeploying the UI.

## Index focus and navigation latency, 2026-09-07

The operator reported a blue border persisting on index names and requested an
investigation of whether the loading circle concealed an unnecessary delay.
Reproduction found a blue selected-row accent, a blue focus outline, and the
browser's touch highlight. More specifically, after a keyboard selection restores
focus to Index, clicking that already focused trigger can propagate
`:focus-visible` into the reopened dialog. The dialog now tracks pointer versus
keyboard interaction: pointer selection has no outline; keyboard focus uses
neutral ink. The selected row retains its quiet fill and CURRENT label. The blue
accent and native tap highlight are removed. Focus trapping, Enter and Escape
remain functional. This is a scoped dialog change, not global focus suppression.

There was also a real scheduling defect. `React.lazy` suspended on each station's
first mount even when intent prefetch had already imported its module. The fresh
hidden `Suspense` fallback invoked the installed React DOM 19.2.8 reveal throttle,
adding about 300ms before the station DOM mounted. That delay triggered the
200ms loading-feedback timer. Import prefetch and rendering now share the resolved
component directly, and code loading reports to the existing `StationFrame`
readiness gate. The redundant Suspense boundary is removed. Pending imports are
shared; canceled frames ignore late resolution; failures retain the explicit
station-unavailable state. No runtime dependency or eager all-station mount added.

The circle itself never gates navigation and has no minimum display time. It
remains feedback only for a first visit still pending after 200ms; return visits
never show it. Actual code, readers, layout and first drawing must still settle.
The two frame layout check remains because cached modules/data do not preserve
the station's unmounted DOM or canvas. Only the current frame and one hidden,
inert destination are mounted. Index selection commits directly. Dock/history
retain their 180ms optional crossfade; its group now also lasts 180ms, removing
the browser's extra 70ms default duration. The opening's verification is separate
and does not rerun on station navigation.

Before/after profiling used installed Chrome 152.0.7977.76, the same committed
snapshot served locally, desktop 1280x820 and phone viewport 390x660. Timing starts
at the click event and ends at the ready-page DOM commit, not the end of animation.
Across twelve first selections, the old path took 332.3–346.4ms; the direct import
path took 32.4–50.3ms. Forty-eight return selections took 31.9–37.8ms before and
31.7–36.5ms after. All twelve old first selections showed feedback; none of the
sixty new selections did. These are local browser observations, not physical
iPhone measurements or promises about cold network latency.

Local build and checks pass: 108 station/viewport/ground combinations, 49
navigation/failure/accessibility controls, and 12 opening/index checks. Navigation
recorded 2,261 sampled frames with zero blank frames. The new regression isolates
a prefetched first Ledger visit from network loading; it commits in 33.7ms,
below the feedback threshold. Slow code/data/drawing, return visits, cancellation,
latest-request wins, chart geometry, keyboard/touch focus and failures are covered.
Reports and captures: `/tmp/reiyah-focus-latency.AYgdR2/`, including `baseline/`,
`direct-import/`, `navigation-release/` and `opening-release/`.
The final profile (`profile-release/`) confirms all three transition animations
last 180ms; the observed ready-to-finished lifetime is 188.8–195.4ms including
frame scheduling. Its 28 selections show no circles.

Published UI commit: `16c1174418fbf0b528775b6ed83fb104e61c11f2`.
Production deployment:
`https://reiyah-5aqw3v465-daniels-projects-ca65133a.vercel.app`, Vercel receipt
`9ohhqdUXa6fsALnybUmkFdkr1pg6`. Both production domains returned the current HTML
and 29 byte-identical assets/snapshot files each. The main assets are
`index-CH1LilT4.js` (SHA-256
`8332a3859f7dd972bcfa9d4f395e2d0b4a0d30e0a69b5b3ea7f70e65f2adb160`) and
`index-DRucsfez.css` (SHA-256
`f94277e38103c93ae0027ef6dcc47a601204aa547d3dbeeea89d1472b47962d5`).
Live checks pass: all 18 destinations, 33 navigation/failure/accessibility
controls and 12 opening/index cases. The isolated prefetched first visit commits
in 33.2ms on production. Reports: `production-readback.json`,
`navigation-production/` and `opening-production/` under the same scratch directory.
Engine and snapshot bytes are unchanged. This UI task is complete; browser
observations still do not establish physical iPhone/Safari performance.

## Opening, index and chart follow-up, 2026-09-07

The operator rejected the oversized opening wordmark, then specified that the
name should be the only visible text. The opening now centers the original Reiyah
mark above a small Instrument Sans name (18px on phones, 20px on desktop).
A single subtle reflection crosses the mark; its animation position carries
across the inline-to-React handoff. Progress remains accessible to screen readers.
Do not restore surrounding rings, captions, progress bars, decorative diagrams,
large titles or an artificial pause. Verification failures still show a clear
reason and retry action.
The operator also rejected recurring loading circles when revisiting a station.
Feedback now appears only after 200ms on a first visit; a return visit never
shows a spinner. The feedback timer does not delay navigation.

The operator approved the simpler, centered index direction. The dialog is at
most 620px wide, with quiet sentence-case Instrument Sans labels and two columns:
eleven engine stations on the left, six measurement stations and the audit on the
right. Every target is at least 44px tall at the supported sizes. It retains focus,
Escape cancellation and atomic menu/page handoff. Do not restore the rejected
map, preview pane, side alignment or oversized condensed headings.

The final tab-light request was explicitly a small refinement: its brightest
point is reduced by 10%, retaining the existing sweep shape and timing. This is
scoped to navigation cards; the shared light token and other surfaces are unchanged.

The follow-up desktop recording exposed a defect in the first fix's pending
indicator: as inline content, it wrapped the longer Measurement and Same Hazard
dock labels. This increased dock height by about 24px during a request, shrank the
prepared page, then resized its charts after commit. The indicator is now absolute
and cannot affect layout. Dock selection scrolls only the rail, not its ancestors.

The shared chart canvas also had a second 700ms entrance fade. That fade is removed.
Measured chart boxes report readiness; the hazard, windshield and reference canvases report
first drawing or an explicit unavailable state. The measured repeated dock visits
now keep chart dimensions and opacity stable from the first visible frame.

The opening mounts the verified first station underneath itself, inert, then waits
for readers, chart layout and Harbor's worker first-drawing acknowledgement. It
leaves with one 360ms opacity transition; reduced motion reveals immediately.
The stage no longer has its own entrance fade. Browser history can change the
initial destination while the opening is present, and both theme controls observe
the same ground. Verification failures still block and retry through the digest gate.

The inline and React openings share CSS in `index.html`. The original typefaces
are self-hosted with content-hashed WOFF2 files, original OFL licenses and
`public/fonts/SOURCES.json`. No font provider request is needed on startup.
No engine, evidence snapshot, sealer, protocol, or scientific computation changed.

The Reference screenshot was traced to the local UI adapter, which was still
running the previous server module and reading lane `9464ff7` on
`gate-b-measurement`. That lane has no Result AO. The committed production snapshot
reads `6925e7e` on `research/2026-09-07-physical-reference-transfer` and contains AO.
The local UI adapter was restarted with the current console module. Production
evidence bytes were preserved. Reference now retains required-record failures
instead of swallowing them into a cached ready result with a missing AO.

Blocked surfaces use a compact centered message, a small status indicator, a
44px retry action and expandable technical details. Retry reloads the current
station through the complete source-verification gate. Missing records, transport
failures and verification failures stay distinct; no substitute data is rendered.

Current rigs: `npm run test:navigation` checks all 18 stations at the three supported
sizes in both grounds, per-frame dock geometry and drawing opacity, plus focused
dock/chart checks at 1728x960 and slow/failing/return-visit cases. `npm run test:opening`
checks shared opening geometry, centered placement, 44px index targets and keyboard focus, worker readiness,
blocked verification/retry, history during opening, reduced motion and missing fonts.
Final local checks: the production build passes; the navigation rig passes all
108 station/viewport/ground combinations and 44 focused controls, including
repeated Reference drawings and an interrupted Reference transfer followed by a
verified retry. The opening rig passes 12 checks, including name-only visible
text at all six viewport/ground combinations. Browser captures and machine reports
are under `/tmp/reiyah-navigation-review.RX24Kd/navigation-release/` and
`/tmp/reiyah-navigation-review.RX24Kd/opening-signature/`. These are Chromium
observations at desktop and phone viewport sizes, not physical iPhone validation.
Published UI commit: `9cdf772d406cb6dcd453872124ce65a878f2d5f2`.
Production deployment:
`https://reiyah-fla8dljho-daniels-projects-ca65133a.vercel.app`, Vercel receipt
`HPfw7LpPKmLgQztShRrMyNj8x1LD`. Both `reiyah.danielwahnich.dev` and
`reiyah.vercel.app` returned the current HTML and 29 byte-identical files each:
all built JS/CSS assets, four fonts, both source manifests and Result AO.
The main assets are `index-CElprnLr.js` (SHA-256
`d2d1eddb42cbf49efe7216eb0b2c445764805c1602d53a27e8d06e6a881d61d6`) and
`index-CHVaA2Vr.css` (SHA-256
`4bbd6b3c94eaa8f57f55755e86b7645bc222635b653759c53e3b0d8ee618550f`).

Production browser checks passed: 12 opening/index checks, all 18 destinations,
and 28 navigation/failure/accessibility controls. Captures and reports are in
`opening-production/` and `navigation-production-final/` under the session
scratch directory; `production-final-readback.json` records file hashes for both
domains. A fresh localhost Reference load also returned a ready canvas with no
blocked panel after the local adapter restart. No UI task remains pending.

All authored changes pass the whitespace check. The three retained upstream OFL
license payloads intentionally preserve their original bytes, including upstream
trailing spaces and B612's CRLF line endings; all font and license hashes match
`public/fonts/SOURCES.json`.

## Current navigation contract, 2026-09-07

The operator's 13.75-second iPhone recording showed the field index disappearing,
the previous page showing through, then a dark interval before the destination.
Reproduction on the original `78bb612` build found empty DOM content during three
first-time transitions and a second opacity animation on every keyed page mount.

`StationFrame` now prepares only one destination at the actual panel size, hidden
and inert, while the current page remains mounted. `useSurfaceState` reports its
loading/ready/blocked phase to that frame. Once the code and readers settle, two
animation frames allow layout and canvas effects to run. The same prepared DOM
becomes visible; it is not remounted. Field-index and palette dismissal happen in
the same commit. A menu selection directly reveals the ready page; dock and history
navigation may use one 180 ms panel transition. Never restore a second
`.panelcontent` entrance fade or dismiss a menu before destination readiness.

Only the latest request may commit. Escape cancels a pending field-index selection.
The dock settles its scroll before paint, so it does not move under the next tap.
Transition pseudo-elements do not intercept input; reduced motion and browsers
without View Transitions take the same readiness path. Failed readers remain
explicit blocked states; a failed station chunk leaves navigation usable.

Validation: production build passes; `npm run test:navigation` passes all 18
stations at 1280x820, 430x745 and 390x660 in both grounds (108 combinations),
with no sampled empty/transparent content frames, no station/document overflow,
and a stationary dock. Eight additional controls cover history, keyboard/focus,
slow code/data, cancellation, out-of-order completion, failures and motion fallbacks.
Captures and reports are in `/tmp/reiyah-navigation-review.RX24Kd/` for this session.
Chromium results are browser observations, not measurements on the operator's iPhone.
The installed Playwright WebKit process could not create a page; Safari 17.4
WebDriver explicitly refused a session because Allow Remote Automation is disabled.

The operator authorized production publication of the proven transition fix first,
then a separate visual redesign of the field index and opening verification page.
Do not reseal or change engine evidence as part of that visual work.

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
- **Stable navigation** — prepare the destination before reveal; the dock and
  panel geometry stay fixed. See `go()` in `App.tsx` and the current contracts above.
- **Honesty is the luxury** — renders only digest-verified committed machine
  records; the six epistemic states never collapse to zero/false; no fabricated
  metrics; retained history is shown but never counted as current replay
  evidence; "SYNTHETIC / NOT A DEPLOYED SYSTEM / NO PERFORMANCE CLAIM" where a
  claim could be implied. Not a driver-monitoring system.

### Design system ("Liquid Obsidian", tokens in `src/instrument.css`)
Two grounds: paper `#f4f3ee` / obsidian `#050507` (default) (toggle top-left).
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

## Shipped 2026-09-04 (eighth pass): THE FLICKER, root cause found in frames
Screen recording at 17:49 showed the Controls page alternating every ~100 ms
between the full page and a page where only the two backdrop-filtered digest
chips were painted (HUD and dock intact). Cause: the film-grain overlay, a
full-panel `mix-blend-mode` layer animated in 3 steps every 0.5 s. On WebKit a
blended overlay over content with backdrop-filtered children re-composites
the whole group on every step and intermittently paints it empty. This also
explains the earlier "torn" transitions. Fix: grain is static and unblended;
every pulse is compositor-only (deepest-control glow = opacity of a pseudo,
seam light = translateX, dial pivot = opacity, crossing lights = translateX,
no filter in entrance keyframes). LAW: never blend or animate a full-panel
overlay; never animate box-shadow, background-position, filter, or SVG
attributes.

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

## PAINT LAW (audited 2026-09-05, enforce on every change)
Audit command: list every @keyframes and its properties, every `infinite`
animation, every transition on a paint property. Current state: 20 keyframes,
all opacity/transform only; 12 perpetual animations, all compositor-only; no
mix-blend-mode anywhere; no filter transitions; the grain is static and
unblended. Transitions on background/box-shadow/color remain only for
state changes on small elements (hover, cursor). Never: a full-panel overlay
that blends or animates; animating box-shadow, background-position, filter,
or SVG attributes; view-transition names on dock tabs or station content.

## Shipped 2026-09-07 (evening): THE FOUR, measured before and after
Baseline captured first with a headless rig over the sealed build: 17 stations
x 2 viewports x 2 grounds, zero overflow, 61 fps, but 4.9 MB over 250
requests at boot, 8 of 17 stations visible in a scrollbar-less dock, and the
sealed lane at gate-b-measurement 9464ff7 (register 0.2.23, no Result AO).
- **THE DOCK, MEASURED** (`src/components/Dock.tsx`): stations carry a rail
  (engine / measurement / audit, `src/lib/camera.ts`); a hairline opens each
  rail; overflow is measured (ResizeObserver + scroll) and shown as edge
  fades plus a pinned tab with the exact count out of view ("+11 more" on
  desktop, "+16" on the phone); the tab opens THE FIELD INDEX, all stations in
  three rails, one opaque card (card law), layer bus, Escape. The pressed
  station always scrolls into view. The legacy world-space camera hook is
  removed with its row/col grid.
- **THE LANE FROM ONE COMMIT** (`tools/lane-files.mjs`, shared by the sealer,
  the server and the publisher): the Gate B lane is read with `git show` from
  GATEB_REF (default `research/2026-09-07-physical-reference-transfer`, the
  tip of Codex's linear research chain), so the sealed bytes and the identity
  beside them are one immutable object; the worktree remains a fallback.
  212 lane files sealed (was 120): result_ao.json, the research-board,
  reference-study and developer-value aggregates, the newest register 0.2.24
  (48 claims), the study protocol/freeze/reviewer instructions, the narratives.
  Sibling ledgers are excluded on purpose.
- **EVERY LANE BYTE VERIFIED BEFORE PARSING** (`fetchLaneText`): byte length
  and SHA-256 are checked against the manifest row before any parser runs;
  UTF-8 decoding is fatal. This answers F01 of the engine's interface-evidence
  review (a parsed body and its receipt could name different versions). Also
  from that review: Measurement and SameHazard now read the newest register
  (F05); the Monitor's missing comparison reads "comparison not present"
  instead of 0.000 (F06); `parseConvergence` returns an explicit `terminal`
  (L5 only when L0..L5 are all present) and every parsed number must be
  finite; `parseH4` returns null without its header (F07). F02 to F04 remain
  open and are named in that review.
- **ST-17 THE REFERENCE** (`src/stations/Reference.tsx`, rail: audit): the
  two horizons. Near, the filtered cache the ghost label was measured against;
  far, the complete annotation table. Filled lights between them are the flags
  that came inside (3,151 camera, 5,728 lidar), hollow lights beyond are still
  unmatched; the counts are the labels. Beside it, the prepared 240-case study:
  four strata, 60 each, the confidence set drawn as a bracket that is a dashed
  full-width empty mark until judgments exist (0 today). Register chips for
  reference-error identification (unknown), ghost coincidence (narrowed) and
  the AO audit (measured). Every figure from result_ao.json and the study
  aggregates, digest-checked.
- **LOAD ON DEMAND** (`src/lib/prefetch.ts`): every station but the Harbor is
  a lazy chunk; a station fetches its own bytes; after it renders, only its
  two dock neighbours and the Harbor are warmed in idle time (code, then
  bytes). `warmSealedSurfaces` warms the catalog only; `warmLane` the manifest
  only. Measured: boot 4.9 MB / 250 requests -> 1.6 MB / 30 requests; main
  bundle 136 KB gz -> 91 KB gz; heap 18 MB -> 6 MB; 60 fps, no long tasks.
- **Words**: the Windshield tile no longer says "the human silent miss" (the
  lane removed the word: no warning path was observed); the Harbor law gauge
  reads "human and machine near independence", the register's own reading.
- **THE REAL CASE** (Encounter): a line under the transport reads the study
  aggregates: 0 independent judgments, 240 cases across 93 scenes, the film
  stays the synthetic fixture until two blinded reviews exist; digest chip.
  Desktop frame: horizon 0.42 -> 0.38, object radius up to 24 px.
- Rig: shots at 1280x820 and 390x660 for all 18 stations, both grounds, zero
  overflow; probe for boot transfer, fps, dock, field index, receipt, palette.

## Shipped 2026-09-08 (night, later): THE RECEIPT HOST
- User: a receipt opened from a derivation sat under it. Root cause: the
  receipt overlay was rendered by the chip inside the derivation, so the
  card could not close without unmounting the receipt. Now `ReceiptHost`
  (primitives.tsx, mounted once in the Stage next to the Palette) owns the
  one overlay: a chip calls `openReceipt({id, sha, path})`, the host claims
  the layer (the derivation closes), runs the proof, shows the overlay at
  z 120 above everything, and broadcasts the verdict so every chip naming
  that record shows ◆ or ✕. Escape, scrim and CLOSE close it.
- The replay row on the Adversaries phone view was hidden by the generic
  short-phone rule for `.wsreg`; `.wsreg.replayrow` is shown.

## Shipped 2026-09-08 (night): ADVERSARIES v2, the wall, the rules, the replay
- Research: 569 fixtures (511 known-bad, 58 known-good) in 5 families, 253
  declared rules; the old bar list showed ~12 rules of 253. The sealed
  reports carry replay ledgers: gate-a-validation-1.2.1 (fixtures block:
  24 fixtures, 23 rejected for the declared diagnostic, 1 passed), the
  1.2.8 continuity contract (fixture_validation 40/40 rejected, 5/5
  passed, actuals sha frozen before expectations), the 1.2.6 schema
  mutation results (18/18 rejected) and the 1.2.7 mutation validation
  (53/53 rejected, actuals sha). None of this was exposed before.
- THE WALL is a canvas: every fixture one cell banded by family; red for
  must-be-rejected with depth by byte size (log), hollow ink for must-pass,
  faded for retained history; the cursor and hover as before; the fit loop
  picks the largest square that fits every band.
- THE RULES is a squarified treemap (canvas) of all 253 declared rules,
  area = fixtures aimed at the rule, labels where the tile has room.
  LINKED: resting on a cell lights its rule; resting on a rule lights every
  cell that must fail against it and dims the rest (press to pin).
- THE REPLAY row: every validation report with a replay or mutation block,
  version, rejected n/n, passed n/n, "actuals frozen" when the sha is
  recorded, a Digest chip per report; the catalog's own binding sentence.
- Phone: cells down to 2 px with 2 px gaps and 12 px bands; wall 1.9fr over
  the treemap 1fr.

## Shipped 2026-09-08 (later): ONE CARD AT A TIME
- `src/lib/layers.ts`: a tiny layer bus. Every floating surface (Stat's
  derivation, Digest's receipt, the Palette) takes a token, claims the layer
  when it opens, and closes when any other token claims it. Escape and
  outside-press behaviour unchanged. Nested case: pressing a digest chip
  inside a derivation opens the receipt and closes the derivation.

## Shipped 2026-09-08: THE CARD LAW, faces before the reveal, the first screen primed
- User on the phone: every opened card except the receipt was unreadable,
  the content beneath bled through. Cause: `.derive` (the derivation popover)
  had no background of its own and wore `.glass` (5% white + backdrop blur).
  THE CARD LAW (instrument.css): anything that floats over content is an
  opaque surface with its own elevation: `.derive`, `.provecard`, `.palette`
  now use the solid panel colour (#101318 on obsidian), a 1 px rim and a
  deep soft shadow, no backdrop filter. Glass stays chrome on the ground.
- First-load flash: the stage revealed before the web fonts arrived (Google
  Fonts, display=swap) and before the Harbor's numbers loaded, so text
  swapped faces and the gauges popped from ∅ to values. ProofBoot now waits
  (capped 1.4 s) for the four faces via document.fonts.load and primes the
  Harbor loader (`loadHarborInstruments`, exported from Harbor.tsx; the
  station keys it on the pulse) via `primeSurface` (primitives) before it
  departs; the dashboard reveals by opacity once its data is in hand.

## Shipped 2026-09-07 (latest): HARBOR v3.2, the exact operation, explained on the road
- User: "no text" meant less text; the scene must explain the exact
  operation, a real presentation of the backend, not a show. So the scene
  carries precise labels at the exact points where each step happens and
  nothing else: the six kind zones as faint lines across the road with
  their names at the road's right edge (a zone lights as a record crosses
  it; a name is drawn only where it has 12 px of room), the GATE named at
  the left end of its dashed line with the rejected rule id flashing
  beneath for 2.4 s, the record being sensed by path and digest at the
  bottom left, the count in flight at the top right, the shape legend
  (fixture, schema, history, validator) at the bottom right on desktop.
- The chain fits the visible road: zone positions, the gate and the seal
  are scaled by `span` so OBS..EVD all lie between the horizon and the
  dashboard; a record seals as it reaches the cabin (THE FIELD instrument).
- Damped pointer parallax on the world (16 px x, 6 px y), the cabin and
  HUD never move; off on phones and under reduced motion.

## Shipped 2026-09-07 (late): HARBOR v3.1, exposure discipline and restraint
- User on the phone: the vanishing point burned into a white blob with a
  warm, dirty halo; too much text for a first screen. Causes: additive
  glows of every far object stacking at the horizon, a red halo under the
  iris, bloom 0.9 with a 0.16 threshold, and HUD text everywhere.
- GL post (harborGL/worker): bright-pass threshold 0.16 -> 0.34 (only real
  highlights bloom), bloom 0.9 -> 0.32 (dark) / 0.16 (paper), dispersion
  0.0009 -> 0.00035, grain 0.045 -> 0.022, and a FILMIC SHOULDER in the
  composite: highlights roll off from 0.82 with 1 - exp(-3x), so nothing
  clips to a blob. Law: no light may saturate; the eye reads the roll-off.
- Engine: object glow only past depth 0.14 and scaled by depth squared
  (the horizon never stacks), belief halo dimmer, iris ring thinner with no
  standing halo (the surge glow is steel blue and brief), NO standing text:
  no "REIYAH SEES", no ticker, no six-kinds readout, no sealed/in-flight
  ledger, no legend, no kind labels on brackets, no gate labels; only the
  momentary red "rejected · <rule>" on desktop and the hover tip remain.
  The instruments carry the numbers.
- Gauges: one line each, faint ink subs, numbers 1.3rem; the source gauge
  says head, clean/dirty and verified-live or the seal time.

## Shipped 2026-09-07 (night): HARBOR v3, the night drive with a dashboard
- RESEARCH/DESIGN (in one line each): the first screen must show the whole
  story at a glance and stay honest to the byte; the instrument already had
  one cinematic world (roadScene) on ST-03/08/13, so the Harbor joins it
  rather than keeping its own simpler road; the reticle at the vanishing
  point is the brand (the Aware Iris, open toward what it cannot see, pupil
  toward the gap); a cabin has a dashboard, so the dashboard carries the
  instruments; every instrument is a live number from committed bytes with
  press-to-prove and a tap that flies to its station (no decorative gauge).
- ENGINE (`harborEngine.ts`, runs in the worker): `drawWorld` + `drawCabin`
  from `src/lib/roadScene.ts` (now React-free; `useGround` moved to
  `src/lib/ground.ts` so a worker can import the renderer); the iris reticle;
  wet-road reflections under near objects; HUD text kept clear of the
  A-pillars via `edge`; six-kinds readout and legend hidden on phones;
  `env.dash` tells the engine how tall the dashboard band is.
- DASHBOARD CLUSTER (`Harbor.tsx`, `.dash`/`.gauge`): THE FIELD (sealed,
  rejected, bytes, index digest chip), IT CORRECTS ITSELF (releases from the
  catalog + authority line), THE LAW (mini line: camera x lidar, eyes x
  hands, LLM jury MMLU marginal, human x machine H6), THE REGISTER (33
  claims as a segmented bar by status), THE MONITOR (V AUC vs naive), THE
  SOURCE (engine head/branch/clean + lane head/branch/clean + GA-17 and
  transport states). Loader keyed on `pulse` so a re-verification re-reads.
  Desktop: absolute over the dashboard band; phone: below the scene, 2x3.
- Rig: `ov.mjs` covers harbor; sweeps 51/51 both grounds.

## Shipped 2026-09-07 (later): the register successor, intervals everywhere, THE MONITOR
- REGISTER BY DATE: `registerPath()` (gateb.ts) resolves the newest
  `evidence/claim-status-register-YYYY-MM-DD.json` from the lane manifest;
  every station that reads the register (Measurement, Windshield, Same
  Hazard, Law, Monitor) now reads the successor 0.2.6 of 2026-09-06 (33
  claims, predecessor named, deletion prohibited). `parseRegister` returns
  version, createdOn, predecessor. Register chips (`.regchip`) show each
  relevant claim's status in the register's words; forbidden in red,
  measured/derived in steel blue; inconclusive stays inconclusive.
- LANE LISTS BY DIRECTORY: sealer and server now glob every transcript
  (evidence/measurement, human-channel/evidence, llm-generalization/evidence
  .txt), every register, every narrative .md, docs/RESULT_*, GATE_B_*,
  GENERAL_SYNTHESIS: 88 lane files. A new result is sealed the moment it is
  committed; no list edit needed.
- H7 intervals on the Windshield (human column CI, "looked forward" CI,
  takeover CI, participant-clustered) and on The Law's human row.
- THE LAW: LLM rows per benchmark from Result AC (MMLU same/cross family
  and conditional with 95% CI; ARC and HellaSwag marginal and conditional);
  axis to 2.4; group gaps; the jury line carries effective models for three
  benchmarks; U cells carry ARC/HellaSwag unanimous-yet-wrong.
- ST-16 THE MONITOR (`src/stations/Monitor.tsx`, row 4 col 3): V
  reliability (moved from Law), X/X2 transfer rows (naive -> monitor, with
  ceiling), Z/AA/AB sensor rows (scene monitor vs density; per-object
  realness vs score), register chips for all monitor claims. Parsers:
  parseH7, parseAC, parseX, parseZcv, parseAAcv, parseAB.
- Lane head at seal: 0785c79 (dirty: an AD tool in progress, not rendered).

## Shipped 2026-09-07: instant stations, THE HORIZON, THE VAULT, a schema gap closed
- INSTANT STATIONS. `useSurfaceState` keeps every station's assembled data
  for the session (keyed by the loader's source + deps) and mounts ready in
  the same frame on return, while the loader re-runs underneath (stale-while-
  revalidate on content-addressed bytes). `warmSealedSurfaces` now warms
  every catalog JSON and the schema index; `warmLane()` (gateb.ts) warms
  every lane file after boot in idle time. The `.note` reading text stays
  invisible for 220 ms (opacity only), so a fast load never flashes it.
- ST-08 FRONTIER = THE HORIZON: canvas in the shared night world; every
  discovery pointer a hollow steel-blue ring standing on the horizon in the
  column of its source kind, reflected on the wet road; the cursor and
  hover as before; kind labels on the road; "the sealed field ends here".
- ST-10 THE CONTRACT = THE VAULT: every schema one segment of a ring
  (filled = closed, hollow = open), families contiguous; the fixtures thrown
  at each family as ticks stacked outward (red known-bad, ink known-good)
  with the count; hover by angle; centre carries the counts.
- SCHEMA GAP CLOSED: the sealer and the live server indexed only the top of
  schemas/; the application schemas the fixtures attack live in schemas/v1.1
  and v1.2 (14 files). Both now walk subdirectories (version from the dir
  name); 219 -> 233 schemas. The Contract joins fixtures to schemas by $id.
- LANE MOVING FAST: since Result V the lane added W (ARC replication), X
  (monitor transfer), Y (HellaSwag), Z/AA/AB (sensor monitors), AC/X2 (LLM
  intervals), a register SUCCESSOR evidence/claim-status-register-2026-09-06
  .json (0.2.0, schema 1.4, human-channel and LLM claims registered). The
  instrument still reads the 2026-08-29 register: NEXT is to read the latest
  register by date, show lineage, and expose W..AC on THE LAW.

## Shipped 2026-09-06 (late night): the exposure audit, and THE LAW
- Audit method: list every committed lane transcript and every engine 1.2.x
  record, compare with the file paths the stations read (`grep` for
  "evidence/" and "human-channel/" and "llm-generalization/" in src). The
  engine's 1.2.9 readiness-input seal-truth records (incident, correction,
  plan, fixture catalog) were already sealed and read by the Chair; the gap
  was the lane's newest work: H6, Results T, U, V.
- ST-15 THE LAW (`src/stations/Law.tsx`, camera row 4 col 2): ONE LINE with
  every pairing above one independence mark, grouped by domain: SENSORS (two
  lidars, Result H instance unit conditioned, with CI; camera x lidar, Result
  L, with CI), ONE HUMAN (H3), HUMAN x MACHINE (H5; H6 with clip-clustered
  CI), LLM JURIES (T same-family, cross-family, conditional with its range).
  Ink = same kind, steel blue = different kinds. Right column: THE JURY
  (seven models' error rates, the lit share of each bar = effective
  independent models 3.6 of 7), AGREEMENT IS NOT CONFIDENCE (100 cells, ten
  red: unanimous-and-wrong 10.4%), THE MONITOR (Result V reliability: five
  predicted-vs-actual bands on the diagonal, the naive's 0% on unanimous
  items as a red hollow dot). Register check: the register has NO entry for
  H6, T, U, V and the instrument says so; parsers `parseH6`, `parseT`,
  `parseU`, `parseV`, `parseHInstance` (strict, fail closed).
- ST-14 THE SAME HAZARD hero is a canvas (`SquaresScene`): where the
  transcript gives 2x2 counts (H5, H6) every object is one point, red where
  both channels missed it; placement inside a cell is arbitrary, populations
  are not. Area-only squares for Result P and H3. Fourth square = H6 total
  miss with its interval. Stats: H6 c with CI and verdict, H5 c, register.
- ST-13 third pillar now shows H6 (0.981 with CI bracket) when present,
  falling back to H5, then to the explicit unknown.
- Lane file lists gain h6 txt + md, result_h_instance_unit, T/U/V txt + md,
  llm-generalization README. Lane head at seal: 945caa9 (Result V).

## Shipped 2026-09-06 (night): the Encounter recomposed, the Windshield bared
- User feedback on the phone: the Encounter was two thirds empty sky, the
  cabin read as a box, the sightline cones ("radar lines") and tags collided
  over a tiny object. Recomposed: on portrait the horizon sits at 30%, a real
  dashboard takes the bottom 25% and the beat caption sits on it, the object
  is larger with a ground shadow and a wet-road reflection, tags stack to the
  right. The cones are GONE: the human's attention is a soft field of light
  (white on obsidian, steel blue on paper) that rests near the object and
  drifts away in the joint blind; the automation's detection is the lock
  brackets that drop; the joint miss is one red ring. A thin lidar-like scan
  line sweeps the road. Same language as ST-14's design (field, brackets,
  ring).
- roadScene: pillars now carry a soft inner shadow instead of a rim, a lens
  vignette darkens the corners, the dashboard has a curved lit edge, and the
  night sky holds a seeded still star field with distant lights along the
  horizon (day has neither).
- Windshield: the panel label is removed and the scene runs edge to edge
  (`.wshero`, padding 0), 12rem minimum on phones, per the user's request.
- Rig: `beats.mjs` captures the Encounter at OUT, JSM and BEL beats on
  desktop and phone; ov.mjs only ever sees the prelude.

## Shipped 2026-09-06 (evening): the cinematic layer, and the build-to-seal pin
- `src/lib/roadScene.ts`: ONE shared night-road renderer (sky glow, wet
  asphalt, edge lines, perspective dashes, headlight wedge) plus the cabin
  (A-pillars, dashboard, glass sheen) and `useGround()` (MutationObserver on
  data-ground). Obsidian = night, paper = day, same geometry. Nothing in it
  is data; it is the frame the data stands in.
- ST-13 THE WINDSHIELD hero is now a still canvas (`WindshieldScene`): the
  independence line IS the horizon (red dashed); coefficients above 1 rise
  as columns of steel-blue light with reflections on the wet road; 0.97 sits
  just under the horizon on the far road; CI bracket on the automation
  column; HUD captions on the dashboard; header on the glass. Drawn once per
  size/data/ground after document.fonts.ready; revealed by opacity only.
- ST-03 THE ENCOUNTER uses the same world (road flows via phase) and gets the
  cabin, drawn unswayed after the object (the camera sits in the cabin).
- ST-09 THE SEEING rewritten as a living field: every one of the 934 index
  artifacts is a point on one of four elliptical rings (governance; schemas
  and tools; fixtures with known-good in ink and known-bad in red; custody).
  The rings BREAK in the dark sector (the iris opening, -70..-20 deg): no
  bytes stand there. A conic gaze sweeps once per 36 s and brightens what it
  crosses; its readout says "finds nothing here" inside the sector. Hover
  reads path, role, digest; press opens the readout row with a Digest chip
  when the bytes are in the seal. 30 fps cap; reduced motion = static, no
  sweep. Labels are HTML (`.shud`, corner-placed on desktop, 2-col grid on
  phones); rays are measured to the labels and drawn in canvas.
- BUILD-TO-SEAL PIN (root cause of the "Same Hazard blocked" report): the
  bundle is immutable but /snapshot is cached 5 min browser / 1 h edge, so a
  new station met an old lane manifest and blocked honestly. Now every
  sealed fetch carries `?b=<build id>[-<sealedAt>]` (`snap()` in
  evidence.ts; gateb.ts uses it). `__BUILD_ID__` is the sha256 of src/,
  index.html and package-lock (vite.config.ts), so local and Vercel builds of
  one commit are byte-identical again and the prod==local check holds.
- Lesson: "vercel deploy" builds REMOTELY; the local dist is not what is
  served. Any nondeterminism in the build breaks the prod==local check.

## Shipped 2026-09-06 (latest): ST-14 THE SAME HAZARD, first light from committed bytes
- The lane committed H5 (f3963ee): the cross-agent joint on BDD-A, 13,904
  detectable objects, c = 0.972, no interval, descriptive. Not committed:
  exhibits, rights records, a per-object table, a register entry. H6 (total
  both-miss on reference objects) exists in the lane tree uncommitted and is
  NOT rendered.
- ST-14 `src/stations/SameHazard.tsx`: three 2x2 squares in measured pixels,
  one per redundancy pairing (automation from Result P megvii row at score
  0.30, marginal; human from H3 all events; cross-agent from H5). The red
  cell is the both-miss share (width P(A miss), height P(both)/P(A miss)),
  the outline is what independence predicts (P(A) by P(B)); same-kind
  overflows, the cross-agent one fits and its outline turns steel blue
  (`.sq.hold`). Stats: c, both-miss vs independence with the 2x2 counts and
  the correlation, and the register's state for joint-silent-miss (unknown,
  use forbidden) beside the number: neither upgraded. The bounds panel is
  parsed from the H5 narrative's "The bounds" section (`parseH5Bounds`,
  strict, fails closed). "THE FRAME · waiting" row states that the exhibit
  hero waits on committed bytes; nothing stands in for it.
- Windshield: the third pillar is now the measured 0.97 mark on the line
  when H5 parses, the unknown pillar otherwise. H5 non-claims live on ST-14
  (adding them to ST-13 squeezed the H4 chart).
- Parsers `parseH5`, `parseH5Bounds`, `parsePairRow` in `src/lib/gateb.ts`.
  Lane file lists (sealer + server) gain the H5 transcript and narrative.
  Camera cell row 3 col 3; rig station "samehazard".
- Still owed by the lane for the designed hero: exhibits with rights records,
  the per-object table, an interval, a register entry (docs/LANE_REQUEST_J1.md).

## Shipped 2026-09-06 (later): the third pillar as an explicit unknown; Result S under the register
- The Windshield draws HUMAN × AUTOMATION as a hollow dashed pillar, "not yet
  measured": the meeting point is a state, shown, never a guess.
- Result S (corrected safety calculus) is in the lane, but the claim-status
  register still marks the three evidence-cost claims withdrawn as stated,
  use forbidden. The Windshield shows a register-check row and never the
  transcript's multiplier. LAW: the register governs; a newer transcript does
  not lift a withdrawal until the register says so.
- `docs/LANE_REQUEST_J1.md`: the exact artifacts the lane must commit for
  ST-14 (transcript, per-object table, exhibits with rights records, register
  entry). Lane file list gains result_s.txt.

## DESIGN DECISIONS · ST-14 THE SAME HAZARD · final, 2026-09-06 (build only when j1 lands)
1. One frame, one sentence. The page opens on a single exhibit frame filling
   the stage, the road as the viewer would see it. No stat strip above it.
   The figures come after the image, never before.
2. Three states of light, nothing else. Attention = a soft luminous field
   (white on obsidian, steel blue on paper), detection = thin ink brackets,
   the joint miss = one red ring. No legend; the three are self-evident. Red
   is spent on the joint miss alone.
3. Time is the instrument. A single scrubber under the frame runs the clip;
   the attention field breathes with the observers' gaze, brackets appear
   when the detector fires, the red ring appears only in the frames where
   both channels are absent on the same object. The scrubber's marks are the
   both-missed frames. Space plays and pauses.
4. The number arrives last. After the exhibit, the third pillar: three
   coefficients above one independence line, the cross-agent one with its
   interval. It is the payoff, not the headline.
5. Nothing on screen without its bytes. Every exhibit carries clip, frame,
   object ids and digests; press to prove; the attention PNG and the frame
   JPEG are lane-committed with a rights record; the rule that scored each
   object is in the derivation popover of every figure.
6. Uncertainty is drawn, never hidden. The interval on the cross-agent c is
   part of the mark; objects with attention density near the declared
   threshold are drawn with a dashed ring, and "unmeasured" objects (outside
   the detector's classes, off-frame, occluded per the transcript) are hollow.
7. The cut list. No video autoplay of all exhibits; no heatmap colour ramps
   (rainbow forbidden); no 3D; no WebGPU; no sound; no synthetic frames; no
   per-object popups covering the road; no counts inside the hero.
8. Phones first. The hero is the full width, the scrubber sits at the thumb,
   the pillar and the object field follow in one screen each, measured at
   430x745 and 390x660. The paper ground keeps the field visible: steel blue
   field at low alpha, brackets in ink.
9. Performance law. Heatmap composited once per frame from the committed PNG
   with globalCompositeOperation, brackets and rings drawn on top, one rAF,
   idle when not scrubbing; canvas only, compositor-only CSS elsewhere; the
   exhibit set warmed after boot like every other sealed byte.
10. Honesty law. The page states, in the lane's words, what "attended" and
   "detected" mean, that the observers watched in a lab, that the detector
   ran on published frames, and that this is association on one dataset,
   proposed, not externally audited.

## PLAN · ST-14 THE SAME HAZARD (cross-agent joint) · RESEARCH ONLY, not started
The one measurement still open is HARBOR's target: the human and the
automation failing on the SAME hazard. The lane is waiting on BDD-Attention
(BDD-A, Berkeley; braking-event clips from BDD100K with driver attention maps
from in-lab eye tracking, delivered as per-frame Gaussian heatmaps; no object
boxes in the dataset, so the automation channel is a detector the lane runs
and validates to its published mAP). Rights: the BDD download terms grant use,
copy, modify, distribute for research and not-for-profit purposes with the
copyright notice retained and Xia 2018 / Yu 2020 cited; the GitHub repo is
BSD-3. That permits a small number of exhibit frames on the instrument IF the
lane commits them with a rights observation, exactly as it does for every
other source. Never pull dataset pixels into the console repo ourselves.

What the instrument needs the lane to commit (ask, never fabricate):
1. `human-channel/evidence/j1_same_hazard.txt` — the transcript: per-clip
   universe, the attention-density rule (declared threshold), the detector and
   its validated mAP gate, P(human not attended), P(detector missed),
   P(both), expected, c with an instance-clustered interval, by class and by
   range if available, and NON-CLAIMS.
2. `human-channel/evidence/j1_objects.jsonl` — a compact per-object table
   (clip, frame, object id, class, box normalized 0..1, attention density,
   attended flag, detector score, detected flag, both_missed). Object-level
   truth makes the object-level field possible for the first time.
3. `human-channel/exhibits/` — 6 to 12 exhibit frames (JPEG, downscaled),
   each with its attention map (PNG) and the object list, plus a rights
   observation record (source, license text, notice, citation) per exhibit.

The page (one screen, both grounds, three viewports):
- HERO · THE SAME HAZARD: an exhibit frame with the attention map drawn as a
  luminous field over it (canvas, measured pixels), the detector's boxes drawn
  as brackets, and the objects both channels missed ringed red: the joint
  silent miss, visible on a real hazard. A scrubbable exhibit strip (6-12
  frames), each exhibit's clip/frame/object ids and digests. Press to prove
  on every exhibit byte. Reduced motion: static.
- THE THIRD PILLAR on the windshield: automation × automation (1.151), human
  × human (1.46), human × automation (j1, with interval) above one
  independence line. ST-13 gains the third mark; ST-14 repeats it large.
- THE OBJECT FIELD: every object in j1_objects as a point in a normalized
  frame plane (x, y of box centre), attended vs not on one axis, detected vs
  not on the other; both-missed lit; density by class; cursor reads the row.
- The provenance rail: source (BDD-A, license, citation), detector gate
  (published mAP vs reproduced), attention rule, matching rule, clustering
  unit, all from the transcript; non-claims verbatim.
Technique: canvas 2D for the hero (heatmap as an ImageData composite from the
committed PNG, boxes and rings drawn on top), SVG in measured pixels for the
pillar and the field, FitList for tables, URL state per exhibit and object,
derivation on every figure, digests on every byte. No WebGPU (thousands of
points at most). Colour law: attention = warm white-to-steel-blue field,
detection = ink brackets, joint miss = red ring only.
Verdict: this is the page that turns the instrument from "we measured both
sides" into "we measured the meeting point". Build it the day j1 lands.

## Shipped 2026-09-06: ST-13 THE WINDSHIELD — the human channel, both sides
The lane added `human-channel/` (H1..H4: 100-Car NDS CC0, DCPT CC BY 4.0;
transcripts under human-channel/evidence, tools, README). The station reads
the transcripts with strict parsers (`parseH1..H4` in gateb.ts) and draws:
the windshield (automation c 1.151 with interval, human c 1.46 without, one
independence line, an arc between them), the human rows (eyes-forward-
throughout 39.1% → 4.5% → 1.7%, off-road means, gaze forward at the instant
70.2% / 67.8%, the H3 joint by severity with "forward yet no reaction"), and
the DCPT takeover chart by task with the no-task baseline. Non-claims are the
transcripts' own NON-CLAIMS lines, verbatim. Lane file list gains the five
human-channel files (sealer + server). Every figure explains its derivation.

## Shipped 2026-09-05 (night): ST-12 redrawn as THE ROAD
The class × range field is now a first-person road on canvas: range bands are
depth zones ahead of the vehicle (near at the bottom), classes are columns,
each group a disc sized by objects and deepened by ratio, the worst eligible
group ringed red with a soft pulse, sitting directly ahead of the reticle.
Non-observed membership = dashed hollow. Readings inside large discs; small
far discs read only under the cursor (no collisions). The finest strata are
a dot-and-interval chart in measured pixels with the independence line.
Perspective: y = horizon + groundH · p^1.55, bands from p 0.93 to 0.35.

## Shipped 2026-09-05 (later): ST-12 THE WORST GROUP — the field
- The per-object records are NOT committed (2-record excerpt; the 235 MB
  file is git-ignored), so an object-level field is impossible today without
  fabrication. Built instead from the lane's typed worst-group records
  (`worst-group-records.jsonl`, three evaluations): the class × range field
  of discs (size = objects, depth = coincident-miss ratio, the worst eligible
  group ringed red), the by-class row, the motion-state row whose extremum is
  honestly MISSING (one group's membership non-observed), and Result I's
  finest strata (class × range × visibility) with simultaneous 95% intervals.
  Cursor/tap reads ratio, objects, effective n, interval width, disposition,
  membership and the six coverage counts. URL state `at=<group_id>`.
- Lane file list gains result_i / result_j (sealer + server).
- If the professor's lane ever commits a compact per-object table, the
  object-level field becomes possible; ask, never fabricate.

## Shipped 2026-09-05: ST-11 THE MEASUREMENT — the Gate B lane exposed
Discovery: the engine's real science lives on branch `gate-b-measurement` in
the worktree `~/workspace/reiyah-gate-b` (45 commits, the professor's session
pushes it public). Nothing watched it and no station showed it.
- Sealer: a SECOND SOURCE, `snapshot/gateb/` with its own manifest (branch,
  head, clean, commit count, lane non-claims) and 12 files with digests
  (claim-status register, Results L/M/N/O/P/Q transcripts, joint-performance
  excerpt, worst-group records, synthesis figure, contract, synthesis).
  Live: `/api/gateb/manifest` + `/api/gateb/raw/<id>`. Never blended with
  the Gate A packet. `GATEB_ROOT` env overrides the worktree path.
- Publisher: the published state is the PAIR of heads (Gate A worktree +
  Gate B lane); a dirty lane holds the publish.
- `src/lib/gateb.ts`: strict transcript parsers (convergence table on the
  common support, threshold sweep pair tables, E-values, 2x2 modality grid,
  Result P opposite-directions summary, claim-status register JSON). A
  transcript not in its known shape yields a blocked panel, never a number.
- Station: stat strip (terminal conditional c with CI, thresholds excluding
  1.0, E-value, claims register counts, lane PROPOSED); the convergence chart
  (L0..L5 with intervals, the independence line, L6 mediator error drawn as
  inadmissible); the sweep (both lidar pairs with bands); the modality grid
  (six pairs, cross vs same); the claims register verbatim (withdrawn stays
  withdrawn, permitted/forbidden use); Result P line; a non-claims strip.
  Charts draw in measured pixels (never stretched). Every figure's
  derivation names the transcript; press-to-prove works on lane bytes.
- Rig: `measurement` station added (36 views per ground).
LAW: the lane is rendered with its own states and non-claims verbatim:
proposed, not externally audited, association after declared conditioning,
never causation; the instrument never upgrades a lane claim.

## Shipped 2026-09-04 (night): THE FOLD (Nolan move A) + obsidian default
- `src/components/Fold.tsx`, mounted in press-to-prove: the sealed surfaces
  fold pair by pair into one root, live, every node a real WebCrypto hash
  from `getMerkle()`; the audit path lit; the root typed as reached; compute
  first, reveal over 2.4 s; reduced motion = instant. Labels only on the path,
  side chosen by room. Verified desktop + phone, sealed mode.
- Obsidian is the default ground (index.html fallback, theme-color). The rig
  now runs `--light` for the paper sweep (default run is obsidian).
- A digest press stops propagation so the Stat's derivation never opens
  behind the prove card.
- Cache note: a viewer can see a stale shell for one load after a deploy (the
  worker no longer seizes pages); production is verified byte-identical to
  the committed build after every deploy.
- B THE BURNED NAMES (Chair, third pane): the incident's required_future_sequence
  drawn as a time rail (now = filled blue, hard stop = red ring, STOP = red
  square, future = hollow) and the identities declared nonreusable
  (N128, R0_128) struck through, "never again". Fields only.
- C THE BREAK (Lineage, 1.0.0 node): the recovery record's public
  dispositions as marks (bytes publicly verifiable ◆, derivation replayable ∅,
  unbroken custody claimed ∅, 4 artifacts reconstructed from digests).
All three Nolan acts are live.

## THE NOLAN MOVE · research verdict 2026-09-04 (night) · PLANNING ONLY
Engine unchanged since the seal (74fbacc); instrument fully current. Candidates,
all built only from bytes the engine already holds:
A. **THE FOLD** (recommended). Every press-to-prove becomes a set-piece: the
   sealed surfaces fold pair by pair into one root, live, every hash computed
   by WebCrypto in the viewer's browser, the pressed record's audit path lit,
   the root written digit by digit as it is computed. Compute first, reveal at
   cinematic pace (~1.6 s); reduced motion = instant. Practical effect, not
   CGI: nothing on screen the browser did not just compute. Extends to the
   full index on the Ledger (934 leaves, 10 hops; root labelled "computed here,
   not a committed value"). merkle.ts + proveInclusion already exist.
B. **THE BURNED NAMES** (second act, in the Chair). Time as structure: the
   contracted future K129 → V129 → I129 → N129 → STOP before R0_129 drawn as
   reserved hollow stages with a hard stop, and the two identities that can
   never be used again (N128, R0_128: absent, not attempted, blocked,
   unretained, nonreusable) as extinguished marks the timeline routes around.
   Every element is a field in incident_disposition / future_transition_model.
C. **THE BREAK** (small). Lineage's 1.0.0 custody interruption dramatized as a
   spine torn and re-joined by digest proof (exact bytes publicly verifiable,
   derivation not replayable, from RECOVERY.json's public_dispositions).
Rejected: three synchronized clocks (gimmick), anything that is not a
computation or a committed field.
Order if approved: A, then B, then C. No new dependencies, canvas 2D, one
page each, measured on all three viewports.

## Shipped 2026-09-04 (late): the research verdict, executed
1. DONE: every figure explains itself. `Stat` primitive (primitives.tsx):
   tap a headline figure for the rule in words, the committed source records
   with digests (press to prove), and the moment it was computed here.
   Wired into every station's stat strip with exact rules and sources.
2. DONE: URL as state. `src/lib/urlstate.ts`: `?st=<station>&at=<reading>`
   (control_id, fixture_id, schema path, artifact path, discovery_id,
   estimand_id, chair version). Only a person's gesture writes `at`;
   verified that every link reproduces the reading.
3. Anchored captions: not done; the derivation popover covers the need.
4. DONE: `contain: layout paint` on glass surfaces.
5. Harbor vocabulary: open.

## RESEARCH VERDICT 2026-09-04 (evening) · what the 2026 frontier offers this instrument
Sources: WebKit release notes for Safari 26.0 / 26.2 / 26.4 / 26.5, Interop 2026,
Liquid-glass CSS/SVG write-ups (kube.io, LogRocket, w3c/svgwg#1142), CHI 2026
SuperProvenanceWidgets, ChartGPU / WebGPU charting threads, Tesla/Rivian
visualization coverage (Aug 2026).
Applies, ranked:
1. **Every figure explains itself (provenance widgets).** CHI 2026 provenance
   work + our digest-bound records: a `Derived` primitive that gives any stat a
   popover with the source records (path, sha256), the rule in words
   ("count of index rows where role = known_bad_fixture"), and press-to-prove.
   Anchor Positioning (Safari 26, Interop 2026) places it on the figure itself.
   Unusual, honest, and exactly this instrument's thesis.
2. **URL as state.** Cursor / selection deep links (`?st=controls&at=GA122…`,
   `?st=chair&v=1.2.9`) so a reading can be shared exactly. Cheap; people are
   watching.
3. **Anchored captions.** The wall / lattice / skyline / horizon captions
   anchored to the cursor cell with `position-anchor` (fallback: the caption
   row we have). Threaded on the compositor in Safari 26.4+.
4. **Glass performance.** `contain: strict` on every glass surface; SVG
   displacement in backdrop-filter remains Chromium-only, keep the ladder.
5. **Harbor vocabulary.** Tesla moved FSD viz to Unreal, Rivian stays
   cel-shaded: the language is neutral objects that turn coloured only when
   they need attention. Our sensed world already follows that; next: richer
   object silhouettes by role, still 2D.
Does NOT apply: WebGPU (payoff starts past ~100K points; we draw 934),
scroll-driven animations (the instrument does not scroll), sonification (no).
Colour law (user): pass/live/verified is a cool steel blue (`--ok`), red only
for genuine alarm/rejection/incident; never green beside red beside black.

## MISSION PLAN 2026-09-04 · exposure audit — EXECUTED the same day
Status of the ranked plan (all live in production):
0. DONE: resealed at engine 1.2.9 (74fbacc, clean); sealer catalogs incidents,
   evidence, versioned fixture catalogs; digest-bound schema index
   (`schemas-index.json` sealed, `/api/schemas` live); publisher holds when the
   console tree is dirty; launchd job installed (`dev.danielwahnich.reiyah-publish`,
   log /tmp/reiyah-live.log).
1. DONE: Chair = THE CORRECTION ENGINE anatomy.
2. DONE: ST-10 THE CONTRACT (lattice, coverage, claims wall, thesis).
3. DONE: Controls toolchain lock strip.
4. DONE: Lineage stage machine.
5. DONE: Frontier standards crosswalk rail.
6. DONE: Estimands contract sheet on tap.
7. DONE: ⌘K palette (stations, artifacts, rules, schemas, estimands, controls;
   press-to-prove where bytes are present). Not done by decision: WebGPU,
   sonification.
Rig: `ov.mjs` now includes the `contract` station (33 views per ground).

## (original plan text, kept for lineage)
**Engine state:** head 74fbacc on gate-a-1.2.9-readiness-input-seal-truth-contract,
clean. Six commits since the public seal (4990a3d, 1 Sept, 1.2.7 dirty):
+2 incidents (1.2.8 R1 continuity, 1.2.9 seal truth), +2 corrections, +3 reviews,
+1 interface contract report, +4 fixture catalogs, +~50 schemas, +7 validation
plans/locks. The evidence index itself is unchanged (934 artifacts; it is
regenerated only at release closeouts), so Harbor/Ledger numbers are current
while Chair/Lineage are two versions behind. The publisher (watch-and-publish)
is not running.

**Verdict:** the instrument exposes the evidence SURFACE brilliantly (index,
reports, controls, fixtures, chain, frontier, estimand names, decision seat)
and leaves the contract DEPTH invisible: 221 schemas in 133 families; 318
adversaries aimed at 10 application schemas (per-schema coverage); the
incident anatomy (named defects such as K129-D01..D04, 8 obligations, 10
positive + 44 negative required regressions, all-false authority ceilings,
dispositions like absent_not_attempted_blocked_unretained_nonreusable); the
toolchain lock (exact interpreter, module origins, deadline contract); the
scientific contract profile (production rules, cross-cutting rule contracts,
closure policy); the mission thesis and invariants; the dated standards
crosswalk; the 77-item decision inventory. Roughly a third of what makes
Reiyah remarkable is not on screen.

**Plan, ranked (each: measured fit, real bytes, visuals over text):**
0. Reseal now (engine is clean) and install the publisher launchd job so the
   public instrument mirrors every clean engine commit. Extend the sealer's
   catalog roots to `validation/`, `schemas/`, `evidence/` (crosswalk).
1. ST-07 → THE CORRECTION ENGINE anatomy: per version a spine
   incident → named defects → root cause → obligations → required regressions
   (positive/negative bars) → review verdict → implementation result → seal;
   every disposition state its own mark, never collapsed. Tap a defect to read it.
2. New ST-10 THE CONTRACT: schema lattice (221 × 133 families, measured cells
   like the wall), adversarial coverage per application schema as a depth
   strip, the claims register as an explicit "what Reiyah does not claim" wall
   (support/safety/compliance/superiority all FALSE, from bytes).
3. ST-04 Controls → the toolchain lock: exact interpreter and digests, module
   origins, deadline contract; the byte-bound launcher story.
4. ST-02 Lineage → the stage machine: ordered stage ids and the append-only
   sequence as a rail with current_authorized_stage and current_hard_stop_before.
5. ST-08 Frontier → the standards crosswalk as a second horizon (evidence and
   gaps, dated, never a compliance claim).
6. ST-05 Estimands → tap reveals identification assumptions, validity
   conditions, abstention rule, required reporting.
7. Cross-cutting: ⌘K palette over artifacts/rules/schemas (yes); press-to-prove
   from any cursor in live mode (yes); WebGPU (still no: nothing to compute);
   sonification (no, for now).

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
