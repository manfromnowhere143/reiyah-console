import { Component, createContext, Suspense, useContext, useLayoutEffect, useRef, type ReactNode } from "react";

export interface NavigationOptions {
  push?: boolean;
  animate?: boolean;
  onCommit?: () => void;
}
export type Navigate = (id: string, options?: NavigationOptions) => void;

/* Prepare one destination at its real layout size, outside the visible and
   accessibility trees. A loaded code chunk alone is not a ready station:
   its surface readers must also settle, and its layout/canvas effects must
   get a frame before it can replace the current station. */
function createReadiness() {
  const loads = new Map<symbol, boolean>();
  let frame = 0;
  const gate = {
    mounted: false,
    alive: true,
    notified: false,
    onReady: () => {},
    cancel() { cancelAnimationFrame(frame); },
    schedule() {
      gate.cancel();
      if (!gate.alive || !gate.mounted || gate.notified || [...loads.values()].some(Boolean)) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!gate.alive || !gate.mounted || gate.notified || [...loads.values()].some(Boolean)) return;
          gate.notified = true;
          gate.onReady();
        });
      });
    },
    track(token: symbol, loading: boolean) { loads.set(token, loading); gate.schedule(); },
    release(token: symbol) { loads.delete(token); gate.schedule(); },
  };
  return gate;
}

type Readiness = ReturnType<typeof createReadiness>;
const StationReadiness = createContext<Readiness | null>(null);

/* Both verified content and an explicit blocked result are settled states.
   Navigation never substitutes data or treats a failed reader as success. */
export function useStationReadiness(phase: "loading" | "ready" | "blocked") {
  const gate = useContext(StationReadiness);
  const token = useRef(Symbol());
  useLayoutEffect(() => {
    gate?.track(token.current, phase === "loading");
    return () => gate?.release(token.current);
  }, [gate, phase]);
}

function LayoutReady({ gate }: { gate: Readiness }) {
  useLayoutEffect(() => {
    gate.mounted = true;
    gate.schedule();
    return () => { gate.mounted = false; gate.cancel(); };
  }, [gate]);
  return null;
}

class StationErrorBoundary extends Component<{ children: ReactNode; gate: Readiness }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <>
      <div className="ipanel blocked" role="alert">
        <h2>Station unavailable</h2>
        <p>This station could not be loaded. Choose another station or reload to try again.</p>
      </div>
      <LayoutReady gate={this.props.gate} />
    </>;
  }
}

export function StationFrame({ id, frameKey, preparing, onReady, children }: {
  id: string;
  frameKey: number;
  preparing: boolean;
  onReady: (key: number) => void;
  children: ReactNode;
}) {
  const gateRef = useRef<Readiness | null>(null);
  if (!gateRef.current) gateRef.current = createReadiness();
  const gate = gateRef.current;
  gate.onReady = () => onReady(frameKey);
  useLayoutEffect(() => {
    gate.alive = true;
    gate.schedule();
    return () => { gate.alive = false; gate.cancel(); };
  }, [gate]);

  return <div className="panelcontent" data-station={id} data-preparing={String(preparing)}
    aria-hidden={preparing || undefined} inert={preparing}>
    <StationReadiness.Provider value={gate}>
      <StationErrorBoundary gate={gate}>
        <Suspense fallback={null}>
          {children}
          <LayoutReady gate={gate} />
        </Suspense>
      </StationErrorBoundary>
    </StationReadiness.Provider>
  </div>;
}
