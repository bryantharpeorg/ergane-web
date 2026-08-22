#!/usr/bin/env python
"""Record on-cue factory documents for the operator-pane fixture set.

Drives ergane's OWN test harness (``tests/test_interpreter.py`` in the read-only
checkout) against the REAL managed Temporal server on this host, with the
notify activities swapped for the REAL ones, so that every document written
here came out of a factory seam verbatim: the ``epic_status`` query, the
``escalations``/``questions`` tables, ``open_escalations``, the webhook
adapter's POST body, ``CallbackBridge.handle_relay``, and the ``ergane build
status --json`` refusal rendering.

Run with the tool venv's interpreter::

    ~/.local/share/uv/tools/ergane-cli/bin/python scripts/record-fixtures-harness.py --help
    ~/.local/share/uv/tools/ergane-cli/bin/python scripts/record-fixtures-harness.py --dry-run

A real run REQUIRES the systemd worker to be stopped first: this script opens
its own Worker on the production task queue (``workgraph``) with scripted
activities, and a second poller on that queue would steal the fixture epics'
activity tasks (and the fixture worker would steal the real worker's).

    systemctl --user stop <ergane worker unit>      # or the system unit
    eval "$(~/.config/ergane/ergane-env.sh)"        # ERGANE_ROOT, ERGANE_VERIFICATION_DB_PATH, ...
    ~/.local/share/uv/tools/ergane-cli/bin/python scripts/record-fixtures-harness.py

Scenes, in order (see ``--dry-run`` for the resolved plan):

1. an in-process webhook recorder (random port + random secret path);
2. ``landing``     a 3-node epic (us1 -> us2 merge edge -> us3 depends_on), all
                   passing, landings scripted pending -> merged; every distinct
                   ``epic_status`` document is saved;
3. ``paged-while-verifying`` a 1-node epic whose attempts fail until the ladder
                   ESCALATEs (max_attempts=2, debugger_cycles=0,
                   escalation_timeout_s=900): real EscalationWorkflow child,
                   real store row, real webhook Escalation payload; left open;
4. ``standalone-escalation`` ``start_escalation(... timeout_s=1200)``; left open;
5. ``question``    a 1-node epic whose attempt carries the ``## OPERATOR
                   QUESTION`` marker: real QuestionWorkflow child, real
                   ``questions`` row (8h window), real webhook Question payload;
                   plus a standalone QuestionWorkflow with ``timeout_s=5`` that
                   expires for real;
6. ``refusal``     the COMPLETED landing epic queried under
                   ``QueryRejectCondition.NOT_OPEN``, rendered by the real
                   ``ergane build status --json`` code path;
7. ``bridge-rulings`` ``CallbackBridge.handle_relay`` outcomes: UNKNOWN, EXPIRED,
                   UNAUTHORIZED, RESOLVED (answers the open question — last),
                   ALREADY_RESOLVED;
8. ``supervision`` ``send_alert(StackAlert(...))`` (actionless Notice,
                   correlation id ``supervision``) and the roadmap notice
                   activity through ``ActivityEnvironment``;
9. ``webhook/`` one file per payload kind, ``manifest.json``, summary table.

Nothing under the ergane checkout is modified. Escalation/question workflows
are left open by default (``--keep-open``); their ids are printed at the end
so the operator can ``ergane build kill`` / ``temporal workflow terminate``
them once the open-state documents have been captured.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import dataclasses
import enum
import importlib
import io
import json
import logging
import os
import secrets
import subprocess
import sys
import threading
import time
import types
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

# --- constants ----------------------------------------------------------------

DEFAULT_CHECKOUT = Path("/home/tharpeboxadmin/code/ergane")
DEFAULT_OUT = Path("/home/tharpeboxadmin/code/ergane-web/fixtures/raw-harness")
DEFAULT_TEMPORAL = "127.0.0.1:7233"
DEFAULT_NAMESPACE = "ergane"
EXPECTED_PYTHON = Path.home() / ".local/share/uv/tools/ergane-cli/bin/python"

#: The env contract the factory reads (names only — values are never written
#: into any fixture or envelope).
ENV_DB = "ERGANE_VERIFICATION_DB_PATH"
ENV_ALLOW_REAL = "ERGANE_EVIDENCE_STORE_ALLOW_REAL"
ENV_ADAPTER = "ERGANE_ESCALATION_ADAPTER"
ENV_WEBHOOK = "ERGANE_WEBHOOK_URL"
ENV_ROOT = "ERGANE_ROOT"

#: The scripted notify activities the harness registers that this script
#: replaces with the real ones from ``factory.activities.notify_activities``.
REAL_NOTIFY_ACTIVITY_NAMES = (
    "send_escalation",
    "expire_escalation",
    "send_question",
    "expire_question",
    "find_ferried_question",
)

#: Real seconds added in front of two scripted landing activities so the
#: PASSED and PR_OPEN states survive long enough for a 0.5 s status poll.
LANDING_DELAYS_S = {"prepare_landing_pr": 2.0, "enqueue_landing": 2.0}

#: The landing poll beat the fixture epics run on (the production default is
#: 60 s, which would cost a minute per node against a real server).
LANDING_POLL_INTERVAL_S = 3

#: The non-default escalation windows, so ``expires_at != sent_at + 3600``.
PAGED_ESCALATION_TIMEOUT_S = 900
STANDALONE_ESCALATION_TIMEOUT_S = 1200
#: The standalone question that is allowed to expire for real.
EXPIRING_QUESTION_TIMEOUT_S = 5

SENDER_IDENTITY = "fixture-operator"

log = logging.getLogger("record-fixtures")


# --- small helpers --------------------------------------------------------------


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def hex6() -> str:
    return secrets.token_hex(3)


def to_jsonable(value: Any) -> Any:
    """``dataclasses.asdict`` plus enums to their value — recursively.

    Applied to every object this script hands to ``json.dumps`` so a document
    is the seam's object, serialized, and nothing else.
    """
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return to_jsonable(dataclasses.asdict(value))
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [to_jsonable(v) for v in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value


def dumps(document: Any) -> str:
    return json.dumps(to_jsonable(document), indent=2, ensure_ascii=False, default=str)


def redacted_url(port: int) -> str:
    return f"http://127.0.0.1:{port}/<redacted>"


class WaitTimeout(RuntimeError):
    """A time-boxed wait gave up; the message says what it was waiting for."""


async def wait_until(
    probe: Callable[[], Any],
    *,
    what: str,
    timeout: float,
    interval: float = 0.5,
) -> Any:
    """Poll ``probe`` (sync or async) until it returns a truthy value."""
    deadline = time.monotonic() + timeout
    last: Any = None
    while True:
        last = probe()
        if asyncio.iscoroutine(last):
            last = await last
        if last:
            return last
        if time.monotonic() >= deadline:
            raise WaitTimeout(
                f"timed out after {timeout:.0f}s waiting for {what}; "
                f"last probe value: {last!r}"
            )
        await asyncio.sleep(interval)


# --- the webhook recorder -------------------------------------------------------


class WebhookRecorder:
    """A stdlib HTTP server that journals every POST the webhook adapter makes.

    Bound to 127.0.0.1 on a random port, under a random 16-hex secret path. The
    secret never reaches a fixture: the journal's ``path`` column is redacted.
    """

    def __init__(self, sink: Path | None) -> None:
        self.secret = secrets.token_hex(8)
        self.records: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        self._sink = sink
        recorder = self

        class Handler(BaseHTTPRequestHandler):
            server_version = "record-fixtures-harness/1"

            def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
                log.debug("webhook recorder: " + format, *args)

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length)
                if self.path != f"/{recorder.secret}":
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b'{"ok": false}')
                    return
                try:
                    body: Any = json.loads(raw.decode("utf-8"))
                except Exception:
                    body = {"_unparsed": raw.decode("utf-8", "replace")}
                record = {
                    "received_at": now_iso(),
                    "method": "POST",
                    "path": "/<redacted>",
                    "headers": {
                        key: value
                        for key, value in self.headers.items()
                        if key.lower()
                        in ("content-type", "content-length", "user-agent", "accept")
                    },
                    "body": body,
                }
                recorder._append(record)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok": true}')

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = int(self._server.server_address[1])
        self._thread = threading.Thread(
            target=self._server.serve_forever, name="webhook-recorder", daemon=True
        )
        self._thread.start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}/{self.secret}"

    @property
    def redacted(self) -> str:
        return redacted_url(self.port)

    def _append(self, record: dict[str, Any]) -> None:
        with self._lock:
            self.records.append(record)
            if self._sink is not None:
                self._sink.parent.mkdir(parents=True, exist_ok=True)
                with self._sink.open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        body = record["body"]
        cid = body.get("correlation_id") if isinstance(body, dict) else None
        log.info("webhook recorder: received payload correlation_id=%s", cid)

    def find(self, correlation_id: str) -> dict[str, Any] | None:
        with self._lock:
            for record in self.records:
                body = record["body"]
                if isinstance(body, dict) and body.get("correlation_id") == correlation_id:
                    return record
        return None

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()


# --- the fixture writer ---------------------------------------------------------


class FixtureWriter:
    """Writes ``<name>.json`` + ``<name>.envelope.json`` and keeps the manifest."""

    def __init__(self, out: Path, *, run_id: str, webhook_redacted: str, checkout_rev: str | None) -> None:
        self.out = out
        self.run_id = run_id
        self.webhook_redacted = webhook_redacted
        self.checkout_rev = checkout_rev
        self.entries: list[dict[str, Any]] = []

    def write(
        self,
        relpath: str,
        document: Any,
        *,
        scene: str,
        seam: str,
        workflow_id: str | None = None,
        notes: str | None = None,
    ) -> Path:
        path = self.out / relpath
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dumps(document) + "\n", encoding="utf-8")
        envelope = {
            "captured_at": now_iso(),
            "scene": scene,
            "seam": seam,
            "workflow_id": workflow_id,
            "notes": notes,
            "document": relpath,
            "run_id": self.run_id,
            "recorder": "scripts/record-fixtures-harness.py",
            "ergane_checkout_revision": self.checkout_rev,
            "webhook_url": self.webhook_redacted,
        }
        envelope_path = path.with_name(path.name[: -len(".json")] + ".envelope.json")
        envelope_path.write_text(dumps(envelope) + "\n", encoding="utf-8")
        self.entries.append(
            {
                "file": relpath,
                "envelope": str(envelope_path.relative_to(self.out)),
                "scene": scene,
                "seam": seam,
                "workflow_id": workflow_id,
                "captured_at": envelope["captured_at"],
            }
        )
        log.info("wrote %s  [%s]", relpath, scene)
        return path


# --- environment and imports ----------------------------------------------------


def resolve_db_path(explicit: str | None) -> Path:
    """``--db`` > $ERGANE_VERIFICATION_DB_PATH > $ERGANE_ROOT/verification.db > the
    operator env script's own default root."""
    if explicit:
        return Path(explicit).expanduser()
    from_env = os.environ.get(ENV_DB)
    if from_env:
        return Path(from_env).expanduser()
    root = os.environ.get(ENV_ROOT)
    if root:
        return Path(root).expanduser() / "verification.db"
    return Path.home() / ".local/state/ergane/runtime/verification.db"


