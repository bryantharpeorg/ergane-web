import Desk from "./desk/Desk";
import Draft from "./draft/Draft";
import Masthead from "./Masthead";
import Review from "./review/Review";
import Showfloor from "./showfloor/Showfloor";
import {
  DESK_PATH,
  isDraftPath,
  isReviewPath,
  isShowfloorPath,
} from "./routes";

export default function App() {
  const pathname = window.location.pathname;
  const isDesk = pathname === "/" || pathname === DESK_PATH;
  // 005 US2 (FR-009): the room answers at `/showfloor` and at
  // `/showfloor/<spec-dir>`, which is the same room with a selection.
  const isShowfloor = isShowfloorPath(pathname);
  // 011 US1: the review room answers at `/review` and at `/review/<spec-dir>`,
  // which is the same room scoped to one landed epic.
  const isReview = isReviewPath(pathname);
  // 014 US1: the drafting table, and the only room whose address always names a
  // spec — `/draft/<spec-dir>`. It carries its own frame like the others.
  const isDraft = isDraftPath(pathname);

  return (
    <>
      {/* Every room carries its own appbar, inside its own frame (005 US2 for
          the Showfloor, 006 US1 for the Desk, 011 US1 for the review room,
          014 US1 for the drafting table; DESIGN.md § Layout). Rendering this
          one too would put two on those pages, which is what the first world
          did. What is left here is the appbar for a path that is no room at
          all — the shell still names itself while it holds nothing. */}
      {isDesk || isShowfloor || isReview || isDraft ? null : <Masthead />}
      {isDesk ? (
        <Desk />
      ) : isShowfloor ? (
        <Showfloor />
      ) : isReview ? (
        <Review />
      ) : isDraft ? (
        <Draft />
      ) : (
        <main id="room" />
      )}
    </>
  );
}
