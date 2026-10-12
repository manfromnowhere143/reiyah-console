# Reiyah Console: Harbor Instrument

A visual reader for Reiyah’s evidence engine and HARBOR research program. The current
edition exposes conditional comparisons, evaluator findings, corrections and the
complete published research map. Obsidian and paper share the same meaning; a
figure opens its explanation, source and receipt.

This is a separate repository from the engine. It creates no scientific evidence,
operator acceptance or driving authority. Research results remain conditional on
their stated inputs and models. Production readiness, physical safety and reduced
complete team work are not established.

## Current edition

Engine commit `5be5c3dc5444ccfe98cd5a203a74d5d7d4834561`, as of 11 October 2026.
197 local authored/public records include every one of the 52 continuation-bound
artifacts. The wider catalog has 1,238 source paths; records marked **Source link**
open the exact engine commit and are not locally verified by the Console.

- **Harbor:** one cabin-framed loss enclosure, reference selection and evidence inspection.
- **Findings:** batching, empty outputs, motion consistency, review procedure,
  reference sensitivity, resolution limits, equal-information comparison and corrections.
- **The Comparison:** actual locally reproduced engine packets for the published
  synthetic example. Sufficiency and a counterexample are rendered differently.
- **Research:** searchable study and artifact library, with explicit local/source-link coverage.
- The eighteen existing route identities remain available. The former “Law” route
  is labeled **The Contrasts**, with the withdrawn interpretation explicitly corrected.

The historical Gate A snapshot and measurement transcripts retain their original
identities. The current claim register is a separately identified interpretation
overlay. The HUD labels the architecture source **ARCHIVE**; it does not imply a
live vehicle or live inference. Source digests establish byte identity, not truth.

## Run

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4620
```

The default static reader needs no engine service. Optional development service:

```sh
npm run serve   # read-only legacy evidence adapter on :4600
npm run dev     # Vite on :4610; /api forwarded to :4600
```

The local adapter defaults to `/Users/danielwahnich/workspace/reiyah`; override with
`REIYAH_ROOT` only after checking the intended repository identity. The current
research edition remains pinned independently of this legacy local source.

## Evidence and receipts

The application build binds the historical snapshot manifest. That manifest binds
its catalog, schema index and measurement manifest. Every displayed record passes
its expected length/digest before parsing. The research edition has a separate
build-bound manifest and content-addressed payloads.

A receipt recomputes the digest of the bytes associated with the **displayed**
reading. A later source version cannot certify an earlier displayed value. Receipt
results are keyed by record and digest; a superseded request cannot update the
current dialog. Merkle inclusion applies to historical named surfaces only. Other
records explicitly report that this particular inclusion proof is not applicable.

## Navigation and accessibility

The dock and centered Index retain prepared navigation: one visible station plus
at most one hidden, inert destination. The page commits only when its readers and
layout settle. Reduced motion skips the optional transition. Escape returns home;
Harbor inspection has its own Back/Escape/history behavior. Search is available
with ⌘K. Reading links include the edition, selected study and figure state.

Primary content reflows and details can scroll. Complete lists no longer withhold
rows behind a noninteractive “+N.” Quantitative marks have readable labels and a
text equivalent; the cabin is decorative. Receipts use a native modal dialog.
The Encounter fixture blocks on missing source records, supports keyboard seeking
and stops scheduling frames while idle. These implementation properties still
require the release browser checks described below.

## Update an edition

Use an isolated Console checkout and an exact public engine commit:

```sh
npm run publish:edition -- /path/to/verified/engine 40_CHARACTER_COMMIT
npm run test:edition
npm run test:evidence
npm run build
```

The publisher reads immutable Git objects, checks the continuation bindings and
retains previous edition directories. It never switches or bootstraps the engine.
The mutable-controller sealer and automatic legacy production publisher are
retired. Updating a source bundle is not permission to alter scientific claims.

## Verification and release

`test:edition` checks all published byte bindings and the batching figure against
its authored fixture arithmetic. `test:evidence` exercises the actual readers
under altered data, altered manifests, live generation changes and receipt races.
These are source/byte checks, not browser or scientific validation.

Before production, inspect desktop and compact phone layouts on both grounds,
keyboard navigation, Index, deep links/history, all eight findings, the example,
source receipts, unavailable data and the legacy stations. Test 320px reflow and
reduced motion. Physical Safari and VoiceOver require their own observations.

The older Puppeteer rigs remain historical test infrastructure; their eighteen-
station, worker and no-scroll assumptions predate this redesign and must be
updated before being used as release evidence. Do not report an old passing
browser record as validation of this edition. In Codex, browser operation follows
the installed Browser skill and requires a connected browser.

Production home: <https://reiyah.danielwahnich.dev>. See [HANDOFF.md](HANDOFF.md)
for the candidate status, validation record and any remaining release work.
