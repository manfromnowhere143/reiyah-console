/* the ground, observed: re-draws a still scene when the viewer flips it */
import { useEffect, useState } from "react";
export function useGround(): boolean {
  const read = () => document.documentElement.dataset.ground === "dark";
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ground"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}
