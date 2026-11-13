export class DateTimeFormatter {
  static split(value) {
    if (typeof value !== "string" || !value.trim()) {
      return { date: "Fecha no informada", time: "Hora no informada" };
    }
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (!match) return { date: value, time: "Formato de hora no reconocido" };
    const [, year, month, day, hour, minute, second = "00", zone = ""] = match;
    const suffix = zone ? ` ${zone}` : "";
    return {
      date: `${day}/${month}/${year}`,
      time: `${hour}:${minute}:${second}${suffix}`,
    };
  }
}
