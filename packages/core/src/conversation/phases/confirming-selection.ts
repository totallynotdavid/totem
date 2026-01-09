import type {
  ConversationPhase,
  TransitionResult,
  EnrichmentResult,
  ConversationMetadata,
} from "../types.ts";
import { selectVariant } from "../../messaging/variation-selector.ts";
import * as S from "../../templates/sales.ts";

type ConfirmingSelectionPhase = Extract<
  ConversationPhase,
  { phase: "confirming_selection" }
>;

export function transitionConfirmingSelection(
  phase: ConfirmingSelectionPhase,
  message: string,
  _metadata: ConversationMetadata,
  _enrichment?: EnrichmentResult,
): TransitionResult {
  const lower = message.toLowerCase();

  // Check for confirmation
  if (isConfirmation(lower)) {
    const variants = S.CONFIRM_PURCHASE(phase.name || "");
    const { message: confirmMsgs } = selectVariant(
      variants,
      "CONFIRM_PURCHASE",
      {},
    );

    return {
      type: "update",
      nextPhase: { phase: "closing", purchaseConfirmed: true },
      commands: [
        {
          type: "TRACK_EVENT",
          event: "purchase_confirmed",
          metadata: {
            segment: phase.segment,
            productId: phase.selectedProduct.productId,
            productName: phase.selectedProduct.name,
            price: phase.selectedProduct.price,
          },
        },
        ...confirmMsgs.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
        {
          type: "NOTIFY_TEAM",
          channel: "agent",
          message: `Cliente confirmó compra: ${phase.selectedProduct.name} (S/ ${phase.selectedProduct.price.toFixed(2)})`,
        },
      ],
    };
  }

  // Check for rejection or want to explore more
  if (isRejectionOrExplore(lower)) {
    return {
      type: "update",
      nextPhase: {
        phase: "offering_products",
        segment: phase.segment,
        credit: phase.credit,
        name: phase.name,
        interestedProduct: {
          name: phase.selectedProduct.name,
          price: phase.selectedProduct.price,
          productId: phase.selectedProduct.productId,
          exploredCategoriesCount: 0,
        },
      },
      commands: [
        {
          type: "TRACK_EVENT",
          event: "returned_to_browsing",
          metadata: {
            fromProduct: phase.selectedProduct.name,
            productId: phase.selectedProduct.productId,
            price: phase.selectedProduct.price,
          },
        },
        {
          type: "SEND_MESSAGE",
          text: "Sin problema. ¿Qué te gustaría ver?",
        },
      ],
    };
  }

  // Unclear response, re-ask
  return {
    type: "update",
    nextPhase: phase,
    commands: [
      {
        type: "SEND_MESSAGE",
        text: "¿Confirmas tu elección? Responde 'sí' para confirmar o 'quiero ver otros' para seguir explorando.",
      },
    ],
  };
}

function isConfirmation(lower: string): boolean {
  return /(^|\s)(s[ií]|confirmo|listo|dale|va|claro|ok|perfecto)($|\s|,)/.test(
    lower,
  );
}

function isRejectionOrExplore(lower: string): boolean {
  return /(no|todav[ií]a\s+no|quiero\s+ver\s+(otros?|m[aá]s)|mejor\s+no|otro|m[aá]s\s+opciones?)/.test(
    lower,
  );
}
