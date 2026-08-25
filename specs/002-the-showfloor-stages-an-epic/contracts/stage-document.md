# Contract: the stage document and the Showfloor's DOM markers

Two contracts in one file because every test in this spec asserts one or the
other: the **stage document** is what the backend emits per running epic
(US1), and the **DOM marker vocabulary** is what the Showfloor renders from it
(US2–US4). Both are fixed here so the judge can read an assertion in a
committed test and find the name it asserts on in this file.

Nothing here redefines an ergane shape. `workgraph.json` is ergane's
(`factory.workgraph.models.WorkNode`, `depends_on` + `depends_on_merged`), and
the live answer is ergane's `EpicStatus`/`NodeStatus` as `epic_status`
returns it. The stage document is the pane's *join* of the two, and the only
thing it adds is the honest accounting of what could not be joined.

## 1. The stage document (backend, US1)

Where it lives: inside the floor document spec 001 established, as the
`stage` key of each `EpicEntry` in the `epics` section
(`specs/001-the-desk-sees-the-floor/contracts/floor-document.md`). The pane still has one read;
001's per-epic fields are untouched and the Desk keeps rendering them. The SSE
`floor` event carries the whole floor document, so it carries every stage.

```jsonc
{
  "epic_id": "077-a-scanner-the-operator-chooses-runs-in-the-loop",
  "nodes": [                                   // declaration order, exactly the file's nodes
    {
      "id": "us1",                             // static — always present
      "story_key": "US1",                      // static — always present
      "persona": "implementer",                // static — from workgraph.json, never the live answer
      "state": "MERGED",                       // live — raw string as the factory wrote it, or null
      "attempt": 1,                            // live — int, or null (never 0 for "not recorded")
      "awaiting_operator": false,              // live — bool, or null
      "landing_state": "MERGED",               // live — string, or null
      "waiting_on_operator": false,            // derived: awaiting_operator === true (FR-006); false when unknown
      "unknown": []                            // live field names the factory did not record for this node
    },
    {
      "id": "us5", "story_key": "US5", "persona": "implementer",
      "state": null, "attempt": null, "awaiting_operator": null, "landing_state": null,
      "waiting_on_operator": false,
      "unknown": ["state", "attempt", "awaiting_operator", "landing_state"]   // absent from the live answer (FR-004)
    }
  ],
  "edges": [                                   // declaration order: per node, depends_on then depends_on_merged
    { "source": "us2", "target": "us3", "kind": "pass"  },   // depends_on        (pass-edge)
    { "source": "us3", "target": "us4", "kind": "pass"  },
    { "source": "us2", "target": "us4", "kind": "merge" },   // depends_on_merged (merge-edge)
    { "source": "us4", "target": "us5", "kind": "pass"  }
  ],
  "notes": [                                   // every read that failed or came back partial, in words
    { "read": "epic_status", "mode": "transport",  "detail": "<TransportFailed's own text, verbatim>" },
    { "read": "epic_status", "mode": "refusal",    "detail": "<QueryRefused's own text, verbatim>" },
    { "read": "epic_status", "mode": "undeclared", "detail": "live answer names node id 'us9', which workgraph.json does not declare; not drawn" },
    { "read": "workgraph",   "mode": "transport",  "detail": "<TransportFailed's own text: the file is missing, or its envelope says pending>" },
    { "read": "workgraph",   "mode": "unparseable","detail": "<path>: <JSONDecodeError text>" }
  ],
  "degraded": true                             // true iff notes carries a transport / refusal / unparseable note
}
```

Rules the tests assert (scenario in brackets):

- **Edge direction**: `source` is the predecessor, `target` the dependent.
  `us3.depends_on == ["us2"]` becomes `{source: "us2", target: "us3", kind: "pass"}`.
  The layout (US2) then places every `source` strictly left of its `target`.
- **Exactly the file's nodes** [US1-S1, US1-S5]: `nodes` has one entry per
  `workgraph.json` node, in file order, and no other. A live-only id produces
  an `undeclared` note and no node. `degraded` stays `false` for an undeclared
  note alone — nothing failed to be read; something extra was said.
