import { APP_CONFIG } from "../config.js?v=20261123-3";
import { VehicleApi } from "../api/VehicleApi.js?v=20261123-8";
import { HttpClient } from "../api/HttpClient.js?v=20261122-6";
import { JoystickController } from "../control/JoystickController.js?v=20261123-5";
import { MovementCatalog } from "../control/MovementCatalog.js?v=20261123-1";
import { DemoView } from "../control/DemoView.js?v=20261123-1";
import { VehicleSocket } from "../websocket/VehicleSocket.js?v=20261123-3";
import { StatusView } from "../ui/StatusView.js?v=20261122-6";
import { ErrorPresenter } from "../ui/ErrorPresenter.js?v=20261109-3";
import { BubbleEffects } from "../ui/BubbleEffects.js?v=20261109-3";
import { ControlView } from "../ui/ControlView.js?v=20261123-5";
import { MonitoringView } from "../monitoring/MonitoringView.js?v=20261112-1";
import { MonitorSynchronizer } from "../monitoring/MonitorSynchronizer.js?v=20261112-1";
import { AdministrationController } from "../admin/AdministrationController.js?v=20261124-2";


export class ControlApplication {
  constructor() {
    this.httpClient = new HttpClient();
    this.api = new VehicleApi(this.httpClient); this.view = new ControlView(); this.demoView = new DemoView();
    this.vehicleId = APP_CONFIG.vehicleId;
    this.statusView = new StatusView(); this.bubbleEffects = new BubbleEffects(); this.vehicleSocket = new VehicleSocket();
    this.monitoringView = new MonitoringView();
    this.monitor = new MonitorSynchronizer({ api: this.api, view: this.monitoringView, vehicleId: this.vehicleId });
    this.administration = new AdministrationController({
      root: document,
      httpClient: this.httpClient,
      onVehicleSelect: (id) => { void this.useVehicle(id); },
      onIdentityChange: (identity) => this.applyIdentityNavigation(identity),
      onNavigate: (view) => this.navigateView?.(view),
    });
    this.statusContainer = this.$("#connection-status");
    this.state = { websocket: "Conectando", api: "Comprobando", database: "Sin verificar" };
    this.commands = [];
    this.isSimulatedVehicle = false;
    this.vehicleValidated = false;
    this.simulationConfig = { movimientos: [], asignaciones: { drive: {}, arm: {} } };
    this.demosCatalog = [];
    this.demoDraft = [];
    this.outputStates = this.readOutputStates();
    this.activeDemo = false; this.activeDemoId = null; this.demoStarting = false; this.demoController = null; this.demoRequestController = null;
    this.actionSequence = 0; this.userActionRevision = 0; this.commandBusy = false; this.commandController = null;
    this.pendingCommand = null; this.currentActionCommandId = null; this.demoEventRevision = 0;
    this.demoPreviewController = null; this.demoPreviewSequence = 0;
    this.catalogRevision = 0; this.commandControlsInstalled = false;
    this.actionMessage = this.view.actionMessage; this.actionState = this.view.actionState; this.stopButton = this.view.stopButton;
    this.demoSelect = this.view.demoSelect; this.demoStartButton = this.view.demoStartButton; this.demoCancelButton = this.view.demoCancelButton;
    this.demoNote = this.view.demoNote; this.demoPreview = this.view.demoPreview;
    this.joystickPad = this.$("#drive-joystick"); this.joystickHandle = this.$("#drive-joystick-handle");
    this.armJoystickPad = this.$("#arm-joystick"); this.armJoystickHandle = this.$("#arm-joystick-handle");
    this.joystickPads = [this.joystickPad, this.armJoystickPad].filter(Boolean); this.joysticks = [];
    this.menuToggle = this.$("#menu-toggle"); this.controlNavigation = this.$("#control-navigation");
  }
  $(selector) { return document.querySelector(selector); }

  applyIdentityNavigation(identity) {
    this.currentIdentity = identity;
    const guest = identity?.type === "guest";
    const authenticated = identity?.type === "account";
    const isAdmin = authenticated && identity.principal.roles.includes("ADMINISTRADOR");
    this.$(".page-shell")?.classList.toggle("admin-session", Boolean(isAdmin));
    const visibility = {
      control: authenticated || guest,
      monitoring: authenticated,
      demo: authenticated || guest,
      admin: !guest,
    };
    for (const button of this.controlNavigation.querySelectorAll("[data-view-target]")) {
      const target = button.dataset.viewTarget;
      const label = button.querySelector(".nav-label");
      const text = target === "admin"
        ? (isAdmin ? "ADMINISTRACIÓN" : authenticated ? "MIS VEHÍCULOS" : "INICIAR SESIÓN")
        : target.toUpperCase();
      if (label) label.textContent = text;
      button.setAttribute("aria-label", text);
      button.hidden = !visibility[target];
      if (button.hidden) button.setAttribute("aria-hidden", "true");
      else button.removeAttribute("aria-hidden");
    }
    const navOrder = isAdmin
      ? ["admin", "control", "monitoring", "demo"]
      : ["control", "monitoring", "demo", "admin"];
    const navButtons = new Map([...this.controlNavigation.querySelectorAll("[data-view-target]")]
      .map((button) => [button.dataset.viewTarget, button]));
    for (const target of navOrder) {
      const button = navButtons.get(target);
      if (button) this.controlNavigation.append(button);
    }
    if (!identity) this.navigateView?.("admin");
    else if (guest && ["admin", "monitoring"].includes(this.currentView)) this.navigateView?.("control");
    this.$("#demo-quick").hidden = false;
    const guestExit = this.$("#public-session-exit");
    if (guestExit) guestExit.hidden = !guest;
    this.updateBuyerCapabilities();
  }
  updateBuyerCapabilities() {
    const roles = this.currentIdentity?.type === "account" ? this.currentIdentity.principal.roles : [];
    this.canDesignDemos = this.isSimulatedVehicle
      && roles.some((role) => ["USUARIO", "ADMINISTRADOR"].includes(role));
    this.$("#demo-tab-create").hidden = !this.canDesignDemos;
    this.$("#demo-tab-edit").hidden = !this.canDesignDemos;
    if (!this.canDesignDemos && this.demoTabActive !== "run") this.demoTabActive = "run";
    this.activateDemoTab(this.demoTabActive || "run");
    if (this.canDesignDemos) void this.loadSimulationSettings();
  }
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