def configure_environment(db_path: Path, webhook_url: str) -> dict[str, str]:
    """Set the factory's env contract BEFORE ``factory`` is imported.

    Returns ``{name: 'set'|'overridden'|'kept'}`` for the log — names only.
    """
    outcome: dict[str, str] = {}

    def put(name: str, value: str, *, force: bool) -> None:
        present = name in os.environ
        if present and not force and os.environ[name] == value:
            outcome[name] = "kept"
            return
        if present and os.environ[name] != value:
            outcome[name] = "overridden"
        else:
            outcome[name] = "set"
        os.environ[name] = value

    put(ENV_DB, str(db_path), force=True)
    put(ENV_ALLOW_REAL, "1", force=True)
    put(ENV_ADAPTER, "webhook", force=True)
    put(ENV_WEBHOOK, webhook_url, force=True)
    return outcome


def install_pytest_stub() -> bool:
    """``tests/test_interpreter.py`` imports pytest at module level and uses only
    ``@pytest.fixture`` and ``@pytest.mark.parametrize`` at import time. The tool
    venv has no pytest, so a minimal stand-in is installed when the real one is
    missing. Returns True if the stub was installed."""
    try:
        importlib.import_module("pytest")
        return False
    except ModuleNotFoundError:
        pass

    stub = types.ModuleType("pytest")

    def fixture(*args: Any, **kwargs: Any) -> Any:
        if len(args) == 1 and callable(args[0]) and not kwargs:
            return args[0]
        return lambda fn: fn

    class _Mark:
        def __getattr__(self, name: str) -> Any:
            def marker(*args: Any, **kwargs: Any) -> Any:
                if len(args) == 1 and callable(args[0]) and not kwargs:
                    return args[0]
                return lambda fn: fn

            return marker

    class _Raises:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.value: Any = None

        def __enter__(self) -> "_Raises":
            return self

        def __exit__(self, *exc: Any) -> bool:
            return False

    def fail(message: str = "") -> None:
        raise AssertionError(message)

    stub.fixture = fixture  # type: ignore[attr-defined]
    stub.mark = _Mark()  # type: ignore[attr-defined]
    stub.raises = _Raises  # type: ignore[attr-defined]
    stub.fail = fail  # type: ignore[attr-defined]
    stub.param = lambda *a, **k: a  # type: ignore[attr-defined]
    stub.approx = lambda x, *a, **k: x  # type: ignore[attr-defined]
    stub.__stub__ = True  # type: ignore[attr-defined]
    sys.modules["pytest"] = stub
    return True


@dataclasses.dataclass
class Seams:
    """Everything imported from the checkout, in one place."""

    checkout: Path
    pytest_stubbed: bool
    factory: Any
    harness: Any
    notify_activities: Any
    store: Any
    workflow_module: Any
    EpicWorkflow: Any
    EscalationWorkflow: Any
    QuestionWorkflow: Any
    escalation_client: Any
    escalation_workflow: Any
    question_module: Any
    service: Any
    adapter: Any
    webhook: Any
    alert: Any
    messages: Any
    verify_models: Any
    mergequeue_models: Any
    build_cli: Any
    nouns_pkg: Any
    temporalio_client: Any
    temporalio_common: Any
    temporalio_testing: Any
    temporalio_activity: Any
    TASK_QUEUE: str


