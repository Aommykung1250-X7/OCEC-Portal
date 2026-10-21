import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AppErrorBoundary } from "./SystemPages.jsx";
import "./styles.css";
import "./design-refresh.css";
import "./rainbow-theme.css";
import "./landing-sky.css";
import "./admin-dashboard-v14.css";
import "./public-blue-theme.css";
import "./public-refero-theme.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