  socketCredentials() {
    try {
      const accessToken = sessionStorage.getItem("control-iot:access-token");
      if (accessToken) return { access_token: accessToken };
      const guestToken = sessionStorage.getItem("control-iot:guest-token");
      if (guestToken) return { guest_token: guestToken };
      return null;
    } catch { return null; }
  }

  connectVehicleSocket() {
    this.vehicleSocket?.disconnect();
    if (!this.api.hasControlSession() || this.vehicleId <= 0) {
      this.state.websocket = "Inicia sesión";
      this.drawStatuses();
      return;
    }
    const socketUrl = new URL(APP_CONFIG.websocketUrl);
    socketUrl.pathname = socketUrl.pathname.replace(/\/\d+$/, `/${this.vehicleId}`);
    this.vehicleSocket = new VehicleSocket(socketUrl.toString());
    this.vehicleSocket.connect((value) => {
      this.state.websocket = value;
      this.drawStatuses();
      this.monitor.onSocketState(value);
    }, this.handleSocketMessage.bind(this), this.socketCredentials());
  }

  async useVehicle(id) {
    const vehicleId = Number(id);
    if (!Number.isInteger(vehicleId) || vehicleId < 1
      || (!this.api.hasAccountSession() && !this.api.hasGuestSession())) return;
    this.joysticks.forEach((stick) => stick.release(false));
    this.commandController?.abort();
    this.demoController?.abort();
    this.demoRequestController?.abort();
    this.demoPreviewController?.abort();
    this.commandController = null;
    this.commandBusy = false;
    this.activeDemo = false;
    this.activeDemoId = null;
    this.demoStarting = false;
    this.vehicleId = vehicleId;
    this.api.setVehicleId(vehicleId);
    this.monitor.leave();
    this.monitor.vehicleId = vehicleId;
    this.commands.splice(0);
    this.demosCatalog = [];
    this.isSimulatedVehicle = false;
    this.vehicleValidated = false;
    this.simulationConfig = { movimientos: [], asignaciones: { drive: {}, arm: {} } };
    this.outputStates = this.readOutputStates();
    this.demoSelect.replaceChildren(new Option("Cargando DEMOs…", ""));
    this.demoSelect.disabled = true;
    this.syncControlAvailability();
    this.connectVehicleSocket();
    this.navigateView?.("control");
    await this.loadVehicle();
    await this.loadControlCatalog();
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
    this.view.renderVehicle(vehicle, this.vehicleId);
  }

  async loadVehicle() {
    const vehicleId = this.vehicleId;
    try {
      const vehicle = await this.api.getVehicle();
      if (vehicleId !== this.vehicleId) return;
      this.isSimulatedVehicle = String(vehicle?.microcontrolador || "").toUpperCase() === "SIMULADO";
      this.vehicleValidated = true;
      this.renderVehicle(vehicle);
      this.updateBuyerCapabilities();
    } catch (error) {
      if (vehicleId !== this.vehicleId) return;
      if (this.actionState.dataset.state === "idle") {
        this.showAction(`No se pudo cargar la ficha del vehículo: ${this.userFacingError(error)}`, "error");
      }
    }
  }

  async loadControlCatalog() {
    const revision = ++this.catalogRevision;
    const vehicleId = this.vehicleId;
    this.commands.splice(0);
    this.demosCatalog = [];
    this.$("#auxiliary-controls").textContent = "Cargando movimientos…";
    this.demoSelect.replaceChildren(new Option("Cargando DEMOs…", ""));
    this.demoSelect.disabled = true;
    try {
      const result = await this.api.getCommands();
      if (revision !== this.catalogRevision || vehicleId !== this.vehicleId) return;
      if (!Array.isArray(result) || !result.every((command) => command && typeof command === "object"
        && Number.isInteger(Number(command.id_comando)) && typeof command.nombre === "string"
        && Number.isFinite(Number(command.codigo)))) {
        throw new Error("La API devolvió un catálogo de movimientos no válido.");
      }
      this.commands.push(...result);
      if (!this.commands.length) throw new Error("El catálogo no contiene comandos.");
      this.installCommandControls();
    } catch (error) {
      if (revision !== this.catalogRevision || vehicleId !== this.vehicleId) return;
      this.$("#auxiliary-controls").textContent = "No se pudo cargar el catálogo de movimientos.";
      this.$("#drive-direction-label").textContent = "No disponible";
      this.placeStopButton();
      this.stopButton.disabled = true;
      this.showAction(this.userFacingError(error), "error");
    }

    try {
      const result = await this.api.getDemos();
      if (revision !== this.catalogRevision || vehicleId !== this.vehicleId) return;
      this.demosCatalog = Array.isArray(result) ? result : [];
      const count = this.demoView.renderCatalog(this.demoSelect, this.demosCatalog);
      this.demoNote.textContent = count ? "La API ejecuta los pasos y sus pausas." : "No hay DEMO activas disponibles.";
    } catch (error) {
      if (revision !== this.catalogRevision || vehicleId !== this.vehicleId) return;
      this.demoSelect.replaceChildren(new Option("No se pudieron cargar las DEMO", ""));
      this.demoSelect.disabled = true;
      this.demoNote.textContent = this.userFacingError(error);
    }
    if (revision !== this.catalogRevision || vehicleId !== this.vehicleId) return;
    this.populateBuyerCommandOptions();
    this.syncControlAvailability();
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
      this.loadBuyerDemoDraft(0, []);
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
      this.loadBuyerDemoDraft(demoId, steps);
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
      locked: !this.vehicleValidated || this.activeDemo || this.demoStarting || this.commandBusy,
      commands: this.commands,
      vehicleValidated: this.vehicleValidated,
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

  commandName(command, outputState = undefined) {
    const outputKey = MovementCatalog.outputKey(command);
    if (outputKey) {
      const enabled = typeof outputState === "boolean" ? outputState : this.outputStates[outputKey];
      return `${outputKey === "led" ? "Luz" : "Sonido"} ${enabled ? "encendida" : "apagada"}`;
    }
    const words = String(command?.nombre || "Movimiento").replaceAll("_", " ").toLocaleLowerCase("es-MX");
    return words.replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("es-MX"));
  }

