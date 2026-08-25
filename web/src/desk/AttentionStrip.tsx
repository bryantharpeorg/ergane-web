import type { AttentionItem, FloorDocument } from "../api/floorDocument";
import AttentionItemView, { StaleAttentionLine } from "./AttentionItem";
import { rankAttention } from "./rank";
import { referenceInstant, timeLeft } from "./timeLeft";

interface AttentionStripProps {
  doc: FloorDocument;
}

/**
 * Stale is `timeLeft`'s own verdict, and nothing else (006 FR-008).
 *
 * Reusing the function the live card's clock already runs is what keeps the
 * two readings of one deadline from ever disagreeing: an item reads "expired"
 * in the clock slot **because** it is in the fold, not alongside it. The two
 * inputs are the factory-written `expires_at` and the document's reference
 * instant — so an item with no deadline (a Notice, a Question the factory
 * supplied no clock for) is `kind: "none"` and is never stale. It has no clock
 * to expire.
 */
function isStale(item: AttentionItem, reference: Date): boolean {
  return timeLeft(item.expires_at, reference).kind === "expired";
}

export default function AttentionStrip({ doc }: AttentionStripProps) {
  // Rank comes from the settlement state the backend derived, never from
  // anything this room knows: an answer in flight in the browser has not
  // changed any item's place (FR-009).
  const items = rankAttention(doc.attention.items);

  // The split is read at render time from the document the room is holding —
  // its `reference_instant`, never `Date.now()` (001 FR-019). That is also the
  // whole of 006 FR-008's "no local timer": there is no interval to start,
  // because an item crosses its deadline only when a new document arrives on
  // the `floor` channel and this function runs again on it. A page left open
  // and unfed shows the reading of the last document it was sent, which is the
  // honest one — the pane has not been told anything since.
  const reference = referenceInstant(doc);
  const live = items.filter((item) => !isStale(item, reference));
  const stale = items.filter((item) => isStale(item, reference));

  return (
    <section className="attention" aria-labelledby="att">
      <div className="attention-head">
        <h1 id="att">Waiting on you</h1>
        {/* Everything the factory has open, folded or not: the fold is layout
            and changes no count (constitution III). */}
        <span className="count num">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing is waiting on you.</p>
      ) : (
        <>
          {/* Live clocks lead, and each one renders exactly the card it did
              before this story: the fold takes nothing away from them. */}
          {live.length > 0 && (
            <div className="items">
              {live.map((item) => (
                <AttentionItemView key={item.id} item={item} doc={doc} />
              ))}
            </div>
          )}
          {/* An empty fold is an element that can never fill, so there is no
              branch here that renders one (FR-008, US3-S3). */}
          {stale.length > 0 && (
            <details className="stale" data-stale-count={stale.length}>
              <summary className="stale-summary">
                <span className="stale-count num">{stale.length}</span> stale — expired, and
                still here
              </summary>
              <div className="stale-items">
                {stale.map((item) => (
                  <StaleAttentionLine key={item.id} item={item} doc={doc} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
