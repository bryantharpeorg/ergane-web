/// <reference types="vite/client" />
/**
 * The room half of FR-005 (011 US1, plan D3).
 *
 * `tests/test_route_manifest.py` asserts that every **API** route the FastAPI
 * application registers appears in `route-manifest.json`, read off the app
 * object. It cannot make the same claim about the rooms: the pane's rooms are
 * all served by one guarded catch-all, so there is nothing on the Python side
 * to enumerate them from. `web/src/routes.ts` is where they are declared, and
 * this is the half that reads them off it.
 *
 * Together the two halves cover every route the pane serves, which is the whole
 * of FR-005 — a manifest that can rot in silence is worth nothing, and the room
 * built on it would be confidently wrong about which screens a change reaches.
 *
 * The paths are read from the module rather than listed here on purpose: a
 * fourth room added to `routes.ts` and not to the manifest turns this red, and
 * a list typed into this file would not.
 */
import { describe, expect, it } from "vitest";
import manifestJson from "../../../route-manifest.json?raw";
import * as routes from "../../src/routes";

interface ManifestRoute {
  path: string;
  kind: string;
  name: string;
}

interface ManifestPattern {
  pattern: string;
  routes: string[];
}

const manifest = JSON.parse(manifestJson) as {
  routes: ManifestRoute[];
  patterns: ManifestPattern[];
};

/** Every path `routes.ts` exports as a constant — the rooms, read off the module. */
function exportedPaths(): string[] {
  return Object.entries(routes)
    .filter(([, value]) => typeof value === "string" && (value as string).startsWith("/"))
    .map(([, value]) => value as string);
}

describe("the route manifest names every room the pane serves (FR-005)", () => {
  it("reads a manifest that is really there", () => {
    expect(manifest.routes.length).toBeGreaterThan(5);
    expect(manifest.patterns.length).toBeGreaterThan(5);
  });

  it("sweeps room paths that are really exported", () => {
    // A sweep over nothing passes vacuously — 001 US1-S1's defect.
    expect(exportedPaths()).toContain("/review");
    expect(exportedPaths().length).toBeGreaterThan(3);
  });

  it("lists every path web/src/routes.ts exports", () => {
    const listed = new Set(manifest.routes.map((route) => route.path));
    for (const path of exportedPaths()) {
      expect(listed.has(path), `route-manifest.json does not name ${path}`).toBe(true);
    }
  });

  it("marks the operator-facing paths as rooms, so US2 knows what it may frame", () => {
    const kinds = new Map(manifest.routes.map((route) => [route.path, route.kind]));
    for (const path of exportedPaths()) {
      expect(kinds.get(path), `${path} is not declared a room`).toBe("room");
    }
  });

  it("names where the review room's own sources can be seen", () => {
    const patterns = new Map(manifest.patterns.map((entry) => [entry.pattern, entry.routes]));
    expect(patterns.get("web/src/review/**")).toEqual(["/review"]);
    expect(patterns.get("web/src/api/reviewDocument.ts")).toEqual(["/review"]);
  });

  it("names no route in a pattern that it does not declare", () => {
    const declared = new Set(manifest.routes.map((route) => route.path));
    for (const entry of manifest.patterns) {
      for (const path of entry.routes) {
        expect(declared.has(path), `pattern ${entry.pattern} names ${path}`).toBe(true);
      }
    }
  });
});
