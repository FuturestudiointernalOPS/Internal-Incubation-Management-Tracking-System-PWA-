import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { isInvestorManagement } from "@/models/authorization/investorScope";
import { selectInvestorContext } from "@/models/investor/activityLog";
import { getActiveLegalDocument } from "@/models/investor/legalDocuments";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import { projectInvestorResponse } from "@/services/investor/responsePrivacy";

const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

const NDA_EXEMPT_SURFACES = new Set(["dashboard", "nda", "profile"]);

/**
 * A gated response boundary for legacy self-service. Original authentication,
 * ownership and operation guards remain in the handler. Resolve configuration
 * and approved context BEFORE mutations; a failure never falls back to raw rows.
 * Studio management contracts stay unchanged.
 */
export function withInvestorPrivacy(handler, surface) {
  return async function investorPrivacyHandler(req, context) {
    try {
      const session = await getSession();
      if (!session || isInvestorManagement(session)) return handler(req, context);
      const flags = await readInvestorFlags();
      if (!flags.visibility) return handler(req, context);
      const found = await selectInvestorContext(session.cid || session.id);
      const profile = found.rows[0];
      if (!profile || profile.approval_status !== "approved") {
        return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403, headers: PRIVATE });
      }

      // Guide §13.4 — no venture data until the current NDA version is accepted.
      if (flags.nda && !NDA_EXEMPT_SURFACES.has(surface)) {
        const lang = profile.preferred_language === "fr" || profile.language === "fr" ? "fr" : "en";
        const active = (await getActiveLegalDocument({ docType: "nda", language: lang })).rows?.[0];
        const needsNda = !profile.nda_accepted_at
          || (active?.version && profile.nda_version !== active.version);
        if (needsNda) {
          return NextResponse.json(
            { success: false, error: "errors.ndaRequired" },
            { status: 403, headers: PRIVATE },
          );
        }
      }

      const response = await handler(req, context);
      if (!response.ok) {
        // Never return a raw database error from the old catch blocks.
        const body = await response.json();
        const error = typeof body.error === "string" && /^errors\.[a-zA-Z0-9]+$/.test(body.error)
          ? body.error : "errors.somethingWrong";
        return NextResponse.json({ success: false, error }, { status: response.status, headers: PRIVATE });
      }
      const body = await response.json();
      const mode = profile.visibility_mode === "full_pipeline" ? "full_pipeline" : "deal_flow_only";
      return NextResponse.json(projectInvestorResponse(body, surface, mode), { status: response.status, headers: PRIVATE });
    } catch (_error) {
      return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500, headers: PRIVATE });
    }
  };
}
