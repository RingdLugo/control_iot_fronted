export function renderDemos(select, demos) {
  select.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "Elige una DEMO…";
  select.append(prompt);

  const available = demos.filter((demo) => Number(demo.activo) === 1);
  for (const demo of available) {
    const option = document.createElement("option");
    option.value = String(demo.id_demo);
    option.textContent = demo.nombre;
    select.append(option);
  }
  select.disabled = available.length === 0;
  return available.length;
}
