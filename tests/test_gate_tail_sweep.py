"""A failing gate's tail reaches the document, swept; a passing gate's does not.

013 US2's two backend claims, and the third one they rest on:

* **US2-S2** — a gate the store recorded as failing carries its `output_tail`;
  a gate it recorded as passing carries none at all (FR-006, T015).  The tail
  is evidence for a failure, not decoration for a success, and a document that
  carried both would leave the room deciding what to withhold.
* **US2-S3** — every tail that reaches the document has been through the
  repository's credential sweep, and the sweep is the *same* definition
  `tests/test_credential_sweep.py` runs over every committed file: one
  `pane/sweep.py`, imported by both (FR-007, T016).
* And the sweep bites.  A planted credential of each shape the definition
  names — a bearer header, a provider key, the operator's webhook credential,
  and the run's own minted `PANE_TOKEN` — is written into a recorded tail, and
  none of the four survives into the assembled document.

Like `tests/test_evidence_section.py`, every store here is built under this
test's own `tmp_path` through ergane's own writer, so nothing below moves when
the operator re-dispatches an epic (013 plan, "the corpus tests must not pin
the live corpus").
"""

from __future__ import annotations

import dataclasses
import json
import secrets

from factory.verify.models import GateResult, GateStatus

from pane import sweep as pane_sweep
from pane.readers import LiveReader
from test_credential_sweep import PATTERNS as FILE_SWEEP_PATTERNS
from test_evidence_section import (
    NODE_ID,
    SPEC_DIR,
    STORY_KEY,
    corpus_for,
    evidence_store,
    failed_attempt,
    judged_attempt,
    record,
    story_of,
)


def gates_of(attempt: dict) -> dict[str, dict]:
    """The attempt's gates by name, for assertions that read as sentences."""
    return {gate["name"]: gate for gate in attempt["gates"]}


def assembled(monkeypatch, tmp_path, *results):
    """The evidence section of `STORY_KEY`, over a store holding `results`."""
    path = evidence_store(monkeypatch, tmp_path)
    record(path, *results)
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)
    entry = corpus.entry(SPEC_DIR, node_history=reader.node_history)
    return story_of(entry, STORY_KEY)["evidence"]


# --- US2-S2: the tail is failure-only (FR-006) ----------------------------


def test_a_failing_gate_carries_its_tail_and_a_passing_one_carries_none(monkeypatch, tmp_path):
    """Both halves of FR-006, over one attempt that holds both kinds of gate.

    `failed_attempt()` records a PASS, a FAIL and a TIMEOUT, each with the same
    planted tail — so what separates them here can only be the rule, and not
    which gate happened to have output.
    """
    evidence = assembled(monkeypatch, tmp_path, failed_attempt())
    gates = gates_of(evidence["attempts"][0])

    # The two that did not pass: their tail is there, and it is the store's.
    assert gates["typecheck"]["status"] == "FAIL"
    assert gates["typecheck"]["output_tail"]
    assert gates["smoke"]["status"] == "TIMEOUT"
    assert gates["smoke"]["output_tail"]

    # The one that passed: none at all.  Not an empty string standing in for a
    # tail nobody may read — the key is there and its answer is `None`.
    assert gates["test"]["status"] == "PASS"
    assert gates["test"]["output_tail"] is None


def test_every_gate_carries_the_key_so_the_room_never_guesses(monkeypatch, tmp_path):
    """`output_tail` is on every gate, answered `None` where there is none.

    A key that appeared only on failing gates would make "no tail" and "a gate
    shaped differently" the same observation in the room.
    """
    evidence = assembled(monkeypatch, tmp_path, failed_attempt(), judged_attempt())
    for attempt in evidence["attempts"]:
        for gate in attempt["gates"]:
            assert "output_tail" in gate
            if gate["status"] == "PASS":
                assert gate["output_tail"] is None


def test_a_recorded_but_empty_tail_is_an_absence_not_an_empty_frame(monkeypatch, tmp_path):
    """A failing gate that printed nothing has no tail, and says `None`.

    The store's column is a string and a silent command writes `""` into it.
    Carrying that through would have the room draw a fold over nothing (§ Don'ts,
    "never render an element that can never fill").
    """
    attempt = failed_attempt()
    silent = dataclasses.replace(attempt.gate_results[1], output_tail="")
    evidence = assembled(
        monkeypatch,
        tmp_path,
        dataclasses.replace(attempt, gate_results=[silent]),
    )
    gate = evidence["attempts"][0]["gates"][0]

    assert gate["status"] == "FAIL"
    assert gate["output_tail"] is None


