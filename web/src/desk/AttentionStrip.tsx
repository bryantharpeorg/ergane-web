import type { FloorDocument } from "../api/floorDocument";
import AttentionItemView from "./AttentionItem";
import { rankAttention } from "./rank";

interface AttentionStripProps {
  doc: FloorDocument;
}

export default function AttentionStrip({ doc }: AttentionStripProps) {
  // Rank comes from the settlement state the backend derived, never from
  // anything this room knows: an answer in flight in the browser has not
  // changed any item's place (FR-009).
  const items = rankAttention(doc.attention.items);

  return (
    <section className="attention" aria-labelledby="att">
      <div className="attention-head">
        <h1 id="att">Waiting on you</h1>
        <span className="count num">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing is waiting on you.</p>
      ) : (
        <div className="items">
          {items.map((item) => (
            <AttentionItemView key={item.id} item={item} doc={doc} />
          ))}
        </div>
      )}
    </section>
  );
}
