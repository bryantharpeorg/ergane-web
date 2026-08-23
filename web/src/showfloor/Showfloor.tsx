/**
 * The Showfloor route.
 *
 * Fetches the floor document and subscribes to SSE events exactly as the Desk
 * does. Renders one EpicStage per running epic, or the named quiet floor when
 * none run.
 */

import { useEffect, useState } from "react";
import type { FloorDocument } from "../api/floorDocument";
import { subscribeFloor } from "../api/events";
import Masthead from "../Masthead";
import EpicStage from "./EpicStage";

export default function Showfloor(): JSX.Element {
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

  if (isLoading) {
    return (
      <div data-showfloor-root className="showfloor">
        <Masthead trailing={null} />
        <main id="room" className="showfloor-room">
          <p className="quiet">Reading the floor…</p>
        </main>
      </div>
    );
  }

  if (errorStatus !== null) {
    return (
      <div data-showfloor-root className="showfloor">
        <Masthead trailing={null} />
        <main id="room" className="showfloor-room">
          <div className="degraded" data-mode="transport" role="status">
            <p className="lead">The floor could not be read.</p>
            <p>
              The read <span className="read num">GET /api/floor</span> failed
              before the factory answered. Shown as unavailable, not hidden.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!doc) {
    return (
      <div data-showfloor-root className="showfloor">
        <Masthead trailing={null} />
        <main id="room" className="showfloor-room" />
      </div>
    );
  }

  const epics = doc.epics.filter((e) => e.stage);
  const quiet = epics.length === 0;

  return (
    <div data-showfloor-root className="showfloor">
      <Masthead trailing={null} />
      <main id="room" className="showfloor-room">
        {quiet ? (
          <p data-quiet-floor className="quiet">
            Quiet floor: no epics are running.
          </p>
        ) : (
          <div className="epic-stages">
            {epics.map((epic, index) => (
              <EpicStage
                key={`${epic.epic_id}-${index}`}
                stage={epic.stage!}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
