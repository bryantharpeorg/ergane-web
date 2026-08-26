"""The repository's credential sweep — one definition, two callers (013 FR-007).

Until this module there was one sweep and it ran only over *committed files*:
`tests/test_credential_sweep.py` walks `fixtures/`, `scripts/`, `tests/` and
`web/tests/` and fails the suite on anything that looks like a credential.  That
was the whole of what constitution VI needed, because nothing this repository
rendered was raw process output.

013 US2 renders one.  A failing gate's `output_tail` is the last ≤32 KiB of a
command's combined stdout and stderr — text no author of this repository wrote
and no reviewer of it has read — and constitution VI is absolute: *no credential
value may appear in a rendered page, an SSE event, a log line, or a committed
fixture*.  So the tail goes through the sweep on its way into the document, and
US2-S3's "the same credential sweep every other surface passes" is true in the
strict sense: `PATTERNS` below is the object the file sweep imports and runs.

## What the definition is, and why it is not wider

Two halves, deliberately different in kind:

1. **Shapes, anchored to a scheme.**  `sk-…`, `ghp_…`, `github_pat_…`, `AKIA…`,
   and a token-shaped run *immediately after* `Bearer `, `Basic ` or `/intake/`.
   The anchor is what makes the definition safe to run over process output: a
   bare 40-character hex run is a commit SHA far more often than it is a
   secret, and a sweep that redacted every long token would delete the failure
   an operator opened the fold to read.  A credential written without its
   scheme is caught by the other half or not at all, and that is the trade this
   repository has already made in its file sweep.
2. **Exact values, from the environment.**  The credentials *this process
   holds* — `PANE_TOKEN`, `PANE_INTAKE_CREDENTIAL`, `PANE_ANSWER_IDENTITY`, and
   anything else exported under a `_TOKEN`/`_KEY`/`_SECRET`/`_PASSWORD` name —
   removed wherever they appear, in any spelling.  This is the half that catches
   a credential of no known shape, and it is the half that matters most: the
   values a gate command could plausibly echo are the ones the factory put in
   its environment.

Neither half makes the tail trustworthy; both make it publishable.  This is a
redaction, not a vault — the same thing ergane's own `factory.notify.redact`
says about the journal.

**Not `pane/floor_document.py`'s `_redact_secrets`.**  That one guards a
*degraded note's detail string* — a sentence this repository composes out of an
exception — and it is two patterns wide because that is all such a sentence can
carry.  A gate's tail is a different input with a different threat, and folding
one into the other would either narrow this sweep or widen that one by accident.
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterable, Mapping

#: What a credential becomes.  Distinctive rather than a run of asterisks, for
#: `factory.notify.redact`'s reason: a reader can tell "this was removed on
#: purpose" from "the output was always like that", and a test can assert the
#: line survived redaction rather than merely failing to contain a secret.
REDACTED = "<redacted>"

#: What a real credential looks like once it is sitting in a file — or in a
#: gate's output.  Two character classes: hex, and the base64url-ish alphabet
#: every bearer token in this build is minted from.
TOKEN_SHAPED = r"(?:[0-9a-fA-F]{16,}|[A-Za-z0-9+/=_\-]{20,})"

#: The shapes, in one list, shared by the file sweep and the tail sweep.
#:
#: `sk-` is word-bounded so that `the-desk-sees-the-floor` does not match — the
#: substring is `sk-sees`, and 001's README sweep note records the near miss.
#: The scheme words carry exactly one space, which is what lets the file sweep
#: run over its own siblings: `tests/test_token_gate.py` builds every header
#: with an f-string, so what the committed file holds after `Bearer ` is
#: `{token}`, and a brace is in neither character class.  `<token>` is not
#: matched either.  A file that hard-codes a real-looking credential still
#: fails, which is the whole point of the definition being this one.
PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9_]{8,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{8,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    # A bearer or basic credential written out rather than built from a value,
    # and a webhook URL with the operator's intake credential still in it.
    re.compile(r"\bBearer " + TOKEN_SHAPED),
    re.compile(r"\bBasic " + TOKEN_SHAPED),
    re.compile(r"/intake/" + TOKEN_SHAPED),
]

#: The three this build mints, named because they carry no telling suffix.
MINTED_NAMES: tuple[str, ...] = (
    "PANE_TOKEN",
    "PANE_INTAKE_CREDENTIAL",
    "PANE_ANSWER_IDENTITY",
)

#: 001's generic rule for anything else the operator exported.
SECRET_SUFFIXES: tuple[str, ...] = ("_TOKEN", "_KEY", "_SECRET", "_PASSWORD")

#: Nothing shorter is a credential, and a short value swept out of a tail by
#: accident would corrupt the evidence it was meant to protect.
MIN_SECRET = 8


def sensitive_values(environ: Mapping[str, str] | None = None) -> set[str]:
    """Every credential value this process is holding, by name or by suffix."""
    source = os.environ if environ is None else environ
    return {
        value
        for name, value in source.items()
        if len(value) >= MIN_SECRET
        and (name in MINTED_NAMES or name.endswith(SECRET_SUFFIXES))
    }


def credential_hits(text: str, values: Iterable[str] = ()) -> list[str]:
    """Everything in `text` the sweep calls a credential, described.

    Descriptions rather than the matched text, for the obvious reason: a report
    that quoted what it found would be a credential in the failure message.
    """
    hits: list[str] = []
    for pattern in PATTERNS:
        for match in pattern.finditer(text):
            hits.append(f"matched {pattern.pattern!r} at {match.start()}")
    for value in values:
        start = 0
        while True:
            index = text.find(value, start)
            if index == -1:
                break
            hits.append(f"contains the env value of {value[:3]}... at {index}")
            start = index + 1
    return hits


def sweep(text: str, values: Iterable[str] | None = None) -> str:
    """`text` with every credential the definition knows replaced by `REDACTED`.

    The exact values go first and the shapes second, so a `Bearer <the token>`
    is redacted once rather than twice, and so the result contains nothing
    either half would still match — `credential_hits(sweep(text)) == []` is the
    property FR-007 actually asks for, and it is asserted rather than assumed
    in `tests/test_gate_tail_sweep.py`.
    """
    if not text:
        return text
    resolved = sensitive_values() if values is None else set(values)
    # Longest first: a credential that contains another (an intake credential
    # embedded in a URL the operator also exported) is removed whole.
    for value in sorted(resolved, key=len, reverse=True):
        text = text.replace(value, REDACTED)
    for pattern in PATTERNS:
        text = pattern.sub(REDACTED, text)
    return text
