import type { Database } from "bun:sqlite";
import bcrypt from "bcryptjs";
import { CatalogService } from "../services/catalog.ts";
import type { Segment } from "@totem/types";

const CATALOG_SEED = [
  {
    image_main_id: "e4976160c1e346b8",
    category: "celulares",
    name: "Cocinetta 2Q A gas",
    price: 1799,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "51c9756bdb3b4f7a",
    category: "celulares",
    name: "Samsung Galaxy A56",
    price: 3399,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "7de286fb4a9a4f19",
    category: "fusion",
    name: "Cocineta 2Q A gas",
    price: 2199,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "71ea846b26174659",
    category: "fusion",
    name: "Cocina de elección",
    price: 2899,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "1d6fdc9cbee04bc3",
    category: "fusion",
    name: "Cocinetta 2Q A gas",
    price: 2399,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "67d0f026be9142ff",
    category: "fusion",
    name: "Mabe Cocina 4Q",
    price: 2999,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "77bcf7c50c054af4",
    category: "fusion",
    name: "Mabe Refrigeradora 187L",
    price: 3099,
    installments: 18,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "150719b93c38461e",
    category: "fusion",
    name: "Cocineta 2Q A gas",
    price: 3499,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "b5e9a6deab044c42",
    category: "fusion",
    name: "Mabe Cocina 4Q",
    price: 4999,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "d6ce52ce24204be6",
    category: "fusion",
    name: "Termo 5.5L A gas",
    price: 3999,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "604dc5df458d4362",
    category: "fusion",
    name: "Mabe Cocina",
    price: 3199,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "6ce6f405a6144625",
    category: "fusion",
    name: "Holi Termo a gas 5.5L",
    price: 3299,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "99a1b24c11fa4f40",
    category: "fusion",
    name: 'Hisense Smart TV 55"',
    price: 3199,
    installments: 18,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "ed3837d5ca554799",
    category: "lavadoras",
    name: "LG Lavadora 16Kg WT16BVTB",
    price: 2699,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "d0dc2578457a4e44",
    category: "lavadoras",
    name: null,
    price: null,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "24814848bf2c4ee0",
    category: "refrigeradoras",
    name: null,
    price: null,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "222a3c90f0f345c1",
    category: "refrigeradoras",
    name: null,
    price: null,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "05b04eb8ce3e4e4b",
    category: "tv",
    name: null,
    price: null,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "e1249ad5545a4bc2",
    category: "tv",
    name: 'JVC Smart Tv 43" LT-43KM348',
    price: 1799,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "1cc43a6627cb4389",
    category: "tv",
    name: 'JVC Smart Tv 86" LT-86KB738',
    price: 4999,
    installments: null,
    description: null,
    segment: "gaso",
  },
  {
    image_main_id: "5abbad939a8d4fd3",
    category: "tv",
    name: "Mabe Cocina",
    price: 4999,
    installments: 18,
    description: null,
    segment: "gaso",
  },
];

export async function seedDatabase(db: Database) {
  const adminCheck = db
    .prepare("SELECT count(*) as count FROM users")
    .get() as { count: number };

  if (adminCheck.count === 0) {
    const adminId = crypto.randomUUID();
    const hash = bcrypt.hashSync("admin123", 10);

    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, name, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(adminId, "admin", hash, "admin", "Administrador", null);

    console.log("Admin user created (username: admin, password: admin123)");

    // Create sample sales agents for testing
    const agent1Id = crypto.randomUUID();
    const agent2Id = crypto.randomUUID();
    const agentHash = bcrypt.hashSync("agent123", 10);

    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, name, phone_number, is_available, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      agent1Id,
      "agent1",
      agentHash,
      "sales_agent",
      "María González",
      "+51914509251",
      1,
      adminId,
    );

    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, name, phone_number, is_available, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      agent2Id,
      "agent2",
      agentHash,
      "sales_agent",
      "Carlos Pérez",
      "+51919284799",
      1,
      adminId,
    );

    console.log("Sample agents created (agent1/agent2, password: agent123)");

    // Create sample conversations for testing
    const now = Date.now();
    const testPhone = "+51999888777";
    const assignedPhone = "+51999888888";

    db.prepare(
      `INSERT INTO conversations (phone_number, client_name, dni, segment, credit_line, current_state, status, is_simulation, last_activity_at, context_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      testPhone,
      "Juan Pérez",
      "12345678",
      "fnb",
      5000,
      "OFFER_PRODUCTS",
      "active",
      0,
      now,
      JSON.stringify({ offeredCategory: "celulares" }),
    );

    db.prepare(
      `INSERT INTO conversations (phone_number, client_name, dni, segment, credit_line, current_state, status, assigned_agent, assignment_notified_at, is_simulation, last_activity_at, context_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      assignedPhone,
      "Ana Torres",
      "87654321",
      "gaso",
      2500,
      "CLOSING",
      "human_takeover",
      agent1Id,
      now - 2 * 60 * 1000, // 2 minutes ago
      0,
      now,
      JSON.stringify({ purchaseConfirmed: true, offeredCategory: "cocinas" }),
    );

    console.log("Sample conversations created for testing");
  }

  // Seed a default catalog period if none exists
  const periodCheck = db
    .prepare("SELECT count(*) as count FROM catalog_periods")
    .get() as { count: number };

  if (periodCheck.count === 0) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const periodName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    db.prepare(
      `INSERT INTO catalog_periods (id, name, year_month, status, created_by)
       VALUES (?, ?, ?, 'draft', NULL)`,
    ).run(`period-${yearMonth}`, periodName, yearMonth);

    console.log(`Created draft catalog period: ${periodName}`);
  }

  // Ensure we have a period id to use for seeding products
  const nowForPeriod = new Date();
  const yearMonth = `${nowForPeriod.getFullYear()}-${String(nowForPeriod.getMonth() + 1).padStart(2, "0")}`;
  const periodId = `period-${yearMonth}`;

  // If there are no products for the current period, seed from the embedded CATALOG_SEED array
  const productsCount = db
    .prepare(
      "SELECT count(*) as count FROM catalog_products WHERE period_id = ?",
    )
    .get(periodId) as { count: number };

  if (productsCount.count === 0) {
    try {
      for (const entry of CATALOG_SEED) {
        const productId = crypto.randomUUID();
        CatalogService.create({
          id: productId,
          period_id: periodId,
          segment: (entry.segment ?? "gaso") as Segment,
          category: entry.category,
          name: entry.name ?? `${entry.category}`,
          description: entry.description ?? null,
          price: entry.price ?? 0,
          installments: entry.installments ?? null,
          image_main_id: entry.image_main_id,
          image_specs_id: null,
          created_by: null as unknown as string,
        });
      }
      console.log(
        `Seeded ${CATALOG_SEED.length} catalog products from embedded seed data`,
      );
    } catch (err) {
      console.error("Failed to seed catalog from CATALOG_SEED:", err);
    }
  }
}

// Main execution
if (import.meta.main) {
  const { db } = await import("./connection.ts");
  const { initializeDatabase } = await import("./init.ts");

  console.log("Initializing database schema...");
  initializeDatabase(db);

  console.log("Seeding database...");
  await seedDatabase(db);

  console.log("Database setup complete!");
  process.exit(0);
}
