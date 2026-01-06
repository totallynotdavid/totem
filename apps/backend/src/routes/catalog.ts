import { Hono } from "hono";
import { CatalogService } from "../services/catalog.ts";
import { PeriodService } from "../services/periods.ts";
import { BulkImportService } from "../services/bulk-import.ts";
import { extractProductData } from "../services/vision-extractor.ts";
import { imageStorage } from "../services/image-storage.ts";
import { logAction } from "../services/audit.ts";
import { requireRole } from "../middleware/auth.ts";

const catalog = new Hono();

// Middleware: write operations require admin, developer, or supervisor
const requireCatalogWrite = requireRole("admin", "developer", "supervisor");

// List products - optionally filter by period or segment
catalog.get("/", (c) => {
  const periodId = c.req.query("period_id");
  const segment = c.req.query("segment");

  // If period specified, get products for that period
  if (periodId) {
    return c.json(CatalogService.getByPeriod(periodId));
  }

  // If segment specified without period, get active period products
  if (segment && (segment === "fnb" || segment === "gaso")) {
    return c.json(CatalogService.getActiveBySegment(segment));
  }

  // Default: all products
  return c.json(CatalogService.getAll());
});

// Create product with image
catalog.post("/", requireCatalogWrite, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const file = body.image as File;
  if (!file) {
    return c.json({ error: "Image required" }, 400);
  }

  const periodId = body.period_id as string;
  const segment = body.segment as string;
  const category = body.category as string;
  const name = body.name as string;
  const price = body.price as string;
  const installments = body.installments as string;

  if (!periodId || !segment || !category || !name || !price) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Verify period exists and is draft
  const period = PeriodService.getById(periodId);
  if (!period) {
    return c.json({ error: "Período no encontrado" }, 404);
  }
  if (period.status !== "draft") {
    return c.json(
      { error: "Solo se pueden agregar productos a períodos en borrador" },
      400,
    );
  }

  // Store main image
  const buffer = Buffer.from(await file.arrayBuffer());
  const imageMainId = await imageStorage.store(buffer);

  // Handle specs image if provided
  let imageSpecsId: string | null = null;
  const specsFile = body.specsImage as File | undefined;
  if (specsFile) {
    const specsBuffer = Buffer.from(await specsFile.arrayBuffer());
    imageSpecsId = await imageStorage.store(specsBuffer);
  }

  const id = `${segment.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const product = CatalogService.create({
    id,
    period_id: periodId,
    segment: segment as any,
    category,
    name,
    description: (body.description as string) || null,
    price: parseFloat(price),
    installments: installments ? parseInt(installments, 10) : null,
    image_main_id: imageMainId,
    image_specs_id: imageSpecsId,
    created_by: user.id,
  });

  logAction(user.id, "create_product", "product", id, {
    name,
    segment,
    category,
    period_id: periodId,
  });

  return c.json(product);
});

// Update product
catalog.patch("/:id", requireCatalogWrite, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const updates = await c.req.json();

  // Validate updates
  if (updates.name !== undefined && typeof updates.name !== "string") {
    return c.json({ error: "Invalid name" }, 400);
  }
  if (updates.name !== undefined && updates.name.trim().length === 0) {
    return c.json({ error: "Name cannot be empty" }, 400);
  }
  if (updates.category !== undefined && typeof updates.category !== "string") {
    return c.json({ error: "Invalid category" }, 400);
  }
  if (updates.category !== undefined && updates.category.trim().length === 0) {
    return c.json({ error: "Category cannot be empty" }, 400);
  }
  if (
    updates.price !== undefined &&
    (typeof updates.price !== "number" || updates.price <= 0)
  ) {
    return c.json({ error: "Price must be a positive number" }, 400);
  }
  if (updates.installments !== undefined && updates.installments !== null) {
    if (typeof updates.installments !== "number" || updates.installments <= 0) {
      return c.json({ error: "Installments must be a positive number" }, 400);
    }
  }
  if (updates.stock_status !== undefined) {
    if (
      !["in_stock", "low_stock", "out_of_stock"].includes(updates.stock_status)
    ) {
      return c.json({ error: "Invalid stock status" }, 400);
    }
  }
  if (updates.is_active !== undefined) {
    if (updates.is_active !== 0 && updates.is_active !== 1) {
      return c.json({ error: "is_active must be 0 or 1" }, 400);
    }
  }

  const product = CatalogService.update(id, updates);

  logAction(user.id, "update_product", "product", id, updates);

  return c.json({ success: true, product });
});

// Update product images
catalog.post("/:id/images", requireCatalogWrite, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const body = await c.req.parseBody();

  const existingProduct = CatalogService.getById(id);
  if (!existingProduct) {
    return c.json({ error: "Product not found" }, 404);
  }

  // Check if product's period is still draft
  const period = PeriodService.getById(existingProduct.period_id);
  if (period && period.status !== "draft") {
    return c.json(
      { error: "Solo se pueden editar productos en períodos en borrador" },
      400,
    );
  }

  const mainFile = body.mainImage as File | undefined;
  const specsFile = body.specsImage as File | undefined;

  if (!mainFile && !specsFile) {
    return c.json({ error: "At least one image required" }, 400);
  }

  let mainId: string | undefined;
  let specsId: string | undefined;

  if (mainFile) {
    const buffer = Buffer.from(await mainFile.arrayBuffer());
    mainId = await imageStorage.store(buffer);
  }

  if (specsFile) {
    const buffer = Buffer.from(await specsFile.arrayBuffer());
    specsId = await imageStorage.store(buffer);
  }

  const product = CatalogService.updateImages(id, mainId, specsId);

  logAction(user.id, "update_product_images", "product", id, {
    mainImage: !!mainFile,
    specsImage: !!specsFile,
  });

  return c.json({ success: true, product });
});

// Bulk update products
catalog.post("/bulk-update", requireCatalogWrite, async (c) => {
  const user = c.get("user");
  const { productIds, updates } = await c.req.json();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return c.json({ error: "productIds must be a non-empty array" }, 400);
  }

  if (!updates || typeof updates !== "object") {
    return c.json({ error: "updates object required" }, 400);
  }

  // Validate bulk updates (only allow stock_status and is_active)
  const allowedFields = ["stock_status", "is_active"];
  const updateKeys = Object.keys(updates);
  const invalidKeys = updateKeys.filter((k) => !allowedFields.includes(k));

  if (invalidKeys.length > 0) {
    return c.json(
      { error: `Invalid fields for bulk update: ${invalidKeys.join(", ")}` },
      400,
    );
  }

  if (updates.stock_status !== undefined) {
    if (
      !["in_stock", "low_stock", "out_of_stock"].includes(updates.stock_status)
    ) {
      return c.json({ error: "Invalid stock status" }, 400);
    }
  }

  if (updates.is_active !== undefined) {
    if (updates.is_active !== 0 && updates.is_active !== 1) {
      return c.json({ error: "is_active must be 0 or 1" }, 400);
    }
  }

  const count = CatalogService.bulkUpdate(productIds, updates);

  logAction(user.id, "bulk_update_products", "product", null, {
    count,
    productIds,
    updates,
  });

  return c.json({ success: true, count });
});

// Delete product
catalog.delete("/:id", requireCatalogWrite, (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  CatalogService.delete(id);

  logAction(user.id, "delete_product", "product", id);

  return c.json({ success: true });
});

// Extract product data from images (AI preview)
catalog.post("/extract-preview", requireCatalogWrite, async (c) => {
  const body = await c.req.parseBody();

  const mainImage = body.mainImage as File;
  if (!mainImage) {
    return c.json({ error: "Main image required" }, 400);
  }

  const specsImage = body.specsImage as File | undefined;

  try {
    // Convert images to buffers
    const mainBuffer = Buffer.from(await mainImage.arrayBuffer());
    const specsBuffer = specsImage
      ? Buffer.from(await specsImage.arrayBuffer())
      : undefined;

    // Extract data using vision AI
    const extractedData = await extractProductData(mainBuffer, specsBuffer);

    return c.json(extractedData);
  } catch (error) {
    console.error("Vision extraction error:", error);
    return c.json({ error: "Failed to extract data from images" }, 500);
  }
});

// Bulk import from CSV
catalog.post("/bulk", requireCatalogWrite, async (c) => {
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
