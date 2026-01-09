import type {
  ConversationPhase,
  TransitionResult,
  EnrichmentResult,
} from "../types.ts";
import { selectVariant } from "../../messaging/variation-selector.ts";
import { checkFNBEligibility } from "../../eligibility/fnb-logic.ts";
import * as T from "../../templates/standard.ts";
import * as S from "../../templates/sales.ts";
import { formatFirstName } from "../../validation/format-name.ts";

type CheckingEligibilityPhase = Extract<
  ConversationPhase,
  { phase: "checking_eligibility" }
>;

export function transitionCheckingEligibility(
  phase: CheckingEligibilityPhase,
  _message: string,
  enrichment?: EnrichmentResult,
): TransitionResult {
  // If no enrichment, request eligibility check
  if (!enrichment) {
    return {
      type: "need_enrichment",
      enrichment: { type: "check_eligibility", dni: phase.dni },
    };
  }

  // Handle categories fetched (for FNB approval flow)
  if (enrichment.type === "categories_fetched") {
    const name = formatFirstName(phase.name || "");
    const credit = phase.credit || 0;
    const categories = enrichment.categories;

    const variants = S.FNB_APPROVED(name, credit, categories);
    const { message } = selectVariant(variants, "FNB_APPROVED", {});

    return {
      type: "update",
      nextPhase: {
        phase: "offering_products",
        segment: "fnb",
        credit,
        name,
        availableCategories: categories,
      },
      commands: [
        {
          type: "TRACK_EVENT",
          event: "eligibility_passed",
          metadata: { segment: "fnb", credit },
        },
        ...message.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
      ],
    };
  }

  if (enrichment.type === "eligibility_result") {
    // Case 1: needs human intervention (both providers down)
    if (enrichment.status === "needs_human") {
      const { message } = selectVariant(
        [
          ["Perfecto, déjame verificar tu información. Dame un momento."],
          ["Genial, dame un momentito mientras reviso tu línea de crédito."],
          ["Déjame consultar tu información. Un momento, por favor."],
        ],
        "CHECKING_HOLD",
        {},
      );

      return {
        type: "update",
        nextPhase: {
          phase: "escalated",
          reason: enrichment.handoffReason || "eligibility_check_failed",
        },
        commands: [
          ...message.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
          {
            type: "NOTIFY_TEAM",
            channel: "agent",
            message: `🔴 Cliente esperando. Verificación de elegibilidad: DNI ${phase.dni}. ${enrichment.handoffReason === "both_providers_down" ? "Ambos proveedores caídos." : "Error en verificación."}`,
          },
          {
            type: "ESCALATE",
            reason: enrichment.handoffReason || "eligibility_check_failed",
          },
        ],
      };
    }

    // Case 2: Customer is eligible
    if (enrichment.status === "eligible" && enrichment.segment) {
      const segment = enrichment.segment;
      const credit = enrichment.credit || 0;
      const name = formatFirstName(enrichment.name || "");

      // For FNB, check business rules
      if (segment === "fnb") {
        if (!checkFNBEligibility(credit)) {
          // Credit too low for FNB
          const { message } = selectVariant(T.NOT_ELIGIBLE, "NOT_ELIGIBLE", {});

          return {
            type: "update",
            nextPhase: { phase: "closing", purchaseConfirmed: false },
            commands: [
              {
                type: "TRACK_EVENT",
                event: "eligibility_failed",
                metadata: { segment: "fnb", credit, reason: "credit_too_low" },
              },
              ...message.map((text) => ({
                type: "SEND_MESSAGE" as const,
                text,
              })),
            ],
          };
        }

        // FNB approved - need to fetch affordable categories first
        return {
          type: "need_enrichment",
          enrichment: { type: "fetch_categories", segment: "fnb", credit },
          pendingPhase: {
            phase: "checking_eligibility",
            dni: phase.dni,
            name,
            credit,
            segment: "fnb",
          },
        };
      }

      // For GASO, always requires age verification
      if (segment === "gaso") {
        const variants = T.ASK_AGE(name);
        const { message } = selectVariant(variants, "ASK_AGE", {});

        return {
          type: "update",
          nextPhase: {
            phase: "collecting_age",
            dni: phase.dni,
            name,
          },
          commands: message.map((text) => ({
            type: "SEND_MESSAGE" as const,
            text,
          })),
        };
      }
    }

    // Case 3: Customer not eligible
    if (enrichment.status === "not_eligible") {
      const { message } = selectVariant(T.NOT_ELIGIBLE, "NOT_ELIGIBLE", {});

      return {
        type: "update",
        nextPhase: { phase: "closing", purchaseConfirmed: false },
        commands: [
          {
            type: "TRACK_EVENT",
            event: "eligibility_failed",
            metadata: { segment: "none", reason: "not_eligible" },
          },
          ...message.map((text) => ({ type: "SEND_MESSAGE" as const, text })),
        ],
      };
    }
  }

  // For unknown cases, stay in phase
  return {
    type: "update",
    nextPhase: phase,
    commands: [],
  };
}
