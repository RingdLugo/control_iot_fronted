const vehicleId = (() => {
  try {
    // Los IDs siempre proceden de una unidad autorizada por la API.
    const stored = Number(sessionStorage.getItem("control-iot:selected-vehicle"));
    if (Number.isInteger(stored) && stored > 0) return stored;
    // Sin unidad autorizada no se muestra ni se intenta operar una unidad física por defecto.
    return 0;
  } catch { return 0; }
})();

export const APP_CONFIG = Object.freeze({
  apiBaseUrl: "https://iotalis.duckdns.org",
  vehicleId,
  websocketUrl: `wss://iotalis.duckdns.org/ws/cuenta/vehiculo/${vehicleId}`,
  apiHealthPath: "/health",
  apiCheckIntervalMs: 60_000,
  apiTimeoutMs: 8_000,
});
