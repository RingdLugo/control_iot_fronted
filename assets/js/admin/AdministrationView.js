import { ADMIN_RESOURCE_DEFINITIONS } from "./AdminApi.js?v=20261122-9";

export class AdministrationView {
  constructor(root = document) {
    this.root = root;
    this.loginPanel = root.querySelector("#admin-login-panel");
    this.loginForm = root.querySelector("#admin-login-form");
    this.loginStatus = root.querySelector("#admin-login-status");
    this.adminLoginForm = root.querySelector("#admin-account-login-form");
    this.adminLoginStatus = root.querySelector("#admin-account-login-status");
    this.accessTabs = root.querySelector(".access-tabs");
    this.accessPanels = [...root.querySelectorAll("[data-access-panel]")];
    this.accessTab = "user";
    this.accessTabs?.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-access-tab]");
      if (tab && this.accessTabs.contains(tab)) this.selectAccessTab(tab.dataset.accessTab);
    });
    this.dashboard = root.querySelector("#admin-dashboard");
    this.userName = root.querySelector("#admin-user-name");
    this.userRole = root.querySelector("#admin-user-role");
    this.notice = root.querySelector("#admin-role-notice");
    this.tools = root.querySelector("#admin-tools");
    this.vehiclesPanel = root.querySelector("#admin-vehicles-panel");
    this.vehiclesList = root.querySelector("#admin-vehicles-list");
    this.vehiclesCount = root.querySelector("#admin-vehicles-count");
    this.metricsPanel = root.querySelector("#admin-metrics-panel");
    this.metricsGrid = root.querySelector("#admin-metrics-grid");
    this.metricsStatus = root.querySelector("#admin-metrics-status");
    this.wssNote = root.querySelector("#admin-wss-note");
    this.resource = root.querySelector("#admin-resource");
    this.filterForm = root.querySelector("#admin-filter-form");
    this.filterTextWrap = root.querySelector("#admin-filter-text-wrap");
    this.filterText = root.querySelector("#admin-filter-text");
    this.filterTextLabel = root.querySelector("#admin-filter-text-label");
    this.filterOptionWrap = root.querySelector("#admin-filter-option-wrap");
    this.filterOption = root.querySelector("#admin-filter-option");
    this.filterOptionLabel = root.querySelector("#admin-filter-option-label");
    this.pagePrev = root.querySelector("#admin-page-prev");
    this.pageNext = root.querySelector("#admin-page-next");
    this.pageLabel = root.querySelector("#admin-page-label");
    this.status = root.querySelector("#admin-resource-status");
    this.form = root.querySelector("#admin-create-form");
    this.tableHead = root.querySelector("#admin-table-head");
    this.tableBody = root.querySelector("#admin-table-body");
    this.caption = root.querySelector("#admin-table-caption");
    this.scopeId = "";
    this.title = root.querySelector("#admin-title");
    this.eyebrow = root.querySelector(".admin-heading .eyebrow");
    this.description = root.querySelector("#admin-view > .section-hint");
    this.dashboardTabs = root.querySelector("#admin-dashboard-tabs");
    this.activeDashboardTab = "summary";
  }
  setLoginStatus(message, state = "", status = this.loginStatus) { status.textContent = message; status.dataset.state = state; }
  selectAccessTab(name) {
    if (!["user", "guest", "admin"].includes(name)) name = "user";
    this.accessTab = name;
    this.accessTabs?.querySelectorAll("[data-access-tab]").forEach((tab) => {
      const active = tab.dataset.accessTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("is-active", active);
    });
    this.accessPanels.forEach((panel) => { panel.hidden = panel.dataset.accessPanel !== name; });
  }
  showLogin() { this.loginPanel.hidden = false; this.dashboard.hidden = true; if (this.description) this.description.hidden = false; }
  showSession(principal) {
    this.loginPanel.hidden = true;
    this.dashboard.hidden = false;
    this.root.querySelector("#admin-view")?.classList.add("is-authenticated");
    if (this.description) this.description.hidden = true;
    this.userName.textContent = `${principal.nombre} · ${principal.correo}`;
    this.userRole.textContent = principal.roles.join(" · ");
    const admin = principal.roles.includes("ADMINISTRADOR");
    this.tools.hidden = !admin;
    this.dashboardTabs.hidden = !admin;
    this.metricsPanel.hidden = true;
    this.vehiclesPanel.hidden = true;
    this.title.textContent = admin ? "Administración IoT" : "Mis vehículos";
    this.eyebrow.textContent = admin ? "GESTIÓN POR ROL · API AUTENTICADA" : "CUENTA · UNIDADES ASIGNADAS";
    this.notice.textContent = admin
      ? `Administrador de empresa ${principal.id_empresa}. Las operaciones de gestión se validan en la API.`
      : principal.roles.includes("USUARIO")
        ? "Tu lista muestra únicamente las unidades con asignación vigente a tu cuenta. Control, Monitoreo y DEMO usan rutas que validan esa asignación."
        : "Esta cuenta no tiene un rol con acceso a las herramientas disponibles.";
    if (admin) {
      this.selectDashboardTab("summary");
    } else {
      this.metricsPanel.hidden = true;
      this.vehiclesPanel.hidden = false;
      this.tools.hidden = true;
    }
  }
  showGuestSession(session) {
    this.loginPanel.hidden = true;
    this.dashboard.hidden = false;
    this.root.querySelector("#admin-view")?.classList.add("is-authenticated");
    if (this.description) this.description.hidden = true;
    this.userName.textContent = `Sesión temporal · Vehículo ${session.id_vehiculo}`;
    this.userRole.textContent = "INVITADO";
    this.tools.hidden = true;
    this.dashboardTabs.hidden = true;
    this.metricsPanel.hidden = true;
    this.vehiclesPanel.hidden = false;
    this.title.textContent = "Acceso de invitado";
    this.eyebrow.textContent = "PRUEBA TEMPORAL · PERMISOS LIMITADOS";
    this.notice.textContent = `Acceso temporal vigente hasta ${session.expira_en}. Comandos autorizados: ${(session.comandos_permitidos || []).join(", ") || "sin comandos"}. Solo se habilita la DEMO asociada a esta sesión.`;
    const row = { id_vehiculo: session.id_vehiculo, nombre: `Vehículo ${session.id_vehiculo}`, modelo: "Invitado", microcontrolador: "Acceso temporal" };
    this.renderVehicles([row], () => {}, true);
  }
  selectDashboardTab(name) {
    if (!this.dashboardTabs || this.dashboardTabs.hidden) return;
    const allowed = new Set(["summary", "vehicles", "manage"]);
    if (!allowed.has(name)) name = "summary";
    this.activeDashboardTab = name;
    this.dashboardTabs.querySelectorAll("[data-admin-tab]").forEach((tab) => {
      const active = tab.dataset.adminTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("is-active", active);
    });
    this.dashboard.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== name;
    });
  }
  showInvitationToken(token) {
    const panel = this.root.querySelector("#admin-invitation-token"); panel.replaceChildren(); panel.hidden = false;
    const label = document.createElement("strong"); label.textContent = "Token temporal. Se muestra una sola vez; compártelo solo con la persona invitada.";
    const code = document.createElement("code"); code.textContent = token;
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "admin-secondary-button"; copy.textContent = "Copiar token";
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(token); copy.textContent = "Copiado"; } catch { code.focus?.(); } });
    panel.append(label, code, copy);
  }
  showLoggedOut() { this.dashboard.hidden = true; this.loginPanel.hidden = false; this.root.querySelector("#admin-view")?.classList.remove("is-authenticated"); if (this.description) this.description.hidden = false; }
  setStatus(message, state = "") { this.status.textContent = message; this.status.dataset.state = state; }
  setMetricsStatus(message, state = "") { this.metricsStatus.textContent = message; this.metricsStatus.dataset.state = state; }
  renderMetrics(metrics) {
    const entries = [
      ["Modelos activos", metrics.modelos_activos],
      ["Unidades activas", metrics.unidades_totales],
      ["Vendidas o asignadas", metrics.unidades_vendidas_asignadas],
      ["Disponibles para prueba", metrics.unidades_disponibles_prueba],
      ["Clientes activos", metrics.clientes_activos],
      ["DEMO activas", metrics.demos_activas],
      ["Unidades con navegador WSS", metrics.unidades_con_sesion_wss],
      ["Unidades con ESP8266 por WSS", metrics.unidades_con_dispositivo_wss],
    ];
    this.metricsGrid.replaceChildren();
    for (const [labelText, value] of entries) {
      const card = document.createElement("article"); card.className = "admin-metric-card";
      const label = document.createElement("span"); label.textContent = labelText;
      const number = document.createElement("strong"); number.textContent = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? String(value) : "Sin datos";
      card.append(label, number); this.metricsGrid.append(card);
    }
    this.wssNote.textContent = `${metrics.nota_wss || "WSS del navegador: sin verificar"} ${metrics.nota_dispositivo_wss || "WSS del ESP8266: sin verificar"} · Corte: ${metrics.generado_en || "Sin datos"}`;
  }
  configureFilters(resource, config = {}) {
    this.filterForm.hidden = resource === "pasos";
    this.filterTextWrap.hidden = !config.text;
    this.filterOptionWrap.hidden = !config.option;
    this.filterTextLabel.textContent = config.text?.label || "Buscar";
    this.filterText.placeholder = config.text?.placeholder || "";
    this.filterText.value = "";
    this.filterOptionLabel.textContent = config.option?.label || "Filtro";
    this.filterOption.replaceChildren(new Option(config.option?.all || "Todos", ""));
    for (const option of config.option?.values || []) this.filterOption.add(new Option(option.label, option.value));
    this.filterOption.value = "";
    this.pageLabel.textContent = "Página 1";
    this.pagePrev.disabled = true; this.pageNext.disabled = true;
  }
  setPagination(page, canPrevious, canNext) {
    this.pageLabel.textContent = `Página ${page}`;
    this.pagePrev.disabled = !canPrevious; this.pageNext.disabled = !canNext;
  }
  renderVehicles(rows, onSelect, readOnly = false) {
    this.vehiclesList.replaceChildren();
    this.vehiclesCount.textContent = `${rows.length} ${rows.length === 1 ? "unidad" : "unidades"}`;
    if (!rows.length) {
      const empty = document.createElement("p"); empty.className = "admin-empty";
      empty.textContent = "No hay unidades asignadas o registradas para esta cuenta.";
      this.vehiclesList.append(empty); return;
    }
    for (const row of rows) {
      const card = document.createElement("article"); card.className = "admin-vehicle-card";
      const copy = document.createElement("div");
      const title = document.createElement("h3"); title.textContent = row.nombre || `Vehículo ${row.id_vehiculo}`;
      const details = document.createElement("p"); details.textContent = `ID ${row.id_vehiculo} · ${row.modelo || row.nombre_modelo || "Modelo sin datos"} · ${row.microcontrolador || "Controlador sin datos"} · ${row.conectividad || "Conectividad sin verificar"}`;
      copy.append(title, details);
      const button = document.createElement("button"); button.type = "button"; button.className = "admin-secondary-button";
      button.textContent = readOnly ? "Unidad de esta sesión" : "Usar esta unidad";
      button.disabled = readOnly;
      if (!readOnly) button.addEventListener("click", () => onSelect(Number(row.id_vehiculo)));
      card.append(copy, button); this.vehiclesList.append(card);
    }
  }
  buildForm(resource, onSubmit, scopeId = "", record = null) {
    const definition = ADMIN_RESOURCE_DEFINITIONS[resource];
    this.form.replaceChildren();
    if (!definition || !definition.fields.length) { this.form.hidden = true; return; }
    this.form.hidden = false;
    const title = document.createElement("h3"); title.className = "admin-form-title";
    title.textContent = record ? `Editar · ${definition.title}` : resource === "pasos" ? "Agregar paso a la demo" : `Crear · ${definition.title}`;
    this.form.append(title);
    const fields = record ? (definition.editFields || []) : definition.fields;
    for (const [name, labelText, type, required] of fields) {
      if (resource === "pasos" && name === "id_demo") continue;
      const wrap = document.createElement("div"); wrap.className = "admin-field";
      const label = document.createElement("label"); label.htmlFor = `admin-field-${name}`; label.textContent = labelText;
      const selectType = type.startsWith("select:");
      const input = selectType ? document.createElement("select") : document.createElement("input");
      input.id = label.htmlFor; input.name = name;
      if (selectType) {
        input.className = "form-select";
        for (const value of type.slice(7).split("|")) input.add(new Option(value === "1" ? "Activo" : value === "0" ? "Inactivo" : value, value));
      } else { input.type = type; input.className = "form-control"; input.autocomplete = type === "password" ? "new-password" : "off"; }
      input.required = required;
      if (type === "number") { input.min = name.includes("ms") || name === "orden" ? "0" : "1"; input.step = "1"; }
      if (name === "duracion_minutos") { input.min = "1"; input.max = "120"; }
      if (name === "password") input.minLength = 12;
      if (name === "comandos_permitidos") input.placeholder = "14,22";
      if (record && record[name] != null) {
        input.value = type === "select:1|0" ? (record[name] === true || record[name] === 1 ? "1" : "0") : String(record[name]);
      }
      if (name === "disponible_demo") {
        input.value = record?.disponible_demo ? "1" : "0";
        input.setAttribute("aria-describedby", "admin-showcase-note");
        const note = document.createElement("small"); note.id = "admin-showcase-note";
        note.textContent = "Solo unidades propias sin asignación activa. Para retirarla, selecciona No.";
        wrap.append(label, input, note); this.form.append(wrap); continue;
      }
      if (["usuarios", "clientes"].includes(resource) && name === "id_modelo") {
        input.setAttribute("aria-describedby", "admin-buyer-model-note");
        const note = document.createElement("small"); note.id = "admin-buyer-model-note";
        note.textContent = "Consulta el ID en Modelos comerciales. Se creará un carrito SIMULADO con ID nuevo, sin asignar hardware físico.";
        wrap.append(label, input, note); this.form.append(wrap); continue;
      }
      wrap.append(label, input); this.form.append(wrap);
    }
    const actions = document.createElement("div"); actions.className = "admin-form-actions";
    const submit = document.createElement("button"); submit.type = "submit"; submit.className = "admin-primary-button"; submit.textContent = "Guardar";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "admin-secondary-button"; cancel.textContent = "Cerrar";
    cancel.addEventListener("click", () => { this.form.hidden = true; });
    actions.append(submit, cancel); this.form.append(actions);
    this.form.onsubmit = (event) => { event.preventDefault(); void onSubmit(new FormData(this.form), resource, scopeId, record); };
  }
  renderRows(resource, rows, actionHandler) {
    const definition = ADMIN_RESOURCE_DEFINITIONS[resource];
    this.caption.textContent = definition?.title || "Registros";
    this.tableHead.replaceChildren(); this.tableBody.replaceChildren();
    const columns = definition?.columns || [];
    const headerRow = document.createElement("tr");
    for (const key of columns) { const th = document.createElement("th"); th.scope = "col"; th.textContent = key.replaceAll("_", " "); headerRow.append(th); }
    if (resource !== "auditoria") { const th = document.createElement("th"); th.scope = "col"; th.textContent = "Acciones"; headerRow.append(th); }
    const header = document.createElement("thead"); header.append(headerRow); this.tableHead.replaceWith(header); header.id = "admin-table-head"; this.tableHead = header;
    if (!rows.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = Math.max(columns.length + 1, 1); td.className = "admin-empty"; td.textContent = "La API no devolvió registros."; tr.append(td); this.tableBody.append(tr); return; }
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (const key of columns) { const td = document.createElement("td"); const value = row[key]; td.textContent = value == null || value === "" ? "Sin datos" : Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value); tr.append(td); }
      if (resource !== "auditoria") {
        const td = document.createElement("td"); td.className = "admin-actions-cell";
        for (const [action, label] of this.actionsFor(resource, row)) { const button = document.createElement("button"); button.type = "button"; button.className = "admin-row-action"; button.dataset.action = action; button.textContent = label; button.addEventListener("click", () => actionHandler(resource, row, action)); td.append(button); }
        tr.append(td);
      }
      this.tableBody.append(tr);
    }
  }
  actionsFor(resource, row) {
    if (["modelos", "unidades", "clientes", "demos", "pasos"].includes(resource)) {
      const actions = [["edit", "Editar"]];
      const canDeactivate = resource === "unidades"
        ? row.estado_inventario === "EN_INVENTARIO" && row.activo !== 0 && row.activo !== false
        : row.estado !== "BAJA" && row.activo !== 0 && row.activo !== false;
      if (["modelos", "unidades", "clientes"].includes(resource) && canDeactivate) actions.push(["deactivate", "Dar de baja"]);
      if (resource === "demos" && row.activo) actions.push(["open-steps", "Ver pasos"], ["deactivate", "Dar de baja"]);
      if (resource === "pasos") actions.push(["delete-step", "Eliminar paso"]);
      return actions;
    }
    if (resource === "usuarios") return [["change-roles", "Cambiar roles"], ["toggle-user", row.estado === "ACTIVO" ? "Bloquear" : "Activar"]];
    if (resource === "asignaciones" && row.estado === "ACTIVA") return [["close","Finalizar"]];
    if (resource === "sesiones" && row.estado === "RESERVADA") return [["activate","Activar"]];
    if (resource === "sesiones" && row.estado === "ACTIVA") return [["revoke","Revocar"]];
    return [];
  }
}
