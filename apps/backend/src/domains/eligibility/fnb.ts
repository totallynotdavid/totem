import type { ProviderCheckResult } from "@totem/types";
import { FNBClient } from "../../adapters/providers/fnb-client.ts";
import { isAvailable, markBlocked } from "../../adapters/providers/health.ts";
import { PersonasService } from "../../domains/personas/index.ts";
import { isProviderForcedDown } from "../settings/system.ts";
import { getSimulationPersona } from "./shared.ts";
import { eligibilityLogger } from "@totem/logger";

export async function checkFNB(
  dni: string,
  phoneNumber?: string,
): Promise<ProviderCheckResult> {
  if (phoneNumber) {
    const persona = await getSimulationPersona(phoneNumber);
    if (persona) {
      eligibilityLogger.debug(
        { dni, persona: persona.name },
        "Using test persona",
      );
      return PersonasService.toProviderResult(persona);
    }
  }

  if (isProviderForcedDown("fnb")) {
    eligibilityLogger.debug({ dni }, "Provider forced down by admin");
    return { eligible: false, credit: 0, reason: "provider_forced_down" };
  }

  if (!isAvailable("fnb")) {
    eligibilityLogger.debug({ dni }, "Provider unavailable");
    return { eligible: false, credit: 0, reason: "provider_unavailable" };
  }

  try {
    const data = await FNBClient.queryCreditLine(dni);

    if (!(data.valid && data.data)) {
      return { eligible: false, credit: 0, name: undefined };
    }

    const credit = parseFloat(data.data.lineaCredito || "0");
    eligibilityLogger.info(
      { dni, credit, name: data.data.nombre },
      "Found credit for DNI",
    );

    return { eligible: true, credit, name: data.data.nombre };
  } catch (error) {
    eligibilityLogger.error({ err: error, dni }, "Credit check failed");

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("auth") ||
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("bloqueado")
      ) {
        markBlocked("fnb", error.message);
      }
    }

    return { eligible: false, credit: 0, reason: "api_error" };
  }
}
