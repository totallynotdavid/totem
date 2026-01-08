import type { ProviderCheckResult } from "@totem/types";
import { checkFNB } from "./fnb.ts";
import { checkGASO } from "./gaso.ts";
import { health } from "../../services/providers/health.ts";

export async function checkEligibilityWithFallback(
  dni: string,
  phoneNumber?: string,
): Promise<ProviderCheckResult> {
  const fnbResult = await checkFNB(dni, phoneNumber);

  if (fnbResult.eligible) {
    return fnbResult;
  }

  if (fnbResult.reason === "provider_unavailable") {
    console.log(`[Orchestrator] FNB unavailable, trying GASO for DNI ${dni}`);
    return await checkGASO(dni, phoneNumber);
  }

  console.log(`[Orchestrator] Not found in FNB, trying GASO for DNI ${dni}`);
  const gasoResult = await checkGASO(dni, phoneNumber);

  if (gasoResult.reason === "provider_unavailable" && health.isAvailable("fnb")) {
    console.log(`[Orchestrator] GASO unavailable, using FNB fallback for DNI ${dni}`);
    return fnbResult;
  }

  return gasoResult;
}
