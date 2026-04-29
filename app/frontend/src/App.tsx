import { useEffect, useState } from "react";
import { getLibrary } from "./api/client";
import { IngestPage } from "./pages/IngestPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { upsertLibraryDocument, type LibraryDocumentEntry } from "./pages/libraryState";

type View = "library" | "ingest" | "reader" | "settings";

const views: { id: View; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "ingest", label: "Ingest" },
  { id: "reader", label: "Reader" },
  { id: "settings", label: "Settings" }
];

export function App() {
  const [view, setView] = useState<View>("library");
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocumentEntry[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [libraryErrorMessage, setLibraryErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLibrary() {
      try {
        const library = await getLibrary();
        if (!isMounted) {
          return;
        }

        setLibraryDocuments(
          library.documents.map((document) => ({
            document,
            chapters: []
          }))
        );
        setLibraryErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown library error";
        setLibraryErrorMessage(`Unable to load library: ${message}`);
      } finally {
        if (isMounted) {
          setIsLibraryLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleDocumentIngested(document: LibraryDocumentEntry["document"], chapters: LibraryDocumentEntry["chapters"]) {
    setLibraryDocuments((current) => upsertLibraryDocument(current, document, chapters));
    setLibraryErrorMessage(null);
  }

  let content;
  switch (view) {
    case "library":
      content = (
        <LibraryPage
          documents={libraryDocuments}
          isLoading={isLibraryLoading}
          errorMessage={libraryErrorMessage}
        />
      );
      break;
    case "ingest":
      content = (
        <IngestPage
          onIngested={handleDocumentIngested}
          onViewLibrary={() => setView("library")}
        />
      );
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
