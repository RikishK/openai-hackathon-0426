interface JobProgressProps {
  state: "queued" | "processing" | "done" | "failed";
}

export function JobProgress({ state }: JobProgressProps) {
  return (
    <div className="card">
      <strong>Job status:</strong> {state}
    </div>
  );
}
