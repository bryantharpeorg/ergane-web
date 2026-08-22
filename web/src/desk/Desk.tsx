import { useEffect, useState } from "react";
import type { FloorDocument } from "../api/floorDocument";
import { subscribeFloor } from "../api/events";
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
      close = subscribeFloor("/api/events", setDoc);
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
