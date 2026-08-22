---
version: 1
slug: "web-src-desk"
primary_target: "web/src/desk"
related_targets: []
---

# Surface: the Desk

Scope: route `/desk` (spec 001 US4, spec 003 the Answer) and its SSE-fed updates. Mode: Operate.

Audience and job: the one operator, glancing from the terminal beside it; job is "does anything need me?" then answer from here.

Action: exactly one — Answer (escalation choice buttons carrying `esc:<12hex>:<CHOICE>`, or a free-text reply to a Question). Everything else is read-only.

Content/proof: the factory's own documents — attention items with factory-written expiries, one timeline row per running epic (shared milestone bar PASSED → PR_OPEN → ENQUEUED → MERGED), health findings, the spend rollup with NULL shown as unknown, and every degraded state said in so many words.

Constraints: no non-GET except Answer; no credential on the page; forbidden words (dashboard, console, app, board, action, mutation, resolve); state never colour alone; `prefers-reduced-motion` honoured.

Chosen direction: the mission-timeline world, Desk staged as the world's own channel rows — attention strip of T-minus clocks first, then epic timeline rows, then health and spend in one table grammar.

Memorable moment: the row of clocks, each counting down against the factory's own `expires_at`, with the answer beside it and the factory's ruling landing in the same row.

Unresolved: none material; a Notice's pane-local dismiss persistence is the implementer's call (localStorage acceptable).
