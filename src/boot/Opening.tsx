import { GroundToggle } from "../components/GroundToggle";

const STATUS = ["Establishing source", "Verifying index", "Reading evidence", "Preparing instrument", "Opening instrument"];

/* Only the name and mark are visible during normal preparation. Real progress
   remains available to assistive technology; a failed verification stays explicit. */
export function Opening({ phase, leaving, blocked, retrying, onRetry }: {
  phase: number; leaving: boolean; blocked: string | null;
  retrying: string | null; onRetry: () => void;
}) {
  return <div className="boot opening" data-leaving={String(leaving)} data-blocked={String(!!blocked)}
    role="region" aria-label="Opening Reiyah">
    <div className="opening-mast"><GroundToggle /></div>
    <div className="opening-field" aria-hidden="true">
      <svg className="opening-optic" viewBox="0 0 240 240" aria-hidden="true">
        <defs>
          <mask id="opening-mark">
            <circle cx="120" cy="120" r="84" fill="none" stroke="white" strokeWidth="20" strokeLinecap="round" strokeDasharray="454.5 73.3" transform="rotate(-20 120 120)" />
          </mask>
          <linearGradient id="opening-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".98" />
            <stop offset=".48" stopColor="currentColor" stopOpacity=".84" />
            <stop offset=".7" stopColor="currentColor" stopOpacity=".74" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".96" />
          </linearGradient>
          <linearGradient id="opening-light">
            <stop offset=".25" stopColor="white" stopOpacity="0" />
            <stop offset=".5" stopColor="white" stopOpacity=".3" />
            <stop offset=".75" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g mask="url(#opening-mark)">
          <path d="M0 0h240v240H0z" fill="url(#opening-metal)" />
          <g className="opening-reflection"><path d="M0 0h240v240H0z" fill="url(#opening-light)" /></g>
        </g>
        <circle cx="133" cy="107" r="27" className="opening-pupil" />
      </svg>
      <div className="opening-word">REIYAH</div>
    </div>
    <div className="opening-console">
      <div className="opening-progress" role="progressbar" aria-label="Instrument preparation" aria-valuemin={0} aria-valuemax={4} aria-valuenow={phase}
        aria-valuetext={blocked ? "Verification blocked" : retrying ?? STATUS[phase]} />
      {blocked ? <div className="opening-blocked" role="alert">
        <h1>Unable to open the instrument</h1>
        <p>The evidence could not be verified.</p>
        <details><summary>Technical details</summary><code>{blocked}</code></details>
        <button onClick={onRetry}>Try again <span aria-hidden="true">↗</span></button>
      </div> : <div className="opening-status" role="status">{retrying ?? STATUS[phase]}</div>}
    </div>
  </div>;
}
