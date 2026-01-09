/**
 * Collecting age phase transition (GASO only)
 */

import type {
  ConversationPhase,
  ConversationMetadata,
  TransitionResult,
} from "../types.ts";
import { selectVariant } from "../../messaging/variation-selector.ts";
import { extractAge } from "../../validation/regex.ts";
import * as T from "../../templates/standard.ts";
import * as S from "../../templates/sales.ts";

type CollectingAgePhase = Extract<
  ConversationPhase,
  { phase: "collecting_age" }
>;

const MIN_AGE = 25;

export function transitionCollectingAge(
  phase: CollectingAgePhase,
  message: string,
  metadata: ConversationMetadata,
): TransitionResult {
  const age = extractAge(message);

  if (age === null) {
    const { message: messages } = selectVariant(
      T.INVALID_AGE,
      "INVALID_AGE",
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

  if (age < MIN_AGE) {
    const variants = T.AGE_TOO_LOW(MIN_AGE);
    const { message: messages } = selectVariant(variants, "AGE_TOO_LOW", {});

    return {
      type: "update",
      nextPhase: { phase: "closing", purchaseConfirmed: false },
      commands: [
        {
          type: "TRACK_EVENT",
          event: "eligibility_failed",
          metadata: { reason: "age_too_low", age },
        },
        ...messages.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
      ],
    };
  }

  // Age valid, proceed to offer
  const credit = phase.credit || metadata.credit || 0;
  const affordableCategories = phase.affordableCategories || [];
  const categoryDisplayNames = phase.categoryDisplayNames || [];

  const productList =
    categoryDisplayNames.length > 0
      ? categoryDisplayNames.join(", ")
      : "nuestros combos disponibles";

  const { message: messages } = selectVariant(
    S.GASO_OFFER_KITCHEN_BUNDLE(productList),
    "GASO_OFFER",
    {},
  );

  return {
    type: "update",
    nextPhase: {
      phase: "offering_products",
      segment: "gaso",
      credit,
      name: phase.name,
      availableCategories: affordableCategories,
      categoryDisplayNames,
    },
    commands: [
      {
        type: "TRACK_EVENT",
        event: "eligibility_passed",
        metadata: { segment: "gaso", credit, age },
      },
      ...messages.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
    ],
  };
}
