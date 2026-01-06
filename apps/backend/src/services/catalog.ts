import { db } from "../db/index.ts";
import type { Product, Segment, StockStatus } from "@totem/types";
import { imageStorage } from "./image-storage.ts";

type CreateProductData = {
  id: string;
  period_id: string;
  segment: Segment;
  category: string;
  name: string;
  description: string | null;
  price: number;
  installments: number | null;
  image_main_id: string;
  image_specs_id: string | null;
  created_by: string;
};

function formatProduct(row: any): Product {
  return {
    ...row,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export const CatalogService = {
  getAll: (): Product[] => {
    const rows = db
      .prepare("SELECT * FROM catalog_products ORDER BY updated_at DESC")
      .all() as any[];
    return rows.map(formatProduct);
  },

  getByPeriod: (periodId: string): Product[] => {
    const rows = db
      .prepare(
        "SELECT * FROM catalog_products WHERE period_id = ? ORDER BY category, name",
      )
      .all(periodId) as any[];
    return rows.map(formatProduct);
  },

  getActiveBySegment: (segment: Segment): Product[] => {
    const rows = db
      .prepare(
        `SELECT p.* FROM catalog_products p
         JOIN catalog_periods per ON p.period_id = per.id
         WHERE per.status = 'active'
           AND p.segment = ?
           AND p.is_active = 1
           AND p.stock_status != 'out_of_stock'
         ORDER BY p.category, p.name`,
      )
      .all(segment) as any[];
    return rows.map(formatProduct);
  },

  getById: (id: string): Product | null => {
    const row = db
      .prepare("SELECT * FROM catalog_products WHERE id = ?")
      .get(id) as any;
    return row ? formatProduct(row) : null;
  },

  create: (data: CreateProductData): Product => {
    db.prepare(
      `INSERT INTO catalog_products (
        id, period_id, segment, category, name, description, price, installments,
        image_main_id, image_specs_id, is_active, stock_status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'in_stock', ?)`,
    ).run(
      data.id,
      data.period_id,
      data.segment,
      data.category,
      data.name,
      data.description,
      data.price,
      data.installments,
      data.image_main_id,
      data.image_specs_id,
      data.created_by,
    );
    return CatalogService.getById(data.id)!;
  },

  update: (
    id: string,
    updates: Partial<
      Pick<
        Product,
        | "name"
        | "description"
        | "price"
        | "installments"
        | "category"
        | "is_active"
        | "stock_status"
      >
    >,
  ): Product => {
    const entries = Object.entries(updates);
    if (entries.length === 0) {
      return CatalogService.getById(id)!;
    }
    const fields = entries.map(([k]) => `${k} = ?`).join(", ");
    const values: (string | number | StockStatus | null)[] = entries.map(
      ([, v]) => v as string | number | StockStatus | null,
    );
    db.prepare(
      `UPDATE catalog_products SET ${fields}, updated_at = unixepoch('now', 'subsec') * 1000 WHERE id = ?`,
    ).run(...values, id);
    return CatalogService.getById(id)!;
  },

  bulkUpdate: (
    ids: string[],
    updates: Partial<Pick<Product, "is_active" | "stock_status">>,
  ): number => {
    const entries = Object.entries(updates);
    if (entries.length === 0 || ids.length === 0) return 0;

    const fields = entries.map(([k]) => `${k} = ?`).join(", ");
    const values = entries.map(([, v]) => v);
    const placeholders = ids.map(() => "?").join(",");

    const stmt = db.prepare(
      `UPDATE catalog_products SET ${fields}, updated_at = unixepoch('now', 'subsec') * 1000 WHERE id IN (${placeholders})`,
    );
    const result = stmt.run(...values, ...ids);
    return result.changes;
  },

  updateImages: async (
    id: string,
    mainId?: string,
    specsId?: string,
  ): Promise<Product> => {
    const existing = CatalogService.getById(id);
    if (!existing) {
      throw new Error("Product not found");
    }

    // Delete old images if being replaced
    if (mainId && existing.image_main_id) {
      await imageStorage.delete(existing.image_main_id);
    }
    if (specsId && existing.image_specs_id) {
      await imageStorage.delete(existing.image_specs_id);
    }

    if (mainId && specsId) {
      db.prepare(
        `UPDATE catalog_products SET image_main_id = ?, image_specs_id = ?, updated_at = unixepoch('now', 'subsec') * 1000 WHERE id = ?`,
      ).run(mainId, specsId, id);
    } else if (mainId) {
      db.prepare(
        `UPDATE catalog_products SET image_main_id = ?, updated_at = unixepoch('now', 'subsec') * 1000 WHERE id = ?`,
      ).run(mainId, id);
    } else if (specsId) {
      db.prepare(
        `UPDATE catalog_products SET image_specs_id = ?, updated_at = unixepoch('now', 'subsec') * 1000 WHERE id = ?`,
      ).run(specsId, id);
    }
    return CatalogService.getById(id)!;
  },

  delete: async (id: string): Promise<void> => {
    const product = CatalogService.getById(id);
    if (product) {
      // Clean up associated images
      await imageStorage.delete(product.image_main_id);
      if (product.image_specs_id) {
        await imageStorage.delete(product.image_specs_id);
      }
    }
    db.prepare("DELETE FROM catalog_products WHERE id = ?").run(id);
  },

  getAvailableCategories: (segment?: Segment): string[] => {
    const query = segment
      ? `SELECT DISTINCT p.category FROM catalog_products p
         JOIN catalog_periods per ON p.period_id = per.id
         WHERE per.status = 'active'
           AND p.segment = ?
           AND p.is_active = 1
           AND p.stock_status != 'out_of_stock'
         ORDER BY p.category`
      : `SELECT DISTINCT p.category FROM catalog_products p
         JOIN catalog_periods per ON p.period_id = per.id
         WHERE per.status = 'active'
           AND p.is_active = 1
           AND p.stock_status != 'out_of_stock'
         ORDER BY p.category`;

    const rows = segment
      ? (db.prepare(query).all(segment) as Array<{ category: string }>)
      : (db.prepare(query).all() as Array<{ category: string }>);

    return rows.map((r) => r.category);
  },
};
