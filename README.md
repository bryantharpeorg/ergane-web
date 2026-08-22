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

## Status

**Specs authored; nothing built.** This repository currently contains no
application code — deliberately. It is a wireable target repository for the sibling
factory, and the factory will build its own pane from the specs in `specs/`
(D-003). The pane watching the factory build the pane is the point.

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
- `docs/decisions.md` — the immutable decision log (D-001…D-010).
- `.specify/memory/constitution.md` — the standards every node building this repo
  obeys.
- `factory.yaml` — the gates and standards declaration, draft until wired.
