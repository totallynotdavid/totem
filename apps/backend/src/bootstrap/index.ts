import { setupEventSubscribers } from "./event-bus-setup.ts";
import { CheckEligibilityHandler } from "../domains/eligibility/handlers/check-eligibility-handler.ts";
import { FNBProvider } from "../domains/eligibility/providers/fnb-provider.ts";
import { PowerBIProvider } from "../domains/eligibility/providers/powerbi-provider.ts";
import { initializeEnrichmentRegistry } from "../conversation/enrichment/index.ts";
import { RetryEligibilityHandler } from "../domains/recovery/handlers/retry-eligibility-handler.ts";

// Create providers
const fnbProvider = new FNBProvider();
const powerbiProvider = new PowerBIProvider();

// Create handlers
export const eligibilityHandler = new CheckEligibilityHandler(
  fnbProvider,
  powerbiProvider,
);

export const retryEligibilityHandler = new RetryEligibilityHandler(
  eligibilityHandler,
);

export function initializeApplication(): void {
  setupEventSubscribers();
  initializeEnrichmentRegistry(eligibilityHandler);
}
