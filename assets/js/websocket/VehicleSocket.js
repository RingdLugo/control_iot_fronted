import { APP_CONFIG } from "../config.js?v=20261123-3";

export class VehicleSocket {
  constructor(url = null) {
    this.url = url; this.socket = null; this.retryTimer = null; this.retryMs = 1_000; this.hasConnected = false; this.stopped = true;
  }
  connect(onState, onMessage, auth = null) {
    this.onState = onState; this.onMessage = onMessage; this.auth = auth;
    this.secure = Boolean(auth?.access_token || auth?.guest_token);
    if (!this.secure) { this.onState("Inicia sesión"); return () => this.disconnect(); }
    this.url = this.url || APP_CONFIG.websocketUrl;
    this.stopped = false; this.#open();
    return () => this.disconnect();
  }
  get isReady() {
    return Boolean(this.secure && this.hasConnected && this.socket?.readyState === WebSocket.OPEN);
  }
  #open() {
    if (this.stopped) return;
    this.onState(this.hasConnected ? "Reconectando" : "Conectando");
    try { this.socket = new WebSocket(this.url); }
    catch { this.onState("Desconectado"); this.#retry(); return; }
    this.socket.addEventListener("open", () => {
      this.retryMs = 1_000;
      if (this.secure) {
        this.onState("Validando acceso");
        this.socket.send(JSON.stringify(this.auth));
      } else {
        this.hasConnected = true; this.onState("En línea");
      }
    });
    this.socket.addEventListener("message", (event) => {
      this.onMessage(event.data);
      if (this.secure) {
        try {
          if (JSON.parse(event.data)?.tipo === "conexion_establecida") {
            this.hasConnected = true; this.onState("En línea");
          }
        } catch { /* El evento se procesa y valida en la aplicación. */ }
      }
    });
    this.socket.addEventListener("error", () => this.onState("Desconectado"));
    this.socket.addEventListener("close", (event) => {
      if (this.stopped) return;
      if (this.secure && event.code === 1008) { this.onState("Acceso WSS rechazado"); return; }
      this.onState("Reconectando"); this.#retry();
    });
  }
  #retry() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = window.setTimeout(() => { this.retryTimer = null; this.#open(); }, this.retryMs + Math.floor(Math.random() * 350));
    this.retryMs = Math.min(this.retryMs * 2, 30_000);
  }
  disconnect() { this.stopped = true; window.clearTimeout(this.retryTimer); this.retryTimer = null; this.socket?.close(); }
}