  readOutputStates() {
    const fallback = { led: false, sound: false };
    try {
      const stored = JSON.parse(localStorage.getItem(`control-iot:${this.vehicleId}:outputs`) || "null");
      if (!stored || typeof stored !== "object") return fallback;
      return { led: stored.led === true, sound: stored.sound === true };
    } catch { return fallback; }
  }

  saveOutputStates() {
    try { localStorage.setItem(`control-iot:${this.vehicleId}:outputs`, JSON.stringify(this.outputStates)); }
    catch { /* El control sigue funcionando aunque el navegador bloquee el almacenamiento local. */ }
  }

  updateOutputState(command, enabled) {
    const key = MovementCatalog.outputKey(command);
    if (!key) return;
    this.outputStates[key] = Boolean(enabled);
    this.saveOutputStates();
    this.view.setOutputState(command, enabled);
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

    const outputKey = MovementCatalog.outputKey(command);
    const outputState = outputKey ? !this.outputStates[outputKey] : null;
    if (outputKey) this.updateOutputState(command, outputState);

    this.userActionRevision += 1;
    this.currentActionCommandId = Number(command.id_comando);
    this.setCommandState(command.id_comando, "sending");
    this.pendingCommand = { command, outputState };
    this.showAction(this.commandName(command, outputState), "sending");
    void this.dispatchNextCommand();
  }