def import_seams(checkout: Path) -> Seams:
    """Put the checkout FIRST on ``sys.path`` and import everything the scenes use."""
    checkout = checkout.resolve()
    if not (checkout / "factory" / "__init__.py").exists():
        raise SystemExit(f"not an ergane checkout: {checkout}")
    if not (checkout / "tests" / "__init__.py").exists():
        raise SystemExit(f"{checkout}/tests/__init__.py is missing; cannot import the harness as a package")
    if "factory" in sys.modules:
        raise SystemExit("factory was imported before the checkout was put on sys.path")
    sys.path.insert(0, str(checkout))

    pytest_stubbed = install_pytest_stub()

    factory = importlib.import_module("factory")
    factory_file = Path(factory.__file__).resolve()
    if not str(factory_file).startswith(str(checkout)):
        raise SystemExit(
            f"factory resolved to {factory_file}, not the checkout under {checkout}"
        )

    harness = importlib.import_module("tests.test_interpreter")
    notify_activities = importlib.import_module("factory.activities.notify_activities")
    store = importlib.import_module("factory.verify.store")
    workflow_module = importlib.import_module("factory.workgraph.workflow")
    escalation_client = importlib.import_module("factory.escalation.client")
    escalation_workflow = importlib.import_module("factory.escalation.workflow")
    question_module = importlib.import_module("factory.escalation.question")
    service = importlib.import_module("factory.notify.service")
    adapter = importlib.import_module("factory.notify.adapter")
    webhook = importlib.import_module("factory.notify.webhook")
    alert = importlib.import_module("factory.supervision.alert")
    messages = importlib.import_module("factory.notify.messages")
    verify_models = importlib.import_module("factory.verify.models")
    mergequeue_models = importlib.import_module("factory.mergequeue.models")
    nouns_pkg = importlib.import_module("factory.cli.nouns")
    build_cli = importlib.import_module("factory.cli.nouns.build")
    temporalio_client = importlib.import_module("temporalio.client")
    temporalio_common = importlib.import_module("temporalio.common")
    temporalio_testing = importlib.import_module("temporalio.testing")
    temporalio_activity = importlib.import_module("temporalio.activity")

    task_queue = workflow_module.TASK_QUEUE
    if task_queue != harness.TASK_QUEUE:
        raise SystemExit(
            f"task queue drift: factory.workgraph.workflow.TASK_QUEUE={task_queue!r} "
            f"but the harness pins {harness.TASK_QUEUE!r}"
        )

    return Seams(
        checkout=checkout,
        pytest_stubbed=pytest_stubbed,
        factory=factory,
        harness=harness,
        notify_activities=notify_activities,
        store=store,
        workflow_module=workflow_module,
        EpicWorkflow=workflow_module.EpicWorkflow,
        EscalationWorkflow=escalation_workflow.EscalationWorkflow,
        QuestionWorkflow=question_module.QuestionWorkflow,
        escalation_client=escalation_client,
        escalation_workflow=escalation_workflow,
        question_module=question_module,
        service=service,
        adapter=adapter,
        webhook=webhook,
        alert=alert,
        messages=messages,
        verify_models=verify_models,
        mergequeue_models=mergequeue_models,
        build_cli=build_cli,
        nouns_pkg=nouns_pkg,
        temporalio_client=temporalio_client,
        temporalio_common=temporalio_common,
        temporalio_testing=temporalio_testing,
        temporalio_activity=temporalio_activity,
        TASK_QUEUE=task_queue,
    )


def checkout_revision(checkout: Path) -> str | None:
    try:
        return (
            subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=checkout,
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
            or None
        )
    except Exception:
        return None


# --- the activity list: scripted world + real notify activities -----------------


def activity_name(seams: Seams, fn: Any) -> str:
    definition = seams.temporalio_activity._Definition.from_callable(fn)
    if definition is None or not definition.name:
        raise SystemExit(f"not an activity definition: {fn!r}")
    return str(definition.name)


def patch_world_activities(seams: Seams, script: Any, *, landing_delays: dict[str, float]) -> list[str]:
    """Make ``script.activities()`` hand back the harness list with the notify
    fakes replaced by the real activities (and two landing fakes slowed down).

    ``start_epic`` calls ``script.activities()`` when it opens the Worker, so an
    instance attribute shadowing the method is enough — the harness itself is
    untouched. Returns the names that were replaced, for the log.
    """
    activity = seams.temporalio_activity
    original_method = script.activities
    notify = seams.notify_activities
    real = {name: getattr(notify, name) for name in REAL_NOTIFY_ACTIVITY_NAMES}
    harness_mod = seams.harness

    def build() -> list[Any]:
        by_name: dict[str, Any] = {}
        for fn in original_method():
            by_name[activity_name(seams, fn)] = fn
        missing = [name for name in real if name not in by_name]
        if missing:
            raise SystemExit(
                f"harness drift: the scripted world no longer registers {missing}; "
                "read tests/test_interpreter.py ScriptedWorld.activities()"
            )
        for name, fn in real.items():
            if activity_name(seams, fn) != name:
                raise SystemExit(f"real activity {fn!r} is not named {name!r}")
            by_name[name] = fn

        def delayed(name: str, input_type: Any) -> None:
            inner = by_name[name]
            delay = landing_delays[name]

            async def slow(request: Any) -> Any:
                await asyncio.sleep(delay)
                return await inner(request)

            # `from __future__ import annotations` would leave the hint a string
            # the SDK cannot evaluate in this scope; set it as a real type so the
            # worker decodes the argument exactly as the scripted fake would.
            slow.__name__ = name
            slow.__qualname__ = name
            slow.__annotations__ = {"request": input_type, "return": Any}
            by_name[name] = activity.defn(name=name)(slow)

        if "prepare_landing_pr" in landing_delays:
            delayed("prepare_landing_pr", harness_mod.PrepareLandingPrInput)
        if "enqueue_landing" in landing_delays:
            delayed("enqueue_landing", harness_mod.EnqueueLandingInput)

        return list(by_name.values())

    script.activities = build
    return list(real)


# --- status polling -------------------------------------------------------------


def summarize(document: dict[str, Any]) -> str:
    nodes = document.get("nodes") or {}
    parts = []
    for node_id, node in nodes.items():
        state = node.get("state")
        flag = "+op" if node.get("awaiting_operator") else ""
        parts.append(f"{node_id}-{state}{flag}")
    return f"{document.get('epic_state')}_" + "_".join(parts)


class StatusRecorder:
    """Polls ``epic_status`` (raw payload, the way ``ergane build status --json``
    reads it) and writes every distinct document as a numbered snapshot."""

    def __init__(self, seams: Seams, writer: FixtureWriter, *, scene: str, epic_id: str, handle: Any) -> None:
        self.seams = seams
        self.writer = writer
        self.scene = scene
        self.epic_id = epic_id
        self.handle = handle
        self.seq = 0
        self.last_key: str | None = None
        self.last_document: dict[str, Any] | None = None
        self.snapshots: list[str] = []
        self.states_seen: set[str] = set()

    async def query(self) -> dict[str, Any]:
        return await self.handle.query("epic_status")

    def record(self, document: dict[str, Any]) -> bool:
        key = json.dumps(document, sort_keys=True, default=str)
        if key == self.last_key:
            return False
        self.last_key = key
        self.last_document = document
        self.seq += 1
        for node in (document.get("nodes") or {}).values():
            if isinstance(node, dict) and node.get("state"):
                self.states_seen.add(str(node["state"]))
        relpath = f"epic-status/{self.epic_id}-{self.seq:02d}-{summarize(document)}.json"
        self.writer.write(
            relpath,
            document,
            scene=self.scene,
            seam='WorkflowHandle.query("epic_status") — raw payload JSON, as factory/cli/nouns/build.py:_query_status reads it',
            workflow_id=self.handle.id,
            notes=f"distinct snapshot #{self.seq} of epic {self.epic_id}, polled every 0.5s",
        )
        self.snapshots.append(relpath)
        return True

    async def watch_until(self, predicate: Callable[[dict[str, Any]], bool], *, what: str, timeout: float, interval: float = 0.5) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while True:
            document = await self.query()
            self.record(document)
            if predicate(document):
                return document
            if time.monotonic() >= deadline:
                raise WaitTimeout(
                    f"timed out after {timeout:.0f}s waiting for {what} on epic "
                    f"{self.epic_id}; last status summary: {summarize(document)}"
                )
            await asyncio.sleep(interval)


# --- Temporal helpers -----------------------------------------------------------


