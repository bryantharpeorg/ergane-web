/**
 * The answer column of an attention item — the pane's one verb, rendered.
 *
 * DESIGN.md § Components › Attention Item › Answer column (min-width 220px) and
 * § Components › Buttons. An Escalation offers exactly the choices the factory
 * delivered: one button per delivered choice, its face verbatim, in delivery
 * order, with the `esc:<12hex>:<CHOICE>` payload beneath in mono (§ Typography ›
 * The Factory Speaks in Mono Rule). A Question offers the reply field and one
 * Answer button. A Notice offers nothing, because nothing is being asked.
 *
 * There is no other control here and there is nowhere to add one: a second verb
 * on this column would be the pure-glass defect D-001 forbids, wearing the
 * costume of a convenience (constitution I).
 *
 * Two local guards, and both only ever *withhold* a request (FR-006, FR-009):
 * empty or whitespace-only text is refused before it reaches the wire, and while
 * a settlement is out for this item — this component's own pending request, or
 * the backend reporting `in_flight` — every control is disabled. Neither guard
 * changes the item: rank comes from the backend's settlement state alone, and
 * nothing here writes it.
 *
 * The third thing that withholds is the factory's own ruling, and it is FR-011's
 * whole control. SIGNAL_FAILED — and no other word — leaves the controls live,
 * because SIGNAL_FAILED alone means nothing was recorded and resending is safe.
 * A settled item loses its controls and a ruled one has them disabled: neither
 * offers a way to re-answer, because a stale press re-answering a settled item
 * is precisely the harm making every ruling retriable would do (US3-S3, US3-S4).
 */

import { useRef, useState } from "react";
import type { AttentionItem } from "../api/floorDocument";
import { answerQuestion, pressChoice } from "../api/answer";
import { describeRuling } from "./ruling";

interface AnswerColumnProps {
  item: AttentionItem;
}

const REPLY_PLACEHOLDER =
  "Reply to the node. Sent as your identity; the factory rules on it.";

export default function AnswerColumn({ item }: AnswerColumnProps) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  // The synchronous half of the same guard: two presses in one tick both read
  // the ref before React has re-rendered either of them.
  const outstanding = useRef(false);

  // The backend is the other authority on this: an item whose settlement call is
  // out reports it, so a Desk that reconnected mid-answer renders it disabled
  // without ever having issued the request itself.
  const settling = item.settlement.state === "in_flight";

  const ruling = describeRuling(item.kind, item.settlement);
  // The factory said something final about this item — its own read reports a
  // resolution, or a Question's ruling was RESOLVED. There is nothing left to
  // answer, so there is no control to offer.
  const settled = item.settlement.state === "settled";
  // The factory ruled and the item stayed where it was. The controls remain
  // visible — the operator can see what they answered with — but they do not
  // invite a second send of the same Answer. SIGNAL_FAILED is the exception,
  // and it is the only one there is (FR-011).
  const ruled = item.settlement.state === "ruled" && !ruling.retriable;
  const disabled = pending || settling || ruled;

  function carry(send: () => Promise<unknown>): void {
    if (outstanding.current || disabled) return;
    outstanding.current = true;
    setPending(true);
    send().then(release, release);
  }

  function release(): void {
    outstanding.current = false;
    setPending(false);
  }

  function submitReply(): void {
    // The pane's own refusal, and the only one there is: `handle_relay` has no
    // empty-answer guard, so an empty submission would park the node on nothing.
    if (!text.trim()) return;
    carry(() => answerQuestion(item.correlation_id, text));
  }

  if (item.kind === "notice") {
    return (
      <div className="answer-col">
        <span className="asks-nothing">Asks for nothing; no answer exists.</span>
      </div>
    );
  }

  if (settled) {
    // No control at all, on either answerable kind. The factory's own word is
    // on the item, in the body column, where DESIGN.md puts it; this column
    // only says why it is now empty.
    return (
      <div className="answer-col">
        <span className="asks-nothing">Settled by the factory; nothing to answer.</span>
      </div>
    );
  }

  // The one wording that says a retry is safe, beside the controls it applies
  // to. It is `describeRuling`'s sentence rather than copy written here, so the
  // body column's ruling line and this note cannot drift apart (US3-S3).
  const retriableNote = ruling.retriable ? (
    <span className="retriable">{ruling.sentence}</span>
  ) : null;

  if (item.kind === "escalation") {
    return (
      <div className="answer-col">
        {retriableNote}
        {item.actions.map((choice, index) => (
          <button
            key={choice.payload}
            type="button"
            className={index === 0 ? "btn answer" : "btn choice"}
            data-payload={choice.payload}
            disabled={disabled}
            onClick={() => carry(() => pressChoice(item.correlation_id, choice.payload))}
          >
            <span className="face">{choice.label}</span>
            <span className="payload num">{choice.payload}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="answer-col">
      {retriableNote}
      <textarea
        className="reply"
        aria-label="Your reply"
        placeholder={REPLY_PLACEHOLDER}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" className="btn answer" disabled={disabled} onClick={submitReply}>
        <span className="face">Answer</span>
      </button>
    </div>
  );
}
