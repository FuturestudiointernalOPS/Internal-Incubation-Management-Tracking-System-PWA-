import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import { resolveVentureCode } from "@/services/ventures/operatingPlans";
import { VENTURE_SCOPE_TYPES } from "@/services/ventures/permissions";
import { inviteCoachByEmail } from "@/services/ventures/coach";
import { getVentureNameByIdOrCode } from "@/models/ventureWorkspace";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/coach-invite
 * { email, name?, responsibility_code?, scope_type?, preview? }
 *
 * Invite a coach (Future Studio staff or external) to a Venture by email —
 * the Venture-side mirror of the Program facilitator invite flow. The coach
 * becomes a platform user + active venture assignment; activation/login
 * email and CRM/Venture history follow automatically.
 *
 * Auth: `operating_plan` manage capability (journey/staffing management).
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "manage"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow inviting coaches to this Venture." }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body.email || "").trim();
    if (!email) return NextResponse.json({ success: false, error: "email is required." }, { status: 400 });

    const code = await resolveVentureCode(id);
    if (!code) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const ventureResult = await getVentureNameByIdOrCode(id).catch(() => ({ rows: [] }));
    const ventureName = ventureResult.rows?.[0]?.company_name || ventureResult.rows?.[0]?.name || code;

    // The invitee's responsibility is a PRIVILEGE boundary: this endpoint invites
    // a Coach / Facilitator, not a co-Lead-Manager. The code used to come from the
    // body, so a plan-manage holder could mint a `lead_manager`.
    const COACH_INVITE_RESPONSIBILITIES = new Set(["coach", "facilitator"]);
    const requestedResponsibility = String(body.responsibility_code || "").trim();
    const responsibilityCode = COACH_INVITE_RESPONSIBILITIES.has(requestedResponsibility)
      ? requestedResponsibility
      : "facilitator";
    // No scope reference is carried by this flow, so only a venture-wide scope is
    // meaningful; anything else would produce an unbound assignment.
    const scopeCodes = new Set(VENTURE_SCOPE_TYPES.map((scope) => scope.code));
    const requestedScope = String(body.scope_type || "").trim();
    const scopeType = scopeCodes.has(requestedScope) && requestedScope === "venture_wide"
      ? requestedScope
      : "venture_wide";

    const result = await inviteCoachByEmail({
      code,
      ventureName,
      email,
      name: body.name ? String(body.name) : null,
      responsibilityCode,
      scopeType,
      actorCid: session.cid || null,
      preview: body.preview === true,
    });

    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      const status = result.results?.[0]?.status;
      await addVentureHistory({
        venture_id: code,
        event_type: status === "invited" || status === "activation_sent" ? "COACH_INVITED" : "COACH_INVITE_PREVIEWED",
        description: `Coach invited by email (${email})${status ? ` — ${status}` : ""}${body.preview ? " [preview]" : ""}`,
      });
    } catch (_) {}

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
