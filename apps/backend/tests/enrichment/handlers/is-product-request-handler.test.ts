import { describe, test, expect, beforeEach } from "bun:test";
import { createMockProvider } from "@totem/intelligence";
import { IsProductRequestHandler } from "../../../src/conversation/enrichment/handlers/is-product-request-handler.ts";

describe("IsProductRequestHandler", () => {
  let handler: IsProductRequestHandler;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    handler = new IsProductRequestHandler();
    mockProvider = createMockProvider();
  });

  test("detects product request", async () => {
    mockProvider.setResponse("isProductRequest", true);

    const result = await handler.execute(
      { type: "is_product_request", message: "Quiero ver laptops" },
      { phoneNumber: "51999999999", provider: mockProvider },
    );

    expect(result.type).toBe("product_request_detected");
    expect(result.isProductRequest).toBe(true);
  });
});
