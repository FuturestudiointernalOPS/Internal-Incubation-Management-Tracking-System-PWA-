import { updateVisibilityMode } from "@/models/investor/visibility";
import { emitInvestorEvent } from "@/services/investor/activity";
import { isInvestorManagement } from "@/models/authorization/investorScope";

export const VISIBILITY_MODES = ["deal_flow_only", "full_pipeline"];

/**
 * Set an investor's visibility mode. Studio-only: the investor can never change
 * its own mode. The change is logged as `visibility_mode_changed` with the
 * old/new pair, so history stays correct after Flow 7.
 */
export async function setInvestorVisibilityMode({ investorId, mode, session }) {
  if (!isInvestorManagement(session)) {
    return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  }
  if (!VISIBILITY_MODES.includes(mode)) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }

  const result = await updateVisibilityMode(investorId, mode);
  if (!result.rows?.length) return { ok: false, status: 404, error: "errors.notFound" };

  await emitInvestorEvent({
    session,
    investorId,
    eventType: "visibility_mode_changed",
    actorType: "studio",
    relatedId: investorId,
    metadata: { old: result.previousMode, new: mode },
  });

  return { ok: true, investor: result.rows?.[0] || null };
}
