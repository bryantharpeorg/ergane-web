# Data Model: the Showfloor stages an epic

The Showfloor adds no store, no table, and no factory state (constitution II,
001 FR-018). Its entities are a **join** (backend) and a set of **renderings**
(frontend) over documents ergane already owns. The authoritative field lists
are in [contracts/stage-document.md](./contracts/stage-document.md); this file
says what each entity *is*, where it comes from, and which invariants a
committed test holds it to.

## Backend entities (US1)

| Entity | Source | Invariants |
|---|---|---|
| **Stage document** | `assemble_stage(epic_id, workgraph, live)` in `pane/stage.py`, called from 001's `assemble_floor_document`; attached as `stage` on each `EpicEntry` of 001's floor document | One per running epic. `nodes` = exactly the file's nodes, in file order. `edges` = exactly the file's `depends_on` (pass) and `depends_on_merged` (merge) edges. `notes` names every read that failed or came back partial. `degraded` is true iff a note's mode is `transport`, `refusal`, or `unparseable`. |
| **Staged node** | one `WorkNode` from `workgraph.json` ⋈ one `NodeStatus` from the `epic_status` answer, keyed by node id | Static identity (`id`, `story_key`, `persona`) always present and never null. Each live field (`state`, `attempt`, `awaiting_operator`, `landing_state`) is individually null when unrecorded and named in `unknown`. `waiting_on_operator` ⇔ `awaiting_operator === true`. |
| **Staged edge** | `depends_on` → `kind: "pass"`, `depends_on_merged` → `kind: "merge"` | `source` is the predecessor, `target` the dependent. Order: node declaration order, then `depends_on` before `depends_on_merged` within a node. |
| **Stage note** | a read outcome the join could not fully use | `read` ∈ {`epic_status`, `workgraph`}; `mode` ∈ {`transport`, `refusal`, `undeclared`, `unparseable`} — `transport` and `refusal` are the words 001's `DegradedEntry` uses; `detail` quotes the reader's own text verbatim (the 052 discipline: the fact, not a paraphrase). |

The three live outcomes the assembler accepts are 001's (`pane/readers.py`): an
answer mapping, `TransportFailed`, `QueryRefused`. The assembler never dials Temporal, never
opens a file, and never shells anything; it is a pure function of two inputs,
which is what lets one pytest drive every fault shape with no floor present.

## Frontend entities (US2–US4)

| Entity | Component / module | Invariants |
|---|---|---|
| **Stage layout** | `layoutStage(stage)` in `web/src/showfloor/layout.ts` (dagre, `rankdir: "LR"`) | Every edge's `source.x < target.x` strictly. Nodes sharing an `x` (a rank) are ordered by ascending `y` in declaration order. Deterministic: same document, same positions. |
| **Station** (the card) | `StationNode` in `web/src/showfloor/StationNode.tsx`, rendered through the flow's `nodeTypes` and, for MERGED nodes, on the landed shelf | Carries `data-state` (raw string or `unknown`), `data-state-style`, one `[data-attempt-pip]` per counted attempt (none when null), `[data-persona]`, `data-waiting` iff `waiting_on_operator`, `data-landing-stage` iff the state is a landing state, `data-transition` per the lifecycle below. Glyph + caption per DESIGN.md § State Chevrons and Stations; an unrecognized state takes `UNKNOWN_STYLE` and shows the raw string. |
| **Route edge** | `RouteEdge` in `web/src/showfloor/RouteEdge.tsx`, rendered through `edgeTypes` | `.edge-pass`/`.edge-merge` plus `data-edge-kind`; dashed vs solid double rail per DESIGN.md § Route Map. |
| **Legend** | `Legend` in `web/src/showfloor/Legend.tsx`, once per epic map | Names **pass-edge** beside the dashed sample and **merge-edge** beside the solid sample; definitions are the two normative strings, verbatim. |
| **Landing line and landed shelf** | `LandingLine` in `web/src/showfloor/LandingLine.tsx` | Four stations bottom-to-top (PASSED, PR_OPEN, ENQUEUED, MERGED); a token per node in a landing state; the MERGED end is `[data-landed-shelf]` holding one shelf card per MERGED node and the count. |
| **Transition marker** | `useTransitionMarkers` in `web/src/showfloor/transitions.ts` | State machine per node: `seeded` on the first document (no marker) → `changed` when a later document's state differs (marker applied) → `cleared` after `TRANSITION_MS` (marker removed). Under reduced motion the `changed` step is skipped: no marker is ever applied. |
| **Idle marker** | computed in `EpicStage` from the stage's node states | `data-idle="true"` iff no node's state ∈ LIVE_STATES = {KEY_ISSUED, RUNNING, VERIFYING, PASSED, PR_OPEN, ENQUEUED, WAITING_OPERATOR}; a null or unrecognized state is not live. |
| **Style map** | `STATE_STYLES` in `web/src/showfloor/states.ts` | Exactly eleven keys; each has a `light` and a `dark` entry; `resolveStateStyle` returns `known: false` and `UNKNOWN_STYLE` only for null or unrecognized strings. |
| **Attention badge** | `AttentionBadge` in `web/src/showfloor/AttentionBadge.tsx` | Rendered iff open attention items > 0, as one `<a>` whose text is the count and whose `href` is the Desk route (`/desk`, 001 R-010). The count is `attention.items.length`, unfiltered: 003's `contracts/api.md` declares the floor document's `attention.items` carries only **unsettled** items (settled ones are reachable through `GET /api/attention`), so the length is the number waiting on the operator both before and after that concurrent epic lands. Replaced by `[data-attention-degraded]` whenever the attention section carries a degraded entry — whether or not items are also present, since a count drawn from a failed read is a number the pane cannot stand behind; never renders `0`. Count re-renders on every applied `floor` event. |
| **Quiet floor** | `Showfloor` in `web/src/showfloor/Showfloor.tsx` | `[data-quiet-floor]` present and no `[data-epic-stage]` iff the floor document lists zero running epics. |

## State vocabulary

Eleven node states, from ergane's `NodeState`: PENDING, KEY_ISSUED, RUNNING,
VERIFYING, PASSED, PR_OPEN, ENQUEUED, MERGED, FAILED, KILLED, WAITING_OPERATOR.

- **Live set** (FR-014): KEY_ISSUED, RUNNING, VERIFYING, PASSED, PR_OPEN,
  ENQUEUED, WAITING_OPERATOR.
- **Landing run** (FR-011): PASSED → PR_OPEN → ENQUEUED → MERGED.
- **Paged while verifying**: `state: VERIFYING` with `awaiting_operator: true`
  — rendered as VERIFYING with the waiting marker and DESIGN.md's ring and the
  word "paged"; never collapsed into WAITING_OPERATOR.
- **Anything else**: carried raw, rendered with `UNKNOWN_STYLE` and the raw
  string (FR-010). Never a crash.
