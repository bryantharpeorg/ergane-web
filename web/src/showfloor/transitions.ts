/**
 * The transition marker's lifecycle.
 *
 * FR-012: a state change between two successive stage documents applies a
 * marker that is subsequently cleared; no marker fires on first paint.
 * FR-013: under reduced motion the marker is never applied at all, so nothing
 * the pane shows depends on it.
 *
 * The marker is the contract, not the animation (plan.md Decision 5): the
 * apply-and-clear lifecycle is asserted with fake timers, never by reading a
 * computed animation.
 */

import { useEffect, useRef, useState } from "react";
import type { StageDocument } from "./types";

/** How long a transition marker stays on a card. */
export const TRANSITION_MS = 900;

export function useTransitionMarkers(
  stage: StageDocument,
  reducedMotion: boolean,
): ReadonlySet<string> {
  const remembered = useRef<Map<string, string | null> | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [marked, setMarked] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  useEffect(() => {
    const current = new Map<string, string | null>(
      stage.nodes.map((node) => [node.id, node.state]),
    );
    const previous = remembered.current;
    remembered.current = current;

    // First paint is not a transition: seed the memory and mark nothing.
    if (previous === null) return;
    if (reducedMotion) return;

    const changed = stage.nodes
      .filter(
        (node) =>
          previous.has(node.id) && previous.get(node.id) !== node.state,
      )
      .map((node) => node.id);
    if (changed.length === 0) return;

    setMarked((current) => {
      const next = new Set(current);
      changed.forEach((id) => next.add(id));
      return next;
    });

    const scheduled = timers.current;
    changed.forEach((id) => {
      const running = scheduled.get(id);
      if (running !== undefined) clearTimeout(running);
      scheduled.set(
        id,
        setTimeout(() => {
          scheduled.delete(id);
          setMarked((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, TRANSITION_MS),
      );
    });
  }, [stage, reducedMotion]);

  useEffect(() => {
    const scheduled = timers.current;
    return () => {
      scheduled.forEach((timer) => clearTimeout(timer));
      scheduled.clear();
    };
  }, []);

  return marked;
}
