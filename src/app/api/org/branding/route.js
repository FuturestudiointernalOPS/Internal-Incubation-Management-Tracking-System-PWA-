import { updateOrganizationBranding } from "@/services/organizations/branding";
import { organizationHandler, organizationProgramResponse, privateOrganizationHandler } from "@/server/http/organizationPrograms";
import { refusalResponse } from "@/server/http/refusal";

export const dynamic = "force-dynamic";

export const PATCH = privateOrganizationHandler(organizationHandler(async (req) => {
  if (req.headers.get("origin") !== new URL(req.url).origin
    || ![null, "same-origin", "none"].includes(req.headers.get("sec-fetch-site"))) {
    return refusalResponse({ status: 403, errorKey: "errors.crossSiteRequestBlocked" });
  }
  if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) {
    return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
  }
  let body;
  try {
    const text = await req.text();
    if (text.length > 8000) return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
    body = JSON.parse(text);
  } catch {
    return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
  }
  return organizationProgramResponse(await updateOrganizationBranding({
    session: req.session,
    expectedOrganizationId: req.headers.get("x-organization-id"),
    body,
  }));
}));
