const LABELS = {
  websocket: "WebSocket WSS",
  api: "API AWS · 21 servicios",
  database: "Amazon RDS",
};

export function renderStatuses(container, states) {
  container.replaceChildren();
  for (const [key, value] of Object.entries(states)) {
    const column = document.createElement("div");
    column.className = "col-12 col-md-4";
    const title = document.createElement("div");
    title.className = "small text-secondary";
    title.textContent = LABELS[key];
    const status = document.createElement("div");
    status.className = "status-value";
    status.textContent = value;
    column.append(title, status);
    container.append(column);
  }
}
