import type { AttentionItem, FloorDocument } from "../api/floorDocument";
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

const RANK_CLASSES: Record<AttentionItem["kind"], string> = {
  escalation: "high",
  question: "medium",
  notice: "low",
};

export default function AttentionItemView({ item, doc }: AttentionItemProps) {
  const kind = item.kind;
  const left = timeLeft(item.expires_at, referenceInstant(doc));
  const id = item.id;
  const where = "";

  if (kind === "notice") {
    return (
      <article
        className={`item ${RANK_CLASSES[kind]}`}
        data-kind={kind}
        data-id={id}
      >
        <div className="clock-col">
          <span className="kind">{KIND_LABELS[kind]}</span>
          <span className="no-deadline">no clock</span>
        </div>
        <div className="body-col">
          {where && <span className="where num">{where}{id && <> · {id}</>}</span>}
          <p className="prose">{item.text}</p>
        </div>
        <div className="answer-col">
          <span className="answer-note">Asks for nothing; no answer exists.</span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`item ${RANK_CLASSES[kind]}`}
      data-kind={kind}
      data-expires-at={item.expires_at ?? undefined}
      data-id={id}
    >
      <div className="clock-col">
        <span className="kind">{KIND_LABELS[kind]}</span>
        {left.kind === "remaining" && <span className="clock num">{left.text}</span>}
        {left.kind === "expired" && <span className="clock num expired">expired</span>}
        {left.kind === "none" && <span className="no-deadline">no deadline from the factory</span>}
        {item.expires_at && <span className="until">until {item.expires_at}Z</span>}
      </div>
      <div className="body-col">
        {where && <span className="where num">{where}{id && <> · {id}</>}</span>}
        <p className="prose">{item.text}</p>
      </div>
      <div className="answer-col">
        <span className="answer-note">answered from the CLI until spec 003 lands</span>
      </div>
    </article>
  );
}
