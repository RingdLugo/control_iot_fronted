import { APP_CONFIG } from "../config.js";
import { request } from "./client.js";

export function getCommands() {
  return request(`/comandos/vehiculo/${APP_CONFIG.vehicleId}/detalle`);
}

export function postMovement(commandId, signal) {
  return request(`/vehiculos/${APP_CONFIG.vehicleId}/movimiento`, {
    method: "POST",
    body: { comando_id: commandId, origen: "WEB_CONTROL" },
    signal,
  });
}
