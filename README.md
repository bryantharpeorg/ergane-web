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
| `PANE_INTAKE_CREDENTIAL` | unset | the path segment `ERGANE_WEBHOOK_URL` carries; unset means intake is closed and the backend says so once at startup |
| `PANE_ANSWER_IDENTITY` | `factory.notify.adapter.UNKNOWN_SENDER` | whose answers the factory is asked to judge; the pane performs no responder check of its own |
| `PANE_ATTENTION_DB` | `.pane/attention.db` (a fresh file per process under `PANE_DEMO=1`) | the pane's own store of what the factory delivered |

No credential value ever appears in a rendered page, an SSE event, a log line, or a
committed fixture (constitution VI). `create_app()` registers the intake credential
with `factory.notify.redact` at startup, so no log record in the process can carry
it.

### Pointing the factory at the pane

The factory POSTs a bare JSON body with no header and treats everything after the
origin as a secret to redact, so the credential rides the URL path:

```bash
ERGANE_WEBHOOK_URL=http://<pane-host>:8787/intake/<PANE_INTAKE_CREDENTIAL>
```

Set `PANE_INTAKE_CREDENTIAL` on the pane to the same value. With it unset the pane
logs `intake closed: PANE_INTAKE_CREDENTIAL is not set` once and refuses every POST.

### Whose answers count — and the gap the pane does not close

The token decides who can *see*; the factory decides whose answers *count*. The pane
passes `PANE_ANSWER_IDENTITY` verbatim to both settlement seams and performs no
responder check of its own: for a Question, `CallbackBridge.handle_relay` checks the
identity against `escalation.authorized_responders` and returns `UNAUTHORIZED`, which
the pane renders unsoftened. The escalation signal seam performs no such check —
`EscalationWorkflow._answer` accepts the first offered choice whatever identity rides
with it, so an unauthorized identity's direct signal would settle an escalation. That
is a factory-side gap this pane surfaces rather than closes: a pane-side responder
check would be the second source of truth D-001 forbids.

### Routes

- `GET /api/floor` — the full floor document (JSON).
- `GET /api/attention` — every delivered Attention item in rank order, settled ones last (`{items, degraded}`). The floor document's `attention` section carries only the unsettled ones.
- `GET /api/events` — server-sent events; each `data:` line is a typed `{type, data}` envelope. 001 defines `floor`; 003 adds `attention`, pushed in the same handling as the storage that admitted it. Consumers ignore types they do not know.
- `POST /intake/{credential}` — the route `ERGANE_WEBHOOK_URL` points at. `{correlation_id, text, actions[]}` becomes a Question, an Escalation, or a Notice; a payload the pane cannot carry is refused with 422 and nothing is stored, because to the factory non-2xx *is* the word "undelivered".
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
