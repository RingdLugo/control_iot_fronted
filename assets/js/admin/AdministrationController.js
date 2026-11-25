import { AdminApi, ADMIN_RESOURCE_DEFINITIONS } from "./AdminApi.js?v=20261124-1";
import { AdministrationView } from "./AdministrationView.js?v=20261123-4";

const TOKEN_KEY = "control-iot:access-token";
const GUEST_TOKEN_KEY = "control-iot:guest-token";
const PAGE_SIZE = 50;
const FILTERS = Object.freeze({
  modelos: { text: { label: "Buscar modelo", placeholder: "Código, marca o nombre" }, option: { label: "Estado", values: ["ACTIVO", "INACTIVO", "BAJA"].map((value) => ({ value, label: value })) } },
  unidades: { text: { label: "Buscar unidad", placeholder: "Nombre o modelo" }, option: { label: "Estado", values: [{ value: "true", label: "Activa" }, { value: "false", label: "Inactiva" }] } },
  clientes: { text: { label: "Buscar cliente", placeholder: "Nombre o correo" }, option: { label: "Estado", values: ["ACTIVO", "INACTIVO", "BAJA"].map((value) => ({ value, label: value })) } },
  usuarios: { option: { label: "Estado", values: ["PENDIENTE", "ACTIVO", "BLOQUEADO", "BAJA"].map((value) => ({ value, label: value })) } },
  asignaciones: { option: { label: "Estado", values: ["ACTIVA", "FINALIZADA", "REVOCADA"].map((value) => ({ value, label: value })) } },
  demos: { text: { label: "ID de unidad", placeholder: "Ej. 5" } },
  sesiones: { option: { label: "Estado", values: ["RESERVADA", "ACTIVA", "FINALIZADA", "EXPIRADA", "REVOCADA"].map((value) => ({ value, label: value })) } },
  auditoria: { text: { label: "Entidad", placeholder: "Ej. DEMO" } },
});

