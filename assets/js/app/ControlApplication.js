import { APP_CONFIG } from "../config.js?v=20261109-3";
import { VehicleApi } from "../api/VehicleApi.js?v=20261112-2";
import { JoystickController } from "../control/JoystickController.js?v=20261109-3";
import { MovementCatalog } from "../control/MovementCatalog.js?v=20261109-3";
import { DemoView } from "../control/DemoView.js?v=20261109-3";
import { VehicleSocket } from "../websocket/VehicleSocket.js?v=20261109-3";
import { StatusView } from "../ui/StatusView.js?v=20261109-3";
import { ErrorPresenter } from "../ui/ErrorPresenter.js?v=20261109-3";
import { BubbleEffects } from "../ui/BubbleEffects.js?v=20261109-3";
import { ControlView } from "../ui/ControlView.js?v=20261109-3";
import { MonitoringView } from "../monitoring/MonitoringView.js?v=20261112-1";
import { MonitorSynchronizer } from "../monitoring/MonitorSynchronizer.js?v=20261112-1";


export class ControlApplication {
  constructor() {
    this.api = new VehicleApi(); this.view = new ControlView(); this.demoView = new DemoView();
    this.statusView = new StatusView(); this.bubbleEffects = new BubbleEffects(); this.vehicleSocket = new VehicleSocket();
    this.monitoringView = new MonitoringView();
    this.monitor = new MonitorSynchronizer({ api: this.api, view: this.monitoringView, vehicleId: APP_CONFIG.vehicleId });
    this.statusContainer = this.$("#connection-status");
    this.state = { websocket: "Conectando", api: "Comprobando", database: "Sin verificar" };
    this.commands = [];
    this.activeDemo = false; this.demoStarting = false; this.demoController = null; this.demoRequestController = null;
    this.actionSequence = 0; this.userActionRevision = 0; this.commandBusy = false; this.commandController = null;
    this.pendingCommand = null; this.currentActionCommandId = null; this.demoEventRevision = 0;
    this.demoPreviewController = null; this.demoPreviewSequence = 0;
    this.actionMessage = this.view.actionMessage; this.actionState = this.view.actionState; this.stopButton = this.view.stopButton;
    this.demoSelect = this.view.demoSelect; this.demoStartButton = this.view.demoStartButton; this.demoCancelButton = this.view.demoCancelButton;
    this.demoNote = this.view.demoNote; this.demoPreview = this.view.demoPreview;
    this.joystickPad = this.$("#joystick"); this.joystickHandle = this.$("#joystick-handle");
    this.joystickPads = [this.joystickPad]; this.joysticks = [];
    this.menuToggle = this.$("#menu-toggle"); this.controlNavigation = this.$("#control-navigation");
  }
  $(selector) { return document.querySelector(selector); }
  drawStatuses() { this.statusView.render(this.statusContainer, this.state); }
  start() { return this.initialize(); }
  bubbleBurstAt(x, y) {
      this.bubbleEffects.burstAt(x, y);
  }

  bubbleBurstFromElement(element) {
      this.bubbleEffects.burstFromElement(element);
  }

  showAction(message, status = "idle") {
    this.view.showAction(message, status);
  }

  setCommandState(commandId, value) {
    this.view.setCommandState(commandId, value, this.commands);
  }

  userFacingError(error) {
    if (error?.name === "AbortError") return "La solicitud anterior se canceló para dar prioridad a la nueva acción.";
    return error?.message || ErrorPresenter.message(error);
  }

  eventFacts(event, keys) {
    const labels = {
      vehiculo_id: "vehículo",
      comando_id: "comando",
      codigo: "código",
      origen: "origen",
      marca_temporal: "marca temporal",
      demo_id: "DEMO",
      total_movimientos: "pasos",
      orden: "paso",
      duracion_ms: "duración ms",
      pausa_ms: "pausa ms",
    };
    return keys
      .filter((key) => event[key] !== undefined && event[key] !== null && event[key] !== "")
      .map((key) => `${labels[key] || key} ${String(event[key])}`)
      .join(" · ");
  }

  renderVehicle(vehicle) {
    this.view.renderVehicle(vehicle, APP_CONFIG.vehicleId);
  }

