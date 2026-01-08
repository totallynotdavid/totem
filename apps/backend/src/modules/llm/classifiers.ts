import {
  buildIsQuestionPrompt,
  buildExtractCategoryPrompt,
  buildShouldEscalatePrompt,
  buildAnswerQuestionPrompt,
  buildSuggestAlternativePrompt,
  buildHandleBacklogPrompt,
  getCategoryMetadata,
} from "@totem/core";
import { client, MODEL } from "./client.ts";
import { classifyLLMError, type LLMResult } from "./types.ts";

export async function isQuestion(message: string): Promise<LLMResult<boolean>> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: buildIsQuestionPrompt() },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const choice = completion.choices[0];
    const content = choice?.message.content;
    const res = JSON.parse(content || "{}");
    return { success: true, data: res.isQuestion === true };
  } catch (e) {
    return { success: false, error: classifyLLMError(e) };
  }
}

export async function shouldEscalate(
  message: string,
): Promise<LLMResult<boolean>> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: buildShouldEscalatePrompt() },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const choice = completion.choices[0];
    const content = choice?.message.content;
    const res = JSON.parse(content || "{}");
    return { success: true, data: res.shouldEscalate === true };
  } catch (e) {
    return { success: false, error: classifyLLMError(e) };
  }
}

export async function extractCategory(
  message: string,
  availableCategories: string[],
): Promise<LLMResult<string | null>> {
  try {
    const metadata = getCategoryMetadata(availableCategories);

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: buildExtractCategoryPrompt(metadata),
        },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const choice = completion.choices[0];
    const content = choice?.message.content;
    const res = JSON.parse(content || "{}");
    return { success: true, data: res.category ?? null };
  } catch (e) {
    return { success: false, error: classifyLLMError(e) };
  }
}

export async function answerQuestion(
  message: string,
  context: {
    segment?: string;
    creditLine?: number;
    state?: string;
    availableCategories?: string[];
  },
): Promise<LLMResult<string>> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: buildAnswerQuestionPrompt(context),
        },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const choice = completion.choices[0];
    const content = choice?.message.content;
    const res = JSON.parse(content || "{}");

    return {
      success: true,
      data: res.answer || "Déjame ayudarte con eso...",
    };
  } catch (e) {
    return { success: false, error: classifyLLMError(e) };
  }
}

export async function suggestAlternative(
  requestedCategory: string,
  availableCategories: string[],
): Promise<LLMResult<string>> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: buildSuggestAlternativePrompt(
            requestedCategory,
            availableCategories,
          ),
        },
        {
          role: "user",
          content: `Cliente pidió: ${requestedCategory}. Categorías disponibles: ${availableCategories.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const choice = completion.choices[0];
    const content = choice?.message.content;
    const res = JSON.parse(content || "{}");

    return {
      success: true,
      data:
        res.suggestion ||
        `No tenemos ${requestedCategory} ahora. ¿Te gustaría ver ${availableCategories[0] || "otras opciones"}?`,
    };
  } catch (e) {
    return { success: false, error: classifyLLMError(e) };
  }
}

export async function handleBacklogResponse(
  message: string,
  ageMinutes: number,
): Promise<LLMResult<string>> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: buildHandleBacklogPrompt(message, ageMinutes),
        },
        {
          role: "user",
          content: `Mensaje del cliente hace ${ageMinutes} minutos: "${message}"`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const choice = completion.choices[0];
    const content = choice?.message.content;
    const res = JSON.parse(content || "{}");

    return {
      success: true,
      data:
        res.response || `¡Hola! Disculpa la demora. ¿En qué puedo ayudarte?`,
    };
  } catch (e) {
    return { success: false, error: classifyLLMError(e) };
  }
}
