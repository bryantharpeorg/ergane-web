"""Build the corpus conditions the showfloor tests assert over (008 US1).

The showfloor document joins four sources, and two of them are files an operator
edits between builds: a spec's `state:` frontmatter, and the compiled work graph
this repository archives beside its specs.  A test that *reads* those files and
asserts what it found is not asserting the document's contract — it is asserting
this morning's repository, and it goes red the moment the operator attests a
spec `landed` or archives a derived graph, with no line of source touched.  That
is exactly what happened: two operator PRs sat red against three such
assertions.  008 US1 is the subtraction.

So this module is the one place in the suite allowed to name a directory under
`specs/` or a file under the archive, and it names them only to **cut material
from** — a recorded spec body and a recorded `ergane spec derive` graph, so no
shape here is invented (constitution V).  Every *condition* a test needs is
written into a scratch tree by `build_corpus` and asserted there:

    corpus = build_corpus(
        tmp_path,
        SpecFixture("910-attested", state="landed"),
        SpecFixture("911-in-flight", state="ready", archived=False),
    )
    entry = corpus.entry("910-attested")

`copy_repository_corpus` is the other door: this repository's own corpus copied
into a scratch tree so a test may perform the operator's edits — `attest` and
`archive` — on the copy instead of asserting over the original.

**009 adds a third condition to construct: a landing.** The showfloor document
now reads landing facts off the landing branch, so a test needs a spec whose
stories are landed *by content* and, separately, one whose attestation the
branch contradicts. Both are built here and neither reads this repository's own
branch: `landing_facts_for` composes the facts a reader returns, and
`build_landed_repository` goes the whole way — a real git repository under the
test's own `tmp_path`, with one commit per landing carrying the subject the
merge queue writes, so `factory.workgraph.landed.landed_facts` is exercised as
itself rather than stood in for.

`tests/test_no_test_pins_live_corpus.py` is the guard that keeps the rest of the
suite off these files (FR-001).
"""

from __future__ import annotations

import asyncio
import copy
import dataclasses
import json
import os
import shutil
import subprocess
from collections.abc import Callable, Sequence
from pathlib import Path

from pane.landing import (
    LandingFact,
    LandingReader,
    read_changed_files,
    read_served_revision,
    revision_carries,
)
from pane.readers import TransportFailed
from pane.review import ReviewReaders
from pane.showfloor import (
    ShowfloorReaders,
    assemble_showfloor,
    parse_story_headings,
)

ROOT = Path(__file__).resolve().parents[1]

#: The committed material every constructed corpus is cut from: one spec of this
#: repository's own corpus and the `ergane spec derive` output archived beside
#: it.  The builder copies their *shape* — a four-story spec body off the
#: `### User Story <n> - <title> (Priority: P<n>)` grammar, a compiled graph with
#: `requirement_keys` and both edge lists — and supplies the frontmatter itself,
#: so the source's own attested state never reaches a constructed spec and a
#: later attestation of it cannot move a single assertion.
RECORDED_SPEC = ROOT / "specs" / "001-the-desk-sees-the-floor" / "spec.md"
RECORDED_GRAPH = ROOT / "docs" / "dags" / "001-the-desk-sees-the-floor.json"

REPOSITORY_SPECS = ROOT / "specs"
REPOSITORY_ARCHIVE = ROOT / "docs" / "dags"


# --- the recorded material ------------------------------------------------


def recorded_body() -> str:
    """The recorded spec's text with its frontmatter block removed.

    The body is what carries the story headings, the titles and the intents; the
    frontmatter is the one part a constructed corpus always writes for itself.
    """
    return strip_frontmatter(RECORDED_SPEC.read_text(encoding="utf-8"))


def recorded_graph() -> dict:
    """The archived `ergane spec derive` output, verbatim."""
    return json.loads(RECORDED_GRAPH.read_text(encoding="utf-8"))


def strip_frontmatter(text: str) -> str:
    """`text` without a leading `---`-delimited block, if it has one."""
    if not text.startswith("---\n"):
        return text
    _head, separator, body = text[4:].partition("\n---\n")
    return body if separator else text