# --- US2-S3: the tail passes the repository's sweep (FR-007) --------------


def planted_credentials(token: str) -> dict[str, tuple[str, str]]:
    """One planted credential per shape the definition names: `{line, secret}`.

    Each is *assembled* at run time and never typed, for
    `tests/test_credential_sweep.py`'s own reason: a literal here would be found
    by that very sweep when it reaches `tests/`.  The secret is carried beside
    the line it sits in, so an assertion can look for the credential itself
    rather than for the line that happened to contain it.
    """
    looks_real = secrets.token_hex(20)
    provider = "sk-" + secrets.token_hex(20)
    return {
        "bearer": ("Authorization: " + "Bearer " + looks_real, looks_real),
        "provider": ("OPENAI_API_KEY=" + provider, provider),
        "webhook": ("ERGANE_WEBHOOK_URL=http://host" + "/intake/" + looks_real, looks_real),
        # The value this very run minted and put in the environment: the sweep's
        # other half, and the one that catches a credential of no known shape.
        "minted": ("PANE_TOKEN=" + token, token),
    }


def planted_lines(planted: dict[str, tuple[str, str]]) -> str:
    return "\n".join(line for line, _secret in planted.values())


def test_no_planted_credential_survives_into_the_document(monkeypatch, tmp_path, token):
    """Four shapes into a failing gate's tail; none of them out (FR-007).

    The tail is asserted *present* first, because a sweep that passed by
    dropping the tail would prove nothing at all.
    """
    planted = planted_credentials(token)
    attempt = failed_attempt()
    noisy = dataclasses.replace(
        attempt.gate_results[1],
        output_tail="npm ERR! the run failed\n" + planted_lines(planted) + "\n",
    )
    evidence = assembled(
        monkeypatch, tmp_path, dataclasses.replace(attempt, gate_results=[noisy])
    )
    tail = evidence["attempts"][0]["gates"][0]["output_tail"]

    assert tail is not None
    # What the operator came for is still there.
    assert "npm ERR! the run failed" in tail
    assert pane_sweep.REDACTED in tail
    # And every credential in it is gone from the whole serialized document —
    # not merely from the field this test happens to read.
    document = json.dumps(evidence)
    for shape, (_line, secret) in planted.items():
        assert secret not in document, f"the {shape} credential reached the document"


def test_the_swept_tail_passes_the_sweep_itself(monkeypatch, tmp_path, token):
    """The FR as written: run the sweep's own scanner over what was rendered.

    "Any rendered tail MUST pass the repository's credential sweep" is a
    property of the output, so it is asserted by scanning the output rather
    than by trusting the call that produced it.
    """
    planted = planted_credentials(token)
    attempt = failed_attempt()
    noisy = dataclasses.replace(
        attempt.gate_results[1], output_tail=planted_lines(planted)
    )
    evidence = assembled(
        monkeypatch, tmp_path, dataclasses.replace(attempt, gate_results=[noisy])
    )

    hits = pane_sweep.credential_hits(
        json.dumps(evidence), pane_sweep.sensitive_values()
    )
    assert hits == []


def test_the_tail_sweep_is_the_file_sweep(monkeypatch, tmp_path):
    """One definition, and the two callers are looking at the same object.

    US2-S3 says "the same credential sweep every other surface passes".  That
    is only true if the patterns the tail goes through are the patterns
    `tests/test_credential_sweep.py` runs over every committed file — so the
    identity is asserted rather than the wording matched.
    """
    assert FILE_SWEEP_PATTERNS is pane_sweep.PATTERNS


def test_the_sweep_would_catch_each_planted_shape(tmp_path, token):
    """The scanner bites on all four, and leaves ordinary gate output alone.

    A sweep nobody has watched fail is a sweep nobody knows the shape of
    (`tests/test_credential_sweep.py`'s own words).  The negative half matters
    as much here as the positive: a tail is *process output*, so a definition
    that flagged a commit SHA or a wrapped base64 line would redact the evidence
    an operator opened the fold for.
    """
    values = pane_sweep.sensitive_values()
    for shape, (line, _secret) in planted_credentials(token).items():
        assert pane_sweep.credential_hits(line, values), f"{shape} was not caught"
        assert not pane_sweep.credential_hits(pane_sweep.sweep(line), values)

    ordinary = (
        "FAIL tests/test_thing.py::test_case\n"
        "  at 4f2c1ab0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4 (HEAD)\n"
        "  expected 200, got 401\n"
        "npm ERR! code ELIFECYCLE\n"
    )
    assert pane_sweep.credential_hits(ordinary, values) == []
    assert pane_sweep.sweep(ordinary) == ordinary
