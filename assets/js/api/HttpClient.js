import { APP_CONFIG } from "../config.js?v=20261122-6";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ApiTimeoutError extends ApiError {
  constructor() {
    super("La API tardó demasiado en responder. Inténtalo de nuevo.");
    this.name = "ApiTimeoutError";
  }
}

export class HttpClient {
  constructor({ baseUrl = APP_CONFIG.apiBaseUrl, timeoutMs = APP_CONFIG.apiTimeoutMs, fetcher = fetch,
    tokenProvider = () => { try { return sessionStorage.getItem("control-iot:access-token"); } catch { return null; } } } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetcher = fetcher.bind(globalThis);
    this.tokenProvider = tokenProvider;
  }

  async request(path, { method = "GET", body, signal, timeoutMs = this.timeoutMs, headers = {} } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const token = this.tokenProvider?.();
      const response = await this.fetcher(new URL(path, this.baseUrl), {
        method,
        headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const raw = await response.text();
      let data = null;
      if (raw) {
        try { data = JSON.parse(raw); }
        catch {
          if (response.ok) throw new ApiError("La API respondió con un formato no válido.", response.status);
          data = null;
        }
      }
      if (!response.ok) {
        const detail = typeof data?.detail === "string" && data.detail.trim()
          ? data.detail.trim()
          : "La API recibió la solicitud, pero no pudo completarla.";
        throw new ApiError(`${detail} (HTTP ${response.status})`, response.status);
      }
      return data;
    } catch (error) {
      if (timedOut) throw new ApiTimeoutError();
      if (error.name === "AbortError") throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(`No se pudo completar la solicitud de red a ${new URL(path, this.baseUrl).host}. Revisa la conexión del navegador e inténtalo de nuevo.`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
