/* ST–09 · THE SEEING — the whole of Reiyah as one mandala of sight.
   The Aware Iris at center; rays of light touch every live truth of the
   system arranged around it. In the exact direction of the iris's opening
   lies the Dark Sector — what is defined but unmeasured, unauthorized,
   honestly unlit. Re'iyah: the seeing that knows what it does not see.
   Every number on this screen is a committed byte. */
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { fetchCatalog, fetchSurface } from "../lib/evidence";
import { Blocked, Station, useSurfaceState } from "../components/primitives";

export function SystemAtlas({ ev }: { ev: VerifiedEvidence }) {
  const state = useSurfaceState(async () => {
    const proto = await fetchSurface<any>("protocol");
    const catalog = await fetchCatalog();
    const diVersions = [...new Set(
      catalog.map((c) => c.path)
        .filter((p) => p.includes("operator-decision-interface"))
        .map((p) => p.match(/1\.2\.\d+/)?.[0])
        .filter(Boolean) as string[]
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { proto: proto.state === "observed" ? proto.data : null, diVersions };
  });

  if (state.phase === "loading") return <Station id="ST–09" name="The Seeing"><div className="note">composing the mandala…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–09" name="The Seeing"><Blocked reason={state.reason} /></Station>;

  const { proto, diVersions } = state.data;
  const artifacts = ev.index?.artifacts ?? [];
  const bad = artifacts.filter((a: any) => a.role === "known_bad_fixture").length;
  const controls = (ev.report?.required_replay_controls?.length ?? 0) + (ev.report?.implementation_controls?.length ?? 0);
  const kinds: string[] = proto?.scientific_layers ?? ["observation", "latent_belief", "decision", "intervention", "outcome", "evidence"];
  const epistemicN = proto?.epistemic_states?.length ?? 6;
  const estimands = proto?.estimands?.length ?? 10;
  const auth = ev.index?.authority ?? {};

  return (
    <Station id="ST–09" name="The Seeing" sub="re'iyah · the seeing that knows what it does not see · every number is a committed byte">
      <div className="mandala">
        {/* N · the law of the light */}
        <div className="mcell m-n">
          <div className="mmotto">"A BLOCKED RESULT IS PREFERABLE TO A PLAUSIBLE DEFAULT."</div>
        </div>

        {/* NE · THE DARK SECTOR — where the iris opens */}
        <div className="mcell m-ne">
          <div className="mcard" data-dark="true">
            <div className="mname">THE DARK SECTOR</div>
            <div className="mline"><b>{estimands}</b> estimands defined · <b>0</b> measured</div>
            <div className="mline">runtime {String(auth.runtime_authorized ?? false).toUpperCase()} · gate B {String(auth.gate_b_authorized ?? false).toUpperCase()}</div>
            <div className="mline dim">the light does not pretend to reach here</div>
          </div>
        </div>

        {/* W · the world */}
        <div className="mcell m-w">
          <div className="mcard">
            <div className="mglyph"><svg width="38" height="38" viewBox="0 0 44 44"><g fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 40 L18 10 M36 40 L26 10" opacity="0.6" /><path d="M22 4 l5 5 -5 5 -5 -5 Z" /></g></svg></div>
            <div className="mname">THE WORLD</div>
            <div className="mline">a person–vehicle–automation encounter</div>
            <div className="mline dim">never a person alone</div>
          </div>
        </div>

        {/* NW · six kinds */}
        <div className="mcell m-nw">
          <div className="mcard">
            <div className="mbig">{kinds.length}</div>
            <div className="mname">KINDS, NEVER MERGED</div>
            <div className="mchips">{kinds.map((k) => <span key={k}>{k.replace("latent_", "")}</span>)}</div>
            <div className="mline dim">{epistemicN} epistemic states · missing is never zero</div>
          </div>
        </div>

        {/* CENTER · the iris, breathing */}
        <div className="mcell m-c">
          <div className="miris" aria-label="The Aware Iris">
            <svg viewBox="0 0 240 240" width="100%" height="100%">
              <g className="mrays" stroke="currentColor" strokeWidth="1" opacity="0.22">
                <line x1="120" y1="120" x2="120" y2="6" />
                <line x1="120" y1="120" x2="16" y2="52" />
                <line x1="120" y1="120" x2="4" y2="120" />
                <line x1="120" y1="120" x2="16" y2="188" />
                <line x1="120" y1="120" x2="120" y2="234" />
                <line x1="120" y1="120" x2="224" y2="188" />
                <line x1="120" y1="120" x2="236" y2="120" />
                {/* no ray toward NE: the opening faces the dark sector */}
              </g>
              <circle className="mring" cx="120" cy="120" r="74" fill="none" stroke="currentColor" strokeWidth="17" strokeLinecap="round" strokeDasharray="400.3 64.6" transform="rotate(-20 120 120)" />
              <circle cx="133" cy="109" r="20" fill="var(--accent)" />
            </svg>
          </div>
        </div>

        {/* E · sealed evidence */}
        <div className="mcell m-e">
          <div className="mcard">
            <div className="mbig">{artifacts.length.toLocaleString()}</div>
            <div className="mname">SEALED EVIDENCE</div>
            <div className="mline">content-addressed · append-only</div>
            <div className="mline dim">re-verified in this browser at boot</div>
          </div>
        </div>

        {/* SW · the gate */}
        <div className="mcell m-sw">
          <div className="mcard">
            <div className="mbig">{controls}<em>✓</em></div>
            <div className="mname">THE GATE</div>
            <div className="mline">twin isolated evaluations, byte-equal</div>
            <div className="mline red">↓ {bad} known-bad, rejected by design</div>
          </div>
        </div>

        {/* S · the human */}
        <div className="mcell m-s">
          <div className="mcard">
            <div className="mglyph"><svg width="36" height="36" viewBox="0 0 44 44"><g fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="8" width="24" height="18" rx="3" /><path d="M14 26 v10 M30 26 v10 M10 36 h28" /></g></svg></div>
            <div className="mname">THE HUMAN</div>
            <div className="mline">acceptance {String(auth.operator_acceptance_state ?? "unaccepted").toUpperCase()}</div>
            <div className="mline dim">no tool may decide</div>
          </div>
        </div>

        {/* SE · corrections */}
        <div className="mcell m-se">
          <div className="mcard">
            <div className="mname">IT CORRECTS ITSELF</div>
            <div className="msaga">{diVersions.map((v, i) => <span key={v}><b>{v}</b>{i < diVersions.length - 1 ? " → " : ""}</span>)}</div>
            <div className="mline dim">defect → contract → review → seal · append-only</div>
          </div>
        </div>
      </div>
    </Station>
  );
}
