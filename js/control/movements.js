const clean = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const DIRECTION_GROUPS = {
  drive: {
    forward: ["AVANZAR", "ADELANTE"],
    backward: ["RETROCEDER", "ATRAS"],
    left: ["GIRARIZQUIERDA", "IZQUIERDA"],
    right: ["GIRARDERECHA", "DERECHA"],
  },
};

const ARROWS = { forward: "▲", backward: "▼", left: "◀", right: "▶" };

export function commandForDirection(commands, direction, group = "drive") {
  const names = DIRECTION_GROUPS[group]?.[direction] ?? [];
  return commands.find((command) => names.includes(clean(command.nombre)) && Number(command.activo) === 1) ?? null;
}

export function renderJoystickLegend(container, commands, group) {
  const directions = ["forward", "backward", "left", "right"];
  container.replaceChildren();
  for (const direction of directions) {
    const command = commandForDirection(commands, direction, group);
    const item = document.createElement("span");
    item.className = "stick-map-item";
    item.dataset.available = String(Boolean(command));
    const arrow = document.createElement("span");
    arrow.className = "stick-map-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = ARROWS[direction];
    const label = document.createElement("span");
    label.className = "stick-map-label";
    label.textContent = command ? command.nombre.replaceAll("_", " ") : "No disponible";
    item.append(arrow, label);
    container.append(item);
  }
}

export function stopCommand(commands) {
  return commands.find((command) => clean(command.nombre) === "DETENER" && Number(command.activo) === 1) ?? null;
}

export function isDriveCommand(command) {
  const name = clean(command?.nombre);
  return name === "AVANZAR" || name === "ADELANTE" || name === "RETROCEDER" || name === "ATRAS"
    || name === "GIRARIZQUIERDA" || name === "IZQUIERDA" || name === "GIRARDERECHA" || name === "DERECHA"
    || name === "DETENER";
}

export function renderAuxiliaryCommands(container, commands, onCommand) {
  container.replaceChildren();
  const available = commands.filter((command) => Number(command.activo) === 1 && !isDriveCommand(command));
  if (!available.length) {
    const empty = document.createElement("p");
    empty.className = "subtle-message";
    empty.textContent = "No hay acciones extra activas para este vehículo.";
    container.append(empty);
    return;
  }

  const glyphs = { SUBIRPALA: "↑", BAJARPALA: "↓", PALAIZQUIERDA: "↶", PALADERECHA: "↷", ACTIVARSONIDO: "♫", ACTIVARMODO: "✦", ENCENDERLED: "☼" };
  for (const command of available) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-button";
    button.dataset.commandId = String(command.id_comando);
    button.dataset.state = "idle";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${command.nombre}, código ${command.codigo}`);
    button.setAttribute("aria-busy", "false");
    const glyph = document.createElement("span");
    glyph.className = "command-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = glyphs[clean(command.nombre)] ?? "✧";
    const text = document.createElement("span");
    text.className = "command-name";
    text.textContent = command.nombre.replaceAll("_", " ");
    const meta = document.createElement("span");
    meta.className = "command-meta";
    meta.textContent = `código ${command.codigo}`;
    text.append(meta);
    button.append(glyph, text);
    button.addEventListener("click", () => onCommand(command));
    container.append(button);
  }
}
