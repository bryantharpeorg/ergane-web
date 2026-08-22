import type { AttentionItem, FloorDocument } from "../api/floorDocument";
import { referenceInstant, timeLeft } from "./timeLeft";

interface AttentionItemProps {
  item: AttentionItem;
  doc: FloorDocument;
}

const KIND_LABELS: Record<AttentionItem["kind"], string> = {
  escalation: "Escalation",
  question: "Question",
};

const RANK_CLASSES: Record<AttentionItem["kind"], string> = {
  escalation: "high",
  question: "medium",
};

export default function AttentionItemView({ item, doc }: AttentionItemProps) {
  const kind = item.kind;
  const left = timeLeft(item.expires_at, referenceInstant(doc));
  const document = (item.document || {}) as {
    epic_id?: string;
    node_id?: string;
    question?: string;
    text?: string;
    escalation_id?: string;
    correlation_id?: string;
  };
  const epicId = document.epic_id;
  const nodeId = document.node_id;
  const prose = document.question ?? document.text ?? "";
  const id = item.id ?? document.escalation_id ?? document.correlation_id;
  const where = [epicId, nodeId].filter(Boolean).join(" / ");

  return (
    <article
      className={`item ${RANK_CLASSES[kind]}`}
      data-kind={kind}
      data-expires-at={item.expires_at ?? undefined}
      data-id={id ?? undefined}
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
        <p className="prose">{prose}</p>
      </div>
      <div className="answer-col">
        <span className="answer-note">answered from the CLI until spec 003 lands</span>
      </div>
    </article>
  );
}
