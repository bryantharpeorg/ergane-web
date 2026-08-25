#!/usr/bin/env python3
"""Render an Ergane spec trio as one readable HTML page.

The point is not prettier markdown. A spec is hard to read because the parts
that matter most are the machine parts — the Work Graph as raw YAML, anchors you
cannot verify by looking, coverage you have to compute — and this resolves all
three against the tree before it renders anything.

Usage:
    python3 render.py <spec-dir> [-o out.html] [--tree <dir>] [--landed]

`--tree` is the tree anchors are resolved against; it defaults to the repository
root. Point it at a checkout of the landing branch when you want the answer an
agent's worktree would get, which is not the same as your working copy.
"""

from __future__ import annotations

import argparse
import ast
import html
import json
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass, field

ANCHOR_RE = re.compile(r"`([A-Za-z0-9_./-]+\.(?:py|md|ya?ml|toml|sql|sh)):(\d+)(?:-(\d+))?`")
BARE_RE = re.compile(r"`:(\d+)(?:-(\d+))?`")
FILE_RE = re.compile(r"`([A-Za-z0-9_./-]+\.(?:py|md|ya?ml|toml|sql|sh))`")
STORY_RE = re.compile(r"^### User Story (\d+)\s*[-–]\s*(.+?)\s*\(Priority:\s*(P\d)\)", re.M)
FR_RE = re.compile(r"^- \*\*(FR-\d+)\*\*:\s*(.+)$", re.M)
SC_RE = re.compile(r"^- \*\*(SC-\d+)\*\*:\s*(.+)$", re.M)
TASK_RE = re.compile(r"^- \[([ x])\]\s+(T\d+[a-z]?)\s*(.*)$", re.M)
TRAP_RE = re.compile(r"^\*\*(\d+[a-z]?)\.\s+(.+?)\*\*", re.M)


@dataclass
class Anchor:
    doc: str
    doc_line: int
    path: str
    line: int
    end: int | None
    status: str = "ok"          # ok | blank | eof | missing
    text: str = ""


@dataclass
class Spec:
    slug: str
    title: str = ""
    state: str = "unknown"
    provenance: list[str] = field(default_factory=list)
    stories: list[tuple[str, str, str]] = field(default_factory=list)
    frs: list[tuple[str, str]] = field(default_factory=list)
    scs: list[tuple[str, str]] = field(default_factory=list)
    graph: dict = field(default_factory=dict)
    traps: list[tuple[str, str]] = field(default_factory=list)
    tasks: list[tuple[str, str, str]] = field(default_factory=list)
    anchors: list[Anchor] = field(default_factory=list)
    landed: dict[str, str] = field(default_factory=dict)
    sections: dict[str, str] = field(default_factory=dict)


