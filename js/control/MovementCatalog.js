const clean = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const GROUPS = {
  drive: { forward: ["AVANZAR", "ADELANTE"], backward: ["RETROCEDER", "ATRAS"], left: ["GIRARIZQUIERDA", "IZQUIERDA"], right: ["GIRARDERECHA", "DERECHA"] },
  arm: { forward: ["SUBIRPALA"], backward: ["BAJARPALA"], left: ["PALAIZQUIERDA"], right: ["PALADERECHA"] },
};
const ORDER = ["forward", "backward", "left", "right"];
const ARROWS = { forward: "▲", backward: "▼", left: "◀", right: "▶" };

export class MovementCatalog {
  static commandForDirection(commands, direction, group = "drive") {
    const names = GROUPS[group]?.[direction] ?? [];
    return commands.find((command) => names.includes(clean(command.nombre)) && Number(command.activo) === 1) ?? null;
  }
  static findStop(commands) {
    return commands.find((command) => clean(command.nombre) === "DETENER" && Number(command.activo) === 1) ?? null;
  }
  static isJoystickCommand(command) {
    return ["AVANZAR", "ADELANTE", "RETROCEDER", "ATRAS", "GIRARIZQUIERDA", "IZQUIERDA", "GIRARDERECHA", "DERECHA", "DETENER"].includes(clean(command?.nombre));
  }
  static renderDirectionButtons(container, commands, group, onCommand) {
    container.replaceChildren();
    for (const direction of ORDER) {
      const command = this.commandForDirection(commands, direction, group);
      if (!command) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-button direction-button";
      button.dataset.direction = direction;
      button.dataset.commandId = String(command.id_comando);
      button.dataset.state = "idle";
      button.setAttribute("aria-busy", "false");
      button.setAttribute("aria-label", `${command.nombre.replaceAll("_", " ")}, código ${command.codigo}`);
      const arrow = document.createElement("span");
      arrow.className = "direction-button-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = ARROWS[direction];
      const copy = document.createElement("span");
      copy.className = "direction-button-copy";
      const name = document.createElement("span");
      name.className = "direction-button-name";
      name.textContent = command.nombre.replaceAll("_", " ");
      const code = document.createElement("small");
      code.className = "direction-button-code";
      code.textContent = `código ${command.codigo}`;
      copy.append(name, code);
      button.append(arrow, copy);
      button.addEventListener("click", () => onCommand(command));
      container.append(button);
    }
    if (!container.childElementCount) {
      const empty = document.createElement("p");
      empty.className = "subtle-message";
      empty.textContent = "No hay movimientos direccionales activos en este grupo.";
      container.append(empty);
    }
  }
  static renderAuxiliary(container, commands, onCommand) {
    container.replaceChildren();
    const available = commands.filter((command) => Number(command.activo) === 1 && !this.isJoystickCommand(command));
    const glyphs = { SUBIRPALA: "↑", BAJARPALA: "↓", PALAIZQUIERDA: "↶", PALADERECHA: "↷", ACTIVARSONIDO: "♫", ACTIVARMODO: "✦", ENCENDERLED: "☼" };
    for (const command of available) {
      const button = document.createElement("button"); button.type = "button"; button.className = "command-button";
      button.dataset.commandId = String(command.id_comando); button.dataset.state = "idle"; button.setAttribute("aria-busy", "false");
      button.setAttribute("aria-label", `${command.nombre}, código ${command.codigo}`);
      const icon = document.createElement("span"); icon.className = "command-glyph"; icon.setAttribute("aria-hidden", "true"); icon.textContent = glyphs[clean(command.nombre)] ?? "✧";
      const text = document.createElement("span"); text.className = "command-name"; text.textContent = command.nombre.replaceAll("_", " ");
      const code = document.createElement("span"); code.className = "command-meta"; code.textContent = `código ${command.codigo}`;
      text.append(code); button.append(icon, text); button.addEventListener("click", () => onCommand(command)); container.append(button);
    }
    if (!available.length) { const empty = document.createElement("p"); empty.className = "subtle-message"; empty.textContent = "No hay acciones extra activas para este vehículo."; container.append(empty); }
  }
}
