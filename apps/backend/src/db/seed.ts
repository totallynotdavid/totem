import type { Database } from "bun:sqlite";
import bcrypt from "bcryptjs";
import { BASE_PRODUCTS } from "./seed-data/products.ts";
import { BUNDLES_SEED } from "./seed-data/bundles.ts";
import { FNB_BUNDLES_SEED } from "./seed-data/fnb-bundles.ts";

export async function seedDatabase(db: Database) {
  seedUsers(db);
  seedPeriod(db);
  seedProducts(db);
  seedBundles(db);
  seedFnbBundles(db);
}

function seedUsers(db: Database) {
  const check = db.prepare("SELECT count(*) as count FROM users").get() as {
    count: number;
  };
  if (check.count > 0) return;

  const adminId = crypto.randomUUID();
  const adminHash = bcrypt.hashSync("admin123", 10);
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, name, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(adminId, "admin", adminHash, "admin", "Administrador", null);
  console.log("Admin user created (username: admin, password: admin123)");

  const agentHash = bcrypt.hashSync("agent123", 10);
  const agent1Id = crypto.randomUUID();
  const agent2Id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, name, phone_number, is_available, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    `INSERT INTO users (id, username, password_hash, role, name, phone_number, is_available, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

  seedSampleConversations(db, agent1Id);
}

function seedSampleConversations(db: Database, agentId: string) {
  const now = Date.now();

  db.prepare(
    `INSERT INTO conversations (phone_number, client_name, dni, segment, credit_line, status, is_simulation, last_activity_at, context_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "+51999888777",
    "Juan Pérez",
    "12345678",
    "fnb",
    5000,
    "active",
    0,
    now,
    JSON.stringify({
      phase: {
        phase: "offering_products",
        segment: "fnb",
        credit: 5000,
        name: "Juan Pérez",
      },
      metadata: {
        dni: "12345678",
        name: "Juan Pérez",
        segment: "fnb",
        credit: 5000,
        createdAt: now,
        lastActivityAt: now,
      },
    }),
  );

  db.prepare(
    `INSERT INTO conversations (phone_number, client_name, dni, segment, credit_line, status, assigned_agent, assignment_notified_at, is_simulation, last_activity_at, context_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "+51999888888",
    "Ana Torres",
    "87654321",
    "gaso",
    2500,
    "human_takeover",
    agentId,
    now - 2 * 60 * 1000,
    0,
    now,
    JSON.stringify({
      phase: { phase: "closing", purchaseConfirmed: true },
      metadata: {
        dni: "87654321",
        name: "Ana Torres",
        segment: "gaso",
        credit: 2500,
        createdAt: now,
        lastActivityAt: now,
      },
    }),
  );

  // Sample messages for Juan Pérez (+51999888777)
  const juanMessages = [
    { role: "incoming", text: "Hola", timestamp: now - 3600000 },
    {
      role: "outgoing",
      text: "¡Qué tal! Somos Cálidda. ¿Tu servicio de gas está a tu nombre?",
      timestamp: now - 3598000,
    },
    { role: "incoming", text: "Sí", timestamp: now - 3590000 },
    {
      role: "outgoing",
      text: "Genial 😊. Por favor, indícame tu DNI para verificar tus beneficios.",
      timestamp: now - 3588000,
    },
    { role: "incoming", text: "12345678", timestamp: now - 3580000 },
    {
      role: "outgoing",
      text: "Perfecto. Tienes una línea de crédito de S/ 5,000. Te puedo ofrecer productos financieros.",
      timestamp: now - 3575000,
    },
  ];

  const msgStmt = db.prepare(
    `INSERT INTO conversation_messages (phone_number, message_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
  );

  for (const msg of juanMessages) {
    msgStmt.run(
      "+51999888777",
      `msg_${crypto.randomUUID()}`,
      msg.role,
      msg.text,
      msg.timestamp,
    );
  }

  // Sample messages for Ana Torres (+51999888888)
  const anaMessages = [
    { role: "incoming", text: "Buenos días", timestamp: now - 7200000 },
    {
      role: "outgoing",
      text: "¡Hola! Somos Cálidda. ¿El servicio de gas está a tu nombre?",
      timestamp: now - 7198000,
    },
    { role: "incoming", text: "Sí es mío", timestamp: now - 7190000 },
    {
      role: "outgoing",
      text: "Perfecto. Indícame tu DNI para verificar tus beneficios.",
      timestamp: now - 7188000,
    },
    { role: "incoming", text: "87654321", timestamp: now - 7180000 },
    {
      role: "outgoing",
      text: "Tienes una línea de crédito de S/ 2,500! Te puedo mostrar equipos disponibles.",
      timestamp: now - 7175000,
    },
  ];

  for (const msg of anaMessages) {
    msgStmt.run(
      "+51999888888",
      `msg_${crypto.randomUUID()}`,
      msg.role,
      msg.text,
      msg.timestamp,
    );
  }

  console.log("Sample conversations with messages created for testing");
}

function seedPeriod(db: Database) {
  const check = db
    .prepare("SELECT count(*) as count FROM catalog_periods")
    .get() as { count: number };
  if (check.count > 0) return;

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
    `INSERT INTO catalog_periods (id, name, year_month, status, created_by) VALUES (?, ?, ?, 'active', NULL)`,
  ).run(`period-${yearMonth}`, periodName, yearMonth);

  console.log(`Created active catalog period: ${periodName}`);
}

