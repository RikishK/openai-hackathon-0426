interface A11yCueManagerProps {
  cue: string;
}

export function A11yCueManager({ cue }: A11yCueManagerProps) {
  return (
    <div className="card" aria-live="polite">
      Cue ready: {cue}
    </div>
  );
}
