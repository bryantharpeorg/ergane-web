# Ergane Web

Ergane Web is the operator pane for an
[Ergane](https://github.com/bryantharpeorg/ergane) factory: one web
application, two rooms. The **Showfloor** is a full-bleed, live rendering of every
epic currently building — each workgraph staged as a DAG whose nodes light with
state and whose landings flow visibly to done. The **Desk** is the working room:
what is waiting on the operator first, then the floor's detail, health, and spend to
date. The pane renders state and carries exactly one verb — **Answer**, for the
Questions and Escalations the factory routes to its operator. Everything else an
operator does still belongs to the `ergane` CLI.

## Running and gating

After a fresh checkout:

```bash
uv sync
npm ci --prefix web   # postinstall installs the Playwright chromium binary
```

Then run the four gates declared in `ergane.yaml`:

```bash
uv run pytest -q
npm --prefix web run typecheck
npm --prefix web run test:unit
npm --prefix web run test:smoke
```

To run the demo pane locally after building the frontend:

```bash
npm --prefix web run build
PANE_DEMO=1 uv run uvicorn pane.app:app --port 8787
```

## The shape, in one paragraph

A FastAPI backend runs on the factory host and imports the ergane distribution,
reading the floor through the factory's own seams (`collect_floor`,
`open_escalations`, `rollup`, the doctor store) and answering through the same cores
the CLI uses. The factory's `ERGANE_WEBHOOK_URL` points at this backend, so
attention arrives as an event; the browser is fed by server-sent events. The
frontend is Vite/React/TypeScript, with the Showfloor's DAG staged by React Flow.
Every route sits behind one shared bearer token; the factory alone decides whose
answers count. All of it degrades honestly: a floor the pane cannot reach is
rendered as exactly that, never as an empty floor.

## The specs

| Spec | What it proves |
| --- | --- |
| `specs/001-the-desk-sees-the-floor` | Scaffold, gates, the recorded fixture floor, backend reads, and a read-only Desk |
| `specs/002-the-showfloor-stages-an-epic` | The spectacle: state-lit workgraph DAGs, the landing flow, the attention badge |
| `specs/003-an-answer-reaches-the-factory` | The verb: webhook intake, Answer for Questions and Escalations, the token gate |

002 and 003 declare `depends_on_landed` on 001 in their frontmatter — the
cross-spec edge the roadmap's scheduler enforces — so neither dispatches until
001's scaffold and fixture floor have landed. (Merge-edge remains the node-level
word inside one epic's workgraph.)

## Where the binding documents live

- `CONTEXT.md` — the vocabulary this repository adds (Pane, Showfloor, Desk,
  Answer, Attention item, Fixture floor). Factory-side words are defined in
  [ergane's `CONTEXT.md`](https://github.com/bryantharpeorg/ergane/blob/HEAD/CONTEXT.md)
  and win on any conflict.
- `docs/decisions.md` — the immutable decision log (D-001…D-011).
- `.specify/memory/constitution.md` — the standards every node building this repo
  obeys.
- `ergane.yaml` — the gates, ladder and landing-branch declaration (`dev`, D-011);
  its gate commands exist once spec 001 lands.
- `CLAUDE.md` — orientation for the two kinds of reader: operator sessions and the
  factory's dispatched nodes.
