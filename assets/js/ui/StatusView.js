const LABELS = { websocket: ["WebSocket WSS", "◉"], api: ["API FastAPI · AWS", "☁"], database: ["Base de datos · Amazon RDS", "▤"] };

export class StatusView {
  #stateKind(key, value) {
    const text = String(value).toLowerCase();
    if (key === "database") return text === "disponible" ? "online" : text === "no disponible" ? "offline" : "unknown";
    if (text.includes("no disponible") || text.includes("desconectado")) return "offline";
    if (text.includes("en línea") || text.includes("disponible")) return "online";
    if (text.includes("conectando") || text.includes("reconectando") || text.includes("comprobando")) return "checking";
    return "offline";
  }
  render(container, states) {
    container.replaceChildren();
    for (const [key, value] of Object.entries(states)) {
      const item = document.createElement("article"); item.className = "status-item"; item.dataset.state = this.#stateKind(key, value);
      const label = document.createElement("div"); label.className = "status-top";
      const icon = document.createElement("span"); icon.className = "status-symbol"; icon.setAttribute("aria-hidden", "true"); icon.textContent = LABELS[key][1];
      const title = document.createElement("span"); title.textContent = LABELS[key][0]; label.append(icon, title);
      const status = document.createElement("p"); status.className = "status-value"; status.textContent = value; item.append(label, status); container.append(item);
    }
  }
}
