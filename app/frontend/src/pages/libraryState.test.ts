import { describe, expect, it } from "vitest";
import type { LibraryDocumentEntry } from "./libraryState";
import { upsertLibraryDocument } from "./libraryState";

describe("upsertLibraryDocument", () => {
  it("adds ingested document to front of library list", () => {
    const existing: LibraryDocumentEntry[] = [
      {
        document: { id: "doc_existing", title: "Existing", type: "text" },
        chapters: []
      }
    ];

    const updated = upsertLibraryDocument(
      existing,
      { id: "doc_pdf", title: "Uploaded PDF", type: "pdf" },
      [{ id: "ch_1", index: 0, title: "Chapter 1" }]
    );

    expect(updated).toHaveLength(2);
    expect(updated[0]?.document.id).toBe("doc_pdf");
    expect(updated[0]?.chapters).toHaveLength(1);
    expect(updated[1]?.document.id).toBe("doc_existing");
  });

  it("replaces existing document entry with fresh chapter metadata", () => {
    const existing: LibraryDocumentEntry[] = [
      {
        document: { id: "doc_pdf", title: "Uploaded PDF", type: "pdf" },
        chapters: []
      }
    ];

    const updated = upsertLibraryDocument(
      existing,
      { id: "doc_pdf", title: "Uploaded PDF", type: "pdf" },
      [
        { id: "ch_1", index: 0, title: "Intro" },
        { id: "ch_2", index: 1, title: "Deep Dive" }
      ]
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]?.chapters).toHaveLength(2);
    expect(updated[0]?.chapters[1]?.title).toBe("Deep Dive");
  });
});
