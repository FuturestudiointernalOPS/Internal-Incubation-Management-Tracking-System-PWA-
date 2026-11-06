import { listPrivateVentureNotes, insertPrivateVentureNote } from "@/models/investor/privateNotes";
import { selectInvestorContext } from "@/models/investor/activityLog";
import { findVisibleInvestorVenture } from "@/models/investor/venturesAndUpdates";
import { readInvestorFlags } from "./featureFlags";

export async function privateVentureNotes({ session, ventureRef, content }) {
  if (!(await readInvestorFlags()).dashboard) return { ok: false, status: 404, error: "errors.notFound" };
  if (typeof ventureRef !== "string" || !ventureRef || ventureRef.length > 100
    || (content !== undefined && (typeof content !== "string" || !content.trim() || content.length > 4000))) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  const profile = (await selectInvestorContext(session.cid || session.id)).rows[0];
  if (profile?.approval_status !== "approved") return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  const mode = profile.visibility_mode === "full_pipeline" ? "full_pipeline" : "deal_flow_only";
  const venture = (await findVisibleInvestorVenture(ventureRef, mode)).rows[0];
  if (!venture) return { ok: false, status: 404, error: "errors.notFound" };
  if (content !== undefined) await insertPrivateVentureNote(profile.id, venture.id, content.trim());
  return { ok: true, notes: (await listPrivateVentureNotes(profile.id, venture.id)).rows };
}
