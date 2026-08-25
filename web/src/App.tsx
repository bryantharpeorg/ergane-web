import Desk from "./desk/Desk";
import Masthead from "./Masthead";
import Showfloor from "./showfloor/Showfloor";
import { DESK_PATH, isShowfloorPath } from "./routes";

export default function App() {
  const pathname = window.location.pathname;
  const isDesk = pathname === "/" || pathname === DESK_PATH;
  // 005 US2 (FR-009): the room answers at `/showfloor` and at
  // `/showfloor/<spec-dir>`, which is the same room with a selection.
  const isShowfloor = isShowfloorPath(pathname);

  return (
    <>
      {/* The Showfloor carries its own appbar, inside its frame (005 US2,
          DESIGN.md § Layout) — and the badge that hangs off its far edge with
          it. Rendering this one too would put two on that page, which is what
          the first world did. */}
      {isShowfloor ? null : <Masthead />}
      {isDesk ? <Desk /> : isShowfloor ? <Showfloor /> : <main id="room" />}
    </>
  );
}
