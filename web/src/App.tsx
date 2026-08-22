import "./styles/global.css";

export function App() {
  const path = window.location.pathname;
  const deskActive = path === "/" || path === "/desk";

  return (
    <>
      <header className="mast">
        <span className="mark">ERGANE</span>
        <nav aria-label="Rooms">
          <a href="/desk" aria-current={deskActive ? "page" : undefined}>
            Desk
          </a>
          <a href="/showfloor">Showfloor</a>
        </nav>
        <span className="floorline">
          <span className="live">live floor</span>
          <span className="num">0</span> running
          <span className="micro">floor not read yet</span>
        </span>
      </header>
      <main id="room"></main>
    </>
  );
}
