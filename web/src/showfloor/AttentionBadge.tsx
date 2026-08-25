/**
 * The Showfloor's one link: a count of the Attention items waiting on the
 * operator, pointing at the Desk where they are answered (FR-017).
 *
 * DESIGN.md § Navigation (the attention badge at the far right in clay-ink
 * with a clay bell dot; it is a link, the Showfloor's only one),
 * § Colors (waiting on you is gold, and gold is only ever that).
 *
 * 005 US2 points the link at `/` rather than `/desk`: the Desk answers at both,
 * and `/` is the room's front door — the appbar's own nav is where the named
 * route belongs. The destination is unchanged; only its spelling is.
 *
 * Three renderings, in this order of precedence:
 *
 * 1. The attention read degraded — a note naming what could not be learned and
 *    the mode in words, and no count. The degraded entry wins whether or not
 *    items are also present: a count taken from a read that failed is a number
 *    the pane cannot stand behind (constitution III). The note is never the
 *    numeral zero.
 * 2. No items — nothing at all.
 * 3. Items — exactly one anchor, the count then the words.
 *
 * The count is `attention.items.length` and this component filters nothing.
 * 003-an-answer-reaches-the-factory's `contracts/api.md` declares that the
 * floor document's `attention.items` carries only *unsettled* items — settled
 * ones are reachable through `GET /api/attention` — so the list's length is the
 * number waiting on the operator both before and after that epic lands.
 */

import type { AttentionItem, DegradedEntry } from "../api/floorDocument";
import { DESK_ROOT_PATH } from "../routes";

interface AttentionBadgeProps {
  attention: { seam: string; items: AttentionItem[] };
  degraded: DegradedEntry[];
}

/** 001's two degraded modes, said in words (constitution III). */
const MODE_WORDS: Record<DegradedEntry["mode"], string> = {
  transport: "transport failure: the read could not be made",
  refusal: "query refusal: the factory declined to answer",
};

export default function AttentionBadge({
  attention,
  degraded,
}: AttentionBadgeProps): JSX.Element | null {
  const failed = degraded.find((entry) => entry.section === "attention");

  if (failed) {
    return (
      <span
        className="attention-degraded"
        data-attention-degraded
        data-mode={failed.mode}
        role="status"
      >
        {`Attention unread: the open Attention items could not be counted — ${
          MODE_WORDS[failed.mode] ?? failed.mode
        } (${failed.read}).`}
      </span>
    );
  }

  const count = attention.items.length;
  if (count === 0) {
    return null;
  }

  return (
    <a className="attention-badge" data-attention-badge href={DESK_ROOT_PATH}>
      <span className="num">{count}</span>
      <span className="attention-badge-words">{" waiting on you → Desk"}</span>
    </a>
  );
}
