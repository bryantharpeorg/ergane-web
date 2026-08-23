/**
 * The landing line at the right edge of one epic's stage.
 *
 * DESIGN.md § Route Map and Landing Line: one olive 3px vertical line with a
 * 1px sage centre stroke, labelled "landing line", with four 16px stations
 * bottom to top — PASSED, PR_OPEN, ENQUEUED, MERGED — 64px apart. A story on
 * the landing run is a 7px-radius token (teal; olive `.queue` once ENQUEUED)
 * with a 3px mist stroke, placed at its stage and labelled in micro with the
 * story id. The MERGED end is the landed shelf: one card per merged node and
 * the count ("MERGED ×3").
 *
 * FR-011 (spec US3-S1).
 */

import type { StagedNode } from "./types";
import StationNode from "./StationNode";

/** Bottom to top, as the line is drawn. */
export const LANDING_ORDER = ["PASSED", "PR_OPEN", "ENQUEUED", "MERGED"] as const;

export type LandingStage = (typeof LANDING_ORDER)[number];

const STAGE_CAPTIONS: Record<LandingStage, string> = {
  PASSED: "passed",
  PR_OPEN: "pr open",
  ENQUEUED: "enqueued",
  MERGED: "merged",
};

interface LandingLineProps {
  nodes: StagedNode[];
}

export default function LandingLine({ nodes }: LandingLineProps): JSX.Element {
  const merged = nodes.filter((node) => node.state === "MERGED");

  return (
    <aside className="landing-line" data-landing-line>
      <span className="landing-line-label">landing line</span>
      <div className="landing-line-track">
        {LANDING_ORDER.map((stage) => {
          const riding = nodes.filter((node) => node.state === stage);
          return (
            <div
              key={stage}
              className="landing-station"
              data-landing-station={stage}
            >
              <span className="landing-station-mark" />
              <span className="landing-station-label">
                {STAGE_CAPTIONS[stage]}
              </span>
              <span className="landing-station-tokens">
                {riding.map((node) => (
                  <span
                    key={node.id}
                    className={
                      stage === "ENQUEUED" || stage === "MERGED"
                        ? "landing-token queue"
                        : "landing-token"
                    }
                    data-landing-token
                    data-node-id={node.id}
                    data-landing-stage={stage}
                  >
                    <span className="landing-token-label">{node.id}</span>
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="landed-shelf" data-landed-shelf>
        <p className="landed-shelf-count">MERGED ×{merged.length}</p>
        {merged.map((node) => (
          <StationNode key={node.id} data={{ node, shelf: true }} />
        ))}
      </div>
    </aside>
  );
}
