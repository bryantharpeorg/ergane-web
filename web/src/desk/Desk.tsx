import { ReactNode, useEffect, useState } from "react";
import type { FloorDocument } from "../api/floorDocument";
import type { ShowfloorDocument } from "../api/showfloorDocument";
import { subscribeFloor, upsertAttention, upsertRailEntry } from "../api/events";
import Masthead from "../Masthead";
import AttentionStrip from "./AttentionStrip";
import EpicRow from "./EpicRow";
import HealthStrip from "./HealthStrip";
import SpendStrip from "./SpendStrip";
import DegradedWell from "./DegradedWell";
import { floorSummary } from "./floorSummary";
import { referenceInstant } from "./timeLeft";

/**
 * DESIGN.md § Layout's app frame, worn by the Desk exactly as the Showfloor
 * wears it (006 US1, FR-001): "full-bleed surface card, `max-width: 96rem`,
 * centred; never a hard content cap below 96rem", with the appbar as its first
 * row rather than a band floating above it.
 *
 * The cap lives on this element and on nothing inside it. That is the whole of
 * the fluidity: the first world put `max-width: 1280px` on the Desk itself, and
 * every width past it went to margin — the 1216px content and 672px of dead
 * ground per side at 2560 that the 2026-08-24 review measured. The cap is now
 * the frame's `96rem`, which is the Showfloor's, so the Desk reads 1486px wide
 * at 1600 and at 2560 alike (`desk-world.spec.ts` measures all three widths).
 */
function Frame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="desk-room" data-desk-root>
      <div className="desk-frame" data-desk-frame>
        <Masthead />
        {children}
      </div>
    </div>
  );
}

