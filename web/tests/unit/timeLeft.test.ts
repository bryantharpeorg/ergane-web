import { describe, expect, it, vi } from "vitest";
import { referenceInstant, timeLeft } from "../../src/desk/timeLeft";

describe("timeLeft", () => {
  it("returns none when no expiry is supplied", () => {
    expect(timeLeft(null, new Date())).toEqual({ kind: "none" });
  });

  it("returns expired when expires_at precedes the reference instant", () => {
    const expiresAt = "2026-08-22T16:00:00Z";
    const reference = new Date("2026-08-22T17:00:00Z");

    const result = timeLeft(expiresAt, reference);
    expect(result).toEqual({ kind: "expired" });
  });

  it("renders 90 seconds before expiry as −00:01:30", () => {
    const expiresAt = "2026-08-22T17:01:30Z";
    const reference = new Date("2026-08-22T17:00:00Z");

    const result = timeLeft(expiresAt, reference);
    expect(result.kind).toBe("remaining");
    if (result.kind === "remaining") {
      expect(result.seconds).toBe(90);
      expect(result.text).toBe("−00:01:30");
    }
  });

  it("uses the document's reference instant when present", () => {
    const doc = { reference_instant: "2026-08-22T17:00:00Z" };
    expect(referenceInstant(doc).toISOString()).toBe("2026-08-22T17:00:00.000Z");
  });

  it("falls back to the wall clock when no document instant exists", () => {
    const now = new Date("2026-08-22T17:00:00Z");
    vi.setSystemTime(now);
    expect(referenceInstant({ reference_instant: null }).toISOString()).toBe(
      now.toISOString(),
    );
    vi.useRealTimers();
  });

  it("never produces a negative-looking clock for expired items", () => {
    const expiresAt = "2026-08-22T16:00:00Z";
    const reference = new Date("2026-08-22T17:00:00Z");

    const result = timeLeft(expiresAt, reference);
    expect(result.kind).toBe("expired");
    if (result.kind === "remaining") {
      expect(result.text).not.toMatch(/^−-/);
      expect(result.text).not.toMatch(/-\d/);
    }
  });
});
