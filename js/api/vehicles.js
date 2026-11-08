import { APP_CONFIG } from "../config.js";
import { request } from "./client.js";

export function getVehicle(signal) {
  return request(`/vehiculos/${APP_CONFIG.vehicleId}`, { signal });
}
