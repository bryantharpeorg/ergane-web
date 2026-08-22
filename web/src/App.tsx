import Desk from "./desk/Desk";

export default function App() {
  const pathname = window.location.pathname;
  const isDesk = pathname === "/" || pathname === "/desk";

  return (
    <>
      <header className="mast">
        <span className="mark">ERGANE</span>
        <nav>
          <a href="/desk" aria-current={isDesk ? "page" : undefined}>
            Desk
          </a>
          <a href="/showfloor">Showfloor</a>
        </nav>
        <span className="floorline">
          <em>floor not read yet</em>
        </span>
      </header>
      {isDesk ? <Desk /> : <main id="room" />}
    </>
  );
}
