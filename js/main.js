import { APP_CONFIG } from "./config.js";
import { checkApi } from "./api/health.js";
import { getVehicle } from "./api/vehicles.js";
import { getCommands, postMovement } from "./api/commands.js";
import { cancelDemo as cancelDemoRequest, getDemoSteps, getDemos, startDemo as startDemoRequest } from "./api/demos.js";
import { mountJoystick } from "./control/joystick.js";
import { commandForDirection, renderAuxiliaryCommands, renderJoystickLegend, stopCommand } from "./control/movements.js";
import { renderDemoSteps, renderDemos } from "./control/demos.js";
import { connectWebSocket } from "./websocket/client.js";
import { renderStatuses } from "./ui/status.js";
import { errorMessage } from "./ui/errors.js";

const $ = (selector) => document.querySelector(selector);
const statusContainer = $("#connection-status");
const state = { websocket: "Conectando", api: "Comprobando", database: "Sin verificar" };
const commands = [];
let activeDemo = false;
let demoStarting = false;
let demoController = null;
let demoRequestController = null;
let actionSequence = 0;
let userActionRevision = 0;
let commandBusy = false;
let commandController = null;
let pendingCommand = null;
let currentActionCommandId = null;
let demoEventRevision = 0;
let demoPreviewController = null;
let demoPreviewSequence = 0;

const drawStatuses = () => renderStatuses(statusContainer, state);
const actionMessage = $("#action-message");
const actionState = $("#action-state");
const demoSelect = $("#demo-select");
const demoStartButton = $("#demo-start");
const demoCancelButton = $("#demo-cancel");
const demoNote = $("#demo-note");
const demoPreview = $("#demo-preview");
const joystickPad = $("#joystick");
const joystickHandle = $("#joystick-handle");
const toolJoystickPad = $("#tool-joystick");
const toolJoystickHandle = $("#tool-joystick-handle");
const joystickPads = [joystickPad, toolJoystickPad];

function showAction(message, status = "idle") {
  actionMessage.textContent = message;
  const labels = { idle: "EN ESPERA", sending: "SOLICITADO", accepted: "ACEPTADO POR API", received: "EVENTO RECIBIDO", error: "ERROR" };
  actionState.textContent = labels[status] ?? status.toUpperCase();
  actionState.dataset.state = status;
}

function setCommandState(commandId, value) {
  const buttons = document.querySelectorAll(".command-button");
  for (const button of buttons) {
    if (button.dataset.commandId !== String(commandId)) {
      delete button.dataset.state;
      button.setAttribute("aria-busy", "false");
      continue;
    }
    if (button.dataset.commandId === String(commandId)) {
      button.dataset.state = value;
      button.setAttribute("aria-busy", String(value === "sending"));
    }
  }
  const stop = stopCommand(commands);
  if (stop && Number(stop.id_comando) === Number(commandId)) {
    $("#stop-button").dataset.state = value;
    $("#stop-button").setAttribute("aria-busy", String(value === "sending"));
  } else {
    delete $("#stop-button").dataset.state;
    $("#stop-button").setAttribute("aria-busy", "false");
  }
}

function userFacingError(error) {
  if (error?.name === "AbortError") return "La solicitud anterior se canceló para dar prioridad a la nueva acción.";
  return error?.message || errorMessage(error);
}

