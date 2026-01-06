import type { Database } from "bun:sqlite";
import bcrypt from "bcryptjs";

export function seedDatabase(db: Database) {
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
}

// Main execution
if (import.meta.main) {
  const { db } = await import("./connection.ts");
  const { initializeDatabase } = await import("./init.ts");

  console.log("Initializing database schema...");
  initializeDatabase(db);

  console.log("Seeding database...");
  seedDatabase(db);

  console.log("Database setup complete!");
  process.exit(0);
}
