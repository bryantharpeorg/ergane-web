/**
 * Variants of the showfloor document, in the shapes `pane/showfloor.py` emits.
 *
 * The backend derives every ladder (plan D2) and the browser only dresses it,
 * so what the browser's tests need is one entry per *shape the assembler can
 * produce* — landed, building, ready, draft, waiting on the operator, killed,
 * and the spec that declares no stories at all. Those shapes are written here
 * rather than recorded because they are not factory documents: they are this
 * repository's own join of documents that are recorded, and `US1`'s
 * `tests/test_showfloor_document.py` is where the join itself is proven against
 * the Fixture floor and this repo's corpus (constitution V's line — nothing
 * *from the factory* is invented here; the recorded floor carries all of it).
 *
 * The stop keys, labels and statuses are `pane/showfloor.py`'s
 * `LADDER_STOPS` and `STOP_*` words verbatim, so a builder that drifted from
 * the document contract would be visible as a name that does not exist there.
 */

import type {
  Ladder,
  LadderStop,
  RailEntry,
  ShowfloorStory,
} from "../../../src/api/showfloorDocument";

const STOP_KEYS = ["ready", "building", "verifying", "pr_open", "queue", "merged"];
const STOP_LABELS: Record<string, string> = {
  ready: "ready",
  building: "building",
  verifying: "verifying",
  pr_open: "pr open",
  queue: "queue",
  merged: "merged",
};

interface LadderOptions {
  /** The `epic_status` state verbatim, or null for a story no epic answered for. */
  state?: string | null;
  specState?: string | null;
  /** Which of the six stops the work reached; null for a frozen ladder. */
  stopKey?: string | null;
  chip?: string | null;
  awaiting?: boolean;
  frozen?: boolean;
  terminalReason?: string | null;
  /** All six done: MERGED, or a spec the operator attested `landed`. */
  done?: boolean;
  /**
   * The landing commit's instant on the `merged` stop, as 009's assembler
   * stamps it (FR-002a). Only a `done` stop is ever stamped, here as there.
   */
  landedAt?: string | null;
}

export function ladderOf(options: LadderOptions = {}): Ladder {
  const {
    state = null,
    specState = null,
    stopKey = "ready",
    chip = null,
    awaiting = false,
    frozen = false,
    terminalReason = null,
    done = false,
    landedAt = null,
  } = options;

  const index = stopKey === null ? -1 : STOP_KEYS.indexOf(stopKey);
  const stops: LadderStop[] = STOP_KEYS.map((key, position) => {
    let status: LadderStop["status"];
    if (frozen) status = "frozen";
    else if (done) status = position === 5 && awaiting ? "waiting" : "done";
    else if (index === -1 || position > index) status = "ahead";
    else if (position < index) status = "done";
    else status = awaiting ? "waiting" : "active";
    const at = key === "merged" && status === "done" ? landedAt : null;
    return { key, label: STOP_LABELS[key], status, at };
  });

  return {
    state,
    spec_state: specState,
    stops,
    stop: stopKey === null ? null : STOP_LABELS[stopKey],
    stop_key: stopKey,
    tone: frozen ? "terminal" : awaiting ? "waiting" : done ? "done" : "normal",
    chip,
    frozen,
    terminal_reason: terminalReason,
    awaiting_operator: awaiting,
  };
}

export function storyOf(id: string, title: string, ladder: Ladder): ShowfloorStory {
  return {
    id,
    story_key: id.toUpperCase(),
    title,
    priority: "P1",
    intent: "",
    requirement_keys: [id.toUpperCase()],
    depends_on: [],
    depends_on_merged: [],
    ladder,
    facts: {},
    unknown: [],
  };
}

export function entryOf(overrides: Partial<RailEntry> & { spec_dir: string }): RailEntry {
  return {
    name: overrides.spec_dir.split("-").slice(1).join(" "),
    state: "draft",
    chip: null,
    stories_landed: 0,
    stories_total: 0,
    epic_id: null,
    epic_state: null,
    stories: [],
    story_source: "workgraph",
    notes: [],
    unknown: [],
    ...overrides,
  };
}

/** A spec the operator attested `landed`: every story done, nothing live. */
export function landedEntry(specDir: string, stories = 4): RailEntry {
  return entryOf({
    spec_dir: specDir,
    state: "landed",
    chip: "landed",
    stories_landed: stories,
    stories_total: stories,
    stories: Array.from({ length: stories }, (_unused, index) =>
      storyOf(
        `us${index + 1}`,
        `story ${index + 1}`,
        ladderOf({ specState: "landed", stopKey: "merged", chip: "merged", done: true }),
      ),
    ),
  });
}

/** An epic on the floor: one story running, the rest ahead of it or merged. */
export function buildingEntry(specDir: string, landed = 1, total = 4): RailEntry {
  const stories = Array.from({ length: total }, (_unused, index) => {
    if (index < landed) {
      return storyOf(
        `us${index + 1}`,
        `story ${index + 1}`,
        ladderOf({ state: "MERGED", specState: "ready", stopKey: "merged", chip: "merged", done: true }),
      );
    }
    if (index === landed) {
      return storyOf(
        `us${index + 1}`,
        `story ${index + 1}`,
        ladderOf({ state: "RUNNING", specState: "ready", stopKey: "building", chip: "building" }),
      );
    }
    return storyOf(
      `us${index + 1}`,
      `story ${index + 1}`,
      ladderOf({ state: "PENDING", specState: "ready", stopKey: "ready", chip: "ready" }),
    );
  });

  return entryOf({
    spec_dir: specDir,
    state: "ready",
    chip: "building",
    stories_landed: landed,
    stories_total: total,
    epic_id: specDir,
    epic_state: "RUNNING",
    stories,
  });
}

