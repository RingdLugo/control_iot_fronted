export function renderDemos(select, demos) {
  select.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "Elige una DEMO…";
  select.append(prompt);

  const available = demos.filter((demo) => demo && typeof demo === "object"
    && Number.isInteger(Number(demo.id_demo)) && Number(demo.id_demo) > 0
    && typeof demo.nombre === "string" && Number(demo.activo) === 1);
  for (const demo of available) {
    const option = document.createElement("option");
    option.value = String(demo.id_demo);
    option.textContent = demo.nombre;
    select.append(option);
  }
  select.disabled = available.length === 0;
  return available.length;
}

export function renderDemoSteps(container, steps) {
  container.replaceChildren();
  if (!Array.isArray(steps) || !steps.every((step) => step && typeof step === "object")) {
    throw new Error("La API devolvió una definición de DEMO no válida.");
  }
  if (!steps.length) {
    const empty = document.createElement("p");
    empty.className = "demo-preview-empty";
    empty.textContent = "Esta DEMO todavía no tiene pasos.";
    container.append(empty);
    return;
  }

  const summary = document.createElement("p");
  summary.className = "demo-preview-summary";
  summary.textContent = `${steps.length} pasos · secuencia ejecutada por la API`;
  const list = document.createElement("ol");
  list.className = "demo-preview-list";
  for (const step of [...steps].sort((a, b) => Number(a.orden) - Number(b.orden))) {
    const item = document.createElement("li");
    const title = document.createElement("span");
    title.className = "demo-step-name";
    const commandName = typeof step.comando === "string" ? step.comando.replaceAll("_", " ") : "Comando";
    title.textContent = `Paso ${step.orden} · ${commandName}`;
    const details = document.createElement("small");
    const facts = [];
    if (step.codigo !== null && step.codigo !== undefined && step.codigo !== "" && Number.isFinite(Number(step.codigo))) facts.push(`Código ${step.codigo}`);
    if (step.duracion_ms !== null && step.duracion_ms !== undefined && step.duracion_ms !== "" && Number.isFinite(Number(step.duracion_ms))) facts.push(`${step.duracion_ms} ms`);
    if (step.pausa_ms !== null && step.pausa_ms !== undefined && step.pausa_ms !== "" && Number.isFinite(Number(step.pausa_ms))) facts.push(`pausa ${step.pausa_ms} ms`);
    details.textContent = facts.join(" · ");
    item.append(title, details);
    list.append(item);
  }
  container.append(summary, list);
}
