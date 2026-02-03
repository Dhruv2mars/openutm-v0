import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary, ToastProvider } from "@openutm/ui";
import App from "./App";
import "./main.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
