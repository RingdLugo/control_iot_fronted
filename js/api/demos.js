import { APP_CONFIG } from "../config.js";
import { request } from "./client.js";

export function getDemos() {
  return request(`/demos/vehiculo/${APP_CONFIG.vehicleId}`);
}

export function startDemo(demoId, signal) {
  return request(`/vehiculos/${APP_CONFIG.vehicleId}/demo/iniciar`, {
    method: "POST", body: { demo_id: Number(demoId) }, signal,
  });
}

export function cancelDemo(signal) {
  return request(`/vehiculos/${APP_CONFIG.vehicleId}/demo/detener`, { method: "POST", signal });
}
