import { APP_CONFIG } from "../config.js?v=20261123-3";
import { HttpClient } from "./HttpClient.js?v=20261122-6";

export class VehicleApi {
  constructor(httpClient = new HttpClient(), vehicleId = APP_CONFIG.vehicleId) {
    this.http = httpClient;
    this.vehicleId = Number(vehicleId);
  }
  getHealth(signal) { return this.http.request(APP_CONFIG.apiHealthPath, { signal }); }
  setVehicleId(id) { this.vehicleId = Number(id); }
  hasAccountSession() { try { return Boolean(sessionStorage.getItem("control-iot:access-token")); } catch { return false; } }
  guestToken() { try { return sessionStorage.getItem("control-iot:guest-token"); } catch { return null; } }
  hasGuestSession() { return Boolean(this.guestToken()); }
  hasControlSession() { return this.hasGuestSession() || this.hasAccountSession(); }
  request(path, options = {}) {
    const token = this.guestToken();
    return this.http.request(path, token ? { ...options, headers: { ...options.headers, "X-Guest-Token": token } } : options);
  }
  protectedPath(path) {
    if (this.hasGuestSession()) return `/guest${path}`;
    if (this.hasAccountSession()) return `/cuenta${path}`;
    throw new Error("Inicia sesión o valida una invitación para acceder a los vehículos.");
  }
  getVehicle(signal) { return this.request(this.protectedPath(`/vehiculos/${this.vehicleId}`), { signal }); }
  getLatestState(signal) { return this.request(this.protectedPath(`/vehiculos/${this.vehicleId}/estado`), { signal }); }
  getRecentHistory(signal) { return this.request(this.protectedPath(`/vehiculos/${this.vehicleId}/historial`), { signal }); }
  getCommands(signal) {
    const path = this.protectedPath(`/vehiculos/${this.vehicleId}/comandos`);
    return this.request(path, { signal });
  }
  postMovement(commandId, signal, outputState = null) {
    const body = { comando_id: Number(commandId) };
    if (!this.hasGuestSession()) body.origen = "WEB_CONTROL";
    if (typeof outputState === "boolean") body.estado_salida = outputState;
    const path = this.protectedPath(`/vehiculos/${this.vehicleId}/movimiento`);
    return this.request(path, {
      method: "POST", body, signal,
    });
  }
  getSimulationConfig(signal) {
    if (!this.hasAccountSession()) throw new Error("Inicia sesión con una cuenta autorizada para configurar el carrito simulado.");
    return this.request(`/cuenta/vehiculos/${this.vehicleId}/simulacion`, { signal });
  }
  saveSimulationConfig(config, signal) {
    if (!this.hasAccountSession()) throw new Error("Inicia sesión con una cuenta autorizada para guardar la configuración simulada.");
    return this.request(`/cuenta/vehiculos/${this.vehicleId}/simulacion`, { method: "PUT", body: config, signal });
  }
  executeSimulatedMovement(movementId, group, direction, signal) {
    if (!this.hasAccountSession()) throw new Error("Inicia sesión con una cuenta autorizada para ejecutar movimientos simulados.");
    return this.request(`/cuenta/vehiculos/${this.vehicleId}/simulacion/ejecutar`, {
      method: "POST", body: { movimiento_id: movementId, grupo: group, direccion: direction }, signal,
    });
  }
  getDemos(signal) {
    const path = this.protectedPath(`/vehiculos/${this.vehicleId}/demos`);
    return this.request(path, { signal });
  }
  createDemo(nombre, descripcion = "", signal) {
    if (!this.hasAccountSession()) throw new Error("Inicia sesión con una cuenta habilitada para crear una DEMO.");
    return this.request(`/cuenta/vehiculos/${this.vehicleId}/demos`, { method: "POST", body: { nombre, descripcion }, signal });
  }
  addDemoStep(demoId, data, signal) {
    if (!this.hasAccountSession()) throw new Error("Inicia sesión con una cuenta habilitada para editar DEMOs.");
    return this.request(`/cuenta/vehiculos/${this.vehicleId}/demos/${Number(demoId)}/pasos`, { method: "POST", body: data, signal });
  }
  saveDemo(demoId, data, signal) {
    if (!this.hasAccountSession()) throw new Error("Inicia sesión con una cuenta habilitada para guardar DEMOs.");
    return this.request(`/cuenta/vehiculos/${this.vehicleId}/demos/${Number(demoId)}`, {
      method: "PUT", body: data, signal,
    });
  }
  finishGuestSession(signal) {
    if (!this.hasGuestSession()) return Promise.resolve(null);
    return this.request("/guest/sesiones/actual", { method: "DELETE", signal });
  }
  getDemoSteps(demoId, signal) {
    const path = this.protectedPath(`/vehiculos/${this.vehicleId}/demos/${Number(demoId)}/pasos`);
    return this.request(path, { signal });
  }
  startDemo(demoId, signal) {
    const path = this.protectedPath(`/vehiculos/${this.vehicleId}/demo/iniciar`);
    return this.request(path, { method: "POST", body: { demo_id: Number(demoId) }, signal });
  }
  cancelDemo(signal) {
    const path = this.protectedPath(`/vehiculos/${this.vehicleId}/demo/detener`);
    return this.request(path, { method: "POST", signal });
  }
}
