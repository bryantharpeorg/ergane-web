import type { DraftCheck, DraftCheckFinding, DraftCheckState } from "../api/draftDocument";

/**
 * What each of ergane's exported checkers says about this spec (014 US2).
 *
 * DESIGN.md § The drafting table fixes the shape and the reason in one line:
 * "**Checks are attributed, never totalled.** Each check renders as one row: the
 * seam's own name in mono, its answer, and its message verbatim when it has one.
 * There is **no summary chip and no composite verdict** — the pane cannot obtain
 * one, and a green pill the operator reads as 'validated' would be the most
 * expensive lie this room could tell."
 *
 * It is the most expensive lie because of what it precedes. Flipping a spec
 * `state: ready` causes the roadmap to dispatch within 300 seconds: nodes that
 * spend tokens, open pull requests and move `dev`. An operator who reads a
 * verdict here and flips on the strength of it has been told something no seam
 * said.
 *
 * So this component renders a **list**, and its only aggregate is the sentence
 * saying there is none (FR-009). It computes nothing across the rows: no count,
 * no worst-of, no "2 of 3". Each row is one function's answer under that
 * function's own name.
 *
 * **The third answer.** Alongside `passed` and `refused` there is `not run`,
 * "muted and unbordered", and it means an input was missing — never a failure
 * the spec earned (FR-010). Eight of this corpus's fourteen spec directories
 * lack a `plan.md`, a `tasks.md`, or both; a room that refused them for it would
 * be constitution III inverted.
 *
 * **A refusal renders whole.** `DerivationError` carries one line per rejected
 * declaration, each naming the story and the shape rule it broke, and the
 * message is shown with its newlines intact and nothing elided (FR-007). An
 * author who is shown the first rejection fixes one typo per render, which is
 * the failure mode the deriver collects rejections to avoid.
 */

/** The word each answer wears. `not_run` is two words on screen and one in the
 *  document, because a state name is not a sentence and a sentence is what an
 *  operator reads. */
const ANSWER: Record<DraftCheckState, string> = {
  passed: "passed",
  refused: "refused",
  not_run: "not run",
};

/**
 * One finding, coordinates first (the review room's discipline, D-023).
 *
 * The seam's sentence is the thing to read, so it is the thing in body text;
 * the ids it applies to sit above it in mono, because a finding whose
 * coordinates have to be parsed out of prose is a finding nobody reproduces.
 */
function Finding({ finding }: { finding: DraftCheckFinding }): JSX.Element {
  const coordinates = [
    finding.node_id === null ? null : `node ${finding.node_id}`,
    finding.story_key === null ? null : finding.story_key,
    ...finding.task_ids,
    finding.document,
  ].filter((part): part is string => part !== null && part !== "");

  return (
    <li
      className="draft-finding"
      data-finding
      data-finding-informational={finding.informational ? "true" : "false"}
    >
      <p className="draft-finding-where num">
        {coordinates.length > 0 ? coordinates.join(" · ") : "this spec"}
        {finding.informational ? (
          <span className="draft-finding-kind" data-finding-kind="informational">
            {" "}
            stated, not counted
          </span>
        ) : null}
      </p>
      <p className="draft-finding-detail">{finding.detail}</p>
    </li>
  );
}

/** One checker's answer: its name, its answer, its own words. */
function Check({ check }: { check: DraftCheck }): JSX.Element {
  return (
    <li className="draft-check" data-check={check.check} data-check-state={check.state}>
      <p className="draft-check-head">
        <span className="draft-check-name num" data-check-name>
          {check.check}
        </span>
        <span
          className={`draft-check-answer ${check.state}`}
          data-check-answer={check.state}
        >
          {ANSWER[check.state]}
        </span>
      </p>
      {/* The seam the name belongs to, so the attribution points at a surface an
          operator can go read rather than at a bare identifier. */}
      <p className="draft-check-seam num" data-check-seam>
        {check.seam}
      </p>
      {check.detail === null ? null : (
        /* Verbatim, with its newlines: a `DerivationError` is one line per
           rejected declaration and all of them are the answer (FR-007). */
        <p className="draft-check-detail" data-check-detail>
          {check.detail}
        </p>
      )}
      {check.not_run_because === null ? null : (
        <p className="draft-check-detail draft-check-why" data-check-not-run>
          {check.not_run_because}
        </p>
      )}
      {check.findings.length > 0 ? (
        <ul className="draft-finding-list">
          {check.findings.map((finding, index) => (
            <Finding key={`${check.check}-${index}`} finding={finding} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function Checks({
  checks,
  verdictUnavailable,
}: {
  checks: DraftCheck[];
  verdictUnavailable: string;
}): JSX.Element {
  return (
    <section className="draft-checks" data-draft-checks aria-labelledby="draft-checks-name">
      <h2 className="draft-checks-name num" id="draft-checks-name">
        Checks
      </h2>
      {/* FR-009's other half, and the reason this is a paragraph rather than a
          chip: the absence of the CLI's verdict is a fact about what the
          distribution exports, and an operator who reads three attributed rows
          without it will supply the missing composition themselves. */}
      <p className="draft-checks-statement" data-verdict-unavailable>
        {verdictUnavailable}
      </p>
      <ul className="draft-check-list">
        {checks.map((check) => (
          <Check key={check.check} check={check} />
        ))}
      </ul>
    </section>
  );
}
