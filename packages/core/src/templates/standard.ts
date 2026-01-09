// Human-like message variations to avoid robotic repetition
// Each template has 3-5 variants that rotate per conversation session

export const GREETING = [
  "¡Hola! 👋 Soy de Cálidda. ¿Eres el titular de tu servicio de gas natural?",
  "Hola, te escribe Cálidda. ¿El servicio de gas está a tu nombre?",
  "¡Qué tal! Soy de Cálidda. ¿Tu servicio de gas está a tu nombre?",
  "Hola 👋 Soy de Cálidda. ¿Tu servicio de gas está a tu nombre?",
];

export const GREETING_RETURNING = (category: string) => [
  `¡Hola de nuevo! 😊 Veo que anteriormente te interesaron nuestros ${category}. ¿Quieres continuar donde lo dejamos?`,
  `Hola otra vez 👋 La última vez preguntaste por ${category}. ¿Te interesa ese u otro producto?`,
  `¡Qué bueno verte de nuevo! ¿Todavía te interesan los ${category}?`,
];

export const CONFIRM_CLIENT_YES = [
  "Perfecto 😊 ¿Me brindas el número de tu DNI?",
  "Genial. Por favor, indícame tu DNI para verificar tus beneficios.",
  "Excelente. Necesito tu DNI para consultar tu línea de crédito.",
  "Genial, ¿me brindas el número de tu DNI?",
];

export const CONFIRM_CLIENT_NO = [
  "Entiendo. Por el momento solo atendemos a clientes de Cálidda con servicio activo. ¡Gracias por tu interés! 🙏",
  "Te agradezco el interés 😊 Actualmente trabajamos solo con clientes de Cálidda. ¡Hasta pronto!",
  "Gracias por escribir. Por ahora atendemos únicamente a clientes con servicio Cálidda activo.",
];

export const INVALID_DNI = [
  "¿Podrías verificar tu DNI? Parece que falta algún número.",
  "Revísalo bien, por favor. El DNI no parece válido.",
  "El DNI no parece válido 😔. ¿Podrías verificarlo?",
];

// Categorized variants for context-aware selection
export const CHECKING_SYSTEM = {
  standard: [
    "Estoy revisando tu información, dame un momento 😊",
    "Déjame consultarlo en nuestro sistema 😊",
    "Dame un momento mientras reviso tu información.",
  ],
  patient: [
    "Ya casi termino de revisar tu información. Dame un segundo más. 🙏",
    "Gracias por la espera 😊 Estoy terminando la consulta.",
    "Casi listo. Estoy esperando la respuesta. 🙏",
  ],
  empathetic: [
    "Entiendo que quieres avanzar rápido. Estoy en ello 😊",
    "Sé que estás esperando. Estoy consultando ahora mismo.",
    "Ya casi. Estoy terminando de verificar tu info. 🙏",
  ],
};

export const NOT_ELIGIBLE = [
  "Disculpa, revisé tu caso y por ahora no podemos avanzar según nuestras políticas. Si tienes dudas, escríbeme y veo cómo ayudarte. 😔",
  "Lamentablemente no podemos proceder en este momento según las políticas internas de Cálidda 😢. ¿Hay algo más en lo que pueda ayudarte?",
  "Gracias por tu interés. Actualmente no podemos ofrecerte el servicio según nuestras políticas. 😔",
];

export const ASK_AGE = (name: string) => [
  `Perfecto ${name} 😊 Para continuar, ¿cuántos años tienes?`,
  `${name}, necesito confirmar tu edad. ¿Cuántos años tienes?`,
  `Dale ${name}. ¿Me confirmas tu edad?`,
];

export const INVALID_AGE = [
  "Por favor, indícame tu edad en números (ejemplo: 35).",
  "Necesito tu edad en números. ¿Cuántos años tienes?",
  "Escribe tu edad solo con números, por favor 😊",
];

export const AGE_TOO_LOW = (minAge: number) => [
  `Disculpa, para este programa necesitas tener al menos ${minAge} años según nuestras políticas. 😔`,
  `Lamentablemente la política requiere mínimo ${minAge} años para este servicio.`,
  `Según nuestras políticas, necesitas ${minAge} años o más para acceder al beneficio.`,
];

export const UNCLEAR_RESPONSE = [
  "Disculpa, no entendí bien. ¿Podrías explicarlo de nuevo?",
  "No logré entender 😅 ¿Podrías decirlo de otra forma?",
  "Perdón, no capté eso. ¿Me lo explicas nuevamente?",
];

export const ASK_CLARIFICATION = [
  "¿Podrías ser más específico? Por ejemplo: celular, cocina, laptop, etc.",
  "¿Qué tipo de producto buscas? 😊 Tenemos celulares, cocinas, laptops, refrigeradoras...",
  "¿En qué producto estás pensando? Celular, laptop, TV, cocina...",
];

export const NO_STOCK = [
  "Lo siento, actualmente no tenemos disponibilidad en esa categoría. ¿Te interesa algo más? 😊",
  "Disculpa, por ahora no tenemos stock en eso. ¿Quieres ver otras opciones?",
  "Ahora mismo no tenemos esa categoría disponible. ¿Te gustaría ver algo diferente?",
];

export const SESSION_TIMEOUT_CLOSING = [
  "Noto que ha pasado un tiempo. Si necesitas algo más, no dudes en escribirme nuevamente. ¡Hasta pronto! 👋",
  "Veo que pasó un rato 😊 Cuando quieras retomar, aquí estaré. ¡Saludos!",
  "Ha pasado un tiempo. Si regresas, con gusto te atiendo. ¡Hasta luego! 👋",
];

export const IMAGE_REJECTED = [
  "Por tu seguridad y privacidad, solo aceptamos información por texto escrito. Por favor, escribe tu DNI.",
  "Por seguridad, necesito que escribas tu DNI en lugar de enviarlo en imagen 😊",
  "Para proteger tu información, escribe tu DNI como texto.",
];

export const NON_TEXT_REJECTED = [
  "En este momento solo puedo procesar mensajes de texto. ¿En qué puedo ayudarte? 😊",
  "Por ahora solo leo mensajes de texto. ¿Qué necesitas?",
  "Manejo solo texto por el momento. ¿Qué consulta tienes?",
];

export const DNI_NOT_AVAILABLE = [
  "Entiendo 😊 Puedo esperar mientras lo buscas, o si prefieres, te contacto más tarde. ¿Qué prefieres?",
  "Sin problema. ¿Buscas tu DNI o prefieres que te contacte después?",
  "Tranquilo. ¿Lo buscas ahora o te llamo más tarde?",
];

export const DNI_WAITING = {
  standard: [
    "Sin problema 😊 Tómate tu tiempo. Cuando tengas tu DNI, escríbelo aquí.",
    "Dale nomás, no hay apuro. Escríbelo cuando lo tengas.",
    "Tranquilo, aquí te espero. Mándalo cuando esté listo.",
  ],
  patient: [
    "Tómate el tiempo que necesites. Aquí estaré 😊",
    "Sin apuro, cuando puedas me lo mandas.",
    "Con calma, no hay prisa.",
  ],
};
