import type { AttentionItem, FloorDocument } from "../api/floorDocument";
import AnswerColumn from "./AnswerColumn";
import RulingLine from "./RulingLine";
import { segmentBody } from "./escalationBody";
import { referenceInstant, timeLeft, timeSince } from "./timeLeft";

interface AttentionItemProps {
  item: AttentionItem;
  doc: FloorDocument;
}

const KIND_LABELS: Record<AttentionItem["kind"], string> = {
  escalation: "Escalation",
  question: "Question",
  notice: "Notice",
};

/** DESIGN.md § Colors › The Attention Ranking Rule: high / medium / low. */
const RANK_CLASSES: Record<AttentionItem["kind"], string> = {
  escalation: "high",
  question: "medium",
  notice: "low",
};

export default function AttentionItemView({ item, doc }: AttentionItemProps) {
  const kind = item.kind;
  const isNotice = kind === "notice";
  // DESIGN.md § Components › Attention Item › Countdown anchor rule: the only
  // two inputs are the factory-written `expires_at` and the document's own
  // reference instant. There is no third argument this function could take,
  // which is what makes "never derive an expiry from received at" structural
  // rather than a habit (FR-012).
  const left = timeLeft(item.expires_at, referenceInstant(doc));
  // DESIGN.md § Components › Attention Item › Body segmentation rule: the
  // evidence is laid out as the decision it is — one block per choice the
  // payload names — instead of arriving as one paragraph the operator has to
  // parse under a deadline. Every block is a verbatim slice, so this is layout
  // and never editing (constitution III, FR-008..FR-011).
  const blocks = segmentBody(
    item.text,
    item.actions.map((action) => action.payload),
  );

  return (
    <article
      className={`item ${RANK_CLASSES[kind]}`}
      data-kind={kind}
      data-expires-at={item.expires_at ?? undefined}
      data-id={item.id}
    >
      <div className="clock-col">
        <span className="kind">{KIND_LABELS[kind]}</span>
        {/* A Notice has no clock at all — not a missing deadline, no deadline. */}
        {isNotice ? (
          <span className="no-clock num">no clock</span>
        ) : (
          <>
            {/* Ticking is a text update, not an animation (DESIGN.md § Components
                › Attention Item › Countdown anchor rule). */}
            {left.kind === "remaining" && (
              <span className="clock num" aria-live="polite">
                {left.text}
              </span>
            )}
            {/* Past its deadline, and still here: expiry is the factory's ruling
                to make, and the pane deletes nothing while it waits for one
                (FR-013). The controls stay live, so a late Answer still goes. */}
            {left.kind === "expired" && (
              <span className="clock num expired" aria-live="polite">
                expired
              </span>
            )}
            {/* An answerable item the factory has supplied no deadline for. Not
                the Notice slot's "no clock": there is a deadline to have, and
                the pane has not been told it — so it says that, rather than
                minting one from its own receipt clock (FR-012). */}
            {left.kind === "none" && (
              <span className="no-deadline">no deadline from the factory</span>
            )}
          </>
        )}
        {/* The absolute expiry beneath the clock, the factory's timestamp set in
            mono and carried verbatim — not re-formatted into a friendlier local
            reading of a moment the factory wrote (§ Typography › The Factory
            Speaks in Mono Rule). */}
        {item.expires_at && (
          <span className="until">
            until <span className="num">{item.expires_at}</span>
          </span>
        )}
        {/* The join that could not be made, named where its answer would have
            been (constitution III). The item still renders everything else. */}
        {item.degraded && (
          <span className="join-degraded" data-mode={item.degraded.mode}>
            {item.degraded.what}
          </span>
        )}
      </div>
      <div className="body-col">
        <span className="where num">{item.correlation_id}</span>
        {blocks.map((block, index) => (
          <p
            key={index}
            className={block.kind === "label" ? "micro block" : `prose block ${block.kind}`}
            data-block={block.kind}
            data-choice={block.choice ?? undefined}
          >
            {block.text}
          </p>
        ))}
        {/* The factory's word on the last Answer, in the body column DESIGN.md
            puts it in — refusals included, and in the same place. */}
        <RulingLine item={item} />
      </div>
      {/* The one verb. Every control an item has lives in this one component,
          so there is exactly one place a second one could ever be added — and
          `web/tests/unit/noVerb.test.ts` watches it. */}
      <AnswerColumn item={item} />
    </article>
  );
}

/**
 * The stale fold's one line, and everything it still carries (006 US3, FR-008,
 * FR-009; DESIGN.md § The Desk in this world › The stale fold).
 *
 * An item whose deadline has passed is a fact, not an emergency: it stops
 * taking a full card's worth of the operator's eye, and it loses nothing. The
 * collapsed line is the three things DESIGN.md names — kind, id, "expired
 * <ago>" — and opening it gives back the factory's own `expires_at` and the
 * delivered text, byte for byte.
 *
 * Two rules are structural here rather than remembered:
 *
 * 1. **Nothing is re-derived or reworded** (FR-009). The body renders
 *    `item.text` as the single block the factory sent, not the segmented
 *    reading the live card lays out, so a test can assert the rendered text is
 *    *equal* to the delivered text rather than merely close to it. The expiry
 *    is the factory's string, in mono, in the `.until` slot the live card uses
 *    (§ Typography › The Factory Speaks in Mono Rule) — never re-formatted.
 * 2. **Collapsing is layout, never editing** (constitution III). The verb comes
 *    with the item into the fold: expiry is the factory's ruling to make and
 *    the pane deletes nothing while it waits for one, so a late Answer still
 *    goes from here exactly as it goes from a live card (003 FR-013).
 */
export function StaleAttentionLine({ item, doc }: AttentionItemProps) {
  const kind = item.kind;
  // The same two inputs the live card's clock takes, on the other side of the
  // deadline — the document's reference instant, never the pane's own clock
  // (001 FR-019, the countdown anchor rule).
  const ago = timeSince(item.expires_at, referenceInstant(doc));

  return (
    <details
      className={`stale-item ${RANK_CLASSES[kind]}`}
      data-kind={kind}
      data-id={item.id}
      data-stale="true"
      data-expires-at={item.expires_at ?? undefined}
    >
      <summary className="stale-line">
        <span className="kind">{KIND_LABELS[kind]}</span>
        <span className="where num">{item.correlation_id}</span>
        {/* "expired <ago>", and no countdown: there is nothing left to count
            down to, and the pane will not invent a second clock to say so. */}
        <span className="ago num">{ago === null ? "expired" : `expired ${ago} ago`}</span>
      </summary>
      <div className="stale-body">
        {item.expires_at && (
          <span className="until">
            until <span className="num">{item.expires_at}</span>
          </span>
        )}
        {/* The delivered text whole, as one verbatim block. */}
        <p className="prose stale-text">{item.text}</p>
        {/* The factory's word on the last Answer, unchanged by the fold. */}
        <RulingLine item={item} />
        {/* The one verb, still reachable: see rule 2 above. */}
        <AnswerColumn item={item} />
      </div>
    </details>
  );
}
