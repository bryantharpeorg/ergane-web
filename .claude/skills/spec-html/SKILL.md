---
name: spec-html
description: Render an Ergane spec trio (spec.md, plan.md, tasks.md) as one readable HTML page, with the Work Graph drawn as a DAG, every file:line anchor resolved live against the tree, and coverage computed. Optionally publish it as a Claude artifact. Use when asked to make a spec readable, share a spec, review one visually, or check a spec's anchor health.
metadata:
  inherited_from: "bryantharpeorg/ergane .claude/skills — adapted 2026-08-22: env script at ~/.config/ergane/ergane-env.sh, runtime root at $ERGANE_ROOT"
---

# Rendering a spec as HTML

A spec is hard to read because the parts that matter most are the parts prose is
worst at: a Work Graph as raw YAML, anchors you cannot verify by looking, and
coverage you have to compute in your head across three files.

This renders the trio as one page and **resolves all three against the tree
first**. The reading improvement is a side effect; the point is that the page
states facts the markdown only claims.

## Run it

```bash
cd /home/admin/code/ergane
python3 .claude/skills/spec-html/render.py specs/<spec-dir> -o /tmp/<name>.html
```

Options that change the answer, not the styling:

- `--tree <dir>` — the tree anchors resolve against. **Defaults to the repo
  root, which is usually the wrong tree.** A node's worktree branches from the
  landing branch, not from your working copy, so a spec can read clean for you
  and land an agent in the middle of a docstring. To get the answer an agent
  would get, materialise the branch first:
  ```bash
  mkdir -p /tmp/origin && cd /tmp/origin
  git -C /home/admin/code/ergane archive origin/ergane-buildout | tar -x
  ```
  then `--tree /tmp/origin`.
- `--landed-branch ergane-buildout` — marks landed stories green in the DAG and
  fills the story table. Costs one `ergane spec landed` call. **Never pass
  `main`**; the factory does not land there.

The command prints a one-line summary — stories, anchors, broken — so a bad spec
is visible without opening the page.

## What the page shows that the markdown does not

- **Work Graph as a DAG.** Layered by dependency depth. **Solid edge = waits for
  merge (`depends_on_merged`); dashed = waits only for verification
  (`depends_on`).** That distinction is invisible in YAML and it is the one that
  costs reworks: a dashed edge releases a story while its dependency is still in
  the merge queue, so the dependent builds against a base without it.
- **Anchor health**, per citation, with the status. Four kinds: `missing` file,
  `eof`, `blank` line, and `ambiguous` — a bare `` `:NN` `` with no filename
  named in its own paragraph. Ambiguous is a real finding, not a parser
  limitation: if the scan cannot resolve the antecedent, neither can a reader.
- **Coverage**, computed: FRs with no task, stories against the graph, tasks done.
- **Provenance**, collapsed. The frontmatter comment block is where a spec records
  why it is held, and it is usually the longest thing in the file — worth keeping,
  worth folding away.

## Publishing it as a Claude artifact

Optional, and only when asked. The page is self-contained — inline CSS, inline
SVG, no external requests — so it satisfies the artifact CSP as generated.

1. Render to a file first.
2. Call `Artifact` with that `file_path`, a `favicon`, and a one-sentence
   `description`.
3. **To update a spec's page later, pass the same `file_path`** — it redeploys to
   the same URL. A different path mints a new one.

Publishing sends the spec's full text off the machine. Ergane specs are ordinary
engineering documents, but check the frontmatter before publishing one: hold
notes sometimes quote incident detail, and 064's records a live credential leak.

## Reading the output honestly

**A green anchor count is not a clean spec.** The check proves each citation
lands on a non-blank line — not that it lands on the symbol the prose names. The
worst anchor found on 2026-08-20 was `_judge_rewrites_spent` cited 54 lines off:
it resolved to real code inside a different function, and this page would have
called it fine. Read the ones the prose makes load-bearing.

**Re-render after anything lands.** Anchors rot when the factory ships into a
file a pending spec cites — 067's plan lost fourteen overnight. A page rendered
before a merge is evidence about a tree that no longer exists; the footer records
which tree it was resolved against for exactly this reason.
