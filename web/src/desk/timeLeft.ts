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
