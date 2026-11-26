import { updateVisibilityMode } from "@/models/investor/visibility";
import { emitInvestorEvent } from "@/services/investor/activity";

export const VISIBILITY_MODES = ["deal_flow_only", "full_pipeline"];

/**
 * Set an investor's visibility mode. Studio-only: the investor can never change
 * its own mode. The change is logged as `visibility_mode_changed` with the
 * old/new pair, so history stays correct after Flow 7.
 */
export async function setInvestorVisibilityMode({ investorId, mode, oldMode = null, session }) {
  if (!VISIBILITY_MODES.includes(mode)) {
    return { ok: false, status: 400, error: "Invalid visibility mode." };
  }

  const result = await updateVisibilityMode(investorId, mode);

  await emitInvestorEvent({
    session,
    eventType: "visibility_mode_changed",
    actorType: "studio",
    relatedId: investorId,
    metadata: { old: oldMode, new: mode },
  });

  return { ok: true, investor: result.rows?.[0] || null };
}
