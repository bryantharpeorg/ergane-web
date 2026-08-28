import { ReactNode } from "react";
import {
  DESK_PATH,
  DRAFT_PATH,
  SHOWFLOOR_PATH,
  isDraftPath,
  isShowfloorPath,
} from "./routes";

interface MastheadProps {
  trailing?: ReactNode;
}

export default function Masthead({ trailing }: MastheadProps): JSX.Element {
  const pathname = window.location.pathname;
  const deskCurrent = pathname === "/" || pathname === DESK_PATH;
  // A deep-linked selection is still the Showfloor, so the room nav keeps
  // its accent underline there (005 US2, DESIGN.md § Layout).
  const showfloorCurrent = isShowfloorPath(pathname);
  // 018 US1 (FR-008): the drafting table is a room beside the other two, and it
  // is current for any path under `/draft` — the index at the bare path and a
  // spec's trio under it are one room, on the same pattern the Showfloor sets.
  // The review room gets no entry: it has no bare form, so its door is a
  // `landed` row of the index rather than a nav item that could name no epic.
  const draftCurrent = isDraftPath(pathname);

  return (
    <header className="mast">
      <span className="mark">ERGANE</span>
      <nav>
        <a
          href={DESK_PATH}
          aria-current={deskCurrent ? "page" : undefined}
        >
          Desk
        </a>
        <a
          href={SHOWFLOOR_PATH}
          aria-current={showfloorCurrent ? "page" : undefined}
        >
          Showfloor
        </a>
        <a
          href={DRAFT_PATH}
          aria-current={draftCurrent ? "page" : undefined}
        >
          Drafting table
        </a>
      </nav>
      <span className="floorline">
        {trailing ?? <em>floor not read yet</em>}
      </span>
    </header>
  );
}
