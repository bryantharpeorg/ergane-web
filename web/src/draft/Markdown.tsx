/**
 * The room's one markdown seam — and, today, the room's one honest absence.
 *
 * **There is no markdown renderer in this repository, and this story is not
 * allowed to add one.** Constitution VII: "No new dependency — package,
 * service, or tool — is added without explicit operator approval first," and
 * the approved Node roster is `react`, `react-dom`, `typescript`, `vite`,
 * `@xyflow/react`, `@dagrejs/dagre`, `framer-motion`, `vitest`,
 * `@playwright/test`, `@types/react`, `@types/react-dom`,
 * `@vitejs/plugin-react` and `jsdom`. No renderer is on it, none is in
 * `web/package-lock.json`, and 014's own plan says so in as many words: "The
 * markdown renderer is a dependency decision… If the frontend has no markdown
 * renderer already vendored, **stop and ask** — do not add one and do not
 * hand-roll a parser that will meet a fenced block containing `---`." The
 * operator was asked. The answer had not arrived when this landed.
 *
 * So the room shows the document's **source**, and says that is what it is.
 * That is not a shortfall dressed up; it is the same move US2 of this spec
 * makes one requirement later, for the same reason. FR-009 forbids a composite
 * verdict and requires the view to *state* that `ergane spec validate`'s verdict
 * is unavailable to the pane, because a green pill the operator reads as
 * "validated" would be the most expensive lie the room could tell. Prose that
 * looks rendered but is not is the same lie in a smaller denomination, and
 * constitution III's doctrine — "a pane that renders a beautiful floor and lies
 * when the floor is unreachable has failed at its one job" — is what makes
 * saying so the only available move.
 *
 * **What it does not do**, both forbidden by the plan's Named traps:
 *
 * * It does not hand-roll a parser. Every spec in this corpus opens with a
 *   `---` frontmatter block and most carry a fenced YAML Work Graph containing
 *   more of them; a subset parser meets that on line one and gets it wrong
 *   quietly, which is worse than not parsing at all.
 * * It does not put markup in the DOM. Nothing here reaches
 *   `dangerouslySetInnerHTML`, so no byte of a file on the operator's disk is
 *   ever interpreted as HTML by this room — a property worth keeping when the
 *   renderer does arrive.
 *
 * **When the operator approves one, this file is the only file that changes.**
 * `DocumentColumn` renders `<Markdown text={…} />` and knows nothing else; the
 * styles the rendered form needs — headings, lists, blockquotes, tables, and a
 * fenced block that scrolls itself inside its column — are already written
 * against `.draft-prose` in `global.css`. The intended shape is a lexer, not an
 * HTML renderer: take the token stream and build React elements from it, so the
 * no-markup property above survives the upgrade.
 */
export default function Markdown({ text }: { text: string }): JSX.Element {
  return (
    <>
      <p className="draft-unrendered" role="status" data-markdown-unavailable>
        Shown as source. The pane has no approved markdown renderer, so it does not
        claim to have rendered this.
      </p>
      <pre className="draft-source" data-markdown-source>
        <code>{text}</code>
      </pre>
    </>
  );
}