def derived_graph(spec_dir: str, story_keys: Sequence[str]) -> dict:
    """A compiled graph of the recorded shape, retargeted at `spec_dir`.

    Every key, and the node's every field, comes from the archived recording;
    what this function supplies is the identity `ergane spec derive` would have
    supplied — the spec's own directory and its own story keys, chained the way
    a spec whose stories share files chains them.
    """
    recorded = recorded_graph()
    template = recorded["nodes"][0]

    nodes = []
    for index, story_key in enumerate(story_keys):
        node = copy.deepcopy(template)
        node["id"] = story_key.lower()
        node["story_key"] = story_key
        node["spec_ref"] = f"{spec_dir}:{story_key}"
        node["requirement_keys"] = [story_key, *template["requirement_keys"][1:]]
        node["depends_on"] = []
        node["depends_on_merged"] = [story_keys[index - 1].lower()] if index else []
        nodes.append(node)

    graph = copy.deepcopy(recorded)
    graph["epic_id"] = spec_dir
    graph["feature"] = spec_dir
    graph["nodes"] = nodes
    graph["inferred_edges"] = []
    return graph


# --- the constructed corpus -----------------------------------------------


@dataclasses.dataclass(frozen=True)
class SpecFixture:
    """One spec to write into a constructed corpus.

    `state` is the frontmatter the file carries; `None` writes no frontmatter
    block at all, which is ergane's "reads `draft`" case.  `archived` says
    whether a compiled graph sits beside it — the difference between a spec the
    document reads story identity from and one it degrades to headings for.
    """

    spec_dir: str
    state: str | None = "ready"
    archived: bool = True
    body: str | None = None
    name: str | None = None


async def no_epic(spec_dir: str) -> dict | None:
    """No epic is running for this spec: undispatched, not degraded."""
    return None


