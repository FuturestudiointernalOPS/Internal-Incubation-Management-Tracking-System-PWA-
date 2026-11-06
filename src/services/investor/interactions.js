import { selectInvestorContext } from "@/models/investor/activityLog";
import { findVisibleInvestorVenture } from "@/models/investor/venturesAndUpdates";
import { readInvestorFlags } from "./featureFlags";
import { emitInvestorEvent } from "./activity";

export async function recordVerifiedInvestorInteraction({ session, kind, ventureIds }) {
  if (!["venture_viewed", "compare_used"].includes(kind) || !Array.isArray(ventureIds)
    || ventureIds.some(id => typeof id !== "string" || !id || id.length > 100)
    || new Set(ventureIds).size !== ventureIds.length
    || (kind === "venture_viewed" ? ventureIds.length !== 1 : ventureIds.length < 2 || ventureIds.length > 4)) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  if (!(await readInvestorFlags()).activity) return { ok: true, recorded: false };
  const profile = (await selectInvestorContext(session.cid || session.id)).rows[0];
  if (profile?.approval_status !== "approved") return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  const mode = profile.visibility_mode === "full_pipeline" ? "full_pipeline" : "deal_flow_only";
  const resolved = [];
  for (const ref of ventureIds) {
    const row = (await findVisibleInvestorVenture(ref, mode)).rows[0];
    if (!row) return { ok: false, status: 404, error: "errors.notFound" };
    resolved.push(row.id);
  }
  if (new Set(resolved).size !== resolved.length) return { ok: false, status: 400, error: "errors.invalidRequest" };
  const eventId = await emitInvestorEvent({ session, investorId: profile.id, eventType: kind,
    ventureId: kind === "venture_viewed" ? resolved[0] : null,
    metadata: kind === "compare_used" ? { venture_ids: resolved } : null });
  return { ok: true, recorded: eventId !== null };
}
