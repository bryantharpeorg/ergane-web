import Desk from "./desk/Desk";
import Masthead from "./Masthead";
import Showfloor from "./showfloor/Showfloor";
import { DESK_PATH, SHOWFLOOR_PATH } from "./routes";

export default function App() {
  const pathname = window.location.pathname;
  const isDesk = pathname === "/" || pathname === DESK_PATH;
  const isShowfloor = pathname === SHOWFLOOR_PATH;

  return (
    <>
      <Masthead />
      {isDesk ? <Desk /> : isShowfloor ? <Showfloor /> : <main id="room" />}
    </>
  );
}
