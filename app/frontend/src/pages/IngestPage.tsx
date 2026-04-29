import { useState } from "react";
import type { FormEvent } from "react";
import { ingestText } from "../api/client";

export function IngestPage() {
  const [title, setTitle] = useState("Draft Article");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Submitting");

    try {
      const response = await ingestText({ title, text });
      setStatus(`Saved ${response.document.title}`);
    } catch {
      setStatus("Failed to submit ingest request");
    }
  }

  return (
    <section className="card stack" aria-labelledby="ingest-title">
      <h2 id="ingest-title">Ingest</h2>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="stack">
          <span>Title</span>
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label className="stack">
          <span>Text</span>
          <textarea
            onChange={(event) => setText(event.target.value)}
            rows={6}
            value={text}
          />
        </label>
        <button type="submit">Submit Text</button>
      </form>
      <p>{status}</p>
    </section>
  );
}
