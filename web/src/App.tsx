import Desk from "./desk/Desk";
import Draft from "./draft/Draft";
import Masthead from "./Masthead";
import Showfloor from "./showfloor/Showfloor";
import { DESK_PATH, isDraftPath, isShowfloorPath } from "./routes";

export default function App() {
  const pathname = window.location.pathname;
  const isDesk = pathname === "/" || pathname === DESK_PATH;
  // 005 US2 (FR-009): the room answers at `/showfloor` and at
  // `/showfloor/<spec-dir>`, which is the same room with a selection.
  const isShowfloor = isShowfloorPath(pathname);
  // 014 US1: the third room, and the only one whose address always names a
  // spec — `/draft/<spec-dir>`. It carries its own frame like the other two.
  const isDraft = isDraftPath(pathname);

  return (
    <>
      {/* Every room carries its own appbar, inside its own frame (005 US2 for
          the Showfloor, 006 US1 for the Desk, 014 US1 for the drafting table;
          DESIGN.md § Layout). Rendering this one too would put two on those
          pages, which is what the first world did. What is left here is the
          appbar for a path that is no room at all — the shell still names
          itself while it holds nothing. */}
      {isDesk || isShowfloor || isDraft ? null : <Masthead />}
      {isDesk ? (
        <Desk />
      ) : isShowfloor ? (
        <Showfloor />
      ) : isDraft ? (
        <Draft />
      ) : (
        <main id="room" />
      )}
    </>
  );
}
