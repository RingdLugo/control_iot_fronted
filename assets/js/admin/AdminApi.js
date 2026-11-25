import { HttpClient } from "../api/HttpClient.js?v=20261122-6";

export class AdminApi {
  constructor(http = new HttpClient()) { this.http = http; }
  login(correo, password) { return this.http.request("/auth/token", { method: "POST", body: { correo, password } }); }
  googleConfig() { return this.http.request("/auth/google/config"); }
  loginWithGoogle(credential) { return this.http.request("/auth/google", { method: "POST", body: { credential } }); }
  logout() { return this.http.request("/auth/logout", { method: "POST" }); }
  models() { return this.http.request("/auth/modelos"); }
  registerBuyer(data) { return this.http.request("/auth/registro-comprador", { method: "POST", body: data }); }
  me() { return this.http.request("/auth/me"); }
  dashboard() { return this.http.request("/admin/dashboard"); }
  health() { return this.http.request("/health"); }
  guestSession(token) { return this.http.request("/guest/sesion", { headers: { "X-Guest-Token": token } }); }
  publicCatalog() { return this.http.request("/guest/catalogo"); }
  requestGuestSession(modelId) { return this.http.request("/guest/sesiones", { method: "POST", body: { id_modelo: Number(modelId) } }); }
  finishGuestSession(token) { return this.http.request("/guest/sesiones/actual", { method: "DELETE", headers: { "X-Guest-Token": token } }); }
  vehicles(role) {
    const path = role === "ADMINISTRADOR" ? "/admin/unidades?limit=100&offset=0" : "/cuenta/vehiculos";
    return this.http.request(path);
  }
  list(resource, scopeId = "", { offset = 0, limit = 50, filters = {} } = {}) {
    const paths = {
      modelos: "/admin/modelos", unidades: "/admin/unidades", clientes: "/admin/clientes",
      usuarios: "/admin/usuarios", asignaciones: "/admin/asignaciones", demos: "/admin/demos",
      sesiones: "/admin/sesiones-invitado", auditoria: "/admin/auditoria",
      pasos: scopeId ? `/admin/demos/${Number(scopeId)}/pasos` : null,
    };
    const path = paths[resource];
    if (!path) throw new Error(resource === "pasos" ? "Escribe el ID de una DEMO para consultar sus pasos." : "Área no reconocida.");
    if (resource === "pasos") return this.http.request(path);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    for (const [key, value] of Object.entries(filters)) if (value !== "" && value != null) params.set(key, String(value));
    return this.http.request(`${path}?${params}`);
  }
  create(resource, data) {
    const paths = {
      modelos: "/admin/modelos", unidades: "/admin/unidades", clientes: "/admin/clientes",
      usuarios: "/admin/usuarios", asignaciones: "/admin/asignaciones",
      demos: "/admin/demos", sesiones: "/admin/sesiones-invitado",
    };
    const path = paths[resource];
    if (!path) throw new Error("Esta área no admite creación desde el panel.");
    return this.http.request(path, { method: "POST", body: data });
  }
  action(resource, row, action) {
    const id = Number(row.id_modelo ?? row.id_vehiculo ?? row.id_cliente ?? row.id_usuario
      ?? row.id_asignacion ?? row.id_demo ?? row.id_sesion ?? row.id_demo_movimiento);
    if (action === "activate") return this.http.request(`/admin/sesiones-invitado/${id}/activar`, { method: "PATCH" });
    if (action === "revoke") return this.http.request(`/admin/sesiones-invitado/${id}/revocar`, { method: "PATCH" });
    if (action === "close") return this.http.request(`/admin/asignaciones/${id}`, { method: "PATCH", body: { estado: "FINALIZADA" } });
    if (action === "toggle-user") return this.http.request(`/admin/usuarios/${id}/estado`, {
      method: "PATCH", body: { estado: row.estado === "ACTIVO" ? "BLOQUEADO" : "ACTIVO" },
    });
    if (action === "delete-step") return this.http.request(`/admin/demos/pasos/${id}`, { method: "DELETE" });
    if (action === "deactivate") {
      const paths = { modelos: `modelos/${id}`, unidades: `unidades/${id}`, clientes: `clientes/${id}`, demos: `demos/${id}` };
      if (!paths[resource]) throw new Error("Acción no disponible.");
      return this.http.request(`/admin/${paths[resource]}`, { method: "DELETE" });
    }
    throw new Error("Acción no disponible.");
  }
  changeRoles(userId, roles) {
    return this.http.request(`/admin/usuarios/${Number(userId)}/roles`, {
      method: "PATCH", body: { roles },
    });
  }
  update(resource, row, data) {
    const id = Number(row.id_modelo ?? row.id_vehiculo ?? row.id_cliente ?? row.id_demo ?? row.id_demo_movimiento);
    const paths = { modelos: `/admin/modelos/${id}`, unidades: `/admin/unidades/${id}`,
      clientes: `/admin/clientes/${id}`, demos: `/admin/demos/${id}`, pasos: `/admin/demos/pasos/${id}` };
    if (!paths[resource] || !Number.isInteger(id) || id < 1) throw new Error("No se pudo identificar el registro para actualizar.");
    return this.http.request(paths[resource], { method: "PATCH", body: data });
  }
  addStep(demoId, data) { return this.http.request(`/admin/demos/${Number(demoId)}/pasos`, { method: "POST", body: data }); }
}

