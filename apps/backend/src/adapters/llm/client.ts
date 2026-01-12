import OpenAI from "openai";
import process from "node:process";
import { conversationLogger } from "@totem/logger";

export const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export const MODEL = "gemini-2.5-flash-lite";

export function parseLLMResponse<T = Record<string, unknown>>(
  content: string | null | undefined,
  context: string,
  defaultValue: T,
): T {
  if (!content) {
    conversationLogger.error({ context }, "Empty LLM response");
    return defaultValue;
  }

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    conversationLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        context,
        contentPreview: content.substring(0, 300),
        contentLength: content.length,
      },
      "Failed to parse LLM JSON response",
    );
    return defaultValue;
  }
}
