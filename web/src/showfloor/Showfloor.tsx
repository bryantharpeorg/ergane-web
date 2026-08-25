/**
 * The Showfloor: the second world's frame, and the selection that is its unit.
 *
 * `DESIGN.md` § Layout is the authority for the shape — a full-bleed surface
 * card capped at `96rem` and centred, an appbar of brand, room nav and the
 * attention badge, and a `17rem` rail · `1fr` stage · `26rem` detail grid that
 * folds at 1180px and again at 820px. § Epic rail owns the rail, which lives in
 * `Rail.tsx`.
 *
 * This story (005 US2) rebuilds the frame and the selection. The first world's
 * room — one full stage per running epic, stacked, each with its own landing
 * rail and its own copy of the legend — is what D-015 replaced: the unit is now
 * the *selection*, one epic on stage at a time, so this component no longer
 * mounts `EpicStage` per epic and the room reads one document instead of a
 * floor's worth. The stage's own graph, its metrics and the detail pane are
 * US3's and US4's; what the stage column carries here is the selected spec's
 * head — the identity every later region hangs off — and the reads that failed
 * for it.
 *
 * Two documents, both bare GETs: `/api/showfloor` (005 US1) is the room, and
 * `/api/floor` is where the attention count comes from, on the same SSE stream
 * 001 wired so the badge stays live without a second EventSource.
 */

import { useEffect, useState } from "react";
import type { DegradedEntry, FloorDocument } from "../api/floorDocument";
import type { RailEntry, ShowfloorDocument } from "../api/showfloorDocument";
import { subscribeFloor } from "../api/events";
import Masthead from "../Masthead";
import AttentionBadge from "./AttentionBadge";
import Rail from "./Rail";
import { chipText, railChip, specId } from "./ladder";
import { specDirFromPath } from "../routes";

/** What the room selected, and the directory it was asked for and could not find. */
export interface Selection {
  entry: RailEntry | null;
  miss: string | null;
}

/**
 * Whether the factory is working this spec — DESIGN.md's "the epic that is
 * building".
 *
 * Two conditions, and both are the document's own words rather than a
 * re-derivation of them: an epic answered for this spec at all (`epic_id`, which
 * US1 sets only when one did), and some story of it holds a live state that has
 * neither frozen nor reached `merged`.
 *
 * A frozen ladder does not qualify on its own, so an epic whose every story is
 * terminal is not building — it is over, and its rail row says `killed` in the
 * alarm chip. A killed story *beside* a running one changes nothing: that epic
 * is still the one on the floor, and it is the one an operator opening
 * `/showfloor` needs to see.
 */
export function isBuilding(entry: RailEntry): boolean {
  if (entry.epic_id === null) return false;
  return entry.stories.some(
    (story) =>
      story.ladder.state !== null &&
      !story.ladder.frozen &&
      story.ladder.stop_key !== "merged",
  );
}

/**
 * § Epic rail: "the default selection is the epic that is building, else the
 * newest landed".
 *
 * Newest is last in directory order, which is the order the document is in and
 * the order the numbering runs. Where neither exists — a corpus of drafts — the
 * first row is selected rather than none: the room is a master–detail, and a
 * master with nothing detailed is a room that has stopped working.
 */
export function defaultSelection(rail: RailEntry[]): RailEntry | null {
  const building = rail.filter(isBuilding);
  if (building.length > 0) return building[building.length - 1];

  const landed = rail.filter((entry) => entry.state === "landed");
  if (landed.length > 0) return landed[landed.length - 1];

  return rail.length > 0 ? rail[0] : null;
}

/**
 * The selection a path asks for (FR-009).
 *
 * `/showfloor/<spec-dir>` selects that spec. A directory this floor does not
 * have falls back to the default **and keeps the miss**, which the room names
 * in place: a URL that quietly showed something else would be the pane telling
 * the operator they are looking at what they asked for when they are not
 * (constitution III). A bare `/showfloor` asks for the default and misses
 * nothing.
 */
export function selectFromPath(rail: RailEntry[], pathname: string): Selection {
  const requested = specDirFromPath(pathname);
  if (requested === null) return { entry: defaultSelection(rail), miss: null };

  const found = rail.find((entry) => entry.spec_dir === requested);
  if (found !== undefined) return { entry: found, miss: null };

  return { entry: defaultSelection(rail), miss: requested };
}

/** The attention read named as unmade when the floor document did not arrive. */
const FLOOR_UNREAD: DegradedEntry = {
  section: "attention",
  mode: "transport",
  epic_id: null,
  read: "GET /api/floor",
  detail: "the read did not complete from this room",
};

/** The stage head's chip: the same object the rail row wears (plan D2). */
function StageChip({ entry }: { entry: RailEntry }): JSX.Element {
  const chip = railChip(entry);
  return (
    <span className={`chip ${chip.tone}`} data-stage-chip data-chip-tone={chip.tone}>
      {chipText(chip)}
    </span>
  );
}

