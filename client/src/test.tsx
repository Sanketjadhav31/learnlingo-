import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TestRoute } from "./components/TestRoute";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TestRoute />
  </StrictMode>
);
