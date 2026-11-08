import { APP_CONFIG } from "../config.js";

export function connectWebSocket(onState, onMessage) {
  let socket;
  let retryTimer;
  let stopped = false;
  let retryMs = 1_000;

  const connect = () => {
    if (stopped) return;
    onState(retryMs === 1_000 ? "Conectando" : "Reconectando");
    socket = new WebSocket(APP_CONFIG.websocketUrl);
    socket.addEventListener("open", () => {
      retryMs = 1_000;
      onState("En línea");
    });
    socket.addEventListener("message", (event) => onMessage(event.data));
    socket.addEventListener("error", () => onState("Desconectado"));
    socket.addEventListener("close", () => {
      onState("Reconectando");
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30_000);
    });
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
