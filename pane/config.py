"""Application settings resolved from environment variables.

Settings are intentionally import-time resolvable: `create_app` receives an
explicit `Settings` instance, but the module-level defaults make `create_app()`
work the same way it did before `config.py` existed.
"""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    demo: bool
    fixtures_root: Path
    transport_fail: frozenset[str]
    web_dist: Path

    @classmethod
    def from_env(cls, environ: dict[str, str] | None = None) -> "Settings":
        if environ is None:
            environ = os.environ

        repo_root = Path(__file__).resolve().parents[1]

        demo = bool(environ.get("PANE_DEMO", ""))
        fixtures_root = Path(environ.get("PANE_FIXTURES_ROOT", repo_root / "fixtures"))
        web_dist = Path(environ.get("PANE_WEB_DIST", repo_root / "web" / "dist"))

        raw_fail = environ.get("PANE_DEMO_TRANSPORT_FAIL", "")
        allowed = {"floor", "epics", "attention", "health", "spend"}
        fail_parts = {part.strip() for part in raw_fail.split(",") if part.strip()}
        unknown = fail_parts - allowed
        if unknown:
            raise ValueError(
                f"PANE_DEMO_TRANSPORT_FAIL contains unknown section(s) {sorted(unknown)}; "
                f"allowed: {sorted(allowed)}"
            )

        return cls(
            demo=demo,
            fixtures_root=fixtures_root,
            transport_fail=frozenset(fail_parts),
            web_dist=web_dist,
        )
