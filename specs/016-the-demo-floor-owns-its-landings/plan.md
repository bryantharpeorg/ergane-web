# Implementation Plan: The demo floor owns its landings

**Spec**: `specs/016-the-demo-floor-owns-its-landings/spec.md` · **Landing branch**: `dev`
**Authority**: constitution II, III and V; `CLAUDE.md` § "no gate needs a live floor".
No `DESIGN.md` amendment and no decision entry — nothing here renders, and no seam
is added: the live read keeps riding `landed_facts` exactly as it does today.

## The shape

One story. The change is small and its blast radius is every room, which is why it
is one story and not three.

## Decisions

- **D1 — the seam does not change; the binding does.** `landing_facts` is already
  an injected callable (`pane/showfloor.py:483`, `pane/review.py`'s
  `ReviewReaders`). Demo mode swaps what is injected. Do **not** put a demo branch
  inside `pane/landing.py`: that module's whole job is to be the live read, and a
  read that sometimes is not one would be lying about what it is.

- **D2 — replay it through `FixtureReader`, not beside it.** Every other recorded
  document is reached that way and a second replay path is a second set of rules
  for what a missing fixture means. The reader already knows how to say a fixture
  is absent or unparseable.

- **D3 — absent is degraded, never empty.** This is the whole lesson. An empty
  landing result is what let a blind read impersonate a fact and refuse fifteen
  epics. A spec the fixture does not name produces a *named* degraded read
  (FR-006), and the room degrades over it the way constitution III requires.

- **D4 — prove the absence of git, do not assert it in prose.** FR-002 wants a
  committed test that no subprocess is spawned in demo mode. Patch or intercept
  the spawn point and assert it is never reached; a test that merely checks the
  answer is right would pass on a machine where git happens to work, which is
  precisely the false green this spec exists to remove.

## Named traps

- **Do not re-record the fixture as part of this story.** It is committed with
  the spec, recorded from `dev` at `d4aec99` through the real seam. Regenerating
  it from whatever branch a node happens to sit on would make it an *invention*
  in the exact sense constitution V forbids, and the node's branch is not a
  landing branch.

- **Do not "fix" the ageing.** The fixture will fall behind `dev` and that is
  correct — the recorded floor ages the same way. Making it self-refresh means
  reading git, which is the thing being removed.

- **`PANE_DEMO=0` must be untouched.** FR-004 is not a formality: the operator's
  own pane runs live against a real checkout, and a demo-shaped read reaching it
  would silently replace real landings with a months-old recording.

- **The Showfloor already tolerates a failed landing read** by rendering
  `unknown` under the Unknown Rule. Do not remove that path — it is what a live
  read still needs, and FR-006's degraded answer flows into the same place.

## Gates

The four in `ergane.yaml`, unchanged. SC-001 is the interesting one: the smoke
suite should pass in a checkout that is **not a git repository at all**, which is
worth running by hand once before believing it.
