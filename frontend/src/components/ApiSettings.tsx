import { Activity, KeyRound } from "lucide-react";

type ApiSettingsProps = {
  apiKey: string;
  apiStatus: "checking" | "online" | "offline";
  onApiKeyChange: (value: string) => void;
};

export function ApiSettings({ apiKey, apiStatus, onApiKeyChange }: ApiSettingsProps) {
  const statusLabel =
    apiStatus === "online" ? "Sistema conectado" : apiStatus === "offline" ? "Sistema indisponível" : "Verificando sistema";

  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <Activity size={22} strokeWidth={2.2} />
        </div>
        <div>
          <h1>Cash Flow Portal</h1>
          <p>Entradas, saídas e saldo do dia</p>
        </div>
      </div>
      <form className="header-controls" onSubmit={(event) => event.preventDefault()}>
        <span className={`api-status api-status--${apiStatus}`}>
          <span className="status-dot" aria-hidden="true" />
          {statusLabel}
        </span>
        <label className="field field--api-key">
          <span>
            <KeyRound size={14} strokeWidth={2.2} aria-hidden="true" />
            Chave de acesso
          </span>
          <input
            aria-label="Chave de acesso"
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
