/**
 * Enrichment Executor
 *
 * Executes async operations requested by the state machine.
 * This is the ONLY place where side effects happen during transition processing.
 */

import { conversation } from "@totem/core";
import { checkFNB } from "../modules/eligibility/fnb.ts";

type EnrichmentRequest = conversation.EnrichmentRequest;
type EnrichmentResult = conversation.EnrichmentResult;
import { checkGASO } from "../modules/eligibility/gaso.ts";
import * as LLM from "../modules/llm/index.ts";
import { getActiveCategoriesBySegment } from "../services/catalog/index.ts";

/**
 * Execute an enrichment request and return the result
 */
export async function executeEnrichment(
  request: EnrichmentRequest,
  phoneNumber: string,
): Promise<EnrichmentResult> {
  switch (request.type) {
    case "check_fnb":
      return await executeFNBCheck(request.dni, phoneNumber);

    case "check_gaso":
      return await executeGASOCheck(request.dni, phoneNumber);

    case "fetch_categories":
      return await executeFetchCategories(request.segment);

    case "detect_question":
      return await executeDetectQuestion(request.message, phoneNumber);

    case "should_escalate":
      return await executeShouldEscalate(request.message, phoneNumber);

    case "extract_category":
      return await executeExtractCategory(
        request.message,
        request.availableCategories,
        phoneNumber,
      );

    case "answer_question":
      return await executeAnswerQuestion(
        request.message,
        request.context,
        phoneNumber,
      );

    case "generate_backlog_apology":
      return await executeBacklogApology(
        request.message,
        request.ageMinutes,
        phoneNumber,
      );
  }
}

async function executeFNBCheck(
  dni: string,
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const result = await checkFNB(dni, phoneNumber);
    return {
      type: "fnb_result",
      eligible: result.eligible,
      credit: result.credit,
      name: result.name,
    };
  } catch (error) {
    console.error(`[Enrichment] FNB check failed for ${dni}:`, error);
    return {
      type: "fnb_result",
      eligible: false,
    };
  }
}

async function executeGASOCheck(
  dni: string,
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const result = await checkGASO(dni, phoneNumber);
    return {
      type: "gaso_result",
      eligible: result.eligible,
      credit: result.credit,
      name: result.name,
      nse: result.nse,
      requiresAge: result.eligible, // GASO always requires age if eligible
    };
  } catch (error) {
    console.error(`[Enrichment] GASO check failed for ${dni}:`, error);
    return {
      type: "gaso_result",
      eligible: false,
    };
  }
}

async function executeFetchCategories(
  segment: string,
): Promise<EnrichmentResult> {
  try {
    const categories = getActiveCategoriesBySegment(segment as "fnb" | "gaso");
    return {
      type: "categories_fetched",
      categories,
    };
  } catch (error) {
    console.error(
      `[Enrichment] Fetch categories failed for ${segment}:`,
      error,
    );
    // Fallback to empty array - phase will handle gracefully
    return {
      type: "categories_fetched",
      categories: [],
    };
  }
}

async function executeDetectQuestion(
  message: string,
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const isQuestion = await LLM.isQuestion(
      message,
      phoneNumber,
      "offering_products",
    );
    return {
      type: "question_detected",
      isQuestion,
    };
  } catch (error) {
    console.error(`[Enrichment] Detect question failed:`, error);
    return {
      type: "question_detected",
      isQuestion: false,
    };
  }
}

async function executeShouldEscalate(
  message: string,
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const shouldEscalate = await LLM.shouldEscalate(
      message,
      phoneNumber,
      "offering_products",
    );
    return {
      type: "escalation_needed",
      shouldEscalate,
    };
  } catch (error) {
    console.error(`[Enrichment] Should escalate failed:`, error);
    return {
      type: "escalation_needed",
      shouldEscalate: false,
    };
  }
}

async function executeExtractCategory(
  message: string,
  availableCategories: string[],
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const category = await LLM.extractCategory(
      message,
      availableCategories,
      phoneNumber,
      "offering_products",
    );
    return {
      type: "category_extracted",
      category,
    };
  } catch (error) {
    console.error(`[Enrichment] Extract category failed:`, error);
    return {
      type: "category_extracted",
      category: null,
    };
  }
}

async function executeAnswerQuestion(
  message: string,
  context: {
    segment?: string;
    credit?: number;
    phase: string;
    availableCategories: string[];
  },
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const answer = await LLM.answerQuestion(
      message,
      {
        segment: context.segment,
        creditLine: context.credit,
        state: context.phase,
        availableCategories: context.availableCategories,
      },
      phoneNumber,
    );
    return {
      type: "question_answered",
      answer,
    };
  } catch (error) {
    console.error(`[Enrichment] Answer question failed:`, error);
    return {
      type: "question_answered",
      answer: "Déjame revisar eso y te respondo.",
    };
  }
}

async function executeBacklogApology(
  message: string,
  ageMinutes: number,
  phoneNumber: string,
): Promise<EnrichmentResult> {
  try {
    const apology = await LLM.handleBacklogResponse(
      message,
      ageMinutes,
      phoneNumber,
      "greeting",
    );
    return {
      type: "backlog_apology",
      apology: apology || "Disculpa la demora, recién vi tu mensaje.",
    };
  } catch (error) {
    console.error(`[Enrichment] Backlog apology failed:`, error);
    return {
      type: "backlog_apology",
      apology: "Disculpa la demora, recién vi tu mensaje.",
    };
  }
}
