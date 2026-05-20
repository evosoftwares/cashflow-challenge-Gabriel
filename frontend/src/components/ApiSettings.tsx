type ApiSettingsProps = {
  apiStatus: "checking" | "online" | "offline";
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function getApiTargetLabel() {
  try {
    const url = new URL(apiBaseUrl);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return isLocal ? `API local ${url.host}` : `API ${url.host}`;
  } catch {
    return "API configurada";
  }
}

export function ApiSettings({ apiStatus }: ApiSettingsProps) {
  const statusLabel =
    apiStatus === "online" ? "API conectada" : apiStatus === "offline" ? "API indisponível" : "Verificando API";
  const apiTargetLabel = getApiTargetLabel();

  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark brand-mark--carrefour" aria-hidden="true">
          <span className="brand-mark__left" />
          <span className="brand-mark__center">C</span>
          <span className="brand-mark__right" />
        </div>
        <div>
          <h1>Carrefour Fluxo de Caixa</h1>
          <p>Entradas, saídas e saldo diário da loja</p>
        </div>
      </div>
      <div className="header-controls">
        <span
          aria-label={`${statusLabel}. ${apiTargetLabel}`}
          className={`api-status api-status--${apiStatus}`}
          title={`${statusLabel}: ${apiBaseUrl}`}
        >
          <span className="status-dot" aria-hidden="true" />
          <span className="api-status__content">
            <span className="api-status__label">{statusLabel}</span>
            <span className="api-status__target">{apiTargetLabel}</span>
          </span>
        </span>
      </div>
    </header>
  );
}
