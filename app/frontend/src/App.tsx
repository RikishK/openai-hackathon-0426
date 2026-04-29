import { useMemo, useState } from "react";
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

  const content = useMemo(() => {
    switch (view) {
      case "library":
        return <LibraryPage />;
      case "ingest":
        return <IngestPage />;
      case "reader":
        return <ReaderPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return null;
    }
  }, [view]);

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
