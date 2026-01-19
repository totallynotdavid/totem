import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { checkEligibilityWithFallback } from "../src/domains/eligibility/orchestrator.ts";
import { retryStuckEligibilityChecks } from "../src/domains/conversations/recovery.ts";
import { db } from "../src/db/index.ts";
import { getOrCreateConversation } from "../src/conversation/store.ts";
import { readFileSync } from "fs";
import { join } from "path";
import jwt from "jsonwebtoken";

mock.module("../src/config.ts", () => ({
  config: {
    calidda: {
      baseUrl: "http://fnb.fake",
      credentials: { username: "test", password: "test" },
    },
    powerbi: {
      datasetId: "fake-ds",
      reportId: "fake-rep",
      modelId: "0",
      resourceKey: "fake-key",
    },
  },
}));

const FAKE_TOKEN = jwt.sign({ commercialAllyId: "123" }, "secret");

mock.module("../src/adapters/providers/health.ts", () => ({
  isAvailable: () => true,
  markBlocked: () => {},
}));
mock.module("../src/domains/settings/system.ts", () => ({
  isProviderForcedDown: () => false,
}));
mock.module("../src/domains/eligibility/shared.ts", () => ({
  getSimulationPersona: () => null,
}));

describe("Provider Outage Recovery (Full Integration)", () => {
  const testPhone = "51999999999";
  const testDNI = "12345678";
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const schemaPath = join(import.meta.dir, "../src/db/schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      db.run(statement);
    }

    db.prepare("DELETE FROM conversations WHERE phone_number = ?").run(
      testPhone,
    );
    db.prepare("DELETE FROM users WHERE id = 'test-agent'").run();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should detect system_outage when APIs return 5xx errors", async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = input.toString();

      if (url.includes("autenticar")) {
        return new Response(
          JSON.stringify({
            valid: true,
            data: { authToken: FAKE_TOKEN },
          }),
        );
      }
      if (url.includes("lineaCredito"))
        return new Response("Service Unavailable", { status: 503 });
      if (url.includes("querydata"))
        return new Response("Internal Error", { status: 500 });

      return new Response("Not Found", { status: 404 });
    }) as any;

    const result = await checkEligibilityWithFallback(testDNI, testPhone);

    expect(result.needsHuman).toBe(true);
    expect(result.handoffReason).toBe("both_providers_down");
  });

  it("should recovery stuck conversations when APIs recover", async () => {
    const phase = {
      phase: "waiting_for_recovery",
      dni: testDNI,
      timestamp: Date.now(),
    };
    const metadata = { createdAt: Date.now(), lastActivityAt: Date.now() };
    db.prepare(
      `INSERT INTO conversations (phone_number, context_data, status) 
        VALUES (?, ?, 'active')`,
    ).run(testPhone, JSON.stringify({ phase, metadata }));

    globalThis.fetch = mock(async (input: any) => {
      const url = input.toString();

      if (url.includes("autenticar")) {
        return new Response(
          JSON.stringify({
            valid: true,
            data: { authToken: FAKE_TOKEN },
          }),
        );
      }
      if (url.includes("lineaCredito")) {
        return new Response(
          JSON.stringify({
            valid: true,
            data: { lineaCredito: "1500.00", nombre: "Juana Test" },
          }),
        );
      }
      if (url.includes("querydata"))
        return new Response("Error", { status: 500 });

      return new Response("Not Found", { status: 404 });
    }) as any;

    const result = await retryStuckEligibilityChecks();

    expect(result.recoveredCount).toBe(1);
    expect(result.stillFailingCount).toBe(0);

    const conv = getOrCreateConversation(testPhone);
    expect(conv.phase.phase).not.toBe("waiting_for_recovery");
  });
});
