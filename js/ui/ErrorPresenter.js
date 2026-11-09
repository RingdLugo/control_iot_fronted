export class ErrorPresenter {
  static message(error) {
    return error?.name === "AbortError" ? "La solicitud tardó demasiado." : "No fue posible completar la solicitud. Revisa la conexión e inténtalo de nuevo.";
  }
}
