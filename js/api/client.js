import { APP_CONFIG } from "../config.js";

export async function request(path, { signal, timeoutMs = APP_CONFIG.apiTimeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const response = await fetch(new URL(path, APP_CONFIG.apiBaseUrl), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`API respondió HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}
