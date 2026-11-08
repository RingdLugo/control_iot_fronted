import { APP_CONFIG } from "../config.js";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function request(path, { method = "GET", body, signal, timeoutMs = APP_CONFIG.apiTimeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(new URL(path, APP_CONFIG.apiBaseUrl), {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); }
      catch { throw new ApiError("La API respondió con un formato no válido.", response.status); }
    }
    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : `Error HTTP ${response.status}`;
      throw new ApiError(detail, response.status);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError("No se pudo conectar con la API. Revisa la conexión e inténtalo de nuevo.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
