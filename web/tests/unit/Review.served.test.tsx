/**
 * The served revision, rendered (011 US2: FR-009, FR-010; US2-S3, US2-S4).
 *
 * The document shapes below are the ones `pane/review.py`'s `_served` emits,
 * field for field, and asserted against the assembler itself by
 * `tests/test_review_served_revision.py` over a real pair of revisions — a
 * repository whose branch carries four landings and whose checkout is behind it.
 * What is proved here is the other half: that the room states what the document
 * carries, in the place `DESIGN.md` § The review room puts it, and states the
 * mismatch where the operator cannot miss it.
 *
 * **Three answers, three sentences.** `contains_epic` is `true`, `false` or
 * `null`, and none of the three may be rendered as another. A `null` shown as a
 * mismatch sends the operator after a deployment that is fine. A mismatch shown
 * as a `null` — or worse, not shown — lets them review the wrong screens in
 * silence and take notes about them, which is the one failure this room could
 * have that its own output would then carry forward into a spec.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

import Review from "../../src/review/Review";
import type {
  ReviewDocument,
  ReviewStory,
  ServedRevision,
} from "../../src/api/reviewDocument";

const SPEC = "912-a-landed-epic";
const REVISION = "9c1d4e7a2b5f8c3d6e9a0b1c2d3e4f5a6b7c8d9e";

const containers: HTMLElement[] = [];

function mount(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

function story(): ReviewStory {
  return {
    story_key: "US4",
    title: "The last story of the epic",
    priority: "P4",
    commit: "4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0",
    short_commit: "4d3c2b1a0f9e",
    pr_number: 44,
    subject: `${SPEC}/us4: US4 (#44)`,
    merged_at: "2026-08-25T15:36:32Z",
    kind: "observed",
    files: [{ path: "web/src/desk/Desk.tsx", routes: ["/", "/desk"], matched: true }],
    routes: ["/", "/desk"],
    unknown: [],
    notes: [],
  };
}

function served(overrides: Partial<ServedRevision> = {}): ServedRevision {
  return {
    revision: REVISION,
    short_revision: REVISION.slice(0, 12),
    dirty: false,
    contains_epic: true,
    missing: [],
    unplaced: [],
    notes: [],
    ...overrides,
  };
}

function review(overrides: Partial<ServedRevision> = {}): ReviewDocument {
  return {
    spec_dir: SPEC,
    name: "A landed epic",
    landing_branch: "dev",
    story_source: "workgraph",
    stories: [story()],
    routes: [{ path: "/desk", kind: "room", name: "The Desk", stories: ["US4"] }],
    served: served(overrides),
    notes: [],
  };
}

/** The room at `/review/<spec-dir>`, answered by a stubbed read. */
async function open(document_: ReviewDocument): Promise<HTMLElement> {
  window.history.pushState({}, "", `/review/${SPEC}`);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => document_,
  })) as unknown as typeof fetch;
  const container = mount(<Review />);
  await act(async () => {});
  return container;
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
});

describe("the view names the revision the service is serving (US2-S3, FR-009)", () => {
  it("puts the revision at the top of the room, above the epic's own heading", async () => {
    const container = await open(review());
    const room = container.querySelector("#room")!;
    const stamp = room.querySelector("[data-served]")!;

    expect(stamp).not.toBeNull();
    // § The review room: "a header, not a footnote … at the top of the view".
    expect(room.firstElementChild).toBe(stamp);
    expect(stamp.textContent).toContain("9c1d4e7a2b5f");
    // The whole revision is on the element, so nothing is lost to the cut.
    expect(stamp.getAttribute("data-revision")).toBe(REVISION);
  });

  it("says plainly that the revision contains the epic under review", async () => {
    const container = await open(review());
    const stamp = container.querySelector("[data-served]")!;

    expect(stamp.getAttribute("data-contains")).toBe("yes");
    expect(stamp.querySelector("[data-state='holds']")!.textContent).toContain(SPEC);
    expect(container.querySelector("[data-mismatch]")).toBeNull();
  });

  it("names an unreadable revision as unknown rather than falling silent", async () => {
    const container = await open(
      review({ revision: null, short_revision: null, dirty: null, contains_epic: null }),
    );
    const stamp = container.querySelector("[data-served]")!;

    expect(stamp).not.toBeNull();
    expect(stamp.querySelector("[data-unknown='revision']")).not.toBeNull();
    expect(stamp.getAttribute("data-contains")).toBe("unknown");
    // Unknown is never a mismatch: the operator is not sent after a deployment
    // that may be perfectly correct.
    expect(container.querySelector("[data-mismatch]")).toBeNull();
  });

  it("says a checkout with uncommitted changes is not that revision", async () => {
    const container = await open(review({ dirty: true }));
    expect(container.querySelector("[data-dirty]")).not.toBeNull();
  });

  it("says containment could not be established when nothing could be placed", async () => {
    const container = await open(review({ contains_epic: null, unplaced: ["US4"] }));
    const stamp = container.querySelector("[data-served]")!;

    expect(stamp.getAttribute("data-contains")).toBe("unknown");
    expect(stamp.querySelector("[data-state='unknown']")!.textContent).toContain(
      "could not be established",
    );
  });
});

describe("a revision that lacks the epic is stated unmissably (US2-S4, FR-010)", () => {
  const lacking = () =>
    review({
      contains_epic: false,
      missing: [
        {
          story_key: "US4",
          commit: "4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0",
          short_commit: "4d3c2b1a0f9e",
        },
      ],
    });

  it("takes a band above the frame, not a chip and not a tooltip", async () => {
    const container = await open(lacking());
    const band = container.querySelector("[data-mismatch]");

    expect(band, "no mismatch band was rendered").not.toBeNull();
    // It is announced, and it is above the frame in the room's own order — the
    // operator meets it before they meet the thing it invalidates.
    expect(band!.getAttribute("role")).toBe("alert");
    const frame = container.querySelector("iframe.rv-render")!;
    expect(
      band!.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("names the landings the revision does not carry, by story and by SHA", async () => {
    const container = await open(lacking());
    const band = container.querySelector("[data-mismatch]")!;

    const entry = band.querySelector("[data-missing='US4']")!;
    expect(entry).not.toBeNull();
    expect(entry.textContent).toContain("4d3c2b1a0f9e");
    expect(band.textContent).toContain("9c1d4e7a2b5f");
  });

  it("says in words what the operator is actually looking at", async () => {
    const container = await open(lacking());
    const band = container.querySelector("[data-mismatch]")!;

    expect(band.textContent).toContain(`You are not looking at ${SPEC}`);
    expect(band.textContent).toContain("about the tree this process is running");
  });

  it("agrees with the header, which says the same thing in its own words", async () => {
    const container = await open(lacking());
    const stamp = container.querySelector("[data-served]")!;

    expect(stamp.getAttribute("data-contains")).toBe("no");
    expect(stamp.querySelector("[data-state='lacks']")!.textContent).toContain(
      "does not contain",
    );
  });
});