async def live_pollers(seams: Seams, client: Any, queue: str) -> list[dict[str, Any]]:
    """Pollers Temporal reports on the task queue (best effort)."""
    try:
        from temporalio.api.enums.v1 import TaskQueueType
        from temporalio.api.taskqueue.v1 import TaskQueue
        from temporalio.api.workflowservice.v1 import DescribeTaskQueueRequest
    except Exception as exc:  # pragma: no cover - proto layout drift
        log.warning("cannot import the DescribeTaskQueue protos (%s); skipping the poller check", type(exc).__name__)
        return []
    found: list[dict[str, Any]] = []
    for kind in (TaskQueueType.TASK_QUEUE_TYPE_WORKFLOW, TaskQueueType.TASK_QUEUE_TYPE_ACTIVITY):
        try:
            response = await client.workflow_service.describe_task_queue(
                DescribeTaskQueueRequest(
                    namespace=client.namespace,
                    task_queue=TaskQueue(name=queue),
                    task_queue_type=kind,
                )
            )
        except Exception as exc:
            log.warning("DescribeTaskQueue failed (%s); skipping the poller check", type(exc).__name__)
            return []
        for poller in response.pollers:
            last = poller.last_access_time.ToDatetime(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - last).total_seconds()
            if age <= 90:
                found.append({"identity": poller.identity, "kind": TaskQueueType.Name(kind), "age_s": round(age)})
    return found


def webhook_kind(body: dict[str, Any]) -> str:
    cid = str(body.get("correlation_id", ""))
    actions = body.get("actions") or []
    is_hex12 = len(cid) == 12 and all(c in "0123456789abcdef" for c in cid)
    if is_hex12 and actions:
        return "escalation"
    if is_hex12:
        return "question"
    return "notice"


# --- the run --------------------------------------------------------------------


@dataclasses.dataclass
class RunState:
    run_id: str
    epic_ids: dict[str, str] = dataclasses.field(default_factory=dict)
    workflow_ids: dict[str, str] = dataclasses.field(default_factory=dict)
    escalation_ids: dict[str, str] = dataclasses.field(default_factory=dict)
    question_ids: dict[str, str] = dataclasses.field(default_factory=dict)
    open_after_run: list[tuple[str, str]] = dataclasses.field(default_factory=list)
    landing_handle: Any = None
    webhook_correlations: dict[str, str] = dataclasses.field(default_factory=dict)


async def scene_landing(seams: Seams, env: Any, writer: FixtureWriter, state: RunState, *, timeout: float, worker_revision: str | None) -> None:
    h = seams.harness
    epic_id = f"fx-landing-{hex6()}"
    wf_id = seams.build_cli.workflow_id(epic_id)
    state.epic_ids["landing"] = epic_id
    state.workflow_ids["landing"] = wf_id
    log.info("scene landing: epic %s (workflow %s)", epic_id, wf_id)

    script = h.ScriptedWorld(h.all_passing(), client=env.client)
    for node_id in ("us1", "us2", "us3"):
        script.script_landing(node_id, h.pending_snapshot(), h.merged_snapshot())
    patch_world_activities(seams, script, landing_delays=LANDING_DELAYS_S)

    graph = h.make_graph(
        [
            h.make_node("us1", "US1"),
            h.make_node("us2", "US2", depends_on_merged=["us1"]),
            h.make_node("us3", "US3", depends_on=["us2"]),
        ],
        epic_id=epic_id,
    )
    landing_config = seams.mergequeue_models.LandingConfig(poll_interval_s=LANDING_POLL_INTERVAL_S)

    async with h.start_epic(
        env,
        script,
        graph=graph,
        workflow_id=wf_id,
        landing_config=landing_config,
        landing_overrides=("poll_interval_s",),
        worker_revision=worker_revision,
    ) as handle:
        state.landing_handle = handle
        recorder = StatusRecorder(seams, writer, scene="landing", epic_id=epic_id, handle=handle)
        final = await recorder.watch_until(
            lambda d: d.get("epic_state") == "COMPLETED",
            what="the landing epic to reach COMPLETED",
            timeout=timeout,
        )
        result = await asyncio.wait_for(handle.result(), timeout=30)

    writer.write(
        f"epic-status/{epic_id}-final.json",
        final,
        scene="landing",
        seam='WorkflowHandle.query("epic_status") after COMPLETED',
        workflow_id=wf_id,
        notes="the last status document; the states seen on the way are the numbered snapshots",
    )
    writer.write(
        f"epic-status/{epic_id}-result.json",
        result,
        scene="landing",
        seam="WorkflowHandle.result() — EpicStatus via dataclasses.asdict",
        workflow_id=wf_id,
        notes="the workflow's own return value (typed EpicStatus), for comparison with the query document",
    )
    log.info(
        "scene landing: %d distinct snapshots; node states seen: %s",
        len(recorder.snapshots),
        sorted(recorder.states_seen),
    )
    for needed in ("PASSED", "PR_OPEN", "ENQUEUED", "MERGED"):
        if needed not in recorder.states_seen:
            log.warning("scene landing: no snapshot caught a node in %s (poll too coarse?)", needed)


def store_conn(seams: Seams, db_path: Path) -> Any:
    return seams.store.connect(db_path)


