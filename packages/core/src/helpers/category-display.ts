import { CATEGORIES } from "@totem/types";

/**
 * Format category keys into human-readable Spanish list with proper grammar
 * @example formatCategoryList(["celulares", "laptops", "tv"]) → "Celulares, laptops y televisores"
 * @example formatCategoryList(["celulares"]) → "Celulares"
 * @example formatCategoryList([]) → "nuestros productos disponibles"
 */
export function formatCategoryList(categoryKeys: string[]): string {
  if (!categoryKeys || categoryKeys.length === 0) {
    return "nuestros productos disponibles";
  }

  const displayNames = categoryKeys
    .map((key) => {
      const config = CATEGORIES[key as keyof typeof CATEGORIES];
      return config?.display || key;
    })
    .filter(Boolean);

  if (displayNames.length === 0) {
    return "nuestros productos disponibles";
  }

  if (displayNames.length === 1) {
    return displayNames[0] ?? "nuestros productos disponibles";
  }

  if (displayNames.length === 2) {
    return `${displayNames[0]} y ${displayNames[1]}`;
  }

  const last = displayNames.pop();
  return `${displayNames.join(", ")} y ${last}`;
}
