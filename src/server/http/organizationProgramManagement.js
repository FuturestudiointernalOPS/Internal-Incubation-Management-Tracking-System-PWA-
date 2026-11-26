import { manageOrganizationProgram } from "@/services/organizations/programManagement";
import { organizationHandler, organizationProgramResponse, privateOrganizationHandler } from "./organizationPrograms";
import { refusalResponse } from "./refusal";

export function organizationProgramManagementRoute(action) {
  return privateOrganizationHandler(organizationHandler(async (req, context = {}) => {
    const write = !["workspace", "members", "enrollments", "sessions"].includes(action);
    let body;
    if (write) {
      if (req.headers.get("origin") !== new URL(req.url).origin
        || ![null, "same-origin", "none"].includes(req.headers.get("sec-fetch-site"))) {
        return refusalResponse({ status: 403, errorKey: "errors.crossSiteRequestBlocked" });
      }
      if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) {
        return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
      }
      try {
        const text = await req.text();
        if (text.length > 20000) return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
        body = JSON.parse(text);
      } catch { return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" }); }
    }
    const params = await context.params || {};
    const query = new URL(req.url).searchParams;
    return organizationProgramResponse(await manageOrganizationProgram({
      session: req.session, action, programId: params.programId, cohortId: params.cohortId, enrollmentId: params.enrollmentId, sessionId: params.sessionId,
      body, expectedOrganizationId: req.headers.get("x-organization-id"),
      page: Number(query.get("page") ?? 1), pageSize: Number(query.get("pageSize") ?? 20), search: query.get("search") ?? "",
    }));
  }));
}