  async loadVehicle() {
    try {
      this.renderVehicle(await this.api.getVehicle());
    } catch (error) {
      if (this.actionState.dataset.state === "idle") {
        this.showAction(`No se pudo cargar la ficha del vehículo: ${this.userFacingError(error)}`, "error");
      }
    }
  }

  renderDemoPreviewError(message) {
    this.demoView.renderError(this.demoPreview, message);
  }

  async loadDemoPreview() {
    this.demoPreviewController?.abort();
    const demoId = Number(this.demoSelect.value);
    const sequence = ++this.demoPreviewSequence;
    if (!demoId) {
      this.demoPreview.hidden = true;
      this.demoPreview.replaceChildren();
      this.demoPreviewController = null;
      return;
    }

    const controller = new AbortController();
    this.demoPreviewController = controller;
    this.demoPreview.hidden = false;
    this.renderDemoPreviewError("Consultando la secuencia guardada en la API…");
    try {
      const steps = await this.api.getDemoSteps(demoId, controller.signal);
      if (sequence !== this.demoPreviewSequence) return;
      if (!Array.isArray(steps) || !steps.every((step) => step && typeof step === "object")) {
        throw new Error("La API devolvió una definición de DEMO no válida.");
      }
      this.demoView.renderSteps(this.demoPreview, steps);
    } catch (error) {
      if (sequence === this.demoPreviewSequence && error.name !== "AbortError") {
        this.renderDemoPreviewError(`No se pudo consultar la definición: ${this.userFacingError(error)}`);
      }
    } finally {
      if (sequence === this.demoPreviewSequence) this.demoPreviewController = null;
    }
  }

  syncControlAvailability() {
    this.view.setAvailability({
      locked: this.activeDemo || this.demoStarting || this.commandBusy,
      commands: this.commands,
      activeDemo: this.activeDemo,
      demoStarting: this.demoStarting,
      demoCancelPending: Boolean(this.demoRequestController),
    });
  }

  updateDemoStatus(note, active = this.activeDemo) {
    this.activeDemo = active;
    this.demoNote.textContent = note;
    this.syncControlAvailability();
  }

  commandName(command) {
    return String(command.nombre).replaceAll("_", " ");
  }

  queueCommand(command) {
    if (!command) {
      this.showAction("Ese movimiento no está disponible en el catálogo del vehículo.", "error");
      return;
    }
    const stop = command === MovementCatalog.findStop(this.commands);
    if ((this.activeDemo || this.demoStarting) && !stop) {
      this.showAction("La DEMO está activa. Cancélala o detenla antes de cambiar de movimiento.", "error");
      return;
    }
    if (stop) {
      void this.sendPriorityStop(command);
      return;
    }

    this.userActionRevision += 1;
    this.currentActionCommandId = Number(command.id_comando);
    this.setCommandState(command.id_comando, "sending");
    this.pendingCommand = command;
    this.showAction(`Solicitado: ${this.commandName(command)}.`, "sending");
    void this.dispatchNextCommand();
  }

  async dispatchNextCommand() {
    if (this.commandBusy || !this.pendingCommand || this.activeDemo || this.demoStarting) return;
    const command = this.pendingCommand;
    this.pendingCommand = null;
    this.commandBusy = true;
    this.syncControlAvailability();
    const sequence = ++this.actionSequence;
    const revision = this.userActionRevision;
    this.commandController = new AbortController();
    try {
      await this.api.postMovement(command.id_comando, this.commandController.signal);
      if (sequence === this.actionSequence && revision === this.userActionRevision && this.actionState.dataset.state !== "received") {
        this.setCommandState(command.id_comando, "accepted");
        this.showAction(`Aceptado por la API: ${this.commandName(command)}. El movimiento físico no se confirma desde esta respuesta.`, "accepted");
      }
    } catch (error) {
      if (sequence === this.actionSequence && error.name !== "AbortError" && this.actionState.dataset.state !== "received") {
        this.setCommandState(command.id_comando, "error");
        this.showAction(this.userFacingError(error), "error");
      }
    } finally {
      if (sequence === this.actionSequence) {
        this.commandBusy = false;
        this.commandController = null;
        this.syncControlAvailability();
        if (this.pendingCommand && !this.activeDemo) void this.dispatchNextCommand();
      }
    }
  }