export class AdministrationController {
  constructor({ root = document, onVehicleSelect = () => {}, onIdentityChange = () => {}, onNavigate = () => {}, httpClient = undefined } = {}) {
    this.view = new AdministrationView(root);
    this.api = new AdminApi(httpClient);
    this.onVehicleSelect = onVehicleSelect;
    this.onIdentityChange = onIdentityChange;
    this.onNavigate = onNavigate;
    this.principal = null;
    this.loading = false;
    this.scopeId = "";
    this.offset = 0;
    this.activeFilters = {};
    this.vehicleLoadPromise = null;
    this.resourceRequestId = 0;
    this.dashboardRequestId = 0;
    this.authRevision = 0;
    this.autoSelectVehicleOnLoad = false;
    this.guestExpiryTimer = null;
    this.googleScriptPromise = null;
  }
  start() {
    this.view.selectAccessTab("user");
    this.view.dashboardTabs?.querySelectorAll("[data-admin-tab]").forEach((tab) => {
      tab.addEventListener("click", () => this.view.selectDashboardTab(tab.dataset.adminTab));
    });
    this.view.loginForm.addEventListener("submit", (event) => { event.preventDefault(); void this.login(this.view.loginForm, this.view.loginStatus, "control"); });
    this.view.adminLoginForm.addEventListener("submit", (event) => { event.preventDefault(); void this.login(this.view.adminLoginForm, this.view.adminLoginStatus, "admin"); });
    this.view.accessTabs?.addEventListener("click", (event) => {
      if (event.target.closest('[data-access-tab="guest"]')) void this.loadGuestCatalog();
    });
    this.view.root.querySelector("#guest-model-select")?.addEventListener("change", () => this.updateGuestRequestButton());
    this.view.root.querySelector("#guest-session-request")?.addEventListener("click", () => void this.requestGuestAccess());
    this.view.root.querySelector("#admin-logout").addEventListener("click", () => this.logout());
    this.view.resource.addEventListener("change", () => { this.scopeId = ""; this.offset = 0; this.activeFilters = {}; this.view.configureFilters(this.view.resource.value, FILTERS[this.view.resource.value]); void this.loadResource(); });
    this.view.root.querySelector("#admin-reload").addEventListener("click", () => { void this.loadResource(); void this.loadVehicles(); });
    this.view.root.querySelector("#admin-metrics-refresh")?.addEventListener("click", () => void this.loadDashboard());
    this.view.root.querySelectorAll("[data-admin-resource]").forEach((button) => button.addEventListener("click", () => {
      this.view.selectDashboardTab("manage");
      this.view.resource.value = button.dataset.adminResource;
      this.scopeId = ""; this.offset = 0; this.activeFilters = {};
      this.view.configureFilters(this.view.resource.value, FILTERS[this.view.resource.value]);
      void this.loadResource();
    }));
    this.view.filterForm.addEventListener("submit", (event) => {
      event.preventDefault(); this.offset = 0;
      const resource = this.view.resource.value;
      const text = this.view.filterText.value.trim(); const option = this.view.filterOption.value;
      const queryKey = { modelos: "q", unidades: "q", clientes: "q", demos: "id_vehiculo", auditoria: "entidad" }[resource];
      const optionKey = { modelos: "estado", unidades: "activo", clientes: "estado", usuarios: "estado", asignaciones: "estado", sesiones: "estado" }[resource];
      this.activeFilters = { ...(queryKey && text ? { [queryKey]: text } : {}), ...(optionKey && option ? { [optionKey]: option } : {}) };
      void this.loadResource();
    });
    this.view.pagePrev.addEventListener("click", () => { this.offset = Math.max(0, this.offset - PAGE_SIZE); void this.loadResource(); });
    this.view.pageNext.addEventListener("click", () => { this.offset += PAGE_SIZE; void this.loadResource(); });
    this.view.root.querySelector("#admin-create-toggle").addEventListener("click", () => {
      const resource = this.view.resource.value;
      this.view.buildForm(resource, this.create.bind(this), this.scopeId);
      if (["usuarios", "clientes"].includes(resource)) void this.configureBuyerModelSelector();
    });
    this.view.form.addEventListener("submit", (event) => event.preventDefault());
    this.view.showLogin();
    this.view.configureFilters(this.view.resource.value, FILTERS[this.view.resource.value]);
    void this.initializeGoogleLogin();
    void this.restoreSession();
  }
  async loadGoogleIdentityScript() {
    if (window.google?.accounts?.id) return;
    if (!this.googleScriptPromise) {
      this.googleScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services."));
        document.head.append(script);
      });
    }
    await this.googleScriptPromise;
    if (!window.google?.accounts?.id) throw new Error("Google Identity Services no está disponible.");
  }
  async initializeGoogleLogin() {
    const slots = [
      this.view.root.querySelector("#google-login-button-user"),
      this.view.root.querySelector("#google-login-button-admin"),
    ].filter(Boolean);
    if (!slots.length) return;
    try {
      const config = await this.api.googleConfig();
      if (!config?.enabled || !config.client_id) {
        this.view.setLoginStatus("Google aún no está habilitado; falta configurar GOOGLE_OAUTH_CLIENT_ID en la API.", "", this.view.loginStatus);
        this.view.setLoginStatus("Google aún no está habilitado; falta configurar GOOGLE_OAUTH_CLIENT_ID en la API.", "", this.view.adminLoginStatus);
        return;
      }
      await this.loadGoogleIdentityScript();
      window.google.accounts.id.initialize({
        client_id: config.client_id,
        callback: (response) => {
          const destination = this.view.accessTab === "admin" ? "admin" : "control";
          void this.loginWithGoogle(response.credential, destination);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      for (const slot of slots) {
        slot.replaceChildren();
        slot.hidden = false;
        const width = Math.max(200, Math.min(400, Math.floor(slot.parentElement.getBoundingClientRect().width)));
        window.google.accounts.id.renderButton(slot, {
          type: "standard", theme: "outline", size: "large", text: "continue_with",
          shape: "rectangular", logo_alignment: "left", locale: "es", width,
        });
        slot.parentElement.hidden = false;
      }
    } catch {
      this.view.setLoginStatus("No se pudo cargar el acceso de Google. Puedes iniciar sesión con correo y contraseña.", "error", this.view.loginStatus);
      this.view.setLoginStatus("No se pudo cargar el acceso de Google. Puedes iniciar sesión con correo y contraseña.", "error", this.view.adminLoginStatus);
    }
  }
  async loginWithGoogle(credential, destination) {
    if (this.loading || !credential) return;
    const authRevision = ++this.authRevision;
    this.loading = true;
    const status = destination === "admin" ? this.view.adminLoginStatus : this.view.loginStatus;
    this.view.setLoginStatus("Validando la cuenta de Google con la API…", "", status);
    try {
      const result = await this.api.loginWithGoogle(credential);
      if (authRevision !== this.authRevision) return;
      this.clearGuestToken();
      try { sessionStorage.removeItem("control-iot:public-control"); } catch { /* almacenamiento opcional */ }
      sessionStorage.setItem(TOKEN_KEY, result.access_token);
      const principal = await this.api.me();
      if (authRevision !== this.authRevision) return;
      if (destination === "admin" && !principal.roles.includes("ADMINISTRADOR")) {
        throw new Error("La cuenta de Google no tiene rol de administrador. Usa la pestaña Usuario o una cuenta administradora.");
      }
      if (!principal.roles.includes("ADMINISTRADOR")) sessionStorage.removeItem("control-iot:selected-vehicle");
      this.acceptPrincipal(principal);
      sessionStorage.setItem("control-iot:active-view", destination === "admin" ? "admin" : "control");
    } catch (error) {
      if (authRevision !== this.authRevision) return;
      this.clearToken();
      this.view.setLoginStatus(error.message || "No se pudo iniciar sesión con Google.", "error", status);
    } finally { this.loading = false; }
  }
  async configureBuyerModelSelector() {
    const current = this.view.root.querySelector("#admin-field-id_modelo");
    if (!current || current.tagName === "SELECT") return;
    const select = document.createElement("select");
    select.id = current.id; select.name = current.name; select.className = "form-select";
    select.required = true; select.setAttribute("aria-describedby", "admin-buyer-model-note");
    select.add(new Option("Cargando modelos…", "")); current.replaceWith(select);
    try {
      const models = await this.api.models();
      if (!select.isConnected) return;
      select.replaceChildren(new Option(models.length ? "Selecciona el modelo" : "No hay modelos activos", ""));
      for (const model of models) select.add(new Option(`${model.nombre} · ${model.codigo} · ID ${model.id_modelo}`, model.id_modelo));
      select.disabled = models.length === 0;
    } catch (error) {
      if (select.isConnected) {
        select.replaceChildren(new Option("No se pudieron consultar los modelos", ""));
        select.disabled = true;
      }
      this.view.setStatus(`No se pudo cargar el catálogo de modelos: ${error.message}`, "error");
    }
  }
  async restoreSession() {
    const authRevision = this.authRevision;
    try { sessionStorage.removeItem("control-iot:public-control"); } catch { /* acceso público anterior retirado */ }
    let token = null;
    try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* almacenamiento opcional */ }
    if (token) {
      try {
        const principal = await this.api.me();
        if (authRevision !== this.authRevision) return;
        this.acceptPrincipal(principal);
        return;
      } catch {
        // Una restauración iniciada antes de un nuevo login no puede borrar
        // ni reemplazar la sesión que el usuario acaba de abrir.
        if (authRevision !== this.authRevision) return;
        this.clearToken();
        this.view.setLoginStatus("La sesión venció. Inicia sesión de nuevo.", "error");
      }
    }
    let guestToken = null;
    try { guestToken = sessionStorage.getItem(GUEST_TOKEN_KEY); } catch { /* almacenamiento opcional */ }
    if (guestToken) {
      try {
        const session = await this.api.guestSession(guestToken);
        if (authRevision !== this.authRevision) return;
        this.acceptGuest(session);
      } catch {
        if (authRevision !== this.authRevision) return;
        this.clearGuestToken();
        this.view.setLoginStatus("El token de invitado venció o fue revocado.", "error");
      }
    }
    if (authRevision !== this.authRevision) return;
    if (!this.principal && !this.guestSession) {
      this.onIdentityChange(null);
    }
  }
  async login(form, status, destination) {
    if (this.loading) return;
    const authRevision = ++this.authRevision;
    this.loading = true;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    this.view.setLoginStatus("Validando credenciales con la API…", "", status);
    try {
      const data = new FormData(form);
      const result = await this.api.login(String(data.get("correo")).trim(), String(data.get("password")));
      this.clearGuestToken();
      try { sessionStorage.removeItem("control-iot:public-control"); } catch { /* almacenamiento opcional */ }
      sessionStorage.setItem(TOKEN_KEY, result.access_token);
      const principal = await this.api.me();
      if (authRevision !== this.authRevision) return;
      if (destination === "admin" && !principal.roles.includes("ADMINISTRADOR")) {
        throw new Error("La cuenta ingresada no tiene permisos de administrador. Usa la pestaña Usuario o una cuenta administradora.");
      }
      if (!principal.roles.includes("ADMINISTRADOR")) sessionStorage.removeItem("control-iot:selected-vehicle");
      form.reset();
      this.acceptPrincipal(principal);
      sessionStorage.setItem("control-iot:active-view", destination === "admin" ? "admin" : "control");
      // La autenticación se mantiene en esta página. loadVehicles abre el
      // carrito asignado o deja al usuario en Mis vehículos si no tiene uno.
    } catch (error) {
      this.clearToken();
      this.view.setLoginStatus(error.message || "No se pudo iniciar sesión.", "error", status);
    } finally { this.loading = false; submit.disabled = false; }
  }
  acceptPrincipal(principal) {
    this.principal = principal;
    // En la entrada inicial del comprador abrimos su unidad autorizada.
    // Al visitar "Mis vehículos" después, la lista debe permanecer abierta.
    this.autoSelectVehicleOnLoad = !principal.roles.includes("ADMINISTRADOR");
    this.view.showSession(principal);
    this.onIdentityChange({ type: "account", principal });
    void this.loadVehicles();
    if (principal.roles.includes("ADMINISTRADOR")) {
      this.view.configureFilters(this.view.resource.value, FILTERS[this.view.resource.value]);
      void this.loadDashboard(); void this.loadResource();
    }
  }
  async loadGuestCatalog() {
    const select = this.view.root.querySelector("#guest-model-select");
    const status = this.view.root.querySelector("#guest-access-status");
    const catalog = this.view.root.querySelector("#guest-catalog-list");
    if (!select || !status) return;
    select.disabled = true;
    select.replaceChildren(new Option("Consultando catálogo…", ""));
    status.textContent = "Consultando modelos y unidades de exhibición…";
    status.dataset.state = "";
    try {
      const models = await this.api.publicCatalog();
      select.replaceChildren(new Option("Selecciona un modelo", ""));
      catalog?.replaceChildren();
      for (const model of models) {
        const available = Number(model.unidades_disponibles) > 0;
        const label = `${model.nombre}${model.marca ? ` · ${model.marca}` : ""} · ${available ? `${model.unidades_disponibles} disponible(s)` : "sin unidad de exhibición"}`;
        select.add(new Option(label, available ? String(model.id_modelo) : ""));
        if (catalog) {
          const card = document.createElement("article"); card.className = "guest-model-card";
          const heading = document.createElement("h3"); heading.textContent = model.nombre;
          const brand = document.createElement("p"); brand.textContent = model.marca || model.codigo || "Modelo IoT";
          const capabilities = document.createElement("p");
          capabilities.textContent = `Capacidades: ${(model.capacidades || []).join(", ") || "Sin datos"}`;
          const availability = document.createElement("strong");
          availability.textContent = available ? `${model.unidades_disponibles} unidad(es) de exhibición disponible(s)` : "Sin unidad de exhibición disponible";
          card.append(heading, brand, capabilities, availability); catalog.append(card);
        }
      }
      select.disabled = models.length === 0;
      status.textContent = models.length ? "Elige un modelo con unidad de exhibición disponible." : "No hay modelos publicados para demostración.";
      status.dataset.state = models.length ? "" : "error";
      this.updateGuestRequestButton();
    } catch (error) {
      select.replaceChildren(new Option("No se pudo cargar el catálogo", ""));
      catalog?.replaceChildren();
      status.textContent = `No se pudo consultar el catálogo: ${error.message}`;
      status.dataset.state = "error";
    }
  }
  updateGuestRequestButton() {
    const select = this.view.root.querySelector("#guest-model-select");
    const button = this.view.root.querySelector("#guest-session-request");
    if (select && button) button.disabled = select.disabled || !select.value;
  }
  async requestGuestAccess() {
    const select = this.view.root.querySelector("#guest-model-select");
    const button = this.view.root.querySelector("#guest-session-request");
    const status = this.view.root.querySelector("#guest-access-status");
    const modelId = Number(select?.value);
    if (!Number.isInteger(modelId) || modelId <= 0 || !button || !status) return;
    button.disabled = true;
    status.textContent = "Solicitando una reserva temporal a la API…";
    status.dataset.state = "";
    try {
      const session = await this.api.requestGuestSession(modelId);
      if (!session?.token_invitado || !Number.isInteger(Number(session.id_vehiculo))) {
        throw new Error("La API no devolvió una sesión temporal válida.");
      }
      this.clearToken();
      try { sessionStorage.removeItem("control-iot:public-control"); } catch { /* almacenamiento opcional */ }
      sessionStorage.setItem(GUEST_TOKEN_KEY, session.token_invitado);
      sessionStorage.setItem("control-iot:selected-vehicle", String(session.id_vehiculo));
      sessionStorage.setItem("control-iot:active-view", "control");
      this.acceptGuest(session);
      this.onVehicleSelect(Number(session.id_vehiculo));
    } catch (error) {
      status.textContent = error.message || "No se pudo reservar una unidad de exhibición.";
      status.dataset.state = "error";
      this.updateGuestRequestButton();
    }
  }
  acceptGuest(session) {
    this.guestSession = session;
    this.view.showGuestSession(session);
    this.onIdentityChange({ type: "guest", session });
    window.clearInterval(this.guestExpiryTimer);
    const button = this.view.root.querySelector("#public-session-exit");
    if (button) {
      button.hidden = false;
      const update = () => {
        const remaining = Math.max(0, Math.ceil((new Date(session.expira_en).getTime() - Date.now()) / 1000));
        button.textContent = remaining ? `Salir de prueba · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "Prueba finalizada";
        if (!remaining) window.clearInterval(this.guestExpiryTimer);
      };
      update();
      this.guestExpiryTimer = window.setInterval(update, 1000);
    }
  }
  clearToken() { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* sin almacenamiento */ } }
  clearGuestToken() { try { sessionStorage.removeItem(GUEST_TOKEN_KEY); } catch { /* sin almacenamiento */ } }
  async logout() {
    this.authRevision += 1;
    const token = sessionStorage.getItem(TOKEN_KEY);
    const guest = sessionStorage.getItem(GUEST_TOKEN_KEY);
    try {
      if (token) await this.api.logout();
      else if (guest) await this.api.finishGuestSession(guest);
    } catch (error) { this.view.setLoginStatus(`La sesión local se cerró; el servidor informó: ${error.message}`, "error"); }
    this.clearToken(); this.clearGuestToken(); this.principal = null;
    window.clearInterval(this.guestExpiryTimer); this.guestExpiryTimer = null;
    try { sessionStorage.removeItem("control-iot:public-control"); sessionStorage.removeItem("control-iot:selected-vehicle"); } catch { /* almacenamiento opcional */ }
    sessionStorage.setItem("control-iot:active-view", "admin"); window.location.reload();
  }
  async loadVehicles() {
    if (!this.principal) return;
    if (this.vehicleLoadPromise) return this.vehicleLoadPromise;
    this.view.vehiclesList.replaceChildren(Object.assign(document.createElement("p"), { className: "admin-empty", textContent: "Consultando las unidades permitidas por la API…" }));
    this.vehicleLoadPromise = (async () => { try {
      const rows = await this.api.vehicles(this.principal.roles.includes("ADMINISTRADOR") ? "ADMINISTRADOR" : "USUARIO");
      if (!Array.isArray(rows)) throw new Error("La API devolvió un catálogo de vehículos no válido.");
      const current = Number(sessionStorage.getItem("control-iot:selected-vehicle"));
      const isAdmin = this.principal.roles.includes("ADMINISTRADOR");
      if (rows.length && !isAdmin && this.autoSelectVehicleOnLoad) {
        this.autoSelectVehicleOnLoad = false;
        const vehicle = rows.find((item) => Number(item.id_vehiculo) === current) || rows[0];
        sessionStorage.setItem("control-iot:selected-vehicle", String(vehicle.id_vehiculo));
        this.onVehicleSelect(Number(vehicle.id_vehiculo));
        return;
      }
      if (!rows.length && !isAdmin) {
        this.autoSelectVehicleOnLoad = false;
        if (current > 0) sessionStorage.removeItem("control-iot:selected-vehicle");
        this.onNavigate("admin");
      }
      this.view.renderVehicles(rows, this.selectVehicle.bind(this));
    } catch (error) {
      this.view.vehiclesList.replaceChildren(Object.assign(document.createElement("p"), { className: "admin-empty", textContent: `No se pudieron consultar las unidades autorizadas: ${error.message}` }));
      this.view.vehiclesCount.textContent = "Sin verificar";
    } finally { this.vehicleLoadPromise = null; } })();
    return this.vehicleLoadPromise;
  }
  selectVehicle(id) {
    if (this.guestSession && Number(this.guestSession.id_vehiculo) !== Number(id)) return;
    sessionStorage.setItem("control-iot:selected-vehicle", String(id));
    sessionStorage.setItem("control-iot:active-view", "control");
    // La selección actualiza la unidad dentro de la app; recargar aquí puede
    // hacer que una sesión válida termine otra vez en el login.
    this.onVehicleSelect(id);
  }
  async loadResource() {
    if (!this.principal?.roles.includes("ADMINISTRADOR")) return;
    const key = this.view.resource.value;
    const createButton = this.view.root.querySelector("#admin-create-toggle");
    createButton.hidden = ["usuarios", "auditoria"].includes(key);
    createButton.textContent = key === "clientes" ? "+ Nuevo comprador" : "＋ Nuevo";
    const requestId = ++this.resourceRequestId;
    if (key === "pasos" && !this.scopeId) {
      const answer = window.prompt("Escribe el ID de la DEMO para consultar sus pasos:");
      if (!answer || !/^\d+$/.test(answer) || Number(answer) < 1) { this.view.setStatus("Selecciona una DEMO válida para consultar sus pasos.", "error"); return; }
      this.scopeId = answer;
      this.view.buildForm("pasos", this.create.bind(this), this.scopeId);
    }
    this.view.setStatus("Cargando datos desde la API…");
    try {
      const rows = await this.api.list(key, this.scopeId, { offset: this.offset, limit: PAGE_SIZE, filters: this.activeFilters });
      if (requestId !== this.resourceRequestId) return;
      if (!Array.isArray(rows)) throw new Error("La respuesta no es una lista válida.");
      this.view.renderRows(key, rows, this.runAction.bind(this));
      this.view.setPagination(Math.floor(this.offset / PAGE_SIZE) + 1, this.offset > 0, key !== "pasos" && rows.length === PAGE_SIZE);
      this.view.setStatus(`${ADMIN_RESOURCE_DEFINITIONS[key].title}: ${rows.length} registro(s) recibidos de la API.`, "success");
    } catch (error) { if (requestId === this.resourceRequestId) { this.view.renderRows(key, [], this.runAction.bind(this)); this.view.setPagination(Math.floor(this.offset / PAGE_SIZE) + 1, this.offset > 0, false); this.view.setStatus(error.message || "No se pudo consultar el recurso.", "error"); } }
  }
  async loadDashboard() {
    if (!this.principal?.roles.includes("ADMINISTRADOR")) return;
    const requestId = ++this.dashboardRequestId;
    this.view.setMetricsStatus("Consultando métricas verificadas desde la API/RDS…");
    try {
      const metrics = await this.api.dashboard();
      if (requestId !== this.dashboardRequestId) return;
      this.view.renderMetrics(metrics);
      this.view.setMetricsStatus(`Datos consultados en ${metrics.generado_en || "la última solicitud"}.`, "success");
    } catch (error) {
      if (requestId !== this.dashboardRequestId) return;
      this.view.renderMetrics({ modelos_activos: null, unidades_totales: null, unidades_vendidas_asignadas: null,
        unidades_disponibles_prueba: null, clientes_activos: null, demos_activas: null,
        unidades_con_sesion_wss: null, unidades_con_dispositivo_wss: null,
        nota_wss: "WSS del navegador: sin verificar", nota_dispositivo_wss: "WSS del ESP8266: sin verificar",
        generado_en: "Sin datos" });
      this.view.setMetricsStatus(`No se pudieron consultar las métricas: ${error.message}`, "error");
    }
  }
  async create(formData, resource, _scopeId = "", record = null) {
    const definition = ADMIN_RESOURCE_DEFINITIONS[resource];
    const data = {};
    for (const [key, label, type] of (record ? definition.editFields || [] : definition.fields)) {
      if (resource === "pasos" && key === "id_demo") continue;
      const raw = String(formData.get(key) ?? "").trim();
      if (raw === "") continue;
      if (resource === "sesiones" && key === "comandos_permitidos") {
        data[key] = raw.split(",").map((value) => Number(value.trim()));
      } else if (type === "number") data[key] = Number(raw);
      else if (type === "select:1|0") data[key] = raw === "1";
      else if (type.startsWith("select:")) data[key] = raw;
      else data[key] = raw;
    }
    if (["usuarios", "clientes"].includes(resource) && (!Number.isInteger(data.id_modelo) || data.id_modelo < 1)) {
      this.view.setStatus("Selecciona un modelo activo para crear el carrito virtual del comprador.", "error");
      return;
    }
    try {
      this.view.setStatus("Guardando mediante la API…");
      let created;
      if (record) created = await this.api.update(resource, record, data);
      else if (resource === "pasos") {
        const demoId = Number(this.scopeId);
        const { id_demo: _omit, ...step } = data;
        created = await this.api.addStep(demoId, step);
      } else created = await this.api.create(resource, data);
      this.view.form.reset(); this.view.form.hidden = true;
      const msg = record ? "Cambios guardados por la API." : resource === "sesiones" ? "Sesión reservada. Actívala antes de compartir el token con la persona invitada." : ["usuarios", "clientes"].includes(resource) ? `Comprador creado con carrito simulado #${created.id_vehiculo}. No se asignó una unidad física.` : "Registro creado en la API.";
      if (resource === "sesiones" && created?.token_invitado) this.view.showInvitationToken(created.token_invitado);
      this.view.setStatus(msg, "success");
      await this.loadResource();
    } catch (error) { this.view.setStatus(error.message || "No se pudo guardar el registro.", "error"); }
  }
  async runAction(resource, row, action) {
    if (action === "open-steps") { this.view.resource.value = "pasos"; this.scopeId = String(row.id_demo); this.view.buildForm("pasos", this.create.bind(this), this.scopeId); await this.loadResource(); return; }
    if (action === "edit") { this.view.buildForm(resource, this.create.bind(this), this.scopeId, row); return; }
    if (action === "change-roles") {
      const current = String(row.roles || "USUARIO").split(",").map((role) => role.trim()).filter(Boolean).join(",");
      const choice = window.prompt("Roles permitidos: USUARIO, ADMINISTRADOR. Invitado usa una sesión temporal.", current);
      if (choice === null) return;
      const roles = [...new Set(choice.split(",").map((role) => role.trim().toUpperCase()).filter(Boolean))];
      if (!roles.length || roles.some((role) => !["USUARIO", "ADMINISTRADOR"].includes(role))) {
        this.view.setStatus("Indica USUARIO, ADMINISTRADOR o ambos, separados por coma.", "error"); return;
      }
      try {
        await this.api.changeRoles(row.id_usuario, roles);
        this.view.setStatus("Roles actualizados por la API; las sesiones anteriores se cerraron.", "success");
        await this.loadResource();
      } catch (error) { this.view.setStatus(error.message || "La API rechazó el cambio de roles.", "error"); }
      return;
    }
    const promptMessage = action === "deactivate" ? "¿Confirmas la baja lógica de este registro?" : action === "revoke" ? "¿Revocas la sesión temporal?" : action === "close" ? "¿Finalizas la asignación?" : action === "delete-step" ? "¿Eliminas este paso de la demo?" : "¿Cambias el estado de este usuario?";
    if (!window.confirm(promptMessage)) return;
    try { await this.api.action(resource, row, action); this.view.setStatus("Cambio confirmado por la API.", "success"); await this.loadResource(); }
    catch (error) { this.view.setStatus(error.message || "La API rechazó el cambio.", "error"); }
  }
}
