import { APP_CONFIG } from "../config.js?v=20261109-3";
import { HttpClient } from "./HttpClient.js?v=20261109-3";

export class VehicleApi {
  constructor(httpClient = new HttpClient(), vehicleId = APP_CONFIG.vehicleId) {
    this.http = httpClient;
    this.vehicleId = Number(vehicleId);
  }
  getHealth(signal) { return this.http.request(APP_CONFIG.apiHealthPath, { signal }); }
  getVehicle(signal) { return this.http.request(`/vehiculos/${this.vehicleId}`, { signal }); }
  getLatestState(signal) { return this.http.request(`/vehiculos/${this.vehicleId}/estado`, { signal }); }
  getRecentHistory(signal) { return this.http.request(`/vehiculos/${this.vehicleId}/historial`, { signal }); }
  getCommands(signal) { return this.http.request(`/comandos/vehiculo/${this.vehicleId}/detalle`, { signal }); }
  postMovement(commandId, signal) {
    return this.http.request(`/vehiculos/${this.vehicleId}/movimiento`, {
      method: "POST", body: { comando_id: Number(commandId), origen: "WEB_CONTROL" }, signal,
    });
  }
  getDemos(signal) { return this.http.request(`/demos/vehiculo/${this.vehicleId}`, { signal }); }
  getDemoSteps(demoId, signal) { return this.http.request(`/demos/${Number(demoId)}/movimientos`, { signal }); }
  startDemo(demoId, signal) {
    return this.http.request(`/vehiculos/${this.vehicleId}/demo/iniciar`, { method: "POST", body: { demo_id: Number(demoId) }, signal });
  }
  cancelDemo(signal) { return this.http.request(`/vehiculos/${this.vehicleId}/demo/detener`, { method: "POST", signal }); }
}
