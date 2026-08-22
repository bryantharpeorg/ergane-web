---
version: 1
slug: "web-src-showfloor"
primary_target: "web/src/showfloor"
related_targets: []
---

# Surface: the Showfloor

Scope: route `/` (spec 002) — full-bleed, pure glass. Mode: Operate (watch), never Persuade.

Audience and job: the operator or a visitor, watching; job is to see which stories are moving, where the landing line is busy, and whether anyone is paged.

Action: none. The Showfloor renders no button, form, or input. The attention badge is a link to the Desk.

Content/proof: one route map per running epic from its real `workgraph.json` and `epic_status`: stations are stories (eleven states, each a glyph + caption), `depends_on` is a thin dashed route, `depends_on_merged` a solid double rail, same-rank stories share a column; the landing line at the right edge is four shared stations a node's token travels through; a refused query is a route with no stations, said so; a quiet floor says so.

Constraints: React Flow + dagre for layout (D-006); DOM order follows rank then declaration; degraded notices in words; no controls.

Chosen direction: the mission-timeline world fused with the visible-transit staging: the work graph is a transit map, the landing run is a line with stations, the travelling token is the brightest moving thing.

Memorable moment: a token visibly held at ENQUEUED for four minutes — a jam you can point to.

Unresolved: none material; how React Flow custom nodes render the skewed station + caption is the implementer's call within tokens.css.