async def scene_paged_and_standalone(seams: Seams, env: Any, writer: FixtureWriter, state: RunState, *, db_path: Path, recorder: WebhookRecorder, timeout: float, worker_revision: str | None) -> None:
    h = seams.harness
    vm = seams.verify_models
    epic_id = f"fx-paged-{hex6()}"
    wf_id = seams.build_cli.workflow_id(epic_id)
    state.epic_ids["paged"] = epic_id
    state.workflow_ids["paged"] = wf_id
    log.info("scene paged-while-verifying: epic %s (workflow %s)", epic_id, wf_id)

    script = h.ScriptedWorld({"us1": [h.failing(1), h.failing(2)]}, client=env.client)
    patch_world_activities(seams, script, landing_delays={})
    graph = h.make_graph([h.make_node("us1", "US1")], epic_id=epic_id)
    config = vm.VerificationConfig(max_attempts=2, debugger_cycles=0, escalation_timeout_s=PAGED_ESCALATION_TIMEOUT_S)

    async with h.start_epic(
        env,
        script,
        graph=graph,
        workflow_id=wf_id,
        config=config,
        worker_revision=worker_revision,
    ) as handle:
        status = StatusRecorder(seams, writer, scene="paged-while-verifying", epic_id=epic_id, handle=handle)
        paged = await status.watch_until(
            lambda d: (d.get("nodes") or {}).get("us1", {}).get("state") == "VERIFYING"
            and bool((d.get("nodes") or {}).get("us1", {}).get("awaiting_operator")),
            what="us1 to sit VERIFYING with awaiting_operator=True",
            timeout=timeout,
        )
        writer.write(
            f"epic-status/{epic_id}-paged.json",
            paged,
            scene="paged-while-verifying",
            seam='WorkflowHandle.query("epic_status") while the node is parked on an EscalationWorkflow child',
            workflow_id=wf_id,
            notes="state == VERIFYING and awaiting_operator == true: the ladder returned ESCALATE after 2 failing attempts (max_attempts=2, debugger_cycles=0)",
        )

        # The child escalation: find it through the real listing, then wait for
        # its row and its webhook payload (send_escalation runs on the child's
        # first task, which may land a beat after the park is visible).
        async def our_open() -> Any:
            found = await seams.escalation_client.open_escalations(env.client)
            ours = [item for item in found if item.epic_id == epic_id]
            return ours or None

        ours = await wait_until(our_open, what="the paged epic's EscalationWorkflow to be listed open", timeout=timeout)
        paged_escalation_id = ours[0].escalation_id
        state.escalation_ids["paged"] = paged_escalation_id
        # Parent first: terminating the epic closes its child (parent close
        # policy), while terminating the child first would fail the parent.
        state.open_after_run.append(("EpicWorkflow (paged, parked VERIFYING)", wf_id))
        state.open_after_run.append(("EscalationWorkflow (child of the paged epic)", paged_escalation_id))
        log.info("paged escalation id: %s", paged_escalation_id)

        all_open = await seams.escalation_client.open_escalations(env.client)
        ours_only = tuple(item for item in all_open if item.escalation_id in {paged_escalation_id})
        writer.write(
            "escalations/open_escalations.json",
            ours_only,
            scene="paged-while-verifying",
            seam="factory.escalation.client.open_escalations(client) — tuple[OpenEscalation] via asdict",
            workflow_id=paged_escalation_id,
            notes=(
                f"filtered to this run's escalation ids; {len(all_open) - len(ours_only)} foreign open "
                "escalation(s) in the namespace were omitted (not hand-edited otherwise)"
            ),
        )

        await wait_until(lambda: recorder.find(paged_escalation_id), what="the webhook Escalation payload for the paged epic", timeout=timeout)
        state.webhook_correlations[paged_escalation_id] = "escalation"

        with contextlib.closing(store_conn(seams, db_path)) as conn:
            row = seams.store.get_escalation(conn, paged_escalation_id)
            pending = [r for r in seams.store.pending_escalations(conn) if r.epic_id == epic_id]
        writer.write(
            "escalations/store-rows.json",
            {"get_escalation": row, "pending_escalations": pending},
            scene="paged-while-verifying",
            seam="factory.verify.store.get_escalation / pending_escalations (EscalationRecord via asdict)",
            workflow_id=paged_escalation_id,
            notes=(
                "sent_at/expires_at were written by notify_activities._pending_record with timeout_s=900, "
                "so expires_at == sent_at + 15min, not + 1h; pending_escalations filtered to this epic"
            ),
        )

        # --- scene standalone-escalation ------------------------------------
        ew = seams.escalation_workflow
        standalone_epic = f"fx-standalone-{hex6()}"
        request = ew.EscalationRequest(
            epic_id=standalone_epic,
            node_id="us1",
            history_summary=(
                "attempt 1: gate `test` FAIL (exit 1)\n"
                "  E   AssertionError: attempt-one recorded no loan against the member\n"
                "attempt 2: gate `test` FAIL (exit 1)\n"
                "  E   TypeError: attempt-two Catalogue.borrow() missing 1 argument\n"
            ),
            question="Keep retrying the loans ledger, or stop here?",
            choices=list(seams.notify_activities.DEFAULT_CHOICES),
            timeout_s=STANDALONE_ESCALATION_TIMEOUT_S,
        )
        standalone = await seams.escalation_client.start_escalation(env.client, request, task_queue=seams.TASK_QUEUE)
        standalone_id = standalone.id
        state.escalation_ids["standalone"] = standalone_id
        state.epic_ids["standalone"] = standalone_epic
        state.open_after_run.append(("EscalationWorkflow (standalone)", standalone_id))
        log.info("scene standalone-escalation: %s (epic label %s)", standalone_id, standalone_epic)

        async def standalone_open() -> Any:
            found = await seams.escalation_client.open_escalations(env.client)
            return [item for item in found if item.escalation_id == standalone_id] or None

        await wait_until(standalone_open, what="the standalone escalation to be listed open", timeout=timeout)
        all_open = await seams.escalation_client.open_escalations(env.client)
        ours_only = tuple(item for item in all_open if item.escalation_id in {paged_escalation_id, standalone_id})
        writer.write(
            "escalations/open_escalations-2.json",
            ours_only,
            scene="standalone-escalation",
            seam="factory.escalation.client.open_escalations(client) — tuple[OpenEscalation] via asdict",
            workflow_id=standalone_id,
            notes=(
                f"two open escalations from this run (paged child + standalone, timeout_s=1200); "
                f"{len(all_open) - len(ours_only)} foreign open escalation(s) omitted"
            ),
        )
        await wait_until(lambda: recorder.find(standalone_id), what="the webhook Escalation payload for the standalone escalation", timeout=timeout)
        state.webhook_correlations[standalone_id] = "escalation-standalone"
        with contextlib.closing(store_conn(seams, db_path)) as conn:
            row = seams.store.get_escalation(conn, standalone_id)
        writer.write(
            "escalations/store-row-standalone.json",
            row,
            scene="standalone-escalation",
            seam="factory.verify.store.get_escalation (EscalationRecord via asdict)",
            workflow_id=standalone_id,
            notes="timeout_s=1200 → expires_at == sent_at + 20min",
        )


async def scene_refusal(seams: Seams, client: Any, writer: FixtureWriter, state: RunState) -> None:
    tc = seams.temporalio_client
    common = seams.temporalio_common
    epic_id = state.epic_ids["landing"]
    wf_id = state.workflow_ids["landing"]
    handle = client.get_workflow_handle(wf_id)

    # (a) the provocation itself, recorded as the exception the SDK raises
    exception_doc: dict[str, Any]
    try:
        await handle.query("epic_status", reject_condition=common.QueryRejectCondition.NOT_OPEN)
        exception_doc = {"raised": False, "note": "the query was NOT rejected — is the landing epic still open?"}
        log.warning("refusal scene: the NOT_OPEN query was not rejected")
    except (tc.WorkflowQueryRejectedError, tc.WorkflowQueryFailedError) as error:
        exception_doc = {
            "raised": True,
            "exception_type": type(error).__name__,
            "message": str(error),
            "status": getattr(getattr(error, "status", None), "name", None),
        }
    writer.write(
        "epic-status/refusal-exception.json",
        exception_doc,
        scene="refusal",
        seam="WorkflowHandle.query('epic_status', reject_condition=QueryRejectCondition.NOT_OPEN) on a COMPLETED execution",
        workflow_id=wf_id,
        notes="the SDK exception the CLI's QUERY_REFUSED tuple catches (factory/cli/nouns/build.py:46-51)",
    )

    # (b) the document exactly as `ergane build status --json` prints it: the
    # real _query_status code path, fed a client whose default reject condition
    # is NOT_OPEN through the package-level _open_client seam the CLI's tests patch.
    rejecting = tc.Client(
        client.service_client,
        namespace=client.namespace,
        default_workflow_query_reject_condition=common.QueryRejectCondition.NOT_OPEN,
    )

    async def open_rejecting() -> Any:
        return rejecting

    original = seams.nouns_pkg._open_client
    seams.nouns_pkg._open_client = open_rejecting
    buffer = io.StringIO()
    try:
        with contextlib.redirect_stdout(buffer):
            code = await seams.build_cli._query_status(epic_id, as_json=True)
    finally:
        seams.nouns_pkg._open_client = original
    printed = buffer.getvalue()
    try:
        document = json.loads(printed)
    except json.JSONDecodeError:
        document = {"_raw_stdout": printed}
    writer.write(
        "epic-status/refusal.json",
        document,
        scene="refusal",
        seam="factory.cli.nouns.build._query_status(epic_id, as_json=True) — stdout JSON, exit code %d" % code,
        workflow_id=wf_id,
        notes=(
            "provocation: the COMPLETED landing epic queried through a Client whose "
            "default_workflow_query_reject_condition is NOT_OPEN, so handle.query('epic_status') raised "
            "WorkflowQueryRejectedError and the CLI degraded: document → {'nodes': {}} plus a 'refusal' key, "
            "execution_status from describe(), exit 0. The client was injected via the "
            "factory.cli.nouns._open_client seam; nothing in the rendering was hand-built."
        ),
    )
    log.info("scene refusal: exit code %d, keys %s", code, sorted(document) if isinstance(document, dict) else "?")