  async sendPriorityStop(command = MovementCatalog.findStop(this.commands)) {
    if (!command) {
      this.showAction("No hay un comando DETENER activo en el catálogo.", "error");
      return;
    }
    const sequence = ++this.actionSequence;
    this.userActionRevision += 1;
    this.pendingCommand = null;
    this.commandController?.abort();
    this.commandController = null;
    this.commandBusy = true;
    this.syncControlAvailability();
    this.currentActionCommandId = Number(command.id_comando);
    this.setCommandState(command.id_comando, "sending");
    this.showAction("DETENER solicitado con prioridad.", "sending");

    if (this.activeDemo || this.demoStarting) {
      try {
        await this.cancelRunningDemo(true);
      } catch {
        this.demoNote.textContent = "No se confirmó la cancelación de la DEMO; también se enviará DETENER.";
      }
    }

    this.showAction("DETENER solicitado con prioridad.", "sending");
    const controller = new AbortController();
    this.commandController = controller;
    try {
      await this.api.postMovement(command.id_comando, controller.signal);
      if (sequence === this.actionSequence && this.actionState.dataset.state !== "received") {
        this.setCommandState(command.id_comando, "accepted");
        this.showAction("DETENER aceptado por la API. Esperando el evento WSS correspondiente.", "accepted");
      }
    } catch (error) {
      if (sequence === this.actionSequence && error.name !== "AbortError" && this.actionState.dataset.state !== "received") {
        this.setCommandState(command.id_comando, "error");
        this.showAction(this.userFacingError(error), "error");
      }
    } finally {
      if (sequence === this.actionSequence) {
        this.commandBusy = false;
        this.commandController = null;
        this.syncControlAvailability();
        if (this.pendingCommand && !this.activeDemo) void this.dispatchNextCommand();
      }
    }
  }

  async beginDemo() {
    if (this.activeDemo || this.demoStarting || this.commandBusy || this.pendingCommand || !this.demoSelect.value) return;
    this.userActionRevision += 1;
    const eventRevision = this.demoEventRevision;
    this.demoStarting = true;
    this.demoController = new AbortController();
    this.updateDemoStatus("Solicitud de inicio enviada a la API…", false);
    this.showAction("Inicio de DEMO solicitado.", "sending");
    try {
      await this.api.startDemo(this.demoSelect.value, this.demoController.signal);
      if (eventRevision === this.demoEventRevision) {
        this.activeDemo = true;
        if (this.actionState.dataset.state !== "received") this.showAction("DEMO aceptada por la API. El evento de inicio llegará por WSS.", "accepted");
        this.demoNote.textContent = "DEMO activa · controles bloqueados durante la secuencia.";
      }
    } catch (error) {
      if (error.name !== "AbortError" && eventRevision === this.demoEventRevision) {
        this.activeDemo = false;
        this.showAction(this.userFacingError(error), "error");
        this.demoNote.textContent = "No se pudo iniciar la DEMO.";
      }
    } finally {
      this.demoStarting = false;
      this.demoController = null;
      this.syncControlAvailability();
    }
  }

  async cancelRunningDemo(fromStop = false) {
    if ((!this.activeDemo && !this.demoStarting) || this.demoRequestController) return;
    this.demoController?.abort();
    this.demoRequestController = new AbortController();
    this.syncControlAvailability();
    this.demoNote.textContent = "Cancelación solicitada…";
    if (!fromStop) this.showAction("Cancelación de DEMO solicitada.", "sending");
    try {
      await this.api.cancelDemo(this.demoRequestController.signal);
      if (this.actionState.dataset.state !== "received") {
        this.demoNote.textContent = "Señal de cancelación aceptada por la API; esperando el evento WSS para liberar los controles.";
        if (!fromStop) this.showAction("Cancelación aceptada por la API. Esperando evento WSS.", "accepted");
      }
      this.syncControlAvailability();
    } catch (error) {
      if (error.name !== "AbortError") {
        if (this.actionState.dataset.state === "received") return;
        this.demoNote.textContent = "No se pudo cancelar la DEMO.";
        if (!fromStop) this.showAction(this.userFacingError(error), "error");
        throw error;
      }
    } finally {
      this.demoRequestController = null;
      this.syncControlAvailability();
    }
  }

