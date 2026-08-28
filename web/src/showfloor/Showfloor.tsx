/**
 * The Showfloor: the second world's frame, and the selection that is its unit.
 *
 * `DESIGN.md` § Layout is the authority for the shape — a full-bleed surface
 * card capped at `96rem` and centred, an appbar of brand, room nav and the
 * attention badge, and a `17rem` rail · `1fr` stage · `26rem` detail grid that
 * folds at 1180px and again at 820px. § Epic rail owns the rail, which lives in
 * `Rail.tsx`.
 *
 * 005 US2 rebuilt the frame and the selection. The first world's room — one
 * full stage per running epic, stacked, each with its own landing rail and its
 * own copy of the legend — is what D-015 replaced: the unit is now the
 * *selection*, one epic on stage at a time, so this component no longer mounts
 * `EpicStage` per epic and the room reads one document instead of a floor's
 * worth.
 *
 * 005 US3 fills the stage column: the selected spec's head, metrics, graph and
 * degraded notices all move into `Stage.tsx`, and the edge legend is mounted
 * *here* — once, from the component the room has exactly one of, which is the
 * whole fix for the first world's legend-per-epic repetition (FR-012).
 *
 * 005 US4 gives the room its reading surface. Selection of a *story* is state
 * this component holds — the rail's selection is a URL because a spec is a
 * place, but a story is a reading of the spec that is already open, and a
 * second path segment would make the back button walk a reader's every glance.
 * `DetailPane` renders what the selection says; the cards report it with
 * `aria-pressed`.
 *
 * Two documents, both bare GETs: `/api/showfloor` (005 US1) is the room, and
 * `/api/floor` carries the attention count and the two facts only
 * `collect_floor` records — this epic's pace and the usage rollup the stage's
 * last two metric cells read — on the same SSE stream 001 wired, so both stay
 * live without a second EventSource.
 */

import { useEffect, useState } from "react";
import type { DegradedEntry, FloorDocument } from "../api/floorDocument";
import type { RailEntry, ShowfloorDocument, ShowfloorStory } from "../api/showfloorDocument";
import { subscribeFloor } from "../api/events";
import Masthead from "../Masthead";
import AttentionBadge from "./AttentionBadge";
import DetailPane, { RoomExplanation } from "./DetailPane";
import Legend from "./Legend";
import Rail from "./Rail";
import Stage, { SpecGoal } from "./Stage";
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
  return entry.stories.some(isStoryLive);
}

/**
 * The story half of the sentence above: an epic answered for this story, and
 * the answer has neither frozen nor reached `merged`.
 *
 * Factored out rather than written twice because `isBuilding` *is* this
 * predicate over an epic's stories, and two spellings of one rule are how the
 * rail and the pane come to disagree about which epic is working.
 */
export function isStoryLive(story: ShowfloorStory): boolean {
  return (
    story.ladder.state !== null &&
    !story.ladder.frozen &&
    story.ladder.stop_key !== "merged"
  );
}

/** The identity a selection is carried by — the document's own, never an index. */
export function storyIdOf(story: ShowfloorStory): string | null {
  return story.id ?? story.story_key;
}

/**
 * § Epic rail: "the default selection is the epic that is building, else the
 * newest landed".
 *
 * Newest is last in directory order, which is the order the document is in and
 * the order the numbering runs. Where neither exists — a corpus of drafts — the
 * first row is selected rather than none: the room is a master–detail, and a
 * master with nothing detailed is a room that has stopped working.
 *
 * **Landed is the chip, not the frontmatter.** `entry.state` is the spec's own
 * attestation, and 009's whole doctrine is that an attestation is a claim while
 * a landing is a fact: the assembler layers the landing branch over the claim
 * and `entry.chip` is what comes out. Reading `state` here made the room
 * disagree with itself — the rail drew `landed 4/4` for an epic whose every
 * story the branch carries, and the default selection stepped over it because
 * nobody had edited the frontmatter yet. That is the epic an operator most
 * wants staged, and it is the one the rail already says has landed.
 */
export function defaultSelection(rail: RailEntry[]): RailEntry | null {
  const building = rail.filter(isBuilding);
  if (building.length > 0) return building[building.length - 1];

  const landed = rail.filter((entry) => entry.chip === "landed");
  if (landed.length > 0) return landed[landed.length - 1];

  return rail.length > 0 ? rail[0] : null;
}

