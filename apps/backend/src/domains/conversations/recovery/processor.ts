import { createLogger } from "../../../lib/logger.ts";
import { checkEligibilityWithFallback } from "../../../domains/eligibility/orchestrator.ts";
import { executeCommands } from "../../../conversation/handler/command-executor.ts";
import { transitionCheckingEligibility } from "@totem/core";
import { mapEligibilityToEnrichment } from "../../eligibility/mapper.ts";
import type { ConversationPhase, ConversationMetadata } from "@totem/core";
import type { RecoveryResult } from "./types.ts";

const logger = createLogger("recovery-processor");

export async function processConversation(
  row: { phone_number: string; context_data: string },
  stats: RecoveryResult,
) {
  try {
    const context = JSON.parse(row.context_data);
    const phase = context.phase as ConversationPhase & {
      phase: "waiting_for_recovery";
    };
    const metadata = context.metadata as ConversationMetadata;

    logger.debug(
      { phoneNumber: row.phone_number, dni: phase.dni },
      "Retrying eligibility check",
    );

    const result = await checkEligibilityWithFallback(
      phase.dni,
      row.phone_number,
    );

    if (result.needsHuman && result.handoffReason === "both_providers_down") {
      stats.stillFailingCount++;
      return;
    }

    const enrichmentResult = mapEligibilityToEnrichment(result);

    const tempPhase = {
      phase: "checking_eligibility",
      dni: phase.dni,
    } as ConversationPhase;

    // Simulate transition
    const transition = transitionCheckingEligibility(
      tempPhase as Extract<
        ConversationPhase,
        { phase: "checking_eligibility" }
      >,
      "",
      metadata,
      enrichmentResult,
    );

    if (transition.type === "update") {
      if (
        enrichmentResult.type === "eligibility_result" &&
        enrichmentResult.status === "eligible"
      ) {
        transition.commands = [
          {
            type: "SEND_MESSAGE",
            text: "¡Gracias por tu paciencia! Ya recuperamos el sistema y verificamos tu información. 🙌",
          },
          ...transition.commands,
        ];
      }

      await executeCommands(transition, row.phone_number, metadata, false);
      stats.recoveredCount++;
    } else {
      logger.warn(
        { phoneNumber: row.phone_number },
        "Recovery transition failed",
      );
      stats.errors++;
    }
  } catch (error) {
    logger.error(
      { error, phoneNumber: row.phone_number },
      "Recovery failed for user",
    );
    stats.errors++;
  }
}
