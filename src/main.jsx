import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AppErrorBoundary } from "./SystemPages.jsx";
import { ConfirmDialogProvider } from "./ConfirmDialog.jsx";
import "./tailwind.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ConfirmDialogProvider><App /></ConfirmDialogProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