/**
 * § Epic rail's rule, one level down: the story the room opens on (019 US2,
 * FR-006, FR-007, plan D6).
 *
 * The rail already answers "which spec is this room about" with *building,
 * else newest landed, else first*, and shipped the room answered "which story"
 * with `null` — so an arrival was one row of cards over an empty surface, and
 * the `26rem` detail track D-016 collapses stayed collapsed until the operator
 * clicked. The same sentence, said about stories, is what fills it: **the story
 * being built, else the newest merged, else the first.**
 *
 * Two differences from `defaultSelection`, both deliberate:
 *
 * * **Building takes the *first* live story, not the last.** At the rail's
 *   level "newest" is right because a later spec is later work. Inside one
 *   epic it is not: a half-landed epic reads `merged · RUNNING · PENDING ·
 *   PENDING`, every one of the last three live by `isStoryLive`, and the last
 *   of them is a story nothing has started. The front of the unfinished work is
 *   the story the factory is working, and it is the first one.
 * * **Merged keeps the rail's "newest".** All-merged is a finished epic read
 *   backwards, and the last story to land is the one an operator arriving at it
 *   wants open — the same reasoning that makes the rail prefer the newest
 *   landed spec.
 *
 * **This does not make the track permanent** (FR-009, D-016). A spec carrying
 * no stories has no default, this returns `null`, and the track collapses to
 * `0` exactly as it does today: the rule is that the track is a story's track,
 * and arrival now has a story rather than the track having stopped being one.
 */
export function defaultStory(entry: RailEntry | null): ShowfloorStory | null {
  if (entry === null) return null;
  const stories = Array.isArray(entry.stories) ? entry.stories : [];
  if (stories.length === 0) return null;

  const live = stories.find(isStoryLive);
  if (live !== undefined) return live;

  const merged = stories.filter((story) => story.ladder.stop_key === "merged");
  if (merged.length > 0) return merged[merged.length - 1];

  return stories[0];
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
  // The room opens on a story (019 US2, FR-006): `defaultStory` below decides
  // which, and what is held here is only the operator's *pick* on top of it.
  //
  // The pick is tagged with the spec it was made on, and a bare story id would
  // not do: `us2` names a story of every epic on the rail, so an untagged pick
  // outlives the spec it belongs to and the room shows a story of a spec that
  // is no longer on stage. A tag that does not match the staged spec is simply
  // not consulted, which is why a change of spec **re-derives** rather than
  // remembering (FR-008, plan D5). Nothing here is written to the URL — a spec
  // is a place, a story is a reading (FR-010, D-016).
  const [pick, setPick] = useState<{ specDir: string; storyId: string } | null>(null);

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
        <main id="room" className="cols" data-selection="none">
          <p className="quiet">Reading the floor…</p>
        </main>
      </Frame>
    );
  }

  if (errorStatus !== null || doc === null) {
    return (
      <Frame badge={badge}>
        <main id="room" className="cols" data-selection="none">
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

  // The one story the pane is telling, resolved once. Everything the selection
  // decides is decided from this: what the pane renders, whether the room is
  // explained beneath the stage, and which shape the grid takes. A second
  // reading could disagree with the first and collapse a track over a pane that
  // has something in it (008 US2).
  //
  // A pick of the staged spec wins; otherwise the room reads its own default.
  // A spec carrying no stories has neither, so `story` stays null and the track
  // goes on collapsing (FR-009).
  const picked =
    entry === null || pick === null || pick.specDir !== entry.spec_dir
      ? null
      : (entry.stories.find((candidate) => storyIdOf(candidate) === pick.storyId) ?? null);

  const story = picked ?? defaultStory(entry);
  const selectedStory = story === null ? null : storyIdOf(story);

  // D-016 clause (a): "the detail track is a story's track, not a permanent
  // one". The selection is carried into the grid as a *state hook* rather than
  // an inline style, so the track shape stays a CSS concern the two media rules
  // can go on overriding — and so a pick changes one attribute on an element
  // React never remounts, which is what lets the browser relay the stage
  // without the wires losing the boxes they were measured against (plan D2,
  // FR-004).
  const selection = story === null ? "none" : "story";

  return (
    <Frame badge={badge}>
      <main id="room" className="cols" data-showfloor-cols data-selection={selection}>
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
            <Stage
              entry={entry}
              floor={floor}
              selectedStory={selectedStory}
              onSelectStory={(chosen: ShowfloorStory) => {
                const storyId = storyIdOf(chosen);
                if (storyId !== null) setPick({ specDir: entry.spec_dir, storyId });
              }}
            />
          )}
          {/* § Stage and § Detail pane, amended by D-019: the band beneath the
              stage, above the legend row, belongs to **the spec's own goal**.

              D-016 put the room's explainer here and stopped it costing the
              graph 403px of width; what it left behind was a band that emptied
              the moment a story was picked, which reads as a glitch. So the
              occupant changes and the place does not: the goal is true of the
              graph whether or not a story is selected, so nothing vanishes on a
              click (009 FR-012), and the room's own two sentences retire to the
              genuinely empty case — no spec selected at all (FR-013).

              The two never stack. Two explanations under one graph is noise,
              and a build that showed both has misread the entry (plan D7). */}
          {entry === null ? <RoomExplanation /> : <SpecGoal intent={entry.intent} />}
          {/* § Stage: "One legend row under the stage, rendered once per page,
              never per epic." Here is the once — the room has exactly one
              Showfloor, so a legend mounted from it cannot repeat however many
              epics the rail carries (T021, FR-012). */}
          <Legend />
        </section>
        <DetailPane
          story={story}
          epicId={entry === null ? null : entry.epic_id}
          floor={floor}
        />
      </main>
    </Frame>
  );
}
