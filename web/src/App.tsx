import "./styles/global.css";

function App() {
  const pathname = window.location.pathname;
  const isDesk = pathname === "/" || pathname === "/desk";

  return (
    <>
      <header className="mast">
        <span className="mark">ERGANE</span>
        <nav aria-label="Rooms">
          <a href="/desk" aria-current={isDesk ? "page" : undefined}>Desk</a>
          <a href="/showfloor">Showfloor</a>
        </nav>
        <p className="floorline">
          <em>floor not read yet</em>
        </p>
      </header>
      <main id="room"></main>
    </>
  );
}

export default App;
