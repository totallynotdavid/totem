/**
 * Checking eligibility phase transition
 *
 * This phase handles the enrichment loop for provider checks.
 * It's re-entered after each enrichment completes.
 */

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
  // No enrichment yet - this shouldn't happen, but handle gracefully
  if (!enrichment) {
    return {
      type: "need_enrichment",
      enrichment: { type: "check_fnb", dni: phase.dni },
    };
  }

  // Handle FNB result
  if (enrichment.type === "fnb_result") {
    if (enrichment.eligible && enrichment.credit) {
      // Check business rules
      if (!checkFNBEligibility(enrichment.credit)) {
        // Credit too low - try GASO
        return {
          type: "need_enrichment",
          enrichment: { type: "check_gaso", dni: phase.dni },
        };
      }

      const firstName = formatFirstName(enrichment.name || "");
      const variants = S.FNB_APPROVED(firstName, enrichment.credit);
      const { message: response } = selectVariant(
        variants,
        "FNB_APPROVED",
        {},
      );

      return {
        type: "advance",
        nextPhase: {
          phase: "offering_products",
          segment: "fnb",
          credit: enrichment.credit,
          name: firstName,
        },
        response,
        track: {
          eventType: "eligibility_passed",
          metadata: { segment: "fnb", credit: enrichment.credit },
        },
      };
    }

    // FNB not eligible - try GASO
    return {
      type: "need_enrichment",
      enrichment: { type: "check_gaso", dni: phase.dni },
    };
  }

  // Handle GASO result
  if (enrichment.type === "gaso_result") {
    if (enrichment.eligible && enrichment.credit) {
      const firstName = formatFirstName(enrichment.name || "");

      // GASO always requires age verification for final eligibility check
      // The age-based business rules are applied in collecting_age phase
      const variants = T.ASK_AGE(firstName);
      const { message: response } = selectVariant(variants, "ASK_AGE", {});

      return {
        type: "advance",
        nextPhase: {
          phase: "collecting_age",
          dni: phase.dni,
          name: firstName,
        },
        response,
      };
    }

    // Not eligible in either provider
    const { message: response } = selectVariant(
      T.NOT_ELIGIBLE,
      "NOT_ELIGIBLE",
      {},
    );

    return {
      type: "advance",
      nextPhase: { phase: "closing", purchaseConfirmed: false },
      response,
      track: {
        eventType: "eligibility_failed",
        metadata: { segment: "none", reason: "not_eligible" },
      },
    };
  }

  // Unknown enrichment type - stay in current phase
  return { type: "stay" };
}
