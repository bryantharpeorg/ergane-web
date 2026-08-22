import { useSyncExternalStore } from "react";

const getPath = () => window.location.pathname;

const subscribePath = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};

export default function App() {
  const pathname = useSyncExternalStore(subscribePath, getPath, getPath);
  const deskActive = pathname === "/" || pathname === "/desk";

  return (
    <>
      <header className="mast">
        <span className="mark">ERGANE</span>
        <nav aria-label="Rooms">
          <a href="/desk" aria-current={deskActive ? "page" : undefined}>
            Desk
          </a>
          <a href="/showfloor" aria-current={!deskActive ? "page" : undefined}>
            Showfloor
          </a>
        </nav>
        <p className="floorline">floor not read yet</p>
      </header>
      <main id="room"></main>
    </>
  );
}