export const ADMIN_RESOURCE_DEFINITIONS = Object.freeze({
  modelos: { title: "Modelos comerciales", columns: ["id_modelo", "codigo", "marca", "nombre", "microcontrolador", "estado"],
    fields: [["codigo","Código","text",true],["marca","Marca","text",true],["nombre","Nombre comercial","text",true],["microcontrolador","Microcontrolador","text",false]],
    editFields: [["marca","Marca","text",true],["nombre","Nombre comercial","text",true],["microcontrolador","Microcontrolador","text",false],["estado","Estado","select:ACTIVO|INACTIVO|BAJA",true]] },
  unidades: { title: "Unidades e inventario", columns: ["id_vehiculo", "nombre", "nombre_modelo", "estado_comercial", "propietario", "disponible_demo", "estado_sesion", "conectividad"],
    fields: [["nombre","Nombre de unidad","text",true],["descripcion","Descripción","text",false],["microcontrolador","Microcontrolador","text",false],["id_modelo","ID de modelo","number",true]],
    editFields: [["nombre","Nombre de unidad","text",true],["descripcion","Descripción","text",false],["id_modelo","ID de modelo","number",false],["disponible_demo","Unidad de exhibición pública","select:1|0",true]] },
  clientes: { title: "Compradores · cuenta y carrito", columns: ["id_cliente", "nombre", "correo_contacto", "id_usuario", "id_vehiculo", "tipo_vehiculo", "telefono_contacto", "estado"],
    fields: [["nombre","Nombre del comprador","text",true],["correo_contacto","Correo de acceso","email",true],["password","Contraseña inicial (12 caracteres mínimo)","password",true],["id_modelo","ID de modelo comercial","number",true],["telefono_contacto","Teléfono","tel",false]],
    editFields: [["nombre","Nombre","text",true],["correo_contacto","Correo de contacto","email",false],["telefono_contacto","Teléfono","tel",false],["estado","Estado","select:ACTIVO|INACTIVO|BAJA",true]] },
  usuarios: { title: "Usuarios y roles", columns: ["id_usuario", "nombre", "correo", "id_vehiculo", "tipo_carrito", "estado", "roles"],
    fields: [["nombre","Nombre del comprador","text",true],["correo","Correo de acceso","email",true],["password","Contraseña inicial (12 caracteres mínimo)","password",true],["id_modelo","ID de modelo comercial","number",true]] },
  asignaciones: { title: "Asignaciones", columns: ["id_asignacion", "vehiculo", "cliente", "estado", "inicio", "fin"],
    fields: [["id_vehiculo","ID de unidad","number",true],["id_cliente","ID de cliente","number",true],["motivo","Motivo","text",false]] },
  demos: { title: "Demos", columns: ["id_demo", "id_vehiculo", "nombre", "descripcion", "activo", "total_pasos"],
    fields: [["id_vehiculo","ID de unidad","number",true],["nombre","Nombre","text",true],["descripcion","Descripción","text",false]],
    editFields: [["nombre","Nombre","text",true],["descripcion","Descripción","text",false],["activo","Estado","select:1|0",true]] },
  pasos: { title: "Pasos ordenados de una demo", columns: ["id_demo_movimiento", "id_comando", "comando", "orden", "duracion_ms", "pausa_ms"],
    fields: [["id_demo","ID de demo","number",true],["id_comando","ID de comando","number",true],["orden","Orden","number",true],["duracion_ms","Duración en ms","number",true],["pausa_ms","Pausa en ms","number",true]],
    editFields: [["id_comando","ID de comando","number",false],["orden","Orden","number",false],["duracion_ms","Duración en ms","number",false],["pausa_ms","Pausa en ms","number",false]] },
  sesiones: { title: "Sesiones de invitado", columns: ["id_sesion", "id_vehiculo", "id_demo", "estado", "inicio", "expira_en", "comandos_permitidos"],
    fields: [["id_vehiculo","ID de unidad","number",true],["id_demo","ID de demo (opcional)","number",false],["duracion_minutos","Vigencia en minutos","number",true],["comandos_permitidos","IDs de comandos separados por coma","text",true]] },
  auditoria: { title: "Auditoría", columns: ["id_auditoria", "accion", "entidad", "id_entidad", "resultado", "origen", "ocurrido_en"], fields: [] },
});