function seedProducts(db: Database) {
  const check = db.prepare("SELECT count(*) as count FROM products").get() as {
    count: number;
  };
  if (check.count > 0) return;

  const stmt = db.prepare(
    `INSERT INTO products (id, name, category, brand, model, specs_json) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const p of BASE_PRODUCTS) {
    stmt.run(
      p.id,
      p.name,
      p.category,
      p.brand,
      p.model,
      JSON.stringify(p.specs),
    );
  }

  console.log(`Seeded ${BASE_PRODUCTS.length} base products`);
}

function seedBundles(db: Database) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodId = `period-${yearMonth}`;

  const check = db
    .prepare(
      "SELECT count(*) as count FROM catalog_bundles WHERE period_id = ?",
    )
    .get(periodId) as { count: number };
  if (check.count > 0) return;

  const stmt = db.prepare(`
    INSERT INTO catalog_bundles (id, period_id, segment, name, price, primary_category, categories_json, image_id, composition_json, installments_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of BUNDLES_SEED) {
    const id = `bundle-${b.image_id}`;
    stmt.run(
      id,
      periodId,
      "gaso",
      b.name,
      b.price,
      b.primary_category,
      JSON.stringify(b.categories),
      b.image_id,
      JSON.stringify(b.composition),
      JSON.stringify(b.installments),
      "01 año de garantía, delivery gratuito, cero cuota inicial",
    );
  }

  console.log(`Seeded ${BUNDLES_SEED.length} GASO bundles`);
}

function seedFnbBundles(db: Database) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodId = `period-${yearMonth}`;

  const check = db
    .prepare(
      "SELECT count(*) as count FROM catalog_bundles WHERE period_id = ? AND id LIKE 'fnb-%'",
    )
    .get(periodId) as { count: number };
  if (check.count > 0) return;

  const stmt = db.prepare(`
    INSERT INTO catalog_bundles (id, period_id, segment, name, price, primary_category, categories_json, image_id, composition_json, installments_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of FNB_BUNDLES_SEED) {
    const id = `fnb-${b.image_id}`;
    stmt.run(
      id,
      periodId,
      "fnb",
      b.name,
      b.price,
      b.primary_category,
      JSON.stringify(b.categories),
      b.image_id,
      JSON.stringify(b.composition),
      JSON.stringify(b.installments),
      "01 año de garantía, delivery gratuito, cero cuota inicial",
    );
  }

  console.log(`Seeded ${FNB_BUNDLES_SEED.length} FnB bundles`);
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
