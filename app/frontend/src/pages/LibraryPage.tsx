import type { LibraryDocumentEntry } from "./libraryState";

interface LibraryPageProps {
  documents: LibraryDocumentEntry[];
  isLoading: boolean;
  errorMessage: string | null;
}

function chapterLabel(chapterCount: number): string {
  return `${chapterCount} chapter${chapterCount === 1 ? "" : "s"}`;
}

export function LibraryPage({ documents, isLoading, errorMessage }: LibraryPageProps) {
  if (isLoading) {
    return (
      <section className="card stack" aria-labelledby="library-title">
        <h2 id="library-title">Library</h2>
        <p>Loading library...</p>
      </section>
    );
  }

  return (
    <section className="card stack" aria-labelledby="library-title">
      <h2 id="library-title">Library</h2>
      {errorMessage ? <p>{errorMessage}</p> : null}
      {documents.length === 0 ? <p>No documents have been ingested yet.</p> : null}
      <ul className="library-list" aria-live="polite">
        {documents.map(({ document, chapters }) => (
          <li key={document.id} className="library-item stack">
            <div className="row spread">
              <h3>{document.title}</h3>
              <span className="pill">{document.type.toUpperCase()}</span>
            </div>
            <p>{chapterLabel(chapters.length)}</p>
            {chapters.length > 0 ? (
              <ol className="library-chapters">
                {chapters.map((chapter) => (
                  <li key={chapter.id}>
                    {chapter.index + 1}. {chapter.title}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
