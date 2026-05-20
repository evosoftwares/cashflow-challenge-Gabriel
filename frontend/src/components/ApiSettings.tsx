type ApiSettingsProps = {
  apiStatus: "checking" | "online" | "offline";
};

export function ApiSettings({ apiStatus }: ApiSettingsProps) {
  const statusLabel =
    apiStatus === "online" ? "Sistema conectado" : apiStatus === "offline" ? "Sistema indisponível" : "Verificando sistema";

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
        <span className={`api-status api-status--${apiStatus}`}>
          <span className="status-dot" aria-hidden="true" />
          {statusLabel}
        </span>
      </div>
    </header>
  );
}
