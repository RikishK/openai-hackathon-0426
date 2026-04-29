export function SettingsPage() {
  return (
    <section className="card stack" aria-labelledby="settings-title">
      <h2 id="settings-title">Settings</h2>
      <label className="stack">
        <span>OpenAI API Key</span>
        <input placeholder="sk-..." type="password" value="" readOnly />
      </label>
      <button type="button">Clear Audio Cache</button>
    </section>
  );
}
