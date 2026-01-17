import { describe, test, expect, beforeEach } from "bun:test";
import { createMockProvider } from "@totem/intelligence";
import { ShouldEscalateHandler } from "../../../src/conversation/enrichment/handlers/should-escalate-handler.ts";

describe("ShouldEscalateHandler", () => {
  let handler: ShouldEscalateHandler;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    handler = new ShouldEscalateHandler();
    mockProvider = createMockProvider();
  });

  test("escalates on explicit request", async () => {
    mockProvider.setResponse("shouldEscalate", true);

    const result = await handler.execute(
      { type: "should_escalate", message: "Quiero hablar con un humano" },
      { phoneNumber: "51999999999", provider: mockProvider },
    );

    expect(result.type).toBe("escalation_needed");
    expect(result.shouldEscalate).toBe(true);
  });

  test("handles empty message gracefully", async () => {
    mockProvider.setResponse("shouldEscalate", false);

    const result = await handler.execute(
      { type: "should_escalate", message: "" },
      { phoneNumber: "51999999999", provider: mockProvider },
    );

    expect(result.type).toBe("escalation_needed");
    expect(result.shouldEscalate).toBe(false);
  });
});
