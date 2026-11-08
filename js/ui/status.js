const LABELS = {
  websocket: ["WebSocket WSS", "◉"],
  api: ["API AWS · 21 servicios", "☁"],
  database: ["Amazon RDS", "▤"],
};

const stateKind = (key, value) => {
  const text = String(value).toLowerCase();
  if (key === "database") return text === "disponible" ? "online" : text === "no disponible" ? "offline" : "unknown";
  if (text.includes("no disponible") || text.includes("desconectado")) return "offline";
  if (text.includes("en línea") || text.includes("disponible")) return "online";
  if (text.includes("conectando") || text.includes("reconectando") || text.includes("comprobando")) return "checking";
  return "offline";
};

export function renderStatuses(container, states) {
  container.replaceChildren();
  for (const [key, value] of Object.entries(states)) {
    const item = document.createElement("article");
    item.className = "status-item";
    item.dataset.state = stateKind(key, value);
    const label = document.createElement("div");
    label.className = "status-top";
    const symbol = document.createElement("span");
    symbol.className = "status-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = LABELS[key][1];
    const title = document.createElement("span");
    title.textContent = LABELS[key][0];
    label.append(symbol, title);
    const status = document.createElement("p");
    status.className = "status-value";
    status.textContent = value;
    item.append(label, status);
    container.append(item);
  }
}