def split_frontmatter(text: str) -> tuple[list[str], str, int]:
    """Return (comment lines, body, body start line). Frontmatter closes on the 2nd `---`."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return [], text, 0
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm = [l.lstrip("# ").rstrip() for l in lines[1:i] if l.startswith("#")]
            return fm, "\n".join(lines[i + 1:]), i + 1
    return [], text, 0


def parse_graph(body: str) -> dict:
    """The `## Work Graph` yaml block, without a yaml dependency."""
    m = re.search(r"^## Work Graph\s*\n+```ya?ml\n(.*?)\n```", body, re.S | re.M)
    if not m:
        return {}
    graph: dict = {}
    current = None
    for raw in m.group(1).splitlines():
        if not raw.strip():
            continue
        if not raw.startswith((" ", "\t")):
            current = raw.split(":")[0].strip()
            graph[current] = {"depends_on": [], "depends_on_merged": [], "implements": [], "persona": None}
        elif current:
            key, _, val = raw.strip().partition(":")
            val = val.strip()
            if key in ("depends_on", "depends_on_merged", "implements"):
                graph[current][key] = [v.strip() for v in val.strip("[]").split(",") if v.strip()]
            elif key == "persona":
                graph[current]["persona"] = val
    return graph


def resolve_anchors(docs: dict[str, tuple[str, int]], tree: pathlib.Path) -> list[Anchor]:
    """Every `path:line` citation, resolved against `tree`. Frontmatter is skipped."""
    out: list[Anchor] = []
    cache: dict[str, list[str] | None] = {}
    for doc, (text, skip) in docs.items():
        lines = text.splitlines()
        # A bare `:NN` inherits the last qualified path — but only within the same
        # paragraph. Carrying it further guesses, and guessing here produces a
        # confident wrong answer: on 075 a `:1357` meant for workflow.py resolved
        # against a ladder.py cited two bullets earlier and reported EOF. A bare
        # ref with no antecedent in its own paragraph is reported `ambiguous`,
        # which is the true finding — a reader cannot resolve it either.
        last_path = None
        for i, line in enumerate(lines, 1):
            if i <= skip:
                continue
            if not line.strip():
                last_path = None
            for m in ANCHOR_RE.finditer(line):
                last_path = m.group(1)
                out.append(_probe(doc, i, m.group(1), int(m.group(2)),
                                  int(m.group(3)) if m.group(3) else None, tree, cache))
            # A filename with no line number is an antecedent too. Without this the
            # scan walks past `` `factory/cli/nouns/build.py` `` and resolves the
            # `:511` after it against whatever file was cited further up.
            for m in FILE_RE.finditer(line):
                last_path = m.group(1)
            for m in BARE_RE.finditer(line):
                line_no = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else None
                if last_path:
                    out.append(_probe(doc, i, last_path, line_no, end, tree, cache))
                else:
                    a = Anchor(doc, i, "(no file named in this paragraph)", line_no, end)
                    a.status = "ambiguous"
                    out.append(a)
    return out


def _probe(doc, doc_line, path, line, end, tree, cache) -> Anchor:
    a = Anchor(doc, doc_line, path, line, end)
    if path not in cache:
        p = tree / path
        cache[path] = p.read_text(encoding="utf-8").splitlines() if p.is_file() else None
    body = cache[path]
    if body is None:
        a.status = "missing"
    elif line > len(body):
        a.status = "eof"
    elif not body[line - 1].strip():
        a.status = "blank"
    else:
        a.text = body[line - 1].strip()
    return a


def landed_map(spec_dir: pathlib.Path, branch: str) -> dict[str, str]:
    try:
        r = subprocess.run(
            ["uv", "run", "ergane", "spec", "landed", str(spec_dir), "--default-branch", branch],
            capture_output=True, text=True, timeout=120,
        )
    except Exception:
        return {}
    return dict(re.findall(r"^(US\d+) landed at ([0-9a-f]+)", r.stdout, re.M))


def load(spec_dir: pathlib.Path, tree: pathlib.Path, branch: str | None) -> Spec:
    s = Spec(slug=spec_dir.name)
    docs: dict[str, tuple[str, int]] = {}
    bodies: dict[str, str] = {}
    for name in ("spec.md", "plan.md", "tasks.md"):
        p = spec_dir / name
        if not p.is_file():
            continue
        raw = p.read_text(encoding="utf-8")
        fm, body, skip = split_frontmatter(raw)
        docs[name] = (raw, skip)
        bodies[name] = body
        if name == "spec.md":
            s.provenance = fm
            for l in fm:
                pass
            m = re.search(r"^state:\s*(\w+)", raw, re.M)
            if m:
                s.state = m.group(1)
            t = re.search(r"^# Feature Specification:\s*(.+)$", body, re.M)
            s.title = t.group(1).strip() if t else spec_dir.name

    spec_body = bodies.get("spec.md", "")
    s.stories = [(f"US{n}", title, pri) for n, title, pri in STORY_RE.findall(spec_body)]
    s.frs = FR_RE.findall(spec_body)
    s.scs = SC_RE.findall(spec_body)
    s.graph = parse_graph(spec_body)
    s.traps = TRAP_RE.findall(bodies.get("plan.md", ""))
    s.tasks = [(tid, txt, "done" if mark == "x" else "todo")
               for mark, tid, txt in TASK_RE.findall(bodies.get("tasks.md", ""))]
    s.anchors = resolve_anchors(docs, tree)
    s.sections = bodies
    if branch:
        s.landed = landed_map(spec_dir, branch)
    return s


# --- the page ---------------------------------------------------------------

def dag_svg(graph: dict, landed: dict) -> str:
    """The Work Graph as a layered DAG. Merge edges are solid, verify edges dashed."""
    if not graph:
        return "<p class='empty'>No Work Graph block.</p>"
    depth: dict[str, int] = {}

    def d(n, seen=()):
        if n in seen or n not in graph:
            return 0
        if n in depth:
            return depth[n]
        deps = graph[n]["depends_on"] + graph[n]["depends_on_merged"]
        depth[n] = 1 + max([d(x, seen + (n,)) for x in deps] or [0])
        return depth[n]

    for n in graph:
        d(n)
    layers: dict[int, list[str]] = {}
    for n, lv in sorted(depth.items()):
        layers.setdefault(lv, []).append(n)

    bw, bh, gx, gy = 128, 54, 56, 34
    width = max(len(v) for v in layers.values()) * (bw + gx) + gx
    height = len(layers) * (bh + gy) + gy
    pos = {}
    for lv, nodes in layers.items():
        row_w = len(nodes) * (bw + gx) - gx
        x0 = (width - row_w) / 2
        for i, n in enumerate(nodes):
            pos[n] = (x0 + i * (bw + gx), gy / 2 + (lv - 1) * (bh + gy))

    parts = [f'<svg viewBox="0 0 {width:.0f} {height:.0f}" role="img" '
             f'aria-label="Work graph, {len(graph)} stories">']
    parts.append('<defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" '
                 'markerHeight="7" orient="auto-start-reverse">'
                 '<path d="M0 0 L8 4 L0 8 z" fill="currentColor"/></marker></defs>')
    for n, meta in graph.items():
        if n not in pos:
            continue
        x2, y2 = pos[n]
        for dep, dashed in [(x, False) for x in meta["depends_on_merged"]] + \
                           [(x, True) for x in meta["depends_on"]]:
            if dep not in pos:
                continue
            x1, y1 = pos[dep]
            parts.append(
                f'<path class="edge{" verify" if dashed else ""}" '
                f'd="M{x1 + bw / 2:.0f} {y1 + bh:.0f} C{x1 + bw / 2:.0f} {y1 + bh + gy / 2:.0f} '
                f'{x2 + bw / 2:.0f} {y2 - gy / 2:.0f} {x2 + bw / 2:.0f} {y2:.0f}" '
                f'marker-end="url(#ah)"/>')
    for n, (x, y) in pos.items():
        meta = graph[n]
        cls = "node landed" if n in landed else "node"
        parts.append(f'<g class="{cls}"><rect x="{x:.0f}" y="{y:.0f}" width="{bw}" height="{bh}" rx="3"/>'
                     f'<text x="{x + bw / 2:.0f}" y="{y + 21:.0f}" class="nid">{html.escape(n)}</text>')
        sub = meta.get("persona") or ("landed" if n in landed else f'{len(meta["implements"])} FR')
        parts.append(f'<text x="{x + bw / 2:.0f}" y="{y + 39:.0f}" class="nsub">{html.escape(sub)}</text></g>')
    parts.append("</svg>")
    return "".join(parts)


def md(text: str) -> str:
    """Just enough markdown for spec prose: headings, lists, code, emphasis, tables."""
    out, in_code, in_list, in_table = [], False, False, False
    for line in text.splitlines():
        if line.startswith("```"):
            if in_list:
                out.append("</ul>"); in_list = False
            in_code = not in_code
            out.append("<pre><code>" if in_code else "</code></pre>")
            continue
        if in_code:
            out.append(html.escape(line))
            continue
        esc = html.escape(line)
        esc = re.sub(r"`([^`]+)`", r"<code>\1</code>", esc)
        esc = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", esc)
        if line.startswith("|") and "|" in line[1:]:
            cells = [c.strip() for c in esc.strip().strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                continue
            if not in_table:
                out.append("<div class='scroll'><table>"); in_table = True
            tag = "th" if len(out) and "<table>" in out[-1] else "td"
            out.append("<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in cells) + "</tr>")
            continue
        if in_table:
            out.append("</table></div>"); in_table = False
        m = re.match(r"^(#{2,4})\s+(.*)", line)
        if m:
            if in_list:
                out.append("</ul>"); in_list = False
            lv = len(m.group(1))
            out.append(f"<h{lv} id='{re.sub(r'[^a-z0-9]+', '-', m.group(2).lower()).strip('-')}'>"
                       f"{html.escape(m.group(2))}</h{lv}>")
            continue
        if re.match(r"^\s*[-*]\s+", line):
            if not in_list:
                out.append("<ul>"); in_list = True
            out.append("<li>" + re.sub(r"^\s*[-*]\s+", "", esc) + "</li>")
            continue
        if in_list:
            out.append("</ul>"); in_list = False
        out.append(f"<p>{esc}</p>" if esc.strip() else "")
    if in_list:
        out.append("</ul>")
    if in_table:
        out.append("</table></div>")
    return "\n".join(out)


CSS = """
:root{
  --ink:#15181d; --paper:#f6f6f3; --slate:#5b6472; --line:#dedcd6;
  --steel:#3d5a80; --ok:#3f7d6a; --warn:#b07c2a; --bad:#a4453a;
  --card:#fff; --shadow:0 1px 2px rgba(21,24,29,.06);
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
  --serif:ui-serif,Georgia,"Iowan Old Style",Palatino,serif;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme:dark){
  :root{--ink:#e6e6e1; --paper:#14161a; --slate:#98a0ad; --line:#2a2f37;
        --steel:#7ea3cc; --ok:#6bab95; --warn:#d7a44e; --bad:#d4736a;
        --card:#191c22; --shadow:0 1px 2px rgba(0,0,0,.4);}
}
:root[data-theme="dark"]{--ink:#e6e6e1;--paper:#14161a;--slate:#98a0ad;--line:#2a2f37;
  --steel:#7ea3cc;--ok:#6bab95;--warn:#d7a44e;--bad:#d4736a;--card:#191c22;--shadow:0 1px 2px rgba(0,0,0,.4);}
:root[data-theme="light"]{--ink:#15181d;--paper:#f6f6f3;--slate:#5b6472;--line:#dedcd6;
  --steel:#3d5a80;--ok:#3f7d6a;--warn:#b07c2a;--bad:#a4453a;--card:#fff;--shadow:0 1px 2px rgba(21,24,29,.06);}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);
     font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
.wrap{display:grid;grid-template-columns:250px minmax(0,1fr);gap:48px;
      max-width:1180px;margin:0 auto;padding:40px 28px 96px}
@media(max-width:900px){.wrap{grid-template-columns:1fr;gap:28px}.rail{position:static!important}}
.rail{position:sticky;top:32px;align-self:start;font-family:var(--sans);font-size:13px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;
         color:var(--slate);margin:0 0 6px}
h1{font-family:var(--mono);font-size:26px;line-height:1.25;font-weight:600;margin:0 0 6px;
   text-wrap:balance;letter-spacing:-.01em}
h2{font-family:var(--mono);font-size:15px;letter-spacing:.04em;text-transform:uppercase;
   margin:44px 0 14px;padding-bottom:7px;border-bottom:1px solid var(--line);color:var(--slate)}
h3{font-family:var(--mono);font-size:16px;margin:26px 0 8px;font-weight:600}
h4{font-family:var(--mono);font-size:14px;margin:18px 0 6px;color:var(--slate)}
p{margin:0 0 14px;max-width:68ch}
ul{margin:0 0 14px;padding-left:20px;max-width:68ch}
li{margin:0 0 6px}
code{font-family:var(--mono);font-size:.86em;background:color-mix(in srgb,var(--slate) 12%,transparent);
     padding:.1em .34em;border-radius:3px}
pre{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:14px 16px;
    overflow-x:auto;margin:0 0 16px;box-shadow:var(--shadow)}
pre code{background:none;padding:0;font-size:12.5px;line-height:1.6}
a{color:var(--steel)}
.scroll{overflow-x:auto;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-family:var(--sans);font-size:13.5px;
      font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:7px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}
.chip{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:11px;
      letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:3px;
      border:1px solid currentColor;line-height:1.5}
.chip.ok{color:var(--ok)} .chip.warn{color:var(--warn)} .chip.bad{color:var(--bad)}
.chip.neutral{color:var(--slate)}
.health{display:flex;flex-direction:column;gap:9px;margin:16px 0 22px;padding:14px;
        background:var(--card);border:1px solid var(--line);border-radius:5px;box-shadow:var(--shadow)}
.health div{display:flex;justify-content:space-between;align-items:center;gap:10px}
.health span:first-child{color:var(--slate)}
.rail nav{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.rail nav a{text-decoration:none;color:var(--slate);padding:3px 0;border-left:2px solid transparent;padding-left:9px}
.rail nav a:hover{color:var(--ink);border-left-color:var(--steel)}
.rail nav a:focus-visible{outline:2px solid var(--steel);outline-offset:2px}
svg{max-width:100%;height:auto;color:var(--slate)}
.node rect{fill:var(--card);stroke:var(--line);stroke-width:1.5}
.node.landed rect{stroke:var(--ok);stroke-width:2}
.nid{font-family:var(--mono);font-size:13px;font-weight:600;fill:var(--ink);text-anchor:middle}
.nsub{font-family:var(--mono);font-size:10px;fill:var(--slate);text-anchor:middle;letter-spacing:.04em}
.edge{fill:none;stroke:var(--slate);stroke-width:1.5;opacity:.75}
.edge.verify{stroke-dasharray:4 3;opacity:.5}
.legend{font-family:var(--mono);font-size:11px;color:var(--slate);margin:6px 0 0}
.anchor-row td:first-child{font-family:var(--mono);font-size:12px;white-space:nowrap}
.anchor-row code{font-size:11.5px}
details{margin:0 0 14px;border:1px solid var(--line);border-radius:5px;background:var(--card)}
summary{cursor:pointer;padding:10px 14px;font-family:var(--mono);font-size:12px;
        letter-spacing:.05em;text-transform:uppercase;color:var(--slate)}
summary:focus-visible{outline:2px solid var(--steel);outline-offset:-2px}
details[open] summary{border-bottom:1px solid var(--line)}
.prov{padding:12px 16px;font-family:var(--mono);font-size:12px;line-height:1.7;
      white-space:pre-wrap;color:var(--slate);max-height:420px;overflow-y:auto}
.empty{color:var(--slate);font-style:italic}
.trap{border-left:3px solid var(--warn);padding-left:14px;margin:0 0 12px}
.trap b{font-family:var(--mono);font-size:13px}
@media print{.rail{display:none}.wrap{grid-template-columns:1fr}}
"""


def build(s: Spec, tree_label: str) -> str:
    broken = [a for a in s.anchors if a.status != "ok"]
    story_ids = {sid for sid, _, _ in s.stories}
    covered_fr = set(re.findall(r"FR-\d+", "\n".join(t[1] for t in s.tasks)))
    declared_fr = {f for f, _ in s.frs}
    covered_sc = set(re.findall(r"US\d+-S\d+", "\n".join(t[1] for t in s.tasks)))

    def chip(cls, label):
        return f'<span class="chip {cls}">{html.escape(label)}</span>'

    anchor_chip = chip("ok", f"{len(s.anchors)} anchors ok") if not broken \
        else chip("bad", f"{len(broken)} of {len(s.anchors)} broken")
    fr_gap = declared_fr - covered_fr
    fr_chip = chip("ok", f"{len(declared_fr)}/{len(declared_fr)} FR") if not fr_gap \
        else chip("bad", f"{len(fr_gap)} FR uncovered")
    state_cls = {"landed": "ok", "ready": "warn", "draft": "neutral"}.get(s.state, "neutral")

    rows = []
    for a in sorted(broken, key=lambda x: (x.doc, x.doc_line)):
        rows.append(f'<tr class="anchor-row"><td>{html.escape(a.doc)}:{a.doc_line}</td>'
                    f'<td><code>{html.escape(a.path)}:{a.line}</code></td>'
                    f'<td>{chip("bad", a.status)}</td></tr>')
    anchor_tbl = ("<div class='scroll'><table><tr><th>cited in</th><th>anchor</th><th>status</th></tr>"
                  + "".join(rows) + "</table></div>") if rows else \
        "<p class='empty'>Every citation resolves against the tree.</p>"

    srows = []
    for sid, title, pri in s.stories:
        g = s.graph.get(sid, {})
        deps = ", ".join(g.get("depends_on_merged", [])) or "—"
        vdeps = ", ".join(g.get("depends_on", [])) or "—"
        land = chip("ok", "landed " + s.landed[sid][:7]) if sid in s.landed else chip("neutral", "not landed")
        srows.append(f"<tr><td><code>{sid}</code></td><td>{html.escape(title)}</td><td>{pri}</td>"
                     f"<td><code>{html.escape(g.get('persona') or 'implementer')}</code></td>"
                     f"<td>{html.escape(vdeps)}</td><td>{html.escape(deps)}</td><td>{land}</td></tr>")
    story_tbl = ("<div class='scroll'><table><tr><th>story</th><th>title</th><th>pri</th><th>persona</th>"
                 "<th>needs verified</th><th>needs merged</th><th>state</th></tr>"
                 + "".join(srows) + "</table></div>") if srows else "<p class='empty'>No stories.</p>"

    traps = "".join(f'<div class="trap"><b>{html.escape(n)}.</b> {html.escape(t)}</div>'
                    for n, t in s.traps) or "<p class='empty'>No traps declared.</p>"

    prov = html.escape("\n".join(s.provenance)) or "No provenance recorded."

    nav = "".join(f'<a href="#{i}">{n}</a>' for i, n in
                  [("graph", "Work graph"), ("stories", "Stories"), ("anchors", "Anchor health"),
                   ("traps", "Traps"), ("spec", "Specification"), ("plan", "Plan"), ("tasks", "Tasks")])

    done = sum(1 for _, _, st in s.tasks if st == "done")
    return f"""<title>{html.escape(s.slug)}</title>
<style>{CSS}</style>
<div class="wrap">
<aside class="rail">
  <p class="eyebrow">Ergane spec</p>
  <div class="health">
    <div><span>state</span>{chip(state_cls, s.state)}</div>
    <div><span>anchors</span>{anchor_chip}</div>
    <div><span>requirements</span>{fr_chip}</div>
    <div><span>stories</span>{chip("neutral", f"{len(s.landed)}/{len(s.stories)} landed")}</div>
    <div><span>tasks</span>{chip("neutral", f"{done}/{len(s.tasks)} done")}</div>
  </div>
  <nav>{nav}</nav>
  <p class="legend" style="margin-top:18px">Resolved against<br><code>{html.escape(tree_label)}</code></p>
</aside>
<main>
  <p class="eyebrow">{html.escape(s.slug)}</p>
  <h1>{html.escape(s.title)}</h1>
  <details><summary>Provenance — why this spec is in the state it is</summary>
    <div class="prov">{prov}</div></details>

  <h2 id="graph">Work graph</h2>
  {dag_svg(s.graph, s.landed)}
  <p class="legend">Solid edge: waits for the dependency to <b>merge</b>. Dashed: waits only for it to
  <b>verify</b>. A green outline is a story already landed on the branch.</p>

  <h2 id="stories">Stories</h2>
  {story_tbl}

  <h2 id="anchors">Anchor health</h2>
  {anchor_tbl}

  <h2 id="traps">Traps</h2>
  {traps}

  <h2 id="spec">Specification</h2>
  {md(s.sections.get('spec.md', ''))}

  <h2 id="plan">Plan</h2>
  {md(s.sections.get('plan.md', ''))}

  <h2 id="tasks">Tasks</h2>
  {md(s.sections.get('tasks.md', ''))}
</main>
</div>"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec_dir")
    ap.add_argument("-o", "--output")
    ap.add_argument("--tree", default=".")
    ap.add_argument("--landed-branch", default=None,
                    help="resolve landed stories against this branch (e.g. ergane-buildout)")
    args = ap.parse_args()

    spec_dir = pathlib.Path(args.spec_dir)
    if not (spec_dir / "spec.md").is_file():
        print(f"no spec.md in {spec_dir}", file=sys.stderr)
        return 2
    tree = pathlib.Path(args.tree).resolve()
    s = load(spec_dir, tree, args.landed_branch)
    page = build(s, str(tree))
    out = pathlib.Path(args.output) if args.output else spec_dir / f"{spec_dir.name}.html"
    out.write_text(page, encoding="utf-8")
    broken = sum(1 for a in s.anchors if a.status != "ok")
    print(f"{out}  ({len(s.stories)} stories, {len(s.anchors)} anchors, {broken} broken)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
