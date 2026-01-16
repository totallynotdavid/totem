import type { CategoryMetadata } from "../helpers/category-metadata.ts";

export function buildExtractCategoryPrompt(
  categoryMetadata: CategoryMetadata[],
  availableCategories: string[],
): string {
  const categoryList = categoryMetadata
    .map((cat) => {
      const parts = [`**${cat.key}**`];
      const isAvailable = availableCategories.includes(cat.key);

      if (cat.aliases.length > 0) {
        parts.push(`aliases: ${cat.aliases.join(", ")}`);
      }

      const status = isAvailable
        ? "(Disponible)"
        : "(No disponible o sin stock)";

      return `- ${parts.join(" | ")} ${status}`;
    })
    .join("\n");

  const availableList = availableCategories.join(", ");

  return `Analiza qué categoría de productos quiere el usuario.
  
CONTEXTO:
- Solo podemos vender estas categorías AHORA: [${availableList}]
- Conocemos otras categorías (como Tablets), pero si no están en la lista anterior, NO TENEMOS STOCK.

INSTRUCCIONES:
1. Identifica la categoría del producto que pide el usuario.
2. Si pide un modelo específico (ej. "S24 Ultra", "iPhone 15"), extráelo en "requestedProduct".
3. Si la categoría está en nuestra lista de conocidas, devuélvela (aunque no haya stock).
4. Si la categoría es totalmente desconocida o ajena al negocio (ej. "Comida", "Ropa"), devuelve null.

CATEGORÍAS CONOCIDAS:
${categoryList}

EJEMPLOS:
- "Quiero una laptop" -> {"category": "laptops"}
- "Tienen tablets?" -> {"category": "tablets"} (Aunque no tengamos stock, identifícalo)
- "Busco el Galaxy S24" -> {"category": "celulares", "requestedProduct": "Galaxy S24"}
- "Venden zapatillas?" -> {"category": null}

JSON: {"category": "key" | null, "requestedProduct": string | null}`;
}
