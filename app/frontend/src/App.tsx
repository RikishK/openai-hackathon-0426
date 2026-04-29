import { useState } from "react";
import { IngestPage } from "./pages/IngestPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SettingsPage } from "./pages/SettingsPage";

type View = "library" | "ingest" | "reader" | "settings";

const views: { id: View; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "ingest", label: "Ingest" },
  { id: "reader", label: "Reader" },
  { id: "settings", label: "Settings" }
];

export function App() {
  const [view, setView] = useState<View>("library");

  let content;
  switch (view) {
    case "library":
      content = <LibraryPage />;
      break;
    case "ingest":
      content = <IngestPage />;
      break;
    case "reader":
      content = <ReaderPage />;
      break;
    case "settings":
      content = <SettingsPage />;
      break;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>TTS Reader</h1>
        <nav aria-label="Primary">
          <ul className="app-nav">
            {views.map((item) => (
              <li key={item.id}>
                <button
                  className={item.id === view ? "is-active" : ""}
                  onClick={() => setView(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="app-main">{content}</main>
    </div>
  );
}
