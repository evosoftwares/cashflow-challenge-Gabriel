type ApiSettingsProps = {
  apiKey: string;
  apiStatus: "checking" | "online" | "offline";
  onApiKeyChange: (value: string) => void;
};

export function ApiSettings({ apiKey, apiStatus, onApiKeyChange }: ApiSettingsProps) {
  const statusLabel = apiStatus === "online" ? "API online" : apiStatus === "offline" ? "API indisponível" : "Verificando API";

  return (
    <header className="app-header">
      <div>
        <h1>Cash Flow Portal</h1>
        <p>Operação de lançamentos e consolidado diário</p>
      </div>
      <form className="header-controls" onSubmit={(event) => event.preventDefault()}>
        <span className={`api-status api-status--${apiStatus}`}>{statusLabel}</span>
        <label className="field field--api-key">
          <span>API Key</span>
          <input
            aria-label="API Key"
            autoComplete="off"
            type="text"
            value={apiKey}
            placeholder="local-dev-key"
            onChange={(event) => onApiKeyChange(event.target.value)}
          />
        </label>
      </form>
    </header>
  );
}
