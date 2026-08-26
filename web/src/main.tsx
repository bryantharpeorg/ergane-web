import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./showfloor/showfloor.css";
import "./review/review.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
