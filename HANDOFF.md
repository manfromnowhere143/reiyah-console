# Reiyah Console — Session Handoff

Living handoff for the next session. This repo is **reiyah-console** (the Harbor
Instrument UI), separate from the Reiyah **engine** repo (`~/workspace/reiyah`,
which has the Gate-A baton/denylist — none of that applies here; normal git).

## The mission and the bar
Build the most state-of-the-art 2026 UI/UX for Reiyah: **SpaceX / Tesla /
Mobileye / HBO / Steve-Jobs level, edge of elegance, honest to the byte.** The
user reviews on an **iPhone (iOS Safari)** — **mobile must be perfect** (no
overflow, correct height, no scroll). "Every detail matters." Push each surface
to the absolute top level; analyse → plan → implement; do not assume — verify.

### The standing UX doctrine (how every page must be)
- **One page, one screen, dynamic, no scrolling.** Each station fits the
  viewport and reads at a glance. This is non-negotiable and is the current work.
- **Floating surfaces** — no hard borders/boxes; content floats on the ground
  (soft fills + inset sheen + shadow). No page titles (identity is on the dock
  tab). No decorative red — red only signals genuine alarm / digest-mismatch /
  blocked / rejected.
- **Forge navigation** — pressing a dock station morphs (shared-element expand,
  View Transitions API) from that tab into the panel; see `go()` in `App.tsx`.
- **Honesty is the luxury** — renders only digest-verified committed machine
  records; the six epistemic states never collapse to zero/false; no fabricated
  metrics; "SYNTHETIC CONCEPT / NOT A DEPLOYED SYSTEM / NO PERFORMANCE CLAIM"
  where a claim could be implied. Not a driver-monitoring system.

### Design system ("Liquid Obsidian", tokens in `src/instrument.css`)
Two grounds: paper `#f4f3ee` (default) / obsidian `#050507` (toggle top-left).
One red accent (`#E31937` dark / `#D61732` light). Fonts: **Big Shoulders**
(display), **Instrument Sans** (body), **B612 Mono** (data). Operator's law: on
obsidian all text is white and visible — hierarchy via size/weight, never by
dimming ink. Repository text contains no em dash.

## Deploy / ops
- Deploy: `vercel --prod --yes` (project "reiyah", team daniels-projects-…),
  then **`git push origin main`**. Live at **reiyah.danielwahnich.dev**.
- GitHub: `github.com/manfromnowhere143/reiyah-console` (created this session;
  push after every commit so the activity graph reflects the work).
- **Disk was 100% full this session** (freed to ~4.5 GB). WATCH IT: clean
  `dist/`, scratch video/screenshots, `npm cache clean --force`, and the big app
  caches (`~/Library/Caches/com.openai.codex` ≈1.9G, `.../Google` ≈840M) if
  needed. FFmpeg masters are big — target ~CRF 20, remove intermediates.
- Verify workflow: headless `puppeteer-core` scripts against the dev server
  (`npx vite` on :4610; evidence server on :4600). Always check **desktop
  1280×820 AND mobile 430×932**: screenshot + measure `.stbody` scrollHeight vs
  clientHeight for overflow. Capture → view → iterate.

## Shipped and live this session
Boot "Aperture" splash + self-healing watchdog + single clean load; **iOS
height fix** (JS-measured `--app-h` re-sampled on resize/orientation/pageshow/
visualViewport/timeouts, all fixed roots `height: var(--app-h,100dvh)`); **Harbor
= THE SENSED WORLD** (first-person in-cabin sensing, road, REIYAH-SEES reticle,
Mobileye/Tesla detection brackets on the real artifacts, gate rejects in-world;
OffscreenCanvas **Web Worker** + **WebGL2** cinema pipeline `harborGL.ts` with a
byte-identical 2D fallback); **Encounter** = one-page self-playing film + scrub
timeline; **The Seeing** = one-screen compact mandala; **Lineage** = responsive
rows; forge transition; floating everything / no titles / no decorative red;
visible road lines; footer removed; **The Chair** seat now black-and-white.

## IN PROGRESS — the stat-page one-page redesigns (uncommitted → committed with this handoff)
Taking Controls, Chair, Estimands, Frontier, Adversaries to one-page dynamic like
the others. A reusable scaffold now exists in `instrument.css`:
`.onepage` (flex column, `height:100%`, no scroll) · `.statstrip`/`.stat`
(compact stat cards) · `.cboard`/`.ccell` (control-health board) ·
`.captable`/`.capgrid`/`.caprow` · `.ctimeline`/`.cnode` (Chair timeline) ·
`.chairbottom`/`.nullgrid` · `.estgridfill` · `.statwide`.

- **Controls** — DONE, the flagship. A **control-health board**: every control a
  cell, brightness = real observation count, the deepest check (925 obs) glows +
  pulses; compact stat strip; capability truth. Fits desktop + mobile.
- **Chair** — correction saga is now a **horizontal timeline** of version nodes
  (record count, incident, "forging now"; details on hover); compact seat +
  stages + empty form. **Fits desktop; MOBILE STILL OVERFLOWS (1029/799)** — fix
  first (the empty-form `.nullgrid` + timeline are too tall on phone; shrink the
  null-field rows / show fewer, tighten).
- **Estimands** — `.onepage` + `.estgridfill`. Fits desktop; **mobile overflows
  by ~5px (804/799)** — trivial: shave estcard padding or the hero note.
- **Frontier** — stat strip + side-by-side `grid2` panels. Fits both.
- **Adversaries** — already fits; NOT yet given a "next level" pass (user wants
  one — the ratio wall + rule bar-race could become more alive).

`tsc` + build are clean; all changes compile.

## NEXT STEPS (exact order)
1. **Fix `chair-m` overflow** (1029/799) and **`estimands-m`** (804/799) so both
   fit one screen on mobile. Re-verify overflow desktop+mobile for all five.
2. Commit + **`git push origin main`** + `vercel --prod --yes`; verify prod.
3. **Adversaries** — take it to the next level (dynamic, still fits).
4. **Encounter "next level"** — user asked to make it more alive/SOTA, but ONLY
   if a clearly-brilliant, honest way is seen (it already loops/scrubs).
5. **Harbor "even more real"** — user wants it even more state-of-the-art (learn
   from Sentinel's visuals — principles only, never import; LAW 1 independence).
   Sensed-world is strong; consider richer real-role encoding / more depth.

## Do NOT repeat
- The **Sora concept film was rejected** ("ridiculously bad"). The user wants a
  real product commercial, not artsy dramatization. See memory
  `reiyah-concept-film-rejected`. (Aweb's Maestro/Sora engine works as a
  rendering **adapter** — never Reiyah authority; clips lived in scratch.)
- Never import code/config/authority from a sibling repo (Odeya, Sentinel,
  Aweb, …). External models/MCP are adapters only.

## Key files
`src/App.tsx` (stage, dock, `go()` forge) · `src/instrument.css` (tokens +
`.onepage` scaffold) · `src/stations/*.tsx` · `src/stations/harborEngine.ts` +
`harborGL.ts` + `harbor.worker.ts` (the sensed world) · `src/boot/ProofBoot.tsx`
· `index.html` (inline splash, `--app-h`, boot watchdog).
