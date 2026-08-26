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
      {/* Both rooms carry their own appbar, inside their own frame (005 US2 for
          the Showfloor, 006 US1 for the Desk; DESIGN.md § Layout). Rendering
          this one too would put two on those pages, which is what the first
          world did. What is left here is the appbar for a path that is neither
          room — the shell still names itself while it holds nothing. */}
      {isDesk || isShowfloor ? null : <Masthead />}
      {isDesk ? <Desk /> : isShowfloor ? <Showfloor /> : <main id="room" />}
    </>
  );
}