export default function Desk() {
  const [doc, setDoc] = useState<FloorDocument | null>(null);
  // The floor section's ladders and chips, from the document the Showfloor
  // renders (006 US2, T005). It is read beside `/api/floor` and never instead
  // of it: the Desk's readiness is the floor's, so a slow or refused showfloor
  // read costs the ladders and not the room (constitution III). Until it
  // arrives there is no ladder to draw, and `EpicRow` says exactly that rather
  // than deriving one (FR-005).
  const [showfloor, setShowfloor] = useState<ShowfloorDocument | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | null = null;
    fetch("/api/showfloor")
      .then(async (response) => {
        if (!response.ok) return;
        const initial = (await response.json()) as ShowfloorDocument;
        // A body that is not a showfloor document is not a rail of one entry:
        // it is a read that answered something else, and the ladders stay
        // unread.
        if (!cancelled && Array.isArray(initial?.rail)) setShowfloor(initial);
      })
      .catch(() => undefined);
    fetch("/api/floor")
      .then(async (response) => {
        if (!response.ok) {
          setErrorStatus(response.status);
          return;
        }
        const initial = (await response.json()) as FloorDocument;
        if (!cancelled) setDoc(initial);
      })
      .catch(() => setErrorStatus(0))
      .finally(() => setIsLoading(false));
    if (typeof EventSource !== "undefined") {
      // An `attention` event is the fast path: it upserts into the list the
      // Desk already holds. The next `floor` event replaces the whole section,
      // so the stream can never drift away from the backend's own assembly.
      // Three types on one subscription: `floor` replaces the document,
      // `attention` upserts an item into it, and `showfloor` upserts the one
      // rail entry the backend re-assembled (005 FR-005). The Desk opens no
      // stream of its own for the third.
      close = subscribeFloor(
        "/api/events",
        setDoc,
        (item) => setDoc((current) => (current ? upsertAttention(current, item) : current)),
        (entry) =>
          setShowfloor((current) => (current ? upsertRailEntry(current, entry) : current)),
      );
    }
    return () => {
      cancelled = true;
      if (close) close();
    };
  }, []);

  useEffect(() => {
    const floorline = document.querySelector(".mast .floorline");
    if (!floorline) return;
    if (isLoading) {
      floorline.innerHTML = "<em>Reading the floor…</em>";
    } else if (errorStatus !== null) {
      floorline.innerHTML = `<span class="live"></span> <span class="num">${errorStatus || "—"}</span> · read failed`;
    } else if (doc) {
      const data = doc.floor.data as { epics?: unknown[] } | null;
      const running = Array.isArray(data?.epics) ? data.epics.length : 0;
      const instant = doc.reference_instant
        ? `${doc.reference_instant}Z`
        : new Date().toISOString();
      floorline.innerHTML = `<span class="live"></span> <span class="num">${running}</span> running · read at <span class="num">${instant}</span>`;
    }
  }, [doc, errorStatus, isLoading]);

  if (isLoading) {
    return (
      <Frame>
        <main id="room" className="desk" data-desk-content>
          <p className="loading">Reading the floor…</p>
        </main>
      </Frame>
    );
  }

  // Spec 003 US4 (T058): a refused token is not an unreachable floor, and the
  // two do not read alike. It sits in the same moss-grey well as every other
  // honest degradation — DESIGN.md § Elevation & Depth › The Well Rule, a bold
  // Display lead-in and no hue at all (§ Colors › The No-Red Rule) — and says in
  // words what happened and what would fix it. The browser carries the token
  // itself, through the challenge `require_viewer` advertises, so no file under
  // `web/src/` reads, stores, or renders one (FR-014, FR-017).
  //
  // `GET /api/floor` is the status this reads: it is the Desk's first request,
  // and the attention list rides the same document. An `EventSource` reports no
  // HTTP status to its `error` handler at all, so a refused stream is shown
  // through the refused read beside it rather than through a status the browser
  // never hands us (constitution III: no claim the pane cannot observe).
  if (errorStatus === 401) {
    return (
      <Frame>
        <main id="room" className="desk" data-desk-content>
          <div className="degraded" role="status" data-mode="unauthorized" data-section="token">
            <p className="lead">The pane's token was refused.</p>
            <p>Nothing can be read until one is presented.</p>
          </div>
        </main>
      </Frame>
    );
  }

  if (errorStatus !== null) {
    return (
      <Frame>
        <main id="room" className="desk" data-desk-content>
          <DegradedWell
            entry={{
              section: "floor",
              mode: "transport",
              epic_id: null,
              read: "GET /api/floor",
              detail: `HTTP ${errorStatus || "network error"}: the floor could not be read`,
            }}
          />
        </main>
      </Frame>
    );
  }

  if (!doc) return null;

  const summary = floorSummary(doc);
  const floorDegraded = doc.degraded.find((d) => d.section === "floor");
  const epicDegraded = doc.degraded.filter((d) => d.section === "epics");
  const healthDegraded = doc.degraded.find((d) => d.section === "health");
  const spendDegraded = doc.degraded.find((d) => d.section === "spend_to_date");

  const floorData = doc.floor.data as {
    epics?: unknown[];
    queue?: unknown[];
    drafts?: unknown[];
  } | null;
  const epicCount = Array.isArray(floorData?.epics) ? floorData.epics.length : 0;
  const queueCount = Array.isArray(floorData?.queue) ? floorData.queue.length : 0;
  const draftCount = Array.isArray(floorData?.drafts) ? floorData.drafts.length : 0;
  const queueWord = queueCount === 0 ? "empty" : String(queueCount);

  // The section order is 001's and is unchanged by the change of clothes:
  // attention first in the DOM, then the floor, then health beside spend
  // (FR-001, and the order `desk.spec.ts` and `Desk.test.tsx` both assert).
  return (
    <Frame>
      <main id="room" className="desk" data-desk-content>
        <AttentionStrip doc={doc} />
        <section className="floor" aria-labelledby="fl">
          <div className="floor-head">
            <h2 id="fl">The floor</h2>
            <span className="summary num">
              {epicCount} running · queue {queueWord} · {draftCount} drafts
            </span>
          </div>
          {summary === "unreachable" && floorDegraded && <DegradedWell entry={floorDegraded} />}
          {summary === "quiet" && (
            <p className="quiet">Quiet floor: nothing is running and nothing is waiting on you.</p>
          )}
          {summary === "busy" &&
            doc.epics.map((epic, index) => (
              <EpicRow key={`${epic.epic_id}-${index}`} epic={epic} showfloor={showfloor} />
            ))}
          {epicDegraded.map((entry, index) => (
            <DegradedWell key={index} entry={entry} />
          ))}
        </section>
        <div className="lower">
          {healthDegraded ? <DegradedWell entry={healthDegraded} /> : <HealthStrip doc={doc} />}
          {spendDegraded ? <DegradedWell entry={spendDegraded} /> : <SpendStrip doc={doc} />}
        </div>
      </main>
    </Frame>
  );
}
