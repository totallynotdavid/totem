import { describe, test, expect, beforeEach } from "bun:test";
import { createMockProvider } from "@totem/intelligence";
import { RecoverUnclearResponseHandler } from "../../../src/conversation/enrichment/handlers/recover-unclear-response-handler.ts";

describe("RecoverUnclearResponseHandler", () => {
  let handler: RecoverUnclearResponseHandler;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    handler = new RecoverUnclearResponseHandler();
    mockProvider = createMockProvider();
  });

  test("generates recovery text", async () => {
    mockProvider.setResponse(
      "recoverUnclearResponse",
      "¿Quisieras ver nuestros productos disponibles?",
    );

    const result = await handler.execute(
      {
        type: "recover_unclear_response",
        message: "mmm",
        context: { phase: "offering_products" },
      },
      { phoneNumber: "51999999999", provider: mockProvider },
    );

    expect(result.type).toBe("recovery_response");
    expect(result.text).toBe("¿Quisieras ver nuestros productos disponibles?");
    expect(result.text.length).toBeGreaterThan(0);
  });
});
