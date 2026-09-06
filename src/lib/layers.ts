/* One card at a time. Every floating surface on the instrument (a
   derivation, a receipt, the palette) claims the layer when it opens; every
   other one hears the claim and closes. The rule a system menu follows: the
   viewer never sees two cards stacked. */
const bus = new EventTarget();
let seq = 0;
export function newLayerToken(): number { return ++seq; }
export function claimLayer(token: number): void { bus.dispatchEvent(new CustomEvent("claim", { detail: token })); }
export function onLayerClaim(cb: (token: number) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<number>).detail);
  bus.addEventListener("claim", h);
  return () => bus.removeEventListener("claim", h);
}
