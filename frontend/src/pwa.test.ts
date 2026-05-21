import { describe, expect, test, vi } from "vitest";

import { registerServiceWorker } from "./pwa";

describe("registerServiceWorker", () => {
  test("does not register during development", () => {
    const serviceWorker = { register: vi.fn() };
    const windowTarget = new EventTarget();

    registerServiceWorker({
      isProduction: false,
      serviceWorker,
      windowTarget,
    });

    windowTarget.dispatchEvent(new Event("load"));

    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  test("registers the app shell service worker in production", () => {
    const serviceWorker = { register: vi.fn().mockResolvedValue(undefined) };
    const windowTarget = new EventTarget();

    registerServiceWorker({
      isProduction: true,
      serviceWorker,
      windowTarget,
    });

    windowTarget.dispatchEvent(new Event("load"));

    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });
});
