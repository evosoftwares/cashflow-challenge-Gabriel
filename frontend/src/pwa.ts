type ServiceWorkerRegistrationTarget = {
  register: (scriptURL: string) => Promise<unknown>;
};

type RegisterServiceWorkerOptions = {
  isProduction?: boolean;
  serviceWorker?: ServiceWorkerRegistrationTarget;
  windowTarget?: Pick<EventTarget, "addEventListener">;
  onError?: (error: unknown) => void;
};

export function registerServiceWorker(options: RegisterServiceWorkerOptions = {}) {
  const isProduction = options.isProduction ?? import.meta.env.PROD;
  const serviceWorker =
    options.serviceWorker ?? (typeof navigator !== "undefined" ? navigator.serviceWorker : undefined);
  const windowTarget = options.windowTarget ?? (typeof window !== "undefined" ? window : undefined);
  const onError = options.onError ?? (() => undefined);

  if (!isProduction || !serviceWorker || !windowTarget) {
    return;
  }

  windowTarget.addEventListener("load", () => {
    void serviceWorker.register("/sw.js").catch(onError);
  });
}
