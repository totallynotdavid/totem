import { Hono } from "hono";
import { CatalogService } from "../services/catalog.ts";
import { BulkImportService } from "../services/bulk-import.ts";
import { logAction } from "../services/audit.ts";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const catalog = new Hono();

// List all products
catalog.get("/", (c) => {
  const segment = c.req.query("segment");

  if (segment && (segment === "fnb" || segment === "gaso")) {
    return c.json(CatalogService.getBySegment(segment));
  }

  return c.json(CatalogService.getAll());
});

// Create product with image
catalog.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const file = body.image as File;
  if (!file) {
    return c.json({ error: "Image required" }, 400);
  }

  const segment = body.segment as string;
  const category = body.category as string;
  const name = body.name as string;
  const price = body.price as string;
  const installments = body.installments as string;

  if (!segment || !category || !name || !price) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Optimize image
  const buffer = await file.arrayBuffer();
  const optimized = await sharp(Buffer.from(buffer))
    .resize(1024, 1024, { fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Save file
  const fileName = `${Date.now()}_${file.name.replace(/\.[^.]+$/, "")}.jpg`;
  const dir = path.join(process.cwd(), "data", "uploads", "catalog", segment, category);
  fs.mkdirSync(dir, { recursive: true });
  await Bun.write(path.join(dir, fileName), optimized);

  const id = `${segment.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const product = CatalogService.create({
    id,
    segment: segment as any,
    category,
    name,
    description: (body.description as string) || null,
    price: parseFloat(price),
    installments: installments ? parseInt(installments, 10) : null,
    image_main_path: `catalog/${segment}/${category}/${fileName}`,
    image_specs_path: null,
    created_by: user.id,
  });

  logAction(user.id, "create_product", "product", id, { name, segment, category });

  return c.json(product);
});

// Update product
catalog.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const updates = await c.req.json();

  CatalogService.update(id, updates);

  logAction(user.id, "update_product", "product", id, updates);

  return c.json({ success: true });
});

// Delete product
catalog.delete("/:id", (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  CatalogService.delete(id);

  logAction(user.id, "delete_product", "product", id);

  return c.json({ success: true });
});

// Bulk import from CSV
catalog.post("/bulk", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const csvFile = body.csv as File;
  if (!csvFile) {
    return c.json({ error: "CSV file required" }, 400);
  }

  const text = await csvFile.text();
  const result = await BulkImportService.processCsv(text, user.id);

  logAction(user.id, "bulk_import", "product", null, result);

  return c.json(result);
});

export default catalog;
