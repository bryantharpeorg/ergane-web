import type { AttentionItem, FloorDocument } from "../api/floorDocument";
import AnswerColumn from "./AnswerColumn";
import { referenceInstant, timeLeft } from "./timeLeft";

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
  const left = timeLeft(item.expires_at, referenceInstant(doc));

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
            {left.kind === "remaining" && <span className="clock num">{left.text}</span>}
            {left.kind === "expired" && <span className="clock num expired">expired</span>}
            {left.kind === "none" && (
              <span className="no-deadline">no deadline from the factory</span>
            )}
          </>
        )}
        {item.expires_at && <span className="until">until {item.expires_at}Z</span>}
      </div>
      <div className="body-col">
        <span className="where num">{item.correlation_id}</span>
        <p className="prose">{item.text}</p>
      </div>
      {/* The one verb. Every control an item has lives in this one component,
          so there is exactly one place a second one could ever be added — and
          `web/tests/unit/noVerb.test.ts` watches it. */}
      <AnswerColumn item={item} />
    </article>
  );
}
