/**
 * Platform — the Investor Run reference (SERVICE layer).
 *
 * The domain work behind `/api/platform/investor-run`: resolve the configured
 * Investor Run (the active, shareable run of the form flagged
 * `settings.investor_application = true`) and compose its public URL. The
 * CONTROLLER keeps `initDb`, the `super_admin` gate and the envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions, no SQL, no HTTP. It reads through
 * `@/models/**` and `@/lib/**`.
 */

import { resolveAppUrl } from "@/lib/appUrl";
import { resolveInvestorRun } from "@/models/investorApplication";

/** @returns {Promise<{status: number, body: Object}>} */
export async function getInvestorRunReference() {
  const run = await resolveInvestorRun();
  if (!run || !run.public_slug) {
    return {
      status: 404,
      body: {
        success: false,
        error: "No Investor Run configured. Run the Investor Application seed first.",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      run_id: run.id,
      name: run.name,
      status: run.status,
      slug: run.public_slug,
      url: `${resolveAppUrl()}/s/${run.public_slug}`,
    },
  };
}