async def scene_question_bridge(seams: Seams, env: Any, writer: FixtureWriter, state: RunState, *, db_path: Path, recorder: WebhookRecorder, timeout: float, worker_revision: str | None) -> None:
    h = seams.harness
    client = env.client
    epic_id = f"fx-question-{hex6()}"
    wf_id = seams.build_cli.workflow_id(epic_id)
    state.epic_ids["question"] = epic_id
    state.workflow_ids["question"] = wf_id
    log.info("scene question: epic %s (workflow %s)", epic_id, wf_id)

    # questioning() + a second passing attempt so the answered re-dispatch is
    # scripted rather than an overrun (the harness's questioning_then_passing
    # shape, minus the fake's in-flight answer: the bridge answers it here).
    script = h.ScriptedWorld({"us1": [h.passing(), h.passing()]}, client=client)
    script.question_bodies["us1"] = h.QUESTION_BODY
    patch_world_activities(seams, script, landing_delays=LANDING_DELAYS_S)
    graph = h.make_graph([h.make_node("us1", "US1")], epic_id=epic_id)
    landing_config = seams.mergequeue_models.LandingConfig(poll_interval_s=LANDING_POLL_INTERVAL_S)

    async with h.start_epic(
        env,
        script,
        graph=graph,
        workflow_id=wf_id,
        landing_config=landing_config,
        landing_overrides=("poll_interval_s",),
        worker_revision=worker_revision,
    ) as handle:
        status = StatusRecorder(seams, writer, scene="question", epic_id=epic_id, handle=handle)
        parked = await status.watch_until(
            lambda d: (d.get("nodes") or {}).get("us1", {}).get("state") == "WAITING_OPERATOR",
            what="us1 to park WAITING_OPERATOR",
            timeout=timeout,
        )
        writer.write(
            f"epic-status/{epic_id}-waiting-operator.json",
            parked,
            scene="question",
            seam='WorkflowHandle.query("epic_status") while the node is parked on a QuestionWorkflow child',
            workflow_id=wf_id,
            notes="state == WAITING_OPERATOR, awaiting_operator == true, epic PAUSED",
        )

        def pending_for_epic() -> Any:
            with contextlib.closing(store_conn(seams, db_path)) as conn:
                rows = [r for r in seams.store.pending_questions(conn) if r.epic_id == epic_id]
            return rows or None

        rows = await wait_until(pending_for_epic, what="the question row to land in the store", timeout=timeout)
        question_id = rows[0].question_id
        state.question_ids["open"] = question_id
        log.info("question id: %s (workflow %s)", question_id, rows[0].workflow_id)
        await wait_until(lambda: recorder.find(question_id), what="the webhook Question payload", timeout=timeout)
        state.webhook_correlations[question_id] = "question"

        with contextlib.closing(store_conn(seams, db_path)) as conn:
            pending_all = seams.store.pending_questions(conn)
            pending_ours = [r for r in pending_all if r.epic_id == epic_id]
            one = seams.store.get_question(conn, question_id)
        writer.write(
            "questions/pending_questions.json",
            {"pending_questions": pending_ours, "get_question": one},
            scene="question",
            seam="factory.verify.store.pending_questions / get_question (QuestionRecord via asdict)",
            workflow_id=rows[0].workflow_id,
            notes=(
                f"sent_at/expires_at written by notify_activities._pending_question (QUESTION_TIMEOUT_S=28800 → +8h); "
                f"message_id is null because the webhook transport mints none; "
                f"{len(pending_all) - len(pending_ours)} foreign pending question(s) omitted"
            ),
        )

        # A standalone question that expires for real (timeout_s=5): the
        # EXPIRED row the bridge's EXPIRED ruling needs, written by the real
        # expire_question activity rather than by hand.
        qm = seams.question_module
        expiring_epic = f"fx-expiring-{hex6()}"
        expiring_id = seams.escalation_client.mint_correlation_id()
        expiring = await client.start_workflow(
            qm.QuestionWorkflow.run,
            qm.QuestionRequest(
                epic_id=expiring_epic,
                node_id="us1",
                attempt=1,
                question_text="Should the loans ledger key on member id or card number?",
                timeout_s=EXPIRING_QUESTION_TIMEOUT_S,
            ),
            id=expiring_id,
            task_queue=seams.TASK_QUEUE,
        )
        state.question_ids["expired"] = expiring_id
        state.epic_ids["expiring"] = expiring_epic
        log.info("expiring question: %s", expiring_id)
        outcome = await asyncio.wait_for(expiring.result(), timeout=timeout)
        await wait_until(lambda: recorder.find(expiring_id), what="the webhook Question payload for the expiring question", timeout=timeout)
        state.webhook_correlations[expiring_id] = "question-expired"
        with contextlib.closing(store_conn(seams, db_path)) as conn:
            expired_row = seams.store.get_question(conn, expiring_id)
        writer.write(
            "questions/expired-question.json",
            {"outcome": outcome, "get_question": expired_row},
            scene="question",
            seam="QuestionWorkflow result (QuestionOutcome) + factory.verify.store.get_question",
            workflow_id=expiring_id,
            notes="a standalone QuestionWorkflow with timeout_s=5; resolution EXPIRED written by the real expire_question activity",
        )

        # --- scene refusal (no worker needed; runs here to keep the stated order)
        await scene_refusal(seams, client, writer, state)

        # --- scene bridge-rulings ---------------------------------------------
        await scene_bridge(seams, client, writer, state, db_path=db_path)

        # The answer un-parks us1; let the epic finish so nothing is left with
        # pending activity tasks for the real worker to pick up.
        final = await status.watch_until(
            lambda d: d.get("epic_state") == "COMPLETED",
            what="the answered question epic to reach COMPLETED",
            timeout=timeout,
        )
        writer.write(
            f"epic-status/{epic_id}-final.json",
            final,
            scene="question",
            seam='WorkflowHandle.query("epic_status") after COMPLETED',
            workflow_id=wf_id,
            notes="the question was answered through CallbackBridge.handle_relay; attempt 2 passed and landed",
        )


async def scene_bridge(seams: Seams, client: Any, writer: FixtureWriter, state: RunState, *, db_path: Path) -> None:
    svc = seams.service
    adapter = seams.adapter
    h = seams.harness
    open_qid = state.question_ids["open"]
    expired_qid = state.question_ids.get("expired")

    bridge = svc.CallbackBridge(db_path=db_path, client=client, authorized_responders=())
    seam = "factory.notify.service.CallbackBridge(db_path, client, authorized_responders=()).handle_relay(InboundRelay)"

    async def ruling(name: str, relay: Any, *, notes: str, bridge_obj: Any = bridge) -> Any:
        outcome = await bridge_obj.handle_relay(relay)
        writer.write(
            f"bridge/{name}.json",
            {"relay": relay, "outcome": outcome},
            scene="bridge-rulings",
            seam=seam,
            workflow_id=relay.correlation_id,
            notes=notes,
        )
        log.info("bridge ruling %s → %s", name, getattr(outcome, "value", outcome))
        return outcome

    await ruling(
        "unknown",
        adapter.InboundRelay(
            correlation_id=seams.escalation_client.mint_correlation_id(),
            reply_text="is anybody there?",
            sender_identity=SENDER_IDENTITY,
        ),
        notes="a fresh 12-hex correlation id no question row carries",
    )
    if expired_qid:
        await ruling(
            "expired",
            adapter.InboundRelay(correlation_id=expired_qid, reply_text="member id", sender_identity=SENDER_IDENTITY),
            notes="the standalone question whose 5s window the real expire_question activity closed",
        )
    else:
        log.warning("bridge: no expired question available; EXPIRED ruling skipped")

    restricted = svc.CallbackBridge(db_path=db_path, client=client, authorized_responders=("someone-else",))
    await ruling(
        "unauthorized",
        adapter.InboundRelay(correlation_id=open_qid, reply_text="Option A", sender_identity=SENDER_IDENTITY),
        notes="a bridge constructed with authorized_responders=('someone-else',); nothing is written and the question stays pending",
        bridge_obj=restricted,
    )

    # MALFORMED is a Telegram-update ruling (CallbackBridge.handle); a relay
    # cannot reach it. The nearest seam is the webhook adapter refusing to
    # translate a body with no correlation id — recorded, not invented.
    malformed_event = {"reply_text": "no correlation id here", "sender_identity": SENDER_IDENTITY}
    translated = seams.webhook.WebhookAdapter().relay(malformed_event)
    writer.write(
        "bridge/malformed-relay.json",
        {"event": malformed_event, "relay": translated, "outcome": None},
        scene="bridge-rulings",
        seam="factory.notify.webhook.WebhookAdapter.relay(event) → None (never reaches handle_relay)",
        workflow_id=None,
        notes="BridgeOutcome.MALFORMED is only produced by CallbackBridge.handle (a Telegram update with no callback_query); handle_relay takes a typed InboundRelay and cannot be malformed, so this documents the adapter-side refusal instead",
    )

    # LAST: the real answer, then the same relay again.
    answer = adapter.InboundRelay(correlation_id=open_qid, reply_text=h.ANSWER_TEXT, sender_identity=SENDER_IDENTITY)
    await ruling("resolved", answer, notes="the open question answered with the harness's ANSWER_TEXT; signals the QuestionWorkflow, then the guarded UPDATE")
    await ruling("already_resolved", answer, notes="the identical relay again; the first resolution stands")

    with contextlib.closing(store_conn(seams, db_path)) as conn:
        answered = seams.store.get_question(conn, open_qid)
    writer.write(
        "questions/answered-question.json",
        answered,
        scene="bridge-rulings",
        seam="factory.verify.store.get_question after RESOLVED",
        workflow_id=answered.workflow_id if answered else None,
        notes="resolution/answer_text/resolved_at as the bridge wrote them",
    )