class Corpus:
    """A specs root and an archive beside it, both under a test's own tmp tree."""

    def __init__(
        self, specs_root: Path, archive_root: Path, repo: Path | None = None
    ) -> None:
        self.specs_root = specs_root
        self.archive_root = archive_root
        #: The git repository this corpus lives in, when a test built one.
        #: `None` for the scratch corpora, which are directories and not
        #: checkouts — a landing read over one is a read that cannot be made.
        self.repo = repo

    # --- what the corpus holds

    @property
    def dirs(self) -> list[str]:
        """Every spec directory, in the sorted order `read_roadmap` walks."""
        return sorted(
            path.name
            for path in self.specs_root.iterdir()
            if (path / "spec.md").is_file()
        )

    def is_archived(self, spec_dir: str) -> bool:
        return (self.archive_root / f"{spec_dir}.json").is_file()

    def spec_text(self, spec_dir: str) -> str:
        return (self.specs_root / spec_dir / "spec.md").read_text(encoding="utf-8")

    def headings(self, spec_dir: str) -> dict:
        """The spec's own story headings, parsed as the assembly parses them."""
        return parse_story_headings(self.spec_text(spec_dir))

    def graph(self, spec_dir: str) -> dict:
        return json.loads(
            (self.archive_root / f"{spec_dir}.json").read_text(encoding="utf-8")
        )

    def declared_story_keys(self, spec_dir: str) -> list[str]:
        """What this corpus declares for a spec, read the way the assembly reads
        it: the archived graph when there is one, else the spec's own headings.
        """
        if self.is_archived(spec_dir):
            return sorted(node["story_key"] for node in self.graph(spec_dir)["nodes"])
        return sorted(self.headings(spec_dir))

    # --- the operator's two edits, performed on the copy

    def attest(self, spec_dir: str, state: str) -> None:
        """Rewrite a spec's `state:` frontmatter and nothing else — the edit an
        operator makes when a spec lands (PR #37's whole diff, per spec)."""
        path = self.specs_root / spec_dir / "spec.md"
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---\n"):
            path.write_text(f"---\nstate: {state}\n---\n{text}", encoding="utf-8")
            return
        head, separator, body = text[4:].partition("\n---\n")
        lines = [
            f"state: {state}" if line.startswith("state:") else line
            for line in head.splitlines()
        ]
        if not any(line.startswith("state:") for line in lines):
            lines.insert(0, f"state: {state}")
        path.write_text(
            "---\n" + "\n".join(lines) + separator + body, encoding="utf-8"
        )

    def archive(self, spec_dir: str, graph: dict | None = None) -> dict:
        """Archive a compiled graph beside a spec — the edit PR #40 makes.

        With no `graph` given, one is derived from the recorded shape over the
        spec's own story headings, which is what `ergane spec derive` writes.
        """
        if graph is None:
            graph = derived_graph(spec_dir, sorted(self.headings(spec_dir)))
        self.archive_root.mkdir(parents=True, exist_ok=True)
        (self.archive_root / f"{spec_dir}.json").write_text(
            json.dumps(graph, indent=2), encoding="utf-8"
        )
        return graph

    def unarchive(self, spec_dir: str) -> None:
        """Take a spec's compiled graph out of the archive."""
        (self.archive_root / f"{spec_dir}.json").unlink(missing_ok=True)

    # --- the reads, bound to this corpus

    def workgraph(self, spec_dir: str) -> dict:
        """The archive read, performed as `_BoundReads.workgraph` performs it: a
        spec with nothing archived is a transport failure, never an empty graph.
        """
        path = self.archive_root / f"{spec_dir}.json"
        if not path.is_file():
            raise TransportFailed("workgraph", f"{path}: no compiled graph")
        return json.loads(path.read_text(encoding="utf-8"))

    def readers(self, **overrides) -> ShowfloorReaders:
        """The reads bound to this corpus.

        `landing_facts` is deliberately absent unless a test passes one: a
        scratch corpus is a directory, not a checkout, and "this build has no
        landing read" is a different condition from "the branch carries
        nothing" (`ShowfloorReaders`).  A test that wants a landing says so.
        """
        fields = {"workgraph": self.workgraph, "epic_status": no_epic}
        fields.update(overrides)
        return ShowfloorReaders(**fields)

    def landing_reader(self, branch: str = "dev") -> ShowfloorReaders:
        """The reads bound to this corpus' own git repository (009 FR-001).

        The production binding, over a repository the test built: the same
        `ShowfloorReaders.from_reader` path the app uses, so what is proved is
        the wiring and not a stand-in for it.
        """
        if self.repo is None:
            raise AssertionError("this corpus was not built inside a repository")
        return dataclasses.replace(
            self.readers(),
            landing_facts=LandingReader(self.repo, branch).facts,
            landing_branch=branch,
        )

    def landing_facts(self, spec_dir: str, branch: str = "dev") -> dict[str, LandingFact]:
        """What the branch this corpus was built on carries for one spec.

        The production read over a repository the test built, so a test can say
        *what landed* without re-deriving a commit hash it would have to invent.
        """
        if self.repo is None:
            raise AssertionError("this corpus was not built inside a repository")
        return LandingReader(self.repo, branch).facts(spec_dir)

    def git_head(self) -> str:
        """Where this corpus' checkout is standing right now."""
        if self.repo is None:
            raise AssertionError("this corpus was not built inside a repository")
        return git(self.repo, "rev-parse", "HEAD").strip()

    def check_out(self, revision: str) -> str:
        """Move this corpus' checkout to `revision`, and return where it is now.

        011 US2's constructed pair of revisions (FR-010, T015).  A review room
        cannot be asked whether the served revision carries an epic unless a
        test can serve a revision that does not — and the honest way to build
        one is to stand the checkout somewhere earlier on its own branch, which
        is exactly the condition an operator hits when the pane has been running
        since before the epic merged.
        """
        if self.repo is None:
            raise AssertionError("this corpus was not built inside a repository")
        git(self.repo, "checkout", "--quiet", "--detach", revision)
        return git(self.repo, "rev-parse", "HEAD").strip()

    def review_readers(self, branch: str = "dev", **overrides) -> "ReviewReaders":
        """The review room's reads, bound to this corpus (011 US1).

        Both git reads are the production ones over a repository the test built,
        and the manifest is the committed one — so what a test asserts about a
        route is what an operator would be shown, not a mapping written to make
        an assertion pass.
        """
        if self.repo is None:
            raise AssertionError("this corpus was not built inside a repository")
        fields = {
            "landing_facts": LandingReader(self.repo, branch).facts,
            "changed_files": lambda commit: read_changed_files(self.repo, commit),
            "workgraph": self.workgraph,
            "landing_branch": branch,
            # 011 US2: the two served-revision reads, over the repository this
            # corpus was built in.  A test moves the checkout with `check_out`
            # below and the room's answer moves with it, so what is asserted is
            # the production read against a revision the test constructed.
            "served_revision": lambda: read_served_revision(self.repo),
            "revision_carries": (
                lambda commit, revision: revision_carries(self.repo, commit, revision)
            ),
        }
        fields.update(overrides)
        return ReviewReaders(**fields)

    # --- the document

    def assemble(self, **overrides) -> dict:
        return asyncio.run(
            assemble_showfloor(self.specs_root, self.readers(**overrides))
        )

    def entry(self, spec_dir: str, **overrides) -> dict:
        return entry_for(self.assemble(**overrides), spec_dir)


