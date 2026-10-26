import { createHandler } from "@/lib/api/createHandler";
import { getOrganizationContext, switchOrganizationContext } from "@/services/organizations/context";
import { organizationProgramResponse, privateOrganizationHandler } from "@/server/http/organizationPrograms";
import { refusalResponse } from "@/server/http/refusal";
export const dynamic = "force-dynamic";
export const GET = privateOrganizationHandler(createHandler(async (req) =>
  organizationProgramResponse(await getOrganizationContext({ session: req.session }))));
export const POST = privateOrganizationHandler(createHandler(async (req) => {
  // Require positive same-origin evidence, including the scheme and port.
  if (req.headers.get("origin") !== new URL(req.url).origin
    || ![null, "same-origin", "none"].includes(req.headers.get("sec-fetch-site"))) {
    return refusalResponse({ status: 403, errorKey: "errors.crossSiteRequestBlocked" });
  }
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
  }
  let body;
  try { body = await req.json(); } catch { return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" }); }
  return organizationProgramResponse(await switchOrganizationContext({ session: req.session,
    organizationId: body?.organization_id, expectedOrganizationId: body?.expected_organization_id }));
}));
