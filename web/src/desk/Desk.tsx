import { useEffect, useState } from "react";
import type { FloorDocument } from "../api/floorDocument";
import { subscribeFloor, upsertAttention } from "../api/events";
import AttentionStrip from "./AttentionStrip";
import EpicRow from "./EpicRow";
import HealthStrip from "./HealthStrip";
import SpendStrip from "./SpendStrip";
import DegradedWell from "./DegradedWell";
import { floorSummary } from "./floorSummary";
import { referenceInstant } from "./timeLeft";

export default function Desk() {
  const [doc, setDoc] = useState<FloorDocument | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | null = null;
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
      close = subscribeFloor("/api/events", setDoc, (item) =>
        setDoc((current) => (current ? upsertAttention(current, item) : current)),
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
      <main id="room" className="desk">
        <p className="loading">Reading the floor…</p>
      </main>
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
      <main id="room" className="desk">
        <div className="degraded" role="status" data-mode="unauthorized" data-section="token">
          <p className="lead">The pane's token was refused.</p>
          <p>Nothing can be read until one is presented.</p>
        </div>
      </main>
    );
  }

  if (errorStatus !== null) {
    return (
      <main id="room" className="desk">
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

  return (
    <main id="room" className="desk">
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
        {summary === "busy" && doc.epics.map((epic) => <EpicRow key={epic.epic_id} epic={epic} />)}
        {epicDegraded.map((entry, index) => (
          <DegradedWell key={index} entry={entry} />
        ))}
      </section>
      <div className="lower">
        {healthDegraded ? <DegradedWell entry={healthDegraded} /> : <HealthStrip doc={doc} />}
        {spendDegraded ? <DegradedWell entry={spendDegraded} /> : <SpendStrip doc={doc} />}
      </div>
    </main>
  );
}