interface FrameProps {
  badge: JSX.Element | null;
  children: JSX.Element | JSX.Element[];
}

/** § Layout's app frame: the appbar, then the room, inside one capped card. */
function Frame({ badge, children }: FrameProps): JSX.Element {
  return (
    <div data-showfloor-root className="showfloor">
      <div className="sf-frame" data-showfloor-frame>
        <Masthead trailing={badge} />
        {children}
      </div>
    </div>
  );
}

export default function Showfloor(): JSX.Element {
  const [doc, setDoc] = useState<ShowfloorDocument | null>(null);
  const [floor, setFloor] = useState<FloorDocument | null>(null);
  const [floorUnread, setFloorUnread] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | null = null;

    const readRoom = fetch("/api/showfloor")
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) setErrorStatus(response.status);
          return;
        }
        const initial = (await response.json()) as ShowfloorDocument;
        if (!cancelled) setDoc(initial);
      })
      .catch(() => {
        if (!cancelled) setErrorStatus(0);
      });

    // The badge's count, from the document 001 already serves. A floor that
    // cannot be read costs the count, not the room.
    const readFloor = fetch("/api/floor")
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) setFloorUnread(true);
          return;
        }
        const initial = (await response.json()) as FloorDocument;
        if (!cancelled) setFloor(initial);
      })
      .catch(() => {
        if (!cancelled) setFloorUnread(true);
      });

    void Promise.all([readRoom, readFloor]).then(() => {
      if (!cancelled) setIsLoading(false);
    });

    if (typeof EventSource !== "undefined") {
      close = subscribeFloor("/api/events", setFloor);
    }

    return () => {
      cancelled = true;
      if (close) close();
    };
  }, []);

  const badge =
    floor !== null ? (
      <AttentionBadge attention={floor.attention} degraded={floor.degraded} />
    ) : floorUnread ? (
      <AttentionBadge
        attention={{ seam: "attention", items: [] }}
        degraded={[FLOOR_UNREAD]}
      />
    ) : null;

  if (isLoading) {
    return (
      <Frame badge={null}>
        <main id="room" className="cols">
          <p className="quiet">Reading the floor…</p>
        </main>
      </Frame>
    );
  }

  if (errorStatus !== null || doc === null) {
    return (
      <Frame badge={badge}>
        <main id="room" className="cols">
          <div className="degraded" data-mode="transport" role="status">
            <p className="lead">The floor could not be read.</p>
            <p>
              The read <span className="read num">GET /api/showfloor</span>{" "}
              failed before the factory answered. Shown as unavailable, not
              hidden.
            </p>
          </div>
        </main>
      </Frame>
    );
  }

  // A document that arrived without a rail is not a floor with no specs, but
  // it is not a crash either: the room renders empty and the stage says so.
  const rail = Array.isArray(doc.rail) ? doc.rail : [];
  const { entry, miss } = selectFromPath(rail, window.location.pathname);

  return (
    <Frame badge={badge}>
      <main id="room" className="cols" data-showfloor-cols>
        <Rail entries={rail} selected={entry === null ? null : entry.spec_dir} />
        <section
          className="stage"
          data-stage
          data-spec-dir={entry === null ? undefined : entry.spec_dir}
        >
          {miss === null ? null : (
            <p className="stage-miss" data-selection-miss role="status">
              No spec directory <span className="num">{miss}</span> is on this
              floor.
              {entry === null
                ? " Nothing is selected."
                : " Showing "}
              {entry === null ? null : (
                <span className="num">{entry.spec_dir}</span>
              )}
              {entry === null ? null : " instead."}
            </p>
          )}
          {entry === null ? (
            <p className="quiet" data-empty-floor>
              No spec was read from the corpus, so there is nothing to stage.
            </p>
          ) : (
            <>
              <header className="stage-head">
                <span className="spec-id" data-stage-id>
                  {specId(entry.spec_dir)}
                </span>
                <span className="spec-name" data-stage-name>
                  {entry.name}
                </span>
                <StageChip entry={entry} />
              </header>
              {entry.notes.map((note, index) => (
                <div
                  className="degraded"
                  data-stage-note
                  data-mode={note.mode}
                  key={`${note.read}-${index}`}
                  role="status"
                >
                  <p className="lead">A read for this spec degraded.</p>
                  <p>
                    <span className="read num">{note.read}</span>{" "}
                    <span className="mode">{note.mode}</span>{" "}
                    <span className="detail">{note.detail}</span>
                  </p>
                </div>
              ))}
            </>
          )}
        </section>
        <aside className="detail" data-detail>
          <p className="detail-empty">No story is selected.</p>
        </aside>
      </main>
    </Frame>
  );
}
