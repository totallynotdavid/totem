import { describe, test, expect, beforeAll, setDefaultTimeout } from "bun:test";
import * as LLM from "../src/modules/llm/index.ts";

setDefaultTimeout(30000);

const FORCE_SKIP = process.env.SKIP_LLM_TESTS === "1";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("LLM service (question detection)", () => {
  beforeAll(() => {
    if (!process.env.GEMINI_API_KEY && !FORCE_SKIP) {
      console.warn("GEMINI_API_KEY not set");
    } else if (process.env.GEMINI_API_KEY) {
      console.log("GEMINI_API_KEY found");
    }
  });

  test.skipIf(FORCE_SKIP)("detects question with ?", async () => {
    const result = await LLM.isQuestion("¿Cuánto cuesta?");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
    await delay(1000);
  });

  test.skipIf(FORCE_SKIP)(
    "does not detect affirmation as question",
    async () => {
      const result = await LLM.isQuestion("Sí, me interesa");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
      await delay(1000);
    },
  );

  test.skipIf(FORCE_SKIP)("does not detect negation as question", async () => {
    const result = await LLM.isQuestion("No gracias");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
    await delay(1000);
  });
});

describe("LLM service (escalation detection)", () => {
  test.skipIf(FORCE_SKIP)("escalates on exact amount question", async () => {
    const result = await LLM.shouldEscalate(
      "¿Cuánto exactamente en soles pago por cuota?",
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
    await delay(1000);
  });

  test.skipIf(FORCE_SKIP)("escalates on complaint", async () => {
    const result = await LLM.shouldEscalate("Quiero hacer un reclamo formal");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
    await delay(1000);
  });

  test.skipIf(FORCE_SKIP)("does not escalate general questions", async () => {
    const result = await LLM.shouldEscalate("¿Cómo funciona el pago?");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
    await delay(1000);
  });
});

describe("LLM service (category extraction)", () => {
  const categories = [
    "celulares",
    "cocinas",
    "laptops",
    "refrigeradoras",
    "televisores",
    "termas",
  ];

  test.skipIf(FORCE_SKIP)("extracts brand to category", async () => {
    const result = await LLM.extractCategory("Quiero un iPhone", categories);
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.toLowerCase()).toMatch(/celular/);
    }
    await delay(1000);
  });

  test.skipIf(FORCE_SKIP)("returns null for no category", async () => {
    const result = await LLM.extractCategory("Hola, buenos días", categories);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
    await delay(1000);
  });
});

describe("LLM service (answering questions)", () => {
  test.skipIf(FORCE_SKIP)("returns string answer", async () => {
    const result = await LLM.answerQuestion("¿Cómo funciona?", {
      segment: "fnb",
      creditLine: 3000,
      availableCategories: ["celulares", "cocinas"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data).toBe("string");
      expect(result.data.length).toBeGreaterThan(0);
    }
    await delay(1000);
  });

  test.skipIf(FORCE_SKIP)("uses available categories in context", async () => {
    const result = await LLM.answerQuestion("¿Qué productos tienen?", {
      segment: "gaso",
      availableCategories: ["cocinas", "termas"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data).toBe("string");
    }
    await delay(1000);
  });
});

describe("LLM service (error handling)", () => {
  test("returns error result on isQuestion failure", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const result = await LLM.isQuestion("test");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBeDefined();
      expect(result.error.message).toBeDefined();
    }
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  test("returns error result on shouldEscalate failure", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const result = await LLM.shouldEscalate("test");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBeDefined();
    }
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  test("returns error result on extractCategory failure", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const result = await LLM.extractCategory("test", ["celulares"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBeDefined();
    }
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  test("returns error result on answerQuestion failure", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const result = await LLM.answerQuestion("test", { segment: "fnb" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBeDefined();
    }
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });
});
