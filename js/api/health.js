import { APP_CONFIG } from "../config.js";
import { request } from "./client.js";

// GET / solo comprueba que FastAPI responde; no verifica Amazon RDS.
export async function checkApi() {
  return request(APP_CONFIG.apiHealthPath);
}
