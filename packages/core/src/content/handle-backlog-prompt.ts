export function buildHandleBacklogPrompt(
  message: string,
  ageMinutes: number,
): string {
  const sanitized = message.replace(/["\n\r]/g, " ").slice(0, 200);
  const timeAgo =
    ageMinutes < 60
      ? `${ageMinutes} minutos`
      : ageMinutes < 120
        ? "más de una hora"
        : `${Math.floor(ageMinutes / 60)} horas`;

  return `Totem vende electrodomésticos en Lima/Callao. Pago: cuotas mensuales en recibo de Calidda.

Mensaje recibido hace ${timeAgo}: "${sanitized}"

Responde: reconoce demora brevemente, responde al mensaje, continúa conversación.
2-3 líneas máximo, natural.

JSON: {"response": "respuesta"}`;
}
