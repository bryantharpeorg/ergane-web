"""Application settings resolved from environment variables.

Settings are intentionally import-time resolvable: `create_app` receives an
explicit `Settings` instance, but the module-level defaults make `create_app()`
work the same way it did before `config.py` existed.
"""

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

import factory.workgraph.cli
from factory.notify.adapter import UNKNOWN_SENDER


@dataclass(frozen=True)
class Settings:
    demo: bool
    fixtures_root: Path
    transport_fail: frozenset[str]
    web_dist: Path
    poll_interval_s: float
    specs_root: Path
    intake_credential: str | None
    answer_identity: str
    attention_db: Path
    # Last, and with a default, so a caller that predates spec 003 US2 — 002's
    # `tests/test_stage.py` builds a `Settings` by hand — still constructs one.
    demo_ruling: str = "RESOLVED"

    @classmethod
    def from_env(cls, environ: dict[str, str] | None = None) -> "Settings":
        if environ is None:
            environ = os.environ

        repo_root = Path(__file__).resolve().parents[1]

        demo = bool(environ.get("PANE_DEMO", ""))
        fixtures_root = Path(environ.get("PANE_FIXTURES_ROOT", repo_root / "fixtures"))
        web_dist = Path(environ.get("PANE_WEB_DIST", repo_root / "web" / "dist"))
        specs_root = Path(environ.get("PANE_SPECS_ROOT", factory.workgraph.cli.DEFAULT_SPECS_ROOT))

        raw_interval = environ.get("PANE_POLL_INTERVAL_S", "15.0")
        try:
            poll_interval_s = float(raw_interval)
        except ValueError:
            raise ValueError(f"PANE_POLL_INTERVAL_S must be a positive float, got {raw_interval!r}")
        if not poll_interval_s > 0:
            raise ValueError(f"PANE_POLL_INTERVAL_S must be positive, got {poll_interval_s}")

        raw_fail = environ.get("PANE_DEMO_TRANSPORT_FAIL", "")
        allowed = {"floor", "epics", "attention", "health", "spend"}
        fail_parts = {part.strip() for part in raw_fail.split(",") if part.strip()}
        unknown = fail_parts - allowed
        if unknown:
            raise ValueError(
                f"PANE_DEMO_TRANSPORT_FAIL contains unknown section(s) {sorted(unknown)}; "
                f"allowed: {sorted(allowed)}"
            )

        # The credential the operator embeds in ERGANE_WEBHOOK_URL.  Unset means
        # intake is closed; `create_app` says so once, in words, at startup.
        intake_credential = environ.get("PANE_INTAKE_CREDENTIAL") or None

        # Whose answers the factory is asked to judge.  The pane performs no
        # responder check of its own; `escalation.authorized_responders` does.
        answer_identity = environ.get("PANE_ANSWER_IDENTITY") or UNKNOWN_SENDER

        # Demo mode only: which recorded `fixtures/bridge/<RULING>.json` a
        # Question answer replays.  Five rulings were recorded and no more; a
        # name that is not on disk is a degraded read in words, never an
        # invented ruling and never a stand-in file (constitution V).
        demo_ruling = environ.get("PANE_DEMO_RULING") or "RESOLVED"

        raw_attention_db = environ.get("PANE_ATTENTION_DB")
        if raw_attention_db:
            attention_db = Path(raw_attention_db)
        elif demo:
            # A demo floor is seeded from the recordings at startup, so it starts
            # from a fresh file per process rather than inheriting a warm one.
            attention_db = Path(tempfile.mkdtemp(prefix="pane-demo-")) / "attention.db"
        else:
            attention_db = Path(".pane") / "attention.db"

        return cls(
            demo=demo,
            fixtures_root=fixtures_root,
            transport_fail=frozenset(fail_parts),
            web_dist=web_dist,
            poll_interval_s=poll_interval_s,
            specs_root=specs_root,
            intake_credential=intake_credential,
            answer_identity=answer_identity,
            attention_db=attention_db,
            demo_ruling=demo_ruling,
        )