/** Reviewed and waiting its turn: `state: ready`, nothing dispatched. */
export function readyEntry(specDir: string, total = 4): RailEntry {
  return entryOf({
    spec_dir: specDir,
    state: "ready",
    chip: "ready",
    stories_total: total,
    stories: Array.from({ length: total }, (_unused, index) =>
      storyOf(
        `us${index + 1}`,
        `story ${index + 1}`,
        ladderOf({ specState: "ready", stopKey: "ready", chip: "ready" }),
      ),
    ),
  });
}

/** Unreviewed: the dashed chip. */
export function draftEntry(specDir: string, total = 3): RailEntry {
  return entryOf({
    spec_dir: specDir,
    chip: "draft",
    stories_total: total,
    stories: Array.from({ length: total }, (_unused, index) =>
      storyOf(
        `us${index + 1}`,
        `story ${index + 1}`,
        ladderOf({ specState: "draft", stopKey: "ready", chip: "draft" }),
      ),
    ),
  });
}

/** `awaiting_operator` anywhere in the epic: the whole row turns gold. */
export function waitingEntry(specDir: string, total = 4): RailEntry {
  const stories = Array.from({ length: total }, (_unused, index) =>
    storyOf(
      `us${index + 1}`,
      `story ${index + 1}`,
      index === 1
        ? ladderOf({
            state: "WAITING_OPERATOR",
            specState: "ready",
            stopKey: "building",
            chip: "waiting on you",
            awaiting: true,
          })
        : ladderOf({ state: "PENDING", specState: "ready", stopKey: "ready", chip: "ready" }),
    ),
  );

  return entryOf({
    spec_dir: specDir,
    state: "ready",
    chip: "waiting on you",
    stories_total: total,
    epic_id: specDir,
    epic_state: "RUNNING",
    stories,
  });
}

/** A terminal node: the ladder freezes and carries `terminal_reason` verbatim. */
export function killedEntry(specDir: string, total = 4): RailEntry {
  const stories = Array.from({ length: total }, (_unused, index) =>
    storyOf(
      `us${index + 1}`,
      `story ${index + 1}`,
      index === 0
        ? ladderOf({
            state: "KILLED",
            specState: "ready",
            stopKey: null,
            chip: "killed",
            frozen: true,
            terminalReason: "operator killed the epic",
          })
        : ladderOf({ state: "PENDING", specState: "ready", stopKey: "ready", chip: "ready" }),
    ),
  );

  return entryOf({
    spec_dir: specDir,
    state: "ready",
    chip: "killed",
    stories_total: total,
    epic_id: specDir,
    epic_state: "RUNNING",
    stories,
  });
}

/**
 * A captured draft with no work graph and no story headings — 007 today. The
 * entry is empty because the corpus is, and US1 puts `stories` in its `unknown`
 * so the row can say so.
 */
export function storylessEntry(specDir: string): RailEntry {
  return entryOf({ spec_dir: specDir, chip: "draft", unknown: ["stories"] });
}

/**
 * A rail entry whose graph is a **recorded** workgraph (005 US3).
 *
 * The shapes above are this repository's own join and are written here; a work
 * *graph* is a factory document and is not (constitution V). `fixtures/
 * workgraphs/` holds three real ones — two nodes with a single merge edge, five
 * nodes carrying both edge kinds, and five nodes whose merge edges were
 * inferred — so the stage's rank and wire assertions run over graphs ergane
 * really compiled rather than a shape chosen to make them pass.
 *
 * Ladders are layered on top by story key, because the live half of a story is
 * the `epic_status` answer's and the workgraph carries none.
 */
export function entryFromWorkgraph(
  raw: string,
  ladders: Record<string, Ladder> = {},
  overrides: Partial<RailEntry> = {},
): RailEntry {
  const graph = JSON.parse(raw) as {
    epic_id?: string;
    nodes?: Array<{
      id: string;
      story_key?: string | null;
      depends_on?: string[];
      depends_on_merged?: string[];
      requirement_keys?: string[];
    }>;
  };

  const stories: ShowfloorStory[] = (graph.nodes ?? []).map((node) => ({
    ...storyOf(node.id, `story ${node.id}`, ladders[node.id] ?? ladderOf()),
    story_key: node.story_key ?? node.id.toUpperCase(),
    requirement_keys: node.requirement_keys ?? [],
    depends_on: node.depends_on ?? [],
    depends_on_merged: node.depends_on_merged ?? [],
  }));

  const specDir = overrides.spec_dir ?? graph.epic_id ?? "unknown";
  return entryOf({
    ...overrides,
    spec_dir: specDir,
    state: overrides.state ?? "ready",
    epic_id: overrides.epic_id !== undefined ? overrides.epic_id : specDir,
    stories,
    stories_total: stories.length,
    stories_landed: stories.filter((story) => story.ladder.stop_key === "merged").length,
  });
}
