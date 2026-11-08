export function errorMessage(error) {
  if (error?.name === "AbortError") return "La solicitud tardó demasiado.";
  return "No fue posible completar la solicitud. Revisa la conexión e inténtalo de nuevo.";
}
