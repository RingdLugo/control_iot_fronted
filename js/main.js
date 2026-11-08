import { APP_CONFIG } from "./config.js";
import { checkApi } from "./api/health.js";
import { connectWebSocket } from "./websocket/client.js";
import { renderStatuses } from "./ui/status.js";

const container = document.querySelector("#connection-status");
const states = { websocket: "Conectando", api: "Comprobando", database: "Sin verificar" };
const draw = () => renderStatuses(container, states);

async function updateApiStatus() {
  states.api = "Comprobando";
  draw();
  try {
    await checkApi();
    states.api = "Disponible (GET / responde)";
  } catch {
    states.api = "No disponible";
  }
  draw();
}

draw();
void updateApiStatus();
setInterval(updateApiStatus, APP_CONFIG.apiCheckIntervalMs);
connectWebSocket((value) => {
  states.websocket = value;
  draw();
}, () => {});