def entry_for(document: dict, spec_dir: str) -> dict:
    return next(entry for entry in document["rail"] if entry["spec_dir"] == spec_dir)


def build_corpus(
    tmp_path: Path,
    *fixtures: SpecFixture,
    root: Path | None = None,
    repo: Path | None = None,
) -> Corpus:
    """Write `fixtures` into a scratch corpus under `tmp_path` and return it.

    `root` puts the corpus somewhere other than `tmp_path` itself — a repository
    keeps its specs at `<repo>/specs`, which is where the landing read looks for
    the checkout the branch belongs to.
    """
    base = tmp_path if root is None else root
    corpus = Corpus(base / "specs", base / "dags", repo)
    corpus.specs_root.mkdir(parents=True, exist_ok=True)
    corpus.archive_root.mkdir(parents=True, exist_ok=True)

    body = recorded_body()
    for fixture in fixtures:
        directory = corpus.specs_root / fixture.spec_dir
        directory.mkdir(parents=True, exist_ok=True)
        text = body if fixture.body is None else fixture.body
        if fixture.name is not None:
            text = _renamed(text, fixture.name)
        if fixture.state is not None:
            text = f"---\nstate: {fixture.state}\n---\n{text}"
        (directory / "spec.md").write_text(text, encoding="utf-8")
        if fixture.archived:
            corpus.archive(fixture.spec_dir)

    return corpus


# --- a corpus inside a real git repository ---------------------------------


#: The identity every commit a test writes is made under.  Spelt on the command
#: rather than read from a config file: a gate's `HOME` is a fresh tmpfs with no
#: `.gitconfig` in it (D-013), and a test that needed one would pass on the
#: operator's machine and fail on the boundary.
_GIT_IDENTITY = (
    "-c", "user.name=Corpus Fixture",
    "-c", "user.email=corpus@example.invalid",
    "-c", "commit.gpgsign=false",
)


