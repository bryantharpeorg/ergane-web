/**
 * The Desk's floor section rides the showfloor document (006 US2-S2, FR-005).
 *
 * 001 gave the stream one type and 003 a second; 005 added the third —
 * `showfloor`, one event per *rail entry* that changed, not a whole document
 * (`pane/events.py`). The Desk now consumes it, so the ladders an epic row
 * draws are the same objects the Showfloor draws, arriving on the one
 * `EventSource` 001 opened rather than on a second stream of the Desk's own.
 *
 * What is asserted here is the client half: the third type reaches its
 * consumer, the entry it carries replaces the one the document already held
 * (and appends the one it did not), and a subscriber that passes no
 * `onShowfloor` still drops the type exactly as it drops one it has never
 * heard of (001 FR-016).
 */

import { describe, expect, it, vi } from "vitest";
import { handleEvent, subscribeFloor, upsertRailEntry } from "../../src/api/events";
import type { RailEntry, ShowfloorDocument } from "../../src/api/showfloorDocument";
import { entryOf, ladderOf, storyOf } from "./support/showfloor-builder";
import {
  installEventSourceDouble,
  openedSources,
} from "./support/event-source-double";

function documentOf(rail: RailEntry[]): ShowfloorDocument {
  return { reference_instant: null, specs_root: "specs", rail, degraded: [] };
}

const ready = entryOf({
  spec_dir: "006-the-desk-matches-the-stage",
  state: "ready",
  chip: "ready",
  stories_total: 3,
  stories: [storyOf("us1", "The Desk wears the world", ladderOf({ chip: "ready" }))],
});

/** The same spec, one story further along: what a poll would send next. */
const building = entryOf({
  ...ready,
  chip: "building",
  epic_id: "006-the-desk-matches-the-stage",
  stories: [
    storyOf(
      "us1",
      "The Desk wears the world",
      ladderOf({ state: "RUNNING", stopKey: "building", chip: "building" }),
    ),
  ],
});

describe("the showfloor event", () => {
  it("reaches onShowfloor with the rail entry the backend sent", () => {
    const onShowfloor = vi.fn();
    handleEvent(
      JSON.stringify({ type: "showfloor", data: building }),
      vi.fn(),
      undefined,
      onShowfloor,
    );

    expect(onShowfloor).toHaveBeenCalledTimes(1);
    expect(onShowfloor).toHaveBeenCalledWith(building);
  });

  it("is dropped by a subscriber that passes no consumer for it", () => {
    const onFloor = vi.fn();
    const onAttention = vi.fn();
    expect(() =>
      handleEvent(JSON.stringify({ type: "showfloor", data: building }), onFloor, onAttention),
    ).not.toThrow();

    expect(onFloor).toHaveBeenCalledTimes(0);
    expect(onAttention).toHaveBeenCalledTimes(0);
  });

  it("arrives on the one EventSource the room already opened", () => {
    const restore = installEventSourceDouble();
    const onShowfloor = vi.fn();
    const close = subscribeFloor("/api/events", vi.fn(), undefined, onShowfloor);

    expect(openedSources.length).toBe(1);
    openedSources[0].emit("showfloor", building);
    expect(onShowfloor).toHaveBeenCalledWith(building);

    close();
    restore();
  });
});

describe("upsertRailEntry", () => {
  it("replaces the entry with the same spec_dir and moves nothing else", () => {
    const other = entryOf({ spec_dir: "005-one-epic-on-stage", state: "landed", chip: "landed" });
    const next = upsertRailEntry(documentOf([other, ready]), building);

    expect(next.rail.map((entry) => entry.spec_dir)).toEqual([
      "005-one-epic-on-stage",
      "006-the-desk-matches-the-stage",
    ]);
    expect(next.rail[1]).toBe(building);
    expect(next.rail[0]).toBe(other);
  });

  it("appends a spec the document did not carry", () => {
    const next = upsertRailEntry(documentOf([]), building);
    expect(next.rail).toEqual([building]);
  });

  it("returns a new document and leaves the one it was given alone", () => {
    const before = documentOf([ready]);
    const next = upsertRailEntry(before, building);

    expect(next).not.toBe(before);
    expect(before.rail[0]).toBe(ready);
  });
});
