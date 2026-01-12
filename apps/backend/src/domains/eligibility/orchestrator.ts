import type { ProviderCheckResult } from "@totem/types";
import { checkFNB } from "./fnb.ts";
import { checkGASO } from "./gaso.ts";
import { notifyTeam } from "../../adapters/notifier/client.ts";
import { createLogger } from "../../lib/logger.ts";

const logger = createLogger("eligibility");

type ProviderResult = {
  success: boolean;
  result?: ProviderCheckResult;
  error?: string;
};

type EligibilityResult = ProviderCheckResult & {
  needsHuman?: boolean;
  handoffReason?: string;
};

export async function checkEligibilityWithFallback(
  dni: string,
  phoneNumber?: string,
): Promise<EligibilityResult> {
  const results = {
    fnb: null as ProviderResult | null,
    powerbi: null as ProviderResult | null,
    errors: [] as string[],
  };

  // Try both providers in parallel (fail-fast)
  await Promise.allSettled([
    checkFNB(dni, phoneNumber)
      .then((result) => {
        results.fnb = { success: true, result };
      })
      .catch((error) => {
        results.fnb = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        results.errors.push(`FNB: ${results.fnb.error}`);
      }),

    checkGASO(dni, phoneNumber)
      .then((result) => {
        results.powerbi = { success: true, result };
      })
      .catch((error) => {
        results.powerbi = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        results.errors.push(`PowerBI: ${results.powerbi.error}`);
      }),
  ]);

  // Best case: Both succeeded
  if (results.fnb?.success && results.powerbi?.success) {
    const fnbResult = results.fnb.result!;
    const gasoResult = results.powerbi.result!;

    // Check FNB first (premium segment priority)
    if (fnbResult.eligible) {
      logger.info(
        { dni, segment: "fnb", credit: fnbResult.credit },
        "Eligible via FNB",
      );
      return fnbResult;
    }

    // FNB not eligible, try GASO
    if (gasoResult.eligible) {
      logger.info(
        { dni, segment: "gaso", credit: gasoResult.credit },
        "Eligible via GASO",
      );
      return gasoResult;
    }

    return { eligible: false, credit: 0, reason: "not_qualified" };
  }

  // FNB succeeded, PowerBI failed, so we use FNB data
  if (results.fnb?.success && !results.powerbi?.success) {
    silentlyNotifyDev(`PowerBI down, using FNB data only`, dni, results.errors);

    const fnbResult = results.fnb.result!;
    if (fnbResult.eligible) {
      logger.warn(
        { dni, segment: "fnb", credit: fnbResult.credit, degraded: "powerbi" },
        "Eligible (PowerBI degraded)",
      );
      return fnbResult;
    }

    // FNB says not found
    return { eligible: false, credit: 0, reason: "not_qualified" };
  }

  // PowerBI succeeded, FNB failed, so we use PowerBI data
  if (!results.fnb?.success && results.powerbi?.success) {
    silentlyNotifyDev(
      `FNB platform down, using PowerBI only`,
      dni,
      results.errors,
    );

    const gasoResult = results.powerbi.result!;
    if (gasoResult.eligible) {
      logger.warn(
        { dni, segment: "gaso", eligible: true, degraded: "fnb" },
        "Customer eligible via PowerBI (FNB degraded)",
      );
      return gasoResult;
    }

    return { eligible: false, credit: 0 };
  }

  // Both failed
  logger.error({ dni, errors: results.errors }, "Both providers failed");

  await escalateToHuman(
    `URGENTE: Ambos proveedores caídos. Cliente esperando: DNI ${dni}${phoneNumber ? `, WhatsApp ${phoneNumber}` : ""}`,
  );

  return {
    eligible: false,
    credit: 0,
    reason: "provider_unavailable",
    needsHuman: true,
    handoffReason: "both_providers_down",
  };
}

function silentlyNotifyDev(
  message: string,
  dni: string,
  errors: string[],
): void {
  logger.warn({ dni, errors }, message);

  notifyTeam(
    "dev",
    `${message}\nDNI: ${dni}\nErrors: ${errors.join(", ")}`,
  ).catch((error) => {
    logger.error({ error }, "Notify dev failed");
  });
}

async function escalateToHuman(message: string): Promise<void> {
  try {
    await notifyTeam("agent", message);
  } catch (error) {
    logger.error({ error, message }, "Escalation failed");
  }
}
