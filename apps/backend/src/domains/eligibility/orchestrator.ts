import type { ProviderCheckResult } from "@totem/types";
import { checkFNB } from "./fnb.ts";
import { checkGASO } from "./gaso.ts";
import { notifyTeam } from "../../adapters/notifier/client.ts";
import { eligibilityLogger } from "@totem/logger";

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
      eligibilityLogger.info(
        { dni, segment: "fnb", eligible: true, credit: fnbResult.credit },
        "Customer eligible via FNB",
      );
      return fnbResult;
    }

    // FNB not eligible, try GASO
    if (gasoResult.eligible) {
      eligibilityLogger.info(
        { dni, segment: "gaso", eligible: true, credit: gasoResult.credit },
        "Customer eligible via GASO",
      );
      return gasoResult;
    }

    // Neither eligible
    eligibilityLogger.info(
      { dni, eligible: false },
      "Customer not eligible in any segment",
    );
    return { eligible: false, credit: 0, reason: "not_qualified" };
  }

  // FNB succeeded, PowerBI failed, so we use FNB data
  if (results.fnb?.success && !results.powerbi?.success) {
    silentlyNotifyDev(`PowerBI down, using FNB data only`, dni, results.errors);

    const fnbResult = results.fnb.result!;
    if (fnbResult.eligible) {
      eligibilityLogger.warn(
        { dni, segment: "fnb", eligible: true, degraded: "powerbi" },
        "Customer eligible via FNB (PowerBI degraded)",
      );
      return fnbResult;
    }

    // FNB says not found, customer likely is not a Calidda customer
    eligibilityLogger.info(
      { dni, eligible: false, degraded: "powerbi" },
      "FNB returned not found (PowerBI unavailable)",
    );
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
      eligibilityLogger.warn(
        { dni, segment: "gaso", eligible: true, degraded: "fnb" },
        "Customer eligible via PowerBI (FNB degraded)",
      );
      return gasoResult;
    }

    eligibilityLogger.info(
      { dni, eligible: false, degraded: "fnb" },
      "Customer not eligible (FNB unavailable)",
    );
    return { eligible: false, credit: 0, reason: "not_qualified" };
  }

  eligibilityLogger.error(
    { dni, errors: results.errors },
    "CRITICAL: Both providers failed",
  );

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
  eligibilityLogger.warn({ dni, errors }, message);

  notifyTeam(
    "dev",
    `${message}\nDNI: ${dni}\nErrors: ${errors.join(", ")}`,
  ).catch((error) => {
    eligibilityLogger.error({ error }, "Failed to notify dev");
  });
}

async function escalateToHuman(message: string): Promise<void> {
  try {
    await notifyTeam("agent", message);
  } catch (error) {
    eligibilityLogger.error({ error, message }, "Failed to escalate to human");
    await notifyTeam("dev", `Escalation failed: ${message}`).catch(() => {});
  }
}
