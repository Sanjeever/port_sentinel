import ReactDOM from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import "./i18n";
import "./style.css";
import App from "./App";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <HeroUIProvider>
    <App />
  </HeroUIProvider>,
);
