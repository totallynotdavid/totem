/**
 * LLM System Prompts - Optimized for precision and minimal context
 *
 * Structure: Role → Task → Constraints → Output
 * No examples (prevents overfitting), no tone in classification prompts
 */

// Minimal context for generative prompts only
const CORE_CONTEXT = `Totem: vende electrodomésticos (celulares, cocinas, refrigeradoras, laptops, TVs, termas) en Lima/Callao.
Pago: cuotas mensuales en recibo de Calidda.`;

/**
 * Intent classification - pure, no personality
 */
export function buildClassifyIntentPrompt(): string {
    return `Clasifica la intención del mensaje en español.

CATEGORÍAS:
- "yes": afirmación (sí, claro, ok, dale, correcto)
- "no": negación (no, nada, no gracias, paso)
- "question": pregunta (contiene ? o interrogativos: qué/cuánto/cómo/dónde)
- "product_selection": menciona producto específico (marca/modelo) o posición (el primero, el 2)
- "unclear": todo lo demás

JSON: {"intent": "yes"|"no"|"question"|"product_selection"|"unclear"}`;
}

/**
 * Category extraction - focused on single entity type
 */
export function buildExtractEntityPrompt(
    entity: string,
    availableCategories?: string[],
): string {
    if (entity === "product_category" && availableCategories?.length) {
        return `Extrae la categoría de producto mencionada.

CATEGORÍAS VÁLIDAS: ${availableCategories.join(", ")}

Mapea marcas/términos coloquiales a categorías (ej: iPhone→celulares, refri→refrigeradoras).
Si no hay coincidencia, devuelve null.

JSON: {"category": "categoria_exacta" | null}`;
    }

    return `Extrae "${entity}" del mensaje. JSON: {"value": string | null}`;
}

/**
 * Question answering - minimal context, clear escalation rules
 */
export function buildAnswerQuestionPrompt(context: {
    segment?: string;
    creditLine?: number;
    state?: string;
}): string {
    const creditInfo = context.creditLine
        ? `Cliente: S/ ${context.creditLine} disponibles.`
        : "";

    return `${CORE_CONTEXT}
${creditInfo}

PUEDES RESPONDER: funcionamiento (cuotas en recibo), productos disponibles, zonas (Lima/Callao), proceso de compra.
ESCALAR (requiresHuman: true): montos exactos, tasas de interés, garantías de aprobación, reclamos, descuentos.

Responde breve (2 líneas máx), cierra preguntando por producto de interés.

JSON: {"answer": "respuesta", "requiresHuman": boolean}`;
}

/**
 * Alternative suggestion - no examples, relies on temperature
 */
export function buildSuggestAlternativePrompt(
    requestedCategory: string,
    availableCategories: string[],
): string {
    return `${CORE_CONTEXT}

Cliente pidió "${requestedCategory}" (no disponible).
Opciones: ${availableCategories.join(", ")}

Sugiere alternativa relevante o ofrece ver todas. Breve (1-2 líneas).

JSON: {"suggestion": "respuesta"}`;
}

/**
 * Backlog response - sanitized input, human-readable time
 */
export function buildHandleBacklogPrompt(
    message: string,
    ageMinutes: number,
): string {
    // Sanitize message to prevent prompt injection
    const sanitized = message.replace(/["\n\r]/g, " ").slice(0, 200);

    // Format time naturally
    const timeAgo =
        ageMinutes < 60
            ? `${ageMinutes} minutos`
            : ageMinutes < 120
                ? "más de una hora"
                : `${Math.floor(ageMinutes / 60)} horas`;

    return `${CORE_CONTEXT}

Mensaje recibido hace ${timeAgo}: "${sanitized}"

Genera respuesta que: reconoce brevemente la demora, responde al mensaje, continúa la conversación.
Breve (2-3 líneas), natural, sin emojis excesivos.

JSON: {"response": "respuesta"}`;
}

// Legacy export for backwards compatibility
export const SALES_CONTEXT = CORE_CONTEXT;