- **Static always, live individually** [US1-S2, US1-S4]: `id`, `story_key`,
  `persona` come from the file and are never null. Each of the four live
  fields is null when the factory did not record it, and its name is listed
  in `unknown`. `attempt` is never coerced to `0`; `awaiting_operator` is never
  coerced to `false` — null is the honest value, and `waiting_on_operator` is
  false only because an unknown flag cannot mark a node.
- **Two modes, two notes** [US1-S3]: a transport failure reaching Temporal and
  a query the workflow refused both leave `nodes` fully static (every live
  field null) and add exactly one note each, `mode: "transport"` vs
  `mode: "refusal"` — the two words 001's `DegradedEntry` already uses, so the
  Desk's well and the Showfloor's note say the same thing. The two notes differ
  in `mode`, never only in `detail`.
- **A dead file is a named entry** [US1-S6]: a missing or unparseable
  `workgraph.json` yields `nodes: []`, `edges: []`, one `workgraph` note, and
  `degraded: true`; the epic still appears in `epics` and every other epic's
  stage is unaffected.
- **The derived flag wins** [US1-S7]: `awaiting_operator: true` sets
  `waiting_on_operator: true` whatever `state` says; `state` stays the raw
  string (DESIGN.md renders the paged-while-verifying case as VERIFYING plus a
  ring, never as WAITING_OPERATOR).
- **Unrecognized state is carried, not dropped** (FR-010 is US2's, but the
  document must not lose the evidence): `state` is whatever string the
  factory wrote; the backend neither validates nor normalizes it.

Inputs the assembler takes (pure; no I/O):

- the parsed `workgraph.json` document, or the failure 001's reader reported:
  `pane.readers.TransportFailed` (missing, or an envelope marked pending) or
  the `json.JSONDecodeError` an unparseable file raises;
- the `epic_status` outcome 001's reader returns for workflow id
  `epic-<epic_id>`: an answer mapping, `pane.readers.TransportFailed`, or
  `pane.readers.QueryRefused` — the same three outcomes 001's US3 tests
  already inject at the reader seam.

The call site is 001's `assemble_floor_document` in `pane/floor_document.py`,
where both inputs are already in hand for every running epic: no second read,
no second poll, and the stage's `nodes` ids are by construction the ids of the
`EpicEntry.nodes` cards marked `declared: true`.

## 2. The Showfloor's DOM markers (frontend, US2–US4)

Every marker is a `data-*` attribute or a class, because a committed test asserts
by selector and never by pixels (constitution IV). Text content is asserted only
where the spec makes the words normative (the legend, the quiet floor, the
degraded notes). Appearance is DESIGN.md's (constitution VIII); these markers
carry *what* is shown.

| Marker | On | Meaning |
|---|---|---|
| `[data-showfloor-root]` | the route's outermost element | Full-bleed root; its bounding box equals the viewport (US3-S7) |
| `[data-quiet-floor]` | one element under the root | Present iff the floor document lists zero running epics; contains the words "quiet floor" (US2-S7, FR-019) |
| `[data-epic-stage][data-epic-id="<id>"]` | one per running epic | The epic's stage region; absent entirely on a quiet floor |
| `[data-idle="true"\|"false"]` | on `[data-epic-stage]` | FR-014: `true` iff no node's state is in {KEY_ISSUED, RUNNING, VERIFYING, PASSED, PR_OPEN, ENQUEUED, WAITING_OPERATOR} |
| `[data-stage-note][data-read][data-mode]` | inside the epic stage | One per stage-document note; `data-mode` is the note's `mode` verbatim; text names the read and the mode in words (FR-005) |
| `[data-station][data-node-id="<id>"]` | the route-map card | One per stage-document node, exactly once per epic (SC-001) |
| `[data-state="<raw string or 'unknown'>"]` | on `[data-station]` and shelf cards | FR-008: the state marker equals the state string; `unknown` when the live state is null |
| `[data-state-style="<one of the eleven>" \| "unknown"]` | same | Which style-map entry the card resolved to; `unknown` only for a null or unrecognized state (FR-010) |
| `[data-attempt-pip]` | children of `[data-station]` | One per attempt counted; none when `attempt` is null |
| `[data-persona="<persona>"]` | child of `[data-station]` | The persona badge; text is the persona |
| `[data-waiting="true"]` | on `[data-station]` | FR-006: present iff `waiting_on_operator` is true |
| `[data-landing-stage="PASSED"\|"PR_OPEN"\|"ENQUEUED"\|"MERGED"]` | on `[data-station]` | FR-011: present iff the state is one of the four landing states |
| `[data-transition="true"]` | on `[data-station]` | FR-012: applied when the state changed between two successive documents; cleared after `TRANSITION_MS`; never on first paint; never under reduced motion |
| `[data-landing-line]` | one per epic stage | DESIGN.md's landing line: four `[data-landing-station="<stage>"]` children |
| `[data-landed-shelf]` | the MERGED end of the landing line | Contains one `[data-shelf-card][data-node-id][data-state="MERGED"]` per MERGED node (US3-S1, US3-S3) |
| `.edge-pass` + `[data-edge-kind="pass"]` | the rendered edge | FR-009: dashed pass-edge |
| `.edge-merge` + `[data-edge-kind="merge"]` | the rendered edge | FR-009: solid merge-edge |
| `[data-legend]` with `[data-legend-kind="pass"]` and `[data-legend-kind="merge"]` | once per epic map | US2-S5: each names its kind and quotes its glossary definition verbatim (the strings in §3) |
| `[data-attention-badge]` | an `<a>` in the masthead | FR-017: present iff open attention items > 0; text is the count — `attention.items.length`, unfiltered, because 003's `contracts/api.md` declares that list carries only unsettled items; `href` is the Desk route (`/desk`, 001 R-010) |
| `[data-attention-degraded][data-mode="transport"\|"refusal"]` | in the badge's place | FR-017: the attention section carries a degraded entry — present whether or not items are also present, and no count renders beside it; text names what could not be learned; never the numeral 0 |

