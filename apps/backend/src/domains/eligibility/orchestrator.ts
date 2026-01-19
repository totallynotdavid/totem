import { runProviderChecks } from "./checks.ts";
import { evaluateResults } from "./strategy.ts";
import type { EligibilityResult } from "./types.ts";

export async function checkEligibilityWithFallback(
  dni: string,
  phoneNumber?: string,
): Promise<EligibilityResult> {
  const results = await runProviderChecks(dni, phoneNumber);
  return evaluateResults(dni, results);
}