async def scene_notices(seams: Seams, writer: FixtureWriter, state: RunState, *, recorder: WebhookRecorder, timeout: float) -> None:
    al = seams.alert
    alert = al.StackAlert(service="temporal", condition="not reachable on 127.0.0.1:7233", duration_s=95.0)
    # send_alert owns its own asyncio.run, so it is called off the event loop.
    outcome = await asyncio.to_thread(al.send_alert, alert)
    writer.write(
        "notices/supervision-alert-outcome.json",
        {"alert": alert, "outcome": outcome},
        scene="supervision",
        seam="factory.supervision.alert.send_alert(StackAlert) → AlertOutcome via asdict",
        workflow_id=None,
        notes=f"the transport was the webhook adapter; correlation id {al.SUPERVISION_CORRELATION_ID!r}",
    )
    await wait_until(lambda: recorder.find(al.SUPERVISION_CORRELATION_ID), what="the supervision Notice webhook payload", timeout=timeout)
    state.webhook_correlations[al.SUPERVISION_CORRELATION_ID] = "notice-supervision"

    # The roadmap notice through the real activity in an ActivityEnvironment.
    na = seams.notify_activities
    roadmap_id = f"roadmap-fx-{hex6()}"
    message = seams.messages.roadmap_failure_notice(
        roadmap_id,
        "RoadmapWorkflow: specs root has no ready spec (3 consecutive passes)",
        3,
    )
    env = seams.temporalio_testing.ActivityEnvironment()
    sent = await env.run(na.send_roadmap_notice, na.SendRoadmapNoticeInput(roadmap_id=roadmap_id, message=message))
    writer.write(
        "notices/roadmap-notice-outcome.json",
        {"input": na.SendRoadmapNoticeInput(roadmap_id=roadmap_id, message=message), "outcome": sent},
        scene="supervision",
        seam="factory.activities.notify_activities.send_roadmap_notice via temporalio.testing.ActivityEnvironment",
        workflow_id=roadmap_id,
        notes="message rendered by factory.notify.messages.roadmap_failure_notice; correlation id is the roadmap id",
    )
    await wait_until(lambda: recorder.find(roadmap_id), what="the roadmap Notice webhook payload", timeout=timeout)
    state.webhook_correlations[roadmap_id] = "notice-roadmap"


def write_webhook_files(writer: FixtureWriter, state: RunState, recorder: WebhookRecorder) -> None:
    names_used: set[str] = set()
    for record in list(recorder.records):
        body = record["body"]
        if not isinstance(body, dict):
            continue
        cid = str(body.get("correlation_id", ""))
        name = state.webhook_correlations.get(cid) or webhook_kind(body)
        if name in names_used:
            suffix = 2
            while f"{name}-{suffix}" in names_used:
                suffix += 1
            name = f"{name}-{suffix}"
        names_used.add(name)
        writer.write(
            f"webhook/{name}.json",
            body,
            scene="webhook",
            seam="factory.notify.webhook.WebhookAdapter.deliver — the POST body as received by the recorder",
            workflow_id=cid,
            notes=f"kind={webhook_kind(body)}; full request journal in webhook-received.jsonl",
        )


async def terminate_open(seams: Seams, client: Any, state: RunState) -> None:
    for label, wf_id in state.open_after_run:
        handle = client.get_workflow_handle(wf_id)
        try:
            described = await handle.describe()
            if described.status is not None and described.status.name != "RUNNING":
                log.info("%s %s already %s", label, wf_id, described.status.name)
                continue
            await handle.terminate(reason="record-fixtures-harness --no-keep-open")
            log.info("terminated %s %s", label, wf_id)
        except Exception as exc:
            log.warning("could not terminate %s %s: %s", label, wf_id, type(exc).__name__)


async def run(args: argparse.Namespace, seams: Seams, recorder: WebhookRecorder, db_path: Path) -> int:
    tc = seams.temporalio_client
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    run_id = f"run-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{hex6()}"
    rev = checkout_revision(seams.checkout)
    writer = FixtureWriter(out, run_id=run_id, webhook_redacted=recorder.redacted, checkout_rev=rev)
    state = RunState(run_id=run_id)

    log.info("connecting to Temporal %s namespace %s", args.temporal, args.namespace)
    client = await tc.Client.connect(args.temporal, namespace=args.namespace)
    env = seams.temporalio_testing.WorkflowEnvironment.from_client(client)

    pollers = await live_pollers(seams, client, seams.TASK_QUEUE)
    if pollers:
        log.error("task queue %r already has live pollers: %s", seams.TASK_QUEUE, pollers)
        if not args.allow_foreign_pollers:
            log.error("stop the ergane worker first (or pass --allow-foreign-pollers to proceed anyway)")
            return 2
    worker_revision = rev  # what factory/worker.py:_worker_revision would report for this checkout

    timeout = float(args.wait_timeout)
    try:
        await scene_landing(seams, env, writer, state, timeout=max(timeout, 180.0), worker_revision=worker_revision)
        await scene_paged_and_standalone(seams, env, writer, state, db_path=db_path, recorder=recorder, timeout=timeout, worker_revision=worker_revision)
        await scene_question_bridge(seams, env, writer, state, db_path=db_path, recorder=recorder, timeout=timeout, worker_revision=worker_revision)
        await scene_notices(seams, writer, state, recorder=recorder, timeout=timeout)
    finally:
        write_webhook_files(writer, state, recorder)
        manifest = {
            "run_id": run_id,
            "captured_at": now_iso(),
            "ergane_checkout_revision": rev,
            "temporal_namespace": args.namespace,
            "task_queue": seams.TASK_QUEUE,
            "webhook_url": recorder.redacted,
            "epics": state.epic_ids,
            "workflow_ids": state.workflow_ids,
            "escalation_ids": state.escalation_ids,
            "question_ids": state.question_ids,
            "left_open": [{"what": label, "workflow_id": wf} for label, wf in state.open_after_run],
            "files": writer.entries,
        }
        (out / "manifest.json").write_text(dumps(manifest) + "\n", encoding="utf-8")
        log.info("wrote manifest.json (%d documents)", len(writer.entries))

    if not args.keep_open:
        await terminate_open(seams, client, state)

    print()
    print(f"{'file':70} {'scene':24} seam")
    print("-" * 120)
    for entry in writer.entries:
        print(f"{entry['file']:70} {entry['scene']:24} {entry['seam'][:60]}")
    print()
    print(f"run id: {run_id}   output: {out}")
    print(f"webhook journal: {out / 'webhook-received.jsonl'}  ({len(recorder.records)} payloads)")
    if args.keep_open and state.open_after_run:
        print()
        print("LEFT OPEN on purpose (capture what you need, then clean up):")
        for label, wf_id in state.open_after_run:
            print(f"  {wf_id:40} {label}")
        print()
        print("cleanup hints:")
        print(f"  ergane build kill {state.epic_ids.get('paged', '<paged epic id>')}")
        for label, wf_id in state.open_after_run:
            if "standalone" in label:
                print(f"  temporal workflow terminate --namespace {args.namespace} --workflow-id {wf_id} --reason fixtures")
        print("  (store rows for this run carry epic ids prefixed fx-; delete them from escalations/questions when done)")
    return 0


