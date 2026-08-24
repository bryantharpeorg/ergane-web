/**
 * Segmentation of an escalation's evidence into the choices it offers.
 *
 * `DESIGN.md` § Components › Attention Item › **Body segmentation rule**: an
 * Escalation's evidence is segmented into one block per choice token the payload
 * carries (`esc:<12hex>:<CHOICE>`), in the payload's own order, and no rendered
 * text block exceeds 400 characters. A payload naming no choices — a Question, a
 * Notice — renders as exactly one block: the segmenter degrades, it does not
 * crash (FR-008, FR-010, FR-011).
 *
 * **Segmenting is never editing.** Every block is a slice of the evidence and the
 * slices are contiguous and exhaustive, so concatenating them reproduces the
 * payload character for character — emoji included. Nothing here trims, re-words,
 * summarises or re-orders what the factory wrote; constitution III forbids
 * softening the factory's ruling, and a layout that rewrites is a softening
 * (FR-009). That property is what the committed tests hold this file to.
 *
 * `tasks.md` T019 declares the return as `string[]`. It is `BodyBlock[]` here
 * because the renderer has to say *which* choice a block explains — `DESIGN.md`
 * asks for the factory's lead-in as a micro label and one block per choice — and
 * a bare array of strings would force the caller to re-derive that by position.
 * The texts are the same texts, in the same order.
 */

/** One block of a segmented body, in the order the evidence carries it. */
export interface BodyBlock {
  /**
   * `lead` is the evidence before the first choice; `label` is the factory's own
   * lead-in line to the choice list (`DESIGN.md` § Typography › Micro: "what each
   * button does"); `choice` explains one delivered choice.
   */
  kind: "lead" | "label" | "choice";
  /** The choice token a `choice` block explains; null for `lead` and `label`. */
  choice: string | null;
  /** A verbatim slice of the payload's evidence. */
  text: string;
}

/** The token shape the factory emits after the correlation id. */
const TOKEN = /^[A-Za-z0-9_]+$/;

/** A lead-in is a label, not a paragraph; past this it stays part of the lead. */
const LABEL_MAX = 80;

/**
 * The `<CHOICE>` of an `esc:<12hex>:<CHOICE>` payload, or the payload itself when
 * the caller already holds a bare token. Anything else yields null — an
 * unrecognised payload names no place in the evidence to cut at.
 */
export function choiceToken(payload: string): string | null {
  const tail = payload.includes(":") ? payload.slice(payload.lastIndexOf(":") + 1) : payload;
  return TOKEN.test(tail) ? tail : null;
}

/**
 * The offset of `token` used as a heading — at the start of a line, on its own
 * word — at or after `from`, or -1.
 *
 * Line-start is what separates the heading from the same token used in prose:
 * the factory's closing line "applies the default: KILL the node" names KILL
 * mid-sentence, and the word boundary keeps "KILL" from matching inside "KILLED"
 * or "KILL_EPIC".
 */
function headingAt(evidence: string, token: string, from: number): number {
  const heading = new RegExp(`^${token}\\b`, "gm");
  heading.lastIndex = from;
  const found = heading.exec(evidence);
  return found ? found.index : -1;
}

/**
 * Split `evidence` into one block per choice the payload names, in the payload's
 * order, preceded by whatever the evidence says before the first of them.
 *
 * `choices` are the delivered payloads, verbatim. A choice the evidence never
 * heads a line with gets no block — the pane has no sentence of the factory's to
 * put in one, and inventing a block would be minting words the factory did not
 * send.
 */
export function segmentBody(evidence: string, choices: string[]): BodyBlock[] {
  const marks: { choice: string; at: number }[] = [];
  let cursor = 0;
  for (const payload of choices) {
    const token = choiceToken(payload);
    if (token === null) continue;
    const at = headingAt(evidence, token, cursor);
    if (at < 0) continue;
    marks.push({ choice: token, at });
    cursor = at + token.length;
  }

  // FR-011: no choice to key on, so there is nothing to segment. The evidence
  // comes back whole and unchanged, as one block.
  if (marks.length === 0) return [{ kind: "lead", choice: null, text: evidence }];

  const blocks: BodyBlock[] = [];
  for (const block of leadBlocks(evidence.slice(0, marks[0].at))) blocks.push(block);
  marks.forEach((mark, index) => {
    const end = index + 1 < marks.length ? marks[index + 1].at : evidence.length;
    blocks.push({ kind: "choice", choice: mark.choice, text: evidence.slice(mark.at, end) });
  });
  return blocks;
}

/**
 * The evidence before the first choice, split into the prose and the lead-in line
 * that introduces the choice list — `DESIGN.md` § Components › Attention Item
 * asks for that line as a micro label, and the factory already wrote it, so the
 * pane labels it rather than composing one of its own.
 *
 * The lead-in is simply the last line of the lead, taken only when there is prose
 * left in front of it and it is short enough to be a label. Evidence that carries
 * no such line stays one block.
 */
function leadBlocks(lead: string): BodyBlock[] {
  if (lead === "") return [];
  const line = /(?:^|\n)([^\n]+\n?)$/.exec(lead);
  if (line) {
    const label = line[1];
    const prose = lead.slice(0, lead.length - label.length);
    if (prose !== "" && label.trimEnd().length <= LABEL_MAX) {
      return [
        { kind: "lead", choice: null, text: prose },
        { kind: "label", choice: null, text: label },
      ];
    }
  }
  return [{ kind: "lead", choice: null, text: lead }];
}