function eventFacts(event, keys) {
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

function renderVehicle(vehicle) {
  if (!vehicle || Number(vehicle.id_vehiculo) !== APP_CONFIG.vehicleId) {
    throw new Error("La API no devolvió la ficha del vehículo configurado.");
  }
  const name = typeof vehicle.nombre === "string" && vehicle.nombre.trim()
    ? vehicle.nombre : `Vehículo ${APP_CONFIG.vehicleId}`;
  $("#vehicle-name").textContent = name;
  $("#vehicle-id").textContent = `Vehículo ${String(vehicle.id_vehiculo).padStart(2, "0")}`;
  $("#vehicle-controller").textContent = typeof vehicle.microcontrolador === "string" && vehicle.microcontrolador.trim()
    ? vehicle.microcontrolador : "Controlador IoT";
  const model = typeof vehicle.modelo === "string" ? vehicle.modelo.trim() : "";
  $("#vehicle-model").textContent = model;
  $("#vehicle-model-chip").hidden = model.length === 0;
}

async function loadVehicle() {
  try {
    renderVehicle(await getVehicle());
  } catch (error) {
    if (actionState.dataset.state === "idle") {
      showAction(`No se pudo cargar la ficha del vehículo: ${userFacingError(error)}`, "error");
    }
  }
}

function renderDemoPreviewError(message) {
  demoPreview.replaceChildren();
  const note = document.createElement("p");
  note.className = "demo-preview-empty";
  note.textContent = message;
  demoPreview.append(note);
}

async function loadDemoPreview() {
  demoPreviewController?.abort();
  const demoId = Number(demoSelect.value);
  const sequence = ++demoPreviewSequence;
  if (!demoId) {
    demoPreview.hidden = true;
    demoPreview.replaceChildren();
    demoPreviewController = null;
    return;
  }

  const controller = new AbortController();
  demoPreviewController = controller;
  demoPreview.hidden = false;
  renderDemoPreviewError("Consultando la secuencia guardada en la API…");
  try {
    const steps = await getDemoSteps(demoId, controller.signal);
    if (sequence !== demoPreviewSequence) return;
    if (!Array.isArray(steps) || !steps.every((step) => step && typeof step === "object")) {
      throw new Error("La API devolvió una definición de DEMO no válida.");
    }
    renderDemoSteps(demoPreview, steps);
  } catch (error) {
    if (sequence === demoPreviewSequence && error.name !== "AbortError") {
      renderDemoPreviewError(`No se pudo consultar la definición: ${userFacingError(error)}`);
    }
  } finally {
    if (sequence === demoPreviewSequence) demoPreviewController = null;
  }
}

function syncControlAvailability() {
  const locked = activeDemo || demoStarting || commandBusy;
  document.querySelectorAll(".command-button").forEach((button) => { button.disabled = locked; });
  joystickPads.forEach((pad) => {
    pad.setAttribute("aria-disabled", String(locked));
    pad.classList.toggle("is-locked", locked);
  });
  $("#stop-button").disabled = !stopCommand(commands);
  demoSelect.disabled = locked || !demoSelect.querySelector("option[value]:not([value=''])");
  demoStartButton.disabled = locked || !demoSelect.value;
  demoCancelButton.disabled = !activeDemo && !demoStarting;
}

function updateDemoStatus(note, active = activeDemo) {
  activeDemo = active;
  demoNote.textContent = note;
  syncControlAvailability();
}

function commandName(command) {
  return String(command.nombre).replaceAll("_", " ");
}

function queueCommand(command) {
  if (!command) {
    showAction("Ese movimiento no está disponible en el catálogo del vehículo.", "error");
    return;
  }
  const stop = command === stopCommand(commands);
  if ((activeDemo || demoStarting) && !stop) {
    showAction("La DEMO está activa. Cancélala o detenla antes de cambiar de movimiento.", "error");
    return;
  }
  if (stop) {
    void sendPriorityStop(command);
    return;
  }

  userActionRevision += 1;
  currentActionCommandId = Number(command.id_comando);
  setCommandState(command.id_comando, "sending");
  pendingCommand = command;
  showAction(`Solicitado: ${commandName(command)}.`, "sending");
  void dispatchNextCommand();
}

async function dispatchNextCommand() {
  if (commandBusy || !pendingCommand || activeDemo || demoStarting) return;
  const command = pendingCommand;
  pendingCommand = null;
  commandBusy = true;
  const sequence = ++actionSequence;
  const revision = userActionRevision;
  commandController = new AbortController();
  try {
    await postMovement(command.id_comando, commandController.signal);
    if (sequence === actionSequence && revision === userActionRevision && actionState.dataset.state !== "received") {
      setCommandState(command.id_comando, "accepted");
      showAction(`Aceptado por la API: ${commandName(command)}. El movimiento físico no se confirma desde esta respuesta.`, "accepted");
    }
  } catch (error) {
    if (sequence === actionSequence && error.name !== "AbortError" && actionState.dataset.state !== "received") {
      setCommandState(command.id_comando, "error");
      showAction(userFacingError(error), "error");
    }
  } finally {
    if (sequence === actionSequence) {
      commandBusy = false;
      commandController = null;
      syncControlAvailability();
      if (pendingCommand && !activeDemo) void dispatchNextCommand();
    }
  }
}

async function sendPriorityStop(command = stopCommand(commands)) {
  if (!command) {
    showAction("No hay un comando DETENER activo en el catálogo.", "error");
    return;
  }
  const sequence = ++actionSequence;
  userActionRevision += 1;
  pendingCommand = null;
  commandController?.abort();
  commandController = null;
  commandBusy = true;
  currentActionCommandId = Number(command.id_comando);
  setCommandState(command.id_comando, "sending");
  showAction("DETENER solicitado con prioridad.", "sending");

  if (activeDemo || demoStarting) {
    try {
      await cancelRunningDemo(true);
    } catch {
      demoNote.textContent = "No se confirmó la cancelación de la DEMO; también se enviará DETENER.";
    }
  }

  showAction("DETENER solicitado con prioridad.", "sending");
  const controller = new AbortController();
  commandController = controller;
  try {
    await postMovement(command.id_comando, controller.signal);
    if (sequence === actionSequence && actionState.dataset.state !== "received") {
      setCommandState(command.id_comando, "accepted");
      showAction("DETENER aceptado por la API. Esperando el evento WSS correspondiente.", "accepted");
    }
  } catch (error) {
    if (sequence === actionSequence && error.name !== "AbortError" && actionState.dataset.state !== "received") {
      setCommandState(command.id_comando, "error");
      showAction(userFacingError(error), "error");
    }
  } finally {
    if (sequence === actionSequence) {
      commandBusy = false;
      commandController = null;
      syncControlAvailability();
      if (pendingCommand && !activeDemo) void dispatchNextCommand();
    }
  }
}

async function beginDemo() {
  if (activeDemo || demoStarting || commandBusy || pendingCommand || !demoSelect.value) return;
  userActionRevision += 1;
  const eventRevision = demoEventRevision;
  demoStarting = true;
  demoController = new AbortController();
  updateDemoStatus("Solicitud de inicio enviada a la API…", false);
  showAction("Inicio de DEMO solicitado.", "sending");
  try {
    await startDemoRequest(demoSelect.value, demoController.signal);
    if (eventRevision === demoEventRevision) {
      activeDemo = true;
      if (actionState.dataset.state !== "received") showAction("DEMO aceptada por la API. El evento de inicio llegará por WSS.", "accepted");
      demoNote.textContent = "DEMO activa · controles bloqueados durante la secuencia.";
    }
  } catch (error) {
    if (error.name !== "AbortError" && eventRevision === demoEventRevision) {
      activeDemo = false;
      showAction(userFacingError(error), "error");
      demoNote.textContent = "No se pudo iniciar la DEMO.";
    }
  } finally {
    demoStarting = false;
    demoController = null;
    syncControlAvailability();
  }
}

async function cancelRunningDemo(fromStop = false) {
  if (!activeDemo && !demoStarting) return;
  demoController?.abort();
  demoRequestController = new AbortController();
  demoNote.textContent = "Cancelación solicitada…";
  if (!fromStop) showAction("Cancelación de DEMO solicitada.", "sending");
  try {
    await cancelDemoRequest(demoRequestController.signal);
    if (actionState.dataset.state !== "received") {
      demoNote.textContent = "Señal de cancelación aceptada por la API; esperando el evento WSS para liberar los controles.";
      if (!fromStop) showAction("Cancelación aceptada por la API. Esperando evento WSS.", "accepted");
    }
    syncControlAvailability();
  } catch (error) {
    if (error.name !== "AbortError") {
      if (actionState.dataset.state === "received") return;
      demoNote.textContent = "No se pudo cancelar la DEMO.";
      if (!fromStop) showAction(userFacingError(error), "error");
      throw error;
    }
  } finally {
    demoRequestController = null;
  }
}

function handleSocketMessage(raw) {
  let event;
  try { event = JSON.parse(raw); }
  catch { return; }
  if (Number(event.vehiculo_id) !== APP_CONFIG.vehicleId) return;

  if (event.tipo === "conexion_establecida") {
    if (actionState.dataset.state === "idle") {
      const initialState = event.estado_inicial !== undefined ? " · campo estado_inicial recibido" : "";
      showAction(`Canal WSS listo · evento inicial recibido del servidor${initialState}.`, "idle");
    }
    return;
  }
  if (event.tipo === "movimiento_individual") {
    if (Number(event.comando_id) !== currentActionCommandId || event.origen !== "WEB_CONTROL") return;
    setCommandState(event.comando_id, "received");
    const name = String(event.nombre || "movimiento").replaceAll("_", " ");
    const facts = eventFacts(event, ["vehiculo_id", "comando_id", "codigo", "origen", "marca_temporal"]);
    showAction(`Evento WSS · ${name} · ${facts}`, "received");
    return;
  }
  if (event.tipo === "demo_inicio") {
    demoEventRevision += 1;
    activeDemo = true;
    demoStarting = false;
    updateDemoStatus(`DEMO ${event.demo_id} en marcha · ${event.total_movimientos} pasos ejecutados por el servidor.`, true);
    showAction(`Evento WSS · DEMO iniciada · ${eventFacts(event, ["demo_id", "total_movimientos", "marca_temporal"])}`, "received");
    return;
  }
  if (event.tipo === "demo_movimiento") {
    demoEventRevision += 1;
    activeDemo = true;
    const name = String(event.nombre || "comando").replaceAll("_", " ");
    const duration = event.duracion_ms !== undefined ? `${event.duracion_ms} ms` : "duración no informada";
    const pause = event.pausa_ms !== undefined ? `${event.pausa_ms} ms` : "pausa no informada";
    const facts = eventFacts(event, ["demo_id", "orden", "comando_id", "codigo", "duracion_ms", "pausa_ms", "marca_temporal"]);
    updateDemoStatus(`DEMO · ${name} · ${duration} + ${pause} pausa.`, true);
    showAction(`Evento WSS · ${name} · ${facts}`, "received");
    return;
  }
  if (["demo_fin", "demo_cancelada", "demo_error"].includes(event.tipo)) {
    demoEventRevision += 1;
    activeDemo = false;
    demoStarting = false;
    const labels = { demo_fin: "DEMO finalizada", demo_cancelada: "DEMO cancelada", demo_error: "La DEMO reportó un error" };
    updateDemoStatus(`${labels[event.tipo]} · evento recibido por WSS.`, false);
    showAction(`Evento WSS · ${labels[event.tipo]} · ${eventFacts(event, ["demo_id", "marca_temporal"])}`, event.tipo === "demo_error" ? "error" : "received");
  }
}

function setDirectionLabel(direction, group = "drive") {
  const label = $(`#${group}-direction-label`);
  const readout = document.querySelector(`[data-stick="${group}"] .direction-readout`);
  if (direction === "neutral") {
    label.textContent = "En pausa · lista para comenzar";
    readout.dataset.active = "false";
    const stop = stopCommand(commands);
    if (stop) queueCommand(stop);
    return;
  }
  if (direction.startsWith("missing:")) {
    label.textContent = "Dirección no disponible en el catálogo";
    readout.dataset.active = "false";
    const stop = stopCommand(commands);
    if (stop) queueCommand(stop);
    return;
  }
  const command = commandForDirection(commands, direction, group);
  label.textContent = `${command ? commandName(command) : "Movimiento"} · enviando comando`;
  readout.dataset.active = "true";
}

async function refreshApiStatus() {
  state.api = "Comprobando";
  drawStatuses();
  try {
    await checkApi();
    state.api = "Disponible · GET / responde";
  } catch {
    state.api = "No disponible";
  }
  drawStatuses();
}

function installCommandControls() {
  renderAuxiliaryCommands($("#auxiliary-controls"), commands, queueCommand);
  renderJoystickLegend($("#drive-mapping"), commands, "drive");
  renderJoystickLegend($("#tool-mapping"), commands, "tool");
  $("#stop-button").addEventListener("click", () => {
    joysticks.forEach((stick) => stick.release(false));
    void sendPriorityStop();
  });
  joysticks = [mountJoystick({
    pad: joystickPad,
    handle: joystickHandle,
    commands,
    onCommand: queueCommand,
    onDirection: setDirectionLabel,
    group: "drive",
  }), mountJoystick({
    pad: toolJoystickPad,
    handle: toolJoystickHandle,
    commands,
    onCommand: queueCommand,
    onDirection: setDirectionLabel,
    group: "tool",
  })];
  syncControlAvailability();
}

let joysticks = [];

async function initialize() {
  drawStatuses();
  connectWebSocket((value) => { state.websocket = value; drawStatuses(); }, handleSocketMessage);
  void refreshApiStatus();
  setInterval(() => { void refreshApiStatus(); }, APP_CONFIG.apiCheckIntervalMs);
  void loadVehicle();

  try {
    const result = await getCommands();
    if (!Array.isArray(result) || !result.every((command) => command && typeof command === "object"
      && Number.isInteger(Number(command.id_comando)) && typeof command.nombre === "string"
      && Number.isFinite(Number(command.codigo)))) {
      throw new Error("La API devolvió un catálogo de movimientos no válido.");
    }
    commands.push(...result);
    if (!commands.length) throw new Error("El catálogo no contiene comandos.");
    installCommandControls();
  } catch (error) {
    $("#auxiliary-controls").textContent = "No se pudo cargar el catálogo de movimientos.";
    $("#drive-direction-label").textContent = "No disponible";
    $("#tool-direction-label").textContent = "No disponible";
    $("#stop-button").disabled = true;
    showAction(userFacingError(error), "error");
  }

  try {
    const result = await getDemos();
    const count = renderDemos(demoSelect, Array.isArray(result) ? result : []);
    demoNote.textContent = count ? "La API ejecuta los pasos y sus pausas." : "No hay DEMO activas disponibles.";
  } catch (error) {
    demoSelect.replaceChildren(new Option("No se pudieron cargar las DEMO", ""));
    demoSelect.disabled = true;
    demoNote.textContent = userFacingError(error);
  }
  syncControlAvailability();

  demoSelect.addEventListener("change", () => {
    syncControlAvailability();
    void loadDemoPreview();
  });
  demoStartButton.addEventListener("click", () => { void beginDemo(); });
  demoCancelButton.addEventListener("click", () => { void cancelRunningDemo(); });
}

void initialize();
