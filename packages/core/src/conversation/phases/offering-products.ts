/**
 * The main sales phase handles:
 * - Category extraction (via regex or LLM)
 * - Question detection and answering
 * - Product selection
 * - Purchase confirmation
 */

import type {
  ConversationPhase,
  TransitionResult,
  EnrichmentResult,
} from "../types.ts";
import { selectVariant } from "../../messaging/variation-selector.ts";
import { matchCategory } from "../../matching/category-matcher.ts";
import * as S from "../../templates/sales.ts";

type OfferingProductsPhase = Extract<
  ConversationPhase,
  { phase: "offering_products" }
>;

export function transitionOfferingProducts(
  phase: OfferingProductsPhase,
  message: string,
  _metadata: unknown,
  enrichment?: EnrichmentResult,
): TransitionResult {
  const lower = message.toLowerCase();

  // Handle enrichment results first
  if (enrichment) {
    return handleEnrichmentResult(phase, message, enrichment);
  }

  // Try regex-based category matching first (no LLM needed)
  const matchedCategory = matchCategory(message);
  if (matchedCategory) {
    return {
      type: "update",
      nextPhase: phase, // Stay in offering_products
      commands: [
        {
          type: "TRACK_EVENT",
          event: "category_selected",
          metadata: { category: matchedCategory, method: "regex" },
        },
        { type: "SEND_IMAGES", category: matchedCategory },
      ],
    };
  }

  // Check for purchase confirmation signals
  if (isPurchaseConfirmation(lower)) {
    const variants = S.CONFIRM_PURCHASE(phase.name || "");
    const { message } = selectVariant(variants, "CONFIRM_PURCHASE", {});

    return {
      type: "update",
      nextPhase: { phase: "closing", purchaseConfirmed: true },
      commands: [
        {
          type: "TRACK_EVENT",
          event: "purchase_confirmed",
          metadata: { segment: phase.segment },
        },
        ...message.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
        {
          type: "NOTIFY_TEAM",
          channel: "agent",
          message: `Cliente confirmó interés de compra`,
        },
      ],
    };
  }

  // Check for rejection
  if (isRejection(lower)) {
    return {
      type: "update",
      nextPhase: { phase: "closing", purchaseConfirmed: false },
      commands: [
        {
          type: "TRACK_EVENT",
          event: "offer_rejected",
          metadata: {},
        },
        {
          type: "SEND_MESSAGE",
          text: "Entendido. ¡Gracias por tu tiempo! Si cambias de opinión, aquí estaré.",
        },
      ],
    };
  }

  // Check for price concern, transition to objection handling
  if (isPriceConcern(lower)) {
    const { message } = selectVariant(
      S.PRICE_CONCERN.standard,
      "PRICE_CONCERN",
      {},
    );

    return {
      type: "update",
      nextPhase: {
        phase: "handling_objection",
        segment: phase.segment,
        credit: phase.credit,
        name: phase.name,
        objectionCount: 1,
      },
      commands: message.map((text) => ({
        type: "SEND_MESSAGE" as const,
        text,
      })),
    };
  }

  // Need LLM to understand, first detect if it's a question
  return {
    type: "need_enrichment",
    enrichment: { type: "detect_question", message },
  };
}

function handleEnrichmentResult(
  phase: OfferingProductsPhase,
  message: string,
  enrichment: EnrichmentResult,
): TransitionResult {
  if (enrichment.type === "question_detected") {
    if (enrichment.isQuestion) {
      // Check if should escalate
      return {
        type: "need_enrichment",
        enrichment: { type: "should_escalate", message },
      };
    }

    // Not a question, try to extract category with LLM
    return {
      type: "need_enrichment",
      enrichment: {
        type: "extract_category",
        message,
        availableCategories: phase.availableCategories!,
      },
    };
  }

  // Escalation decision
  if (enrichment.type === "escalation_needed") {
    if (enrichment.shouldEscalate) {
      return {
        type: "update",
        nextPhase: {
          phase: "escalated",
          reason: "customer_question_requires_human",
        },
        commands: [
          {
            type: "NOTIFY_TEAM",
            channel: "agent",
            message: `Cliente tiene pregunta que requiere atención humana`,
          },
          { type: "ESCALATE", reason: "customer_question_requires_human" },
        ],
      };
    }

    // Answer the question
    return {
      type: "need_enrichment",
      enrichment: {
        type: "answer_question",
        message,
        context: {
          segment: phase.segment,
          credit: phase.credit,
          phase: "offering_products",
          availableCategories: phase.availableCategories!,
        },
      },
    };
  }

  // Question answered
  if (enrichment.type === "question_answered") {
    return {
      type: "update",
      nextPhase: phase,
      commands: [{ type: "SEND_MESSAGE", text: enrichment.answer }],
    };
  }

  // Category extracted
  if (enrichment.type === "category_extracted" && enrichment.category) {
    return {
      type: "update",
      nextPhase: phase, // Stay in offering_products
      commands: [
        {
          type: "TRACK_EVENT",
          event: "category_selected",
          metadata: { category: enrichment.category, method: "llm" },
        },
        { type: "SEND_IMAGES", category: enrichment.category },
      ],
    };
  }

  // Fallback: couldn't extract category or unknown enrichment, ask for clarification
  const categoryDisplayNames = phase.categoryDisplayNames || [];
  const productList =
    categoryDisplayNames.length > 0
      ? categoryDisplayNames.join(", ")
      : "nuestros productos disponibles";

  const { message: messages } = selectVariant(
    S.ASK_PRODUCT_INTEREST(productList),
    "ASK_PRODUCT_INTEREST",
    {},
  );

  return {
    type: "update",
    nextPhase: phase,
    commands: messages.map((text) => ({
      type: "SEND_MESSAGE" as const,
      text,
    })),
  };
}

function isPurchaseConfirmation(lower: string): boolean {
  return (
    /(quiero|me\s+interesa|lo\s+quiero|s[ií]\s*,?\s*(quiero|me\s+interesa)|confirmo|listo|dale|va)/.test(
      lower,
    ) && !/(no\s+quiero|no\s+me\s+interesa)/.test(lower)
  );
}

function isRejection(lower: string): boolean {
  return /(no\s+(quiero|me\s+interesa|gracias)|nada|paso|no\s+por\s+ahora)/.test(
    lower,
  );
}

function isPriceConcern(lower: string): boolean {
  return /(caro|muy\s+caro|precio|cuesta\s+mucho|no\s+puedo\s+pagar|no\s+tengo\s+plata|presupuesto)/.test(
    lower,
  );
}
