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
  1280×820 AND mobile 430×932**, both grounds: screenshot + measure `.stbody`
  scrollHeight vs clientHeight. Capture → view → iterate. The rig used this
  session lived in the scratchpad (`ov.mjs`: all stations × both viewports,
  `--dark`; `enc.mjs`: the Encounter at eight clock moments).
- Shell note: never use `wc` in this machine's shell (a profile hook hijacks
  it); use `awk 'END{print NR}'`.
- Disk can fill up: clean `dist/`, scratch shots, `npm cache clean --force`.

## Shipped this session (2026-09-03), all live
- **Every station one screen** on desktop and phone, both grounds (40/40 fit).
  Ledger (stat strip, one stacked byte bar ≤6 segments, measured role/media
  lists), Lineage (stat strip, chain-of-custody rail, measured recovery list),
  Chair (correction timeline, seat, dashed empty-form chip cloud), Controls,
  Estimands, Frontier one-page.
- **Adversaries = THE WALL**: 569 fixtures as measured cells; filled = must be
  rejected, hollow = must pass, faded = retained history never counted as
  current replay; slow interrogation cursor reads the real path + declared
  rule; family legend lifts a family; rules as a measured list.
- **Encounter v3**: the film at the fixture's own clock (OBS t0, BEL t1, DEC t2,
  INT t3, OUT 4–10, EVD after); object holds station (observed relative speed
  0 m/s); human (dashed) and automation (solid) sightlines; joint silent miss =
  both look away at once, labelled concept; diegetic tags on ground plates;
  six-kind timeline with the outcome window as a span; space toggles play.
- **Harbor**: shape = role (◇ fixture ▢ schema ○ history ⬡ validator), ground
  shadows, flowing ground ticks, cabin sway, the gate fires red on rejection.
- **iOS "opens pushed off the top from a link" bug**: three measures shipped,
  root cause NOT yet confirmed from the device:
  1. body is `position: fixed` (the one no-scroll iOS honors) and any non-zero
     document scroll is reset at every viewport event;
  2. only the body is fixed; root, HUD, ground toggle, boot, splash are
     absolute inside it (one layer for iOS to place, not five);
  3. `?diag=1` overlays a live readout + timeline of innerHeight, visualViewport
     height/offsetTop/pageTop, scrollY, doc heights, --app-h since first byte.
  **Ask the user for a screenshot of `https://reiyah.danielwahnich.dev/?diag=1`
  opened from WhatsApp.** If `body top` is negative with `sy=0` and `pt=0`, the
  offset is a rendering placement, not a scroll: next step would be to size
  and translate the root from `visualViewport.offsetTop` explicitly.

## NEXT STEPS (in order)
1. Read the user's `?diag=1` screenshot; confirm or correct the iOS fix.
2. Keep every change measured: run the overflow rig on all 10 stations, both
   viewports, both grounds, before committing.
3. Candidate next-level work (from `reiyah-next-level-research-verdict`):
   ⌘K palette over artifacts/rules/estimands, signed proof cards, honest
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
