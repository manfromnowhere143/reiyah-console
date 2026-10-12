# Harbor and Encounter: spatial instrument refinement

12 October 2026. Console presentation work; the engine is unchanged.

Harbor now gives the existing driving scene the main surface. The heading,
current-reference comparison and provenance occupy compact floating positions.
The play/stop glyph has a 44px target without a visible enclosure. The bottom
dock retains its existing layout and navigation.

The procedural world adds distance haze and terrain, perspective road paint,
reflectors, restrained asphalt texture, soft reflected light, contact shadows
and shaded artifact faces. Paper and dark grounds use distinct material values.
Encounter uses the same world and six depth planes for its record sequence.
These depths illustrate a sequence; they are not physical distances. The
abstract object does not assign a measured color, class or appearance to the
fixture's unknown properties. This is an illustrative renderer, not a physical
driving simulation or live sensing system.

Encounter's seven stage controls include the separately identified joint-miss
concept. Pause, seeking and stage selection use the fixture clock. Paused stage
selection presents the exact record fully instead of freezing a transition
between records. Fractional device-pixel ratios use integer backing dimensions.
Short landscape places the road beside its narration and controls.

Findings and Comparison use smaller typography, compact controls and measured
diagrams. Comparison separates shared reference worlds, the strict threshold
and the preference proposition. Complete methods open in native dialogs with
persistent controls. Long historical records use bounded reading panes;
unusually short windows and enlarged text retain scrolling for accessibility.
Scientific limitations and corrected interpretations remain accessible.

The edition is pinned to engine `152b53a9b3bc3118128d474484ee8fea855cddde`:
212 local records, 67 continuation-bound artifacts and 1,252 catalog paths.
Prior editions and the historical architecture retain their identities.

## Design references

These informed implementation choices, not scientific evidence or a claim of
design superiority:

- [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials):
  restrained material separation for controls above content. Quantitative
  diagrams retain a flat, legible plane.
- [Apple: Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass):
  content remains the focus; material effects are limited to controls.
- [MDN: Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries):
  composition responds to the station's actual remaining space.
- [Google: Filament rendering documentation](https://google.github.io/filament/Filament.html):
  a reference for coherent material/light relationships. This Console retains
  its existing Canvas/worker/WebGL pipeline and approximate procedural materials.

## Verification boundaries

Automated Chrome checks use fresh profiles, real interaction and screenshots.
They cover 320px reflow, both grounds, portrait/landscape, every station, all
eight Findings and their controls, both Comparison states, historical/current/
synthetic receipts, focus return and keyboard cues. Controlled renderer checks
separately cover alpha handling, pause, device-pixel sizing and exact stage
disclosures. These checks do not establish physical Safari, VoiceOver or mobile
GPU performance. No engine experiment or human work-saving result is inferred
from a passing interface test.

The owned review, intermediate failures, corrections and final reports are retained
at `~/.codex/reports/reiyah/console-scene-design-2026-10-12-1xh0kxi5/`.
The current release and final check counts are recorded in [HANDOFF.md](../../HANDOFF.md).