  async dispatchNextCommand() {
    if (this.commandBusy || !this.pendingCommand || this.activeDemo || this.demoStarting) return;
    const pending = this.pendingCommand;
    const command = pending.command;
    this.pendingCommand = null;
    this.commandBusy = true;
    this.syncControlAvailability();
    const sequence = ++this.actionSequence;
    const revision = this.userActionRevision;
    this.commandController = new AbortController();
    try {
      await this.api.postMovement(command.id_comando, this.commandController.signal, pending.outputState);
      if (sequence === this.actionSequence && revision === this.userActionRevision && this.actionState.dataset.state !== "received") {
        this.setCommandState(command.id_comando, "accepted");
        this.showAction(this.commandName(command, pending.outputState), "accepted");
      }
    } catch (error) {
      if (sequence === this.actionSequence && error.name !== "AbortError" && this.actionState.dataset.state !== "received") {
        const outputKey = MovementCatalog.outputKey(command);
        if (outputKey && this.outputStates[outputKey] === pending.outputState) this.updateOutputState(command, !pending.outputState);
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
    if (this.isSimulatedVehicle) {
      this.joysticks.forEach((stick) => stick.release(false));
      this.showAction("Joystick en pausa · simulación detenida", "received");
      return;
    }
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
    this.showAction(this.commandName(command), "sending");

    if (this.activeDemo || this.demoStarting) {
      try {
        await this.cancelRunningDemo(true);
      } catch {
        this.demoNote.textContent = "No se confirmó la cancelación de la DEMO; también se enviará DETENER.";
      }
    }

    this.showAction(this.commandName(command), "sending");
    const controller = new AbortController();
    this.commandController = controller;
    try {
      await this.api.postMovement(command.id_comando, controller.signal);
      if (sequence === this.actionSequence && this.actionState.dataset.state !== "received") {
        this.setCommandState(command.id_comando, "accepted");
        this.showAction(this.commandName(command), "accepted");
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
    if (!event || typeof event !== "object" || Number(event.vehiculo_id) !== this.vehicleId) return;
    this.monitor.handleEvent(event);

    if (event.tipo === "conexion_establecida") {
      if (this.actionState.dataset.state === "idle") {
        const initialState = event.estado_inicial !== undefined ? " · campo estado_inicial recibido" : "";
        this.showAction(`Canal WSS listo · evento inicial recibido del servidor${initialState}.`, "idle");
      }
      return;
    }
    if (event.tipo === "movimiento_simulado" && event.simulado === true) {
      this.showAction(`${event.nombre}${event.grados ? ` · ${event.grados}°` : ""} · evento de simulación`, "received");
      return;
    }
    if (event.tipo === "movimiento_individual") {
      const command = this.commands.find((item) => Number(item.id_comando) === Number(event.comando_id));
      this.syncOutputStateFromEvent(event, command);
      const ownControlEvent = event.origen === "WEB_CONTROL" || event.origen === "WEB_GUEST";
      if (Number(event.comando_id) !== this.currentActionCommandId || !ownControlEvent) return;
      this.setCommandState(event.comando_id, "received");
      this.showAction(this.commandName(command || { nombre: event.nombre }, event.estado_salida), "received");
      return;
    }
    if (event.tipo === "control_error" && this.api.hasGuestSession()) {
      const command = this.commands.find((item) => Number(item.id_comando) === Number(event.comando_id));
      const outputKey = command && MovementCatalog.outputKey(command);
      if (outputKey && typeof event.estado_salida === "boolean"
          && this.outputStates[outputKey] === event.estado_salida) {
        this.updateOutputState(command, !event.estado_salida);
      }
      if (event.comando_id != null && Number(event.comando_id) === this.currentActionCommandId) {
        this.setCommandState(event.comando_id, "error");
        this.showAction(event.detalle || "El servidor rechazó el movimiento.", "error");
      }
      return;
    }
    if (event.tipo === "demo_inicio") {
      this.demoEventRevision += 1;
      this.activeDemo = true;
      this.activeDemoId = Number(event.demo_id) || null;
      this.demoView.resetStepProgress(this.demoPreview);
      this.demoStarting = false;
      this.updateDemoStatus(`DEMO ${event.demo_id} en marcha · ${event.total_movimientos} pasos ejecutados por el servidor.`, true);
      this.showAction("Demo iniciada", "received");
      return;
    }
    if (event.tipo === "demo_movimiento") {
      this.demoEventRevision += 1;
      this.activeDemo = true;
      const eventDemoId = Number(event.demo_id);
      if (eventDemoId > 0 && eventDemoId === Number(this.demoSelect.value)
        && (!this.activeDemoId || eventDemoId === this.activeDemoId)) {
        this.activeDemoId = eventDemoId;
        this.demoView.highlightStep(this.demoPreview, event.orden);
      }
      const command = this.commands.find((item) => Number(item.id_comando) === Number(event.comando_id));
      this.syncOutputStateFromEvent(event, command);
      const name = this.commandName(command || { nombre: event.nombre }, event.estado_salida);
      this.updateDemoStatus(`DEMO · ${name}.`, true);
      this.showAction(name, "received");
      return;
    }
    if (["demo_fin", "demo_cancelada", "demo_error"].includes(event.tipo)) {
      const finishedDemoMatchesSelection = !event.demo_id || Number(event.demo_id) === Number(this.demoSelect.value);
      if (finishedDemoMatchesSelection) this.demoView.finishStepProgress(this.demoPreview, event.tipo === "demo_fin");
      this.activeDemoId = null;
      this.outputStates = { led: false, sound: false };
      this.saveOutputStates();
      this.commands.forEach((command) => { if (MovementCatalog.outputKey(command)) this.view.setOutputState(command, false); });
      this.demoEventRevision += 1;
      this.activeDemo = false;
      this.demoStarting = false;
      const labels = { demo_fin: "DEMO finalizada", demo_cancelada: "DEMO cancelada", demo_error: "La DEMO reportó un error" };
      this.updateDemoStatus(`${labels[event.tipo]} · evento recibido por WSS.`, false);
      this.showAction(labels[event.tipo].replace("DEMO", "Demo"), event.tipo === "demo_error" ? "error" : "received");
    }
  }

  syncOutputStateFromEvent(event, command) {
    const key = MovementCatalog.outputKey(command);
    if (key) {
      if (typeof event.estado_salida === "boolean") {
        this.updateOutputState(command, event.estado_salida);
      } else if (event.tipo === "demo_movimiento") {
        const mask = Number(event.mascara);
        const bit = key === "led" ? 0x0400 : 0x0100;
        this.updateOutputState(command, (mask & bit) !== 0);
      }
      // Una API anterior omite estado_salida. No dejes que su máscara de
      // activación sobrescriba el estado solicitado por el interruptor web.
      return;
    }
    if (event.mascara === undefined || event.mascara === null) return;
    const mask = Number(event.mascara);
    for (const item of this.commands) {
      const outputKey = MovementCatalog.outputKey(item);
      if (!outputKey) continue;
      const bit = outputKey === "led" ? 0x0400 : 0x0100;
      this.updateOutputState(item, (mask & bit) !== 0);
    }
  }

  setDirectionLabel(direction, group = "drive") {
    if (direction === "neutral" || direction.startsWith("missing:")) {
      this.view.setDirection(direction, group);
      if (this.isSimulatedVehicle) return;
      const stop = MovementCatalog.findStop(this.commands);
      if (stop) this.queueCommand(stop);
      return;
    }
    const simulatedMove = this.isSimulatedVehicle ? this.simulationConfig.movimientos.find(
      (move) => move.id === this.simulationConfig.asignaciones?.[group]?.[direction]
    ) : null;
    const command = MovementCatalog.commandForDirection(this.commands, direction, group);
    this.bubbleBurstFromElement(group === "arm" ? this.armJoystickPad : this.joystickPad);
    this.view.setDirection(direction, group, simulatedMove?.nombre || (command ? this.commandName(command) : "Movimiento"), this.isSimulatedVehicle);
  }

  async runJoystickDirection(direction, group) {
    if (!this.isSimulatedVehicle) {
      const command = MovementCatalog.commandForDirection(this.commands, direction, group);
      if (command) this.queueCommand(command);
      else this.view.setDirection(`missing:${direction}`, group);
      return;
    }
    const movement = this.simulationConfig.movimientos.find(
      (item) => item.id === this.simulationConfig.asignaciones?.[group]?.[direction]
    );
    if (!movement) {
      this.view.setDirection(`missing:${direction}`, group);
      return;
    }
    try {
      const event = await this.api.executeSimulatedMovement(movement.id, group, direction);
      this.showAction(`${event.nombre}${event.grados ? ` · ${event.grados}°` : ""} · simulación`, "received");
    } catch (error) {
      this.showAction(this.userFacingError(error), "error");
    }
  }

  async loadSimulationSettings() {
    if (this.simulationSettingsLoading) return;
    const panel = this.$("#simulated-motion-settings");
    if (!panel) return;
    this.simulationSettingsLoading = true;
    this.$("#simulated-config-open").hidden = true;
    const status = this.$("#simulated-motion-status");
    try {
      const config = await this.api.getSimulationConfig();
      this.simulationConfig = {
        movimientos: Array.isArray(config?.movimientos) ? config.movimientos : [],
        asignaciones: config?.asignaciones && typeof config.asignaciones === "object"
          ? config.asignaciones : { drive: {}, arm: {} },
      };
      if (config?.configurado === false) {
        const defaults = [
          ["avanzar", "Avanzar", 0], ["retroceder", "Retroceder", 0],
          ["girar-izquierda", "Girar a la izquierda", 90], ["girar-derecha", "Girar a la derecha", 90],
          ["subir-pala", "Subir pala", 0], ["bajar-pala", "Bajar pala", 0],
          ["pala-izquierda", "Pala a la izquierda", 0], ["pala-derecha", "Pala a la derecha", 0],
        ].map(([id, nombre, grados]) => ({ id, nombre, grados, duracion_ms: 1000 }));
        this.simulationConfig.movimientos = defaults;
        this.simulationConfig.asignaciones = {
          drive: { forward: "avanzar", backward: "retroceder", left: "girar-izquierda", right: "girar-derecha" },
          arm: { forward: "subir-pala", backward: "bajar-pala", left: "pala-izquierda", right: "pala-derecha" },
        };
        await this.api.saveSimulationConfig(this.simulationConfig);
      }
      this.renderSimulationSettings();
      this.$("#simulated-config-open").hidden = false;
      status.textContent = "Configuración lista. Los movimientos personalizados no se envían al hardware.";
      this.syncControlAvailability();
    } catch (error) {
      status.textContent = `No se pudo cargar la configuración simulada: ${this.userFacingError(error)}`;
    } finally {
      this.simulationSettingsLoading = false;
    }
  }

  renderSimulationSettings() {
    const container = this.$(".simulated-joystick-bindings");
    if (!container) return;
    const movementList = this.$(".simulated-motion-list");
    movementList.replaceChildren();
    for (const movement of this.simulationConfig.movimientos) {
      const card = document.createElement("div"); card.className = "simulated-motion-card";
      const copy = document.createElement("span");
      copy.textContent = `${movement.nombre}${movement.grados ? ` · ${movement.grados}°` : ""} · ${movement.duracion_ms} ms`;
      const remove = document.createElement("button"); remove.type = "button";
      remove.className = "admin-secondary-button"; remove.textContent = "Quitar";
      remove.setAttribute("aria-label", `Quitar ${movement.nombre}`);
      remove.addEventListener("click", () => {
        this.simulationConfig.movimientos = this.simulationConfig.movimientos.filter((item) => item.id !== movement.id);
        for (const bindings of Object.values(this.simulationConfig.asignaciones)) {
          for (const [direction, assignedId] of Object.entries(bindings)) {
            if (assignedId === movement.id) bindings[direction] = null;
          }
        }
        this.renderSimulationSettings();
        void this.persistSimulationSettings();
      });
      card.append(copy, remove); movementList.append(card);
    }
    container.replaceChildren();
    const directions = [["forward", "Arriba"], ["backward", "Abajo"], ["left", "Izquierda"], ["right", "Derecha"]];
    for (const [group, title] of [["drive", "Joystick de avance y giro"], ["arm", "Joystick de pala"]]) {
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend"); legend.textContent = title; fieldset.append(legend);
      for (const [direction, label] of directions) {
        const wrapper = document.createElement("label"); wrapper.className = "simulated-binding";
        const name = document.createElement("span"); name.textContent = label;
        const select = document.createElement("select"); select.className = "form-select";
        select.dataset.group = group; select.dataset.direction = direction;
        select.append(new Option("Sin asignar", ""));
        for (const move of this.simulationConfig.movimientos) {
          select.append(new Option(`${move.nombre}${move.grados ? ` · ${move.grados}°` : ""}`, move.id));
        }
        select.value = this.simulationConfig.asignaciones?.[group]?.[direction] || "";
        select.addEventListener("change", () => {
          this.simulationConfig.asignaciones[group] ||= {};
          this.simulationConfig.asignaciones[group][direction] = select.value || null;
          void this.persistSimulationSettings();
        });
        wrapper.append(name, select); fieldset.append(wrapper);
      }
      container.append(fieldset);
    }
  }

  async persistSimulationSettings() {
    const status = this.$("#simulated-motion-status");
    try {
      await this.api.saveSimulationConfig(this.simulationConfig);
      status.textContent = "Configuración guardada en tu cuenta.";
    } catch (error) { status.textContent = `No se pudo guardar: ${this.userFacingError(error)}`; }
  }

  installSimulationSettingsForm() {
    this.$("#simulated-motion-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = this.$("#simulated-motion-name").value.trim();
      if (!name || !this.isSimulatedVehicle) return;
      if (this.simulationConfig.movimientos.length >= 30) {
        this.$("#simulated-motion-status").textContent = "Puedes guardar hasta 30 movimientos personalizados.";
        return;
      }
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      this.simulationConfig.movimientos.push({ id, nombre: name,
        grados: this.$("#simulated-motion-angle").value === ""
          ? null : Number(this.$("#simulated-motion-angle").value),
        duracion_ms: Number(this.$("#simulated-motion-duration").value) });
      this.$("#simulated-motion-name").value = "";
      this.$("#simulated-motion-angle").value = "";
      this.renderSimulationSettings();
      void this.persistSimulationSettings();
    });
  }

  installSimulatedSettingsNavigation() {
    const panel = this.$("#simulated-motion-settings");
    const consolePanel = this.$(".controller-console");
    const showSettings = (open) => {
      if (!this.isSimulatedVehicle || !this.canDesignDemos) return;
      panel.hidden = !open;
      consolePanel.hidden = open;
      if (open) this.selectSimulationSettingsTab("movements");
    };
    this.$("#simulated-config-open")?.addEventListener("click", () => showSettings(true));
    this.$("#simulated-config-back")?.addEventListener("click", () => showSettings(false));
    panel?.querySelectorAll("[data-sim-tab]").forEach((button) => {
      button.addEventListener("click", () => this.selectSimulationSettingsTab(button.dataset.simTab));
    });
  }

  selectSimulationSettingsTab(name) {
    if (!["movements", "bindings"].includes(name)) name = "movements";
    const panel = this.$("#simulated-motion-settings");
    panel.querySelectorAll("[data-sim-tab]").forEach((button) => {
      const active = button.dataset.simTab === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panel.querySelectorAll("[data-sim-panel]").forEach((section) => {
      section.hidden = section.dataset.simPanel !== name;
    });
  }

  async refreshApiStatus() {
    this.state.api = "Comprobando";
    this.state.database = "Comprobando";
    this.drawStatuses();
    try {
      const health = await this.api.getHealth();
      this.state.api = health?.api === "disponible" ? "Disponible · /health" : "No disponible";
      this.state.database = health?.rds === "disponible" ? "disponible" : "no disponible";
    } catch {
      this.state.api = "No disponible";
      this.state.database = "Sin verificar";
    }
    this.drawStatuses();
  }

  installCommandControls() {
    this.placeStopButton();
    MovementCatalog.renderAuxiliary(this.$("#auxiliary-controls"), this.commands, this.queueCommand.bind(this), this.outputStates);
    if (!this.commandControlsInstalled) {
      this.stopButton.addEventListener("click", () => {
        this.joysticks.forEach((stick) => stick.release(false));
        void this.sendPriorityStop();
      });
      this.joysticks = [
        new JoystickController({
          pad: this.joystickPad,
          handle: this.joystickHandle,
          commands: this.commands,
          onCommand: this.queueCommand.bind(this),
          onDirection: this.setDirectionLabel.bind(this),
          onMove: this.runJoystickDirection.bind(this),
          group: "drive",
        }),
        new JoystickController({
          pad: this.armJoystickPad,
          handle: this.armJoystickHandle,
          commands: this.commands,
          onCommand: this.queueCommand.bind(this),
          onDirection: this.setDirectionLabel.bind(this),
          onMove: this.runJoystickDirection.bind(this),
          group: "arm",
        }),
      ].filter((stick) => stick.pad && stick.handle).map((stick) => stick.mount());
      this.commandControlsInstalled = true;
    }
    this.syncControlAvailability();
  }

  activateDemoTab(name) {
    const allowed = ["run", "create", "edit"];
    if (!allowed.includes(name) || (name !== "run" && !this.canDesignDemos)) name = "run";
    this.demoTabActive = name;
    for (const tab of this.$("#demo-view").querySelectorAll("[data-demo-tab]")) {
      const active = tab.dataset.demoTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("is-active", active);
    }
    this.$("#demo-run-panel").hidden = name !== "run";
    const tools = this.$("#buyer-demo-tools");
    if (tools) tools.hidden = name === "run" || !this.canDesignDemos;
    this.$("#demo-create-panel").hidden = name !== "create";
    this.$("#demo-editor-panel").hidden = name !== "edit";
  }

  installDemoTabs() {
    const tabs = this.$("#demo-view [role='tablist']");
    if (!tabs) return;
    tabs.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-demo-tab]");
      if (tab && !tab.hidden) this.activateDemoTab(tab.dataset.demoTab);
    });
    tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const available = [...tabs.querySelectorAll("[data-demo-tab]")].filter((tab) => !tab.hidden);
      const current = available.indexOf(event.target.closest("[data-demo-tab]"));
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + available.length) % available.length;
      available[next].focus();
      this.activateDemoTab(available[next].dataset.demoTab);
    });
    this.activateDemoTab(this.demoTabActive || "run");
  }

  placeStopButton() {
    const destination = this.$("#center-stop");
    destination.append(this.stopButton);
  }

  async initialize() {
    this.installDemoTabs();
    this.drawStatuses();
    const setActiveView = (view) => {
      const previousView = this.currentView;
      const hasSession = this.api.hasControlSession();
      if (!hasSession) view = "admin";
      if (this.api.hasGuestSession() && ["monitoring", "admin"].includes(view)) view = "control";
      if (this.api.hasGuestSession() && ["monitoring", "admin"].includes(view)) view = "control";
      const showDemo = view === "demo";
      const showMonitor = view === "monitoring";
      const showAdmin = view === "admin";
      document.documentElement.classList.toggle("demo-page-active", showDemo);
      document.body.classList.toggle("demo-page-active", showDemo);
      this.$(".page-shell")?.classList.toggle("demo-page-active", showDemo);
      const controlView = this.$("#control-view");
      const demoView = this.$("#demo-view");
      const monitorView = this.$("#monitor-view");
      const adminView = this.$("#admin-view");
      controlView.hidden = showDemo || showMonitor || showAdmin;
      demoView.hidden = !showDemo;
      monitorView.hidden = !showMonitor;
      adminView.hidden = !showAdmin;
      this.currentView = view;
      this.controlNavigation.querySelectorAll("[data-view-target]").forEach((button) => {
        const active = button.dataset.viewTarget === view;
        button.classList.toggle("is-current", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      this.menuToggle.setAttribute("aria-expanded", "false");
      this.menuToggle.setAttribute("aria-label", "Abrir menú");
      this.controlNavigation.dataset.open = "false";
      if (showMonitor && previousView !== view) void this.monitor.enter();
      else if (!showMonitor) this.monitor.leave();
      if (showAdmin) {
        // Entrar manualmente a "Mis vehículos" no debe disparar la selección
        // automática pendiente ni devolver al usuario a Control.
        this.administration.autoSelectVehicleOnLoad = false;
        void this.administration.loadVehicles();
      }
      try { sessionStorage.setItem("control-iot:active-view", view); } catch { /* navegación sin persistencia */ }
    };
    this.navigateView = setActiveView;
    this.administration.start();
    const guestMode = this.api.hasGuestSession();
    const accountMode = this.api.hasAccountSession();
    for (const button of this.controlNavigation.querySelectorAll("[data-view-target]")) {
      const target = button.dataset.viewTarget;
      const hidden = (!guestMode && !accountMode && target !== "admin")
        || (guestMode && ["monitoring", "admin"].includes(target));
      button.hidden = hidden;
      if (button.hidden) button.setAttribute("aria-hidden", "true");
      else button.removeAttribute("aria-hidden");
    }
    const monitorLink = this.controlNavigation.querySelector('[data-view-target="monitoring"]');
    if (guestMode && monitorLink) { monitorLink.hidden = true; monitorLink.setAttribute("aria-hidden", "true"); }
    const adminMenuLink = this.controlNavigation.querySelector('[data-view-target="admin"]');
    if (guestMode && adminMenuLink) { adminMenuLink.hidden = true; adminMenuLink.setAttribute("aria-hidden", "true"); }
    const adminLink = this.controlNavigation.querySelector('[data-view-target="admin"]');
    const roleToken = (() => { try { return sessionStorage.getItem("control-iot:access-token"); } catch { return null; } })();
    if (!guestMode && !roleToken && adminLink) adminLink.hidden = false;
    let initialView = this.api.hasControlSession() ? "control" : "admin";
    try {
      const savedView = sessionStorage.getItem("control-iot:active-view");
      if (["control", "monitoring", "demo", "admin"].includes(savedView)
        && this.api.hasControlSession()
        && !(guestMode && savedView === "monitoring")) initialView = savedView;
    } catch { /* usa Control como vista inicial */ }
    setActiveView(initialView);

    this.$("#demo-quick").addEventListener("click", () => setActiveView("demo"));
    this.installSimulationSettingsForm();
    this.installSimulatedSettingsNavigation();
    this.$("#monitor-refresh").addEventListener("click", () => { void this.monitor.resynchronize(); });
    this.placeStopButton();

    this.menuToggle.addEventListener("click", () => {
      const open = this.menuToggle.getAttribute("aria-expanded") !== "true";
      this.menuToggle.setAttribute("aria-expanded", String(open));
      this.menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      this.controlNavigation.dataset.open = String(open);
    });
    const publicExit = this.$("#public-session-exit");
    publicExit.hidden = !this.api.hasGuestSession();
    publicExit.addEventListener("click", () => {
      void this.administration.logout();
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
    this.connectVehicleSocket();
    void this.refreshApiStatus();
    setInterval(() => { void this.refreshApiStatus(); }, APP_CONFIG.apiCheckIntervalMs);
    if (this.api.hasControlSession() && this.vehicleId > 0) void this.loadVehicle();
    if (this.api.hasControlSession() && this.vehicleId <= 0) {
      this.showAction("Esta cuenta aún no tiene un carrito asignado. Registra un comprador para crear su carrito simulado.", "error");
      this.$("#auxiliary-controls").textContent = "No hay un carrito seleccionado.";
      this.$("#drive-direction-label").textContent = "Sin carrito";
      this.demoSelect.replaceChildren(new Option("No hay carrito para consultar DEMOs", ""));
      this.demoSelect.disabled = true;
      this.syncControlAvailability();
      return;
    }

    if (!this.api.hasControlSession()) {
      this.$("#auxiliary-controls").textContent = "Inicia sesión o entra al control básico del carrito 1.";
      this.$("#drive-direction-label").textContent = "Acceso requerido";
      this.demoSelect.replaceChildren(new Option("Inicia sesión para consultar DEMOs", ""));
      this.demoSelect.disabled = true;
      this.demoNote.textContent = "Los catálogos se cargan desde la API al iniciar una sesión autorizada.";
      this.syncControlAvailability();
      return;
    }

    await this.loadControlCatalog();

    this.demoSelect.addEventListener("change", () => {
      this.syncControlAvailability();
      void this.loadDemoPreview();
    });
    this.demoStartButton.addEventListener("click", () => { void this.beginDemo(); });
    this.demoCancelButton.addEventListener("click", () => { void this.cancelRunningDemo(); });
    const buyerDemoForm = this.$("#buyer-demo-create-form");
    const buyerStepForm = this.$("#buyer-demo-step-form");
    if (buyerDemoForm) buyerDemoForm.addEventListener("submit", (event) => { event.preventDefault(); void this.createBuyerDemo(buyerDemoForm); });
    if (buyerStepForm) buyerStepForm.addEventListener("submit", (event) => { event.preventDefault(); this.addBuyerDemoDraftStep(buyerStepForm); });
    this.$("#buyer-demo-save")?.addEventListener("click", () => { void this.saveBuyerDemoDraft(); });
    this.$("#buyer-demo-cancel")?.addEventListener("click", () => { void this.loadDemoPreview(); this.setBuyerDemoStatus("Edición cancelada; se conservan los pasos guardados."); });
  }

  populateBuyerCommandOptions() {
    const select = this.$("#buyer-step-command");
    if (!select) return;
    select.replaceChildren(new Option("Selecciona un comando", ""));
    for (const command of this.commands) select.add(new Option(`${command.nombre} · código ${command.codigo}`, command.id_comando));
  }

  setBuyerDemoStatus(message, state = "") {
    const status = this.$("#buyer-demo-status");
    if (status) { status.textContent = message; status.dataset.state = state; }
  }

  loadBuyerDemoDraft(demoId, steps) {
    const tools = this.$("#buyer-demo-tools");
    const demo = this.demosCatalog.find((item) => Number(item.id_demo ?? item.id) === Number(demoId));
    const editor = this.$(".buyer-demo-editor");
    if (!tools || !this.canDesignDemos || !editor) return;
    editor.hidden = !demo?.editable;
    if (!demo?.editable) return;
    this.demoDraft = (steps || []).map((step) => ({
      id_comando: Number(step.id_comando ?? step.comando_id),
      duracion_ms: Number(step.duracion_ms ?? 1000), pausa_ms: Number(step.pausa_ms ?? 0),
    }));
    this.$("#buyer-editor-name").value = demo.nombre || "";
    this.$("#buyer-editor-description").value = demo.descripcion || "";
    this.renderBuyerDemoDraft();
  }

  renderBuyerDemoDraft() {
    const list = this.$("#buyer-demo-draft");
    if (!list) return;
    list.replaceChildren();
    list.style.setProperty("--draft-rows", String(Math.max(1, Math.ceil(this.demoDraft.length / 2))));
    let total = 0;
    this.demoDraft.forEach((step, index) => {
      total += step.duracion_ms + step.pausa_ms;
      const command = this.commands.find((item) => Number(item.id_comando) === step.id_comando);
      const row = document.createElement("li");
      const copy = document.createElement("div"); copy.className = "buyer-demo-step-copy";
      const label = document.createElement("span"); label.className = "buyer-demo-step-label";
      label.textContent = `${index + 1}. ${command?.nombre || `Comando ${step.id_comando}`}`;
      const detail = document.createElement("small"); detail.textContent = `${step.duracion_ms} ms · pausa ${step.pausa_ms} ms`;
      copy.append(label, detail);
      row.append(copy);
      for (const [action, text, accessibleName] of [["up", "↑", "Subir paso"], ["down", "↓", "Bajar paso"], ["remove", "×", "Quitar paso"]]) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = text;
        button.className = `buyer-demo-step-action is-${action}`; button.setAttribute("aria-label", `${accessibleName} ${index + 1}`); button.title = accessibleName;
        button.disabled = (action === "up" && index === 0) || (action === "down" && index === this.demoDraft.length - 1);
        button.addEventListener("click", () => {
          if (action === "remove") this.demoDraft.splice(index, 1);
          else { const target = action === "up" ? index - 1 : index + 1; [this.demoDraft[index], this.demoDraft[target]] = [this.demoDraft[target], this.demoDraft[index]]; }
          this.renderBuyerDemoDraft();
        });
        row.append(button);
      }
      list.append(row);
    });
    this.$("#buyer-demo-total").textContent = `Duración total: ${(total / 1000).toFixed(1)} s · ${this.demoDraft.length}/20 pasos · máximo 60 s`;
    this.$("#buyer-demo-save").disabled = total > 60_000 || this.demoDraft.length === 0;
  }

  addBuyerDemoDraftStep(form) {
    if (!this.demoSelect.value) { this.setBuyerDemoStatus("Selecciona o crea una DEMO para editarla.", "error"); return; }
    const demo = this.demosCatalog.find((item) => Number(item.id_demo ?? item.id) === Number(this.demoSelect.value));
    if (!demo?.editable) { this.setBuyerDemoStatus("Solo puedes editar tus DEMOs privadas.", "error"); return; }
    if (this.demoDraft.length >= 20) { this.setBuyerDemoStatus("La DEMO admite hasta 20 pasos.", "error"); return; }
    const data = new FormData(form);
    const step = { id_comando: Number(data.get("id_comando")), duracion_ms: Number(data.get("duracion_ms")), pausa_ms: Number(data.get("pausa_ms")) };
    const total = [...this.demoDraft, step].reduce((sum, item) => sum + item.duracion_ms + item.pausa_ms, 0);
    if (!step.id_comando || step.duracion_ms > 10_000 || step.pausa_ms > 10_000 || total > 60_000) {
      this.setBuyerDemoStatus("Revisa el comando y los límites de duración (10 s por paso, 60 s total).", "error"); return;
    }
    this.demoDraft.push(step); this.renderBuyerDemoDraft(); form.reset();
    this.$("#buyer-step-duration").value = "1000"; this.$("#buyer-step-pause").value = "500";
    this.setBuyerDemoStatus("Paso agregado al borrador. Guarda la DEMO para persistirlo.");
  }

  async saveBuyerDemoDraft() {
    const demoId = Number(this.demoSelect.value);
    const demo = this.demosCatalog.find((item) => Number(item.id_demo ?? item.id) === demoId);
    if (!demo?.editable) { this.setBuyerDemoStatus("Solo puedes guardar tus DEMOs privadas.", "error"); return; }
    const button = this.$("#buyer-demo-save"); button.disabled = true;
    try {
      await this.api.saveDemo(demoId, { nombre: this.$("#buyer-editor-name").value.trim(),
        descripcion: this.$("#buyer-editor-description").value.trim(), pasos: this.demoDraft });
      this.setBuyerDemoStatus("DEMO guardada en la API.", "success");
      await this.reloadDemoCatalog(false);
    } catch (error) { this.setBuyerDemoStatus(error.message || "No se pudo guardar la DEMO.", "error"); }
    finally { button.disabled = false; }
  }

  async reloadDemoCatalog(selectCreated = false) {
    const rows = await this.api.getDemos();
    this.demosCatalog = Array.isArray(rows) ? rows : [];
    this.demoView.renderCatalog(this.demoSelect, this.demosCatalog);
    if (selectCreated && rows.length) {
      const created = rows.reduce((latest, item) => Number(item.id_demo ?? item.id) > Number(latest.id_demo ?? latest.id) ? item : latest);
      this.demoSelect.value = String(created.id_demo ?? created.id);
    }
    await this.loadDemoPreview();
  }

  async createBuyerDemo(form) {
    const status = this.$("#buyer-demo-status");
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      const data = new FormData(form);
      await this.api.createDemo(String(data.get("nombre")).trim(), String(data.get("descripcion") || "").trim());
      await this.reloadDemoCatalog(true);
      form.reset(); status.textContent = "DEMO creada y seleccionada. Abre Editor de pasos para agregar movimientos."; status.dataset.state = "success";
    } catch (error) { status.textContent = error.message; status.dataset.state = "error"; }
    finally { submit.disabled = false; }
  }

  async addBuyerDemoStep(form) {
    const status = this.$("#buyer-demo-status");
    if (!this.demoSelect.value) { status.textContent = "Primero selecciona una DEMO."; status.dataset.state = "error"; return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      const data = new FormData(form);
      await this.api.addDemoStep(this.demoSelect.value, {
        comando_id: Number(data.get("comando_id")), orden: Number(data.get("orden")),
        duracion_ms: Number(data.get("duracion_ms")), pausa_ms: Number(data.get("pausa_ms")),
      });
      await this.loadDemoPreview();
      status.textContent = "Paso guardado en la DEMO seleccionada."; status.dataset.state = "success";
    } catch (error) { status.textContent = error.message; status.dataset.state = "error"; }
    finally { submit.disabled = false; }
  }


}
