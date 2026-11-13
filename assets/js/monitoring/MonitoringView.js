import { DateTimeFormatter } from "./DateTimeFormatter.js?v=20261112-1";

export class MonitoringView {
  constructor(root = document) {
    this.root = root;
    this.name = root.querySelector("#monitor-latest-name");
    this.details = root.querySelector("#monitor-latest-details");
    this.source = root.querySelector("#monitor-latest-source");
    this.feedback = root.querySelector("#monitor-feedback");
    this.historyBody = root.querySelector("#monitor-history-body");
    this.historyCount = root.querySelector("#history-count");
    this.refreshButton = root.querySelector("#monitor-refresh");
  }

  renderLatest({ name, vehicle, code, timestamp, source, kind = "movement" }) {
    const { date, time } = DateTimeFormatter.split(timestamp);
    this.name.textContent = String(name || "Estado reportado").slice(0, 100);
    const hasCode = code !== undefined && code !== null && code !== "" && Number.isFinite(Number(code));
    const facts = [vehicle ? String(vehicle).slice(0, 100) : null, hasCode ? `Código ${Number(code)}` : null, `Fecha ${date}`, `Hora ${time}`]
      .filter(Boolean);
    this.details.textContent = facts.join(" · ");
    this.source.textContent = source || (kind === "demo"
      ? "Evento de DEMO recibido por WSS; no representa un registro individual del historial."
      : "Evento recibido por WSS; no confirma movimiento físico del vehículo.");
  }

  renderLatestUnavailable(message) {
    this.name.textContent = "Estado no disponible";
    this.details.textContent = message;
    this.source.textContent = "No se pudo comprobar el estado actual en la API.";
  }

  setLoading() {
    this.feedback.textContent = "Sincronizando estado e historial con la API…";
    this.feedback.dataset.state = "loading";
    this.refreshButton.disabled = true;
    this.refreshButton.setAttribute("aria-busy", "true");
  }

  finishLoading() {
    this.refreshButton.disabled = false;
    this.refreshButton.setAttribute("aria-busy", "false");
  }

  renderHistory(records) {
    this.historyBody.replaceChildren();
    if (!records.length) {
      const row = this.root.createElement("tr");
      const cell = this.root.createElement("td");
      cell.colSpan = 4;
      cell.className = "monitor-empty";
      cell.textContent = "Sin movimientos individuales registrados.";
      row.append(cell);
      this.historyBody.append(row);
      this.historyCount.textContent = "0 registros";
      this.feedback.textContent = "Historial sincronizado · no hay movimientos individuales.";
      this.feedback.dataset.state = "success";
      return;
    }

    records.forEach((record, index) => {
      const { date, time } = DateTimeFormatter.split(record.fecha_hora);
      const row = this.root.createElement("tr");
      for (const value of [String(index + 1), record.comando, date, time]) {
        const cell = this.root.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      row.dataset.historyId = String(record.id_historial);
      this.historyBody.append(row);
    });
    this.historyCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
    this.feedback.textContent = "Historial confirmado por la API · ordenado del más reciente al más antiguo.";
    this.feedback.dataset.state = "success";
  }

  renderHistoryError(message) {
    this.feedback.textContent = `No se pudo actualizar el historial: ${message}`;
    this.feedback.dataset.state = "error";
  }

  renderStateError(message) {
    this.name.textContent = "No se pudo consultar el estado";
    this.details.textContent = message;
    this.source.textContent = "El historial se consulta por separado y puede seguir disponible.";
  }
}
