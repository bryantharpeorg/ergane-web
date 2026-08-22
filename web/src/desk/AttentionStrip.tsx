import type { FloorDocument } from "../api/floorDocument";
import AttentionItemView from "./AttentionItem";

interface AttentionStripProps {
  doc: FloorDocument;
}

export default function AttentionStrip({ doc }: AttentionStripProps) {
  const items = doc.attention.items;

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
          {items.map((item, index) => (
            <AttentionItemView key={index} item={item} doc={doc} />
          ))}
        </div>
      )}
    </section>
  );
}
