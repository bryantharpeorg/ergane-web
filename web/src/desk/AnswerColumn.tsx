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
 */

import { useRef, useState } from "react";
import type { AttentionItem } from "../api/floorDocument";
import { answerQuestion, pressChoice } from "../api/answer";

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
  const disabled = pending || settling;

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

  if (item.kind === "escalation") {
    return (
      <div className="answer-col">
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
