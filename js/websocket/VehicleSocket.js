import { APP_CONFIG } from "../config.js?v=20261109-3";

export class VehicleSocket {
  constructor(url = APP_CONFIG.websocketUrl) {
    this.url = url; this.socket = null; this.retryTimer = null; this.retryMs = 1_000; this.hasConnected = false; this.stopped = true;
  }
  connect(onState, onMessage) {
    this.onState = onState; this.onMessage = onMessage; this.stopped = false; this.#open();
    return () => this.disconnect();
  }
  #open() {
    if (this.stopped) return;
    this.onState(this.hasConnected ? "Reconectando" : "Conectando");
    try { this.socket = new WebSocket(this.url); }
    catch { this.onState("Desconectado"); this.#retry(); return; }
    this.socket.addEventListener("open", () => { this.hasConnected = true; this.retryMs = 1_000; this.onState("En línea"); });
    this.socket.addEventListener("message", (event) => this.onMessage(event.data));
    this.socket.addEventListener("error", () => this.onState("Desconectado"));
    this.socket.addEventListener("close", () => { if (!this.stopped) { this.onState("Reconectando"); this.#retry(); } });
  }
  #retry() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = window.setTimeout(() => { this.retryTimer = null; this.#open(); }, this.retryMs + Math.floor(Math.random() * 350));
    this.retryMs = Math.min(this.retryMs * 2, 30_000);
  }
  disconnect() { this.stopped = true; window.clearTimeout(this.retryTimer); this.retryTimer = null; this.socket?.close(); }
}
