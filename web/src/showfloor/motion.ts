/**
 * Does the browser ask for reduced motion?
 *
 * DESIGN.md § Motion (The Reduced-Motion Rule); FR-013. Where `matchMedia` is
 * absent — jsdom, an old engine — the honest default is `false`: the pane does
 * not claim a preference it could not read, and every motion it authors is
 * gated in CSS as well.
 */

import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function currentPreference(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(currentPreference);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    return undefined;
  }, []);

  return reduced;
}