  handleSocketMessage(raw) {
    let event;
    try { event = JSON.parse(raw); }
    catch { return; }
    if (!event || typeof event !== "object" || Number(event.vehiculo_id) !== APP_CONFIG.vehicleId) return;
    this.monitor.handleEvent(event);

    if (event.tipo === "conexion_establecida") {
      if (this.actionState.dataset.state === "idle") {
        const initialState = event.estado_inicial !== undefined ? " · campo estado_inicial recibido" : "";
        this.showAction(`Canal WSS listo · evento inicial recibido del servidor${initialState}.`, "idle");
      }
      return;
    }
    if (event.tipo === "movimiento_individual") {
      if (Number(event.comando_id) !== this.currentActionCommandId || event.origen !== "WEB_CONTROL") return;
      this.setCommandState(event.comando_id, "received");
      const name = String(event.nombre || "movimiento").replaceAll("_", " ");
      const facts = this.eventFacts(event, ["vehiculo_id", "comando_id", "codigo", "origen", "marca_temporal"]);
      this.showAction(`Evento WSS · ${name} · ${facts}`, "received");
      return;
    }
    if (event.tipo === "demo_inicio") {
      this.demoEventRevision += 1;
      this.activeDemo = true;
      this.demoStarting = false;
      this.updateDemoStatus(`DEMO ${event.demo_id} en marcha · ${event.total_movimientos} pasos ejecutados por el servidor.`, true);
      this.showAction(`Evento WSS · DEMO iniciada · ${this.eventFacts(event, ["demo_id", "total_movimientos", "marca_temporal"])}`, "received");
      return;
    }
    if (event.tipo === "demo_movimiento") {
      this.demoEventRevision += 1;
      this.activeDemo = true;
      const name = String(event.nombre || "comando").replaceAll("_", " ");
      const duration = event.duracion_ms !== undefined ? `${event.duracion_ms} ms` : "duración no informada";
      const pause = event.pausa_ms !== undefined ? `${event.pausa_ms} ms` : "pausa no informada";
      const facts = this.eventFacts(event, ["demo_id", "orden", "comando_id", "codigo", "duracion_ms", "pausa_ms", "marca_temporal"]);
      this.updateDemoStatus(`DEMO · ${name} · ${duration} + ${pause} pausa.`, true);
      this.showAction(`Evento WSS · ${name} · ${facts}`, "received");
      return;
    }
    if (["demo_fin", "demo_cancelada", "demo_error"].includes(event.tipo)) {
      this.demoEventRevision += 1;
      this.activeDemo = false;
      this.demoStarting = false;
      const labels = { demo_fin: "DEMO finalizada", demo_cancelada: "DEMO cancelada", demo_error: "La DEMO reportó un error" };
      this.updateDemoStatus(`${labels[event.tipo]} · evento recibido por WSS.`, false);
      this.showAction(`Evento WSS · ${labels[event.tipo]} · ${this.eventFacts(event, ["demo_id", "marca_temporal"])}`, event.tipo === "demo_error" ? "error" : "received");
    }
  }

  setDirectionLabel(direction, group = "drive") {
    if (direction === "neutral" || direction.startsWith("missing:")) {
      this.view.setDirection(direction, group);
      const stop = MovementCatalog.findStop(this.commands);
      if (stop) this.queueCommand(stop);
      return;
    }
    const command = MovementCatalog.commandForDirection(this.commands, direction, group);
    this.bubbleBurstFromElement(this.joystickPad);
    this.view.setDirection(direction, group, command ? this.commandName(command) : "Movimiento");
  }

  async refreshApiStatus() {
    this.state.api = "Comprobando";
    this.drawStatuses();
    try {
      await this.api.getHealth();
      this.state.api = "Disponible · GET / responde";
    } catch {
      this.state.api = "No disponible";
    }
    this.drawStatuses();
  }

  installCommandControls() {
    this.placeStopButton();
    MovementCatalog.renderAuxiliary(this.$("#auxiliary-controls"), this.commands, this.queueCommand.bind(this));
    MovementCatalog.renderDirectionButtons(this.$("#drive-mapping"), this.commands, "drive", this.queueCommand.bind(this));
    this.stopButton.addEventListener("click", () => {
      this.joysticks.forEach((stick) => stick.release(false));
      void this.sendPriorityStop();
    });
    this.joysticks = [new JoystickController({
      pad: this.joystickPad,
      handle: this.joystickHandle,
      commands: this.commands,
      onCommand: this.queueCommand.bind(this),
      onDirection: this.setDirectionLabel.bind(this),
      group: "drive",
    }).mount()];
    this.syncControlAvailability();
  }