Rules:

- A MERGED node is rendered twice by design: its stop on the route map (so the
  route stays whole, DESIGN.md § Route Map) and its card on the landed shelf.
  The uniqueness assertion (SC-001) is over `[data-station]`; the shelf
  assertion (US3-S1) is over `[data-landed-shelf] [data-node-id]`.
- Pan and zoom are gestures on the flow viewport. The flow component mounts
  with `nodesDraggable={false}`, `nodesConnectable={false}`,
  `elementsSelectable={false}`, `nodesFocusable={false}`; no `Controls`,
  `MiniMap`, or any component that renders a `button` is mounted (FR-016).
- The route's DOM contains no `button`, `form`, `input`, `select`, or
  `textarea` (FR-016, US4-S5).

## 3. Normative strings

Quoted verbatim from ergane's `CONTEXT.md`; the legend test asserts these exact
strings and the legend renders nothing else as a definition.

- **pass-edge**: `An ordering-only dependency: the predecessor must reach a verdict, and nothing about its code is guaranteed to be present`
- **merge-edge**: `A content dependency: the predecessor's work must be merged before the dependent's worktree is created, so the dependent's base contains that code`

## 4. The style map (US3, FR-015)

Exported from `web/src/showfloor/states.ts`:

```ts
export const NODE_STATES = ["PENDING","KEY_ISSUED","RUNNING","VERIFYING","PASSED",
  "PR_OPEN","ENQUEUED","MERGED","FAILED","KILLED","WAITING_OPERATOR"] as const;
export type NodeState = (typeof NODE_STATES)[number];
export type Theme = "light" | "dark";
export interface StateStyle { glyph: Glyph; fill: Token; stroke: Token; ink: Token; caption: string }
export const STATE_STYLES: Record<NodeState, Record<Theme, StateStyle>>;   // exactly eleven keys, each with both themes
export const UNKNOWN_STYLE: StateStyle;                                    // taken only for a null or unrecognized state
export function resolveStateStyle(state: string | null, theme: Theme): { style: StateStyle; known: boolean };
```

`Token` is a DESIGN.md colour token name (`teal`, `olive-ink`, …), resolved
through CSS custom properties; `Glyph` is one of DESIGN.md's glyph shapes
(`dashed`, `hatched`, `solid`, `half`, `most`, `crossed`, `bell`, …) and
`caption` is the table's caption text. The pane has one palette: the `dark`
entry names the same tokens as `light` until DESIGN.md names a dark palette
(D-012 governance); the test asserts the map's shape — every one of the eleven
present under both themes, and none of the eleven resolving to `UNKNOWN_STYLE`.
