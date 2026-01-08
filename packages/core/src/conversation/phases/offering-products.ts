/**
 * Offering products phase transition
 *
 * This is the main sales phase. Handles:
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
      type: "advance",
      nextPhase: phase, // Stay in offering_products
      images: { category: matchedCategory },
      track: {
        eventType: "category_selected",
        metadata: { category: matchedCategory, method: "regex" },
      },
    };
  }

  // Check for purchase confirmation signals
  if (isPurchaseConfirmation(lower)) {
    return {
      type: "advance",
      nextPhase: { phase: "closing", purchaseConfirmed: true },
      response: selectVariant(S.CONFIRM_PURCHASE, "CONFIRM_PURCHASE", {})
        .message,
      notify: {
        channel: "agent",
        message: `Cliente confirmó interés de compra`,
      },
      track: {
        eventType: "purchase_confirmed",
        metadata: { segment: phase.segment },
      },
    };
  }

  // Check for rejection
  if (isRejection(lower)) {
    return {
      type: "advance",
      nextPhase: { phase: "closing", purchaseConfirmed: false },
      response: "Entendido. ¡Gracias por tu tiempo! Si cambias de opinión, aquí estaré.",
      track: {
        eventType: "offer_rejected",
        metadata: {},
      },
    };
  }

  // Check for price concern - transition to objection handling
  if (isPriceConcern(lower)) {
    const { message: response } = selectVariant(
      S.PRICE_CONCERN.standard,
      "PRICE_CONCERN",
      {},
    );

    return {
      type: "advance",
      nextPhase: {
        phase: "handling_objection",
        segment: phase.segment,
        credit: phase.credit,
        name: phase.name,
        objectionCount: 1,
      },
      response,
    };
  }

  // Need LLM to understand - first detect if it's a question
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
  // Question detected - need to decide how to handle
  if (enrichment.type === "question_detected") {
    if (enrichment.isQuestion) {
      // Check if should escalate
      return {
        type: "need_enrichment",
        enrichment: { type: "should_escalate", message },
      };
    }

    // Not a question - try to extract category with LLM
    const availableCategories = getAvailableCategoriesForSegment(phase.segment);
    return {
      type: "need_enrichment",
      enrichment: {
        type: "extract_category",
        message,
        availableCategories,
      },
    };
  }

  // Escalation decision
  if (enrichment.type === "escalation_needed") {
    if (enrichment.shouldEscalate) {
      return {
        type: "escalate",
        reason: "customer_question_requires_human",
        notify: {
          channel: "agent",
          message: `Cliente tiene pregunta que requiere atención humana`,
        },
      };
    }

    // Answer the question
    const availableCategories = getAvailableCategoriesForSegment(phase.segment);
    return {
      type: "need_enrichment",
      enrichment: {
        type: "answer_question",
        message,
        context: {
          segment: phase.segment,
          credit: phase.credit,
          phase: "offering_products",
          availableCategories,
        },
      },
    };
  }

  // Question answered
  if (enrichment.type === "question_answered") {
    return {
      type: "stay",
      response: enrichment.answer,
    };
  }

  // Category extracted
  if (enrichment.type === "category_extracted") {
    if (enrichment.category) {
      return {
        type: "advance",
        nextPhase: phase, // Stay in offering_products
        images: { category: enrichment.category },
        track: {
          eventType: "category_selected",
          metadata: { category: enrichment.category, method: "llm" },
        },
      };
    }

    // Couldn't extract category - ask for clarification
    const { message: response } = selectVariant(
      S.ASK_PRODUCT_INTEREST,
      "ASK_PRODUCT_INTEREST",
      {},
    );

    return {
      type: "stay",
      response,
    };
  }

  // Unknown enrichment - ask what they want
  const { message: response } = selectVariant(
    S.ASK_PRODUCT_INTEREST,
    "ASK_PRODUCT_INTEREST",
    {},
  );

  return {
    type: "stay",
    response,
  };
}

function isPurchaseConfirmation(lower: string): boolean {
  return (
    /(quiero|me\s+interesa|lo\s+quiero|s[ií]\s*,?\s*(quiero|me\s+interesa)|confirmo|listo|dale|va)/.test(
      lower,
    ) &&
    !/(no\s+quiero|no\s+me\s+interesa)/.test(lower)
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

function getAvailableCategoriesForSegment(segment: string): string[] {
  // This would normally come from the catalog service
  // For now, return all categories
  if (segment === "fnb") {
    return [
      "celulares",
      "laptops",
      "tv",
      "refrigeradoras",
      "lavadoras",
      "cocinas",
    ];
  }
  return ["cocinas", "termas", "fusion"];
}
