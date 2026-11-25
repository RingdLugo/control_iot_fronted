export class DemoView {
  renderCatalog(select, demos) {
    select.replaceChildren(); const prompt = document.createElement("option"); prompt.value = ""; prompt.textContent = "Elige una DEMO…"; select.append(prompt);
    const available = demos.filter((demo) => demo && typeof demo === "object" && Number.isInteger(Number(demo.id_demo)) && Number(demo.id_demo) > 0 && typeof demo.nombre === "string" && Number(demo.activo) === 1);
    for (const demo of available) { const option = document.createElement("option"); option.value = String(demo.id_demo); option.textContent = demo.nombre; select.append(option); }
    select.disabled = available.length === 0; return available.length;
  }
  renderSteps(container, steps) {
    container.replaceChildren();
    if (!Array.isArray(steps) || !steps.every((step) => step && typeof step === "object")) throw new Error("La API devolvió una definición de DEMO no válida.");
    if (!steps.length) { const empty = document.createElement("p"); empty.className = "demo-preview-empty"; empty.textContent = "Esta DEMO todavía no tiene pasos."; container.append(empty); return; }
    const summary = document.createElement("p"); summary.className = "demo-preview-summary"; summary.textContent = `${steps.length} pasos · secuencia ejecutada por la API`;
    const list = document.createElement("ol"); list.className = "demo-preview-list";
    for (const step of [...steps].sort((a, b) => Number(a.orden) - Number(b.orden))) {
      const item = document.createElement("li");
      item.dataset.demoOrder = String(Number(step.orden));
      const title = document.createElement("span"); title.className = "demo-step-name";
      title.textContent = `Paso ${step.orden} · ${typeof step.comando === "string" ? step.comando.replaceAll("_", " ") : "Comando"}`;
      const detail = document.createElement("small");
      detail.textContent = [[step.codigo, `Código ${step.codigo}`], [step.duracion_ms, `${step.duracion_ms} ms`], [step.pausa_ms, `pausa ${step.pausa_ms} ms`]]
        .filter(([value]) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))).map(([, text]) => text).join(" · ");
      item.append(title, detail); list.append(item);
    }
    container.append(summary, list);
  }
  resetStepProgress(container) {
    container.querySelectorAll(".demo-preview-list li").forEach((item) => {
      item.classList.remove("is-active", "is-complete");
      item.removeAttribute("aria-current");
    });
  }
  highlightStep(container, order) {
    const activeOrder = Number(order);
    if (!Number.isInteger(activeOrder) || activeOrder < 1) return false;
    const items = [...container.querySelectorAll(".demo-preview-list li")];
    const target = items.find((item) => Number(item.dataset.demoOrder) === activeOrder);
    if (!target) return false;
    items.forEach((item) => {
      const itemOrder = Number(item.dataset.demoOrder);
      const active = item === target;
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-complete", itemOrder < activeOrder);
      if (active) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  }
  finishStepProgress(container, completed = false) {
    const items = [...container.querySelectorAll(".demo-preview-list li")];
    const active = items.find((item) => item.classList.contains("is-active"));
    active?.classList.remove("is-active");
    active?.removeAttribute("aria-current");
    if (completed) items.forEach((item) => item.classList.add("is-complete"));
  }
  renderError(container, message) { container.replaceChildren(); const note = document.createElement("p"); note.className = "demo-preview-empty"; note.textContent = message; container.append(note); }
}
