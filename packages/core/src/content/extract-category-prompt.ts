export function buildExtractCategoryPrompt(
  availableCategories: string[],
): string {
  return `Extrae la categoría de producto mencionada.

CATEGORÍAS VÁLIDAS: ${availableCategories.join(", ")}

Mapea términos a categorías:
- Marcas celular (Samsung, iPhone, Xiaomi, Galaxy) → celulares
- "refri", "refrigeradora", "frigo" → refrigeradoras
- "tele", "TV", "televisor" → televisores
- "laptop", "portátil", "computadora" → laptops
- "cocina", "estufa" → cocinas
- "terma", "calentador" → termas

Devuelve la categoría exacta de la lista o null si no hay coincidencia.

JSON: {"category": "categoria" | null}`;
}
