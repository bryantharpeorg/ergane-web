/**
 * The served-revision header and the mismatch band, rendered (011 US2).
 *
 * FR-009 says the room names the revision the service is serving and whether
 * that revision contains the epic under review; FR-010 says a revision that does
 * not is stated where the operator cannot miss it. Both are about what reaches
 * the screen, which is what this file asserts — `tests/test_served_revision.py`
 * asserts the three answers the backend composes.
 *
 * **The case that matters most is the third one.** `contains_epic` is `true`,
 * `false` or `null`, and `null` must not raise FR-010's band: a checkout with no
 * history cannot place a commit, and an alarm spent on a read nobody made is an
 * alarm nobody believes the once it is real.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { RevisionMismatch, ServedHeader } from "../../src/review/ServedRevision";
import type { ServedRevision } from "../../src/api/reviewDocument";

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

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

function served(overrides: Partial<ServedRevision> = {}): ServedRevision {
  return {
    revision: "9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d",
    short_revision: "9c1d2e3f4a5b",
    branch: "dev",
    committed_at: "2026-08-25T19:12:04Z",
    subject: "011-the-work-comes-back-for-review/us1: US1 (#77)",
    contains_epic: true,
    missing: [],
    unknown: [],
    notes: [],
    ...overrides,
  };
}

describe("the header names the revision the service is serving (FR-009)", () => {
  it("renders the revision, the branch and the subject as facts, not a tick", () => {
    const container = mount(<ServedHeader served={served()} />);

    const header = container.querySelector("[data-served]") as HTMLElement;
    expect(header).not.toBeNull();
    // Whole on the element, cut for the reader — one SHA, one cut, made
    // server-side so two renderings cannot disagree about its length.
    expect(header.querySelector("[data-served-revision]")?.getAttribute("data-served-revision"))
      .toBe("9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d");
    expect(header.querySelector("[data-served-revision]")?.textContent).toBe("9c1d2e3f4a5b");
    expect(header.textContent).toContain("dev");
    expect(header.textContent).toContain("011-the-work-comes-back-for-review/us1");
  });

  it("says in words that the revision contains the epic", () => {
    const container = mount(<ServedHeader served={served()} />);
    const contains = container.querySelector("[data-contains]") as HTMLElement;

    expect(contains.getAttribute("data-contains")).toBe("yes");
    expect(contains.textContent).toContain("contains this epic");
  });

  it("says in words, and with the count, that it does not", () => {
    const container = mount(
      <ServedHeader
        served={served({
          contains_epic: false,
          missing: [
            { story_key: "US2", title: "The thing itself renders beside its numbers" },
            { story_key: "US3", title: "A note carries its coordinates" },
          ],
        })}
      />,
    );
    const contains = container.querySelector("[data-contains]") as HTMLElement;

    expect(contains.getAttribute("data-contains")).toBe("no");
    expect(contains.textContent).toContain("not");
    expect(contains.textContent).toContain("2");
  });

  it("renders an unknown as unknown, never as a mismatch", () => {
    const container = mount(<ServedHeader served={served({ contains_epic: null })} />);
    const contains = container.querySelector("[data-contains]") as HTMLElement;

    expect(contains.getAttribute("data-contains")).toBe("unknown");
    expect(contains.textContent).toContain("unknown");
  });

  it("names a revision the checkout could not supply rather than defaulting it", () => {
    const container = mount(
      <ServedHeader
        served={served({
          revision: null,
          short_revision: null,
          branch: null,
          committed_at: null,
          subject: null,
          contains_epic: null,
          unknown: ["revision", "branch", "committed_at", "subject"],
          notes: [
            { read: "served_revision", mode: "transport", detail: "git could not be run" },
          ],
        })}
      />,
    );

    // The Unknown Rule, in words: never a zero, never a dash, and never the
    // previous render's revision left on the screen.
    expect(container.querySelector("[data-unknown='revision']")).not.toBeNull();
    expect(container.textContent).toContain("revision unknown");
    // And the read that failed is named (constitution III).
    expect(container.querySelector("[data-mode='transport']")?.textContent).toContain(
      "served_revision",
    );
  });
});

describe("a mismatch is stated where the operator cannot miss it (FR-010)", () => {
  const mismatched = served({
    contains_epic: false,
    missing: [
      { story_key: "US2", title: "The thing itself renders beside its numbers" },
      { story_key: "US3", title: "A note carries its coordinates" },
    ],
  });

  it("renders a full-width band naming every story the revision does not carry", () => {
    const container = mount(
      <RevisionMismatch served={mismatched} specName="The work comes back for review" />,
    );

    const band = container.querySelector("[data-mismatch]") as HTMLElement;
    expect(band).not.toBeNull();
    // An alert and not a status: this is the one thing in the room that must
    // interrupt a reader who has already started reading.
    expect(band.getAttribute("role")).toBe("alert");
    expect(band.querySelector("[data-missing='US2']")).not.toBeNull();
    expect(band.querySelector("[data-missing='US3']")).not.toBeNull();
    expect(band.textContent).toContain("The thing itself renders beside its numbers");
    // The revision, so the operator knows what they are looking at instead.
    expect(band.textContent).toContain("9c1d2e3f4a5b");
    expect(band.textContent).toContain("The work comes back for review");
  });

  it("renders nothing at all when the revision contains the epic", () => {
    const container = mount(
      <RevisionMismatch served={served()} specName="The work comes back for review" />,
    );
    expect(container.querySelector("[data-mismatch]")).toBeNull();
  });

  it("renders nothing at all when the question could not be asked", () => {
    // The one that would wreck the band's meaning. A `null` is an unknown in the
    // header above; raising the alarm over it would train the operator to
    // ignore it.
    const container = mount(
      <RevisionMismatch
        served={served({ contains_epic: null })}
        specName="The work comes back for review"
      />,
    );
    expect(container.querySelector("[data-mismatch]")).toBeNull();
  });
});
