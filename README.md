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

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `PANE_DEMO` | unset | `1` selects the fixture reader |
| `PANE_FIXTURES_ROOT` | `<repo>/fixtures` | where the fixture reader looks |
| `PANE_DEMO_TRANSPORT_FAIL` | unset | comma-separated sections whose demo reads raise `TransportFailed` |
| `PANE_SPECS_ROOT` | `factory.workgraph.cli.DEFAULT_SPECS_ROOT` | live: where `<epic_id>/workgraph.json` lives |
| `PANE_POLL_INTERVAL_S` | `15` | SSE poll cycle |
| `PANE_WEB_DIST` | `<repo>/web/dist` | the built frontend the catch-all serves |
| `PANE_INTAKE_CREDENTIAL` | unset (intake closed) | the secret path segment of `POST /intake/{credential}` — the factory POSTs bare JSON with no header, so the credential rides the URL (D-P1) |
| `PANE_ANSWER_IDENTITY` | `factory.notify.adapter.UNKNOWN_SENDER` | the identity an answer is sent under; the factory, not the pane, decides whose answers count (US2) |
| `PANE_ATTENTION_DB` | demo: temp dir / live: `.pane/attention.db` | SQLite store for attention items |

Configure the factory side as `ERGANE_WEBHOOK_URL=http://<pane-host>:8787/intake/<PANE_INTAKE_CREDENTIAL>`.
The credential value never appears in a log, page, event, or fixture: `create_app()` registers it
with `factory.notify.redact.register_secret`, so it is stripped from every log record in the
process at creation. With it unset, the pane logs `intake closed: PANE_INTAKE_CREDENTIAL is not set`
at startup.

### Routes

- `GET /api/floor` — the full floor document (JSON).
- `GET /api/attention` — stored attention items, unioned with open escalations.
- `GET /api/events` — server-sent events; each `data:` line is a typed `{type, data}` envelope whose 001 type is `floor` and whose 003 type is `attention`.
- `POST /intake/{credential}` — the factory's webhook; classifies and stores an attention item.
- `GET /{path:path}` — the built frontend (`web/dist`), falling back to `index.html`.

Ledger, doctor store, and Temporal are resolved by ergane's own resolvers and environment chain; the pane reads none of those variables itself.

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
