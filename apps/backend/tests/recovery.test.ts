import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { CheckEligibilityHandler } from "../src/domains/eligibility/handlers/check-eligibility-handler.ts";
import { RetryEligibilityHandler } from "../src/domains/recovery/handlers/retry-eligibility-handler.ts";
import { FNBProvider } from "../src/domains/eligibility/providers/fnb-provider.ts";
import { PowerBIProvider } from "../src/domains/eligibility/providers/powerbi-provider.ts";
import { initializeEnrichmentRegistry } from "../src/conversation/enrichment/index.ts";
import { db } from "../src/db/index.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import jwt from "jsonwebtoken";

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
    // Set required env vars
    process.env.CALIDDA_BASE_URL = "http://fnb.fake";
    process.env.CALIDDA_USERNAME = "test";
    process.env.CALIDDA_PASSWORD = "test";
    process.env.POWERBI_DATASET_ID = "fake-ds";
    process.env.POWERBI_REPORT_ID = "fake-rep";
    process.env.POWERBI_MODEL_ID = "0";
    process.env.POWERBI_RESOURCE_KEY = "fake-key";
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

    // Initialize enrichment registry
    const fnbProvider = new FNBProvider();
    const powerbiProvider = new PowerBIProvider();
    const eligibilityHandler = new CheckEligibilityHandler(
      fnbProvider,
      powerbiProvider,
    );
    initializeEnrichmentRegistry(eligibilityHandler);
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

    const fnbProvider = new FNBProvider();
    const powerbiProvider = new PowerBIProvider();
    const eligibilityHandler = new CheckEligibilityHandler(
      fnbProvider,
      powerbiProvider,
    );
    const result = await eligibilityHandler.execute(testDNI, testPhone);

    if (result.ok && result.value.type === "eligibility_result") {
      expect(result.value.status).toBe("system_outage");
      expect(result.value.handoffReason).toBe("both_providers_down");
    } else {
      throw new Error("Expected eligibility_result in response");
    }
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

    const fnbProvider = new FNBProvider();
    const powerbiProvider = new PowerBIProvider();
    const eligibilityHandler = new CheckEligibilityHandler(
      fnbProvider,
      powerbiProvider,
    );
    const handler = new RetryEligibilityHandler(eligibilityHandler);
    const result = await handler.execute();

    if (result.ok) {
      expect(result.value.recoveredCount).toBe(1);
    } else {
      throw new Error("Expected success result");
    }
  });
});
