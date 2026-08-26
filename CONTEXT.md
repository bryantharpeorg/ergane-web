# Ergane Web

The operator pane for an Ergane factory. This file is the project's vocabulary — what
the words mean, and which word to use when several are floating around. It is a
glossary and nothing else; decisions live in [`docs/decisions.md`](docs/decisions.md)
(immutable log) and standards in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) (normative).
Factory-side vocabulary (Spec, Epic, Node, Attempt, Persona, Question, Escalation,
Landing, Promotion…) is defined in the sibling repository's
[`CONTEXT.md`](https://github.com/bryantharpeorg/ergane/blob/HEAD/CONTEXT.md) and is
not redefined here; this file covers only
the words the pane adds.

## Language

### The surface

**Pane**:
The web surface an operator glances at to see what the factory is doing and what is
waiting on them. One application, two rooms — the **Showfloor** and the **Desk**. A
pane renders state and carries exactly one verb — **Answer**. It is not a second
operator console: every deliberate act (ready a spec, promote, dispatch) belongs to
the operator CLI. D-021 opened a narrow door — four grooming writes, admitted only
when an ergane seam carries them — and no seam does yet, so the sentence above is
still literally true. This is the "web status board" ergane's spec 046 placed out of its
own scope.
_Avoid_: dashboard, console, app, UI, board

**Showfloor**:
The spectacle room: a full-bleed, live rendering of every epic currently building —
each epic's workgraph staged as a DAG whose nodes light with state and whose landings
flow visibly to done. Pure glass: it carries no verb, offers nothing to press, and is
safe to leave on a projector or show a stranger. When something starts waiting on the
operator, the Showfloor says so only as a badge that leads to the Desk.
_Avoid_: demo page, graph view, visualization

**Desk**:
The working room: what is waiting on the operator first, then the floor's detail,
health, and spend. The Desk is the only room where **Answer** renders. An operator
sits at the Desk; a visitor watches the Showfloor.
_Avoid_: admin page, control panel, home page

**Floor**:
What the factory reports is happening right now — the set of running epics and the
open attention items, as ergane's `factory.cli.status.collect_floor` answers it (the
`FloorStatus` shape). Both rooms render the floor: the Showfloor stages it, the Desk
details it. A floor with zero running epics is a **quiet floor** — a real state,
said in so many words, never a blank page.
_Avoid_: dashboard state, system status

### Attention

**Answer**:
The pane's single write — resolving a **Question** with knowledge or an
**Escalation** with a choice, through the factory's existing answer seam. The pane
never invents its own write path, never judges an answer's validity, and renders the
factory's ruling on every answer it carries, including refusals.
_Avoid_: action, command, mutation, resolve

**Attention item**:
One thing the factory delivered for the operator's eyes — a **Question**, an
**Escalation**, or a **Notice** — with the time it has left when the factory set
one. The Desk ranks attention items above everything else; the Showfloor only
counts them.
_Avoid_: alert, notification, todo, inbox item

**Notice**:
The attention item that asks for nothing — a supervision alert or roadmap notice
riding the same webhook the factory routes all its notify traffic through. A notice
carries no countdown, no buttons, and no settlement state; there is nothing to
answer, only something to know. Dismissing one is the pane's own housekeeping,
never a factory write.
_Avoid_: alert, FYI, toast, warning

### Evidence

**Fixture floor**:
A recorded set of factory documents — a floor status, workgraphs, epic states,
attention items — captured from a real factory and replayed by tests and demos. The
fixture floor is evidence, not invention: its shapes come from ergane's contracts,
never from imagination, so a pane that renders it correctly renders the real floor
correctly.
_Avoid_: mock data, sample data, stub

## Relationships

- The **Pane** displays; the operator CLI acts. The one exception is **Answer**
- The **Showfloor** and the **Desk** render the same floor; only the **Desk** carries
  **Answer**, and the Showfloor points at the Desk whenever attention waits
- An **Answer** resolves exactly one **Question** or **Escalation**, and does so
  through the factory's seam — the pane holds no factory state of its own and the
  factory alone rules on identity, expiry, and validity. A **Notice** is never
  answered; it is only known
- The **Fixture floor** stands in for a live factory wherever a gate or a demo needs
  one; the pane cannot tell the difference, and that is the point

## Flagged ambiguities

- **"pane" vs "board"** — ergane's spec 046 calls this surface "the web status
  board". Same object; this repository's word is **Pane**, and "board" appears only
  when quoting 046.
- **"answer" vs "resolve"** — the factory's CLI settles Questions with `ergane
  answer` and Escalations with `ergane build resolve`; two verbs because two objects.
  The pane deliberately uses one word, **Answer**, for the operator-facing act on any
  **Attention item** — which seam it rides underneath is plumbing, not vocabulary.
- **"live" spend** — there is no such number. The factory's ledger is written at
  attempt teardown, so the Desk's spend is ledger-truth: exact and slightly behind.
  Calling it "live" promises what the factory does not record; say **spend to date**.
- **"merge-edge" at the spec level** — cross-spec ordering is declared with
  `depends_on_landed` in a spec's frontmatter and enforced by the roadmap's
  scheduler; **merge-edge** stays a node-level word inside one epic's workgraph.
  Early phrasing ("merge-edged on 001") is corrected by D-010; say **the spec
  depends on 001 landing**.
