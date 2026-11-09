const vehicleId = 5;

export const APP_CONFIG = Object.freeze({
  apiBaseUrl: "https://iotalis.duckdns.org",
  vehicleId,
  websocketUrl: `wss://iotalis.duckdns.org/ws/vehiculo/${vehicleId}`,
  apiHealthPath: "/",
  apiCheckIntervalMs: 60_000,
  apiTimeoutMs: 8_000,
});
