export class MonitorSynchronizer {
  constructor({ api, view, vehicleId, debounceMs = 220 }) {
    this.api = api;
    this.view = view;
    this.vehicleId = Number(vehicleId);
    this.debounceMs = debounceMs;
    this.active = false;
    this.controller = null;
    this.timer = null;
    this.requestSequence = 0;
    this.latestRevision = 0;
    this.historyRevision = 0;
    this.latestTimestamp = "";
    this.lastSocketState = "";
    this.seenEvents = new Set();
  }

  enter() {
    this.active = true;
    return this.resynchronize();
  }

  leave() {
    this.active = false;
    this.requestSequence += 1;
    clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
  }

  onSocketState(state) {
    const recovered = state === "En línea" && this.lastSocketState === "Reconectando";
    this.lastSocketState = state;
    if (recovered && this.active) void this.resynchronize();
  }

  async resynchronize() {
    if (!this.active) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const sequence = ++this.requestSequence;
    const revisionAtStart = this.latestRevision;
    const historyRevisionAtStart = this.historyRevision;
    this.view.setLoading();

    const [stateResult, historyResult] = await Promise.allSettled([
      this.api.getLatestState(controller.signal),
      this.api.getRecentHistory(controller.signal),
    ]);
    if (!this.active || sequence !== this.requestSequence || controller.signal.aborted) return;
    this.view.finishLoading();

    if (revisionAtStart === this.latestRevision && stateResult.status === "fulfilled") {
      const state = stateResult.value;
      if (Number(state?.id_vehiculo) === this.vehicleId) {
        const timestamp = state.fecha_actualizacion;
        if (!(timestamp && this.latestTimestamp && timestamp < this.latestTimestamp)) {
          this.latestTimestamp = typeof timestamp === "string" ? timestamp : this.latestTimestamp;
          this.view.renderLatest({
            name: state.comando || "Estado reportado",
            vehicle: state.vehiculo || `Vehículo ${this.vehicleId}`,
            code: state.codigo,
            timestamp,
            source: "Estado vigente consultado por REST; el campo conectado no confirma motores en operación.",
          });
        }
      } else {
        this.view.renderStateError("La respuesta no corresponde al vehículo seleccionado.");
      }
    } else if (revisionAtStart === this.latestRevision && stateResult.status === "rejected" && stateResult.reason?.name !== "AbortError") {
      this.view.renderStateError(stateResult.reason?.message || "Error de conexión.");
    }

    if (historyRevisionAtStart === this.historyRevision && historyResult.status === "fulfilled") {
      try {
        this.view.renderHistory(this.#normalizeHistory(historyResult.value));
      } catch (error) {
        this.view.renderHistoryError(error.message);
      }
    } else if (historyRevisionAtStart === this.historyRevision && historyResult.status === "rejected" && historyResult.reason?.name !== "AbortError") {
      this.view.renderHistoryError(historyResult.reason?.message || "Error de conexión.");
    }
    if (historyRevisionAtStart !== this.historyRevision) this.scheduleHistorySync();
  }

  handleEvent(event) {
    if (!this.active || !event || Number(event.vehiculo_id) !== this.vehicleId) return;
    const names = {
      movimiento_individual: event.nombre || event.comando || "Movimiento reportado",
      demo_movimiento: event.nombre || event.comando || "Movimiento de DEMO",
      demo_inicio: "DEMO iniciada",
      demo_fin: "DEMO finalizada",
      demo_cancelada: "DEMO cancelada",
      demo_error: "Error reportado en DEMO",
    };
    const name = names[event.tipo];
    if (!name) return;

    const timestamp = typeof event.marca_temporal === "string" ? event.marca_temporal : "";
    if (timestamp && this.latestTimestamp && timestamp < this.latestTimestamp) return;
    const dedupeKey = [event.tipo, event.vehiculo_id, event.comando_id, event.orden, timestamp, event.demo_id].join("|");
    if (this.seenEvents.has(dedupeKey)) return;
    this.seenEvents.add(dedupeKey);
    if (this.seenEvents.size > 120) this.seenEvents.delete(this.seenEvents.values().next().value);

    this.latestRevision += 1;
    if (timestamp) this.latestTimestamp = timestamp;
    const demoEvent = event.tipo.startsWith("demo_");
    this.view.renderLatest({
      name: String(name).replaceAll("_", " "),
      vehicle: event.vehiculo || `Vehículo ${this.vehicleId}`,
      code: event.codigo,
      timestamp,
      kind: demoEvent ? "demo" : "movement",
      source: demoEvent
        ? "Evento WSS de DEMO recibido; los pasos internos no se agregan al historial individual."
        : "Evento individual recibido por WSS; tabla reconciliada con el historial confirmado por REST.",
    });

    if (event.tipo === "movimiento_individual") {
      this.historyRevision += 1;
      this.scheduleHistorySync();
    }
  }

  scheduleHistorySync() {
    if (!this.active) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.resynchronize(); }, this.debounceMs);
  }

  #normalizeHistory(value) {
    if (!Array.isArray(value)) throw new Error("La API no devolvió una lista de movimientos.");
    const records = [];
    const ids = new Set();
    for (const record of value) {
      if (!record || typeof record !== "object") throw new Error("La API devolvió una fila con formato no válido.");
      if (Number(record.id_vehiculo) !== this.vehicleId) continue;
      const id = Number(record.id_historial);
      if (!Number.isInteger(id) || id < 1 || typeof record.comando !== "string" || !record.comando.trim()) {
        throw new Error("La API devolvió un movimiento sin identificador o nombre válidos.");
      }
      if (ids.has(id)) continue;
      ids.add(id);
      records.push({ ...record, id_historial: id });
    }
    // El endpoint documenta su respuesta del más reciente al más antiguo;
    // se conserva ese orden y se limita la presentación a diez filas.
    return records.slice(0, 10);
  }
}