  placeStopButton() {
    const destination = this.$("#center-stop");
    destination.append(this.stopButton);
  }

  async initialize() {
    this.drawStatuses();
    const setActiveView = (view) => {
      const showDemo = view === "demo";
      const showMonitor = view === "monitoring";
      const controlView = this.$("#control-view");
      const demoView = this.$("#demo-view");
      const monitorView = this.$("#monitor-view");
      controlView.hidden = showDemo || showMonitor;
      demoView.hidden = !showDemo;
      monitorView.hidden = !showMonitor;
      this.controlNavigation.querySelectorAll("[data-view-target]").forEach((button) => {
        const active = button.dataset.viewTarget === view;
        button.classList.toggle("is-current", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      this.menuToggle.setAttribute("aria-expanded", "false");
      this.menuToggle.setAttribute("aria-label", "Abrir menú");
      this.controlNavigation.dataset.open = "false";
      if (showMonitor) void this.monitor.enter();
      else this.monitor.leave();
    };
    setActiveView("control");

    this.$("#demo-quick").addEventListener("click", () => setActiveView("demo"));
    this.$("#monitor-refresh").addEventListener("click", () => { void this.monitor.resynchronize(); });
    this.placeStopButton();

    this.menuToggle.addEventListener("click", () => {
      const open = this.menuToggle.getAttribute("aria-expanded") !== "true";
      this.menuToggle.setAttribute("aria-expanded", String(open));
      this.menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      this.controlNavigation.dataset.open = String(open);
    });
    this.controlNavigation.querySelectorAll("[data-view-target]").forEach((button) => {
      button.addEventListener("click", () => setActiveView(button.dataset.viewTarget));
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest(".command-button, #stop-button, .demo-start, .demo-cancel, .demo-shortcut, [data-view-target]")) {
        this.bubbleBurstAt(event.clientX, event.clientY);
      }
    });
    this.demoSelect.addEventListener("change", () => this.bubbleBurstFromElement(this.demoSelect));
    this.vehicleSocket.connect((value) => {
      this.state.websocket = value;
      this.drawStatuses();
      this.monitor.onSocketState(value);
    }, this.handleSocketMessage.bind(this));
    void this.refreshApiStatus();
    setInterval(() => { void this.refreshApiStatus(); }, APP_CONFIG.apiCheckIntervalMs);
    void this.loadVehicle();

    try {
      const result = await this.api.getCommands();
      if (!Array.isArray(result) || !result.every((command) => command && typeof command === "object"
        && Number.isInteger(Number(command.id_comando)) && typeof command.nombre === "string"
        && Number.isFinite(Number(command.codigo)))) {
        throw new Error("La API devolvió un catálogo de movimientos no válido.");
      }
      this.commands.push(...result);
      if (!this.commands.length) throw new Error("El catálogo no contiene comandos.");
      this.installCommandControls();
    } catch (error) {
      this.$("#auxiliary-controls").textContent = "No se pudo cargar el catálogo de movimientos.";
      this.$("#drive-direction-label").textContent = "No disponible";
      this.placeStopButton();
      this.stopButton.disabled = true;
      this.showAction(this.userFacingError(error), "error");
    }

    try {
      const result = await this.api.getDemos();
      const count = this.demoView.renderCatalog(this.demoSelect, Array.isArray(result) ? result : []);
      this.demoNote.textContent = count ? "La API ejecuta los pasos y sus pausas." : "No hay DEMO activas disponibles.";
    } catch (error) {
      this.demoSelect.replaceChildren(new Option("No se pudieron cargar las DEMO", ""));
      this.demoSelect.disabled = true;
      this.demoNote.textContent = this.userFacingError(error);
    }
    this.syncControlAvailability();

    this.demoSelect.addEventListener("change", () => {
      this.syncControlAvailability();
      void this.loadDemoPreview();
    });
    this.demoStartButton.addEventListener("click", () => { void this.beginDemo(); });
    this.demoCancelButton.addEventListener("click", () => { void this.cancelRunningDemo(); });
  }


}
