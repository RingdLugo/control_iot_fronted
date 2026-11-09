import { MovementCatalog } from "../control/MovementCatalog.js?v=20261109-3";

export class ControlView {
  constructor(root = document) {
    this.root = root;
    for (const [key, selector] of Object.entries({ actionMessage: "#action-message", actionState: "#action-state", stopButton: "#stop-button", demoSelect: "#demo-select", demoStartButton: "#demo-start", demoCancelButton: "#demo-cancel", demoNote: "#demo-note", demoPreview: "#demo-preview" })) this[key] = root.querySelector(selector);
  }
  showAction(message, status) {
    const labels = { idle: "EN ESPERA", sending: "SOLICITADO", accepted: "ACEPTADO POR API", received: "EVENTO RECIBIDO", error: "ERROR" };
    this.actionMessage.textContent = message; this.actionState.textContent = labels[status] ?? status.toUpperCase(); this.actionState.dataset.state = status;
  }
  setCommandState(id, value, commands) {
    for (const button of this.root.querySelectorAll(".command-button")) {
      const active = button.dataset.commandId === String(id); if (active) button.dataset.state = value; else delete button.dataset.state;
      button.setAttribute("aria-busy", String(active && value === "sending"));
    }
    const stop = MovementCatalog.findStop(commands);
    if (Number(stop?.id_comando) === Number(id)) { this.stopButton.dataset.state = value; this.stopButton.setAttribute("aria-busy", String(value === "sending")); }
    else { delete this.stopButton.dataset.state; this.stopButton.setAttribute("aria-busy", "false"); }
  }
  renderVehicle(vehicle, vehicleId) {
    if (!vehicle || Number(vehicle.id_vehiculo) !== Number(vehicleId)) throw new Error("La API no devolvió la ficha del vehículo configurado.");
    this.root.querySelector("#vehicle-name").textContent = vehicle.nombre?.trim() || `Vehículo ${vehicleId}`;
    this.root.querySelector("#vehicle-id").textContent = `Vehículo ${String(vehicle.id_vehiculo).padStart(2, "0")}`;
    this.root.querySelector("#header-vehicle-id").textContent = String(vehicle.id_vehiculo).padStart(2, "0");
    this.root.querySelector("#vehicle-controller").textContent = vehicle.microcontrolador?.trim() || "Controlador IoT";
  }
  renderPreviewError(message) { this.demoPreview.replaceChildren(); const p = this.root.createElement("p"); p.className = "demo-preview-empty"; p.textContent = message; this.demoPreview.append(p); }
  setDirection(direction, group, commandName) {
    const label = this.root.querySelector(group === "arm" ? "#arm-direction-label" : "#drive-direction-label");
    const readout = label.closest(".direction-readout");
    if (direction === "neutral") { label.textContent = "En pausa · lista para comenzar"; readout.dataset.active = "false"; return; }
    if (direction.startsWith("missing:")) { label.textContent = "Dirección no disponible en el catálogo"; readout.dataset.active = "false"; return; }
    label.textContent = `${commandName || "Movimiento"} · enviando comando`; readout.dataset.active = "true";
  }
  setAvailability({ locked, commands, activeDemo, demoStarting, demoCancelPending = false }) {
    this.root.querySelectorAll(".command-button").forEach((button) => { button.disabled = locked; });
    this.root.querySelectorAll("#joystick").forEach((pad) => { pad.setAttribute("aria-disabled", String(locked)); pad.classList.toggle("is-locked", locked); });
    this.stopButton.disabled = !MovementCatalog.findStop(commands);
    this.demoSelect.disabled = locked || !this.demoSelect.querySelector("option[value]:not([value=''])");
    this.demoStartButton.disabled = locked || !this.demoSelect.value; this.demoCancelButton.disabled = demoCancelPending || (!activeDemo && !demoStarting);
  }
}