# --- dry run --------------------------------------------------------------------


def print_plan(args: argparse.Namespace, seams: Seams, db_path: Path, env_outcome: dict[str, str], recorder: WebhookRecorder) -> None:
    h = seams.harness
    print("record-fixtures-harness — dry run (nothing touched Temporal)")
    print()
    print(f"  python            {sys.executable}")
    print(f"  expected python   {EXPECTED_PYTHON}{'' if Path(sys.executable).resolve() == EXPECTED_PYTHON.resolve() else '   (DIFFERENT)'}")
    print(f"  checkout          {seams.checkout}  (rev {checkout_revision(seams.checkout)})")
    print(f"  factory           {Path(seams.factory.__file__).parent}  (version {getattr(seams.factory, '__version__', '?')})")
    print(f"  harness           {seams.harness.__file__}")
    print(f"  pytest            {'stubbed (not installed in the venv)' if seams.pytest_stubbed else 'real'}")
    print(f"  temporal          {args.temporal}  namespace={args.namespace}  task_queue={seams.TASK_QUEUE}")
    print(f"  verification db   {db_path}  ({'exists' if db_path.exists() else 'will be created by store.connect'})")
    print(f"  webhook recorder  {recorder.redacted}")
    print(f"  output            {args.out}")
    print(f"  keep open         {args.keep_open}")
    print(f"  wait timeout      {args.wait_timeout}s per wait (landing: max(that, 180)s)")
    print()
    print("  env (names only): " + ", ".join(f"{k}={v}" for k, v in env_outcome.items()))
    print()
    probe = h.ScriptedWorld(h.all_passing(), client=None)
    names = [activity_name(seams, fn) for fn in probe.activities()]
    replaced = patch_world_activities(seams, probe, landing_delays=LANDING_DELAYS_S)
    patched = [activity_name(seams, fn) for fn in probe.activities()]
    print(f"  harness activities ({len(names)}): {', '.join(names)}")
    print(f"  replaced by real notify activities: {', '.join(replaced)}")
    print(f"  delayed scripted landing activities: {LANDING_DELAYS_S}")
    assert set(patched) == set(names), "activity set drift after patching"
    print()
    print("  scenes:")
    print("   1 webhook recorder (stdlib http.server, random port, random secret path) → webhook-received.jsonl")
    print("   2 landing: 3-node epic fx-landing-<hex6>, all passing; landings pending→merged; poll_interval_s=3;")
    print("       every distinct epic_status → epic-status/<epic>-<seq>-<summary>.json (+ -final, -result)")
    print(f"   3 paged-while-verifying: 1-node epic fx-paged-<hex6>, failing×2, VerificationConfig(max_attempts=2, debugger_cycles=0, escalation_timeout_s={PAGED_ESCALATION_TIMEOUT_S})")
    print("       → epic-status/<epic>-paged.json, escalations/open_escalations.json, escalations/store-rows.json, webhook Escalation")
    print(f"   4 standalone-escalation: start_escalation(timeout_s={STANDALONE_ESCALATION_TIMEOUT_S}) → escalations/open_escalations-2.json, store-row-standalone.json")
    print("   5 question: 1-node epic fx-question-<hex6> with the ## OPERATOR QUESTION marker → WAITING_OPERATOR snapshot,")
    print(f"       questions/pending_questions.json, webhook Question; plus a standalone QuestionWorkflow(timeout_s={EXPIRING_QUESTION_TIMEOUT_S}) that expires")
    print("   6 refusal: COMPLETED landing epic under QueryRejectCondition.NOT_OPEN → epic-status/refusal-exception.json,")
    print("       epic-status/refusal.json via factory.cli.nouns.build._query_status(as_json=True) with _open_client patched")
    print("   7 bridge-rulings: handle_relay → bridge/unknown, expired, unauthorized, malformed-relay (adapter-side), resolved, already_resolved")
    print("   8 supervision: send_alert(StackAlert) → notices/supervision-alert-outcome.json + webhook Notice; send_roadmap_notice via ActivityEnvironment")
    print("   9 webhook/<kind>.json, manifest.json, summary table")
    print()
    print("  before a real run: stop the ergane worker (it polls the same task queue), then")
    print("    eval \"$(~/.config/ergane/ergane-env.sh)\" && " + " ".join([str(EXPECTED_PYTHON), sys.argv[0]]))


# --- main -----------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="record-fixtures-harness.py",
        description=__doc__.split("\n\n")[0],
        epilog="See the module docstring (top of the file) for the scene list and the operator steps.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output directory (default {DEFAULT_OUT})")
    parser.add_argument("--checkout", type=Path, default=DEFAULT_CHECKOUT, help=f"ergane checkout with tests/ (default {DEFAULT_CHECKOUT})")
    parser.add_argument("--db", default=None, help=f"verification store path (default: ${ENV_DB}, then ${ENV_ROOT}/verification.db)")
    parser.add_argument("--temporal", default=DEFAULT_TEMPORAL, help=f"Temporal address (default {DEFAULT_TEMPORAL})")
    parser.add_argument("--namespace", default=DEFAULT_NAMESPACE, help=f"Temporal namespace (default {DEFAULT_NAMESPACE})")
    parser.add_argument("--wait-timeout", type=float, default=120.0, help="seconds each time-boxed wait allows (60-180 recommended; default 120)")
    parser.add_argument("--dry-run", action="store_true", help="import everything, resolve paths, print the plan, exit 0 without touching Temporal")
    parser.add_argument("--keep-open", dest="keep_open", action=argparse.BooleanOptionalAction, default=True, help="leave the escalation/question workflows open at the end (default: yes)")
    parser.add_argument("--allow-foreign-pollers", action="store_true", help="proceed even if another worker is polling the task queue")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.getLogger("temporalio").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if Path(sys.executable).resolve() != EXPECTED_PYTHON.resolve():
        log.warning("running under %s, not %s", sys.executable, EXPECTED_PYTHON)

    db_path = resolve_db_path(args.db)

    # 1. the recorder first: its port is part of the env the factory reads.
    sink = None if args.dry_run else args.out / "webhook-received.jsonl"
    recorder = WebhookRecorder(sink)
    env_outcome = configure_environment(db_path, recorder.url)
    log.info("env configured (names only): %s", ", ".join(f"{k}={v}" for k, v in env_outcome.items()))
    log.info("webhook recorder listening at %s", recorder.redacted)

    try:
        seams = import_seams(args.checkout)
        log.info("imported factory from %s and the harness from %s", Path(seams.factory.__file__).parent, seams.harness.__file__)

        if args.dry_run:
            print_plan(args, seams, db_path, env_outcome, recorder)
            return 0

        return asyncio.run(run(args, seams, recorder, db_path))
    except WaitTimeout as exc:
        log.error("%s", exc)
        return 1
    except KeyboardInterrupt:
        log.error("interrupted; fixture workflows may be left open — see manifest.json if it was written")
        return 130
    finally:
        recorder.close()


if __name__ == "__main__":
    sys.exit(main())