def git(repo: Path, *args: str) -> str:
    """One git command in `repo`, with no host configuration reachable."""
    completed = subprocess.run(
        ["git", *_GIT_IDENTITY, "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=True,
        env={
            # The host's `PATH` so `git` is found wherever it lives, and nothing
            # else: no `GIT_*` of the operator's, and both config files pointed
            # at `/dev/null` so a test's commits cannot inherit a host setting
            # (a signing key, a hooks path) that the boundary's tmpfs `HOME`
            # would not have.
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "HOME": str(repo.parent),
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_CONFIG_SYSTEM": "/dev/null",
            "GIT_TERMINAL_PROMPT": "0",
        },
    )
    return completed.stdout


def landing_subject(spec_dir: str, story_key: str, pr: int) -> str:
    """The subject the merge queue writes when a node's PR is squashed.

    `factory.mergequeue.messages.pr_title` composes
    `<epic_id>/<node_id>: <STORY_KEY>` and GitHub appends `(#<pr>)`; that is the
    grammar `landed_facts` matches and the one the PR number is read out of, so
    a test that spelt it any other way would prove nothing about either.
    """
    return f"{spec_dir}/{story_key.lower()}: {story_key} (#{pr})"


def build_landed_repository(
    tmp_path: Path,
    *fixtures: SpecFixture,
    landings: dict[str, Sequence[str]] | None = None,
    files_by_story: dict[str, Sequence[str]] | None = None,
    branch: str = "dev",
    first_pr: int = 41,
) -> Corpus:
    """A git repository whose landing branch carries `landings`, by content.

    One commit per landing, in the queue's own subject grammar, on a branch with
    no remote — so the read resolves the local branch and touches no network.
    The frontmatter is whatever the fixtures declare: the point of this builder
    is that the branch and the attestation can be made to disagree.

    **011 adds the fourth condition: what a landing commit touched.**  The review
    room reads each landing's changed-file list and resolves it against the
    committed route manifest, so a test needs commits that changed *named* paths
    — `files_by_story` is `{"<spec-dir>:<STORY>": [path, …]}` and a landing not
    named there touches the marker file this builder has always written.  The
    paths are the repository's own spellings on purpose: what the resolution
    then asserts is the committed manifest's answer, never a fixture's idea of
    one.
    """
    repo = tmp_path / "repo"
    repo.mkdir(parents=True, exist_ok=True)
    git(repo, "init", "--quiet")
    git(repo, "symbolic-ref", "HEAD", f"refs/heads/{branch}")

    corpus = build_corpus(tmp_path, *fixtures, root=repo, repo=repo)
    git(repo, "add", "--all")
    git(repo, "commit", "--quiet", "-m", "the corpus, before anything landed")

    pr = first_pr
    for spec_dir, story_keys in (landings or {}).items():
        for story_key in story_keys:
            touched = (files_by_story or {}).get(
                f"{spec_dir}:{story_key}", [f"landings/{spec_dir}/{story_key.lower()}.txt"]
            )
            for relative in touched:
                target = repo / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(f"{story_key} of {spec_dir}\n", encoding="utf-8")
            git(repo, "add", "--all")
            git(repo, "commit", "--quiet", "-m", landing_subject(spec_dir, story_key, pr))
            pr += 1

    return corpus


# --- landing facts a test hands straight to the reader ---------------------


def landing_facts_for(
    spec_dir: str,
    story_keys: Sequence[str],
    *,
    first_pr: int = 41,
    kind: str = "observed",
    merged_at: str = "2026-08-25T15:36:32Z",
) -> dict[str, LandingFact]:
    """`{story_key: LandingFact}` as `pane/landing.py` returns them.

    `kind` is the provenance word `factory.workgraph.landed.LandedKind` carries.
    `attested` is the interesting one to pass: it is the spec's own frontmatter
    answering for itself, which is precisely the claim a landing read exists to
    check, and `LandingFact.on_branch` is False for it.
    """
    facts: dict[str, LandingFact] = {}
    for offset, story_key in enumerate(story_keys):
        pr = first_pr + offset
        subject = landing_subject(spec_dir, story_key, pr)
        facts[story_key] = LandingFact(
            story_key=story_key,
            commit=f"{offset + 1:040x}",
            kind=kind,
            merged_at=merged_at,
            subject=subject,
            pr_number=pr,
        )
    return facts


def landing_read(
    by_spec: dict[str, dict[str, LandingFact]] | None = None,
    *,
    failure: Exception | None = None,
) -> Callable[[str], dict[str, LandingFact]]:
    """A `landing_facts` reader over facts a test composed.

    With `failure`, every spec's read raises it — 001's two words reaching the
    assembly unchanged, which is how the Unknown Rule path is driven.  Without
    it, a spec not named in `by_spec` reads as a branch that carries nothing for
    it, which is an answer and not a failure.
    """

    def read(spec_dir: str) -> dict[str, LandingFact]:
        if failure is not None:
            raise failure
        return dict((by_spec or {}).get(spec_dir, {}))

    return read


def copy_repository_corpus(tmp_path: Path) -> Corpus:
    """This repository's own corpus and archive, copied into a scratch tree.

    The copy is what makes the operator's edits testable without asserting over
    the originals: a test calls `attest` and `archive` on the copy, so the
    condition it proves is one it constructed even though the material is the
    real corpus.
    """
    corpus = Corpus(tmp_path / "specs", tmp_path / "dags")
    shutil.copytree(REPOSITORY_SPECS, corpus.specs_root)
    corpus.archive_root.mkdir(parents=True, exist_ok=True)
    for path in REPOSITORY_ARCHIVE.glob("*.json"):
        shutil.copy(path, corpus.archive_root / path.name)
    return corpus


def _renamed(text: str, name: str) -> str:
    """Retarget the body's `# Feature Specification: <name>` line."""
    lines = text.splitlines(keepends=True)
    for index, line in enumerate(lines):
        if line.startswith("# Feature Specification: "):
            lines[index] = f"# Feature Specification: {name}\n"
            break
    return "".join(lines)
