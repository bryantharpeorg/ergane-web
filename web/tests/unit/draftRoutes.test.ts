/**
 * The drafting table's address (014 US1, plan D5).
 *
 * `/draft/<spec-dir>` names one spec, and the browser's whole job is to carry
 * the name across unchanged. What it must **not** do is resolve anything: a
 * segment with slashes in it is handed to the backend as it was typed, and the
 * backend refuses it as a name that is not a directory name. A front end that
 * trimmed it into a hit would turn a refusal into a read of somewhere else.
 */
import { describe, expect, it } from "vitest";
import {
  DRAFT_PATH,
  draftPathFor,
  isDraftPath,
  specDirFromDraftPath,
} from "../../src/routes";

/** A directory name no repository uses. */
const SPEC_DIR = "920-a-constructed-draft";

describe("isDraftPath", () => {
  it("is the room with a spec named and without one", () => {
    expect(isDraftPath(DRAFT_PATH)).toBe(true);
    expect(isDraftPath(`${DRAFT_PATH}/${SPEC_DIR}`)).toBe(true);
  });

  it("is not the other two rooms, nor a room whose name merely starts the same", () => {
    expect(isDraftPath("/")).toBe(false);
    expect(isDraftPath("/desk")).toBe(false);
    expect(isDraftPath("/showfloor")).toBe(false);
    expect(isDraftPath("/drafts")).toBe(false);
  });
});

describe("specDirFromDraftPath", () => {
  it("reads the spec the address names", () => {
    expect(specDirFromDraftPath(`/draft/${SPEC_DIR}`)).toBe(SPEC_DIR);
  });

  it("reads a bare room as naming no spec, with or without its slash", () => {
    expect(specDirFromDraftPath("/draft")).toBeNull();
    expect(specDirFromDraftPath("/draft/")).toBeNull();
  });

  it("reads no spec out of another room's path", () => {
    expect(specDirFromDraftPath(`/showfloor/${SPEC_DIR}`)).toBeNull();
  });

  it("decodes the name the link encoded", () => {
    expect(specDirFromDraftPath(draftPathFor(SPEC_DIR))).toBe(SPEC_DIR);
    expect(specDirFromDraftPath(draftPathFor("a spec with spaces"))).toBe(
      "a spec with spaces",
    );
  });

  it("hands a path across whole rather than trimming it into a hit", () => {
    // The browser never decides what is inside the specs root; the backend
    // refuses this, and it can only refuse what it was actually given.
    expect(specDirFromDraftPath("/draft/nested/spec")).toBe("nested/spec");
    expect(specDirFromDraftPath("/draft/../outside")).toBe("../outside");
  });

  it("shows a malformed escape as it was typed rather than throwing", () => {
    expect(specDirFromDraftPath("/draft/%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("draftPathFor", () => {
  it("escapes a name so a separator in it cannot become one in the URL", () => {
    expect(draftPathFor("nested/spec")).toBe("/draft/nested%2Fspec");
  });
});
