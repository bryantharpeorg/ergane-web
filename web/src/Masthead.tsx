import { ReactNode } from "react";
import { DESK_PATH, SHOWFLOOR_PATH } from "./routes";

interface MastheadProps {
  trailing?: ReactNode;
}

export default function Masthead({ trailing }: MastheadProps): JSX.Element {
  const pathname = window.location.pathname;
  const deskCurrent = pathname === "/" || pathname === DESK_PATH;
  const showfloorCurrent = pathname === SHOWFLOOR_PATH;

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
      </nav>
      <span className="floorline">
        {trailing ?? <em>floor not read yet</em>}
      </span>
    </header>
  );
}
