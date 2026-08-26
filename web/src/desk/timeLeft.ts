export type TimeLeft =
  | { kind: "none" }
  | { kind: "expired" }
  | { kind: "remaining"; seconds: number; text: string };

export function timeLeft(
  expiresAt: string | null,
  reference: Date,
): TimeLeft {
  if (expiresAt === null) {
    return { kind: "none" };
  }

  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - reference.getTime();

  if (diffMs <= 0) {
    return { kind: "expired" };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return {
    kind: "remaining",
    seconds: totalSeconds,
    text: `−${hh}:${mm}:${ss}`,
  };
}

export function referenceInstant(doc: {
  reference_instant: string | null;
}): Date {
  if (doc.reference_instant !== null) {
    return new Date(doc.reference_instant);
  }
  return new Date();
}

/**
 * How long ago the factory's deadline passed, for the stale fold's one line
 * (006 FR-008, DESIGN.md § The Desk in this world › The stale fold).
 *
 * The countdown anchor rule, restated for the other side of the deadline: the
 * only two inputs are the factory-written `expires_at` and the document's own
 * reference instant — the same pair `timeLeft` takes, and for the same reason.
 * There is no third argument this function could accept, so "expired 14m ago"
 * cannot be minted from the pane's own clock however the caller is written.
 *
 * Returns `null` for an item that has no deadline to have passed and for one
 * whose deadline is still ahead of the reference instant: neither is stale, and
 * neither has an "ago" to state.
 */
export function timeSince(expiresAt: string | null, reference: Date): string | null {
  if (expiresAt === null) {
    return null;
  }

  const elapsedMs = reference.getTime() - new Date(expiresAt).getTime();
  if (elapsedMs < 0) {
    return null;
  }

  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${totalHours}h` : `${totalHours}h ${minutes}m`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}
